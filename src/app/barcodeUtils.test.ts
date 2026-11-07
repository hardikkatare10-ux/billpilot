import { describe, expect, it } from 'vitest';
import {
  A4_40_LABEL_DIMENSIONS,
  A4_LAYOUT_PRESETS,
  buildA4LayoutConfig,
  detectBarcodeFormat,
  isValidBarcodeValue,
  sanitizeBarcodeValue,
} from './barcodeUtils';

describe('barcode utilities', () => {
  it('sanitizes common barcode prefixes and whitespace', () => {
    expect(sanitizeBarcodeValue('barcode: 8901234567890')).toBe('8901234567890');
    expect(sanitizeBarcodeValue('sku 12345')).toBe('12345');
  });

  it('detects valid barcode formats for EAN and Code128 inputs', () => {
    expect(detectBarcodeFormat('8901234567890')).toBe('EAN13');
    expect(detectBarcodeFormat('12345678')).toBe('EAN8');
    expect(detectBarcodeFormat('ABC123')).toBe('CODE128');
  });

  it('validates EAN checksums and printable Code128 characters', () => {
    expect(isValidBarcodeValue('8901234567890')).toBe(true);
    expect(isValidBarcodeValue('12345678')).toBe(true);
    expect(isValidBarcodeValue('ABC123')).toBe(true);
    expect(isValidBarcodeValue('abc$')).toBe(true);
    expect(isValidBarcodeValue('A!B#')).toBe(true);
    expect(isValidBarcodeValue('1234567')).toBe(true);
    expect(isValidBarcodeValue('TEST\u0001CODE')).toBe(false);
  });

  it('exposes the required A4 label layout presets', () => {
    expect(A4_LAYOUT_PRESETS['40'].columns).toBe(4);
    expect(A4_LAYOUT_PRESETS['40'].rows).toBe(10);
    expect(A4_LAYOUT_PRESETS['40'].labelCount).toBe(40);
    expect(A4_40_LABEL_DIMENSIONS.labelWidthMm * A4_40_LABEL_DIMENSIONS.columns).toBe(210);
    expect(A4_40_LABEL_DIMENSIONS.labelHeightMm * A4_40_LABEL_DIMENSIONS.rows).toBe(297);
    expect(A4_40_LABEL_DIMENSIONS.gapMm).toBe(0);
    expect(A4_LAYOUT_PRESETS['48'].columns).toBe(8);
    expect(A4_LAYOUT_PRESETS['30'].rows).toBe(6);
    expect(A4_LAYOUT_PRESETS['24'].labelCount).toBe(24);
    expect(A4_LAYOUT_PRESETS['4'].labelCount).toBe(4);
  });

  it('builds custom A4 layouts safely', () => {
    expect(buildA4LayoutConfig('custom', 3, 4)).toEqual({
      columns: 3,
      rows: 4,
      labelCount: 12,
      description: 'Custom 3×4',
    });
  });
});
