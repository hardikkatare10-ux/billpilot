import { describe, expect, it } from 'vitest';
import {
  assertInvoiceTypeAllowed,
  getAllowedInvoiceTypes,
  getInvoiceDocumentLabel,
  isValidGstin,
  type VerifiedGstRegistration,
} from './invoiceRules';

const regular: VerifiedGstRegistration = {
  status: 'regular',
  verified: true,
  gstin: '27AAPFU0939F1ZV',
};

describe('registration-aware invoice rules', () => {
  it('offers only a non-GST receipt when registration is missing or unverified', () => {
    expect(getAllowedInvoiceTypes(null)).toEqual(['regular']);
    expect(getAllowedInvoiceTypes({ ...regular, verified: false })).toEqual(['regular']);
    expect(() => assertInvoiceTypeAllowed(null, 'tax')).toThrow();
  });

  it('allows a GST tax invoice only for an admin-verified regular GSTIN', () => {
    expect(isValidGstin(regular.gstin)).toBe(true);
    expect(getAllowedInvoiceTypes(regular)).toEqual(['tax', 'regular']);
    expect(() => assertInvoiceTypeAllowed(regular, 'tax')).not.toThrow();
    expect(getAllowedInvoiceTypes({ ...regular, gstin: 'NOT-A-GSTIN' })).toEqual(['regular']);
  });

  it('allows only a Bill of Supply for verified composition registration', () => {
    const composition = { ...regular, status: 'composition' as const };
    expect(getAllowedInvoiceTypes(composition)).toEqual(['bill_of_supply']);
    expect(() => assertInvoiceTypeAllowed(composition, 'tax')).toThrow();
    expect(() => assertInvoiceTypeAllowed(composition, 'bill_of_supply')).not.toThrow();
  });

  it('does not enable GST invoices for verified unregistered or suspended shops', () => {
    expect(getAllowedInvoiceTypes({ status: 'unregistered', verified: true })).toEqual(['regular']);
    expect(getAllowedInvoiceTypes({ ...regular, status: 'suspended' })).toEqual(['regular']);
    expect(getAllowedInvoiceTypes({ ...regular, status: 'pending_verification' })).toEqual(['regular']);
  });

  it('uses unambiguous document labels', () => {
    expect(getInvoiceDocumentLabel('regular')).toBe('Non-GST Bill / Receipt');
    expect(getInvoiceDocumentLabel('regular', regular)).toBe('Commercial Receipt / Other permitted document');
    expect(getInvoiceDocumentLabel('tax')).toBe('GST Tax Invoice');
    expect(getInvoiceDocumentLabel('bill_of_supply')).toBe('Bill of Supply');
  });
});
