/**
 * NearBasket - Core Type Definitions
 * 
 * Production schemas for users, shops, listings, orders, state machine,
 * BillPilot integration contracts, and audit trails.
 */

// All monetary amounts are in integer minor units (paise: 1 INR = 100 paise)
export type MinorUnits = number;

export type UserRole = 'customer' | 'shopkeeper' | 'admin';

export interface UserAddress {
  id: string;
  userId: string;
  label: string; // 'Home', 'Office', 'Other'
  recipientName: string;
  phoneNumber: string;
  streetAddress: string;
  locality: string;
  landmark?: string;
  city: string;
  pincode: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  mapsLink?: string; // Google Maps link to the customer's home pin
  isDefault: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  requestedRole?: 'consumer' | 'shopkeeper';
  shopkeeperStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  shopId?: string; // If role === 'shopkeeper'
  addresses: UserAddress[];
  createdAt: string;
}

export type ShopVerificationStatus = 'pending' | 'verified' | 'rejected' | 'suspended';

export interface ShopDeliverySettings {
  isDeliveryAvailable: boolean;
  serviceRadiusKm: number;
  baseDeliveryCharge: MinorUnits; // e.g. 3000 = ₹30.00
  freeDeliveryThreshold?: MinorUnits; // e.g. 50000 = ₹500.00
  minOrderValue: MinorUnits; // e.g. 10000 = ₹100.00
  estimatedPrepMinutes: number; // e.g. 20 mins
  estimatedDeliveryMinutes: number; // e.g. 25 mins
  maxConcurrentOrders: number;
  isAcceptingOrders: boolean;
  serviceableLocalities: string[];
  serviceableAreaIds?: string[];
  serviceablePincodes?: string[];
}

export interface ShopOperatingHours {
  openTime: string; // "08:00"
  closeTime: string; // "22:00"
  isOpenSunday: boolean;
}

