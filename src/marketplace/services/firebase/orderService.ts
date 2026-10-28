/**
 * NearBasket - Atomic Order Processing & Inventory Transaction Service
 * 
 * Implements Phase 8:
 * - Server/Transaction-side price validation (prevents client-tampered prices)
 * - Atomic stock deduction via Firestore runTransaction
 * - Concurrency protection against overselling and negative inventory
 * - Strict single-shop verification
 * - Seamless sync with Shopkeeper ERP inventory
 */

import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  runTransaction,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../../../lib/firebase';
import { dbStore } from '../db/store';
import { MinorUnits, Order, OrderItemSnapshot, PaymentMethod, UserAddress, UserRole, OrderStatus } from '../../types';
import {
  canTransitionOrder,
  generateDeliveryOTP,
  generateInvoiceNumber,
  generateOrderNumber,
} from '../../utils/formatters';
import { calculateHaversineDistanceKm } from '../../utils/geo';

export interface PlaceOrderInput {
  customerId: string;
  customerName: string;
  customerPhone: string;
  shopId: string;
  items: { listingId: string; productId: string; quantity: number }[];
  deliveryAddress: UserAddress;
  paymentMethod: PaymentMethod;
  notes?: string;
}

export interface OrderPlacementResult {
  success: boolean;
  order: Order;
  transactionId?: string;
}

function orderFromFirestore(id: string, data: Record<string, unknown>): Order {
  const rawItems = Array.isArray(data.items) ? data.items as Record<string, unknown>[] : [];
  const items: OrderItemSnapshot[] = rawItems.map((item, index) => {
    const quantity = Number(item.quantity ?? 0);
    const unitPrice = Number(item.unitPrice ?? 0);
    return {
      id: String(item.id ?? `item_${index + 1}`),
      productId: String(item.productId ?? ''),
      productName: String(item.productName ?? 'Product'),
      unit: String(item.unit ?? '1 unit'),
      quantity,
      unitPrice,
      subtotal: Number(item.subtotal ?? item.totalPrice ?? unitPrice * quantity),
      gstRate: Number(item.gstRate ?? 0),
      gstAmount: Number(item.gstAmount ?? 0),
      imageUrl: String(item.imageUrl ?? ''),
    };
  });
  const createdAt = String(data.createdAt ?? new Date().toISOString());
  const shopId = String(data.shopId ?? '');
  const shopName = String(data.shopName ?? 'Neighborhood Store');
  const shopPhone = String(data.shopPhone ?? '');
  const rawAddress = data.deliveryAddress as Partial<UserAddress> | undefined;
  const deliveryAddress: UserAddress = {
    id: String(rawAddress?.id ?? ''),
    userId: String(rawAddress?.userId ?? data.customerId ?? ''),
    label: String(rawAddress?.label ?? 'Delivery address'),
    recipientName: String(rawAddress?.recipientName ?? data.customerName ?? ''),
    phoneNumber: String(rawAddress?.phoneNumber ?? data.customerPhone ?? ''),
    streetAddress: String(rawAddress?.streetAddress ?? ''),
    locality: String(rawAddress?.locality ?? ''),
    landmark: rawAddress?.landmark,
    city: String(rawAddress?.city ?? ''),
    pincode: String(rawAddress?.pincode ?? ''),
    coordinates: rawAddress?.coordinates,
    mapsLink: rawAddress?.mapsLink,
    isDefault: Boolean(rawAddress?.isDefault),
  };
  const rawDelivery = data.delivery as Partial<Order['delivery']> | undefined;
  const rawShopAddress = data.shopAddress;
  const shopAddress = typeof rawShopAddress === 'string'
    ? rawShopAddress
    : rawShopAddress && typeof rawShopAddress === 'object'
      ? Object.values(rawShopAddress as Record<string, unknown>).filter(Boolean).join(', ')
      : '';
  const subtotal = Number(data.subtotal ?? data.itemTotal ?? items.reduce((sum, item) => sum + item.subtotal, 0));
  const gstBreakup = data.gstBreakup as { totalTax?: number } | undefined;

  return {
    id,
    orderNumber: String(data.orderNumber ?? id),
    customerId: String(data.customerId ?? ''),
    customerName: String(data.customerName ?? 'Customer'),
    customerPhone: String(data.customerPhone ?? ''),
    shopId,
    shopName,
    shopAddress,
    shopPhone,
    deliveryAddress,
    items,
    itemCount: Number(data.itemCount ?? items.reduce((sum, item) => sum + item.quantity, 0)),
    subtotal,
    deliveryCharge: Number(data.deliveryCharge ?? 0),
    gstTotal: Number(data.gstTotal ?? gstBreakup?.totalTax ?? items.reduce((sum, item) => sum + item.gstAmount, 0)),
    platformCommission: Number(data.platformCommission ?? 0),
    totalAmount: Number(data.totalAmount ?? 0),
    status: (data.status as Order['status']) ?? 'pending_confirmation',
    paymentMethod: (data.paymentMethod as PaymentMethod) ?? 'cash_on_delivery',
    paymentStatus: (data.paymentStatus as Order['paymentStatus']) ?? 'pending',
    statusHistory: Array.isArray(data.statusHistory) ? data.statusHistory as Order['statusHistory'] : [],
    delivery: {
      orderId: String(rawDelivery?.orderId ?? id),
      shopId: String(rawDelivery?.shopId ?? shopId),
      deliveryAgentName: String(rawDelivery?.deliveryAgentName ?? `${shopName} Staff`),
      deliveryAgentPhone: String(rawDelivery?.deliveryAgentPhone ?? shopPhone),
      assignedAt: String(rawDelivery?.assignedAt ?? createdAt),
      dispatchedAt: rawDelivery?.dispatchedAt,
      deliveredAt: rawDelivery?.deliveredAt,
      otpCode: String(rawDelivery?.otpCode ?? data.verificationOTP ?? ''),
      otpVerified: Boolean(rawDelivery?.otpVerified),
      notes: rawDelivery?.notes,
    },
    invoice: data.invoice as Order['invoice'],
    externalBillPilotOrderId: data.externalBillPilotOrderId as string | undefined,
    estimatedDeliveryTime: String(data.estimatedDeliveryTime ?? ''),
    createdAt,
    updatedAt: String(data.updatedAt ?? createdAt),
  };
}

