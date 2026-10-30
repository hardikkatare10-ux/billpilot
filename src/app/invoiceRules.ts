export type GstRegistrationStatus =
  | 'unregistered'
  | 'regular'
  | 'composition'
  | 'pending_verification'
  | 'suspended';

export type InvoiceKind = 'tax' | 'regular' | 'bill_of_supply';

export interface VerifiedGstRegistration {
  status: GstRegistrationStatus;
  verified: boolean;
  gstin?: string;
}

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export function isValidGstin(value: unknown): value is string {
  return typeof value === 'string' && GSTIN_PATTERN.test(value.trim().toUpperCase());
}

export function getAllowedInvoiceTypes(registration: VerifiedGstRegistration | null): InvoiceKind[] {
  if (!registration || !registration.verified) return ['regular'];
  switch (registration.status) {
    case 'regular':
      return isValidGstin(registration.gstin) ? ['tax', 'regular'] : ['regular'];
    case 'composition':
      return ['bill_of_supply'];
    case 'unregistered':
    case 'pending_verification':
    case 'suspended':
      return ['regular'];
    default:
      return ['regular'];
  }
}

export function assertInvoiceTypeAllowed(
  registration: VerifiedGstRegistration | null,
  invoiceKind: InvoiceKind
): void {
  if (!getAllowedInvoiceTypes(registration).includes(invoiceKind)) {
    throw new Error('This invoice type is not permitted for the shop’s verified GST registration status.');
  }
}

export function getInvoiceDocumentLabel(
  kind: InvoiceKind,
  registration: VerifiedGstRegistration | null = null
): string {
  switch (kind) {
    case 'tax': return 'GST Tax Invoice';
    case 'bill_of_supply': return 'Bill of Supply';
    default:
      return registration?.status === 'regular' &&
        registration.verified &&
        isValidGstin(registration.gstin)
        ? 'Commercial Receipt / Other permitted document'
        : 'Non-GST Bill / Receipt';
  }
}