export interface Shop {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  phone: string;
  email: string;
  category: string;
  description: string;
  imageUrl: string;
  rating: number;
  reviewCount: number;
  verificationStatus: ShopVerificationStatus;
  verificationDetails?: {
    gstin?: string;
    fssaiLicense?: string;
    tradeLicenseNo?: string;
    verifiedAt?: string;
    verifiedBy?: string;
    notes?: string;
  };
  address: {
    street: string;
    locality: string;
    city: string;
    pincode: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  operatingHours: ShopOperatingHours;
  deliverySettings: ShopDeliverySettings;
  externalBillPilotShopId?: string;
  createdAt: string;
}

export interface GlobalProduct {
  id: string;
  name: string;
  brand: string;
  category: string;
  unit: string; // '1 kg', '500 g', '1 pc', 'pack of 4'
  description: string;
  standardGSTRate: number; // 0, 5, 12, 18 (%)
  imageUrl: string;
  barcode?: string;
}

export interface ShopListing {
  id: string;
  shopId: string;
  productId: string;
  product: GlobalProduct;
  shopPrice: MinorUnits; // Current regular price in paise
  salePrice?: MinorUnits; // Optional discounted price
  stockQuantity: number;
  reservedStock: number; // Stock currently held in active checkout/orders
  isAvailable: boolean;
  isVisible: boolean;
  externalBillPilotItemId?: string;
  lastSyncedAt?: string;
  updatedAt?: string;
}

export interface FirestoreProduct {
  id: string;
  shopId: string;
  ownerId: string;
  name: string;
  brand: string;
  category: string;
  unit: string;
  description: string;
  imageUrl: string;
  shopPrice: MinorUnits;
  salePrice?: MinorUnits | null;
  stockQuantity: number;
  isAvailable: boolean;
  isVisible: boolean;
  standardGSTRate: number;
  externalBillPilotItemId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  listingId: string;
  shopId: string;
  productId: string;
  productName: string;
  unit: string;
  unitPrice: MinorUnits;
  quantity: number;
  imageUrl: string;
  isOutOfStock?: boolean;
  availableStock?: number;
}

export interface Cart {
  shopId: string | null;
  items: CartItem[];
}

// Explicit Legal Order State Machine
export type OrderStatus =
  | 'pending_confirmation'
  | 'accepted'
  | 'rejected'
  | 'preparing'
  | 'ready_for_dispatch'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancellation_requested'
  | 'cancelled'
  | 'return_requested'
  | 'return_approved'
  | 'return_rejected'
  | 'refund_pending'
  | 'refunded'
  | 'replacement_in_progress'
  | 'resolved';

export interface OrderStatusHistoryEntry {
  status: OrderStatus;
  timestamp: string;
  actorId: string;
  actorRole: UserRole | 'system';
  reason?: string;
  note?: string;
}

export interface OrderItemSnapshot {
  id: string;
  productId: string;
  productName: string;
  unit: string;
  quantity: number;
  unitPrice: MinorUnits;
  subtotal: MinorUnits;
  gstRate: number;
  gstAmount: MinorUnits;
  imageUrl: string;
}

export type PaymentMethod = 'cash_on_delivery' | 'online_upi_card';
export type PaymentStatus = 'pending' | 'authorized' | 'completed' | 'failed' | 'refunded';

export interface PaymentRecord {
  id: string;
  orderId: string;
  method: PaymentMethod;
  amount: MinorUnits;
  status: PaymentStatus;
  transactionRef?: string;
  collectedAt?: string;
  createdAt: string;
}

export interface DeliveryRecord {
  orderId: string;
  shopId: string;
  deliveryAgentName: string;
  deliveryAgentPhone: string;
  assignedAt: string;
  dispatchedAt?: string;
  deliveredAt?: string;
  otpCode: string; // 4-digit verification code
  otpVerified: boolean;
  notes?: string;
}

export interface InvoiceReference {
  id: string;
  orderId: string;
  invoiceNumber: string; // e.g. "INV-2026-00421"
  billPilotInvoiceId?: string;
  subtotal: MinorUnits;
  deliveryCharge: MinorUnits;
  gstTotal: MinorUnits;
  grandTotal: MinorUnits;
  platformFee: MinorUnits;
  issuedAt: string;
}

export interface Order {
  id: string;
  orderNumber: string; // e.g. "BPL-8834"
  customerId: string;
  customerName: string;
  customerPhone: string;
  shopId: string;
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  deliveryAddress: UserAddress;
  items: OrderItemSnapshot[];
  itemCount: number;
  subtotal: MinorUnits;
  deliveryCharge: MinorUnits;
  gstTotal: MinorUnits;
  platformCommission: MinorUnits; // Marketplace platform commission
  totalAmount: MinorUnits;
  status: OrderStatus;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  statusHistory: OrderStatusHistoryEntry[];
  delivery: DeliveryRecord;
  invoice?: InvoiceReference;
  externalBillPilotOrderId?: string;
  estimatedDeliveryTime: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReturnComplaintRequest {
  id: string;
  orderId: string;
  orderNumber: string;
  shopId: string;
  shopName: string;
  customerId: string;
  customerName: string;
  reason: 'damaged_product' | 'defective_product' | 'wrong_product' | 'missing_item' | 'expired_unsafe' | 'other';
  description: string;
  photoEvidenceUrls: string[];
  status: 'submitted' | 'under_review' | 'approved' | 'rejected' | 'refunded' | 'resolved';
  shopResponse?: string;
  adminDecision?: string;
  refundAmount?: MinorUnits;
  createdAt: string;
  resolvedAt?: string;
}

export interface ShopReview {
  id: string;
  orderId: string;
  shopId: string;
  customerId: string;
  customerName: string;
  rating: number; // 1-5
  comment: string;
  createdAt: string;
}

export interface CommissionLedgerEntry {
  id: string;
  orderId: string;
  shopId: string;
  shopName: string;
  orderTotal: MinorUnits;
  commissionRatePct: number; // e.g. 5%
  commissionAmount: MinorUnits;
  netShopEarnings: MinorUnits;
  payoutStatus: 'accrued' | 'settled' | 'reversed';
  settledAt?: string;
  createdAt: string;
}

// Dukan Yantra Integration Contract v1.0
export interface BillPilotConnectionConfig {
  apiUrl: string;
  apiKey: string;
  merchantId: string;
  webhookSecret: string;
  autoSyncInventory: boolean;
  autoExportOrders: boolean;
  isConnected: boolean;
  lastPingAt?: string;
}

export type BillPilotSyncDirection = 'inbound_to_marketplace' | 'outbound_to_billpilot';
export type BillPilotSyncType =
  | 'catalogue_sync'
  | 'inventory_update'
  | 'price_update'
  | 'order_export'
  | 'invoice_exchange'
  | 'cancellation_notify';

export interface BillPilotSyncEvent {
  id: string;
  shopId: string;
  direction: BillPilotSyncDirection;
  syncType: BillPilotSyncType;
  payloadSummary: string;
  externalReferenceId?: string;
  status: 'success' | 'failed' | 'retrying';
  attemptCount: number;
  errorMessage?: string;
  timestamp: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole | 'system';
  action: string;
  targetEntity: string;
  targetId: string;
  details: string;
  ipAddress?: string;
}

export interface InAppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'order' | 'sync' | 'support' | 'system';
  orderId?: string;
  read: boolean;
  createdAt: string;
}

// Hierarchical Area Directory Models
export type AreaLevel = 'city' | 'locality' | 'sub_locality';
export type AreaStatus = 'active' | 'inactive';

export interface AreaRecord {
  id: string;
  name: string; // e.g. "Indiranagar", "Koramangala"
  city: string; // e.g. "Bengaluru"
  state: string; // e.g. "Karnataka"
  country: string; // e.g. "India"
  pincode: string; // e.g. "560038"
  level: AreaLevel;
  parentAreaId?: string; // id of city or parent locality
  aliases: string[]; // e.g. ["Indira Nagar", "CMH Road", "100ft Road"]
  coordinates: {
    latitude: number;
    longitude: number;
  };
  status: AreaStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AreaRequest {
  id: string;
  city: string;
  localityName: string;
  pincode?: string;
  customerEmail?: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNotes?: string;
  createdAt: string;
}

export interface CustomerLocation {
  city: string;
  locality: string;
  subLocality?: string;
  district?: string;
  state?: string;
  pincode?: string;
  areaId?: string;
  placeId?: string;
  postOffice?: string;
  source?: 'google_places' | 'india_post' | 'manual' | 'gps' | 'directory';
  isPostalVerified?: boolean;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  formattedAddress: string;
}

export interface PostalRecord {
  name: string;
  branchType: string;
  deliveryStatus: string;
  circle: string;
  district: string;
  division?: string;
  region?: string;
  block?: string;
  state: string;
  country: string;
  pincode: string;
  latitude?: number;
  longitude?: number;
}
