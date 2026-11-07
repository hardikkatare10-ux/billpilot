import type { OrderStatus, PaymentStatus } from '../types';

export function canArchiveShopOrder(order: {
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  shopArchived?: boolean;
}): boolean {
  if (order.shopArchived) return false;
  if (
    order.status === 'rejected' ||
    order.status === 'cancelled' ||
    order.status === 'delivered' ||
    order.paymentStatus === 'completed'
  ) return true;
  return order.status === 'pending_confirmation' &&
    (order.paymentStatus === 'pending' || order.paymentStatus === 'failed');
}
