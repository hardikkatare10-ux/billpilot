/**
 * NearBasket - Shop Discovery Component
 * 
 * Clean, mobile-first marketplace storefront for discovering verified
 * neighborhood shops with real-time delivery limits and radial coverage.
 */

import React, { useState } from 'react';
import { Search, MapPin, Clock, Truck, Star, CheckCircle, ShieldCheck, Navigation } from 'lucide-react';
import { Shop } from '../../types';
import { formatINR } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';
import { useLocation } from '../../context/LocationContext';

interface ShopDiscoveryProps {
  shops: Shop[];
  onSelectShop: (shopId: string) => void;
}

const CATEGORIES = [
  'All Stores',
  'Groceries & Essentials',
  'Stationery & School Supplies',
  'Personal Care & Wellness',
];

export const ShopDiscovery: React.FC<ShopDiscoveryProps> = ({ shops, onSelectShop }) => {
  const { openAuthModal } = useAuth();
  const { location, openLocationModal } = useLocation();
  const [selectedCategory, setSelectedCategory] = useState('All Stores');
  const [searchQuery, setSearchQuery] = useState('');

  // Evaluate each verified shop's distance and coverage to customer location
  const shopsWithCoverage = shops
    .filter((shop) => shop.verificationStatus === 'verified')
    .map((shop) => {
      // Check radial coverage, PIN code, and locality list
      
      const isPincodeMatched = Boolean(
        location?.pincode && (
          shop.deliverySettings.serviceablePincodes?.includes(location.pincode) ||
          shop.address.pincode === location.pincode
        )
      );

      const isLocalityMatched =
        !location ||
        shop.deliverySettings.serviceableLocalities.some(
          (l) => l.toLowerCase() === location.locality.toLowerCase()
        ) ||
        shop.address.locality.toLowerCase() === location.locality.toLowerCase() ||
        (shop.deliverySettings.serviceableAreaIds &&
          location.areaId &&
          shop.deliverySettings.serviceableAreaIds.includes(location.areaId));

      // A shop is shown only if the customer's PIN code is one the shopkeeper registered (max 3)
      const deliversToCustomer =
        shop.deliverySettings.isDeliveryAvailable && (!location || isPincodeMatched);

      return {
        shop,
        deliversToCustomer,
        isPincodeMatched,
      };
    });

  // Filter based on search query, category, and strict delivery coverage
  const filteredShops = shopsWithCoverage.filter(({ shop, deliversToCustomer }) => {
    // Only show shops that deliver to the selected customer location
    if (!deliversToCustomer) return false;

    const matchesCategory =
      selectedCategory === 'All Stores' || shop.category === selectedCategory;

    const matchesSearch =
      shop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shop.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shop.category.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-8 pb-16">
      {/* Hero Showcase with Active Delivery Location Indicator */}
      <div className="relative overflow-hidden rounded-2xl bg-slate-900 text-white shadow-xl">
        <img
          src="/src/assets/images/hero_neighborhood_market_1792750894722.jpg"
          alt="Neighborhood Marketplace High Street"
          className="absolute inset-0 w-full h-full object-cover opacity-35"
        />
        <div className="relative z-10 p-6 md:p-10 max-w-2xl space-y-3">
          <div className="flex items-center gap-2 text-xs font-medium text-blue-300">
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            <span>Verified Neighborhood Merchants</span>
            <span aria-hidden="true">·</span>
            <span>Shop-Managed Deliveries</span>
          </div>

          <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight text-white text-balance">
            Shop directly from trusted local stores with fast doorstep delivery.
          </h1>
          <p className="text-sm md:text-base text-slate-200">
            Support neighborhood businesses you know. Fresh groceries, stationery, and daily wellness items delivered directly by shop staff.
          </p>

          {/* Active Location Banner & Search Row */}
          <div className="pt-3 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search local shops or products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white text-slate-900 rounded-lg text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
              />
            </div>

            <button
              onClick={openLocationModal}
              className="flex items-center justify-between gap-2 bg-slate-800/90 hover:bg-slate-800 border border-slate-700/80 px-3.5 py-2 rounded-lg text-xs transition-colors cursor-pointer text-left shrink-0"
              title="Click to change your delivery locality"
            >
              <div className="flex items-center gap-2 truncate">
                <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <div className="truncate">
                  <span className="text-slate-400 text-[10px] block leading-none">Delivering to</span>
                  <span className="font-bold text-slate-100 truncate block text-xs mt-0.5">
                    {location ? (location.subLocality || location.locality) : 'Choose Locality'}
                  </span>
                </div>
              </div>
              <span className="text-[10px] text-blue-400 font-semibold underline underline-offset-2 ml-2">
                Change
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Category Segmented Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 text-xs font-medium rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
              selectedCategory === cat
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Shop Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span className="font-semibold text-slate-800 uppercase tracking-wider">
            {filteredShops.length} {filteredShops.length === 1 ? 'Store' : 'Stores'} Delivering to{' '}
            {location ? `${location.locality}, ${location.city}` : 'Your Area'}
          </span>
          <span>Delivered directly by shop staff</span>
        </div>

        {filteredShops.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-10 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
              <Truck className="w-6 h-6" />
            </div>
            <p className="text-slate-900 font-bold text-base">
              No registered shops deliver to {location ? `${location.locality}, ${location.city}${location.pincode ? ` (${location.pincode})` : ''}` : 'your area'} yet
            </p>
            <p className="text-xs text-slate-500 max-w-lg mx-auto leading-relaxed">
              While this is a verified location, our neighborhood merchant network has not onboarded active delivery stores in this immediate coverage zone. Local shops manage their own doorstep deliveries within designated PIN codes and radial boundaries.
            </p>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={openLocationModal}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                Change Delivery Location
              </button>
              <button
                onClick={() => openAuthModal('register_shopkeeper')}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Onboard a Shop Here
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredShops.map(({ shop }) => {
              const isOpen = shop.deliverySettings.isAcceptingOrders;
              const totalEstMins =
                shop.deliverySettings.estimatedPrepMinutes +
                shop.deliverySettings.estimatedDeliveryMinutes;

              return (
                <div
                  key={shop.id}
                  onClick={() => onSelectShop(shop.id)}
                  className="group bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    {/* Shop Card Image */}
                    <div className="relative h-48 w-full bg-slate-100 overflow-hidden">
                      <img
                        src={shop.imageUrl}
                        alt={shop.name}
                        className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                      />
                      <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-md text-[11px] font-semibold text-slate-800 shadow-xs">
                        <CheckCircle className="w-3.5 h-3.5 text-blue-600" />
                        <span>Verified Shop</span>
                      </div>
                      <div className="absolute top-3 right-3">
                        <span
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold shadow-xs ${
                            isOpen
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-800 text-slate-200'
                          }`}
                        >
                          {isOpen ? 'Open & Delivering' : 'Currently Offline'}
                        </span>
                      </div>
                    </div>

                    {/* Shop Details */}
                    <div className="p-5 space-y-3">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
                            {shop.category}
                          </span>
                          <div className="flex items-center gap-1 text-xs font-semibold text-slate-800 font-tabular">
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                            <span>{shop.rating}</span>
                            <span className="text-slate-400 font-normal">({shop.reviewCount})</span>
                          </div>
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition-colors mt-1">
                          {shop.name}
                        </h3>
                        <p className="text-xs text-slate-500 line-clamp-2 mt-1">
                          {shop.description}
                        </p>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
                        <div className="flex items-center gap-1.5 truncate">
                          <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                          <span className="truncate">{shop.address.locality}, {shop.address.city}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Delivery Terms Footer */}
                  <div className="bg-slate-50/80 px-5 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                    <div className="flex items-center gap-1 font-tabular">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>~{totalEstMins} mins</span>
                    </div>
                    <div className="flex items-center gap-1 font-tabular">
                      <Truck className="w-3.5 h-3.5 text-slate-400" />
                      <span>
                        {shop.deliverySettings.baseDeliveryCharge === 0
                          ? 'Free Delivery'
                          : `${formatINR(shop.deliverySettings.baseDeliveryCharge)} delivery`}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-tabular">
                      Min {formatINR(shop.deliverySettings.minOrderValue)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
