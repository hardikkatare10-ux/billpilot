import { useMemo, useState } from "react";
import { AlertCircle, Check, ChevronDown, FileSpreadsheet, Loader2, Upload, X } from "lucide-react";
import type {
  ColumnMapping,
  ImportSheet,
  ImportWorkbook,
  ImportedProduct,
  InventoryField,
  NormalizedImportRow,
} from "./inventoryImportParser";

interface ExistingProduct {
  name: string;
  sku: string;
  barcode: string;
}

interface InventoryImportProps {
  products: ExistingProduct[];
  onImport: (products: ImportedProduct[]) => void;
  onClose: () => void;
}

const inputClass = "w-full min-w-24 rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

export function InventoryImport({ products, onImport, onClose }: InventoryImportProps) {
  const [workbook, setWorkbook] = useState<ImportWorkbook | null>(null);
  const [parserModule, setParserModule] = useState<typeof import("./inventoryImportParser") | null>(null);
  const [selectedSheetName, setSelectedSheetName] = useState("");
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [rows, setRows] = useState<NormalizedImportRow[]>([]);
  const [totalSourceRows, setTotalSourceRows] = useState(0);
  const [excludedTotals, setExcludedTotals] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [completed, setCompleted] = useState(false);
  const [importReport, setImportReport] = useState<{ imported: number; skipped: number; failed: number } | null>(null);

  const sheet = workbook?.sheets.find((candidate) => candidate.name === selectedSheetName) || null;
  const detectedNameColumn = sheet
    ? Object.values(mapping).includes("name")
    : false;
  const validate = (product: ImportedProduct) => parserModule?.validateImportedProduct(product) || [];
  const validCount = rows.filter((row) => !validate(row.product).length && (!row.duplicateReason || row.includeDuplicate)).length;
  const duplicateCount = rows.filter((row) => row.duplicateReason).length;
  const invalidCount = rows.filter((row) => validate(row.product).length > 0).length;
  const unresolvedAmbiguous = sheet
    ? sheet.headerLabels.filter((header, index) => parserModule?.columnDetectionStatus(header, mapping, index).startsWith("Ambiguous")).length
    : 0;
  const manualMappingRows = rows.filter((row) =>
    validate(row.product).length > 0 || Boolean(row.duplicateReason) || unresolvedAmbiguous > 0
  ).length;
  const unmappedColumnCount = sheet
    ? sheet.headerLabels.filter((header, index) =>
      Boolean(header.trim()) && !mapping[index]
    ).length
    : 0;

  const normalizedRows = useMemo(() => rows.map((row) => ({
    ...row,
    errors: validate(row.product),
  })), [rows, parserModule]);

  const buildPreview = (
    activeSheet: ImportSheet,
    nextMapping: ColumnMapping,
    parser = parserModule
  ) => {
    if (!parser) return;
    const result = parser.normalizeImportRows(activeSheet, nextMapping, products);
    setRows(result.rows);
    setTotalSourceRows(result.totalSourceRows);
    setExcludedTotals(result.excludedTotals);
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    setError("");
    setLoading(true);
    setWorkbook(null);
    setCompleted(false);
    setImportReport(null);
    setRows([]);
    setFileName(file.name);
    try {
      const parser = await import("./inventoryImportParser");
      const result = await parser.readInventoryWorkbook(file);
      const initialSheet = result.sheets.find((candidate) => candidate.name === result.selectedSheetName) || result.sheets[0];
      const initialMapping = parser.suggestColumnMapping(initialSheet.headerLabels);
      setParserModule(parser);
      setWorkbook(result);
      setSelectedSheetName(initialSheet.name);
      setMapping(initialMapping);
      buildPreview(initialSheet, initialMapping, parser);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not parse this inventory file.");
    } finally {
      setLoading(false);
    }
  };

  const changeSheet = (name: string) => {
    const nextSheet = workbook?.sheets.find((candidate) => candidate.name === name);
    if (!nextSheet || !parserModule) return;
    const nextMapping = parserModule.suggestColumnMapping(nextSheet.headerLabels);
    setSelectedSheetName(name);
    setMapping(nextMapping);
    buildPreview(nextSheet, nextMapping, parserModule);
  };

  const changeMapping = (columnIndex: number, value: string) => {
    if (!sheet || !parserModule) return;
    const nextMapping = { ...mapping };
    const selectedField = value === "ignore" ? "ignore" : (value as InventoryField | "");
    if (selectedField && selectedField !== "ignore") {
      Object.entries(nextMapping).forEach(([index, field]) => {
        if (field === selectedField && Number(index) !== columnIndex) nextMapping[Number(index)] = null;
      });
    }
    nextMapping[columnIndex] = selectedField || null;
    setMapping(nextMapping);
    buildPreview(sheet, nextMapping, parserModule);
  };

  const updateProduct = (rowNumber: number, key: keyof ImportedProduct, value: string) => {
    setRows((current) => {
      const updatedRows = current.map((row) => {
        if (row.rowNumber !== rowNumber) return row;
        let parsedValue: string | number | null = value;
        if (["quantity", "purchasePrice", "sellingPrice", "gstRate"].includes(key)) {
          parsedValue = value.trim() ? Number(value) : null;
        }
        return { ...row, product: { ...row.product, [key]: parsedValue } };
      });
      return parserModule ? parserModule.refreshDuplicateCandidates(updatedRows, products) : updatedRows;
    });
  };

  const toggleDuplicate = (rowNumber: number, includeDuplicate: boolean) => {
    setRows((current) => current.map((row) => row.rowNumber === rowNumber ? { ...row, includeDuplicate } : row));
  };

  const handleImport = () => {
    const importable = normalizedRows
      .filter((row) => !row.errors.length && (!row.duplicateReason || row.includeDuplicate))
      .map((row) => row.product);
    if (!importable.length || unresolvedAmbiguous > 0 || completed) return;
    try {
      onImport(importable);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The products could not be saved. Please retry.");
      return;
    }
    setImportReport({
      imported: importable.length,
      skipped: rows.length - importable.length - invalidCount,
      failed: invalidCount,
    });
    setCompleted(true);
  };

  const onDrop: React.DragEventHandler<HTMLLabelElement> = (event) => {
    event.preventDefault();
    void handleFile(event.dataTransfer.files[0]);
  };

  return (
    <section className="space-y-4 rounded-xl border border-primary/20 bg-card p-4 shadow-sm sm:p-5" aria-label="Import inventory">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-semibold text-foreground">
            <FileSpreadsheet className="h-5 w-5 text-primary" /> Import products from Excel or CSV
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">Imports into this Dukan Yantra account’s local inventory only. Marketplace listings are not changed.</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted" aria-label="Close import">
          <X className="h-4 w-4" />
        </button>
      </header>

      {!workbook && (
        <label
          onDragOver={(event) => event.preventDefault()}
          onDrop={onDrop}
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-4 py-8 text-center hover:border-primary/50"
        >
          {loading ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <Upload className="h-6 w-6 text-muted-foreground" />}
          <span className="text-sm font-medium">{loading ? "Reading file contents…" : "Choose an .xlsx or .csv file"}</span>
          <span className="text-xs text-muted-foreground">Maximum 15 MB. Files are parsed in your browser; the filename alone is never used as data.</span>
          <input
            type="file"
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            className="sr-only"
            disabled={loading}
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
        </label>
      )}

      {error && <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}

      {workbook && sheet && (
        <>
          {importReport && (
            <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              Import complete: {importReport.imported} imported, 0 updated, {importReport.skipped} skipped, {importReport.failed} failed. Existing stock was not overwritten.
            </p>
          )}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-56">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Worksheet · {fileName}</label>
              <div className="relative">
                <select value={selectedSheetName} onChange={(event) => changeSheet(event.target.value)} className={`${inputClass} appearance-none pr-8`}>
                  {workbook.sheets.map((candidate) => <option key={candidate.name} value={candidate.name}>{candidate.name} · header row {candidate.headerRowIndex + 1}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-2 h-4 w-4 text-muted-foreground" />
              </div>
            </div>
            <label className="cursor-pointer text-xs font-medium text-primary hover:underline">
              Choose another file
              <input type="file" accept=".xlsx,.csv" className="sr-only" onChange={(event) => void handleFile(event.target.files?.[0])} />
            </label>
          </div>

          <div className="space-y-3">
            <div>
              <h4 className="text-sm font-semibold">Review source columns</h4>
              <p className="text-xs text-muted-foreground">
                Header row {sheet.headerRowIndex + 1} was detected from the worksheet contents. Correct uncertain or missing mappings before import.
              </p>
            </div>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr><th className="px-3 py-2">Original source header</th><th className="px-3 py-2">Sample values</th><th className="px-3 py-2">Detection status</th><th className="px-3 py-2">Dukan Yantra field</th></tr>
                </thead>
                <tbody>
                  {sheet.headerLabels.map((header, index) => (
                    <tr key={`${header}-${index}`} className="border-t border-border/60">
                      <td className="px-3 py-2 font-medium">{header || <span className="italic text-muted-foreground">(blank)</span>}</td>
                      <td className="max-w-60 truncate px-3 py-2 text-muted-foreground">{parserModule?.sampleColumnValues(sheet, index).join(" · ") || "—"}</td>
                      <td className={`px-3 py-2 ${(parserModule?.columnDetectionStatus(header, mapping, index) || "").startsWith("Detected") ? "text-emerald-700" : "text-amber-700"}`}>
                        {parserModule?.columnDetectionStatus(header, mapping, index)}
                      </td>
                      <td className="px-3 py-2">
                        <select
                          aria-label={`Map ${header || `column ${index + 1}`}`}
                          value={mapping[index] || ""}
                          onChange={(event) => changeMapping(index, event.target.value)}
                          className={inputClass}
                        >
                          <option value="">Choose field…</option>
                          {parserModule?.IMPORT_FIELDS.map((field) => <option key={field.value} value={field.value}>{field.label}</option>)}
                          <option value="lineAmount" disabled>Line amount (not a unit price)</option>
                          <option value="ignore">Ignore column</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!detectedNameColumn && <p className="text-xs font-medium text-amber-700">Map a source column to Product name to detect product rows.</p>}
            {unresolvedAmbiguous > 0 && <p className="text-xs font-medium text-amber-700">Resolve {unresolvedAmbiguous} ambiguous column(s) by mapping each one or explicitly choosing “Ignore column”.</p>}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-7">
            <Count label="Source rows" value={totalSourceRows} />
            <Count label="Product rows detected" value={rows.length} />
            <Count label="Valid rows" value={validCount} />
            <Count label="Invalid rows" value={invalidCount} />
            <Count label="Rows requiring manual mapping/review" value={manualMappingRows} />
            <Count label="Duplicate candidates" value={duplicateCount} />
            <Count label="Unmapped columns" value={unmappedColumnCount} />
          </div>
          {excludedTotals > 0 && <p className="text-xs text-muted-foreground">{excludedTotals} clearly labeled total/subtotal row(s) excluded.</p>}
          {rows.length === 0 && <p className="text-sm text-amber-700">No product rows found after the detected header.</p>}

          {rows.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[1300px] text-left text-xs">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2">Source row</th><th className="px-2 py-2">Product name *</th><th className="px-2 py-2">SKU</th><th className="px-2 py-2">Barcode</th>
                    <th className="px-2 py-2">Quantity *</th><th className="px-2 py-2">Unit</th><th className="px-2 py-2">Purchase price *</th>
                    <th className="px-2 py-2">Selling price *</th><th className="px-2 py-2">GST %</th><th className="px-2 py-2">Category</th><th className="px-2 py-2">Validation</th>
                  </tr>
                </thead>
                <tbody>
                  {normalizedRows.map((row) => (
                    <tr key={row.rowNumber} className={`border-t border-border/60 align-top ${row.errors.length || row.duplicateReason ? "bg-amber-50/50" : ""}`}>
                      <td className="px-2 py-2">{row.rowNumber}</td>
                      <td className="px-2 py-2"><CellInput value={row.product.name} onChange={(value) => updateProduct(row.rowNumber, "name", value)} /></td>
                      <td className="px-2 py-2"><CellInput value={row.product.sku} onChange={(value) => updateProduct(row.rowNumber, "sku", value)} /></td>
                      <td className="px-2 py-2"><CellInput value={row.product.barcode} onChange={(value) => updateProduct(row.rowNumber, "barcode", value)} /></td>
                      <td className="px-2 py-2"><CellInput numeric value={row.product.quantity} onChange={(value) => updateProduct(row.rowNumber, "quantity", value)} /></td>
                      <td className="px-2 py-2"><CellInput value={row.product.unit} onChange={(value) => updateProduct(row.rowNumber, "unit", value)} /></td>
                      <td className="px-2 py-2"><CellInput numeric value={row.product.purchasePrice} onChange={(value) => updateProduct(row.rowNumber, "purchasePrice", value)} /></td>
                      <td className="px-2 py-2"><CellInput numeric value={row.product.sellingPrice} onChange={(value) => updateProduct(row.rowNumber, "sellingPrice", value)} /></td>
                      <td className="px-2 py-2"><CellInput numeric value={row.product.gstRate} onChange={(value) => updateProduct(row.rowNumber, "gstRate", value)} /></td>
                      <td className="px-2 py-2"><CellInput value={row.product.category} onChange={(value) => updateProduct(row.rowNumber, "category", value)} /></td>
                      <td className="max-w-64 px-2 py-2">
                        {row.errors.map((message) => <p key={message} className="text-red-700">{message}</p>)}
                        {row.duplicateReason && (
                          <label className="mt-1 flex items-start gap-1 text-amber-800">
                            <input type="checkbox" checked={row.includeDuplicate} onChange={(event) => toggleDuplicate(row.rowNumber, event.target.checked)} />
                            <span>{row.duplicateReason} Import anyway</span>
                          </label>
                        )}
                        {!row.errors.length && !row.duplicateReason && <span className="inline-flex items-center gap-1 text-emerald-700"><Check className="h-3 w-3" />Valid</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
            <p className="max-w-2xl text-xs text-muted-foreground">
              Existing products and duplicates are skipped unless explicitly selected above. Import never adds to existing stock or updates a marketplace listing. Required purchase and selling prices must be present or entered; no price is generated.
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="rounded-lg border border-border px-3 py-2 text-sm">Cancel</button>
              <button
                type="button"
                onClick={handleImport}
                disabled={!validCount || unresolvedAmbiguous > 0 || completed}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Check className="h-4 w-4" /> Import {validCount} product{validCount === 1 ? "" : "s"}
              </button>
            </div>
          </footer>
        </>
      )}
    </section>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border border-border bg-background p-2"><div className="font-semibold">{value}</div><div className="text-muted-foreground">{label}</div></div>;
}

function CellInput({ value, onChange, numeric = false }: { value: string | number | null; onChange: (value: string) => void; numeric?: boolean }) {
  return (
    <input
      type={numeric ? "number" : "text"}
      step="any"
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value)}
      className={inputClass}
    />
  );
}
