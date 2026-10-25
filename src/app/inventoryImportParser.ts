import ExcelJS from "exceljs";

export type InventoryField =
  | "name"
  | "sku"
  | "barcode"
  | "quantity"
  | "unit"
  | "purchasePrice"
  | "sellingPrice"
  | "gstRate"
  | "category";

export type ColumnMapping = Record<number, InventoryField | "ignore" | "lineAmount" | null>;

export interface ImportSheet {
  name: string;
  rows: string[][];
  headerRowIndex: number;
  headerLabels: string[];
  headerScore: number;
}

export interface ImportWorkbook {
  sheets: ImportSheet[];
  selectedSheetName: string;
}

export interface ImportedProduct {
  name: string;
  sku: string;
  barcode: string;
  quantity: number | null;
  unit: string;
  purchasePrice: number | null;
  sellingPrice: number | null;
  gstRate: number | null;
  category: string;
}

export interface NormalizedImportRow {
  rowNumber: number;
  product: ImportedProduct;
  errors: string[];
  duplicateReason: string;
  includeDuplicate: boolean;
}

export const IMPORT_FIELDS: { value: InventoryField; label: string }[] = [
  { value: "name", label: "Product name" },
  { value: "sku", label: "SKU" },
  { value: "barcode", label: "Barcode" },
  { value: "quantity", label: "Quantity / stock" },
  { value: "unit", label: "Unit" },
  { value: "purchasePrice", label: "Purchase price" },
  { value: "sellingPrice", label: "Selling price" },
  { value: "gstRate", label: "GST rate" },
  { value: "category", label: "Category" },
];

const HEADER_ALIASES: Record<InventoryField, string[]> = {
  name: [
    "productname", "item", "itemname", "particular", "particulars", "description",
    "productparticulars", "productdescription", "itemdescription", "goodsdescription",
    "product", "name",
  ],
  sku: [
    "sku", "skuno", "itemcode", "productcode", "code", "itemid", "productid",
    "itemnumber", "itemno", "productnumber", "productno",
  ],
  barcode: ["barcode", "barcodenumber", "ean", "eancode", "upc", "upccode", "gtin"],
  quantity: [
    "qty", "quantity", "stock", "openingstock", "units", "stockqty", "closingstock",
    "openingqty", "closingqty", "openingquantity", "closingquantity", "stockquantity",
    "currentstock", "availablequantity", "balanceqty", "quantityinhand",
  ],
  unit: ["unit", "uom", "measurement", "unitofmeasure"],
  purchasePrice: [
    "purchaseprice", "costprice", "buyingprice", "purchaserate", "buyingrate",
    "costrate", "unitcost", "cost",
  ],
  sellingPrice: [
    "sellingprice", "saleprice", "salesprice", "mrp", "retailprice", "sellingrate",
    "salesrate",
  ],
  gstRate: ["gst", "gstrate", "tax", "taxrate", "gstpercentage", "taxpercentage"],
  category: ["category", "productcategory", "group", "productgroup"],
};

const normalizeHeader = (value: string) =>
  value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\s_\-().%₹$#]/g, "")
    .replace(/[^a-z0-9]/g, "");

const isEmptyRow = (row: string[]) => row.every((cell) => !cell.trim());

function matchHeader(label: string): InventoryField | "ambiguous" | "lineAmount" | null {
  const normalized = normalizeHeader(label);
  if (normalized === "rate" || normalized === "price") return "ambiguous";
  if (["amount", "lineamount", "linetotal", "totalamount", "extendedamount"].includes(normalized)) return "lineAmount";

  const matches = (Object.entries(HEADER_ALIASES) as [InventoryField, string[]][])
    .filter(([, aliases]) => aliases.some((alias) => normalizeHeader(alias) === normalized))
    .map(([field]) => field);
  return matches.length === 1 ? matches[0] : null;
}

