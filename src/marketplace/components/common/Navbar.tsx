/**
 * NearBasket - Navigation Bar
 * 
 * Strict 3-Zone Top Bar Contract with single-element brand wordmark,
 * concise single-line nav links, cart drawer trigger, and clean Sign In / User menu.
 */

import React, { useState } from 'react';
import { ShoppingBag, UserCheck, ChevronDown, Bell, LogIn, LogOut, Store, Plus, MapPin } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { useLocation } from '../../context/LocationContext';
import { formatINR } from '../../utils/formatters';
import { dbStore } from '../../services/db/store';
import nearBasketLogo from '../../assets/nearbasket-logo.png';

interface NavbarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onSelectTab }) => {
  const { currentUser, allUsers, isApprovedShopkeeper, switchUser, logout, openAuthModal } = useAuth();
  const { itemCount, subtotal, setIsCartDrawerOpen } = useCart();
  const { location, openLocationModal } = useLocation();
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const notifications = currentUser ? dbStore.getNotifications(currentUser.id) : [];
  const unreadNotifCount = notifications.filter((n) => !n.read).length;

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-4 h-16">
        {/* Zone 1: Brand Wordmark & Location Selector */}
        <div className="flex items-center gap-4 sm:gap-6 shrink-0">
          <button
            onClick={() => onSelectTab('discover')}
            className="flex items-center gap-2 text-lg md:text-xl font-black tracking-tight text-blue-600 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <img src={nearBasketLogo} alt="NearBasket logo" className="w-9 h-9 sm:w-10 sm:h-10 object-contain shrink-0" />
            <span>NearBasket</span>
          </button>

