import type { OrderStatus, PaymentStatus } from '../types';

const statusAliases: Record<string, OrderStatus> = {
  pending: 'pending_confirmation',
  pending_confirmation: 'pending_confirmation',
  accepted: 'accepted',
  processing: 'preparing',
  preparing: 'preparing',
  packed: 'ready_for_dispatch',
  ready_for_dispatch: 'ready_for_dispatch',
  dispatched: 'out_for_delivery',
  out_for_delivery: 'out_for_delivery',
  delivered: 'delivered',
  cancelled: 'cancelled',
  canceled: 'cancelled',
  rejected: 'rejected',
  cancellation_requested: 'cancellation_requested',
  return_requested: 'return_requested',
  return_approved: 'return_approved',
  return_rejected: 'return_rejected',
  refund_pending: 'refund_pending',
  refunded: 'refunded',
  replacement_in_progress: 'replacement_in_progress',
  resolved: 'resolved',
};

export function normalizeOrderStatus(value: unknown): OrderStatus {
  const normalized = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return statusAliases[normalized] || normalized as OrderStatus;
}

export function normalizePaymentStatus(value: unknown): PaymentStatus {
  const normalized = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (normalized === 'paid') return 'completed';
  if (normalized === 'unpaid') return 'pending';
  if (['pending', 'authorized', 'completed', 'failed', 'refunded'].includes(normalized)) return normalized as PaymentStatus;
  return 'pending';
}

export function normalizeFirestoreDate(value: unknown, fallback = new Date(0).toISOString()): string {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? fallback : value.toISOString();
  if (value && typeof value === 'object') {
    const candidate = value as { toDate?: () => Date; seconds?: number; _seconds?: number; nanoseconds?: number; _nanoseconds?: number };
    try {
      if (typeof candidate.toDate === 'function') {
        const date = candidate.toDate();
        return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString() : fallback;
      }
    } catch { return fallback; }
    const seconds = candidate.seconds ?? candidate._seconds;
    if (typeof seconds === 'number' && Number.isFinite(seconds)) {
      const nanos = candidate.nanoseconds ?? candidate._nanoseconds ?? 0;
      const date = new Date(seconds * 1000 + nanos / 1_000_000);
      return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
    }
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
  }
  return fallback;
}
