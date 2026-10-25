/**
 * BillPilot Local - Shop Delivery & Operating Settings
 * 
 * Allows shopkeepers to set delivery radius, charges, minimum order,
 * operating hours, and order acceptance toggles.
 */

import React, { useState } from 'react';
import { Truck, Clock, ShieldCheck, MapPin, CheckCircle, Save } from 'lucide-react';
import { Shop } from '../../types';
import { formatINR } from '../../utils/formatters';
import { dbStore, sanitizePincodes } from '../../services/db/store';
import { MapLocationPicker, PickedLocation } from '../common/MapLocationPicker';
import { googleMapsUrl } from '../../utils/geo';
import { updateFirestoreShopLocation } from '../../services/firebase/shopService';

interface ShopSettingsProps {
  shop: Shop;
  onRefresh: () => void;
}

export const ShopSettings: React.FC<ShopSettingsProps> = ({ shop, onRefresh }) => {
  const [isAcceptingOrders, setIsAcceptingOrders] = useState(
    shop.deliverySettings.isAcceptingOrders
  );
  const [shopLocation, setShopLocation] = useState<PickedLocation | null>(
    shop.address.coordinates
      ? { coordinates: shop.address.coordinates, mapsLink: googleMapsUrl(shop.address.coordinates) }
      : null
  );
  const [radiusKm, setRadiusKm] = useState(Math.min(shop.deliverySettings.serviceRadiusKm || 10, 10));
  const [baseChargeRupees, setBaseChargeRupees] = useState(
    shop.deliverySettings.baseDeliveryCharge / 100
  );
  const [freeThresholdRupees, setFreeThresholdRupees] = useState(
    shop.deliverySettings.freeDeliveryThreshold
      ? shop.deliverySettings.freeDeliveryThreshold / 100
      : 0
  );
  const [minOrderRupees, setMinOrderRupees] = useState(
    shop.deliverySettings.minOrderValue / 100
  );
  const [prepMins, setPrepMins] = useState(shop.deliverySettings.estimatedPrepMinutes);
  const [deliveryMins, setDeliveryMins] = useState(shop.deliverySettings.estimatedDeliveryMinutes);
  const [maxOrders, setMaxOrders] = useState(shop.deliverySettings.maxConcurrentOrders);
  const [localities, setLocalities] = useState(
    shop.deliverySettings.serviceableLocalities.join(', ')
  );
  const [pincodes, setPincodes] = useState(
    (shop.deliverySettings.serviceablePincodes || [shop.address.pincode]).filter(Boolean).join(', ')
  );
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);

    if (!shopLocation) {
      setSaveError('Set your shop location so the marketplace can enforce the 10 km delivery limit.');
      return;
    }

    const parsedLocalities = localities
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const parsedPincodes = sanitizePincodes(pincodes);
    if (parsedPincodes.length === 0) {
      setPinError('Enter at least one valid 6-digit PIN code (maximum 3).');
      return;
    }
    setPinError(null);

    try {
      await updateFirestoreShopLocation(shop.id, shopLocation.coordinates);
      dbStore.updateShopLocation(shop.id, shopLocation.coordinates);
      dbStore.updateShopSettings(shop.id, {
        isAcceptingOrders,
        serviceRadiusKm: Math.min(Number(radiusKm) || 10, 10),
        baseDeliveryCharge: Math.round(Number(baseChargeRupees) * 100),
        freeDeliveryThreshold:
          freeThresholdRupees > 0 ? Math.round(Number(freeThresholdRupees) * 100) : undefined,
        minOrderValue: Math.round(Number(minOrderRupees) * 100),
        estimatedPrepMinutes: Number(prepMins),
        estimatedDeliveryMinutes: Number(deliveryMins),
        maxConcurrentOrders: Number(maxOrders),
        serviceableLocalities: parsedLocalities,
        serviceablePincodes: parsedPincodes,
      }, shop.ownerId);
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : 'Could not save shop settings.');
      return;
    }

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
    onRefresh();
  };

  return (
    <div className="max-w-3xl space-y-6 pb-20">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-xl font-bold text-slate-900">Delivery & Store Configuration</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Configure service area radius, delivery fees, minimum order values, and fulfillment limits.
        </p>
      </div>

      {savedSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>Shop settings updated and active across customer marketplace storefront.</span>
        </div>
      )}
      {saveError && (
        <div role="alert" className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
          {saveError}
        </div>
      )}

      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6 text-xs">
        <MapLocationPicker
          value={shopLocation}
          onChange={setShopLocation}
          label="Shop location"
          helpText="Set the exact shop pin. Customers can place orders only within 10 km of this location."
        />
        {/* Order Acceptance Toggle */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="font-bold text-slate-900 text-sm block">Accepting Online Orders</span>
            <p className="text-slate-500 text-[11px]">
              When switched off, your shop is displayed as offline and customers cannot place new orders.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsAcceptingOrders(!isAcceptingOrders)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
              isAcceptingOrders ? 'bg-blue-600' : 'bg-slate-300'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                isAcceptingOrders ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Delivery Terms */}
        <div className="space-y-4">
          <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <Truck className="w-4 h-4 text-blue-600" />
            Delivery Rates & Limits
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Base Delivery Fee (₹)
              </label>
              <input
                type="number"
                min="0"
                step="5"
                value={baseChargeRupees}
                onChange={(e) => setBaseChargeRupees(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 font-mono"
              />
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Standard charge applied to customer orders
              </span>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Free Delivery Above Order Value (₹)
              </label>
              <input
                type="number"
                min="0"
                step="50"
                value={freeThresholdRupees}
                onChange={(e) => setFreeThresholdRupees(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 font-mono"
              />
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Orders above this amount receive free delivery (0 = no free threshold)
              </span>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Minimum Order Value (₹)
              </label>
              <input
                type="number"
                min="0"
                step="10"
                value={minOrderRupees}
                onChange={(e) => setMinOrderRupees(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 font-mono"
              />
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Checkout blocked if subtotal is below this threshold
              </span>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Serviceable Delivery Radius (km)
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={radiusKm}
                onChange={(e) => setRadiusKm(Math.min(Number(e.target.value), 10))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 font-mono"
              />
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Maximum distance shop delivery staff travel
              </span>
            </div>
          </div>
        </div>

        {/* Fulfillment Times */}
        <div className="space-y-4 pt-2 border-t border-slate-100">
          <h3 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-blue-600" />
            Preparation & Capacity
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Estimated Prep Time (Mins)
              </label>
              <input
                type="number"
                min="5"
                value={prepMins}
                onChange={(e) => setPrepMins(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Estimated Travel Time (Mins)
              </label>
              <input
                type="number"
                min="5"
                value={deliveryMins}
                onChange={(e) => setDeliveryMins(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">
                Max Concurrent Orders
              </label>
              <input
                type="number"
                min="1"
                value={maxOrders}
                onChange={(e) => setMaxOrders(Number(e.target.value))}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Localities with Area Directory Quick-Picks */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <label className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-blue-600" />
            Serviceable Neighborhood Localities
          </label>
          <input
            type="text"
            value={localities}
            onChange={(e) => setLocalities(e.target.value)}
            placeholder="e.g. Indiranagar, Domlur, HAL 2nd Stage"
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 text-xs"
          />
          <span className="text-[10px] text-slate-400 block">
            Comma-separated neighborhood names. Customers outside these localities or outside your {radiusKm} km radius will be informed before checkout.
          </span>

          {/* Quick-add buttons from the city's Area Directory */}
          <div className="space-y-1 pt-1">
            <span className="text-[10px] text-slate-500 font-semibold block">
              Quick-add indexed areas in {shop.address.city}:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {dbStore
                .getAreas({ city: shop.address.city, status: 'active', level: 'locality' })
                .slice(0, 10)
                .map((area) => {
                  const currentLocs = localities.split(',').map((s) => s.trim().toLowerCase());
                  const isSelected = currentLocs.includes(area.name.toLowerCase());

                  return (
                    <button
                      type="button"
                      key={area.id}
                      onClick={() => {
                        if (isSelected) {
                          const updated = localities
                            .split(',')
                            .map((s) => s.trim())
                            .filter((s) => s.toLowerCase() !== area.name.toLowerCase())
                            .join(', ');
                          setLocalities(updated);
                        } else {
                          const updated = localities ? `${localities}, ${area.name}` : area.name;
                          setLocalities(updated);
                        }
                      }}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {isSelected ? `✓ ${area.name}` : `+ ${area.name}`}
                    </button>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Serviceable PIN Codes */}
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <label className="font-bold text-slate-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-emerald-600" />
            Serviceable Indian PIN Codes
          </label>
          <input
            type="text"
            value={pincodes}
            onChange={(e) => setPincodes(e.target.value)}
            placeholder="Up to 3 PIN codes, e.g. 482002, 482001"
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 text-xs font-mono"
          />
          <span className="text-[10px] text-slate-400 block">
            Up to 3 comma-separated 6-digit PIN codes. Customers see your shop only if their PIN code is one of these.
          </span>
          {pinError && <span className="text-[11px] text-red-600 font-semibold block">{pinError}</span>}
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-100">
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" />
            Save Store Settings
          </button>
        </div>
      </form>
    </div>
  );
};