function findHeaderRow(rows: string[][]): { index: number; labels: string[]; score: number } | null {
  let best: { index: number; labels: string[]; score: number } | null = null;
  const limit = Math.min(rows.length, 100);

  for (let rowIndex = 0; rowIndex < limit; rowIndex += 1) {
    const labels = rows[rowIndex].map((label, columnIndex) => {
      const current = label.trim();
      const previous = rows[rowIndex - 1]?.[columnIndex]?.trim() || "";
      const currentMatch = matchHeader(current);
      if (!current && previous && matchHeader(previous)) return previous;

      if (currentMatch === "ambiguous" && previous) {
        const parent = normalizeHeader(previous);
        const parentGroups: Record<string, string> = {
          buying: "buying",
          cost: "cost",
          purchase: "purchase",
          purchasing: "purchase",
          sale: "sale",
          sales: "sales",
          selling: "selling",
        };
        const prefix = parentGroups[parent];
        if (prefix) {
          const combined = `${prefix} ${current}`;
          const combinedMatch = matchHeader(combined);
          if (combinedMatch && combinedMatch !== "ambiguous" && combinedMatch !== "lineAmount") {
            return combined;
          }
        }
      }
      return current;
    });
    const identified = labels.map(matchHeader);
    const mappedCount = new Set(identified.filter((field): field is InventoryField =>
      field !== null && field !== "ambiguous" && field !== "lineAmount"
    )).size;
    const hasName = identified.includes("name");
    const score = mappedCount + (identified.includes("ambiguous") ? 0.5 : 0);
    if (!hasName || mappedCount < 2) continue;
    if (!best || score > best.score) best = { index: rowIndex, labels, score };
  }

  return best;
}

function cellText(value: unknown, numberFormat = ""): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "number") {
    const integerFormat = numberFormat.split(";")[0].trim();
    if (Number.isInteger(value) && /^0+$/.test(integerFormat)) return String(value).padStart(integerFormat.length, "0");
    return String(value);
  }
  if (typeof value === "string" || typeof value === "boolean") return String(value).trim();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if ("result" in record) return cellText(record.result, numberFormat);
    if ("richText" in record && Array.isArray(record.richText)) {
      return record.richText.map((part) => typeof part === "object" && part && "text" in part ? String(part.text) : "").join("").trim();
    }
    if (typeof record.text === "string") return record.text.trim();
  }
  return "";
}

function worksheetRows(worksheet: ExcelJS.Worksheet): string[][] {
  const columnCount = worksheet.columnCount;
  const rows: string[][] = [];
  for (let rowIndex = 1; rowIndex <= worksheet.rowCount; rowIndex += 1) {
    const worksheetRow = worksheet.getRow(rowIndex);
    const row: string[] = [];
    for (let columnIndex = 1; columnIndex <= columnCount; columnIndex += 1) {
      const cell = worksheetRow.getCell(columnIndex);
      row.push(cellText(cell.value, cell.numFmt));
    }
    rows.push(row);
  }
  return rows;
}

function parseCsv(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  if (quoted) throw new Error("CSV contains an unterminated quoted field.");
  if (value || row.length || (source.length > 0 && !/[\r\n]$/.test(source))) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}

export async function readInventoryWorkbook(file: File): Promise<ImportWorkbook> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension || !["xlsx", "csv"].includes(extension)) {
    throw new Error("Unsupported file type. Choose an .xlsx or .csv file. Legacy .xls files are not supported.");
  }
  if (file.size === 0) throw new Error("The selected file is empty.");
  if (file.size > 15 * 1024 * 1024) throw new Error("File is larger than the 15 MB import limit.");

  let worksheetData: { name: string; rows: string[][] }[];
  try {
    if (extension === "csv") {
      worksheetData = [{ name: "CSV", rows: parseCsv(await file.text()) }];
    } else {
      const bytes = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(bytes);
      worksheetData = workbook.worksheets.map((worksheet) => ({
        name: worksheet.name,
        rows: worksheetRows(worksheet),
      }));
    }
  } catch {
    throw new Error("Could not read this file. It may be corrupt, password-protected, or unsupported.");
  }

  const sheets: ImportSheet[] = worksheetData
    .map(({ name, rows }) => {
      const header = findHeaderRow(rows);
      return header ? { name, rows, headerRowIndex: header.index, headerLabels: header.labels, headerScore: header.score } : null;
    })
    .filter((sheet): sheet is ImportSheet => sheet !== null);

  if (sheets.length === 0) {
    throw new Error("No worksheet contains recognizable product headers. Check that the file has a product-name column and other inventory columns.");
  }
  const selectedSheetName = [...sheets].sort((a, b) => b.headerScore - a.headerScore)[0].name;
  return { sheets, selectedSheetName };
}

