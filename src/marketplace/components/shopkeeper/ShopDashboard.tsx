/**
 * NearBasket - Shopkeeper Operations Dashboard
 * 
 * Order board for managing incoming orders, fulfillment progression,
 * and delivery OTP verification at doorstep handover.
 */

import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Truck,
  Clock,
  Package,
  Phone,
  KeyRound,
  FileText,
  AlertCircle,
  DollarSign,
  TrendingUp,
  Save,
} from 'lucide-react';
import { Order, Shop } from '../../types';
import { formatINR } from '../../utils/formatters';
import { transitionFirestoreOrderStatus } from '../../services/firebase/orderService';
import { updateFirestoreShopLocation } from '../../services/firebase/shopService';
import { MapLocationPicker, PickedLocation } from '../common/MapLocationPicker';
import { googleMapsUrl } from '../../utils/geo';
import { dbStore } from '../../services/db/store';
import { InvoiceModal } from '../common/InvoiceModal';

interface ShopDashboardProps {
  shop: Shop;
  orders: Order[];
  onRefreshOrders: () => void;
  viewMode?: 'dashboard' | 'orders';
}

export const ShopDashboard: React.FC<ShopDashboardProps> = ({
  shop,
  orders,
  onRefreshOrders,
  viewMode = 'dashboard',
}) => {
  const [shopLocation, setShopLocation] = useState<PickedLocation | null>(
    shop.address.coordinates
      ? { coordinates: shop.address.coordinates, mapsLink: googleMapsUrl(shop.address.coordinates) }
      : null
  );
  const [serviceRadiusKm, setServiceRadiusKm] = useState(
    String(Math.min(shop.deliverySettings.serviceRadiusKm || 10, 10))
  );
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isSavingLocation, setIsSavingLocation] = useState(false);
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState<Order | null>(null);
  const [rejectOrderId, setRejectOrderId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('Out of stock for selected item');
  const [otpVerifyOrderId, setOtpVerifyOrderId] = useState<string | null>(null);
  const [enteredOtp, setEnteredOtp] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isUpdatingOrder, setIsUpdatingOrder] = useState(false);

  const handleSaveShopLocation = async () => {
    if (!shopLocation) {
      setLocationError('Choose the exact shop location from Google Maps or current location.');
      return;
    }
    const requestedRadiusKm = Number(serviceRadiusKm);
    if (!Number.isFinite(requestedRadiusKm) || requestedRadiusKm <= 0) {
      setLocationError('Enter a delivery radius greater than 0 and no more than 10 km.');
      return;
    }
    setIsSavingLocation(true);
    setLocationError(null);
    try {
      const radiusKm = Math.min(requestedRadiusKm, 10);
      await updateFirestoreShopLocation(shop.id, shopLocation.coordinates, radiusKm);
      dbStore.updateShopLocation(shop.id, shopLocation.coordinates);
      dbStore.updateShopSettings(shop.id, { serviceRadiusKm: radiusKm }, shop.ownerId);
      onRefreshOrders();
    } catch (err: unknown) {
      setLocationError(err instanceof Error ? err.message : 'Could not save shop location.');
    } finally {
      setIsSavingLocation(false);
    }
  };

  // Shop Orders metrics
  const activeOrders = orders.filter(
    (o) => !['delivered', 'cancelled', 'rejected', 'resolved'].includes(o.status)
  );
  const deliveredOrders = orders.filter((o) => o.status === 'delivered');
  const totalSalesPaise = deliveredOrders.reduce((acc, o) => acc + o.totalAmount, 0);

  const handleAcceptOrder = async (orderId: string) => {
    setIsUpdatingOrder(true);
    try {
      await transitionFirestoreOrderStatus(
        orderId,
        'accepted',
        shop.ownerId,
        'shopkeeper',
        { note: 'Order accepted by shop staff.' }
      );
      onRefreshOrders();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not accept order.';
      setActionError(msg);
    } finally {
      setIsUpdatingOrder(false);
    }
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectOrderId) return;

    setIsUpdatingOrder(true);
    try {
      await transitionFirestoreOrderStatus(
        rejectOrderId,
        'rejected',
        shop.ownerId,
        'shopkeeper',
        { reason: rejectReason, note: 'Order rejected with reason.' }
      );
      setRejectOrderId(null);
      onRefreshOrders();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not reject order.';
      setActionError(msg);
    } finally {
      setIsUpdatingOrder(false);
    }
  };

  const handleAdvanceStatus = async (orderId: string, nextStatus: Order['status']) => {
    setIsUpdatingOrder(true);
    try {
      await transitionFirestoreOrderStatus(
        orderId,
        nextStatus,
        shop.ownerId,
        'shopkeeper',
        { note: `Progressed to ${nextStatus}` }
      );
      onRefreshOrders();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to advance status.';
      setActionError(msg);
    } finally {
      setIsUpdatingOrder(false);
    }
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpVerifyOrderId || !enteredOtp) return;

    setIsUpdatingOrder(true);
    transitionFirestoreOrderStatus(
      otpVerifyOrderId,
      'delivered',
      shop.ownerId,
      'shopkeeper',
      { otp: enteredOtp, note: 'Delivered with verified customer OTP.' }
    ).then(() => {
      setOtpVerifyOrderId(null);
      setEnteredOtp('');
      setOtpError(null);
      onRefreshOrders();
    }).catch((err: unknown) => {
      setOtpError(err instanceof Error ? err.message : 'Could not verify delivery OTP.');
    }).finally(() => setIsUpdatingOrder(false));
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header & Metric Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">{shop.name}</h1>
            <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 font-semibold rounded">
              {viewMode === 'orders' ? 'Order Fulfillment' : 'Store Dashboard'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {viewMode === 'orders'
              ? 'Review customer orders and update fulfillment status through delivery.'
              : 'Manage live orders, staff dispatches, and doorstep delivery OTP confirmations.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
              shop.deliverySettings.isAcceptingOrders
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-slate-200 text-slate-700'
            }`}
          >
            {shop.deliverySettings.isAcceptingOrders
              ? '● Store Online (Accepting Orders)'
              : '○ Store Offline'}
          </span>
        </div>
      </div>

      {viewMode === 'dashboard' && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <MapLocationPicker
          value={shopLocation}
          onChange={setShopLocation}
          label="Shop delivery location"
          helpText="Set the exact shop pin. Customers can order only from addresses within 10 km."
        />
        <label className="block max-w-xs space-y-1.5 text-xs font-medium text-slate-700">
          Maximum delivery radius (up to 10 km)
          <input
            type="number"
            min="0.1"
            max="10"
            step="0.1"
            value={serviceRadiusKm}
            onChange={(event) => setServiceRadiusKm(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        {locationError && (
          <p role="alert" className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2.5">
            {locationError}
          </p>
        )}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSaveShopLocation}
            disabled={isSavingLocation}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer disabled:opacity-60"
          >
            <Save className="w-3.5 h-3.5" />
            {isSavingLocation ? 'Saving location...' : 'Save shop location'}
          </button>
        </div>
        </div>
      )}

      {actionError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="font-bold cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Cards */}
      {viewMode === 'dashboard' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-500 block">Pending & Active</span>
              <span className="text-xl font-extrabold text-slate-900 font-tabular">
                {activeOrders.length}
              </span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-500 block">Delivered Orders</span>
              <span className="text-xl font-extrabold text-slate-900 font-tabular">
                {deliveredOrders.length}
              </span>
            </div>
          </div>

          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-500 block">Fulfilled Sales</span>
              <span className="text-xl font-extrabold text-slate-900 font-tabular">
                {formatINR(totalSalesPaise)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Live Orders Queue */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Package className="w-4 h-4 text-blue-600" />
            {viewMode === 'orders' ? 'Fulfillment Queue' : `Live Customer Orders (${orders.length})`}
          </h2>
          <span className="text-xs text-slate-500">Auto-refreshing storage</span>
        </div>

        {orders.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500 text-xs">
            No orders received yet today.
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const isPending = order.status === 'pending_confirmation';
              const isAccepted = order.status === 'accepted';
              const isPreparing = order.status === 'preparing';
              const isReady = order.status === 'ready_for_dispatch';
              const isDispatched = order.status === 'out_for_delivery';
              const isDelivered = order.status === 'delivered';
              const isClosed = ['delivered', 'cancelled', 'rejected', 'refunded'].includes(
                order.status
              );

              return (
                <div
                  key={order.id}
                  className={`bg-white rounded-xl border p-5 shadow-xs transition-all space-y-4 ${
                    isPending
                      ? 'border-blue-400 ring-2 ring-blue-100 bg-blue-50/20'
                      : 'border-slate-200'
                  }`}
                >
                  {/* Top Bar */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold text-slate-900 font-tabular">
                        Order #{order.orderNumber}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="text-xs text-slate-500">
                        {new Date(order.createdAt).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true,
                        })}
                      </span>
                      {order.invoice?.billPilotInvoiceId && (
                        <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                          ERP: {order.invoice.billPilotInvoiceId}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-md capitalize bg-slate-100 text-slate-800">
                        Status: {order.status.replace(/_/g, ' ')}
                      </span>
                      {order.invoice && (
                        <button
                          onClick={() => setSelectedInvoiceOrder(order)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 rounded transition-colors cursor-pointer"
                          title="View Tax Invoice"
                        >
                          <FileText className="w-4 h-4 text-blue-600" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Customer & Address Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <div>
                      <p className="font-bold text-slate-900">{order.customerName}</p>
                      <p className="text-slate-600 mt-0.5">{order.deliveryAddress.streetAddress}</p>
                      <p className="text-slate-600">
                        {order.deliveryAddress.locality}, {order.deliveryAddress.city} -{' '}
                        {order.deliveryAddress.pincode}
                      </p>
                      {order.deliveryAddress.coordinates && (
                        <a
                          href={`https://www.google.com/maps?q=${order.deliveryAddress.coordinates.latitude},${order.deliveryAddress.coordinates.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-block mt-1 text-blue-600 font-semibold underline"
                        >
                          Open customer location in Google Maps
                        </a>
                      )}
                      <p className="text-slate-500 flex items-center gap-1 mt-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        {order.customerPhone}
                      </p>
                    </div>

                    <div>
                      <p className="font-semibold text-slate-700">Payment & Delivery</p>
                      <p className="text-slate-600 mt-0.5">
                        Method: <strong className="capitalize">{order.paymentMethod.replace(/_/g, ' ')}</strong>
                      </p>
                      <p className="text-slate-600">
                        Total Value:{' '}
                        <strong className="text-slate-900 font-tabular">{formatINR(order.totalAmount)}</strong>
                      </p>
                      <p className="text-slate-500 text-[11px] mt-1">
                        Est. Delivery: {order.estimatedDeliveryTime}
                      </p>
                    </div>
                  </div>

                  {/* Ordered Items List */}
                  <div className="space-y-1.5 text-xs">
                    <p className="font-bold text-slate-800 uppercase text-[10px]">Items Snapshot</p>
                    <div className="divide-y divide-slate-100">
                      {order.items.map((i) => (
                        <div key={i.id} className="py-1.5 flex justify-between">
                          <span className="text-slate-700">
                            {i.quantity}x {i.productName} ({i.unit})
                          </span>
                          <span className="font-semibold text-slate-900 font-tabular">
                            {formatINR(i.subtotal)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Order Stage Controls */}
                  <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-slate-500">
                      {isDelivered && (
                        <span className="text-emerald-700 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Handover complete. OTP verified.
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {isPending && (
                        <>
                          <button
                            onClick={() => setRejectOrderId(order.id)}
                            disabled={isUpdatingOrder}
                            className="px-3 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => handleAcceptOrder(order.id)}
                            disabled={isUpdatingOrder}
                            className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Accept Order
                          </button>
                        </>
                      )}

                      {isAccepted && (
                        <button
                          onClick={() => handleAdvanceStatus(order.id, 'preparing')}
                          disabled={isUpdatingOrder}
                          className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        >
                          Mark as Preparing
                        </button>
                      )}

                      {isPreparing && (
                        <button
                          onClick={() => handleAdvanceStatus(order.id, 'ready_for_dispatch')}
                          disabled={isUpdatingOrder}
                          className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
                        >
                          Mark Ready for Dispatch
                        </button>
                      )}

                      {isReady && (
                        <button
                          onClick={() => handleAdvanceStatus(order.id, 'out_for_delivery')}
                          disabled={isUpdatingOrder}
                          className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          Dispatch With Shop Staff
                        </button>
                      )}

                      {isDispatched && (
                        <button
                          onClick={() => {
                            setOtpVerifyOrderId(order.id);
                            setOtpError(null);
                          }}
                          disabled={isUpdatingOrder}
                          className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          Confirm Delivery (Enter OTP)
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reject Order Modal */}
      {rejectOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <form
            onSubmit={handleConfirmReject}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-xs"
          >
            <div className="flex items-center gap-2 text-rose-700">
              <XCircle className="w-5 h-5" />
              <h3 className="text-sm font-bold text-slate-900">Reject Order</h3>
            </div>
            <p className="text-slate-600">
              Please specify a valid reason. The customer will be informed and inventory will not be reserved.
            </p>
            <div>
              <label className="font-semibold text-slate-700 block mb-1">Reason for Rejection</label>
              <select
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg"
              >
                <option value="Out of stock for selected item">Out of stock for selected item</option>
                <option value="Store currently at maximum capacity">Store currently at maximum capacity</option>
                <option value="Delivery staff unavailable currently">Delivery staff unavailable currently</option>
                <option value="Address too far from delivery radius">Address too far from delivery radius</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectOrderId(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUpdatingOrder}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg cursor-pointer"
              >
                {isUpdatingOrder ? 'Updating...' : 'Confirm Rejection'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delivery Verification OTP Modal */}
      {otpVerifyOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <form
            onSubmit={handleVerifyOtp}
            className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-xs"
          >
            <div className="flex items-center gap-2 text-emerald-700">
              <KeyRound className="w-5 h-5" />
              <h3 className="text-sm font-bold text-slate-900">Verify Customer Handover</h3>
            </div>
            <p className="text-slate-600">
              Ask customer for their 4-digit verification code to confirm successful doorstep delivery.
            </p>

            {otpError && (
              <p className="p-2 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg font-medium">
                {otpError}
              </p>
            )}

            <div>
              <label className="font-bold text-slate-700 block mb-1">Customer 4-Digit OTP</label>
              <input
                type="text"
                maxLength={4}
                required
                autoFocus
                placeholder="e.g. 4921"
                value={enteredOtp}
                onChange={(e) => setEnteredOtp(e.target.value)}
                className="w-full text-center text-2xl font-mono font-bold tracking-widest py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setOtpVerifyOrderId(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUpdatingOrder}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg cursor-pointer"
              >
                {isUpdatingOrder ? 'Verifying...' : 'Confirm & Mark Delivered'}
              </button>
            </div>
          </form>
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
