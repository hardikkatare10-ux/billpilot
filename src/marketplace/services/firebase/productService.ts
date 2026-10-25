/**
 * BillPilot Local - Firestore Product & Inventory Real-Time Service
 * 
 * Manages real-time synchronization between Shopkeeper Inventory Dashboard
 * and Customer Marketplace via Firestore onSnapshot() listeners.
 */

import {
  collection,
  doc,
  query,
  where,
  onSnapshot,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  Unsubscribe,
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType, ensureFirebaseSession } from './config';
import { FirestoreProduct, ShopListing, Shop } from '../../types';
import { dbStore } from '../db/store';

// Helper converter: FirestoreProduct -> ShopListing
export function productToShopListing(p: FirestoreProduct): ShopListing {
  return {
    id: p.id,
    shopId: p.shopId,
    productId: p.id,
    product: {
      id: p.id,
      name: p.name,
      brand: p.brand || 'Local Brand',
      category: p.category || 'Groceries & Essentials',
      unit: p.unit || '1 unit',
      description: p.description || '',
      standardGSTRate: p.standardGSTRate ?? 5,
      imageUrl: p.imageUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80',
    },
    shopPrice: p.shopPrice,
    salePrice: p.salePrice && p.salePrice > 0 ? p.salePrice : undefined,
    stockQuantity: Number(p.stockQuantity ?? 0),
    reservedStock: 0,
    isAvailable: Boolean(p.isAvailable && p.stockQuantity > 0),
    isVisible: p.isVisible !== false,
    externalBillPilotItemId: p.externalBillPilotItemId,
    lastSyncedAt: p.updatedAt || p.createdAt,
    updatedAt: p.updatedAt,
  };
}

/**
 * Real-time subscription to a shop's active product catalog.
 * Invokes onUpdate with the latest verified listings whenever products are added,
 * updated (price, stock, details, image), or removed.
 */
export function subscribeToShopProducts(
  shopId: string,
  onUpdate: (listings: ShopListing[], products: FirestoreProduct[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  if (!shopId) {
    onUpdate([], []);
    return () => {};
  }

  const productsRef = collection(db, 'products');
  const q = query(productsRef, where('shopId', '==', shopId));

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const products: FirestoreProduct[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        products.push({
          id: docSnap.id,
          shopId: data.shopId || shopId,
          ownerId: data.ownerId || '',
          name: data.name || 'Unnamed Product',
          brand: data.brand || 'Local Brand',
          category: data.category || 'Groceries & Essentials',
          unit: data.unit || '1 unit',
          description: data.description || '',
          imageUrl: data.imageUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80',
          shopPrice: Number(data.shopPrice || 0),
          salePrice: data.salePrice !== undefined && data.salePrice !== null ? Number(data.salePrice) : null,
          stockQuantity: Number(data.stockQuantity || 0),
          isAvailable: Boolean(data.isAvailable),
          isVisible: data.isVisible !== false,
          standardGSTRate: Number(data.standardGSTRate ?? 5),
          externalBillPilotItemId: data.externalBillPilotItemId,
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt || new Date().toISOString(),
        });
      });

      // Map to ShopListing models
      const listings = products.map(productToShopListing);

      // Keep dbStore memory and checkout validation in sync (merges with local-only products)
      dbStore.syncListingsFromFirestore(shopId, listings);

      onUpdate(dbStore.getListings(shopId), products);
    },
    (firestoreErr) => {
      console.error(`Firestore error in subscribeToShopProducts for shop ${shopId}:`, firestoreErr);
      if (onError) {
        onError(firestoreErr instanceof Error ? firestoreErr : new Error(String(firestoreErr)));
      }
    }
  );

  return unsubscribe;
}

/**
 * Creates a new product in Firestore for a shop.
 */
