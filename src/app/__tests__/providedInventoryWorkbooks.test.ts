import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  normalizeImportRows,
  readInventoryWorkbook,
  suggestColumnMapping,
} from "../inventoryImportParser";
import { persistImportedInventory } from "../inventoryImportPersistence";

async function readFixture(fileName: string): Promise<Awaited<ReturnType<typeof readInventoryWorkbook>>> {
  const path = new URL(`./fixtures/${fileName}`, import.meta.url);
  const contents = await readFile(path);
  return readInventoryWorkbook(new File([new Uint8Array(contents)], fileName));
}

describe("provided BillPilot inventory workbook fixtures", () => {
  it("reads the standard workbook with every product field mapped correctly", async () => {
    const workbook = await readFixture("BillPilot_Test_1_Standard.xlsx");
    const sheet = workbook.sheets[0];
    const result = normalizeImportRows(sheet, suggestColumnMapping(sheet.headerLabels));

    expect(workbook.selectedSheetName).toBe("Sheet1");
    expect(sheet.headerRowIndex).toBe(0);
    expect(result.rows).toHaveLength(4);
    expect(result.rows[0].product).toEqual({
      name: "Blue Ball Pen",
      sku: "PEN001",
      barcode: "890100000001",
      quantity: 50,
      unit: "pcs",
      purchasePrice: 5,
      sellingPrice: 10,
      gstRate: 12,
      category: "Stationery",
    });
    expect(result.rows.every((row) => !row.errors.length)).toBe(true);
  });

  it("persists confirmed standard workbook rows and identifies the same import on retry", async () => {
    const workbook = await readFixture("BillPilot_Test_1_Standard.xlsx");
    const sheet = workbook.sheets[0];
    const normalized = normalizeImportRows(sheet, suggestColumnMapping(sheet.headerLabels));
    const products = normalized.rows.map((row, index) => ({
      id: 100 + index,
      name: row.product.name,
      sku: row.product.sku,
      barcode: row.product.barcode,
      price: row.product.sellingPrice,
      costPrice: row.product.purchasePrice,
      stock: row.product.quantity,
      unit: row.product.unit,
      category: row.product.category,
    }));
    const savedValues = new Map<string, string>();
    const storage = {
      getItem: (key: string) => savedValues.get(key) ?? null,
      setItem: (key: string, value: string) => { savedValues.set(key, value); },
    };

    const saved = persistImportedInventory(storage, "billpilot_test_account_products", [], products);
    expect(JSON.parse(storage.getItem("billpilot_test_account_products") || "null")).toEqual(saved);
    expect(saved[0]).toMatchObject({ price: 10, costPrice: 5, stock: 50 });

    const retry = normalizeImportRows(sheet, suggestColumnMapping(sheet.headerLabels), saved);
    expect(retry.rows.every((row) => row.duplicateReason.length > 0)).toBe(true);
  });

  it("detects the supplier header, excludes the grand total and requires Rate confirmation", async () => {
    const workbook = await readFixture("BillPilot_Test_2_Supplier_Headers.xlsx");
    const sheet = workbook.sheets[0];
    const mapping = suggestColumnMapping(sheet.headerLabels);
    const firstPass = normalizeImportRows(sheet, mapping);

    expect(sheet.name).toBe("Purchase Bill");
    expect(sheet.headerRowIndex).toBe(3);
    expect(mapping[0]).toBe("name");
    expect(mapping[1]).toBe("sku");
    expect(mapping[2]).toBe("quantity");
    expect(mapping[3]).toBe("unit");
    expect(mapping[4]).toBeNull();
    expect(mapping[5]).toBe("sellingPrice");
    expect(mapping[6]).toBe("gstRate");
    expect(mapping[7]).toBe("lineAmount");
    expect(firstPass.rows[0].product.purchasePrice).toBeNull();
    expect(firstPass.rows[0].product.sellingPrice).toBe(10);
    expect(firstPass.excludedTotals).toBe(1);
    expect(firstPass.rows.map((row) => row.product.name)).toEqual(["Blue Pen", "Long Notebook", "Geometry Box"]);
    expect(firstPass.rows[0].errors).toContain("Purchase price is required. Map a purchase-price column or enter it.");

    mapping[4] = "purchasePrice";
    const confirmedMapping = normalizeImportRows(sheet, mapping);
    expect(confirmedMapping.rows.map((row) => [
      row.product.purchasePrice,
      row.product.sellingPrice,
      row.product.gstRate,
    ])).toEqual([[5, 10, 12], [35, 50, 12], [40, 65, 18]]);
    expect(confirmedMapping.rows.every((row) => !row.errors.length)).toBe(true);
  });

  it("uses the recognized inventory sheet in a messy multi-sheet workbook and parses text numbers", async () => {
    const workbook = await readFixture("BillPilot_Test_3_Messy_MultiSheet.xlsx");
    const sheet = workbook.sheets[0];
    const result = normalizeImportRows(sheet, suggestColumnMapping(sheet.headerLabels));

    expect(workbook.selectedSheetName).toBe("Inventory Upload");
    expect(workbook.sheets.map((candidate) => candidate.name)).toEqual(["Inventory Upload"]);
    expect(sheet.headerRowIndex).toBe(3);
    expect(result.rows.map((row) => [
      row.product.name,
      row.product.quantity,
      row.product.purchasePrice,
      row.product.sellingPrice,
    ])).toEqual([
      ["Red Pen", 40, 4.5, 8],
      ["A4 Register", 12, 85, 120],
      ["Gift Bag", 25, 15, 30],
    ]);
  });

  it("flags missing fields and leaves ambiguous supplier Rate unmapped", async () => {
    const workbook = await readFixture("BillPilot_Test_4_Incomplete_Ambiguous.xlsx");
    const sheet = workbook.sheets[0];
    const mapping = suggestColumnMapping(sheet.headerLabels);
    const result = normalizeImportRows(sheet, mapping);

    expect(mapping[2]).toBeNull();
    expect(result.rows).toHaveLength(4);
    expect(result.rows[0].product.purchasePrice).toBeNull();
    expect(result.rows[0].errors).toContain("Purchase price is required. Map a purchase-price column or enter it.");
    expect(result.rows[2].errors).toEqual(expect.arrayContaining([
      "Quantity is required.",
      "Selling price is required. Map a selling-price column or enter it.",
    ]));
    expect(result.rows[3].errors).toContain("Product name is required.");
  });

  it("identifies duplicate SKUs and prevents the same workbook from adding the rows again", async () => {
    const workbook = await readFixture("BillPilot_Test_5_Duplicates.xlsx");
    const sheet = workbook.sheets[0];
    const mapping = suggestColumnMapping(sheet.headerLabels);
    const firstReview = normalizeImportRows(sheet, mapping);

    expect(firstReview.rows.filter((row) => row.duplicateReason)).toHaveLength(2);
    expect(firstReview.rows[1].duplicateReason).toBe("SKU already exists in inventory.");
    expect(firstReview.rows[3].duplicateReason).toBe("SKU already exists in inventory.");

    const afterFirstImport = firstReview.rows
      .filter((row) => !row.duplicateReason)
      .map((row) => ({ ...row.product, barcode: "" }));
    const retry = normalizeImportRows(sheet, mapping, afterFirstImport);
    expect(retry.rows.every((row) => row.duplicateReason.length > 0)).toBe(true);
  });

  it("parses the advanced edge-case workbook from its actual fixture", async () => {
    const workbook = await readFixture("BillPilot_Test_6_Advanced_Edge_Cases.xlsx");
    const sheet = workbook.sheets.find((candidate) => candidate.name === "Stock Import");
    expect(sheet).toBeDefined();
    expect(workbook.selectedSheetName).toBe("Stock Import");
    expect(workbook.sheets.map((candidate) => candidate.name)).toEqual(["Stock Import"]);
    expect(sheet?.headerRowIndex).toBe(4);
    expect(sheet?.headerLabels).toEqual([
      "Item Code",
      "Product / Particulars",
      "Barcode",
      "Opening Stock",
      "UOM",
      "Cost Price (₹)",
      "MRP (₹)",
      "GST %",
      "Category",
      "Notes / Ignore",
    ]);

    const mapping = suggestColumnMapping(sheet!.headerLabels);
    expect(mapping).toMatchObject({
      0: "sku",
      1: "name",
      2: "barcode",
      3: "quantity",
      4: "unit",
      5: "purchasePrice",
      6: "sellingPrice",
      7: "gstRate",
      8: "category",
    });
    const result = normalizeImportRows(sheet!, mapping);
    expect(result.totalSourceRows).toBe(10);
    expect(result.rows).toHaveLength(9);
    expect(result.rows.filter((row) => !row.errors.length)).toHaveLength(7);
    expect(result.rows.filter((row) => row.duplicateReason)).toHaveLength(1);
    expect(result.rows.filter((row) => row.errors.length)).toHaveLength(2);
    expect(result.rows[0].product).toMatchObject({
      sku: "PEN-010",
      name: "Black Gel Pen",
      barcode: "000123456789",
      quantity: 24,
      unit: "pcs",
      purchasePrice: 6.5,
      sellingPrice: 12,
      gstRate: 12,
      category: "Pens",
    });
    expect(result.rows[5].product.name).toBe("SECTION: Seasonal Items");
    expect(result.rows[5].errors).toContain("Quantity is required.");
    expect(result.rows[7].duplicateReason).toBe("Barcode already exists in inventory.");
    expect(result.rows[8].errors).toContain("Quantity must be a non-negative number.");
    expect(result.rows[8].errors).toContain("Purchase price must be a non-negative number.");
    expect(result.rows[8].errors).toContain("GST rate must be between 0 and 100.");
    expect(result.excludedTotals).toBe(1);

    const importableProducts = result.rows
      .filter((row) => !row.errors.length && !row.duplicateReason)
      .map((row, index) => ({
        id: 1000 + index,
        name: row.product.name,
        sku: row.product.sku,
        barcode: row.product.barcode,
        price: row.product.sellingPrice,
        costPrice: row.product.purchasePrice,
        stock: row.product.quantity,
        unit: row.product.unit,
        category: row.product.category,
      }));
    const savedValues = new Map<string, string>();
    const storage = {
      getItem: (key: string) => savedValues.get(key) ?? null,
      setItem: (key: string, value: string) => { savedValues.set(key, value); },
    };
    const saved = persistImportedInventory(storage, "test_inventory_products", [], importableProducts);
    expect(JSON.parse(storage.getItem("test_inventory_products") || "null")).toEqual(saved);
    expect(saved).toHaveLength(6);
    expect(saved[0]).toMatchObject({ name: "Black Gel Pen", barcode: "000123456789", stock: 24, costPrice: 6.5, price: 12 });
  });
});
