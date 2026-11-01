import { collection, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../../lib/firebase';
import type { UserAddress } from '../../types';

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
  customerAccountId?: string;
  shopId?: string;
  shopkeeperId?: string;
  name?: string;
  phone?: string;
  email?: string;
  customerRegisteredAt?: string;
  source?: 'marketplace';
  firstOrderAt: string;
  lastOrderAt: string;
  lastOrderId: string;
  lastDeliveryAddress?: UserAddress;
  deliveryInstructions?: string;
  totalOrderCount?: number;
  completedPurchaseAmount?: number;
}

export function subscribeToShopMarketplaceRecords(
  shopId: string,
  handlers: {
    onInvoices: (records: MarketplaceInvoiceDocument[]) => void;
    onCustomers: (records: MarketplaceCustomerRecord[]) => void;
    onError: (collection: 'marketplaceInvoices' | 'marketplaceCustomers', error: Error) => void;
  }
): Unsubscribe {
  if (!isFirebaseConfigured || !shopId) return () => {};
  const invoiceUnsubscribe = onSnapshot(
    collection(db, 'shops', shopId, 'marketplaceInvoices'),
    (snapshot) => {
      const records = snapshot.docs.map((item) => ({
        ...(item.data() as Omit<MarketplaceInvoiceDocument, 'id'>),
        id: item.id,
      }));
      handlers.onInvoices(records);
    },
    (error) => handlers.onError('marketplaceInvoices', error)
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
    (error) => handlers.onError('marketplaceCustomers', error)
  );
  return () => {
    invoiceUnsubscribe();
    customerUnsubscribe();
  };
}
