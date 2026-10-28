/**
 * NearBasket - Customer Orders List View
 * 
 * Lists customer past and active orders with quick status badges,
 * tracking, invoices, and dispute resolution access.
 */

import React, { useState } from 'react';
import { Package, Clock, ArrowRight, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Order } from '../../types';
import { formatINR } from '../../utils/formatters';
import { InvoiceModal } from '../common/InvoiceModal';

interface CustomerOrdersProps {
  orders: Order[];
  onSelectOrder: (order: Order) => void;
  onOpenDispute: (order: Order) => void;
}

export const CustomerOrders: React.FC<CustomerOrdersProps> = ({
  orders,
  onSelectOrder,
  onOpenDispute,
}) => {
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState<Order | null>(null);

  const getStatusBadge = (status: Order['status']) => {
    switch (status) {
      case 'delivered':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md">
            <CheckCircle2 className="w-3 h-3" />
            Delivered
          </span>
        );
      case 'out_for_delivery':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-md">
            <Clock className="w-3 h-3" />
            Out for Delivery
          </span>
        );
      case 'preparing':
      case 'accepted':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-md">
            <Clock className="w-3 h-3" />
            Preparing
          </span>
        );
      case 'cancelled':
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-md">
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-md">
            {status.replace(/_/g, ' ')}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-20 max-w-4xl mx-auto">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-bold text-slate-900">Your Local Orders</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Track active deliveries, download tax invoices, and manage past purchases.
        </p>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
            <Package className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-800">No orders placed yet</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Discover verified neighborhood shops around your locality and enjoy direct doorstep delivery.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-all space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">
                      Order #{order.orderNumber}
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className="text-xs text-slate-500">
                      {new Date(order.createdAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-slate-900 mt-0.5">{order.shopName}</p>
                </div>
                <div>{getStatusBadge(order.status)}</div>
              </div>

              {/* Items Summary */}
              <div className="flex items-center justify-between text-xs">
                <div className="space-y-1">
                  <p className="text-slate-600 line-clamp-1">
                    {order.items.map((i) => `${i.productName} (${i.quantity})`).join(', ')}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Payment: <span className="capitalize">{order.paymentMethod.replace(/_/g, ' ')}</span>
                  </p>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <span className="text-xs text-slate-400 block">Total</span>
                  <span className="text-sm font-bold text-slate-900 font-tabular">
                    {formatINR(order.totalAmount)}
                  </span>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                <div className="flex items-center gap-2">
                  {order.invoice && (
                    <button
                      onClick={() => setSelectedInvoiceOrder(order)}
                      className="inline-flex items-center gap-1 text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 text-blue-600" />
                      Invoice
                    </button>
                  )}
                  {order.status === 'delivered' && (
                    <button
                      onClick={() => onOpenDispute(order)}
                      className="inline-flex items-center gap-1 text-slate-500 hover:text-rose-600 font-medium cursor-pointer ml-3"
                    >
                      <AlertCircle className="w-3.5 h-3.5" />
                      Help & Returns
                    </button>
                  )}
                </div>

                <button
                  onClick={() => onSelectOrder(order)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                >
                  <span>Track Fulfillment</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedInvoiceOrder && (
        <InvoiceModal
          order={selectedInvoiceOrder}
          onClose={() => setSelectedInvoiceOrder(null)}
        />
      )}
    </div>
  );
};