export async function createFirestoreProduct(
  input: {
    shopId: string;
    name: string;
    brand: string;
    category: string;
    unit: string;
    description: string;
    imageUrl?: string;
    shopPricePaise: number;
    salePricePaise?: number;
    stockQuantity: number;
    standardGSTRate?: number;
    isVisible?: boolean;
    externalBillPilotItemId?: string;
    id?: string; // reuse the local listing id so both stores stay one-to-one
  },
  ownerIdOverride?: string
): Promise<FirestoreProduct> {
  const currentUid = (await ensureFirebaseSession()) || auth.currentUser?.uid || ownerIdOverride || '';
  const productId =
    input.id || `prod_${input.shopId}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  const newDoc: FirestoreProduct = {
    id: productId,
    shopId: input.shopId,
    ownerId: currentUid,
    name: input.name.trim(),
    brand: input.brand.trim() || 'Local Quality',
    category: input.category,
    unit: input.unit.trim() || '1 unit',
    description: input.description.trim() || `${input.name} available at local store.`,
    imageUrl:
      input.imageUrl?.trim() ||
      'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80',
    shopPrice: Math.round(Number(input.shopPricePaise)),
    salePrice: input.salePricePaise ? Math.round(Number(input.salePricePaise)) : null,
    stockQuantity: Math.max(0, Number(input.stockQuantity)),
    isAvailable: Number(input.stockQuantity) > 0,
    isVisible: input.isVisible ?? true,
    standardGSTRate: Number(input.standardGSTRate ?? 5),
    externalBillPilotItemId: input.externalBillPilotItemId?.trim() || `BP-SKU-${Math.floor(1000 + Math.random() * 9000)}`,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const docRef = doc(db, 'products', productId);
    await setDoc(docRef, newDoc);

    // Also update local store
    dbStore.syncListingsFromFirestore(input.shopId, [
      ...dbStore.getListings(input.shopId).filter((l) => l.id !== productId),
      productToShopListing(newDoc),
    ]);

    return newDoc;
  } catch (err: unknown) {
    handleFirestoreError(err, OperationType.CREATE, `products/${productId}`);
  }
}

/**
 * Updates an existing product document in Firestore.
 * Preserves the document ID, shopId, and ownership while applying updated fields and timestamp.
 */
export async function updateFirestoreProduct(
  productId: string,
  updates: Partial<Omit<FirestoreProduct, 'id' | 'shopId' | 'createdAt'>>
): Promise<void> {
  const now = new Date().toISOString();
  const payload: Record<string, any> = {
    ...updates,
    updatedAt: now,
  };

  // If stock is set to 0, automatically mark as unavailable if not explicitly specified
  if (updates.stockQuantity !== undefined && updates.stockQuantity <= 0 && updates.isAvailable === undefined) {
    payload.isAvailable = false;
  }

  try {
    await ensureFirebaseSession();
    const docRef = doc(db, 'products', productId);
    await updateDoc(docRef, payload);
  } catch (err: unknown) {
    handleFirestoreError(err, OperationType.UPDATE, `products/${productId}`);
  }
}

/**
 * Deletes a product document from Firestore.
 */
export async function deleteFirestoreProduct(productId: string): Promise<void> {
  try {
    await ensureFirebaseSession();
    const docRef = doc(db, 'products', productId);
    await deleteDoc(docRef);
  } catch (err: unknown) {
    handleFirestoreError(err, OperationType.DELETE, `products/${productId}`);
  }
}

/**
 * Mirrors the shop record to Firestore (best effort). No demo products are ever seeded:
 * a shop's catalogue contains only what its shopkeeper adds.
 */
export async function ensureShopInitializedInFirestore(shop: Shop): Promise<void> {
  try {
    const currentUid = (await ensureFirebaseSession()) || auth.currentUser?.uid;
    if (!currentUid) return;

    await setDoc(
      doc(db, 'shops', shop.id),
      {
        id: shop.id,
        name: shop.name,
        ownerId: currentUid,
        ownerName: shop.ownerName,
        phone: shop.phone,
        email: shop.email,
        category: shop.category,
        description: shop.description,
        imageUrl: shop.imageUrl,
        rating: shop.rating,
        reviewCount: shop.reviewCount,
        verificationStatus: shop.verificationStatus,
        serviceablePincodes: shop.deliverySettings.serviceablePincodes || [],
        createdAt: shop.createdAt,
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Shop mirror to Firestore skipped:', err);
  }
}
