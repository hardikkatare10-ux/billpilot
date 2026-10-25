/**
 * BillPilot Local - Order Tracking Component
 * 
 * Displays authenticated live order timeline, delivery verification OTP,
 * direct shop contact, and invoice generation.
 */

import React, { useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  FileText,
  AlertCircle,
  KeyRound,
  Package,
} from 'lucide-react';
import { Order, OrderStatus } from '../../types';
import { formatINR } from '../../utils/formatters';
import { InvoiceModal } from '../common/InvoiceModal';
import { transitionFirestoreOrderStatus } from '../../services/firebase/orderService';

interface OrderTrackingProps {
  order: Order;
  onBack: () => void;
  onOrderUpdated: () => void;
  onOpenDispute: (order: Order) => void;
}

const ORDER_STAGES: { status: OrderStatus; label: string; description: string }[] = [
  {
    status: 'pending_confirmation',
    label: 'Order Placed',
    description: 'Awaiting shopkeeper review',
  },
  {
    status: 'accepted',
    label: 'Accepted',
    description: 'Inventory locked by shop',
  },
  {
    status: 'preparing',
    label: 'Preparing',
    description: 'Shop staff packaging items',
  },
  {
    status: 'out_for_delivery',
    label: 'Out for Delivery',
    description: 'Staff en route to doorstep',
  },
  {
    status: 'delivered',
    label: 'Delivered',
    description: 'Completed with OTP handshake',
  },
];

