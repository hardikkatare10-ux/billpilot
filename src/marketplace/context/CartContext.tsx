/**
 * NearBasket - Single-Shop Cart Context
 * 
 * Enforces strict single-shop ordering with explicit cross-shop warning modals.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { CartItem, MinorUnits, Shop } from '../types';
import { dbStore } from '../services/db/store';
import { subscribeToShopProducts } from '../services/firebase/productService';

interface PendingShopSwitch {
  newShopId: string;
  newShopName: string;
  pendingItem: {
    listingId: string;
    productId: string;
    productName: string;
    unit: string;
    unitPrice: MinorUnits;
    imageUrl: string;
  };
}

interface CartContextType {
  shopId: string | null;
  currentShop: Shop | null;
  items: CartItem[];
  itemCount: number;
  subtotal: MinorUnits;
  addItem: (
    shopId: string,
    shopName: string,
    item: {
      listingId: string;
      productId: string;
      productName: string;
      unit: string;
      unitPrice: MinorUnits;
      imageUrl: string;
    }
  ) => void;
  updateQuantity: (listingId: string, delta: number) => void;
  removeItem: (listingId: string) => void;
  clearCart: () => void;
  isCartDrawerOpen: boolean;
  setIsCartDrawerOpen: (open: boolean) => void;
  pendingSwitch: PendingShopSwitch | null;
  confirmShopSwitch: () => void;
  cancelShopSwitch: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = 'billpilot_local_cart';

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [shopId, setShopId] = useState<string | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
  const [pendingSwitch, setPendingSwitch] = useState<PendingShopSwitch | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.shopId && Array.isArray(parsed.items)) {
          setShopId(parsed.shopId);
          setItems(parsed.items);
        }
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  // Save changes
  useEffect(() => {
    try {
      if (shopId && items.length > 0) {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ shopId, items }));
      } else {
        localStorage.removeItem(CART_STORAGE_KEY);
      }
    } catch {
      // Memory fallback
    }
  }, [shopId, items]);

  // Real-time synchronization of active cart items with Firestore product updates (price, stock, availability)
  useEffect(() => {
    if (!shopId) return;

    const unsubscribe = subscribeToShopProducts(shopId, (freshListings) => {
      setItems((prevItems) => {
        let hasChanges = false;
        const updated = prevItems.map((cartItem) => {
          const fresh = freshListings.find((l) => l.id === cartItem.listingId);
          if (fresh) {
            const effectivePrice =
              fresh.salePrice && fresh.salePrice > 0 ? fresh.salePrice : fresh.shopPrice;
            const isOutOfStock = !fresh.isAvailable || fresh.stockQuantity <= 0;

            if (
              cartItem.unitPrice !== effectivePrice ||
              cartItem.productName !== fresh.product.name ||
              cartItem.imageUrl !== fresh.product.imageUrl ||
              cartItem.isOutOfStock !== isOutOfStock ||
              cartItem.availableStock !== fresh.stockQuantity
            ) {
              hasChanges = true;
              return {
                ...cartItem,
                unitPrice: effectivePrice,
                productName: fresh.product.name,
                imageUrl: fresh.product.imageUrl,
                isOutOfStock,
                availableStock: fresh.stockQuantity,
              };
            }
          }
          return cartItem;
        });
        return hasChanges ? updated : prevItems;
      });
    });

    return () => {
      unsubscribe();
    };
  }, [shopId]);

  const currentShop = shopId ? dbStore.getShopById(shopId) || null : null;

  const addItem = (
    itemShopId: string,
    itemShopName: string,
    itemData: {
      listingId: string;
      productId: string;
      productName: string;
      unit: string;
      unitPrice: MinorUnits;
      imageUrl: string;
    }
  ) => {
    // Check if cart has items from another shop
    if (shopId && shopId !== itemShopId && items.length > 0) {
      setPendingSwitch({
        newShopId: itemShopId,
        newShopName: itemShopName,
        pendingItem: itemData,
      });
      return;
    }

    setShopId(itemShopId);
    setItems((prev) => {
      const existing = prev.find((i) => i.listingId === itemData.listingId);
      if (existing) {
        return prev.map((i) =>
          i.listingId === itemData.listingId ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          ...itemData,
          shopId: itemShopId,
          quantity: 1,
        },
      ];
    });
  };

  const confirmShopSwitch = () => {
    if (!pendingSwitch) return;
    const { newShopId, pendingItem } = pendingSwitch;

    // Clear previous shop cart and add the new item
    setShopId(newShopId);
    setItems([
      {
        ...pendingItem,
        shopId: newShopId,
        quantity: 1,
      },
    ]);
    setPendingSwitch(null);
  };

  const cancelShopSwitch = () => {
    setPendingSwitch(null);
  };

  const updateQuantity = (listingId: string, delta: number) => {
    setItems((prev) => {
      const updated = prev
        .map((item) => {
          if (item.listingId === listingId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter((item): item is CartItem => item !== null);

      if (updated.length === 0) {
        setShopId(null);
      }
      return updated;
    });
  };

  const removeItem = (listingId: string) => {
    setItems((prev) => {
      const updated = prev.filter((i) => i.listingId !== listingId);
      if (updated.length === 0) {
        setShopId(null);
      }
      return updated;
    });
  };

  const clearCart = () => {
    setItems([]);
    setShopId(null);
  };

  const itemCount = items.reduce((acc, i) => acc + i.quantity, 0);
  const subtotal = items.reduce((acc, i) => acc + i.unitPrice * i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        shopId,
        currentShop,
        items,
        itemCount,
        subtotal,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        isCartDrawerOpen,
        setIsCartDrawerOpen,
        pendingSwitch,
        confirmShopSwitch,
        cancelShopSwitch,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
};
