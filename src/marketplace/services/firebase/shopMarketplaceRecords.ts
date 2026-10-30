import { collection, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../../lib/firebase';

export interface MarketplaceInvoiceDocument {
  id: string;
  orderId: string;
  invoiceNumber: string;
  documentType: 'tax' | 'regular' | 'bill_of_supply';
  supplierGstin?: string;
  registrationGstinSnapshot?: string;
  gstRegistrationStatus?: string;
  shopId: string;
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  customerAddress?: Record<string, unknown>;
  items: {
    id: string;
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    gstRate: number;
    gstAmount: number;
    unit: string;
  }[];
  subtotal: number;
  deliveryCharge: number;
  gstTotal: number;
  grandTotal: number;
  platformFee: number;
  issuedAt: string;
  paymentMethod: string;
  paymentStatus: string;
}

export interface MarketplaceCustomerRecord {
  customerId: string;
  name?: string;
  phone?: string;
  email?: string;
  firstOrderAt: string;
  lastOrderAt: string;
  lastOrderId: string;
}

export function subscribeToShopMarketplaceRecords(
  shopId: string,
  handlers: {
    onInvoices: (records: MarketplaceInvoiceDocument[]) => void;
    onCustomers: (records: MarketplaceCustomerRecord[]) => void;
    onError: (error: Error) => void;
  }
): Unsubscribe {
  if (!isFirebaseConfigured || !shopId) return () => {};
  const emitError = (value: Error) => handlers.onError(value);
  const invoiceUnsubscribe = onSnapshot(
    collection(db, 'shops', shopId, 'marketplaceInvoices'),
    (snapshot) => {
      const records = snapshot.docs.map((item) => ({
        ...(item.data() as Omit<MarketplaceInvoiceDocument, 'id'>),
        id: item.id,
      }));
      handlers.onInvoices(records);
    },
    emitError
  );
  const customerUnsubscribe = onSnapshot(
    collection(db, 'shops', shopId, 'marketplaceCustomers'),
    (snapshot) => {
      const records = snapshot.docs.map((item) => ({
        ...(item.data() as Omit<MarketplaceCustomerRecord, 'customerId'>),
        customerId: item.id,
      }));
      handlers.onCustomers(records);
    },
    emitError
  );
  return () => {
    invoiceUnsubscribe();
    customerUnsubscribe();
  };
}