export function subscribeToOrders(
  customerId: string,
  shopId?: string,
  onShopSyncError?: (error: Error) => void
): Unsubscribe {
  if (!isFirebaseConfigured || !customerId) return () => {};

  const unsubscribers: Unsubscribe[] = [];
  const ordersRef = collection(db, 'orders');
  const subscribe = (
    filters: { customerId?: string; shopId?: string },
    onError?: (error: Error) => void
  ) => {
    const [field, value] = filters.shopId
      ? ['shopId', filters.shopId]
      : ['customerId', filters.customerId!];
    const ordersQuery = query(ordersRef, where(field, '==', value));
    unsubscribers.push(onSnapshot(
      ordersQuery,
      (snapshot) => {
        const orders = snapshot.docs
          .map((orderDoc) => orderFromFirestore(
            orderDoc.id,
            orderDoc.data() as Record<string, unknown>
          ))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        dbStore.syncOrdersFromFirestore(orders, filters);
      },
      (error) => {
        console.error('Firestore order sync failed:', error);
        onError?.(error);
      }
    ));
  };

  try {
    subscribe({ customerId });
    if (shopId && shopId !== customerId) subscribe({ shopId }, onShopSyncError);
  } catch (error) {
    unsubscribers.forEach((unsubscribe) => unsubscribe());
    console.error('Firestore order sync could not start:', error);
    return () => {};
  }

  return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
}

