import { describe, expect, it } from 'vitest';
import type { Order } from '../../types';
import { buildMarketplaceInvoice, getMarketplaceInvoiceBlockReason } from './marketplaceInvoice';

const order = {
  id: 'order_1',
  orderNumber: 'BPL-1001',
  customerId: 'customer_uid',
  customerName: 'Customer',
  customerPhone: '9000000000',
  shopId: 'shop_a',
  shopName: 'Shop A',
  shopAddress: 'Address',
  shopPhone: '9000000001',
  deliveryAddress: { userId: 'customer_uid' },
  items: [],
  itemCount: 0,
  subtotal: 10000,
  deliveryCharge: 0,
  gstTotal: 500,
  platformCommission: 500,
  totalAmount: 10000,
  status: 'accepted',
  paymentMethod: 'cash_on_delivery',
  paymentStatus: 'pending',
  statusHistory: [],
  delivery: { orderId: 'order_1', shopId: 'shop_a', deliveryAgentName: 'Staff', deliveryAgentPhone: '', assignedAt: '', otpCode: '', otpVerified: false },
  estimatedDeliveryTime: '',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
} as Order;

describe('marketplace invoice creation', () => {
  it('uses the verified regular GSTIN and stable order-based invoice number', () => {
    const result = buildMarketplaceInvoice(order, {
      status: 'regular',
      verified: true,
      gstin: '27AAPFU0939F1ZV',
    }, '2026-01-01T00:00:00.000Z');
    expect(result.reference.documentType).toBe('tax');
    expect(result.reference.invoiceNumber).toBe('MP-order_1');
    expect(result.reference.gstTotal).toBe(500);
    expect(result.document.orderId).toBe(order.id);
    expect(result.document.customerId).toBe(order.customerId);
  });

  it('uses a Bill of Supply for verified composition status without separate tax', () => {
    const result = buildMarketplaceInvoice(order, {
      status: 'composition',
      verified: true,
      gstin: '27AAPFU0939F1ZV',
    }, '2026-01-01T00:00:00.000Z');
    expect(result.reference.documentType).toBe('bill_of_supply');
    expect(result.reference.gstTotal).toBe(0);
    expect(result.reference.supplierGstin).toBeUndefined();
  });

  it('uses a non-GST receipt if registration is missing or unverified', () => {
    for (const registration of [
      null,
      { status: 'regular', verified: false, gstin: '27AAPFU0939F1ZV' },
    ]) {
      const result = buildMarketplaceInvoice(order, registration, '2026-01-01T00:00:00.000Z');
      expect(result.reference.documentType).toBe('regular');
      expect(result.reference.gstTotal).toBe(0);
      expect(result.reference.supplierGstin).toBeUndefined();
    }
  });

  it('blocks issuance when a verified regular GSTIN is malformed or a zero-rate line is unclassified', () => {
    expect(getMarketplaceInvoiceBlockReason(order, {
      status: 'regular',
      verified: true,
      gstin: 'invalid',
    })).toContain('valid-format GSTIN');
    expect(() => buildMarketplaceInvoice(order, {
      status: 'regular',
      verified: true,
      gstin: 'invalid',
    }, '2026-01-01T00:00:00.000Z')).toThrow();

    const zeroRateOrder = {
      ...order,
      items: [{ id: 'item_1', productId: 'product_1', productName: 'Exempt item', unit: 'ea', quantity: 1, unitPrice: 100, subtotal: 100, gstRate: 0, gstAmount: 0 }],
    } as Order;
    expect(getMarketplaceInvoiceBlockReason(zeroRateOrder, {
      status: 'regular',
      verified: true,
      gstin: '27AAPFU0939F1ZV',
    })).toContain('classification is not recorded');
  });

  it('reuses a deterministic invoice document identity on retries', () => {
    const first = buildMarketplaceInvoice(order, null, '2026-01-01T00:00:00.000Z');
    const retried = buildMarketplaceInvoice(order, null, '2026-01-02T00:00:00.000Z');
    expect(first.reference.id).toBe(retried.reference.id);
    expect(first.reference.invoiceNumber).toBe(retried.reference.invoiceNumber);
  });
});