          {/* Delivery Location Widget (Swiggy-Style) */}
          <button
            onClick={openLocationModal}
            className="flex items-center gap-1.5 text-xs text-left max-w-[150px] sm:max-w-[240px] px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer group"
            title="Change delivery locality"
          >
            <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
            <div className="truncate">
              <div className="flex items-center gap-1">
                <span className="font-extrabold text-slate-900 truncate">
                  {location ? (location.subLocality || location.locality) : 'Select Locality'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-700 shrink-0" />
              </div>
              <span className="text-[10px] text-slate-500 truncate block">
                {location ? `${location.city} ${location.pincode ? `· ${location.pincode}` : ''}` : 'Choose area'}
              </span>
            </div>
          </button>
        </div>

        {/* Zone 2: Navigation Links (Single-line whitespace-nowrap) */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-600">
          {(!currentUser || currentUser.role === 'customer' || !isApprovedShopkeeper) && (
            <>
              <button
                onClick={() => onSelectTab('discover')}
                className={`hover:text-blue-600 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  currentTab === 'discover' ? 'text-blue-600 font-bold' : ''
                }`}
              >
                Discover Stores
              </button>
              {currentUser && (
                <button
                  onClick={() => onSelectTab('orders')}
                  className={`hover:text-blue-600 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    currentTab === 'orders' ? 'text-blue-600 font-bold' : ''
                  }`}
                >
                  My Orders
                </button>
              )}
            </>
          )}

          {currentUser?.role === 'shopkeeper' && isApprovedShopkeeper && (
            <>
              <button
                onClick={() => onSelectTab('shop_dashboard')}
                className={`hover:text-blue-600 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  currentTab === 'shop_dashboard' ? 'text-blue-600 font-bold' : ''
                }`}
              >
                Live Orders
              </button>
              <button
                onClick={() => onSelectTab('shop_inventory')}
                className={`hover:text-blue-600 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  currentTab === 'shop_inventory' ? 'text-blue-600 font-bold' : ''
                }`}
              >
                Inventory & Stock
              </button>
              <button
                onClick={() => onSelectTab('shop_settings')}
                className={`hover:text-blue-600 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  currentTab === 'shop_settings' ? 'text-blue-600 font-bold' : ''
                }`}
              >
                Delivery Settings
              </button>
              <button
                onClick={() => onSelectTab('shop_sync')}
                className={`hover:text-blue-600 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  currentTab === 'shop_sync' ? 'text-blue-600 font-bold' : ''
                }`}
              >
                Dukan Yantra Sync
              </button>
            </>
          )}

          {currentUser?.role === 'admin' && (
            <>
              <button
                onClick={() => onSelectTab('admin')}
                className={`hover:text-blue-600 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  currentTab === 'admin' ? 'text-blue-600 font-bold' : ''
                }`}
              >
                Marketplace Hub
              </button>
            </>
          )}
        </nav>

        {/* Zone 3: Actions, Sign In / User Account & Shopping Bag */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Notifications (if signed in) */}
          {currentUser && (
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors relative cursor-pointer"
                aria-label="View notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadNotifCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-600 rounded-full" />
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-3 space-y-2 text-xs z-50">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <span className="font-bold text-slate-900">Notifications</span>
                    <span className="text-[10px] text-slate-400">Doorstep Alerts</span>
                  </div>
                  {notifications.length === 0 ? (
                    <p className="text-slate-500 text-center py-4">No notifications yet</p>
                  ) : (
                    <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
                      {notifications.map((n) => (
                        <div key={n.id} className="py-2 space-y-0.5">
                          <p className="font-semibold text-slate-900">{n.title}</p>
                          <p className="text-slate-500 text-[11px]">{n.message}</p>
                          <p className="text-[10px] text-slate-400">
                            {new Date(n.createdAt).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* User Sign In / Account Dropdown */}
          {!currentUser ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => openAuthModal('login')}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            </div>
          ) : (
            <div className="relative">
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200/80 rounded-lg text-xs font-medium text-slate-800 transition-colors cursor-pointer"
              >
                <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                <div className="text-left hidden sm:block">
                  <span className="font-bold block leading-tight">{currentUser.name}</span>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
                    {currentUser.role}
                  </span>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {showUserDropdown && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 p-2 space-y-1 text-xs z-50">
                  <div className="px-3 py-2 border-b border-slate-100">
                    <p className="font-bold text-slate-900">{currentUser.name}</p>
                    <p className="text-[11px] text-slate-500">{currentUser.email}</p>
                    <span className="inline-block mt-1 px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-semibold rounded uppercase">
                      {currentUser.role}
                    </span>
                  </div>

                  <div className="py-1">
                    <span className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Accounts
                    </span>
                    {allUsers.map((u) => (
                      <button
                        key={u.id}
                        onClick={() => {
                          switchUser(u.id);
                          setShowUserDropdown(false);
                          if (u.role === 'customer') onSelectTab('discover');
                          else if (u.role === 'shopkeeper' && u.shopkeeperStatus === 'approved') onSelectTab('shop_dashboard');
                          else if (u.role === 'admin') onSelectTab('admin');
                        }}
                        className={`w-full text-left px-3 py-1.5 rounded-lg flex items-center justify-between transition-colors cursor-pointer ${
                          currentUser.id === u.id
                            ? 'bg-blue-50 text-blue-700 font-bold'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <span className="truncate">{u.name}</span>
                        <span className="text-[10px] text-slate-400 capitalize">{u.role}</span>
                      </button>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-slate-100 space-y-1">
                    <button
                      onClick={() => {
                        setShowUserDropdown(false);
                        openAuthModal('register_shopkeeper');
                      }}
                      className="w-full text-left px-3 py-1.5 text-[11px] text-blue-600 hover:bg-blue-50 rounded font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Store className="w-3.5 h-3.5" />
                      Register New Store
                    </button>

                    <button
                      onClick={() => {
                        logout();
                        setShowUserDropdown(false);
                        onSelectTab('discover');
                      }}
                      className="w-full text-left px-3 py-1.5 text-[11px] text-rose-600 hover:bg-rose-50 rounded font-semibold flex items-center gap-1.5 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Cart Bag Button (Customer & Guest) */}
          {(!currentUser || currentUser.role === 'customer' || !isApprovedShopkeeper) && (
            <button
              onClick={() => setIsCartDrawerOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" />
              <span className="hidden sm:inline font-tabular">
                {itemCount > 0 ? formatINR(subtotal) : 'Cart'}
              </span>
              {itemCount > 0 && (
                <span className="w-5 h-5 bg-white text-blue-700 rounded-full flex items-center justify-center text-[10px] font-black font-tabular">
                  {itemCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