export async function transitionFirestoreOrderStatus(
  orderId: string,
  targetStatus: OrderStatus,
  actorId: string,
  actorRole: UserRole,
  options: { reason?: string; note?: string; otp?: string } = {}
): Promise<Order> {
  if (!isFirebaseConfigured) {
    throw new Error('Order status updates require marketplace cloud sync.');
  }

  const orderRef = doc(db, 'orders', orderId);
  const orderSnapshot = await getDoc(orderRef);
  if (!orderSnapshot.exists()) throw new Error('Order not found in marketplace cloud storage.');

  const order = orderFromFirestore(
    orderSnapshot.id,
    orderSnapshot.data() as Record<string, unknown>
  );
  const transition = canTransitionOrder(order.status, targetStatus, actorRole);
  if (!transition.allowed) {
    throw new Error(transition.error || 'This order status change is not allowed.');
  }
  if (actorRole === 'customer' && order.customerId !== actorId) {
    throw new Error('You can only update your own order.');
  }
  if (actorRole === 'shopkeeper' && !order.shopId) {
    throw new Error('This order is not linked to a marketplace shop.');
  }
  if (targetStatus === 'delivered' && actorRole === 'shopkeeper' &&
      (!options.otp || order.delivery.otpCode !== options.otp.trim())) {
    throw new Error('Invalid delivery OTP. Ask the customer to confirm the code.');
  }

  const now = new Date().toISOString();
  const statusHistory = [
    ...order.statusHistory,
    {
      status: targetStatus,
      timestamp: now,
      actorId,
      actorRole,
      reason: options.reason,
      note: options.note,
    },
  ];
  const updates: Record<string, unknown> = {
    status: targetStatus,
    statusHistory,
    updatedAt: now,
  };
  let updatedOrder: Order = { ...order, status: targetStatus, statusHistory, updatedAt: now };

  if (targetStatus === 'accepted') {
    const invoice = {
      id: `inv_${Date.now()}`,
      orderId: order.id,
      invoiceNumber: generateInvoiceNumber(),
      billPilotInvoiceId: `BP-INV-${Math.floor(10000 + Math.random() * 90000)}`,
      subtotal: order.subtotal,
      deliveryCharge: order.deliveryCharge,
      gstTotal: order.gstTotal,
      grandTotal: order.totalAmount,
      platformFee: order.platformCommission,
      issuedAt: now,
    };
    updates.invoice = invoice;
    updatedOrder = { ...updatedOrder, invoice };
  }

  if (targetStatus === 'out_for_delivery') {
    const delivery = { ...order.delivery, dispatchedAt: now };
    updates.delivery = delivery;
    updatedOrder = { ...updatedOrder, delivery };
  }

  if (targetStatus === 'delivered') {
    const delivery = { ...order.delivery, deliveredAt: now, otpVerified: true };
    updates.delivery = delivery;
    updatedOrder = { ...updatedOrder, delivery };
    if (order.paymentMethod === 'cash_on_delivery') {
      updates.paymentStatus = 'completed';
      updatedOrder = { ...updatedOrder, paymentStatus: 'completed' };
    }
  }

  if (actorRole === 'shopkeeper' &&
      (targetStatus === 'cancelled' || targetStatus === 'rejected') &&
      order.paymentStatus === 'authorized') {
    updates.paymentStatus = 'refunded';
    updatedOrder = { ...updatedOrder, paymentStatus: 'refunded' };
  }

  if (actorRole === 'shopkeeper' &&
      (targetStatus === 'cancelled' || targetStatus === 'rejected')) {
    const restoredQuantities = new Map<string, number>();
    order.items.forEach((item) => {
      restoredQuantities.set(
        item.productId,
        (restoredQuantities.get(item.productId) || 0) + item.quantity
      );
    });
    const productEntries = Array.from(restoredQuantities, ([productId, quantity]) => ({
      ref: doc(db, 'products', productId),
      quantity,
    }));
    await runTransaction(db, async (transaction) => {
      const currentOrderSnapshot = await transaction.get(orderRef);
      if (!currentOrderSnapshot.exists() ||
          currentOrderSnapshot.data().status !== order.status) {
        throw new Error('This order changed. Refresh and try again.');
      }
      const currentProducts = await Promise.all(
        productEntries.map(({ ref }) => transaction.get(ref))
      );
      transaction.update(orderRef, updates);
      currentProducts.forEach((productSnapshot, index) => {
        if (!productSnapshot.exists()) return;
        const productData = productSnapshot.data();
        const newStock = Number(productData.stockQuantity ?? 0) + productEntries[index].quantity;
        transaction.update(productEntries[index].ref, {
          stockQuantity: newStock,
          isAvailable: newStock > 0,
          updatedAt: now,
        });
      });
    });
  } else {
    await updateDoc(orderRef, updates);
  }

  dbStore.addExternalOrder(updatedOrder);
  return updatedOrder;
}

