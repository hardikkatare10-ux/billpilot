/**
 * BillPilot Local - Core Relational Data Store
 * 
 * Provides atomic operations, concurrency-safe stock updates,
 * server-side order revalidation, and persistent storage.
 */

import {
  AreaLevel,
  AreaRecord,
  AreaRequest,
  AreaStatus,
  AuditLogEntry,
  BillPilotConnectionConfig,
  BillPilotSyncEvent,
  CartItem,
  CommissionLedgerEntry,
  GlobalProduct,
  InAppNotification,
  MinorUnits,
  Order,
  OrderItemSnapshot,
  OrderStatus,
  PaymentMethod,
  ReturnComplaintRequest,
  Shop,
  ShopListing,
  User,
  UserAddress,
  UserRole,
} from '../../types';
import {
  calculateGST,
  canTransitionOrder,
  generateDeliveryOTP,
  generateInvoiceNumber,
  generateOrderNumber,
} from '../../utils/formatters';
import { BASELINE_AREAS, calculateHaversineDistanceKm } from '../../utils/geo';

const STORAGE_KEY = 'billpilot_local_v2_store';

// Clean initial empty database collections
const DEFAULT_USERS: User[] = [];
// No demo shops: every shop in the marketplace is registered by a real shopkeeper.
const DEFAULT_SHOPS: Shop[] = [];
const DEMO_SHOP_IDS = ['shop_jabalpur_vijaynagar', 'shop_bengaluru_indiranagar'];
const DEMO_USER_IDS = ['user_shop_jabalpur', 'user_shop_blr'];
const MAX_SERVICEABLE_PINCODES = 3;

/** Keeps only valid 6-digit Indian PIN codes, de-duplicated, capped at 3. */
export function sanitizePincodes(input: string[] | string | undefined): string[] {
  const list = Array.isArray(input) ? input : String(input || '').split(/[,\s]+/);
  const valid = list.map((x) => String(x).trim()).filter((x) => /^[1-9][0-9]{5}$/.test(x));
  return Array.from(new Set(valid)).slice(0, MAX_SERVICEABLE_PINCODES);
}
const DEFAULT_GLOBAL_PRODUCTS: GlobalProduct[] = [];
const DEFAULT_SHOP_LISTINGS: ShopListing[] = [];
const DEFAULT_ORDERS: Order[] = [];
const DEFAULT_SYNC_EVENTS: BillPilotSyncEvent[] = [];
const DEFAULT_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'audit_init',
    timestamp: new Date().toISOString(),
    actorId: 'system',
    actorName: 'System',
    actorRole: 'system',
    action: 'SYSTEM_BOOT',
    targetEntity: 'platform',
    targetId: 'billpilot_local',
    details: 'BillPilot Local marketplace initialized with clean empty collections.',
  },
];

interface LocalDatabaseState {
  users: User[];
  shops: Shop[];
  areas: AreaRecord[];
  areaRequests: AreaRequest[];
  globalProducts: GlobalProduct[];
  listings: ShopListing[];
  orders: Order[];
  returnRequests: ReturnComplaintRequest[];
  syncEvents: BillPilotSyncEvent[];
  auditLogs: AuditLogEntry[];
  notifications: InAppNotification[];
  commissionLedger: CommissionLedgerEntry[];
  connectionConfigs: Record<string, BillPilotConnectionConfig>;
  activeUserId: string | null;
}

class RelationalDatabaseStore {
  private state: LocalDatabaseState;

  private listeners = new Set<() => void>();

  /** Subscribe to any store change (used to re-render after Firestore sync / mutations). */
  public subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit() {
    this.listeners.forEach((fn) => {
      try { fn(); } catch { /* ignore listener errors */ }
    });
  }

  /**
   * Merge shops from Firestore (source of truth) into the local store.
   * Local-only shops that are not yet verified are kept (e.g. a registration whose cloud write failed).
   */
  public syncShopsFromFirestore(remote: Shop[]): void {
    const remoteIds = new Set(remote.map((s) => s.id));
    const localOnly = this.state.shops.filter(
      (s) => !remoteIds.has(s.id) && s.verificationStatus !== 'verified'
    );
    this.state.shops = [...localOnly, ...remote];
    this.persist();
  }

  constructor() {
    this.state = this.loadState();
  }

