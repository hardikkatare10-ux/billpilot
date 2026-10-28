/**
 * NearBasket - GST Tax Invoice Modal
 * 
 * Generates an authentic, printable GST tax invoice with line items,
 * tax rate breakdown, Dukan Yantra ERP invoice ID, and seller credentials.
 */

import React from 'react';
import { X, Printer, CheckCircle } from 'lucide-react';
import { Order } from '../../types';
import { formatINR } from '../../utils/formatters';

interface InvoiceModalProps {
  order: Order;
  onClose: () => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({ order, onClose }) => {
  const invoice = order.invoice;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 print:hidden">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800 text-sm">Tax Invoice & Cash Receipt</span>
            <span className="text-xs text-slate-500">· {order.orderNumber}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print Receipt
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/50 transition-colors cursor-pointer"
              aria-label="Close invoice"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Invoice Printable Body */}
        <div className="p-8 text-slate-800 space-y-6 text-sm">
          {/* Header Row */}
          <div className="flex justify-between items-start border-b border-slate-200 pb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{order.shopName}</h2>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">{order.shopAddress}</p>
              <p className="text-xs text-slate-500 mt-0.5">Phone: {order.shopPhone}</p>
              <p className="text-xs text-slate-500 mt-0.5">GSTIN: 29ABCDE1234F1Z5</p>
            </div>
            <div className="text-right">
              <span className="inline-block px-2.5 py-0.5 bg-blue-50 text-blue-700 font-mono text-xs font-semibold rounded">
                TAX INVOICE
              </span>
              <p className="font-mono text-xs font-semibold text-slate-700 mt-2">
                {invoice?.invoiceNumber || 'INV-DRAFT'}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Date: {new Date(order.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
              {invoice?.billPilotInvoiceId && (
                <p className="text-xs text-slate-600 mt-1 font-mono">
                  ERP Ref: {invoice.billPilotInvoiceId}
                </p>
              )}
            </div>
          </div>

          {/* Customer & Delivery Details */}
          <div className="grid grid-cols-2 gap-6 bg-slate-50/70 p-4 rounded-lg border border-slate-100">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Billed & Delivered To</p>
              <p className="text-sm font-semibold text-slate-900 mt-1">{order.customerName}</p>
              <p className="text-xs text-slate-600 mt-0.5">{order.deliveryAddress.streetAddress}</p>
              <p className="text-xs text-slate-600">
                {order.deliveryAddress.locality}, {order.deliveryAddress.city} - {order.deliveryAddress.pincode}
              </p>
              <p className="text-xs text-slate-600 mt-0.5">Phone: {order.customerPhone}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Order & Fulfillment</p>
              <p className="text-xs text-slate-700 mt-1">Order Ref: <span className="font-semibold">{order.orderNumber}</span></p>
              <p className="text-xs text-slate-700 mt-0.5">Payment Method: <span className="font-semibold capitalize">{order.paymentMethod.replace(/_/g, ' ')}</span></p>
              <p className="text-xs text-slate-700 mt-0.5">Payment Status: <span className="font-semibold uppercase text-emerald-700">{order.paymentStatus}</span></p>
              <p className="text-xs text-slate-700 mt-0.5">Delivered By: <span className="font-semibold">{order.delivery.deliveryAgentName}</span></p>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/75 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Item Description</th>
                  <th className="py-2.5 px-3 text-right">Qty</th>
                  <th className="py-2.5 px-3 text-right">Unit Price</th>
                  <th className="py-2.5 px-3 text-right">GST Rate</th>
                  <th className="py-2.5 px-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {order.items.map((item, idx) => (
                  <tr key={item.id} className="text-slate-700">
                    <td className="py-2.5 px-3 text-slate-400 font-mono">{idx + 1}</td>
                    <td className="py-2.5 px-3">
                      <p className="font-medium text-slate-900">{item.productName}</p>
                      <p className="text-[11px] text-slate-500">Unit: {item.unit}</p>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">{item.quantity}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">{formatINR(item.unitPrice)}</td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums">{item.gstRate}%</td>
                    <td className="py-2.5 px-3 text-right font-medium text-slate-900 font-mono tabular-nums">
                      {formatINR(item.subtotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Calculation */}
          <div className="flex justify-end pt-2">
            <div className="w-64 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Items Subtotal:</span>
                <span className="font-mono tabular-nums">{formatINR(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Delivery Charge:</span>
                <span className="font-mono tabular-nums">
                  {order.deliveryCharge === 0 ? 'FREE' : formatINR(order.deliveryCharge)}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>GST (Taxes Included):</span>
                <span className="font-mono tabular-nums">{formatINR(order.gstTotal)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold text-slate-900">
                <span>Grand Total:</span>
                <span className="font-mono tabular-nums">{formatINR(order.totalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Footer Notes */}
          <div className="border-t border-slate-100 pt-4 flex items-center justify-between text-xs text-slate-500">
            <div className="flex items-center gap-1.5 text-emerald-700">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Verified Delivery via OTP Handshake</span>
            </div>
            <span>Powered by NearBasket Marketplace</span>
          </div>
        </div>
      </div>
    </div>
  );
};
