/**
 * BillPilot Local - Authentication Modal
 * 
 * Provides authentic Sign In, Customer Registration, and Local Shop Onboarding.
 */

import React, { useState } from 'react';
import { X, LogIn, Store, UserPlus, AlertCircle, CheckCircle, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { MapLocationPicker, PickedLocation } from './MapLocationPicker';

export const AuthModal: React.FC = () => {
  const {
    isAuthModalOpen,
    authModalMode,
    closeAuthModal,
    openAuthModal,
    login,
    loginWithGoogle,
    registerCustomer,
    registerShopkeeper,
    allUsers,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setError(null);
    try {
      await loginWithGoogle();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Google Sign-In failed');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  // Customer registration state
  const [custName, setCustName] = useState('');
  const [custEmail, setCustEmail] = useState('');
  const [custPhone, setCustPhone] = useState('');
  const [custStreet, setCustStreet] = useState('');
  const [custLocality, setCustLocality] = useState('');
  const [custCity, setCustCity] = useState('');
  const [custPincode, setCustPincode] = useState('');
  const [custLocation, setCustLocation] = useState<PickedLocation | null>(null);

  // Shopkeeper onboarding state
  const [shopOwnerName, setShopOwnerName] = useState('');
  const [shopEmail, setShopEmail] = useState('');
  const [shopPhone, setShopPhone] = useState('');
  const [shopName, setShopName] = useState('');
  const [shopCategory, setShopCategory] = useState('Groceries & Essentials');
  const [shopDesc, setShopDesc] = useState('');
  const [shopStreet, setShopStreet] = useState('');
  const [shopLocality, setShopLocality] = useState('');
  const [shopCity, setShopCity] = useState('');
  const [shopPincodes, setShopPincodes] = useState('');
  const [shopLocation, setShopLocation] = useState<PickedLocation | null>(null);
  const [shopBaseCharge, setShopBaseCharge] = useState(25);
  const [shopMinOrder, setShopMinOrder] = useState(99);
  const [shopGstin, setShopGstin] = useState('');
  const [shopFssai, setShopFssai] = useState('');

  if (!isAuthModalOpen) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login(email, password || 'password123');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  const handleRegisterCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!custLocation) {
      setError('Please share your home location from Google Maps (paste a link or use current location).');
      return;
    }
    try {
      await registerCustomer({
        name: custName,
        email: custEmail,
        password: password || 'password123',
        phone: custPhone,
        streetAddress: custStreet,
        locality: custLocality,
        city: custCity,
        pincode: custPincode,
        coordinates: custLocation.coordinates,
        mapsLink: custLocation.mapsLink,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    }
  };

  const handleRegisterShop = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!shopLocation) {
      setError('Please share your shop location using Google Maps or current location.');
      return;
    }
    try {
      await registerShopkeeper({
        ownerName: shopOwnerName,
        email: shopEmail,
        password: password || 'password123',
        phone: shopPhone,
        shopName,
        category: shopCategory,
        description: shopDesc,
        street: shopStreet,
        locality: shopLocality,
        city: shopCity,
        serviceablePincodes: shopPincodes
          .split(/[,\s]+/)
          .map((x) => x.trim())
          .filter(Boolean),
        coordinates: shopLocation.coordinates,
        serviceRadiusKm: 10,
        baseDeliveryChargeRupees: Number(shopBaseCharge),
        minOrderValueRupees: Number(shopMinOrder),
        gstin: shopGstin,
        fssaiLicense: shopFssai,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Shop registration failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-6">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {authModalMode === 'login' && 'Sign In to BillPilot Local'}
              {authModalMode === 'register_customer' && 'Create Customer Account'}
              {authModalMode === 'register_shopkeeper' && 'Register Local Shop (Merchant)'}
            </h2>
            <p className="text-xs text-slate-500">
              {authModalMode === 'login' && 'Access doorstep orders, invoices, and store dashboards.'}
              {authModalMode === 'register_customer' && 'Get doorstep delivery from verified neighborhood stores.'}
              {authModalMode === 'register_shopkeeper' && 'Sell to neighborhood customers with shop-managed delivery.'}
            </p>
          </div>
          <button
            onClick={closeAuthModal}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
            aria-label="Close authentication"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex items-center border-b border-slate-200 bg-slate-100/60 p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setError(null);
              openAuthModal('login');
            }}
            className={`flex-1 py-2 text-center rounded-lg transition-colors cursor-pointer ${
              authModalMode === 'login'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null);
              openAuthModal('register_customer');
            }}
            className={`flex-1 py-2 text-center rounded-lg transition-colors cursor-pointer ${
              authModalMode === 'register_customer'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            New Customer
          </button>
          <button
            type="button"
            onClick={() => {
              setError(null);
              openAuthModal('register_shopkeeper');
            }}
            className={`flex-1 py-2 text-center rounded-lg transition-colors cursor-pointer ${
              authModalMode === 'register_shopkeeper'
                ? 'bg-white text-blue-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Register Shop
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* TAB 1: SIGN IN */}
          {authModalMode === 'login' && (
            <div className="space-y-4">
              {/* Google Sign-In (Firebase Auth) */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isGoogleLoading}
                className="w-full py-2.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2.5 cursor-pointer text-xs"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>{isGoogleLoading ? 'Signing in with Google...' : 'Continue with Google'}</span>
              </button>

              <div className="flex items-center gap-3 my-1">
                <div className="flex-1 h-px bg-slate-200"></div>
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Or with email</span>
                <div className="flex-1 h-px bg-slate-200"></div>
              </div>

              <form onSubmit={handleLogin} className="space-y-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="Enter your registered email address..."
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter password (min. 6 characters)..."
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3 py-2.5 pr-16 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((visible) => !visible)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      <span>{showPassword ? 'Hide' : 'Show'}</span>
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  Sign In to Account
                </button>
              </form>

              {/* Quick Select from Registered Accounts */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Registered Accounts:
                </span>
                {allUsers.length > 0 ? (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {allUsers.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setEmail(u.email);
                          login(u.email);
                        }}
                        className="w-full text-left p-2.5 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/40 transition-all flex items-center justify-between cursor-pointer"
                      >
                        <div>
                          <p className="font-bold text-slate-900">{u.name}</p>
                          <p className="text-[11px] text-slate-500">{u.email}</p>
                        </div>
                        <span className="text-[10px] font-semibold uppercase px-2 py-0.5 bg-slate-100 text-slate-700 rounded capitalize">
                          {u.role}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-1">
                    <p className="font-semibold text-slate-800">No accounts created yet</p>
                    <p className="text-[11px] text-slate-500">
                      Use the &quot;New Customer&quot; or &quot;Register Shop&quot; tabs above to get started.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: REGISTER CUSTOMER */}
          {authModalMode === 'register_customer' && (
            <form onSubmit={handleRegisterCustomer} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Verma"
                    value={custName}
                    onChange={(e) => setCustName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Phone Number</label>
                  <input
                    type="tel"
                    required
                    placeholder="+91 98..."
                    value={custPhone}
                    onChange={(e) => setCustPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="rahul@example.in"
                  value={custEmail}
                  onChange={(e) => setCustEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Create password (min. 6 characters)..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-3 py-2 pr-10 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Home / Flat / Street Address
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. #14, 5th Main, 2nd Cross"
                  value={custStreet}
                  onChange={(e) => setCustStreet(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Locality</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Vijay Nagar"
                    value={custLocality}
                    onChange={(e) => setCustLocality(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">City</label>
                  <input
                    type="text"
                    required
                    value={custCity}
                    onChange={(e) => setCustCity(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Pincode</label>
                  <input
                    type="text"
                    required
                    value={custPincode}
                    onChange={(e) => setCustPincode(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <MapLocationPicker value={custLocation} onChange={setCustLocation} />

              <button
                type="submit"
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                <UserPlus className="w-4 h-4" />
                Register Customer Account
              </button>
            </form>
          )}

          {/* TAB 3: REGISTER SHOP */}
          {authModalMode === 'register_shopkeeper' && (
            <form onSubmit={handleRegisterShop} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Owner Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ramesh Hegde"
                    value={shopOwnerName}
                    onChange={(e) => setShopOwnerName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Store Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Hegde Daily Needs"
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Store Email</label>
                  <input
                    type="email"
                    required
                    placeholder="orders@hegdestore.in"
                    value={shopEmail}
                    onChange={(e) => setShopEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="Min. 6 characters..."
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3 py-2 pr-10 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((visible) => !visible)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Store Phone</label>
                <input
                  type="tel"
                  required
                  placeholder="+91 99..."
                  value={shopPhone}
                  onChange={(e) => setShopPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Category</label>
                  <select
                    value={shopCategory}
                    onChange={(e) => setShopCategory(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="Groceries & Essentials">Groceries & Essentials</option>
                    <option value="Stationery & School Supplies">Stationery & School Supplies</option>
                    <option value="Personal Care & Wellness">Personal Care & Wellness</option>
                    <option value="Household & Kitchen">Household & Kitchen</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Locality</label>
                  <input
                    type="text"
                    required
                    value={shopLocality}
                    onChange={(e) => setShopLocality(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Shop Address</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. #88, 12th Main Road"
                  value={shopStreet}
                  onChange={(e) => setShopStreet(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <MapLocationPicker
                value={shopLocation}
                onChange={setShopLocation}
                label="Shop location"
                helpText="Share the exact shop pin. Customer delivery eligibility is limited to 10 km from this location."
              />

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">City</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Jabalpur"
                    value={shopCity}
                    onChange={(e) => setShopCity(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">
                    Delivery PIN codes (max 3)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 482002, 482001"
                    value={shopPincodes}
                    onChange={(e) => setShopPincodes(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Maximum delivery radius</label>
                  <p className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono">10 km</p>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Delivery (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={shopBaseCharge}
                    onChange={(e) => setShopBaseCharge(Number(e.target.value))}
                    className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Min Order (₹)</label>
                  <input
                    type="number"
                    min="0"
                    value={shopMinOrder}
                    onChange={(e) => setShopMinOrder(Number(e.target.value))}
                    className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">GSTIN (Optional)</label>
                  <input
                    type="text"
                    placeholder="29AAAAA0000A1Z5"
                    value={shopGstin}
                    onChange={(e) => setShopGstin(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">FSSAI / License</label>
                  <input
                    type="text"
                    placeholder="1122..."
                    value={shopFssai}
                    onChange={(e) => setShopFssai(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                <Store className="w-4 h-4" />
                Complete Store Onboarding
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
