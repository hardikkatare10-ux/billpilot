/**
 * NearBasket - Shop Detail & Catalogue View
 * 
 * Displays shop-specific prices, live stock levels, delivery policies,
 * and allows adding items into the single-shop cart with real-time Firestore sync.
 */

import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  MapPin,
  Clock,
  Truck,
  Star,
  CheckCircle,
  Plus,
  Minus,
  ShoppingBag,
  Info,
  Loader2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { Shop, ShopListing } from '../../types';
import { formatINR } from '../../utils/formatters';
import { useCart } from '../../context/CartContext';
import {
  subscribeToShopProducts,
} from '../../services/firebase/productService';
import { dbStore } from '../../services/db/store';

interface ShopDetailProps {
  shop: Shop;
  listings: ShopListing[];
  onBack: () => void;
}

export const ShopDetail: React.FC<ShopDetailProps> = ({ shop, listings: initialListings, onBack }) => {
  const { items, shopId: cartShopId, addItem, updateQuantity, setIsCartDrawerOpen } = useCart();
  const [activeCategory, setActiveCategory] = useState<string>('All Items');
  const [realtimeListings, setRealtimeListings] = useState<ShopListing[]>(
    initialListings && initialListings.length > 0 ? initialListings : []
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Subscribe to real-time Firestore product updates for this shop
  useEffect(() => {
    if (!shop.id) return;

    setIsLoading(true);
    setLoadError(null);

    // Show what is already known locally right away, then follow live updates
    setRealtimeListings(dbStore.getListings(shop.id));

    // Real-time onSnapshot listener
    const unsubscribe = subscribeToShopProducts(
      shop.id,
      (updatedListings) => {
        setRealtimeListings(updatedListings);
        setIsLoading(false);
        setLoadError(null);
      },
      (err) => {
        console.error('Error fetching live shop listings from Firestore:', err);
        setLoadError('Could not sync live inventory. Showing cached catalogue.');
        setIsLoading(false);
        // Fallback to local store
        setRealtimeListings(dbStore.getListings(shop.id));
      }
    );

    // Clean up listener when unmounting or switching shop
    return () => {
      unsubscribe();
    };
  }, [shop.id]);

  const categories = [
    'All Items',
    ...Array.from(new Set(realtimeListings.map((l) => l.product.category))),
  ];

  const filteredListings = realtimeListings.filter((l) => {
    if (!l.isVisible) return false;
    if (activeCategory === 'All Items') return true;
    return l.product.category === activeCategory;
  });

  const isCartFromThisShop = cartShopId === shop.id;

  const getItemCartQuantity = (listingId: string): number => {
    if (!isCartFromThisShop) return 0;
    const found = items.find((i) => i.listingId === listingId);
    return found ? found.quantity : 0;
  };

  const totalCartCountForThisShop = isCartFromThisShop
    ? items.reduce((acc, i) => acc + i.quantity, 0)
    : 0;

  const totalCartAmountForThisShop = isCartFromThisShop
    ? items.reduce((acc, i) => acc + i.unitPrice * i.quantity, 0)
    : 0;

  const estMinutes =
    shop.deliverySettings.estimatedPrepMinutes +
    shop.deliverySettings.estimatedDeliveryMinutes;

  return (
    <div className="space-y-6 pb-24">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to all neighborhood stores
      </button>

      {/* Shop Info Card */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="relative h-44 md:h-56 w-full bg-slate-900">
          <img
            src={shop.imageUrl}
            alt={shop.name}
            className="w-full h-full object-cover opacity-85"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/30 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 text-white flex flex-col md:flex-row md:items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-blue-300 uppercase tracking-wider">
                  {shop.category}
                </span>
                <span className="text-slate-400">·</span>
                <div className="flex items-center gap-1 text-xs font-semibold text-amber-300">
                  <Star className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                  <span>{shop.rating}</span>
                  <span className="text-slate-300 font-normal">({shop.reviewCount} verified reviews)</span>
                </div>
              </div>
              <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight mt-1">
                {shop.name}
              </h1>
              <p className="text-xs text-slate-200 flex items-center gap-1.5 mt-1">
                <MapPin className="w-3.5 h-3.5 text-slate-300" />
                {shop.address.street}, {shop.address.locality}, {shop.address.city} - {shop.address.pincode}
              </p>
            </div>

            <div className="shrink-0 flex items-center gap-2">
              <span
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold shadow-xs ${
                  shop.deliverySettings.isAcceptingOrders
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-700 text-slate-200'
                }`}
              >
                {shop.deliverySettings.isAcceptingOrders ? 'Accepting Orders' : 'Store Offline'}
              </span>
            </div>
          </div>
        </div>

        {/* Operating & Delivery Policy Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-slate-100 bg-slate-50/50 text-xs text-slate-700 border-t border-slate-100">
          <div className="p-4 space-y-0.5">
            <span className="text-slate-400 text-[11px] block">Delivery Fee</span>
            <span className="font-semibold text-slate-900 font-tabular">
              {shop.deliverySettings.baseDeliveryCharge === 0
                ? 'FREE Delivery'
                : `${formatINR(shop.deliverySettings.baseDeliveryCharge)}`}
            </span>
            {shop.deliverySettings.freeDeliveryThreshold && (
              <span className="text-[10px] text-emerald-600 block">
                Free above {formatINR(shop.deliverySettings.freeDeliveryThreshold)}
              </span>
            )}
          </div>

          <div className="p-4 space-y-0.5">
            <span className="text-slate-400 text-[11px] block">Estimated Delivery</span>
            <span className="font-semibold text-slate-900 font-tabular">
              ~{estMinutes} minutes
            </span>
            <span className="text-[10px] text-slate-500 block">
              Staff direct doorstep delivery
            </span>
          </div>

          <div className="p-4 space-y-0.5">
            <span className="text-slate-400 text-[11px] block">Minimum Order</span>
            <span className="font-semibold text-slate-900 font-tabular">
              {formatINR(shop.deliverySettings.minOrderValue)}
            </span>
            <span className="text-[10px] text-slate-500 block">
              Radius: {shop.deliverySettings.serviceRadiusKm} km
            </span>
          </div>

          <div className="p-4 space-y-0.5">
            <span className="text-slate-400 text-[11px] block">Operating Hours</span>
            <span className="font-semibold text-slate-900 font-tabular">
              {shop.operatingHours.openTime} - {shop.operatingHours.closeTime}
            </span>
            <span className="text-[10px] text-slate-500 block">
              {shop.operatingHours.isOpenSunday ? 'Open all 7 days' : 'Closed on Sundays'}
            </span>
          </div>
        </div>
      </div>

      {/* Sync Banner if Error */}
      {loadError && (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{loadError}</span>
          </div>
        </div>
      )}

      {/* Category Tabs & Live Sync indicator */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none flex-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                activeCategory === cat
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 shrink-0">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
          <span>Real-time price & stock</span>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && realtimeListings.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-16 text-center space-y-3">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Loading live product prices and stock from Firestore...</p>
        </div>
      ) : filteredListings.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-3">
          <ShoppingBag className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="font-bold text-slate-800 text-sm">No items found in this category</p>
          <p className="text-xs text-slate-500">Check another category or check back shortly.</p>
        </div>
      ) : (
        /* Product Listings Grid */
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold text-slate-800 uppercase tracking-wider">
              {filteredListings.length} Products Available
            </span>
            <span className="text-[11px] text-slate-400">All prices include applicable GST</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredListings.map((listing) => {
              const qty = getItemCartQuantity(listing.id);
              const inStock = listing.isAvailable && listing.stockQuantity > 0;
              const effectivePrice =
                listing.salePrice && listing.salePrice > 0 ? listing.salePrice : listing.shopPrice;

              return (
                <div
                  key={listing.id}
                  className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between hover:border-slate-300 transition-colors shadow-xs"
                >
                  <div>
                    {/* Image & Stock Indicator */}
                    <div className="relative h-44 w-full bg-slate-50 rounded-lg overflow-hidden mb-3">
                      <img
                        src={listing.product.imageUrl}
                        alt={listing.product.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      {!inStock && (
                        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[1px] flex items-center justify-center">
                          <span className="text-xs font-bold text-white px-3 py-1 bg-rose-600 rounded-md shadow-xs">
                            Out of Stock
                          </span>
                        </div>
                      )}
                      {listing.salePrice && listing.salePrice < listing.shopPrice && inStock && (
                        <span className="absolute top-2 left-2 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-xs">
                          Special Offer
                        </span>
                      )}
                      {inStock && listing.stockQuantity <= 5 && (
                        <span className="absolute top-2 right-2 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-xs">
                          Only {listing.stockQuantity} left
                        </span>
                      )}
                    </div>

                    {/* Brand & Name */}
                    <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider block">
                      {listing.product.brand}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900 line-clamp-2 mt-0.5">
                      {listing.product.name}
                    </h4>
                    <p className="text-xs text-slate-500 mt-0.5">Unit: {listing.product.unit}</p>
                    {listing.product.description && (
                      <p className="text-[11px] text-slate-400 line-clamp-2 mt-1">
                        {listing.product.description}
                      </p>
                    )}
                  </div>

                  {/* Price & Action Row */}
                  <div className="pt-3 border-t border-slate-100 mt-3 flex items-center justify-between">
                    <div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-base font-extrabold text-slate-900 font-tabular">
                          {formatINR(effectivePrice)}
                        </span>
                        {listing.salePrice && listing.salePrice < listing.shopPrice && (
                          <span className="text-xs text-slate-400 line-through font-tabular">
                            {formatINR(listing.shopPrice)}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 block">
                        GST {listing.product.standardGSTRate}% included
                      </span>
                    </div>

                    {/* Add / Stepper */}
                    {inStock && shop.deliverySettings.isAcceptingOrders ? (
                      qty === 0 ? (
                        <button
                          onClick={() =>
                            addItem(shop.id, shop.name, {
                              listingId: listing.id,
                              productId: listing.product.id,
                              productName: listing.product.name,
                              unit: listing.product.unit,
                              unitPrice: effectivePrice,
                              imageUrl: listing.product.imageUrl,
                            })
                          }
                          className="inline-flex items-center gap-1 px-3.5 py-1.5 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-600 hover:text-white border border-blue-200 rounded-lg transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          ADD
                        </button>
                      ) : (
                        <div className="flex items-center gap-2 bg-blue-600 text-white px-2 py-1 rounded-lg shadow-xs">
                          <button
                            onClick={() => updateQuantity(listing.id, -1)}
                            className="p-0.5 hover:bg-blue-700 rounded transition-colors cursor-pointer"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs font-bold font-tabular min-w-4 text-center">{qty}</span>
                          <button
                            onClick={() => {
                              if (qty < listing.stockQuantity) {
                                updateQuantity(listing.id, 1);
                              }
                            }}
                            disabled={qty >= listing.stockQuantity}
                            className="p-0.5 hover:bg-blue-700 rounded transition-colors cursor-pointer disabled:opacity-40"
                            aria-label="Increase quantity"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )
                    ) : (
                      <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2.5 py-1 rounded-md border border-rose-100">
                        Unavailable
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sticky Bottom Cart Floating Pill (When active items exist) */}
      {isCartFromThisShop && totalCartCountForThisShop > 0 && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-8 md:w-96 z-40 bg-slate-900 text-white rounded-xl shadow-2xl p-4 flex items-center justify-between border border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <ShoppingBag className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-200">
                {totalCartCountForThisShop} {totalCartCountForThisShop === 1 ? 'item' : 'items'} in cart
              </p>
              <p className="text-sm font-extrabold text-white font-tabular">
                {formatINR(totalCartAmountForThisShop)}
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsCartDrawerOpen(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
          >
            View Cart & Checkout
          </button>
        </div>
      )}
    </div>
  );
};
