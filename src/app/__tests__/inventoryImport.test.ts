import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import {
  normalizeImportRows,
  refreshDuplicateCandidates,
  readInventoryWorkbook,
  suggestColumnMapping,
} from "../inventoryImportParser";

async function makeExcelFile(sheets: { name: string; rows: unknown[][] }[], fileName = "inventory.xlsx"): Promise<File> {
  const workbook = new ExcelJS.Workbook();
  sheets.forEach(({ name, rows }) => {
    const worksheet = workbook.addWorksheet(name);
    rows.forEach((row) => worksheet.addRow(row));
  });
  const bytes = await workbook.xlsx.writeBuffer();
  return new File([new Uint8Array(bytes).buffer], fileName, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

describe("inventoryImport", () => {
  it("reads a real xlsx workbook and normalizes regular inventory fields", async () => {
    const file = await makeExcelFile([{ name: "Inventory", rows: [
      ["Product Name", "SKU", "Barcode", "Quantity", "Unit", "Purchase Price", "Selling Price", "GST", "Category"],
      ["Blue Pen", "PEN-1", "000123456789", 50, "Piece", 5, 10, 18, "Stationery"],
    ] }]);
    const workbook = await readInventoryWorkbook(file);
    const sheet = workbook.sheets[0];
    const mapping = suggestColumnMapping(sheet.headerLabels);
    const result = normalizeImportRows(sheet, mapping);

    expect(workbook.selectedSheetName).toBe("Inventory");
    expect(sheet.headerRowIndex).toBe(0);
    expect(result.rows[0].product).toMatchObject({
      name: "Blue Pen",
      sku: "PEN-1",
      barcode: "000123456789",
      quantity: 50,
      purchasePrice: 5,
      sellingPrice: 10,
      gstRate: 18,
    });
    expect(result.rows[0].errors).toEqual([]);
  });

  it("detects headers below titles and blank rows, and requires a manual Rate mapping", async () => {
    const file = await makeExcelFile([{ name: "Sheet1", rows: [
      ["Acme Store Inventory"],
      [],
      [],
      ["Particulars", "Qty", "Rate", "MRP"],
      ["Blue Pen", 50, "₹5.10", "₹10.00"],
      ["Notebook", 20, "₹35.00", "₹50.00"],
    ] }]);
    const workbook = await readInventoryWorkbook(file);
    const sheet = workbook.sheets[0];
    const mapping = suggestColumnMapping(sheet.headerLabels);
    const initial = normalizeImportRows(sheet, mapping);

    expect(sheet.headerRowIndex).toBe(3);
    expect(mapping[2]).toBeNull();
    expect(mapping[3]).toBe("sellingPrice");
    expect(initial.rows[0].product.purchasePrice).toBeNull();
    expect(initial.rows[0].errors).toContain("Purchase price is required. Map a purchase-price column or enter it.");

    mapping[2] = "purchasePrice";
    const reviewed = normalizeImportRows(sheet, mapping);
    expect(reviewed.rows.map((row) => [
      row.product.name,
      row.product.quantity,
      row.product.purchasePrice,
      row.product.sellingPrice,
    ])).toEqual([
      ["Blue Pen", 50, 5.1, 10],
      ["Notebook", 20, 35, 50],
    ]);
  });

  it("uses the best worksheet by default and exposes other recognized worksheets for selection", async () => {
    const file = await makeExcelFile([
      { name: "Notes", rows: [["Supplier notes"], ["Nothing to import"]] },
      { name: "Inventory", rows: [["Item Name", "Stock", "Sale Price"], ["Pencil", 3, 2]] },
      { name: "Opening Stock", rows: [["Product", "Qty", "MRP"], ["Eraser", 4, 5]] },
    ]);
    const workbook = await readInventoryWorkbook(file);

    expect(workbook.selectedSheetName).toBe("Inventory");
    expect(workbook.sheets.map((sheet) => sheet.name)).toEqual(["Inventory", "Opening Stock"]);
  });

  it("recognizes common supplier aliases and split multi-row price headers after long introductions", async () => {
    const introductoryRows = Array.from({ length: 65 }, (_, index) => [`Supplier report ${index + 1}`]);
    const file = await makeExcelFile([
      { name: "Notes", rows: [["Supplier notes"], ["No product table"]] },
      {
        name: "Stock",
        rows: [
          ...introductoryRows,
          ["", "", "", "", "", "Purchase", "Selling", "", ""],
          ["Product Description", "Item Code", "EAN Code", "Opening Qty", "Unit of Measure", "Rate", "Price", "GST %", "Product Group"],
          ["Blue Pen", "PEN-01", "00012345", "25", "pcs", "₹4.50", "₹8.00", "12%", "Stationery"],
        ],
      },
    ]);
    const workbook = await readInventoryWorkbook(file);
    const sheet = workbook.sheets.find((candidate) => candidate.name === "Stock");
    expect(sheet).toBeDefined();
    expect(sheet?.headerRowIndex).toBe(66);

    const mapping = suggestColumnMapping(sheet!.headerLabels);
    expect(mapping).toEqual({
      0: "name",
      1: "sku",
      2: "barcode",
      3: "quantity",
      4: "unit",
      5: "purchasePrice",
      6: "sellingPrice",
      7: "gstRate",
      8: "category",
    });
    const result = normalizeImportRows(sheet!, mapping);
    expect(result.rows[0].product).toMatchObject({
      name: "Blue Pen",
      sku: "PEN-01",
      barcode: "00012345",
      quantity: 25,
      unit: "pcs",
      purchasePrice: 4.5,
      sellingPrice: 8,
      gstRate: 12,
      category: "Stationery",
    });
    expect(result.rows[0].errors).toEqual([]);
  });

  it("keeps rows in a different column order and ignores clear subtotal rows", async () => {
    const file = await makeExcelFile([{ name: "Products", rows: [
      ["MRP", "Unrelated", "Item Code", "Qty", "Particulars", "Rate"],
      [10, "extra", "B-1", 2, "Marker", 4],
      [null, null, null, null, null, null],
      ["", "", "", "", "Subtotal", 8],
    ] }]);
    const workbook = await readInventoryWorkbook(file);
    const sheet = workbook.sheets[0];
    const mapping = suggestColumnMapping(sheet.headerLabels);
    mapping[5] = "purchasePrice";
    const result = normalizeImportRows(sheet, mapping);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].product).toMatchObject({ name: "Marker", sku: "B-1", quantity: 2, purchasePrice: 4, sellingPrice: 10 });
    expect(result.excludedTotals).toBe(1);
  });

  it("flags duplicate products already in inventory and repeated rows in the file", async () => {
    const file = await makeExcelFile([{ name: "Inventory", rows: [
      ["Product", "Qty", "Selling Price", "SKU"],
      ["Pencil", 5, 2, "P-1"],
      ["Pencil", 8, 3, "P-2"],
    ] }]);
    const workbook = await readInventoryWorkbook(file);
    const sheet = workbook.sheets[0];
    const result = normalizeImportRows(
      sheet,
      suggestColumnMapping(sheet.headerLabels),
      [{ name: "Pencil", sku: "OLD-1", barcode: "" }],
    );

    expect(result.rows.every((row) => row.duplicateReason)).toBe(true);
    expect(result.rows.every((row) => !row.includeDuplicate)).toBe(true);
    const edited = refreshDuplicateCandidates(
      result.rows.map((row, index) => index === 0 ? { ...row, product: { ...row.product, name: "Marker" } } : row),
      [{ name: "Pencil", sku: "OLD-1", barcode: "" }],
    );
    expect(edited[0].duplicateReason).toBe("");
    expect(edited[1].duplicateReason).toBe("Product name already exists in inventory.");
  });

  it("preserves leading zero barcodes from zero-padded numeric Excel formatting", async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Sheet1");
    worksheet.addRow(["Product", "Qty", "Selling Price", "Barcode"]);
    worksheet.addRow(["Soap", 1, 12, 123]);
    worksheet.getCell("D2").numFmt = "000000";
    const bytes = await workbook.xlsx.writeBuffer();
    const file = new File([new Uint8Array(bytes).buffer], "barcodes.xlsx");
    const parsed = await readInventoryWorkbook(file);
    const sheet = parsed.sheets[0];
    const result = normalizeImportRows(sheet, suggestColumnMapping(sheet.headerLabels));

    expect(result.rows[0].product.barcode).toBe("000123");
  });

  it("reports corrupt or unsupported files and does not return empty inventory", async () => {
    const unsupported = new File(["not a spreadsheet"], "inventory.pdf");
    await expect(readInventoryWorkbook(unsupported)).rejects.toThrow("Unsupported file type");

    const corrupt = new File(["not a valid workbook"], "inventory.xlsx");
    await expect(readInventoryWorkbook(corrupt)).rejects.toThrow();
    const unrecognized = new File(["Store Report\nNothing to import\n"], "report.csv");
    await expect(readInventoryWorkbook(unrecognized)).rejects.toThrow("No worksheet contains recognizable product headers");
  });

  it("parses CSV contents and clearly rejects unsupported legacy XLS workbooks", async () => {
    const csv = new File(
      ['Product Name,Qty,Purchase Price,Selling Price,Barcode\n"Blue, fine pen",2,"₹4.50","₹9.00",000045\n'],
      "stock.csv",
      { type: "text/csv" },
    );
    const csvWorkbook = await readInventoryWorkbook(csv);
    const csvSheet = csvWorkbook.sheets[0];
    const csvRows = normalizeImportRows(csvSheet, suggestColumnMapping(csvSheet.headerLabels));
    expect(csvRows.rows[0].product).toMatchObject({
      name: "Blue, fine pen",
      barcode: "000045",
      quantity: 2,
      purchasePrice: 4.5,
      sellingPrice: 9,
    });

    const legacy = new File(["not supported"], "stock.xls");
    await expect(readInventoryWorkbook(legacy)).rejects.toThrow("Legacy .xls files are not supported");
  });

  it("identifies missing names and non-numeric quantity and selling price values", async () => {
    const file = await makeExcelFile([{ name: "Stock", rows: [
      ["Product", "Qty", "Selling Price"],
      ["", "four", "₹20"],
      ["Soap", 2, "not available"],
    ] }]);
    const workbook = await readInventoryWorkbook(file);
    const sheet = workbook.sheets[0];
    const result = normalizeImportRows(sheet, suggestColumnMapping(sheet.headerLabels));

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0].errors).toEqual(expect.arrayContaining([
      "Product name is required.",
      "Quantity must be a non-negative number.",
    ]));
    expect(result.rows[1].errors).toContain("Selling price must be a non-negative number.");
  });
});