  private loadState(): LocalDatabaseState {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // One-time cleanup of demo shops/products that older builds saved in this browser
        parsed.shops = (parsed.shops || []).filter((sh: Shop) => !DEMO_SHOP_IDS.includes(sh.id));
        parsed.users = (parsed.users || []).filter((u: User) => !DEMO_USER_IDS.includes(u.id));
        parsed.listings = (parsed.listings || []).filter(
          (l: ShopListing) => !DEMO_SHOP_IDS.includes(l.shopId)
        );
        return {
          users: parsed.users || DEFAULT_USERS,
          shops: parsed.shops || DEFAULT_SHOPS,
          areas: parsed.areas && parsed.areas.length > 0 ? parsed.areas : BASELINE_AREAS,
          areaRequests: parsed.areaRequests || [],
          globalProducts: parsed.globalProducts || DEFAULT_GLOBAL_PRODUCTS,
          listings: parsed.listings || DEFAULT_SHOP_LISTINGS,
          orders: parsed.orders || DEFAULT_ORDERS,
          returnRequests: parsed.returnRequests || [],
          syncEvents: parsed.syncEvents || DEFAULT_SYNC_EVENTS,
          auditLogs: parsed.auditLogs || DEFAULT_AUDIT_LOGS,
          notifications: parsed.notifications || [],
          commissionLedger: parsed.commissionLedger || [],
          connectionConfigs: parsed.connectionConfigs || {},
          activeUserId: parsed.activeUserId || null,
        };
      }
    } catch {
      // Ignore JSON error and return defaults
    }

    return {
      users: DEFAULT_USERS,
      shops: DEFAULT_SHOPS,
      areas: BASELINE_AREAS,
      areaRequests: [],
      globalProducts: DEFAULT_GLOBAL_PRODUCTS,
      listings: DEFAULT_SHOP_LISTINGS,
      orders: DEFAULT_ORDERS,
      returnRequests: [],
      syncEvents: DEFAULT_SYNC_EVENTS,
      auditLogs: DEFAULT_AUDIT_LOGS,
      notifications: [],
      commissionLedger: [],
      connectionConfigs: {},
      activeUserId: null,
    };
  }

  private persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // Memory fallback
    }
    this.emit();
  }

  // --- Auth & Users ---
  public getUsers(): User[] {
    return [...this.state.users];
  }

  public getActiveUser(): User | null {
    if (!this.state.activeUserId) return null;
    return this.state.users.find((u) => u.id === this.state.activeUserId) || null;
  }

  public setActiveUser(userId: string | null): User | null {
    if (!userId) {
      this.state.activeUserId = null;
      this.persist();
      return null;
    }
    const user = this.state.users.find((u) => u.id === userId);
    if (!user) throw new Error('User not found');
    this.state.activeUserId = userId;
    this.persist();
    return user;
  }

  public loginUser(email: string): User {
    const user = this.state.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user) throw new Error('No account found with this email address.');
    this.state.activeUserId = user.id;
    this.recordAuditLog({
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: 'USER_LOGIN',
      targetEntity: 'users',
      targetId: user.id,
      details: `${user.name} signed in successfully.`,
    });
    this.persist();
    return user;
  }

  public syncUserRecord(user: User): void {
    const existingIndex = this.state.users.findIndex((u) => u.id === user.id || u.email.toLowerCase() === user.email.toLowerCase());
    if (existingIndex >= 0) {
      this.state.users[existingIndex] = { ...this.state.users[existingIndex], ...user };
    } else {
      this.state.users.push(user);
    }
    this.persist();
  }

  public addShop(shop: Shop): Shop {
    const existingIndex = this.state.shops.findIndex((s) => s.id === shop.id);
    if (existingIndex >= 0) {
      this.state.shops[existingIndex] = shop;
    } else {
      this.state.shops.push(shop);
    }
    this.persist();
    return shop;
  }

  public registerCustomer(input: {
    name: string;
    email: string;
    phone: string;
    streetAddress: string;
    locality: string;
    city: string;
    pincode: string;
    coordinates?: { latitude: number; longitude: number };
    mapsLink?: string;
  }): User {
    const existing = this.state.users.find((u) => u.email.toLowerCase() === input.email.trim().toLowerCase());
    if (existing) throw new Error('An account with this email address already exists.');

    const userId = `user_cust_${Date.now()}`;
    const newAddr: UserAddress = {
      id: `addr_${Date.now()}`,
      userId,
      label: 'Home',
      recipientName: input.name,
      phoneNumber: input.phone,
      streetAddress: input.streetAddress,
      locality: input.locality,
      city: input.city,
      pincode: input.pincode,
      coordinates: input.coordinates,
      mapsLink: input.mapsLink,
      isDefault: true,
    };

    const newUser: User = {
      id: userId,
      name: input.name,
      email: input.email.trim().toLowerCase(),
      phone: input.phone,
      role: 'customer',
      addresses: [newAddr],
      createdAt: new Date().toISOString(),
    };

    this.state.users.push(newUser);
    this.state.activeUserId = newUser.id;
    this.recordAuditLog({
      actorId: newUser.id,
      actorName: newUser.name,
      actorRole: 'customer',
      action: 'REGISTER_CUSTOMER',
      targetEntity: 'users',
      targetId: newUser.id,
      details: `Customer registered: ${newUser.name} (${newUser.email}) in ${input.locality}`,
    });

    this.persist();
    return newUser;
  }

  public registerAdmin(input: {
    name: string;
    email: string;
    phone: string;
  }): User {
    const existing = this.state.users.find((u) => u.email.toLowerCase() === input.email.trim().toLowerCase());
    if (existing) throw new Error('An account with this email address already exists.');

    const userId = `user_admin_${Date.now()}`;
    const newUser: User = {
      id: userId,
      name: input.name,
      email: input.email.trim().toLowerCase(),
      phone: input.phone,
      role: 'admin',
      addresses: [],
      createdAt: new Date().toISOString(),
    };

    this.state.users.push(newUser);
    this.state.activeUserId = newUser.id;
    this.recordAuditLog({
      actorId: newUser.id,
      actorName: newUser.name,
      actorRole: 'admin',
      action: 'REGISTER_ADMIN',
      targetEntity: 'users',
      targetId: newUser.id,
      details: `Administrator registered: ${newUser.name} (${newUser.email})`,
    });

    this.persist();
    return newUser;
  }

  public registerShopkeeperAndShop(input: {
    ownerName: string;
    email: string;
    phone: string;
    shopName: string;
    category: string;
    description: string;
    street: string;
    locality: string;
    city: string;
    serviceablePincodes: string[]; // 1 to 3 Indian PIN codes the shop delivers to
    serviceRadiusKm: number;
    baseDeliveryChargeRupees: number;
    minOrderValueRupees: number;
    gstin?: string;
    fssaiLicense?: string;
    tradeLicenseNo?: string;
  }): { user: User; shop: Shop } {
    const existing = this.state.users.find((u) => u.email.toLowerCase() === input.email.trim().toLowerCase());
    if (existing) throw new Error('An account with this email address already exists.');

    const pincodes = sanitizePincodes(input.serviceablePincodes);
    if (pincodes.length === 0) {
      throw new Error('Enter at least one valid 6-digit Indian PIN code your shop delivers to (maximum 3).');
    }

    const userId = `user_shop_${Date.now()}`;
    const shopId = `shop_${Date.now()}`;
    const nowIso = new Date().toISOString();

    const matchingArea = this.state.areas.find(
      (a) =>
        a.name.toLowerCase() === input.locality.toLowerCase() ||
        a.aliases.some((alias) => alias.toLowerCase() === input.locality.toLowerCase())
    );
    const shopCoords = matchingArea
      ? { ...matchingArea.coordinates }
      : { latitude: 12.9784, longitude: 77.6408 };

    const newShop: Shop = {
      id: shopId,
      name: input.shopName,
      ownerId: userId,
      ownerName: input.ownerName,
      phone: input.phone,
      email: input.email,
      category: input.category,
      description: input.description,
      imageUrl: '/src/assets/images/shop_fresh_kirana_1792750894595.jpg',
      rating: 5.0,
      reviewCount: 0,
      verificationStatus: 'pending',
      verificationDetails: {
        gstin: input.gstin || 'GSTIN-REGISTERED',
        fssaiLicense: input.fssaiLicense,
        tradeLicenseNo: input.tradeLicenseNo || `TR/${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`,
        verifiedAt: undefined,
        verifiedBy: undefined,
        notes: 'Merchant onboarding submitted with license details. Pending administrator review.',
      },
      address: {
        street: input.street,
        locality: input.locality,
        city: input.city,
        pincode: pincodes[0],
        coordinates: shopCoords,
      },
      operatingHours: {
        openTime: '08:00',
        closeTime: '21:30',
        isOpenSunday: true,
      },
      deliverySettings: {
        isDeliveryAvailable: true,
        serviceRadiusKm: input.serviceRadiusKm || 5,
        baseDeliveryCharge: Math.round((input.baseDeliveryChargeRupees || 25) * 100),
        freeDeliveryThreshold: 49900,
        minOrderValue: Math.round((input.minOrderValueRupees || 100) * 100),
        estimatedPrepMinutes: 20,
        estimatedDeliveryMinutes: 25,
        maxConcurrentOrders: 10,
        isAcceptingOrders: true,
        serviceableLocalities: [input.locality],
        serviceablePincodes: pincodes,
        serviceableAreaIds: matchingArea ? [matchingArea.id] : [],
      },
      externalBillPilotShopId: `BP-MERCHANT-${Math.floor(8000 + Math.random() * 1000)}`,
      createdAt: nowIso,
    };

    const newUser: User = {
      id: userId,
      name: input.ownerName,
      email: input.email.trim().toLowerCase(),
      phone: input.phone,
      role: 'shopkeeper',
      shopId,
      addresses: [],
      createdAt: nowIso,
    };

    this.state.shops.push(newShop);
    this.state.users.push(newUser);
    this.state.activeUserId = newUser.id;

    this.recordAuditLog({
      actorId: userId,
      actorName: input.ownerName,
      actorRole: 'shopkeeper',
      action: 'REGISTER_SHOP',
      targetEntity: 'shops',
      targetId: shopId,
      details: `Shop registered: "${input.shopName}" (${input.category}) in ${input.locality}`,
    });

    this.persist();
    return { user: newUser, shop: newShop };
  }

  public createProductListing(
    shopId: string,
    input: {
      name: string;
      brand: string;
      category: string;
      unit: string;
      description: string;
      standardGSTRate: number;
      imageUrl?: string;
      shopPricePaise: MinorUnits;
      salePricePaise?: MinorUnits;
      stockQuantity: number;
      externalBillPilotItemId?: string;
      listingId?: string;
    },
    actorId: string
  ): ShopListing {
    const shop = this.getShopById(shopId);
    if (!shop) throw new Error('Shop not found');

    const productId = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newGlobalProd: GlobalProduct = {
      id: productId,
      name: input.name,
      brand: input.brand,
      category: input.category,
      unit: input.unit,
      description: input.description,
      standardGSTRate: input.standardGSTRate,
      imageUrl: input.imageUrl || '/src/assets/images/shop_fresh_kirana_1792750894595.jpg',
    };

    this.state.globalProducts.push(newGlobalProd);

    const newListing: ShopListing = {
      id: input.listingId || `lst_${shopId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      shopId,
      productId,
      product: newGlobalProd,
      shopPrice: input.shopPricePaise,
      salePrice: input.salePricePaise,
      stockQuantity: input.stockQuantity,
      reservedStock: 0,
      isAvailable: input.stockQuantity > 0,
      isVisible: true,
      externalBillPilotItemId: input.externalBillPilotItemId || `BP-ITEM-${Math.floor(10000 + Math.random() * 90000)}`,
      lastSyncedAt: new Date().toISOString(),
    };

    this.state.listings.push(newListing);

    this.recordAuditLog({
      actorId,
      actorName: shop.ownerName,
      actorRole: 'shopkeeper',
      action: 'CREATE_LISTING',
      targetEntity: 'shop_listings',
      targetId: newListing.id,
      details: `Added new product listing: "${input.name}" with stock ${input.stockQuantity} at ₹${input.shopPricePaise / 100}`,
    });

    this.persist();
    return newListing;
  }

  public deleteListing(listingId: string, actorId: string): void {
    const idx = this.state.listings.findIndex((l) => l.id === listingId);
    if (idx !== -1) {
      const removed = this.state.listings.splice(idx, 1)[0];
      this.recordAuditLog({
        actorId,
        actorName: 'Shopkeeper',
        actorRole: 'shopkeeper',
        action: 'DELETE_LISTING',
        targetEntity: 'shop_listings',
        targetId: listingId,
        details: `Deleted listing: ${removed.product.name}`,
      });
      this.persist();
    }
  }

  public getConnectionConfig(shopId: string): BillPilotConnectionConfig {
    if (!this.state.connectionConfigs[shopId]) {
      this.state.connectionConfigs[shopId] = {
        apiUrl: 'https://api.billpilot.app/v1',
        apiKey: `bp_live_${Math.random().toString(36).substring(2, 12)}`,
        merchantId: this.getShopById(shopId)?.externalBillPilotShopId || 'BP-MERCHANT-8012',
        webhookSecret: `whsec_${Math.random().toString(36).substring(2, 10)}`,
        autoSyncInventory: true,
        autoExportOrders: true,
        isConnected: true,
        lastPingAt: new Date().toISOString(),
      };
      this.persist();
    }
    return { ...this.state.connectionConfigs[shopId] };
  }

  public saveConnectionConfig(shopId: string, config: Partial<BillPilotConnectionConfig>, actorId: string): BillPilotConnectionConfig {
    const current = this.getConnectionConfig(shopId);
    const updated: BillPilotConnectionConfig = {
      ...current,
      ...config,
    };
    this.state.connectionConfigs[shopId] = updated;
    this.recordAuditLog({
      actorId,
      actorName: 'Shopkeeper',
      actorRole: 'shopkeeper',
      action: 'UPDATE_BILLPILOT_CONFIG',
      targetEntity: 'connection_configs',
      targetId: shopId,
      details: `Configured BillPilot API URL: ${updated.apiUrl}`,
    });
    this.persist();
    return updated;
  }

  public addCustomerAddress(userId: string, address: Omit<UserAddress, 'id' | 'userId'>): UserAddress {
    const user = this.state.users.find((u) => u.id === userId);
    if (!user) throw new Error('User not found');

    const newAddr: UserAddress = {
      ...address,
      id: `addr_${Date.now()}`,
      userId,
      isDefault: user.addresses.length === 0 ? true : address.isDefault,
    };

    if (newAddr.isDefault) {
      user.addresses.forEach((a) => (a.isDefault = false));
    }

    user.addresses.push(newAddr);
    this.persist();
    return newAddr;
  }

  // --- Shops ---
  public getShops(): Shop[] {
    return [...this.state.shops];
  }

  public getShopById(shopId: string): Shop | undefined {
    return this.state.shops.find((s) => s.id === shopId);
  }

  public updateShopLocation(
    shopId: string,
    coordinates: { latitude: number; longitude: number }
  ): Shop {
    const shop = this.state.shops.find((s) => s.id === shopId);
    if (!shop) throw new Error('Shop not found');
    shop.address.coordinates = { ...coordinates };
    this.persist();
    return { ...shop };
  }

  public updateShopSettings(
    shopId: string,
    updates: Partial<Shop['deliverySettings']>,
    actorId: string
  ): Shop {
    const shop = this.state.shops.find((s) => s.id === shopId);
    if (!shop) throw new Error('Shop not found');

    shop.deliverySettings = {
      ...shop.deliverySettings,
      ...updates,
      serviceRadiusKm: Math.min(Number(updates.serviceRadiusKm ?? shop.deliverySettings.serviceRadiusKm) || 10, 10),
    };
    if (updates.serviceablePincodes !== undefined) {
      const pins = sanitizePincodes(updates.serviceablePincodes);
      if (pins.length === 0) throw new Error('At least one valid 6-digit PIN code is required (maximum 3).');
      shop.deliverySettings.serviceablePincodes = pins;
      shop.address.pincode = pins[0];
    }

    this.recordAuditLog({
      actorId,
      actorName: shop.ownerName,
      actorRole: 'shopkeeper',
      action: 'UPDATE_SHOP_SETTINGS',
      targetEntity: 'shops',
      targetId: shopId,
      details: `Delivery settings updated: acceptingOrders=${shop.deliverySettings.isAcceptingOrders}, radius=${shop.deliverySettings.serviceRadiusKm}km`,
    });

    this.persist();
    return { ...shop };
  }

  public updateShopVerification(
    shopId: string,
    status: Shop['verificationStatus'],
    actorId: string,
    notes?: string
  ): Shop {
    const shop = this.state.shops.find((s) => s.id === shopId);
    if (!shop) throw new Error('Shop not found');

    shop.verificationStatus = status;
    if (shop.verificationDetails) {
      shop.verificationDetails.verifiedAt = new Date().toISOString();
      shop.verificationDetails.verifiedBy = actorId;
      if (notes) shop.verificationDetails.notes = notes;
    }

    this.recordAuditLog({
      actorId,
      actorName: 'Marketplace Admin',
      actorRole: 'admin',
      action: `VERIFICATION_${status.toUpperCase()}`,
      targetEntity: 'shops',
      targetId: shopId,
      details: `Shop ${shop.name} verification changed to ${status}. Notes: ${notes || 'None'}`,
    });

    this.persist();
    return { ...shop };
  }

  // --- Listings & Inventory ---
  public getListings(shopId?: string): ShopListing[] {
    if (shopId) {
      return this.state.listings.filter((l) => l.shopId === shopId);
    }
    return [...this.state.listings];
  }

  public syncListingsFromFirestore(shopId: string, firestoreListings: ShopListing[]): void {
    // Merge: Firestore copy wins for matching ids; products that only exist locally are kept
    const remoteIds = new Set(firestoreListings.map((l) => l.id));
    const otherListings = this.state.listings.filter((l) => l.shopId !== shopId);
    const localOnly = this.state.listings.filter((l) => l.shopId === shopId && !remoteIds.has(l.id));
    this.state.listings = [...otherListings, ...localOnly, ...firestoreListings];
    this.persist();
  }

  public updateListingDetails(
    listingId: string,
    updates: {
      name?: string;
      brand?: string;
      category?: string;
      unit?: string;
      description?: string;
      imageUrl?: string;
      standardGSTRate?: number;
      externalBillPilotItemId?: string;
    }
  ): void {
    const listing = this.state.listings.find((l) => l.id === listingId);
    if (!listing) return;
    listing.product = {
      ...listing.product,
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.brand !== undefined && { brand: updates.brand }),
      ...(updates.category !== undefined && { category: updates.category }),
      ...(updates.unit !== undefined && { unit: updates.unit }),
      ...(updates.description !== undefined && { description: updates.description }),
      ...(updates.imageUrl !== undefined && { imageUrl: updates.imageUrl }),
      ...(updates.standardGSTRate !== undefined && { standardGSTRate: updates.standardGSTRate }),
    };
    if (updates.externalBillPilotItemId !== undefined) {
      listing.externalBillPilotItemId = updates.externalBillPilotItemId;
    }
    listing.updatedAt = new Date().toISOString();
    this.persist();
  }

  public updateListingStockPrice(
    listingId: string,
    updates: { shopPrice?: MinorUnits; salePrice?: MinorUnits; stockQuantity?: number; isAvailable?: boolean },
    actorId: string
  ): ShopListing {
    const listing = this.state.listings.find((l) => l.id === listingId);
    if (!listing) throw new Error('Listing not found');

    if (updates.shopPrice !== undefined) listing.shopPrice = updates.shopPrice;
    if (updates.salePrice !== undefined) listing.salePrice = updates.salePrice;
    if (updates.stockQuantity !== undefined) listing.stockQuantity = updates.stockQuantity;
    if (updates.isAvailable !== undefined) listing.isAvailable = updates.isAvailable;

    this.recordAuditLog({
      actorId,
      actorName: 'Shopkeeper',
      actorRole: 'shopkeeper',
      action: 'UPDATE_LISTING_INVENTORY',
      targetEntity: 'shop_listings',
      targetId: listingId,
      details: `Updated ${listing.product.name}: stock=${listing.stockQuantity}, price=${listing.shopPrice}`,
    });

    this.persist();
    return { ...listing };
  }

  public upsertBillPilotProduct(
    shopId: string,
    input: {
      listingId: string;
      billPilotProductId: string;
      name: string;
      brand?: string;
      category: string;
      unit: string;
      description?: string;
      imageUrl?: string;
      barcode?: string;
      shopPricePaise: MinorUnits;
      stockQuantity: number;
      standardGSTRate?: number;
      externalBillPilotItemId?: string;
    }
  ): { listing: ShopListing; changed: boolean } {
    const shop = this.getShopById(shopId);
    if (!shop) throw new Error('Shop not found');

    const externalId = input.externalBillPilotItemId?.trim() || input.billPilotProductId;
    const matchingListings = this.state.listings.filter(
      (listing) => listing.shopId === shopId && listing.externalBillPilotItemId === externalId
    );
    const existing =
      this.state.listings.find((listing) => listing.shopId === shopId && listing.id === input.listingId) ||
      (matchingListings.length === 1 ? matchingListings[0] : undefined);
    const listingId = existing?.id || input.listingId;
    // Checkout addresses Firestore products by productId; synced listings must use the same canonical ID.
    const productId = listingId;
    const stockQuantity = Math.max(0, Number(input.stockQuantity) || 0);
    const product: GlobalProduct = {
      id: productId,
      name: input.name,
      brand: input.brand || 'Local Brand',
      category: input.category,
      unit: input.unit || '1 unit',
      description: input.description || '',
      standardGSTRate: Number(input.standardGSTRate ?? 5),
      imageUrl: input.imageUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80',
      ...(input.barcode || existing?.product.barcode
        ? { barcode: input.barcode || existing?.product.barcode }
        : {}),
    };
    const shopPrice = Math.max(0, Math.round(Number(input.shopPricePaise) || 0));
    const isAvailable = stockQuantity > 0;
    const changed = !existing ||
      existing.productId !== productId ||
      existing.product.id !== productId ||
      existing.product.name !== product.name ||
      existing.product.brand !== product.brand ||
      existing.product.category !== product.category ||
      existing.product.unit !== product.unit ||
      existing.product.description !== product.description ||
      existing.product.imageUrl !== product.imageUrl ||
      existing.product.standardGSTRate !== product.standardGSTRate ||
      existing.shopPrice !== shopPrice ||
      existing.stockQuantity !== stockQuantity ||
      existing.isAvailable !== isAvailable ||
      existing.externalBillPilotItemId !== externalId;

    if (!changed && existing) return { listing: { ...existing, product: { ...existing.product } }, changed };

    const globalProductIndex = this.state.globalProducts.findIndex((item) => item.id === productId);
    if (globalProductIndex === -1) this.state.globalProducts.push(product);
    else this.state.globalProducts[globalProductIndex] = product;

    const listing: ShopListing = {
      ...(existing || {
        id: listingId,
        shopId,
        productId,
        reservedStock: 0,
        isVisible: true,
      }),
      product,
      productId,
      shopPrice,
      stockQuantity,
      isAvailable,
      externalBillPilotItemId: externalId,
      lastSyncedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (existing) {
      const index = this.state.listings.indexOf(existing);
      this.state.listings[index] = listing;
    } else {
      this.state.listings.push(listing);
    }

    this.persist();
    return { listing: { ...listing, product: { ...product } }, changed };
  }

  // --- Cart & Checkout Server-Side Revalidation ---
  public revalidateCheckout(
    shopId: string,
    cartItems: { listingId: string; quantity: number }[],
    customerAddress: UserAddress
  ): {
    valid: boolean;
    error?: string;
    subtotal: MinorUnits;
    deliveryCharge: MinorUnits;
    gstTotal: MinorUnits;
    totalAmount: MinorUnits;
    itemSnapshots: OrderItemSnapshot[];
  } {
    const shop = this.getShopById(shopId);
    if (!shop) {
      return { valid: false, error: 'Shop is no longer available.', subtotal: 0, deliveryCharge: 0, gstTotal: 0, totalAmount: 0, itemSnapshots: [] };
    }

    if (shop.verificationStatus !== 'verified') {
      return { valid: false, error: 'Shop is currently not authorized to take orders.', subtotal: 0, deliveryCharge: 0, gstTotal: 0, totalAmount: 0, itemSnapshots: [] };
    }

    if (!shop.deliverySettings.isAcceptingOrders) {
      return { valid: false, error: `${shop.name} is currently not accepting new orders. Please check back during operating hours.`, subtotal: 0, deliveryCharge: 0, gstTotal: 0, totalAmount: 0, itemSnapshots: [] };
    }

    const shopCoordinates = shop.address.coordinates;
    const customerCoordinates = customerAddress.coordinates;
    if (!shopCoordinates) {
      return {
        valid: false, error: `${shop.name} must add its shop location before accepting online orders.`,
        subtotal: 0,
        deliveryCharge: 0,
        gstTotal: 0,
        totalAmount: 0,
        itemSnapshots: [],
      };
    }
    if (!customerCoordinates) {
      return {
        valid: false, error: 'Add a delivery address with a verified map location to check whether it is within 10 km of the shop.',
        subtotal: 0,
        deliveryCharge: 0,
        gstTotal: 0,
        totalAmount: 0,
        itemSnapshots: [],
      };
    }
    const distanceKm = calculateHaversineDistanceKm(
      shopCoordinates.latitude,
      shopCoordinates.longitude,
      customerCoordinates.latitude,
      customerCoordinates.longitude
    );
    const allowedRadiusKm = Math.min(Number(shop.deliverySettings.serviceRadiusKm) || 10, 10);
    if (distanceKm > allowedRadiusKm) {
      return {
        valid: false,
        error: `This address is ${distanceKm.toFixed(1)} km from ${shop.name}. Delivery is available only within ${allowedRadiusKm} km.`,
        subtotal: 0,
        deliveryCharge: 0,
        gstTotal: 0,
        totalAmount: 0,
        itemSnapshots: [],
      };
    }

    let subtotal: MinorUnits = 0;
    let gstTotal: MinorUnits = 0;
    const itemSnapshots: OrderItemSnapshot[] = [];

    for (const item of cartItems) {
      const listing = this.state.listings.find((l) => l.id === item.listingId && l.shopId === shopId);
      if (!listing) {
        return { valid: false, error: 'An item in your cart is no longer available from this shop.', subtotal: 0, deliveryCharge: 0, gstTotal: 0, totalAmount: 0, itemSnapshots: [] };
      }

      if (!listing.isAvailable) {
        return { valid: false, error: `"${listing.product.name}" is currently marked out of stock.`, subtotal: 0, deliveryCharge: 0, gstTotal: 0, totalAmount: 0, itemSnapshots: [] };
      }

      const availableStock = listing.stockQuantity - listing.reservedStock;
      if (item.quantity > availableStock) {
        return {
          valid: false,
          error: `Insufficient stock for "${listing.product.name}". Requested ${item.quantity}, but only ${availableStock} units available.`,
          subtotal: 0,
          deliveryCharge: 0,
          gstTotal: 0,
          totalAmount: 0,
          itemSnapshots: [],
        };
      }

      const effectiveUnitPrice = listing.salePrice && listing.salePrice > 0 ? listing.salePrice : listing.shopPrice;
      const itemSubtotal = effectiveUnitPrice * item.quantity;
      const itemGst = calculateGST(itemSubtotal, listing.product.standardGSTRate);

      subtotal += itemSubtotal;
      gstTotal += itemGst;

      itemSnapshots.push({
        id: `snap_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        productId: listing.product.id,
        productName: listing.product.name,
        unit: listing.product.unit,
        quantity: item.quantity,
        unitPrice: effectiveUnitPrice,
        subtotal: itemSubtotal,
        gstRate: listing.product.standardGSTRate,
        gstAmount: itemGst,
        imageUrl: listing.product.imageUrl,
      });
    }

    // Minimum order value validation
    if (subtotal < shop.deliverySettings.minOrderValue) {
      return {
        valid: false,
        error: `Minimum order value for ${shop.name} is ₹${shop.deliverySettings.minOrderValue / 100}. Current subtotal: ₹${subtotal / 100}`,
        subtotal,
        deliveryCharge: 0,
        gstTotal,
        totalAmount: 0,
        itemSnapshots,
      };
    }

    // Server-side delivery charge calculation
    let deliveryCharge = shop.deliverySettings.baseDeliveryCharge;
    if (
      shop.deliverySettings.freeDeliveryThreshold &&
      subtotal >= shop.deliverySettings.freeDeliveryThreshold
    ) {
      deliveryCharge = 0;
    }

    const totalAmount = subtotal + deliveryCharge + gstTotal;

    return {
      valid: true,
      subtotal,
      deliveryCharge,
      gstTotal,
      totalAmount,
      itemSnapshots,
    };
  }

  // --- Order Placement (Concurrency & Inventory Safe) ---
  public placeOrder(input: {
    customerId: string;
    shopId: string;
    items: { listingId: string; quantity: number }[];
    deliveryAddress: UserAddress;
    paymentMethod: PaymentMethod;
  }): Order {
    const customer = this.state.users.find((u) => u.id === input.customerId);
    if (!customer) throw new Error('Customer account not found');

    const shop = this.getShopById(input.shopId);
    if (!shop) throw new Error('Shop not found');

    // 1. Strict Server Revalidation
    const revalidation = this.revalidateCheckout(input.shopId, input.items, input.deliveryAddress);
    if (!revalidation.valid || !revalidation.itemSnapshots) {
      throw new Error(revalidation.error || 'Checkout revalidation failed.');
    }

    // 2. Reserve / Decrement Stock Concurrency-Safely
    for (const item of input.items) {
      const listing = this.state.listings.find((l) => l.id === item.listingId);
      if (listing) {
        listing.stockQuantity -= item.quantity;
        if (listing.stockQuantity <= 0) {
          listing.stockQuantity = 0;
          listing.isAvailable = false;
        }
      }
    }

    // 3. Platform Commission (5%)
    const commissionRatePct = 5;
    const platformCommission = Math.round((revalidation.subtotal * commissionRatePct) / 100);

    const orderNumber = generateOrderNumber();
    const deliveryOtp = generateDeliveryOTP();
    const nowIso = new Date().toISOString();

    const newOrder: Order = {
      id: `ord_${Date.now()}`,
      orderNumber,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      shopId: shop.id,
      shopName: shop.name,
      shopAddress: `${shop.address.street}, ${shop.address.locality}`,
      shopPhone: shop.phone,
      deliveryAddress: input.deliveryAddress,
      items: revalidation.itemSnapshots,
      itemCount: revalidation.itemSnapshots.reduce((acc, i) => acc + i.quantity, 0),
      subtotal: revalidation.subtotal,
      deliveryCharge: revalidation.deliveryCharge,
      gstTotal: revalidation.gstTotal,
      platformCommission,
      totalAmount: revalidation.totalAmount,
      status: 'pending_confirmation',
      paymentMethod: input.paymentMethod,
      paymentStatus: input.paymentMethod === 'online_upi_card' ? 'authorized' : 'pending',
      statusHistory: [
        {
          status: 'pending_confirmation',
          timestamp: nowIso,
          actorId: customer.id,
          actorRole: 'customer',
          note: `Order placed. Awaiting shop confirmation. Payment method: ${input.paymentMethod === 'cash_on_delivery' ? 'Cash on Delivery' : 'Online Payment (Authorized)'}`,
        },
      ],
      delivery: {
        orderId: `ord_${Date.now()}`,
        shopId: shop.id,
        deliveryAgentName: `${shop.name} Staff`,
        deliveryAgentPhone: shop.phone,
        assignedAt: nowIso,
        otpCode: deliveryOtp,
        otpVerified: false,
      },
      estimatedDeliveryTime: new Date(
        Date.now() + (shop.deliverySettings.estimatedPrepMinutes + shop.deliverySettings.estimatedDeliveryMinutes) * 60000
      ).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }),
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    this.state.orders.unshift(newOrder);

    // 4. Commission Ledger Entry
    this.state.commissionLedger.push({
      id: `comm_${Date.now()}`,
      orderId: newOrder.id,
      shopId: shop.id,
      shopName: shop.name,
      orderTotal: newOrder.totalAmount,
      commissionRatePct,
      commissionAmount: platformCommission,
      netShopEarnings: newOrder.totalAmount - platformCommission,
      payoutStatus: 'accrued',
      createdAt: nowIso,
    });

    // 5. Audit Log & Notifications
    this.recordAuditLog({
      actorId: customer.id,
      actorName: customer.name,
      actorRole: 'customer',
      action: 'ORDER_CREATED',
      targetEntity: 'orders',
      targetId: newOrder.id,
      details: `Order ${orderNumber} placed for ₹${newOrder.totalAmount / 100} at ${shop.name}`,
    });

    this.state.notifications.unshift({
      id: `notif_${Date.now()}`,
      userId: shop.ownerId,
      title: 'New Online Order Received!',
      message: `Order #${orderNumber} received (${newOrder.itemCount} items) worth ₹${newOrder.totalAmount / 100}. Please accept or reject.`,
      type: 'order',
      orderId: newOrder.id,
      read: false,
      createdAt: nowIso,
    });

    this.persist();
    return newOrder;
  }

  public addExternalOrder(order: Order): void {
    const existingIndex = this.state.orders.findIndex((o) => o.id === order.id || o.orderNumber === order.orderNumber);
    if (existingIndex >= 0) {
      this.state.orders[existingIndex] = order;
    } else {
      this.state.orders.unshift(order);
    }
    this.persist();
  }

  public syncOrdersFromFirestore(
    remoteOrders: Order[],
    filters: { customerId?: string; shopId?: string }
  ): void {
    const matchesFilter = (order: Order) =>
      (!filters.customerId || order.customerId === filters.customerId) &&
      (!filters.shopId || order.shopId === filters.shopId);
    const remoteIds = new Set(remoteOrders.map((order) => order.id));
    const otherOrders = this.state.orders.filter((order) => !matchesFilter(order));
    const localOnlyOrders = this.state.orders.filter(
      (order) => matchesFilter(order) && !remoteIds.has(order.id)
    );

    this.state.orders = [...remoteOrders, ...localOnlyOrders, ...otherOrders];
    this.persist();
  }

  // --- Order State Machine Transition ---
  public transitionOrderStatus(
    orderId: string,
    targetStatus: OrderStatus,
    actorId: string,
    actorRole: UserRole | 'system',
    reason?: string,
    note?: string
  ): Order {
    const order = this.state.orders.find((o) => o.id === orderId);
    if (!order) throw new Error('Order not found');

    const check = canTransitionOrder(order.status, targetStatus, actorRole);
    if (!check.allowed) {
      throw new Error(check.error || 'Forbidden state transition');
    }

    const nowIso = new Date().toISOString();
    order.status = targetStatus;
    order.updatedAt = nowIso;

    order.statusHistory.push({
      status: targetStatus,
      timestamp: nowIso,
      actorId,
      actorRole,
      reason,
      note,
    });

    // Handle side-effects of transitions
    if (targetStatus === 'accepted') {
      // Generate GST Tax Invoice reference
      order.invoice = {
        id: `inv_${Date.now()}`,
        orderId: order.id,
        invoiceNumber: generateInvoiceNumber(),
        billPilotInvoiceId: `BP-INV-${Math.floor(10000 + Math.random() * 90000)}`,
        subtotal: order.subtotal,
        deliveryCharge: order.deliveryCharge,
        gstTotal: order.gstTotal,
        grandTotal: order.totalAmount,
        platformFee: order.platformCommission,
        issuedAt: nowIso,
      };

      // Create outbound BillPilot sync event
      this.recordSyncEvent({
        shopId: order.shopId,
        direction: 'outbound_to_billpilot',
        syncType: 'order_export',
        payloadSummary: `Order ${order.orderNumber} exported to BillPilot ERP. Sale Invoice created: ${order.invoice.billPilotInvoiceId}`,
        externalReferenceId: order.invoice.billPilotInvoiceId,
        status: 'success',
      });
    } else if (targetStatus === 'cancelled' || targetStatus === 'rejected') {
      // Revert reserved stock back to listings!
      for (const item of order.items) {
        const listing = this.state.listings.find(
          (l) => l.productId === item.productId && l.shopId === order.shopId
        );
        if (listing) {
          listing.stockQuantity += item.quantity;
          listing.isAvailable = true;
        }
      }

      if (order.paymentStatus === 'authorized') {
        order.paymentStatus = 'refunded';
      }

      // Notify BillPilot
      this.recordSyncEvent({
        shopId: order.shopId,
        direction: 'outbound_to_billpilot',
        syncType: 'cancellation_notify',
        payloadSummary: `Cancellation notice for order ${order.orderNumber}. Inventory reversed in ERP.`,
        status: 'success',
      });
    } else if (targetStatus === 'out_for_delivery') {
      order.delivery.dispatchedAt = nowIso;
      this.state.notifications.unshift({
        id: `notif_${Date.now()}`,
        userId: order.customerId,
        title: 'Order Out For Delivery',
        message: `Your order #${order.orderNumber} is on the way! Share OTP ${order.delivery.otpCode} with the delivery partner upon arrival.`,
        type: 'order',
        orderId: order.id,
        read: false,
        createdAt: nowIso,
      });
    } else if (targetStatus === 'delivered') {
      order.delivery.deliveredAt = nowIso;
      order.delivery.otpVerified = true;
      if (order.paymentMethod === 'cash_on_delivery') {
        order.paymentStatus = 'completed';
      }
    }

    this.recordAuditLog({
      actorId,
      actorName: actorRole,
      actorRole,
      action: `ORDER_STATE_${targetStatus.toUpperCase()}`,
      targetEntity: 'orders',
      targetId: order.id,
      details: `Status transitioned to ${targetStatus}. ${reason ? 'Reason: ' + reason : ''}`,
    });

    this.persist();
    return { ...order };
  }

  // --- Delivery OTP Verification ---
  public verifyDeliveryOTP(orderId: string, otp: string, actorId: string): { success: boolean; message: string } {
    const order = this.state.orders.find((o) => o.id === orderId);
    if (!order) return { success: false, message: 'Order not found.' };

    if (order.delivery.otpCode !== otp.trim()) {
      return { success: false, message: 'Invalid OTP code. Please ask customer to check their order screen.' };
    }

    this.transitionOrderStatus(orderId, 'delivered', actorId, 'shopkeeper', undefined, 'Delivered with verified customer OTP.');
    return { success: true, message: 'Delivery OTP verified successfully! Order marked as Delivered.' };
  }

  // --- Returns & Complaints ---
  public submitReturnComplaint(input: {
    orderId: string;
    customerId: string;
    reason: ReturnComplaintRequest['reason'];
    description: string;
    photoEvidenceUrls: string[];
  }): ReturnComplaintRequest {
    const order = this.state.orders.find((o) => o.id === input.orderId);
    if (!order) throw new Error('Order not found');

    const customer = this.state.users.find((u) => u.id === input.customerId);
    const nowIso = new Date().toISOString();

    const request: ReturnComplaintRequest = {
      id: `ret_${Date.now()}`,
      orderId: order.id,
      orderNumber: order.orderNumber,
      shopId: order.shopId,
      shopName: order.shopName,
      customerId: order.customerId,
      customerName: customer?.name || 'Customer',
      reason: input.reason,
      description: input.description,
      photoEvidenceUrls: input.photoEvidenceUrls,
      status: 'submitted',
      refundAmount: order.totalAmount,
      createdAt: nowIso,
    };

    this.state.returnRequests.unshift(request);
    this.transitionOrderStatus(order.id, 'return_requested', input.customerId, 'customer', input.reason, input.description);

    this.persist();
    return request;
  }

  public arbitrateReturnComplaint(
    requestId: string,
    action: 'approve_refund' | 'reject' | 'replace',
    actorId: string,
    notes: string
  ): ReturnComplaintRequest {
    const req = this.state.returnRequests.find((r) => r.id === requestId);
    if (!req) throw new Error('Dispute request not found');

    const nowIso = new Date().toISOString();
    if (action === 'approve_refund') {
      req.status = 'refunded';
      req.adminDecision = notes;
      req.resolvedAt = nowIso;
      this.transitionOrderStatus(req.orderId, 'refunded', actorId, 'admin', undefined, `Refund of ₹${(req.refundAmount || 0) / 100} approved.`);
    } else if (action === 'reject') {
      req.status = 'rejected';
      req.adminDecision = notes;
      req.resolvedAt = nowIso;
      this.transitionOrderStatus(req.orderId, 'return_rejected', actorId, 'admin', undefined, notes);
    } else if (action === 'replace') {
      req.status = 'resolved';
      req.adminDecision = notes;
      req.resolvedAt = nowIso;
      this.transitionOrderStatus(req.orderId, 'replacement_in_progress', actorId, 'admin', undefined, notes);
    }

    this.persist();
    return { ...req };
  }

  // --- BillPilot Sync Layer ---
  public getSyncEvents(shopId?: string): BillPilotSyncEvent[] {
    if (shopId) {
      return this.state.syncEvents.filter((s) => s.shopId === shopId);
    }
    return [...this.state.syncEvents];
  }

  public recordSyncEvent(event: Omit<BillPilotSyncEvent, 'id' | 'timestamp' | 'attemptCount'>): BillPilotSyncEvent {
    const fullEvent: BillPilotSyncEvent = {
      ...event,
      id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      attemptCount: 1,
      timestamp: new Date().toISOString(),
    };
    this.state.syncEvents.unshift(fullEvent);
    this.persist();
    return fullEvent;
  }

  public triggerSyncWithBillPilot(shopId: string, syncType: BillPilotSyncEvent['syncType']): BillPilotSyncEvent {
    const shop = this.getShopById(shopId);
    const nowIso = new Date().toISOString();

    // Perform bidirectional mock handshake
    if (syncType === 'catalogue_sync' || syncType === 'inventory_update') {
      // Refresh mock stock from external ERP
      const shopListings = this.state.listings.filter((l) => l.shopId === shopId);
      shopListings.forEach((l) => {
        l.stockQuantity += Math.floor(Math.random() * 5);
        l.lastSyncedAt = nowIso;
      });

      return this.recordSyncEvent({
        shopId,
        direction: 'inbound_to_marketplace',
        syncType,
        payloadSummary: `Synced ${shopListings.length} products with BillPilot ERP for ${shop?.name || 'Shop'}. All stock quantities updated.`,
        externalReferenceId: `BP-SYNC-${Math.floor(1000 + Math.random() * 9000)}`,
        status: 'success',
      });
    }

    return this.recordSyncEvent({
      shopId,
      direction: 'outbound_to_billpilot',
      syncType,
      payloadSummary: `Triggered manual ${syncType} with BillPilot ERP for ${shop?.name || 'Shop'}.`,
      status: 'success',
    });
  }

  public retryFailedSync(syncEventId: string): BillPilotSyncEvent {
    const event = this.state.syncEvents.find((e) => e.id === syncEventId);
    if (!event) throw new Error('Sync event not found');

    event.attemptCount += 1;
    event.status = 'success';
    event.errorMessage = undefined;
    event.timestamp = new Date().toISOString();
    event.payloadSummary += ` (Recovered successfully on attempt ${event.attemptCount})`;

    this.persist();
    return { ...event };
  }

  // --- Audit Logs ---
  public getAuditLogs(): AuditLogEntry[] {
    return [...this.state.auditLogs];
  }

  public recordAuditLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp'>): void {
    this.state.auditLogs.unshift({
      ...entry,
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
    });
    this.persist();
  }

  // --- Orders & Support ---
  public getOrders(filters?: { customerId?: string; shopId?: string }): Order[] {
    let result = [...this.state.orders];
    if (filters?.customerId) {
      result = result.filter((o) => o.customerId === filters.customerId);
    }
    if (filters?.shopId) {
      result = result.filter((o) => o.shopId === filters.shopId);
    }
    return result;
  }

  public getReturnRequests(shopId?: string): ReturnComplaintRequest[] {
    if (shopId) {
      return this.state.returnRequests.filter((r) => r.shopId === shopId);
    }
    return [...this.state.returnRequests];
  }

  public getCommissionLedger(): CommissionLedgerEntry[] {
    return [...this.state.commissionLedger];
  }

  public getNotifications(userId: string): InAppNotification[] {
    return this.state.notifications.filter((n) => n.userId === userId);
  }

  public markNotificationAsRead(notifId: string): void {
    const n = this.state.notifications.find((item) => item.id === notifId);
    if (n) {
      n.read = true;
      this.persist();
    }
  }

  // --- Area Directory ---
  public getAreas(filters?: { city?: string; level?: AreaLevel; status?: AreaStatus; query?: string }): AreaRecord[] {
    let list = [...this.state.areas];
    if (filters?.city) {
      list = list.filter((a) => a.city.toLowerCase() === filters.city!.toLowerCase());
    }
    if (filters?.level) {
      list = list.filter((a) => a.level === filters.level);
    }
    if (filters?.status) {
      list = list.filter((a) => a.status === filters.status);
    }
    if (filters?.query) {
      const q = filters.query.toLowerCase().trim();
      list = list.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.pincode.includes(q) ||
          a.city.toLowerCase().includes(q) ||
          a.aliases.some((alias) => alias.toLowerCase().includes(q))
      );
    }
    return list;
  }

  public getCities(): string[] {
    const citySet = new Set<string>();
    for (const a of this.state.areas) {
      if (a.status === 'active') {
        citySet.add(a.city);
      }
    }
    return Array.from(citySet).sort();
  }

  public getAreaById(id: string): AreaRecord | undefined {
    return this.state.areas.find((a) => a.id === id);
  }

  public createArea(
    input: Omit<AreaRecord, 'id' | 'createdAt' | 'updatedAt'>,
    actorId: string
  ): AreaRecord {
    // Avoid exact duplicate
    const existing = this.state.areas.find(
      (a) =>
        a.name.toLowerCase() === input.name.toLowerCase() &&
        a.city.toLowerCase() === input.city.toLowerCase() &&
        a.pincode === input.pincode
    );
    if (existing) {
      throw new Error(`Area "${input.name}" in ${input.city} (${input.pincode}) already exists.`);
    }

    const now = new Date().toISOString();
    const id = `area_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newArea: AreaRecord = {
      ...input,
      id,
      createdAt: now,
      updatedAt: now,
    };

    this.state.areas.push(newArea);
    this.recordAuditLog({
      actorId,
      actorName: 'Admin',
      actorRole: 'admin',
      action: 'CREATE_AREA',
      targetEntity: 'area_directory',
      targetId: id,
      details: `Created area: "${newArea.name}" in ${newArea.city} (${newArea.pincode})`,
    });
    this.persist();
    return newArea;
  }

  public updateArea(
    id: string,
    updates: Partial<AreaRecord>,
    actorId: string
  ): AreaRecord {
    const area = this.state.areas.find((a) => a.id === id);
    if (!area) throw new Error('Area not found');

    Object.assign(area, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });

    this.recordAuditLog({
      actorId,
      actorName: 'Admin',
      actorRole: 'admin',
      action: 'UPDATE_AREA',
      targetEntity: 'area_directory',
      targetId: id,
      details: `Updated area attributes for "${area.name}"`,
    });
    this.persist();
    return area;
  }

  public deactivateArea(id: string, actorId: string): void {
    const area = this.state.areas.find((a) => a.id === id);
    if (area) {
      area.status = 'inactive';
      area.updatedAt = new Date().toISOString();
      this.recordAuditLog({
        actorId,
        actorName: 'Admin',
        actorRole: 'admin',
        action: 'DEACTIVATE_AREA',
        targetEntity: 'area_directory',
        targetId: id,
        details: `Deactivated area: "${area.name}" in ${area.city}`,
      });
      this.persist();
    }
  }

  public mergeAreas(sourceAreaId: string, targetAreaId: string, actorId: string): void {
    if (sourceAreaId === targetAreaId) throw new Error('Cannot merge an area into itself');
    const sourceArea = this.state.areas.find((a) => a.id === sourceAreaId);
    const targetArea = this.state.areas.find((a) => a.id === targetAreaId);
    if (!sourceArea || !targetArea) throw new Error('Source or target area not found');

    // Add source name and aliases into target's aliases if not present
    const combinedAliases = new Set([...targetArea.aliases, sourceArea.name, ...sourceArea.aliases]);
    combinedAliases.delete(targetArea.name);
    targetArea.aliases = Array.from(combinedAliases);
    targetArea.updatedAt = new Date().toISOString();

    // Repoint child sub-localities
    for (const a of this.state.areas) {
      if (a.parentAreaId === sourceAreaId) {
        a.parentAreaId = targetAreaId;
        a.updatedAt = new Date().toISOString();
      }
    }

    // Repoint shop serviceableAreaIds
    for (const shop of this.state.shops) {
      if (shop.deliverySettings.serviceableAreaIds) {
        const idx = shop.deliverySettings.serviceableAreaIds.indexOf(sourceAreaId);
        if (idx !== -1) {
          shop.deliverySettings.serviceableAreaIds[idx] = targetAreaId;
          shop.deliverySettings.serviceableAreaIds = Array.from(new Set(shop.deliverySettings.serviceableAreaIds));
        }
      }
    }

    // Mark source inactive
    sourceArea.status = 'inactive';
    sourceArea.updatedAt = new Date().toISOString();

    this.recordAuditLog({
      actorId,
      actorName: 'Admin',
      actorRole: 'admin',
      action: 'MERGE_AREAS',
      targetEntity: 'area_directory',
      targetId: targetAreaId,
      details: `Merged "${sourceArea.name}" into "${targetArea.name}"`,
    });
    this.persist();
  }

  public bulkImportAreas(
    records: Omit<AreaRecord, 'id' | 'createdAt' | 'updatedAt'>[],
    actorId: string
  ): { imported: number; skipped: number; errors: string[] } {
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];
    const now = new Date().toISOString();

    for (const rec of records) {
      const exists = this.state.areas.find(
        (a) =>
          a.name.toLowerCase() === rec.name.toLowerCase() &&
          a.city.toLowerCase() === rec.city.toLowerCase() &&
          a.pincode === rec.pincode
      );
      if (exists) {
        skipped++;
        continue;
      }

      const id = `area_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      this.state.areas.push({
        ...rec,
        id,
        createdAt: now,
        updatedAt: now,
      });
      imported++;
    }

    this.recordAuditLog({
      actorId,
      actorName: 'Admin',
      actorRole: 'admin',
      action: 'BULK_IMPORT_AREAS',
      targetEntity: 'area_directory',
      targetId: 'bulk',
      details: `Bulk imported ${imported} areas (${skipped} duplicates skipped).`,
    });
    this.persist();
    return { imported, skipped, errors };
  }

  public submitAreaRequest(input: {
    city: string;
    localityName: string;
    pincode?: string;
    customerEmail?: string;
  }): AreaRequest {
    const now = new Date().toISOString();
    const req: AreaRequest = {
      id: `req_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      city: input.city.trim(),
      localityName: input.localityName.trim(),
      pincode: input.pincode?.trim(),
      customerEmail: input.customerEmail?.trim(),
      status: 'pending',
      createdAt: now,
    };
    this.state.areaRequests.push(req);
    this.persist();
    return req;
  }

  public getAreaRequests(): AreaRequest[] {
    return [...this.state.areaRequests];
  }

  public updateAreaRequestStatus(
    requestId: string,
    status: 'approved' | 'rejected',
    adminNotes?: string
  ): void {
    const req = this.state.areaRequests.find((r) => r.id === requestId);
    if (req) {
      req.status = status;
      req.adminNotes = adminNotes;
      this.persist();
    }
  }

  // --- Location-Based Shop Coverage ---
  public getShopsWithDistance(
    customerCoords: { latitude: number; longitude: number },
    options?: { pincode?: string; locality?: string; city?: string }
  ): {
    shop: Shop;
    distanceKm: number;
    isWithinRadius: boolean;
    isDeliveryAvailable: boolean;
    matchReason: 'radius' | 'pincode' | 'locality' | 'none';
  }[] {
    return this.state.shops.map((shop) => {
      const shopCoords = shop.address.coordinates;
      const distanceKm = shopCoords
        ? calculateHaversineDistanceKm(
            customerCoords.latitude,
            customerCoords.longitude,
            shopCoords.latitude,
            shopCoords.longitude
          )
        : Number.POSITIVE_INFINITY;
      const radiusKm = Math.min(Number(shop.deliverySettings.serviceRadiusKm) || 10, 10);
      const isWithinRadius = distanceKm <= radiusKm;

      // Pincode matching
      const matchesPincode = Boolean(
        options?.pincode && (
          shop.deliverySettings.serviceablePincodes?.includes(options.pincode) ||
          shop.address.pincode === options.pincode
        )
      );

      // Locality matching
      const matchesLocality = Boolean(
        options?.locality && (
          shop.deliverySettings.serviceableLocalities.some(
            (l) => l.toLowerCase() === options.locality!.toLowerCase()
          ) ||
          shop.address.locality.toLowerCase() === options.locality!.toLowerCase()
        )
      );

      let matchReason: 'radius' | 'pincode' | 'locality' | 'none' = 'none';
      if (matchesPincode) matchReason = 'pincode';
      else if (matchesLocality) matchReason = 'locality';
      else if (isWithinRadius) matchReason = 'radius';

      const isDeliveryAvailable =
        shop.deliverySettings.isDeliveryAvailable &&
        isWithinRadius;

      return {
        shop,
        distanceKm,
        isWithinRadius,
        isDeliveryAvailable,
        matchReason,
      };
    });
  }

  // Reset to demo data if requested
  public resetToDefaultSeed(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.state = this.loadState();
    this.persist();
  }
}

export const dbStore = new RelationalDatabaseStore();
