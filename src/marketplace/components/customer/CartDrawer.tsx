/**
 * BillPilot Local - Cart Drawer and Single-Shop Cross-Store Interceptor
 * 
 * Enforces one shop per order and displays itemized cost breakdowns.
 */

import React from 'react';
import { X, Trash2, Plus, Minus, AlertTriangle, ArrowRight, ShoppingBag, Store } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { formatINR } from '../../utils/formatters';

interface CartDrawerProps {
  onProceedToCheckout: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({ onProceedToCheckout }) => {
  const {
    items,
    currentShop,
    itemCount,
    subtotal,
    updateQuantity,
    removeItem,
    clearCart,
    isCartDrawerOpen,
    setIsCartDrawerOpen,
    pendingSwitch,
    confirmShopSwitch,
    cancelShopSwitch,
  } = useCart();

  if (!isCartDrawerOpen && !pendingSwitch) return null;

  const minOrder = currentShop?.deliverySettings.minOrderValue || 0;
  const isMinOrderMet = subtotal >= minOrder;
  const minOrderShortfall = minOrder - subtotal;

  const baseDelivery = currentShop?.deliverySettings.baseDeliveryCharge || 0;
  const freeThreshold = currentShop?.deliverySettings.freeDeliveryThreshold;
  const isFreeDelivery = freeThreshold ? subtotal >= freeThreshold : false;
  const estimatedDeliveryCharge = isFreeDelivery ? 0 : baseDelivery;

  return (
    <>
      {/* Cross-Shop Collision Interceptor Modal */}
      {pendingSwitch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="p-2.5 bg-amber-50 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Replace Cart Items?</h3>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Your cart currently contains items from <strong className="text-slate-900">{currentShop?.name}</strong>.
              Because each neighborhood shop manages its own doorstep delivery, a single order can only contain products from one shop at a time.
            </p>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200/60 text-xs space-y-1">
              <p className="font-semibold text-slate-800">New Item:</p>
              <p className="text-slate-600">
                {pendingSwitch.pendingItem.productName} from <span className="font-medium text-blue-600">{pendingSwitch.newShopName}</span>
              </p>
            </div>

            <p className="text-xs text-slate-500">
              Would you like to clear your existing cart and start a new order with <strong>{pendingSwitch.newShopName}</strong>?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={cancelShopSwitch}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Keep Existing Cart
              </button>
              <button
                onClick={confirmShopSwitch}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                Start New Order
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cart Drawer */}
      {isCartDrawerOpen && (
        <div className="fixed inset-0 z-40 overflow-hidden">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={() => setIsCartDrawerOpen(false)}
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between">
              {/* Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-blue-600" />
                  <h2 className="text-sm font-bold text-slate-900">Your Shopping Cart</h2>
                  <span className="text-xs text-slate-400">({itemCount} items)</span>
                </div>
                <button
                  onClick={() => setIsCartDrawerOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {currentShop && (
                  <div className="flex items-center justify-between p-3 bg-blue-50/70 border border-blue-100 rounded-xl">
                    <div className="flex items-center gap-2.5">
                      <Store className="w-4 h-4 text-blue-600 shrink-0" />
                      <div>
                        <p className="text-xs font-bold text-slate-900">{currentShop.name}</p>
                        <p className="text-[11px] text-slate-500">{currentShop.address.locality}</p>
                      </div>
                    </div>
                    <button
                      onClick={clearCart}
                      className="text-[11px] text-rose-600 hover:text-rose-700 font-semibold cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                )}

                {items.length === 0 ? (
                  <div className="py-16 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                      <ShoppingBag className="w-6 h-6" />
                    </div>
                    <p className="text-sm font-semibold text-slate-800">Your cart is empty</p>
                    <p className="text-xs text-slate-500 max-w-xs mx-auto">
                      Explore neighborhood shops and add essentials for quick doorstep delivery.
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {items.map((item) => (
                      <div key={item.listingId} className="py-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <img
                            src={item.imageUrl}
                            alt={item.productName}
                            referrerPolicy="no-referrer"
                            className="w-12 h-12 object-cover rounded-lg bg-slate-50 shrink-0"
                          />
                          <div className="truncate">
                            <p className="text-xs font-bold text-slate-900 truncate">
                              {item.productName}
                            </p>
                            <p className="text-[11px] text-slate-500 font-tabular">
                              {formatINR(item.unitPrice)} · {item.unit}
                            </p>
                            {item.isOutOfStock && (
                              <span className="inline-block mt-0.5 text-[10px] font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                                Currently Out of Stock
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Quantity Counter */}
                        <div className="flex items-center gap-1.5 bg-slate-100 rounded-lg p-1">
                          <button
                            onClick={() => updateQuantity(item.listingId, -1)}
                            className="p-1 hover:bg-white rounded transition-colors text-slate-700 cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-bold font-tabular min-w-4 text-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => {
                              if (!item.isOutOfStock && (item.availableStock === undefined || item.quantity < item.availableStock)) {
                                updateQuantity(item.listingId, 1);
                              }
                            }}
                            disabled={item.isOutOfStock || (item.availableStock !== undefined && item.quantity >= item.availableStock)}
                            className="p-1 hover:bg-white rounded transition-colors text-slate-700 cursor-pointer disabled:opacity-30"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <button
                          onClick={() => removeItem(item.listingId)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                          aria-label="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              {items.length > 0 && (
                <div className="p-5 border-t border-slate-100 bg-slate-50/70 space-y-4">
                  {/* Out of stock alert */}
                  {items.some((i) => i.isOutOfStock) && (
                    <div className="flex items-center gap-2 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                      <span>
                        Some items in your cart have run out of stock in the store. Please remove them before checkout.
                      </span>
                    </div>
                  )}

                  {/* Min order alert if needed */}
                  {!isMinOrderMet && !items.some((i) => i.isOutOfStock) && (
                    <div className="flex items-center gap-2 p-2.5 bg-amber-50 border border-amber-200/80 rounded-lg text-xs text-amber-800">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                      <span>
                        Add <strong>{formatINR(minOrderShortfall)}</strong> more to reach {currentShop?.name}&apos;s minimum order value of {formatINR(minOrder)}.
                      </span>
                    </div>
                  )}

                  <div className="space-y-1.5 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span>Items Subtotal:</span>
                      <span className="font-semibold text-slate-900 font-tabular">
                        {formatINR(subtotal)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Estimated Delivery:</span>
                      <span className="font-semibold text-slate-900 font-tabular">
                        {estimatedDeliveryCharge === 0 ? 'FREE' : formatINR(estimatedDeliveryCharge)}
                      </span>
                    </div>
                  </div>

                  <button
                    disabled={!isMinOrderMet || items.some((i) => i.isOutOfStock)}
                    onClick={() => {
                      setIsCartDrawerOpen(false);
                      onProceedToCheckout();
                    }}
                    className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-sm ${
                      isMinOrderMet && !items.some((i) => i.isOutOfStock)
                        ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <span>Proceed to Checkout</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