export function suggestColumnMapping(headers: string[]): ColumnMapping {
  const matches = headers.map(matchHeader);
  const counts = new Map<InventoryField, number>();
  matches.forEach((field) => {
    if (field && field !== "ambiguous" && field !== "lineAmount") counts.set(field, (counts.get(field) || 0) + 1);
  });

  const mapping: ColumnMapping = {};
  matches.forEach((field, index) => {
    if (field === "lineAmount") {
      mapping[index] = "lineAmount";
    } else {
      mapping[index] = field && field !== "ambiguous" && counts.get(field) === 1 ? field : null;
    }
  });
  return mapping;
}

export function columnDetectionStatus(header: string, mapping: ColumnMapping, columnIndex: number): string {
  if (mapping[columnIndex] === "lineAmount") return "Line amount: not used as a unit price";
  if (mapping[columnIndex] === "ignore") return "Ignored by user";
  if (mapping[columnIndex]) return "Detected";
  if (matchHeader(header) === "ambiguous") return "Ambiguous: map manually";
  return header.trim() ? "Not detected: map manually or ignore" : "Blank header";
}

export function sampleColumnValues(sheet: ImportSheet, columnIndex: number): string[] {
  return sheet.rows
    .slice(sheet.headerRowIndex + 1)
    .map((row) => row[columnIndex]?.trim() || "")
    .filter(Boolean)
    .slice(0, 3);
}

function parseNumeric(value: string): number | null {
  const trimmed = value.trim().replace(/^'/, "").trim();
  if (!trimmed) return null;
  const negative = /^\(.*\)$/.test(trimmed);
  const normalized = trimmed.replace(/[₹$€£,\s%]/g, "").replace(/[()]/g, "");
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized) * (negative ? -1 : 1);
  return Number.isFinite(parsed) ? parsed : null;
}

function isClearlyTotalRow(row: string[]): boolean {
  const populated = row.map((cell) => cell.trim()).filter(Boolean);
  if (!populated.length) return false;
  return /^(?:sub\s*total|subtotal|grand\s*total|invoice\s*total|total(?:\s+(?:amount|quantity|qty|value|due))?)\s*[:\-]?$/i.test(populated[0]);
}

function fieldValue(row: string[], mapping: ColumnMapping, field: InventoryField): string {
  const columnIndex = Object.entries(mapping).find(([, mappedField]) => mappedField === field)?.[0];
  return columnIndex === undefined ? "" : (row[Number(columnIndex)] || "").trim();
}

