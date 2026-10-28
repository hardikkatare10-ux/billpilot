/**
 * NearBasket - Main Application Entry
 * 
 * Standalone neighborhood commerce platform connecting local customers
 * with neighborhood merchants, shop-managed deliveries, and Dukan Yantra ERP sync.
 */

import React, { useState, useEffect } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider, useCart } from './context/CartContext';
import { LocationProvider } from './context/LocationContext';
import { dbStore } from './services/db/store';
import { subscribeToShopProducts } from './services/firebase/productService';
import { Order, Shop } from './types';
import { Navbar } from './components/common/Navbar';
import { AuthModal } from './components/common/AuthModal';
import { LocationModal } from './components/common/LocationModal';
import { ShopDiscovery } from './components/customer/ShopDiscovery';
import { ShopDetail } from './components/customer/ShopDetail';
import { CartDrawer } from './components/customer/CartDrawer';
import { CheckoutModal } from './components/customer/CheckoutModal';
import { OrderTracking } from './components/customer/OrderTracking';
import { CustomerOrders } from './components/customer/CustomerOrders';
import { DisputeModal } from './components/customer/DisputeModal';
import { ShopDashboard } from './components/shopkeeper/ShopDashboard';
import { ShopInventory } from './components/shopkeeper/ShopInventory';
import { ShopSettings } from './components/shopkeeper/ShopSettings';
import { BillPilotSyncHub } from './components/shopkeeper/BillPilotSyncHub';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { LogIn } from 'lucide-react';

const GOOGLE_MAPS_API_KEY = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '';

