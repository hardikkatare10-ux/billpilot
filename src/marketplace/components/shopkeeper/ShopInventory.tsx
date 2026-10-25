/**
 * BillPilot Local - Shopkeeper Inventory Management
 * 
 * Manages shop-specific prices, sale discounts, stock quantities, product details,
 * and BillPilot ERP references with real-time Firestore synchronization.
 */

import React, { useState, useEffect } from 'react';
import { Package, Plus, Edit3, Check, X, Trash2, Loader2, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';
import { ShopListing, Shop } from '../../types';
import { formatINR } from '../../utils/formatters';
import { dbStore } from '../../services/db/store';
import {
  subscribeToShopProducts,
  createFirestoreProduct,
  updateFirestoreProduct,
  deleteFirestoreProduct,
  ensureShopInitializedInFirestore,
} from '../../services/firebase/productService';

interface ShopInventoryProps {
  listings: ShopListing[];
  shopId: string;
  onRefresh: () => void;
}

export const ShopInventory: React.FC<ShopInventoryProps> = ({ shopId, onRefresh }) => {
  const [realtimeListings, setRealtimeListings] = useState<ShopListing[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Edit Product Modal State (Full field editing: name, price, stock, image, description, etc.)
  const [editingListing, setEditingListing] = useState<ShopListing | null>(null);
  const [editName, setEditName] = useState('');
  const [editBrand, setEditBrand] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editPriceRupees, setEditPriceRupees] = useState<number>(0);
  const [editSaleRupees, setEditSaleRupees] = useState<number>(0);
  const [editStock, setEditStock] = useState<number>(0);
  const [editAvailable, setEditAvailable] = useState<boolean>(true);
  const [editGstRate, setEditGstRate] = useState<number>(5);
  const [editSku, setEditSku] = useState('');

  // Add Product Modal State
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [newBrand, setNewBrand] = useState('');
  const [newCategory, setNewCategory] = useState('Groceries & Essentials');
  const [newUnit, setNewUnit] = useState('1 kg');
  const [newDesc, setNewDesc] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newGstRate, setNewGstRate] = useState<number>(5);
  const [newPriceRupees, setNewPriceRupees] = useState<number>(100);
  const [newSaleRupees, setNewSaleRupees] = useState<number>(0);
  const [newStock, setNewStock] = useState<number>(20);
  const [newSku, setNewSku] = useState('');

  // Real-time listener subscription & initial baseline seed check
  useEffect(() => {
    if (!shopId) return;

    setIsLoading(true);
    setSyncError(null);

    // 1. Ensure shop document and initial verified catalog exist in Firestore
    // Start from the local catalogue so products are never lost if Firestore is unreachable
    setRealtimeListings(dbStore.getListings(shopId));
    const shop = dbStore.getShopById(shopId);
    if (shop) {
      ensureShopInitializedInFirestore(shop).catch(() => {});
    }

    // 2. Subscribe to real-time updates from Firestore
    const unsubscribe = subscribeToShopProducts(
      shopId,
      (listings) => {
        setRealtimeListings(listings);
        setIsLoading(false);
        setSyncError(null);
      },
      (err) => {
        console.error('Real-time sync error in ShopInventory:', err);
        setSyncError(err.message || 'Firestore connection issue. Using local store.');
        setIsLoading(false);
        // Fallback to local store listings
        setRealtimeListings(dbStore.getListings(shopId));
      }
    );

    return () => unsubscribe();
  }, [shopId]);

  const startEdit = (l: ShopListing) => {
    setEditingListing(l);
    setEditName(l.product.name);
    setEditBrand(l.product.brand);
    setEditCategory(l.product.category);
    setEditUnit(l.product.unit);
    setEditDesc(l.product.description);
    setEditImageUrl(l.product.imageUrl);
    setEditPriceRupees(l.shopPrice / 100);
    setEditSaleRupees(l.salePrice ? l.salePrice / 100 : 0);
    setEditStock(l.stockQuantity);
    setEditAvailable(l.isAvailable);
    setEditGstRate(l.product.standardGSTRate);
    setEditSku(l.externalBillPilotItemId || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingListing) return;

    setIsSaving(true);
    try {
      const pricePaise = Math.round(Number(editPriceRupees) * 100);
      const salePaise = editSaleRupees > 0 ? Math.round(Number(editSaleRupees) * 100) : null;
      const stock = Math.max(0, Number(editStock));
      const isAvail = editAvailable && stock > 0;

      // 1. Update local store first
      dbStore.updateListingDetails(editingListing.id, {
        name: editName.trim() || editingListing.product.name,
        brand: editBrand.trim() || 'Local Brand',
        category: editCategory || 'Groceries & Essentials',
        unit: editUnit.trim() || '1 unit',
        description: editDesc.trim(),
        imageUrl: editImageUrl.trim() || editingListing.product.imageUrl,
        standardGSTRate: Number(editGstRate),
        externalBillPilotItemId: editSku.trim() || undefined,
      });
      dbStore.updateListingStockPrice(
        editingListing.id,
        {
          shopPrice: pricePaise,
          salePrice: salePaise ? salePaise : undefined,
          stockQuantity: stock,
          isAvailable: isAvail,
        },
        shopId
      );
      setRealtimeListings(dbStore.getListings(shopId));

      // 2. Mirror to Firestore (best effort)
      updateFirestoreProduct(editingListing.id, {
        name: editName.trim() || editingListing.product.name,
        brand: editBrand.trim() || 'Local Brand',
        category: editCategory || 'Groceries & Essentials',
        unit: editUnit.trim() || '1 unit',
        description: editDesc.trim(),
        imageUrl: editImageUrl.trim() || editingListing.product.imageUrl,
        shopPrice: pricePaise,
        salePrice: salePaise,
        stockQuantity: stock,
        isAvailable: isAvail,
        standardGSTRate: Number(editGstRate),
        externalBillPilotItemId: editSku.trim() || undefined,
      }).catch((err) => console.warn('Edit saved locally; Firestore mirror skipped:', err));

      setEditingListing(null);
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update product.';
      setSyncError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteListing = async (listingId: string) => {
    if (!confirm('Are you sure you want to remove this product from your store catalogue?')) return;

    try {
      dbStore.deleteListing(listingId, shopId);
      setRealtimeListings(dbStore.getListings(shopId));
      deleteFirestoreProduct(listingId).catch((err) =>
        console.warn('Removed locally; Firestore mirror skipped:', err)
      );
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete product.';
      setSyncError(msg);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim()) return;

    setIsSaving(true);
    try {
      const pricePaise = Math.round(Number(newPriceRupees) * 100);
      const salePaise = newSaleRupees > 0 ? Math.round(Number(newSaleRupees) * 100) : undefined;
      const stock = Math.max(0, Number(newStock));

      const imageUrl =
        newImageUrl.trim() ||
        'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80';
      const description = newDesc.trim() || `${newProdName.trim()} freshly stocked at local store.`;

      // 1. Save locally first - this always works and is what the customer view reads
      const listing = dbStore.createProductListing(
        shopId,
        {
          name: newProdName.trim(),
          brand: newBrand.trim() || 'Local Quality',
          category: newCategory,
          unit: newUnit.trim() || '1 unit',
          description,
          standardGSTRate: Number(newGstRate),
          imageUrl,
          shopPricePaise: pricePaise,
          salePricePaise: salePaise,
          stockQuantity: stock,
          externalBillPilotItemId: newSku.trim() || undefined,
        },
        shopId
      );
      setRealtimeListings(dbStore.getListings(shopId));

      // 2. Mirror to Firestore (best effort, same id) - failure must not block the shopkeeper
      createFirestoreProduct({
        id: listing.id,
        shopId,
        name: newProdName.trim(),
        brand: newBrand.trim() || 'Local Quality',
        category: newCategory,
        unit: newUnit.trim() || '1 unit',
        description,
        imageUrl,
        shopPricePaise: pricePaise,
        salePricePaise: salePaise,
        stockQuantity: stock,
        standardGSTRate: Number(newGstRate),
        externalBillPilotItemId: listing.externalBillPilotItemId,
      }).catch((err) => console.warn('Product saved locally; Firestore mirror skipped:', err));

      setIsAddingProduct(false);
      // Reset form
      setNewProdName('');
      setNewBrand('');
      setNewDesc('');
      setNewImageUrl('');
      setNewPriceRupees(100);
      setNewSaleRupees(0);
      setNewStock(20);
      setNewSku('');
      onRefresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add product.';
      setSyncError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Top Header & Real-Time Sync Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">Product Catalogue & Inventory</h1>
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-full border border-emerald-200">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              Live Firestore Sync
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time synchronization active. Price, stock, and product edits reflect immediately on the customer marketplace.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAddingProduct(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product to Store</span>
          </button>
        </div>
      </div>

      {/* Sync / Permission Error Banner */}
      {syncError && (
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{syncError}</span>
          </div>
          <button
            onClick={() => {
              setSyncError(null);
              setRealtimeListings(dbStore.getListings(shopId));
            }}
            className="text-[11px] font-semibold underline text-amber-900 hover:text-amber-700"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-16 text-center space-y-3">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Syncing live store catalogue from Firestore...</p>
        </div>
      ) : realtimeListings.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-3">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto">
            <Package className="w-6 h-6" />
          </div>
          <p className="font-bold text-slate-800 text-sm">No products listed in your store yet</p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Click &quot;Add Product to Store&quot; above to list your first retail item for neighborhood customers.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase">
                <tr>
                  <th className="py-3 px-4">Product Details</th>
                  <th className="py-3 px-4">ERP Item Ref</th>
                  <th className="py-3 px-4 text-right">Shop Price</th>
                  <th className="py-3 px-4 text-right">Sale Price</th>
                  <th className="py-3 px-4 text-right">Stock Qty</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {realtimeListings.map((item) => {
                  const inStock = item.isAvailable && item.stockQuantity > 0;

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Product details */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={item.product.imageUrl}
                            alt={item.product.name}
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 object-cover rounded-lg bg-slate-100 shrink-0"
                          />
                          <div>
                            <p className="font-bold text-slate-900">{item.product.name}</p>
                            <p className="text-[11px] text-slate-500">
                              {item.product.brand} · {item.product.category} · {item.product.unit}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* ERP Mapping */}
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                        {item.externalBillPilotItemId || '—'}
                      </td>

                      {/* Price */}
                      <td className="py-3 px-4 text-right font-medium">
                        <span className="font-mono tabular-nums text-slate-900 font-bold">
                          {formatINR(item.shopPrice)}
                        </span>
                      </td>

                      {/* Sale Price */}
                      <td className="py-3 px-4 text-right">
                        {item.salePrice ? (
                          <span className="font-mono tabular-nums text-emerald-700 font-semibold">
                            {formatINR(item.salePrice)}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono">—</span>
                        )}
                      </td>

                      {/* Stock */}
                      <td className="py-3 px-4 text-right font-semibold">
                        <span
                          className={`font-mono tabular-nums ${
                            item.stockQuantity === 0
                              ? 'text-rose-600 font-bold'
                              : item.stockQuantity <= 5
                              ? 'text-amber-600 font-bold'
                              : 'text-slate-800'
                          }`}
                        >
                          {item.stockQuantity}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            inStock ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {inStock ? 'In Stock' : 'Out of Stock'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => startEdit(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-slate-700 hover:text-blue-600 border border-slate-200 rounded hover:bg-blue-50 transition-colors cursor-pointer font-medium"
                          >
                            <Edit3 className="w-3 h-3" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteListing(item.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                            title="Delete listing"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* FULL EDIT PRODUCT MODAL (Supports Name, Brand, Category, Unit, Image, Description, Price, Stock, Availability) */}
      {editingListing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <form
            onSubmit={handleSaveEdit}
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-xs my-6"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Edit Product & Inventory</h3>
                <p className="text-[11px] text-slate-400">Updates sync in real-time to all customers.</p>
              </div>
              <button
                type="button"
                onClick={() => setEditingListing(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Product Title</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Brand</label>
                <input
                  type="text"
                  value={editBrand}
                  onChange={(e) => setEditBrand(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Category</label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                >
                  <option value="Groceries & Essentials">Groceries & Essentials</option>
                  <option value="Stationery & School Supplies">Stationery & School Supplies</option>
                  <option value="Personal Care & Wellness">Personal Care & Wellness</option>
                  <option value="Household & Kitchen">Household & Kitchen</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Unit Specification</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 1 kg, 500 ml, Pack of 4"
                  value={editUnit}
                  onChange={(e) => setEditUnit(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Regular Price (₹)</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.5"
                  value={editPriceRupees}
                  onChange={(e) => setEditPriceRupees(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Sale Price (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={editSaleRupees}
                  onChange={(e) => setEditSaleRupees(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Stock Quantity</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={editStock}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setEditStock(val);
                    if (val === 0) setEditAvailable(false);
                    else if (val > 0 && !editAvailable) setEditAvailable(true);
                  }}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Stock Availability</label>
                <select
                  value={editAvailable ? 'yes' : 'no'}
                  onChange={(e) => setEditAvailable(e.target.value === 'yes')}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                >
                  <option value="yes">In Stock (Available)</option>
                  <option value="no">Out of Stock (Unavailable)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">BillPilot ERP Item SKU</label>
                <input
                  type="text"
                  placeholder="Optional SKU"
                  value={editSku}
                  onChange={(e) => setEditSku(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Product Image URL</label>
              <input
                type="url"
                value={editImageUrl}
                onChange={(e) => setEditImageUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Product Description</label>
              <textarea
                rows={2}
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingListing(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg cursor-pointer disabled:opacity-50"
              >
                {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Save Changes</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ADD PRODUCT MODAL */}
      {isAddingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
          <form
            onSubmit={handleCreateProduct}
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 text-xs my-6"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Add Product to Store Inventory</h3>
                <p className="text-[11px] text-slate-400">Directly adds to Firestore with real-time sync.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddingProduct(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Product Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sona Masoori Rice"
                  value={newProdName}
                  onChange={(e) => setNewProdName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Brand</label>
                <input
                  type="text"
                  placeholder="e.g. Royal Harvest"
                  value={newBrand}
                  onChange={(e) => setNewBrand(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                >
                  <option value="Groceries & Essentials">Groceries & Essentials</option>
                  <option value="Stationery & School Supplies">Stationery & School Supplies</option>
                  <option value="Personal Care & Wellness">Personal Care & Wellness</option>
                  <option value="Household & Kitchen">Household & Kitchen</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Unit Specification</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 1 kg, 500 ml, Pack of 2"
                  value={newUnit}
                  onChange={(e) => setNewUnit(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Shop Price (₹)</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="0.5"
                  value={newPriceRupees}
                  onChange={(e) => setNewPriceRupees(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Sale Price (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={newSaleRupees}
                  onChange={(e) => setNewSaleRupees(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Initial Stock</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={newStock}
                  onChange={(e) => setNewStock(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Product Image URL</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">BillPilot ERP Item SKU</label>
                <input
                  type="text"
                  placeholder="Optional SKU (e.g. BP-SKU-990)"
                  value={newSku}
                  onChange={(e) => setNewSku(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="font-semibold text-slate-700 block mb-1">Description</label>
              <textarea
                rows={2}
                placeholder="Product description and details..."
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsAddingProduct(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg cursor-pointer disabled:opacity-50"
              >
                {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Add Product to Catalogue</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