export function normalizeImportRows(
  sheet: ImportSheet,
  mapping: ColumnMapping,
  existingProducts: { name: string; sku: string; barcode: string }[] = []
): { rows: NormalizedImportRow[]; totalSourceRows: number; excludedTotals: number } {
  const sourceRows = sheet.rows.slice(sheet.headerRowIndex + 1);
  let excludedTotals = 0;
  const rows: NormalizedImportRow[] = [];
  const seenProducts: { name: string; sku: string; barcode: string }[] = [];

  sourceRows.forEach((sourceRow, index) => {
    if (isEmptyRow(sourceRow)) return;
    if (isClearlyTotalRow(sourceRow)) {
      excludedTotals += 1;
      return;
    }

    const quantityText = fieldValue(sourceRow, mapping, "quantity");
    const purchaseText = fieldValue(sourceRow, mapping, "purchasePrice");
    const sellingText = fieldValue(sourceRow, mapping, "sellingPrice");
    const gstText = fieldValue(sourceRow, mapping, "gstRate");
    const product: ImportedProduct = {
      name: fieldValue(sourceRow, mapping, "name"),
      sku: fieldValue(sourceRow, mapping, "sku"),
      barcode: fieldValue(sourceRow, mapping, "barcode"),
      quantity: parseNumeric(quantityText),
      unit: fieldValue(sourceRow, mapping, "unit"),
      purchasePrice: parseNumeric(purchaseText),
      sellingPrice: parseNumeric(sellingText),
      gstRate: parseNumeric(gstText),
      category: fieldValue(sourceRow, mapping, "category"),
    };
    const errors: string[] = [];
    if (!product.name) errors.push("Product name is required.");
    if (!quantityText) errors.push("Quantity is required.");
    else if (product.quantity === null || product.quantity < 0) errors.push("Quantity must be a non-negative number.");
    if (!sellingText) errors.push("Selling price is required. Map a selling-price column or enter it.");
    else if (product.sellingPrice === null || product.sellingPrice < 0) errors.push("Selling price must be a non-negative number.");
    if (!purchaseText) errors.push("Purchase price is required. Map a purchase-price column or enter it.");
    else if (product.purchasePrice === null || product.purchasePrice < 0) errors.push("Purchase price must be a non-negative number.");
    if (gstText && (product.gstRate === null || product.gstRate < 0 || product.gstRate > 100)) errors.push("GST rate must be between 0 and 100.");

    const duplicateReason = findDuplicateReason(product, [...existingProducts, ...seenProducts]);
    if (product.name || product.sku || product.barcode) {
      seenProducts.push({ name: product.name, sku: product.sku, barcode: product.barcode });
    }
    rows.push({
      rowNumber: sheet.headerRowIndex + index + 2,
      product,
      errors,
      duplicateReason,
      includeDuplicate: false,
    });
  });

  return { rows, totalSourceRows: sourceRows.length, excludedTotals };
}

export function refreshDuplicateCandidates(
  rows: NormalizedImportRow[],
  existingProducts: { name: string; sku: string; barcode: string }[]
): NormalizedImportRow[] {
  const seenProducts = [...existingProducts];
  return rows.map((row) => {
    const duplicateReason = findDuplicateReason(row.product, seenProducts);
    if (row.product.name || row.product.sku || row.product.barcode) {
      seenProducts.push({ name: row.product.name, sku: row.product.sku, barcode: row.product.barcode });
    }
    return {
      ...row,
      duplicateReason,
      includeDuplicate: duplicateReason === row.duplicateReason ? row.includeDuplicate : false,
    };
  });
}

function findDuplicateReason(
  product: ImportedProduct,
  existingProducts: { name: string; sku: string; barcode: string }[]
): string {
  const name = product.name.trim().toLowerCase().replace(/\s+/g, " ");
  const sku = product.sku.trim().toLowerCase();
  const barcode = product.barcode.trim().toLowerCase();
  for (const existing of existingProducts) {
    if (barcode && existing.barcode?.trim().toLowerCase() === barcode) return "Barcode already exists in inventory.";
    if (sku && existing.sku?.trim().toLowerCase() === sku) return "SKU already exists in inventory.";
    if (name && existing.name.trim().toLowerCase().replace(/\s+/g, " ") === name) return "Product name already exists in inventory.";
  }
  return "";
}

export function validateImportedProduct(product: ImportedProduct): string[] {
  const errors: string[] = [];
  if (!product.name.trim()) errors.push("Product name is required.");
  if (product.quantity === null || !Number.isFinite(product.quantity) || product.quantity < 0) errors.push("Quantity must be a non-negative number.");
  if (product.sellingPrice === null || !Number.isFinite(product.sellingPrice) || product.sellingPrice < 0) errors.push("Selling price is required and must be a non-negative number.");
  if (product.purchasePrice === null || !Number.isFinite(product.purchasePrice) || product.purchasePrice < 0) errors.push("Purchase price is required and must be a non-negative number.");
  if (product.gstRate !== null && (!Number.isFinite(product.gstRate) || product.gstRate < 0 || product.gstRate > 100)) errors.push("GST rate must be between 0 and 100.");
  return errors;
}
