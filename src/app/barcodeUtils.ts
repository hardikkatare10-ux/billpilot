export type BarcodeFormat = 'EAN13' | 'EAN8' | 'CODE128';

export type A4LayoutPreset = '40' | '48' | '30' | '24' | '4';

export const A4_40_LABEL_DIMENSIONS = {
  paperWidthMm: 210,
  paperHeightMm: 297,
  columns: 4,
  rows: 10,
  labelCount: 40,
  labelWidthMm: 52.5,
  labelHeightMm: 29.7,
  gapMm: 0,
} as const;

export const A4_LAYOUT_PRESETS: Record<A4LayoutPreset, { columns: number; rows: number; description: string; labelsPerSheet: number; labelCount: number }> = {
  '40': { columns: A4_40_LABEL_DIMENSIONS.columns, rows: A4_40_LABEL_DIMENSIONS.rows, description: 'A4 40 labels (4×10)', labelsPerSheet: A4_40_LABEL_DIMENSIONS.labelCount, labelCount: A4_40_LABEL_DIMENSIONS.labelCount },
  '48': { columns: 8, rows: 6, description: '48 labels (8×6)', labelsPerSheet: 48, labelCount: 48 },
  '30': { columns: 5, rows: 6, description: '30 labels (5×6)', labelsPerSheet: 30, labelCount: 30 },
  '24': { columns: 4, rows: 6, description: '24 labels (4×6)', labelsPerSheet: 24, labelCount: 24 },
  '4': { columns: 2, rows: 2, description: '4 labels (2×2)', labelsPerSheet: 4, labelCount: 4 },
};

export function sanitizeBarcodeValue(value: string): string {
  const trimmed = value.trim();
  const withoutPrefix = trimmed.replace(/^(?:barcode|bar\s*code|sku|item|code|qr)\s*(?:[:#=-]|\s+)?\s*/i, '');
  return withoutPrefix.replace(/\s+/g, '').replace(/[\u200B-\u200D\uFEFF]/g, '');
}

export function detectBarcodeFormat(value: string): BarcodeFormat {
  const normalized = sanitizeBarcodeValue(value);
  if (!normalized) return 'CODE128';
  if (/^\d{8}$/.test(normalized)) return 'EAN8';
  if (/^\d{13}$/.test(normalized)) return 'EAN13';
  return 'CODE128';
}

function calculateEanCheckDigit(value: string): number {
  const digits = value.replace(/\D/g, '');
  const length = digits.length;
  if (length !== 7 && length !== 12) return NaN;

  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    const digit = Number(digits[i]);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  const remainder = sum % 10;
  return remainder === 0 ? 0 : 10 - remainder;
}

export function isValidEan(value: string): boolean {
  const normalized = sanitizeBarcodeValue(value).replace(/\D/g, '');
  if (normalized.length === 8 || normalized.length === 13) {
    const checkDigit = Number(normalized.at(-1) ?? '');
    if (Number.isNaN(checkDigit)) return false;
    const expected = calculateEanCheckDigit(normalized.slice(0, -1));
    return Number.isFinite(expected) && checkDigit === expected;
  }
  return false;
}

export function isValidCode128(value: string): boolean {
  const normalized = sanitizeBarcodeValue(value);
  if (!normalized) return false;
  return /^[\x20-\x7E]+$/.test(normalized) && normalized.length >= 2 && normalized.length <= 80;
}

export function isValidBarcodeValue(value: string, format?: BarcodeFormat): boolean {
  const resolvedFormat = format ?? detectBarcodeFormat(value);
  if (resolvedFormat === 'EAN13' || resolvedFormat === 'EAN8') {
    return isValidEan(value);
  }
  return isValidCode128(value);
}

export function buildA4LayoutConfig(
  preset: A4LayoutPreset | 'custom',
  customColumns = 4,
  customRows = 5,
): { columns: number; rows: number; labelCount: number; description: string; labelsPerSheet?: number } {
  if (preset === 'custom') {
    const columns = Math.max(1, Math.min(12, Number(customColumns) || 4));
    const rows = Math.max(1, Math.min(12, Number(customRows) || 5));
    return {
      columns,
      rows,
      labelCount: columns * rows,
      description: `Custom ${columns}×${rows}`,
    };
  }

  const base = A4_LAYOUT_PRESETS[preset];
  return {
    columns: base.columns,
    rows: base.rows,
    labelCount: base.labelCount,
    labelsPerSheet: base.labelsPerSheet,
    description: base.description,
  };
}
