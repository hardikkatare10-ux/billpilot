/**
 * BillPilot - Unified Master Application
 * 
 * Unifies BillPilot (Shopkeeper ERP, POS, Billing, Inventory) and
 * BillPilot Local (Consumer Marketplace, Neighborhood Store Discovery, Orders)
 * into ONE cohesive production web application with shared Firebase backend,
 * role-based authorization, route guards, and blue-and-white BillPilot branding.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import { UnifiedAuthProvider, useUnifiedAuth } from './context/UnifiedAuthContext';
import { AuthProvider, useAuth } from './marketplace/context/AuthContext';
import { LocationProvider, useLocation } from './marketplace/context/LocationContext';
import { CartProvider, useCart } from './marketplace/context/CartContext';
import { dbStore } from './marketplace/services/db/store';
import { startShopSync } from './marketplace/services/firebase/shopService';
import { subscribeToOrders } from './marketplace/services/firebase/orderService';
import { Order, Shop } from './marketplace/types';

// Components
import App from './app/App';
import { Navbar } from './marketplace/components/common/Navbar';
import { AuthModal } from './marketplace/components/common/AuthModal';
import { LocationModal } from './marketplace/components/common/LocationModal';
import { ShopDiscovery } from './marketplace/components/customer/ShopDiscovery';
import { ShopDetail } from './marketplace/components/customer/ShopDetail';
import { CartDrawer } from './marketplace/components/customer/CartDrawer';
import { CheckoutModal } from './marketplace/components/customer/CheckoutModal';
import { OrderTracking } from './marketplace/components/customer/OrderTracking';
import { CustomerOrders } from './marketplace/components/customer/CustomerOrders';
import { DisputeModal } from './marketplace/components/customer/DisputeModal';
import { AdminDashboard } from './marketplace/components/admin/AdminDashboard';

// Icons
import {
  Store,
  ShieldCheck,
  Clock,
  AlertCircle,
  ArrowRight,
  LogIn,
  ShoppingBag,
  Sparkles,
  Building2,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';

const GOOGLE_MAPS_API_KEY = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '';

// Route mapper from path to shopkeeper tab
function pathToShopkeeperTab(pathname: string): any {
  if (pathname.includes('/shopkeeper/billing')) return 'cashsale';
  if (pathname.startsWith('/shopkeeper/fulfillment')) return 'local_orders';
  if (pathname.includes('/shopkeeper/products')) return 'inventory';
  if (pathname.includes('/shopkeeper/inventory')) return 'inventory';
  if (pathname.includes('/shopkeeper/customers')) return 'customers';
  if (pathname.includes('/shopkeeper/invoices')) return 'invoices';
  if (pathname.includes('/shopkeeper/local/products')) return 'local_products';
  if (pathname.includes('/shopkeeper/local/orders')) return 'local_orders';
  if (pathname.includes('/shopkeeper/local')) return 'local_dashboard';
  if (pathname.includes('/shopkeeper/settings')) return 'settings';
  return 'dashboard';
}

function shopkeeperTabToPath(tab: string): string {
  switch (tab) {
    case 'cashsale':
    case 'invoice':
      return '/shopkeeper/billing';
    case 'inventory':
      return '/shopkeeper/inventory';
    case 'customers':
      return '/shopkeeper/customers';
    case 'invoices':
      return '/shopkeeper/invoices';
    case 'local_dashboard':
      return '/shopkeeper/local';
    case 'local_products':
      return '/shopkeeper/local/products';
    case 'local_orders':
      return '/shopkeeper/fulfillment';
    case 'settings':
      return '/shopkeeper/settings';
    default:
      return '/shopkeeper/dashboard';
  }
}

const MainAppContent: React.FC = () => {
  const {
    currentUser,
    isApprovedShopkeeper,
    isAdmin,
    activeMode,
    setActiveMode,
    logout,
    setShopVerification,
  } = useUnifiedAuth();
  const { openAuthModal } = useAuth();
  const { setIsCartDrawerOpen } = useCart();
  const orderShopId = currentUser
    ? dbStore.getShops().find(
        (shop) => shop.email.trim().toLowerCase() === currentUser.email.trim().toLowerCase()
      )?.id ||
      currentUser.shopId ||
      dbStore.getShops().find((shop) => shop.ownerId === currentUser.id)?.id
    : undefined;

  // URL state management (supports both pathname and hash)
  const getInitialRoute = (): string => {
    const hash = window.location.hash.replace(/^#/, '');
    if (hash) return hash;
    const path = window.location.pathname;
    if (path && path !== '/') return path;
    return '/consumer';
  };

  const [currentRoute, setCurrentRoute] = useState<string>(getInitialRoute);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [disputeOrder, setDisputeOrder] = useState<Order | null>(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [orderSyncError, setOrderSyncError] = useState<string | null>(null);

  const navigate = useCallback((to: string) => {
    setCurrentRoute(to);
    window.history.pushState(null, '', to);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const switchAccount = async () => {
    try {
      await logout();
      setActiveMode('consumer');
      navigate('/consumer');
      openAuthModal('login');
    } catch (error: unknown) {
      window.alert(error instanceof Error ? error.message : 'Unable to switch accounts. Please try again.');
    }
  };

  // Re-render whenever the local store changes (incl. shops arriving from Firestore).
  const [, setRefreshTick] = useState(0);
  const refreshGlobal = useCallback(() => setRefreshTick((t) => t + 1), []);
  useEffect(() => {
    const unsubStore = dbStore.subscribe(refreshGlobal);
    const unsubShops = startShopSync();
    return () => {
      unsubStore();
      unsubShops();
    };
  }, [refreshGlobal]);

  useEffect(() => {
    if (!currentUser) return;
    setOrderSyncError(null);
    if (isApprovedShopkeeper && !orderShopId) {
      setOrderSyncError('No marketplace shop is linked to this merchant account.');
      return;
    }
    return subscribeToOrders(currentUser.id, orderShopId, (error) => {
      setOrderSyncError(`Marketplace orders could not be loaded: ${error.message}`);
    });
  }, [currentUser?.id, orderShopId, isApprovedShopkeeper]);

  // Sync route on popstate
  useEffect(() => {
    const handlePopState = () => {
      setCurrentRoute(getInitialRoute());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (
      currentUser?.requestedRole === 'shopkeeper' &&
      !isApprovedShopkeeper &&
      !window.location.pathname.startsWith('/shopkeeper')
    ) {
      navigate('/shopkeeper/dashboard');
    }
  }, [currentUser, isApprovedShopkeeper, navigate]);

  // Determine active view from currentRoute
  const isShopkeeperRoute = currentRoute.startsWith('/shopkeeper');
  const isAdminRoute = currentRoute.startsWith('/admin');

  // Reactive DB data
  const shops = dbStore.getShops();
  const allOrders = dbStore.getOrders();
  const userOrders = currentUser
    ? dbStore.getOrders({ customerId: currentUser.id })
    : [];
  const currentSelectedShop = selectedShopId ? dbStore.getShopById(selectedShopId) : null;
  const currentShopListings = selectedShopId ? dbStore.getListings(selectedShopId) : [];

  const trackedOrder = selectedOrderId
    ? allOrders.find((o) => o.id === selectedOrderId) || null
    : null;

  // Handle direct navigation to /login, /signup, /select-role
  useEffect(() => {
    if (currentRoute === '/login') {
      openAuthModal('login');
      navigate('/consumer');
    } else if (currentRoute === '/signup') {
      openAuthModal('register_customer');
      navigate('/consumer');
    } else if (currentRoute === '/select-role') {
      openAuthModal('register_shopkeeper');
      navigate('/consumer');
    }
  }, [currentRoute, openAuthModal, navigate]);

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. SHOPKEEPER ROUTE GUARD & INTERFACE
  // ─────────────────────────────────────────────────────────────────────────────
  if (isShopkeeperRoute) {
    // A. User not logged in
    if (!currentUser) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-6 text-center">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 space-y-5">
            <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <Store className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">BillPilot Merchant Portal</h2>
              <p className="text-xs text-slate-500 mt-1">
                Please sign in to access your billing, inventory, and marketplace operations.
              </p>
            </div>
            <div className="pt-2 flex flex-col gap-2.5">
              <button
                onClick={() => openAuthModal('login')}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
              >
                <LogIn className="w-4 h-4" />
                Sign In to Merchant Account
              </button>
              <button
                onClick={() => navigate('/consumer')}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors cursor-pointer"
              >
                Browse Marketplace as Consumer
              </button>
            </div>
          </div>
          <AuthModal />
        </div>
      );
    }

    // B. User logged in, but not an approved shopkeeper (Safe Approval Enforcement)
    if (!isApprovedShopkeeper) {
      const isPending = currentUser.shopkeeperStatus === 'pending';
      const isRejected = currentUser.shopkeeperStatus === 'rejected';

      return (
        <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-6 text-center">
          <div className="max-w-lg w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 space-y-6">
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-inner ${
                isPending
                  ? 'bg-amber-50 text-amber-600'
                  : isRejected
                  ? 'bg-rose-50 text-rose-600'
                  : 'bg-blue-50 text-blue-600'
              }`}
            >
              {isPending ? (
                <Clock className="w-8 h-8" />
              ) : isRejected ? (
                <AlertCircle className="w-8 h-8" />
              ) : (
                <Building2 className="w-8 h-8" />
              )}
            </div>

            <div className="space-y-2">
              <span
                className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                  isPending
                    ? 'bg-amber-100 text-amber-800'
                    : isRejected
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-blue-100 text-blue-800'
                }`}
              >
                {isPending
                  ? 'Verification Under Review'
                  : isRejected
                  ? 'Application Not Approved'
                  : 'Merchant Account Required'}
              </span>
              <h2 className="text-xl font-black text-slate-900 mt-2">
                {isPending
                  ? 'Merchant Application in Progress'
                  : isRejected
                  ? 'Verification Unsuccessful'
                  : 'Register as a BillPilot Shopkeeper'}
              </h2>
              <p className="text-xs text-slate-600 leading-relaxed max-w-md mx-auto">
                {isPending
                  ? 'Your store registration has been securely submitted to BillPilot administrators. For consumer trust and safety, merchant privileges require physical business verification (GSTIN/Trade License).'
                  : isRejected
                  ? 'Your application could not be verified with the provided documents. Please reach out to administrative support.'
                  : 'To protect inventory records and transaction integrity, shopkeeper privileges are granted exclusively to verified local store owners.'}
              </p>
            </div>

            {isPending && currentUser.shopName && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left space-y-2 text-xs">
                <div className="flex justify-between items-center text-slate-500">
                  <span>Store Name:</span>
                  <span className="font-bold text-slate-900">{currentUser.shopName}</span>
                </div>
                {currentUser.gstin && (
                  <div className="flex justify-between items-center text-slate-500">
                    <span>GSTIN / License:</span>
                    <span className="font-mono text-slate-800">{currentUser.gstin}</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-slate-500">
                  <span>Estimated Review:</span>
                  <span className="font-semibold text-amber-700">Within 24 Hours</span>
                </div>
              </div>
            )}

            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              {!isPending && !isRejected && (
                <button
                  onClick={() => openAuthModal('register_shopkeeper')}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Store className="w-4 h-4" />
                  Apply for Merchant Verification
                </button>
              )}
              <button
                onClick={() => navigate('/consumer')}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4" />
                Browse Local Marketplace
              </button>
            </div>
          </div>
          <AuthModal />
        </div>
      );
    }

    // C. Approved Shopkeeper: Full access to Shopkeeper ERP + Local Marketplace Management
    const initialShopTab = pathToShopkeeperTab(currentRoute);

    return (
      <div className="h-screen w-screen overflow-hidden flex flex-col bg-slate-50">
        {orderSyncError && (
          <div role="alert" className="shrink-0 bg-rose-50 border-b border-rose-200 px-4 py-2 text-xs text-rose-800">
            {orderSyncError}
          </div>
        )}
        {/* Top Banner indicating Approved Shopkeeper Persona & quick switch */}
        <div className="bg-[#0b1b3d] text-white px-4 py-1.5 text-xs flex items-center justify-between shrink-0 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-medium text-blue-200">
              Merchant Suite · <strong className="text-white">{currentUser.shopName || 'Verified Merchant'}</strong>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setActiveMode('consumer');
                navigate('/consumer');
              }}
              className="text-xs text-blue-300 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
            >
              <Store className="w-3.5 h-3.5 text-blue-400" />
              <span>Preview Customer Marketplace</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Master Shopkeeper ERP (BillPilot) */}
        <div className="flex-1 overflow-hidden">
          <App
            firebaseUser={{
              username: currentUser.name,
              shopName: currentUser.shopName || '',
              phone: currentUser.phone,
              email: currentUser.email,
            }}
            initialTab={initialShopTab}
            onTabChange={(t) => {
              const nextPath = shopkeeperTabToPath(t);
              if (nextPath !== currentRoute) {
                navigate(nextPath);
              }
            }}
            onSwitchToConsumer={() => {
              setActiveMode('consumer');
              navigate('/consumer');
            }}
            onFirebaseLogout={switchAccount}
          />
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. ADMIN ROUTE
  // ─────────────────────────────────────────────────────────────────────────────
  if (isAdminRoute) {
    if (!isAdmin) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-6 text-center">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 space-y-4">
            <AlertCircle className="w-12 h-12 text-rose-600 mx-auto" />
            <h2 className="text-lg font-bold text-slate-900">Access Restricted</h2>
            <p className="text-xs text-slate-500">
              Administrator privileges required to view marketplace directory & verify merchants.
            </p>
            <button
              onClick={() => navigate('/consumer')}
              className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold"
            >
              Back to Marketplace
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar
          currentTab="admin"
          onSelectTab={(t) => {
            if (t === 'discover') navigate('/consumer');
            if (t === 'orders') navigate('/consumer/orders');
          }}
        />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 space-y-8">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <h1 className="text-xl font-black text-slate-900">Marketplace Administration</h1>
              <p className="text-xs text-slate-500">
                Verify merchant shop applications, configure delivery areas, and monitor order commissions.
              </p>
            </div>
            <button
              onClick={() => navigate('/consumer')}
              className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-semibold cursor-pointer"
            >
              Exit Admin
            </button>
          </div>

          <AdminDashboard
            shops={shops}
            orders={allOrders}
            disputes={dbStore.getReturnRequests()}
            syncEvents={dbStore.getSyncEvents()}
            auditLogs={dbStore.getAuditLogs()}
            commissionLedger={dbStore.getCommissionLedger()}
            onRefreshData={refreshGlobal}
            onShopStatusChange={async (shopId, status, notes) => {
              await setShopVerification(shopId, status, notes);
            }}
          />
        </main>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. CONSUMER MARKETPLACE ROUTE (Default)
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Banner if logged-in user is an approved merchant browsing customer view */}
      {isApprovedShopkeeper && (
        <div className="bg-blue-600 text-white px-4 py-2 text-xs flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-2">
            <Store className="w-4 h-4" />
            <span>
              You are browsing BillPilot Local as a customer. Ready to manage billing & store orders?
            </span>
          </div>
          <button
            onClick={() => navigate('/shopkeeper/dashboard')}
            className="px-3 py-1 bg-white text-blue-700 font-bold rounded-lg text-xs hover:bg-blue-50 transition-colors cursor-pointer shadow-xs"
          >
            Open Merchant Portal →
          </button>
        </div>
      )}

      {/* Shared Navigation Header */}
      <Navbar
        currentTab={currentRoute.includes('orders') ? 'orders' : 'discover'}
        onSelectTab={(tab) => {
          if (tab === 'discover') {
            setSelectedShopId(null);
            setSelectedOrderId(null);
            navigate('/consumer');
          } else if (tab === 'orders') {
            setSelectedShopId(null);
            setSelectedOrderId(null);
            navigate('/consumer/orders');
          } else if (tab === 'shop_dashboard') {
            navigate('/shopkeeper/dashboard');
          } else if (tab === 'shop_inventory') {
            navigate('/shopkeeper/inventory');
          } else if (tab === 'admin') {
            navigate('/admin');
          }
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {/* Tracking single order modal / view */}
        {trackedOrder && (
          <div className="mb-6">
            <OrderTracking
              order={trackedOrder}
              onBack={() => setSelectedOrderId(null)}
              onOrderUpdated={refreshGlobal}
              onOpenDispute={(order) => setDisputeOrder(order)}
            />
          </div>
        )}

        {/* View 1: Shop Detail View */}
        {!trackedOrder && selectedShopId && currentSelectedShop && (
          <ShopDetail
            shop={currentSelectedShop}
            listings={currentShopListings}
            onBack={() => {
              setSelectedShopId(null);
              navigate('/consumer');
            }}
          />
        )}

        {/* View 2: Customer Orders View */}
        {!trackedOrder && !selectedShopId && currentRoute.includes('orders') && (
          <CustomerOrders
            orders={userOrders}
            onSelectOrder={(order) => setSelectedOrderId(order.id)}
            onOpenDispute={(order) => setDisputeOrder(order)}
          />
        )}

        {/* View 3: Marketplace Shop Discovery Storefront (Default) */}
        {!trackedOrder && !selectedShopId && !currentRoute.includes('orders') && (
          <ShopDiscovery
            shops={shops}
            onSelectShop={(shopId) => {
              setSelectedShopId(shopId);
              navigate('/consumer/products');
            }}
          />
        )}
      </main>

      {/* Global Modals & Drawers */}
      <CartDrawer onProceedToCheckout={() => setIsCheckoutOpen(true)} />

      {isCheckoutOpen && (
        <CheckoutModal
          onClose={() => setIsCheckoutOpen(false)}
          onOrderPlaced={(orderId) => {
            setIsCheckoutOpen(false);
            setSelectedOrderId(orderId);
            navigate('/consumer/orders');
          }}
        />
      )}

      {disputeOrder && (
        <DisputeModal
          order={disputeOrder}
          onClose={() => setDisputeOrder(null)}
          onSubmitSuccess={() => {
            setDisputeOrder(null);
            refreshGlobal();
          }}
        />
      )}

      <AuthModal />
      <LocationModal />
    </div>
  );
};

export default function UnifiedApp() {
  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
      <UnifiedAuthProvider>
        <AuthProvider>
          <LocationProvider>
            <CartProvider>
              <MainAppContent />
            </CartProvider>
          </LocationProvider>
        </AuthProvider>
      </UnifiedAuthProvider>
    </APIProvider>
  );
}
