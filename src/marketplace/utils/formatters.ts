/**
 * NearBasket - Utility and Calculation Helpers
 * 
 * Strict integer minor unit math (no floating point errors for money)
 * and order state machine transition guards.
 */

import { MinorUnits, OrderStatus, UserRole } from '../types';

/**
 * Formats integer paise into clean Indian Rupee string
 * e.g. 14950 -> ₹149.50, 50000 -> ₹500.00
 */
export function formatINR(paise: MinorUnits): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: rupees % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}

/**
 * Calculates GST amount for an item in paise
 */
export function calculateGST(amountPaise: MinorUnits, gstRatePct: number): MinorUnits {
  return Math.round((amountPaise * gstRatePct) / 100);
}

/**
 * Generates unique readable order numbers (e.g., BPL-7392)
 */
export function generateOrderNumber(): string {
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `BPL-${randomNum}`;
}

/**
 * Generates 4-digit delivery verification OTP
 */
export function generateDeliveryOTP(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * Generates GST tax invoice numbers
 */
export function generateInvoiceNumber(): string {
  const year = new Date().getFullYear();
  const randomSerial = Math.floor(10000 + Math.random() * 90000);
  return `INV-${year}-${randomSerial}`;
}

/**
 * Validates Order State Transitions
 * Strict server/domain authoritative state machine enforcing legal progression
 */
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_confirmation: ['accepted', 'rejected', 'cancelled'],
  accepted: ['preparing', 'cancelled'],
  rejected: [],
  preparing: ['ready_for_dispatch', 'cancelled'],
  ready_for_dispatch: ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered', 'cancelled'],
  delivered: ['return_requested'],
  cancellation_requested: ['cancelled', 'accepted', 'preparing'],
  cancelled: [],
  return_requested: ['return_approved', 'return_rejected'],
  return_approved: ['refund_pending', 'replacement_in_progress'],
  return_rejected: ['resolved'],
  refund_pending: ['refunded'],
  refunded: ['resolved'],
  replacement_in_progress: ['delivered', 'resolved'],
  resolved: [],
};

export function canTransitionOrder(
  currentStatus: OrderStatus,
  targetStatus: OrderStatus,
  actorRole: UserRole | 'system'
): { allowed: boolean; error?: string } {
  const allowedNext = VALID_TRANSITIONS[currentStatus] || [];
  
  if (!allowedNext.includes(targetStatus)) {
    return {
      allowed: false,
      error: `Illegal state transition from "${currentStatus}" to "${targetStatus}".`,
    };
  }

  // Permission checks by role
  if (actorRole === 'customer') {
    // Customers can only request cancellation while pending/accepted, or request return after delivered
    if (targetStatus === 'cancelled' && currentStatus !== 'pending_confirmation') {
      return { allowed: false, error: 'Orders can only be cancelled directly prior to shop acceptance.' };
    }
    if (targetStatus === 'return_requested' && currentStatus !== 'delivered') {
      return { allowed: false, error: 'Return requests can only be filed on delivered orders.' };
    }
  }

  if (actorRole === 'shopkeeper') {
    // Shopkeepers cannot approve customer refunds directly (arbitrated or system approved)
    if (targetStatus === 'refunded') {
      return { allowed: false, error: 'Only administrative arbitration can process refunds.' };
    }
  }

  return { allowed: true };
}

/**
 * Calculates estimated delivery time string
 */
export function calculateETA(prepMinutes: number, deliveryMinutes: number): string {
  const totalMins = prepMinutes + deliveryMinutes;
  const deliveryTime = new Date(Date.now() + totalMins * 60 * 1000);
  return deliveryTime.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}
