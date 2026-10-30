/**
 * NearBasket - Checkout Modal
 * 
 * Enforces server-side revalidation of stock, prices, address serviceability,
 * and delivery charges before placing atomic orders.
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  MapPin,
  Truck,
  CreditCard,
  Banknote,
  AlertCircle,
  Plus,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useLocation } from '../../context/LocationContext';
import { dbStore } from '../../services/db/store';
import { processAtomicOrder } from '../../services/firebase/orderService';
import { formatINR } from '../../utils/formatters';
import { MapLocationPicker, PickedLocation } from '../common/MapLocationPicker';
import { PaymentMethod, UserAddress } from '../../types';

interface CheckoutModalProps {
  onClose: () => void;
  onOrderPlaced: (orderId: string) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({ onClose, onOrderPlaced }) => {
  const { currentUser, addAddress, openAuthModal } = useAuth();
  const { items, shopId, currentShop, clearCart } = useCart();
  const { location } = useLocation();

  const [selectedAddressId, setSelectedAddressId] = useState<string>(
    currentUser?.addresses[0]?.id || ''
  );
  const paymentMethod: PaymentMethod = 'cash_on_delivery';
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => crypto.randomUUID());
  const [revalidationResult, setRevalidationResult] = useState<ReturnType<
    typeof dbStore.revalidateCheckout
  > | null>(null);
  const [revalidationError, setRevalidationError] = useState<string | null>(null);

  // Address creation state
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [newRecipientName, setNewRecipientName] = useState(currentUser?.name || '');
  const [newPhone, setNewPhone] = useState(currentUser?.phone || '');
  const [newStreet, setNewStreet] = useState('');
  const [newLocality, setNewLocality] = useState(location?.locality || '');
  const [newLandmark, setNewLandmark] = useState('');
  const [newMapLocation, setNewMapLocation] = useState<PickedLocation | null>(null);
  const [newPincode, setNewPincode] = useState(location?.pincode || '');

  const selectedAddress =
    currentUser?.addresses.find((a) => a.id === selectedAddressId) || currentUser?.addresses[0];

  useEffect(() => {
    if (!currentUser || !shopId) return;
    const storageKey = `billpilot:marketplace-order:${currentUser.id}:${shopId}`;
    const existingKey = sessionStorage.getItem(storageKey);
    const key = existingKey || crypto.randomUUID();
    if (!existingKey) sessionStorage.setItem(storageKey, key);
    setIdempotencyKey(key);
  }, [currentUser?.id, shopId]);

  // Perform server revalidation whenever address or items change
  useEffect(() => {
    if (!shopId || items.length === 0 || !selectedAddress) return;

    try {
      const res = dbStore.revalidateCheckout(
        shopId,
        items.map((i) => ({ listingId: i.listingId, quantity: i.quantity })),
        selectedAddress
      );

      if (res.valid) {
        setRevalidationResult(res);
        setRevalidationError(null);
      } else {
        setRevalidationResult(null);
        setRevalidationError(res.error || 'Checkout revalidation failed.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Checkout validation error.';
      setRevalidationError(msg);
      setRevalidationResult(null);
    }
  }, [shopId, items, selectedAddress]);

  const handleCreateAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStreet || !newLocality || !newPincode || !newMapLocation) return;

    const created = addAddress({
      label: 'Home',
      recipientName: newRecipientName,
      phoneNumber: newPhone,
      streetAddress: newStreet,
      locality: newLocality,
      landmark: newLandmark,
      city: location?.city || '',
      pincode: newPincode,
      coordinates: newMapLocation.coordinates,
      mapsLink: newMapLocation.mapsLink,
      isDefault: true,
    });

    setSelectedAddressId(created.id);
    setIsAddingAddress(false);
  };

  const handlePlaceOrder = async () => {
    if (!currentUser || !shopId || !selectedAddress || !revalidationResult?.valid) return;

    setIsSubmitting(true);
    try {
      const result = await processAtomicOrder({
        customerId: currentUser.id,
        idempotencyKey,
        customerName: currentUser.name || '',
        customerPhone: currentUser.phone || selectedAddress.phoneNumber || '',
        shopId,
        items: items.map((i) => ({
          listingId: i.listingId,
          productId: i.productId || i.listingId,
          quantity: i.quantity,
        })),
        deliveryAddress: selectedAddress,
        paymentMethod,
      });

      sessionStorage.removeItem(`billpilot:marketplace-order:${currentUser.id}:${shopId}`);
      clearCart();
      onOrderPlaced(result.order.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to place order.';
      setRevalidationError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div>
            <h2 className="text-base font-bold text-slate-900">Checkout & Delivery Terms</h2>
            <p className="text-xs text-slate-500">Store: {currentShop?.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
            aria-label="Close checkout"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Revalidation Error Banner */}
          {revalidationError && (
            <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-rose-900">Checkout Error</p>
                <p className="mt-0.5">{revalidationError}</p>
              </div>
            </div>
          )}

          {/* Delivery Address Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-600" />
                Delivery Address
              </span>
              {!isAddingAddress && (
                <button
                  onClick={() => setIsAddingAddress(true)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  Add New
                </button>
              )}
            </div>

            {!currentUser ? (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-center space-y-2">
                <p className="font-bold text-slate-900 text-xs">Sign In Required for Doorstep Delivery</p>
                <p className="text-[11px] text-slate-600">
                  Please sign in or create a customer account to enter your delivery address and receive your delivery verification OTP.
                </p>
                <button
                  type="button"
                  onClick={() => openAuthModal('login')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer"
                >
                  Sign In or Create Account
                </button>
              </div>
            ) : isAddingAddress ? (
              <form onSubmit={handleCreateAddress} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
                <p className="font-semibold text-slate-900">Add New Delivery Address</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-600">Recipient Name</label>
                    <input
                      type="text"
                      required
                      value={newRecipientName}
                      onChange={(e) => setNewRecipientName(e.target.value)}
                      className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600">Mobile Phone</label>
                    <input
                      type="tel"
                      required
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-slate-600">Flat / House / Street Address</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Flat 301, 14th Cross"
                    value={newStreet}
                    onChange={(e) => setNewStreet(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-white border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-600">Locality</label>
                    <input
                      type="text"
                      required
                      placeholder="Locality"
                      value={newLocality}
                      onChange={(e) => setNewLocality(e.target.value)}
                      className="w-full mt-1 px-2.5 py-2 bg-white border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600">Landmark</label>
                    <input
                      type="text"
                      placeholder="Optional"
                      value={newLandmark}
                      onChange={(e) => setNewLandmark(e.target.value)}
                      className="w-full mt-1 px-2 py-2 bg-white border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600">Pincode</label>
                    <input
                      type="text"
                      required
                      value={newPincode}
                      onChange={(e) => setNewPincode(e.target.value)}
                      className="w-full mt-1 px-2.5 py-2 bg-white border border-slate-300 rounded-md text-xs focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <MapLocationPicker value={newMapLocation} onChange={setNewMapLocation} />

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingAddress(false)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors cursor-pointer"
                  >
                    Save Address
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-2">
                {currentUser?.addresses.map((addr) => (
                  <label
                    key={addr.id}
                    className={`flex items-start gap-3 p-3 rounded-xl border text-xs cursor-pointer transition-colors ${
                      selectedAddressId === addr.id
                        ? 'border-blue-600 bg-blue-50/40 ring-1 ring-blue-600'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="selected_address"
                      checked={selectedAddressId === addr.id}
                      onChange={() => setSelectedAddressId(addr.id)}
                      className="mt-0.5 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{addr.recipientName}</span>
                        <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">
                          {addr.label}
                        </span>
                      </div>
                      <p className="text-slate-600 mt-0.5">
                        {addr.streetAddress}, {addr.locality}, {addr.city} - {addr.pincode}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Phone: {addr.phoneNumber}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Payment Method Section */}
          <div className="space-y-3">
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-blue-600" />
              Payment Method
            </span>

            <div className="grid grid-cols-1 gap-3">
              <label
                className={`flex flex-col p-3 rounded-xl border text-xs cursor-pointer transition-colors ${
                  paymentMethod === 'cash_on_delivery'
                    ? 'border-blue-600 bg-blue-50/40 ring-1 ring-blue-600'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Banknote className="w-4 h-4 text-emerald-600" />
                    <span className="font-bold text-slate-900">Cash on Delivery</span>
                  </div>
                  <input
                    type="radio"
                    name="payment_method"
                    checked={paymentMethod === 'cash_on_delivery'}
                    readOnly
                    className="text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  Pay cash directly to shop delivery staff upon doorstep delivery.
                </p>
              </label>

            </div>
          </div>

          {/* Price Breakdown Summary */}
          {revalidationResult?.valid && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-500 pb-1 border-b border-slate-200 font-semibold uppercase text-[10px]">
                <span>Price Breakdown</span>
                <span>Server Verified</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Items Subtotal:</span>
                <span className="font-mono tabular-nums">{formatINR(revalidationResult.subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Shop Delivery Charge:</span>
                <span className="font-mono tabular-nums">
                  {revalidationResult.deliveryCharge === 0 ? 'FREE' : formatINR(revalidationResult.deliveryCharge)}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Taxes & GST (Included):</span>
                <span className="font-mono tabular-nums">{formatINR(revalidationResult.gstTotal)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-bold text-slate-900">
                <span>To Pay:</span>
                <span className="font-mono tabular-nums text-blue-600">
                  {formatINR(revalidationResult.totalAmount)}
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Your order includes a 4-digit verification OTP to confirm safe receipt at your doorstep.
            </span>
          </div>
        </div>

        {/* Action Button */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            disabled={!revalidationResult?.valid || isSubmitting}
            onClick={handlePlaceOrder}
            className={`px-6 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-sm ${
              revalidationResult?.valid && !isSubmitting
                ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Processing Order...</span>
              </>
            ) : (
              <span>Confirm & Place Order ({revalidationResult?.totalAmount ? formatINR(revalidationResult.totalAmount) : ''})</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