const MainLayout: React.FC = () => {
  const { currentUser, isApprovedShopkeeper, openAuthModal } = useAuth();
  const { setIsCartDrawerOpen } = useCart();

  // Navigation state
  const [currentTab, setCurrentTab] = useState<string>('discover');
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [disputeOrder, setDisputeOrder] = useState<Order | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  useEffect(() => {
    const handleQuota = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuota);
  }, []);

  // Reactive DB store state
  const [, setDataVersion] = useState(0);
  const refreshData = () => setDataVersion((v) => v + 1);

  useEffect(() => dbStore.subscribe(refreshData), []);

  useEffect(() => {
    if (!selectedShopId) return;
    return subscribeToShopProducts(
      selectedShopId,
      () => {},
      (error) => console.error(`Marketplace product sync failed for shop ${selectedShopId}:`, error)
    );
  }, [selectedShopId]);

  // Sync tab when user logs in or role changes
  useEffect(() => {
    if (!currentUser || currentUser.role === 'customer') {
      setCurrentTab('discover');
    } else if (currentUser.role === 'shopkeeper' && isApprovedShopkeeper) {
      setCurrentTab('shop_dashboard');
    } else if (currentUser.role === 'admin') {
      setCurrentTab('admin');
    } else {
      setCurrentTab('discover');
    }
  }, [currentUser, isApprovedShopkeeper]);

  const shops = dbStore.getShops();
  const allOrders = dbStore.getOrders();
  const userOrders = currentUser
    ? dbStore.getOrders({ customerId: currentUser.id })
    : [];
  const disputes = dbStore.getReturnRequests();
  const syncEvents = dbStore.getSyncEvents();
  const auditLogs = dbStore.getAuditLogs();
  const commissionLedger = dbStore.getCommissionLedger();

  // Selected shop for customer view
  const currentSelectedShop = selectedShopId
    ? dbStore.getShopById(selectedShopId)
    : null;
  const currentShopListings = selectedShopId
    ? dbStore.getListings(selectedShopId)
    : [];

  // Shop for active shopkeeper persona
  const activeShopkeeperShop = currentUser?.shopId
    ? dbStore.getShopById(currentUser.shopId) || shops[0] || null
    : shops[0] || null;
  const activeShopOrders = activeShopkeeperShop
    ? dbStore.getOrders({ shopId: activeShopkeeperShop.id })
    : [];
  const activeShopListings = activeShopkeeperShop
    ? dbStore.getListings(activeShopkeeperShop.id)
    : [];
  const activeShopSyncEvents = activeShopkeeperShop
    ? dbStore.getSyncEvents(activeShopkeeperShop.id)
    : [];

  // Order for tracking
  const trackedOrder = selectedOrderId
    ? allOrders.find((o) => o.id === selectedOrderId) || null
    : null;

  const handleSelectShop = (shopId: string) => {
    setSelectedShopId(shopId);
    setCurrentTab('shop_detail');
  };

  const handleSelectOrder = (order: Order) => {
    setSelectedOrderId(order.id);
    setCurrentTab('order_tracking');
  };

  const handleOrderPlaced = (orderId: string) => {
    setIsCheckoutOpen(false);
    setSelectedOrderId(orderId);
    setCurrentTab('order_tracking');
    refreshData();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Google Maps Quota Warning Banner */}
      {quotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2 text-xs md:text-sm text-center sticky top-0 z-50 shadow-xs">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* Top Bar Navigation */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          if (tab === 'discover') setSelectedShopId(null);
        }}
      />

      {/* Main Viewport Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-6">
        {/* CUSTOMER & GUEST VIEWS */}
        {(!currentUser || currentUser.role === 'customer' || !isApprovedShopkeeper) && (
          <>
            {currentTab === 'discover' && (
              <ShopDiscovery shops={shops} onSelectShop={handleSelectShop} />
            )}

            {currentTab === 'shop_detail' && currentSelectedShop && (
              <ShopDetail
                shop={currentSelectedShop}
                listings={currentShopListings}
                onBack={() => {
                  setSelectedShopId(null);
                  setCurrentTab('discover');
                }}
              />
            )}

            {currentTab === 'orders' && (
              currentUser ? (
                <CustomerOrders
                  orders={userOrders}
                  onSelectOrder={handleSelectOrder}
                  onOpenDispute={(order) => setDisputeOrder(order)}
                />
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-md mx-auto space-y-4 my-12">
                  <h2 className="text-base font-bold text-slate-900">Sign In to View Orders</h2>
                  <p className="text-xs text-slate-500">
                    Sign in with your email address to track your active local deliveries and view past tax invoices.
                  </p>
                  <button
                    onClick={() => openAuthModal('login')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
                  >
                    <LogIn className="w-4 h-4" />
                    Sign In to Account
                  </button>
                </div>
              )
            )}

            {currentTab === 'order_tracking' && trackedOrder && (
              <OrderTracking
                order={trackedOrder}
                onBack={() => setCurrentTab('orders')}
                onOrderUpdated={refreshData}
                onOpenDispute={(order) => setDisputeOrder(order)}
              />
            )}
          </>
        )}

        {/* SHOPKEEPER VIEWS */}
        {currentUser?.role === 'shopkeeper' && isApprovedShopkeeper && (
          activeShopkeeperShop ? (
            <>
              {currentTab === 'shop_dashboard' && (
                <ShopDashboard
                  shop={activeShopkeeperShop}
                  orders={activeShopOrders}
                  onRefreshOrders={refreshData}
                />
              )}

              {currentTab === 'shop_inventory' && (
                <ShopInventory
                  shopId={activeShopkeeperShop.id}
                  listings={activeShopListings}
                  onRefresh={refreshData}
                />
              )}

              {currentTab === 'shop_settings' && (
                <ShopSettings shop={activeShopkeeperShop} onRefresh={refreshData} />
              )}

              {currentTab === 'shop_sync' && (
                <BillPilotSyncHub
                  shop={activeShopkeeperShop}
                  events={activeShopSyncEvents}
                  onRefresh={refreshData}
                />
              )}
            </>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-md mx-auto space-y-4 my-12">
              <h2 className="text-base font-bold text-slate-900">No Store Linked</h2>
              <p className="text-xs text-slate-500">
                You do not have a store registered to this account yet. Register your store to start selling to local neighborhood customers.
              </p>
              <button
                onClick={() => openAuthModal('register_shopkeeper')}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                Register Your Store
              </button>
            </div>
          )
        )}

        {/* ADMIN VIEWS */}
        {currentUser?.role === 'admin' && (
          <AdminDashboard
            shops={shops}
            orders={allOrders}
            disputes={disputes}
            syncEvents={syncEvents}
            auditLogs={auditLogs}
            commissionLedger={commissionLedger}
            onRefreshData={refreshData}
          />
        )}
      </main>

      {/* Global Drawers & Modals */}
      <CartDrawer
        onProceedToCheckout={() => {
          setIsCartDrawerOpen(false);
          if (!currentUser) {
            openAuthModal('login');
          } else {
            setIsCheckoutOpen(true);
          }
        }}
      />

      {isCheckoutOpen && (
        <CheckoutModal
          onClose={() => setIsCheckoutOpen(false)}
          onOrderPlaced={handleOrderPlaced}
        />
      )}

      {disputeOrder && (
        <DisputeModal
          order={disputeOrder}
          onClose={() => setDisputeOrder(null)}
          onSubmitted={() => {
            setDisputeOrder(null);
            refreshData();
          }}
        />
      )}

      {/* Sign In & Registration Modal */}
      <AuthModal />

      {/* Swiggy-Style Locality Selection Modal */}
      <LocationModal />
    </div>
  );
};

export default function App() {
  return (
    <APIProvider
      apiKey={GOOGLE_MAPS_API_KEY}
      region="IN"
      language="en"
      libraries={['places', 'marker']}
    >
      <AuthProvider>
        <LocationProvider>
          <CartProvider>
            <MainLayout />
          </CartProvider>
        </LocationProvider>
      </AuthProvider>
    </APIProvider>
  );
}
