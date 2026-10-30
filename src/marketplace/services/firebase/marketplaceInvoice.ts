import { isValidGstin } from '../../../app/invoiceRules';
import type { InvoiceReference, Order } from '../../types';

export interface ShopGstSnapshot {
  status?: unknown;
  verified?: unknown;
  gstin?: unknown;
}

export function getMarketplaceInvoiceBlockReason(
  order: Order,
  registration: ShopGstSnapshot | null
): string | null {
  if (registration?.status === 'regular' && registration.verified === true) {
    if (!isValidGstin(registration.gstin)) {
      return 'The verified regular GST registration has no valid-format GSTIN. Ask an administrator to review the shop registration.';
    }
    if (order.items.some((item) => item.gstRate === 0)) {
      return 'A product has a zero GST rate, but its exempt/nil-rated/zero-rated classification is not recorded. Resolve the tax classification before issuing an invoice.';
    }
  }
  return null;
}

export function buildMarketplaceInvoice(
  order: Order,
  registration: ShopGstSnapshot | null,
  issuedAt: string
): { reference: InvoiceReference; document: Record<string, unknown> } {
  const blockReason = getMarketplaceInvoiceBlockReason(order, registration);
  if (blockReason) throw new Error(blockReason);
  const status = registration?.status;
  const verified = registration?.verified === true;
  const validRegular = verified && status === 'regular' && isValidGstin(registration?.gstin);
  const documentType: NonNullable<InvoiceReference['documentType']> = validRegular
    ? 'tax'
    : status === 'composition' && verified
      ? 'bill_of_supply'
      : 'regular';
  const registrationStatus: NonNullable<InvoiceReference['gstRegistrationStatus']> =
    ['regular', 'composition', 'unregistered', 'pending_verification', 'suspended'].includes(String(status))
      ? status as NonNullable<InvoiceReference['gstRegistrationStatus']>
      : 'pending_verification';
  const reference: InvoiceReference = {
    id: order.id,
    orderId: order.id,
    invoiceNumber: `MP-${order.id}`,
    documentType,
    ...(validRegular ? { supplierGstin: String(registration?.gstin).trim().toUpperCase() } : {}),
    ...(verified && status === 'regular' && isValidGstin(registration?.gstin)
      ? { registrationGstinSnapshot: String(registration?.gstin).trim().toUpperCase() }
      : {}),
    gstRegistrationStatus: registrationStatus,
    customerId: order.customerId,
    customerEmail: order.customerEmail,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    subtotal: order.subtotal,
    deliveryCharge: order.deliveryCharge,
    gstTotal: documentType === 'tax' ? order.gstTotal : 0,
    grandTotal: order.totalAmount,
    platformFee: order.platformCommission,
    issuedAt,
  };
  return {
    reference,
    document: {
      ...reference,
      shopId: order.shopId,
      shopName: order.shopName,
      shopAddress: order.shopAddress,
      shopPhone: order.shopPhone,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      customerAddress: order.deliveryAddress,
      items: order.items,
    },
  };
}