export async function processAtomicOrder(input: PlaceOrderInput): Promise<OrderPlacementResult> {
  if (!input.items || input.items.length === 0) {
    throw new Error('Cannot place an empty order.');
  }
  if (!isFirebaseConfigured) {
    throw new Error('Online ordering is unavailable because marketplace cloud sync is not configured.');
  }

  // 1. If Firebase is configured and online, execute atomic Firestore transaction
  if (isFirebaseConfigured && db) {
    try {
      const orderNumber = generateOrderNumber();
      const deliveryOTP = generateDeliveryOTP();
      const orderId = 'ord_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);

      const orderRef = doc(db, 'orders', orderId);
      const shopRef = doc(db, 'shops', input.shopId);

      const placedOrder = await runTransaction(db, async (txn) => {
        // A. Read shop document
        const shopSnap = await txn.get(shopRef);
        if (!shopSnap.exists()) {
          throw new Error('Merchant shop does not exist or has been removed.');
        }
        const shopData = shopSnap.data();
        if (shopData.deliverySettings && shopData.deliverySettings.isAcceptingOrders === false) {
          throw new Error('This shop is currently not accepting new orders.');
        }
        const shopCoordinates = shopData.address?.coordinates;
        const customerCoordinates = input.deliveryAddress.coordinates;
        if (!shopCoordinates) {
          throw new Error('This shop must add its location before accepting online orders.');
        }
        if (!customerCoordinates) {
          throw new Error('Select a delivery address with a map location to check the 10 km delivery limit.');
        }
        const distanceKm = calculateHaversineDistanceKm(
          Number(shopCoordinates.latitude),
          Number(shopCoordinates.longitude),
          customerCoordinates.latitude,
          customerCoordinates.longitude
        );
        const allowedRadiusKm = Math.min(
          Number(shopData.deliverySettings?.serviceRadiusKm) || 10,
          10
        );
        if (distanceKm > allowedRadiusKm) {
          throw new Error(
            `This address is ${distanceKm.toFixed(1)} km from ${shopData.name || 'the shop'}. Delivery is available only within ${allowedRadiusKm} km.`
          );
        }

        // B. Read all product documents to lock and validate price + stock
        const productRefs = input.items.map((item) =>
          doc(db, 'products', item.productId || item.listingId)
        );
        const productSnaps = await Promise.all(productRefs.map((ref) => txn.get(ref)));

        let calculatedSubtotalPaise = 0;
        let calculatedGstPaise = 0;
        const itemSnapshots: OrderItemSnapshot[] = [];

        for (let i = 0; i < input.items.length; i++) {
          const item = input.items[i];
          const snap = productSnaps[i];

          if (!snap.exists()) {
            throw new Error(`Product ${item.productId} is no longer available.`);
          }

          const pData = snap.data();
          const currentStock = Number(pData.stockQuantity ?? 0);

          if (currentStock < item.quantity) {
            throw new Error(
              `Insufficient stock for "${pData.name}". Available: ${currentStock}, requested: ${item.quantity}.`
            );
          }

          // Authoritative price directly from database
          const authoritativeUnitPrice: MinorUnits = Number(pData.shopPrice || 0);
          const lineTotal = authoritativeUnitPrice * item.quantity;
          calculatedSubtotalPaise += lineTotal;

          const gstRate = Number(pData.standardGSTRate ?? 5);
          const lineGst = Math.round((lineTotal * gstRate) / (100 + gstRate));
          calculatedGstPaise += lineGst;

          itemSnapshots.push({
            id: 'item_' + (i + 1),
            productId: snap.id,
            productName: pData.name || 'Product',
            unit: pData.unit || '1 unit',
            unitPrice: authoritativeUnitPrice,
            quantity: item.quantity,
            subtotal: lineTotal,
            gstRate,
            gstAmount: lineGst,
            imageUrl: pData.imageUrl || '',
          });

          // C. Atomic Stock Deduction
          const newStock = currentStock - item.quantity;
          txn.update(productRefs[i], {
            stockQuantity: newStock,
            isAvailable: newStock > 0,
            updatedAt: new Date().toISOString(),
          });
        }

        // Delivery fee calculation
        const baseDelivery = shopData.deliverySettings?.baseDeliveryCharge ?? 3000;
        const freeDeliveryThreshold = shopData.deliverySettings?.freeDeliveryThreshold ?? 50000;
        const deliveryCharge =
          calculatedSubtotalPaise >= freeDeliveryThreshold ? 0 : baseDelivery;
        const packingCharge = 0;
        const finalGrandTotal = calculatedSubtotalPaise + deliveryCharge + packingCharge;
        const shopAddress = shopData.address;

        const orderRecord: Order = {
          id: orderId,
          orderNumber,
          customerId: input.customerId,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          shopId: input.shopId,
          shopName: shopData.name || 'Neighborhood Store',
          shopPhone: shopData.phone || '',
          shopAddress: typeof shopAddress === 'string'
            ? shopAddress
            : [shopAddress?.street, shopAddress?.locality, shopAddress?.city, shopAddress?.pincode]
                .filter(Boolean)
                .join(', '),
          deliveryAddress: input.deliveryAddress,
          items: itemSnapshots,
          itemCount: itemSnapshots.reduce((sum, item) => sum + item.quantity, 0),
          subtotal: calculatedSubtotalPaise,
          deliveryCharge,
          gstTotal: calculatedGstPaise,
          platformCommission: Math.round((calculatedSubtotalPaise * 5) / 100),
          totalAmount: finalGrandTotal,
          status: 'pending_confirmation',
          paymentMethod: input.paymentMethod,
          paymentStatus: input.paymentMethod === 'cash_on_delivery' ? 'pending' : 'authorized',
          statusHistory: [
            {
              status: 'pending_confirmation',
              timestamp: new Date().toISOString(),
              actorId: input.customerId,
              actorRole: 'customer',
              note: 'Order placed by customer via NearBasket marketplace checkout.',
            },
          ],
          delivery: {
            orderId,
            shopId: input.shopId,
            deliveryAgentName: `${shopData.name || 'Neighborhood Store'} Staff`,
            deliveryAgentPhone: shopData.phone || '',
            assignedAt: new Date().toISOString(),
            otpCode: deliveryOTP,
            otpVerified: false,
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          estimatedDeliveryTime: new Date(Date.now() + 35 * 60 * 1000).toISOString(),
        };

        // D. Create authoritative order document
        txn.set(orderRef, orderRecord);

        return orderRecord;
      });

      // Mirror to local DB store for instantaneous responsive UI & offline query
      try {
        dbStore.addExternalOrder(placedOrder);
      } catch {
        // Local mirror error non-fatal
      }

      return {
        success: true,
        order: placedOrder,
        transactionId: orderId,
      };
    } catch (firestoreErr) {
      console.error('Firestore order placement failed:', firestoreErr);
      throw firestoreErr instanceof Error
        ? firestoreErr
        : new Error('Could not place the order in the marketplace. Please try again.');
    }
  }

  throw new Error('Marketplace cloud sync is unavailable. Please check your connection and try again.');
}