export const OrderTracking: React.FC<OrderTrackingProps> = ({
  order,
  onBack,
  onOrderUpdated,
  onOpenDispute,
}) => {
  const [showInvoice, setShowInvoice] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const getStageIndex = (status: OrderStatus): number => {
    switch (status) {
      case 'pending_confirmation':
        return 0;
      case 'accepted':
        return 1;
      case 'preparing':
      case 'ready_for_dispatch':
        return 2;
      case 'out_for_delivery':
        return 3;
      case 'delivered':
        return 4;
      default:
        return 0;
    }
  };

  const currentStageIdx = getStageIndex(order.status);
  const isCancelled = order.status === 'cancelled' || order.status === 'rejected';

  const handleCancelOrder = async () => {
    setIsCancelling(true);
    try {
      await transitionFirestoreOrderStatus(
        order.id,
        'cancelled',
        order.customerId,
        'customer',
        { reason: 'Customer requested cancellation prior to shop acceptance' }
      );
      onOrderUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not cancel order.';
      setActionError(msg);
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      {/* Back button */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to my orders
      </button>

      {/* Main Order Status Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                Order #{order.orderNumber}
              </span>
              <span className="text-slate-300">·</span>
              <span className="text-xs text-slate-500">
                {new Date(order.createdAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 mt-1">
              Fulfillment Status: <span className="capitalize">{order.status.replace(/_/g, ' ')}</span>
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {order.invoice && (
              <button
                onClick={() => setShowInvoice(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                Tax Invoice
              </button>
            )}

            {order.status === 'delivered' && (
              <button
                onClick={() => onOpenDispute(order)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
              >
                <AlertCircle className="w-3.5 h-3.5" />
                Report Issue / Return
              </button>
            )}

            {order.status === 'pending_confirmation' && (
              <button
                onClick={handleCancelOrder}
                disabled={isCancelling}
                className="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              >
                {isCancelling ? 'Cancelling...' : 'Cancel Order'}
              </button>
            )}
          </div>
        </div>

        {actionError && (
          <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
            {actionError}
          </p>
        )}

        {/* Delivery OTP Card (Prominent Trust Mechanism) */}
        {!isCancelled && order.status !== 'delivered' && (
          <div className="p-4 bg-blue-50/80 border border-blue-200/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
                <KeyRound className="w-4 h-4 text-blue-600" />
                <span>Doorstep Delivery Verification OTP</span>
              </div>
              <p className="text-[11px] text-blue-700">
                Share this secure code with the delivery partner upon arrival to confirm receipt.
              </p>
            </div>
            <div className="bg-white px-4 py-2 rounded-lg border border-blue-200 shadow-xs text-center shrink-0">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest block">
                YOUR OTP
              </span>
              <span className="font-mono text-2xl font-black text-blue-700 tracking-wider">
                {order.delivery.otpCode}
              </span>
            </div>
          </div>
        )}

        {/* Timeline Stepper */}
        {!isCancelled ? (
          <div className="pt-2">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {ORDER_STAGES.map((stage, idx) => {
                const isPassed = idx <= currentStageIdx;
                const isCurrent = idx === currentStageIdx;

                return (
                  <div
                    key={stage.status}
                    className={`p-3 rounded-xl border text-xs transition-all ${
                      isCurrent
                        ? 'border-blue-600 bg-blue-50/40 ring-1 ring-blue-600'
                        : isPassed
                        ? 'border-slate-200 bg-slate-50 text-slate-700'
                        : 'border-slate-100 bg-white text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      {isPassed ? (
                        <CheckCircle2
                          className={`w-3.5 h-3.5 ${
                            isCurrent ? 'text-blue-600' : 'text-emerald-600'
                          }`}
                        />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-slate-300" />
                      )}
                      <span className="font-bold">{stage.label}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-tight">
                      {stage.description}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
            <p className="font-bold">Order Cancelled or Rejected</p>
            <p className="mt-1">
              This order was cancelled. Reserved items have been released back to shop inventory.
            </p>
          </div>
        )}
      </div>

      {/* Shop & Delivery Person Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
          <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-blue-600" />
            Shop Information
          </span>
          <div>
            <h3 className="font-bold text-slate-900 text-sm">{order.shopName}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{order.shopAddress}</p>
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-xs text-slate-700">
            <Phone className="w-3.5 h-3.5 text-slate-400" />
            <span>Store Contact: {order.shopPhone}</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
          <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-blue-600" />
            Delivering To
          </span>
          <div>
            <p className="font-bold text-slate-900 text-sm">{order.customerName}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {order.deliveryAddress.streetAddress}, {order.deliveryAddress.locality} -{' '}
              {order.deliveryAddress.pincode}
            </p>
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-xs text-slate-700">
            <Phone className="w-3.5 h-3.5 text-slate-400" />
            <span>Phone: {order.customerPhone}</span>
          </div>
        </div>
      </div>

      {/* Itemized Order Snapshot */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
          Ordered Items ({order.itemCount})
        </span>

        <div className="divide-y divide-slate-100">
          {order.items.map((item) => (
            <div key={item.id} className="py-2.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <img
                  src={item.imageUrl}
                  alt={item.productName}
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 object-cover rounded-lg bg-slate-50"
                />
                <div>
                  <p className="font-bold text-slate-900">{item.productName}</p>
                  <p className="text-[11px] text-slate-500 font-tabular">
                    Qty: {item.quantity} · {formatINR(item.unitPrice)} each
                  </p>
                </div>
              </div>
              <span className="font-bold text-slate-900 font-tabular">
                {formatINR(item.subtotal)}
              </span>
            </div>
          ))}
        </div>

        {/* Pricing Summary */}
        <div className="border-t border-slate-100 pt-3 space-y-1.5 text-xs text-slate-600">
          <div className="flex justify-between">
            <span>Items Subtotal:</span>
            <span className="font-mono tabular-nums">{formatINR(order.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span>Delivery Fee:</span>
            <span className="font-mono tabular-nums">
              {order.deliveryCharge === 0 ? 'FREE' : formatINR(order.deliveryCharge)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>GST & Taxes (Included):</span>
            <span className="font-mono tabular-nums">{formatINR(order.gstTotal)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold text-slate-900">
            <span>Total Paid ({order.paymentMethod.replace(/_/g, ' ')}):</span>
            <span className="font-mono tabular-nums text-blue-600">
              {formatINR(order.totalAmount)}
            </span>
          </div>
        </div>
      </div>

      {/* Printable Invoice Modal */}
      {showInvoice && <InvoiceModal order={order} onClose={() => setShowInvoice(false)} />}
    </div>
  );
};
