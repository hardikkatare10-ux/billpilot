import type { Order } from '../marketplace/types';
import { normalizeOrderStatus, normalizePaymentStatus } from '../marketplace/utils/orderNormalization';

export type MarketplaceDatePreset = 'today' | 'yesterday' | 'week' | 'month' | 'custom';
export interface MarketplaceDateRange { start: string; end: string }
export interface MarketplaceSalesSummary {
  orders: Order[];
  totalOrders: number;
  archivedOrders: number;
  totalOrderValue: number;
  completedOrders: number;
  completedSales: number;
  pendingOrders: number;
  pendingOrderValue: number;
  pendingFulfillmentAmount: number;
  processingOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  cancelledOrderValue: number;
  refunds: number;
  unquantifiedRefunds: number;
  netMarketplaceSales: number;
  recordedCommission: number;
  shopkeeperNetAfterCommission: number;
}

export const localDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;

export function resolveMarketplaceDateRange(preset: MarketplaceDatePreset, now = new Date(), custom: MarketplaceDateRange = { start: '', end: '' }): MarketplaceDateRange {
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDate = new Date(endDate);
  if (preset === 'yesterday') startDate.setDate(startDate.getDate()-1);
  else if (preset === 'week') {
    const mondayOffset = (startDate.getDay()+6)%7;
    startDate.setDate(startDate.getDate()-mondayOffset);
  } else if (preset === 'month') startDate.setDate(1);
  else if (preset === 'custom') return { start: custom.start, end: custom.end };
  if (preset === 'yesterday') endDate.setDate(endDate.getDate()-1);
  return { start: localDateKey(startDate), end: localDateKey(endDate) };
}

export type MarketplaceFulfillmentBucket = 'pending'|'processing'|'delivered'|'cancelled'|'refunded'|'other'|'archived';
export function getMarketplaceFulfillmentBucket(order: Order): MarketplaceFulfillmentBucket {
  if (order.shopArchived) return 'archived';
  const status = normalizeOrderStatus(order.status);
  if (['pending_confirmation','cancellation_requested','out_for_delivery'].includes(status)) return 'pending';
  if (['accepted','preparing','ready_for_dispatch'].includes(status)) return 'processing';
  if (status === 'delivered') return 'delivered';
  if (status === 'cancelled'||status === 'rejected') return 'cancelled';
  if (status === 'refunded'||status === 'refund_pending') return 'refunded';
  return 'other';
}
const isCancelled = (order: Order) => ['cancelled','rejected'].includes(normalizeOrderStatus(order.status));
const isDeliveredHistory = (order: Order) => normalizeOrderStatus(order.status) === 'delivered' || order.statusHistory?.some(entry => normalizeOrderStatus(entry.status) === 'delivered');
const isPaidCompletedSale = (order: Order) => !isCancelled(order) && isDeliveredHistory(order) && (
  normalizePaymentStatus(order.paymentStatus) === 'completed' ||
  (normalizePaymentStatus(order.paymentStatus) === 'refunded' && typeof order.refundAmount === 'number')
);
const isActiveFulfillment = (order: Order) => !order.shopArchived && ['pending','processing'].includes(getMarketplaceFulfillmentBucket(order));
const asRupees = (minorUnits: number) => Number(minorUnits || 0) / 100;

export function calculateMarketplaceSalesSummary(orders: Order[], shopId: string, range: MarketplaceDateRange): MarketplaceSalesSummary {
  const uniqueOrders = new Map<string, Order>();
  for (const order of orders) {
    if (order.shopId !== shopId || uniqueOrders.has(order.id)) continue;
    const orderDate = localDateKey(new Date(order.createdAt));
    if (range.start && orderDate < range.start) continue;
    if (range.end && orderDate > range.end) continue;
    uniqueOrders.set(order.id, order);
  }
  const allInRange = [...uniqueOrders.values()];
  const archivedOrders = allInRange.filter(order => order.shopArchived).length;
  // Deleted-from-marketplace orders stay in Firestore for audit and customer
  // history, but disappear immediately from local order and sales views.
  const filtered = allInRange.filter(order => !order.shopArchived);
  const paidCompleted = filtered.filter(isPaidCompletedSale);
  const completedSales = paidCompleted.reduce((sum, order) => sum+asRupees(order.totalAmount), 0);
  const refundedOrders = filtered.filter(order => normalizeOrderStatus(order.status) === 'refunded' && normalizePaymentStatus(order.paymentStatus) === 'refunded' && isDeliveredHistory(order));
  const quantifiedRefunds = refundedOrders.filter(order => typeof order.refundAmount === 'number');
  const refunds = quantifiedRefunds.reduce((sum, order) => sum+asRupees(order.refundAmount!), 0);
  const nonRefundedPaid = paidCompleted.filter(order => !refundedOrders.some(refunded => refunded.id===order.id));
  const recordedCommission = nonRefundedPaid.reduce((sum, order) => sum+asRupees(order.platformCommission), 0);
  const pending = filtered.filter(isActiveFulfillment);
  const cancelled = filtered.filter(isCancelled);
  return {
    orders: filtered,
    totalOrders: filtered.length,
    archivedOrders,
    totalOrderValue: filtered.reduce((sum, order) => sum+asRupees(order.totalAmount), 0),
    completedOrders: paidCompleted.length,
    completedSales,
    pendingOrders: pending.length,
    pendingOrderValue: pending.reduce((sum, order) => sum+asRupees(order.totalAmount), 0),
    pendingFulfillmentAmount: pending.reduce((sum, order) => sum+asRupees(order.totalAmount), 0),
    processingOrders: filtered.filter(order=>getMarketplaceFulfillmentBucket(order)==='processing').length,
    deliveredOrders: filtered.filter(order => getMarketplaceFulfillmentBucket(order) === 'delivered').length,
    cancelledOrders: cancelled.length,
    cancelledOrderValue: cancelled.reduce((sum, order) => sum+asRupees(order.totalAmount), 0),
    refunds,
    unquantifiedRefunds: refundedOrders.length-quantifiedRefunds.length,
    netMarketplaceSales: Math.max(0, completedSales-refunds),
    recordedCommission,
    shopkeeperNetAfterCommission: Math.max(0, completedSales-refunds-recordedCommission),
  };
}
