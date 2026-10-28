/**
 * NearBasket - Authentication Bridge Context
 * 
 * Bridges marketplace components with UnifiedAuthContext for unified Firebase Auth.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Shop, User, UserAddress, UserRole } from '../types';
import { dbStore } from '../services/db/store';
import { useUnifiedAuth, UnifiedUser } from '../../context/UnifiedAuthContext';

interface AuthContextType {
  currentUser: User | null;
  allUsers: User[];
  role: UserRole | 'guest';
  isApprovedShopkeeper: boolean;
  isAuthenticated: boolean;
  login: (email: string, password?: string) => Promise<User>;
  loginWithGoogle: () => Promise<any>;
  registerCustomer: (input: {
    name: string;
    email: string;
    password?: string;
    phone: string;
    streetAddress: string;
    locality: string;
    city: string;
    pincode: string;
    coordinates?: { latitude: number; longitude: number };
    mapsLink?: string;
  }) => Promise<User>;
  registerShopkeeper: (input: {
    ownerName: string;
    email: string;
    password?: string;
    phone: string;
    shopName: string;
    category: string;
    description: string;
    street: string;
    locality: string;
    city: string;
    serviceablePincodes: string[];
    coordinates: { latitude: number; longitude: number };
    serviceRadiusKm?: number;
    baseDeliveryChargeRupees?: number;
    minOrderValueRupees?: number;
    gstin?: string;
    fssaiLicense?: string;
    tradeLicenseNo?: string;
  }) => Promise<{ user: User; shop: Shop }>;
  registerAdmin: (input: { name: string; email: string; phone: string }) => User;
  logout: () => void;
  switchUser: (userId: string) => void;
  addAddress: (address: Omit<UserAddress, 'id' | 'userId'>) => UserAddress;
  refreshUserData: () => void;
  isAuthModalOpen: boolean;
  authModalMode: 'login' | 'register_customer' | 'register_shopkeeper' | 'register_admin';
  openAuthModal: (mode?: 'login' | 'register_customer' | 'register_shopkeeper' | 'register_admin') => void;
  closeAuthModal: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function mapUnifiedUser(u: UnifiedUser | null): User | null {
  if (!u) return null;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone,
    role: u.role,
    requestedRole: u.requestedRole,
    shopkeeperStatus: u.shopkeeperStatus,
    shopId: u.shopId,
    addresses: u.addresses || [],
    createdAt: u.createdAt,
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const unified = useUnifiedAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register_customer' | 'register_shopkeeper' | 'register_admin'>('login');
  const [allUsers, setAllUsers] = useState<User[]>(() => dbStore.getUsers());

  const currentUser = mapUnifiedUser(unified.currentUser);
  const isApprovedShopkeeper = unified.isApprovedShopkeeper;

  const refreshUserData = () => {
    unified.refreshUserData();
    setAllUsers(dbStore.getUsers());
  };

  const login = async (email: string, password?: string): Promise<User> => {
    const res = await unified.login(email, password || 'defaultPassword123');
    setIsAuthModalOpen(false);
    return mapUnifiedUser(res)!;
  };

  const loginWithGoogle = async () => {
    const res = await unified.loginWithGooglePopup();
    setIsAuthModalOpen(false);
    return res;
  };

  const registerCustomer = async (input: {
    name: string;
    email: string;
    password?: string;
    phone: string;
    streetAddress: string;
    locality: string;
    city: string;
    pincode: string;
    coordinates?: { latitude: number; longitude: number };
    mapsLink?: string;
  }): Promise<User> => {
    const res = await unified.register({
      name: input.name,
      email: input.email,
      password: input.password || 'password123',
      phone: input.phone,
      role: 'customer',
    });

    if (input.streetAddress && input.locality) {
      unified.addAddress({
        label: 'Home',
        recipientName: input.name,
        phoneNumber: input.phone,
        streetAddress: input.streetAddress,
        locality: input.locality,
        city: input.city,
        pincode: input.pincode,
        coordinates: input.coordinates,
        mapsLink: input.mapsLink,
        isDefault: true,
      });
    }

    setIsAuthModalOpen(false);
    return mapUnifiedUser(res)!;
  };

  const registerShopkeeper = async (input: {
    ownerName: string;
    email: string;
    password?: string;
    phone: string;
    shopName: string;
    category: string;
    description: string;
    street: string;
    locality: string;
    city: string;
    serviceablePincodes: string[];
    serviceRadiusKm?: number;
    baseDeliveryChargeRupees?: number;
    minOrderValueRupees?: number;
    gstin?: string;
    fssaiLicense?: string;
    tradeLicenseNo?: string;
  }): Promise<{ user: User; shop: Shop }> => {
    const res = await unified.register({
      name: input.ownerName,
      email: input.email,
      password: input.password || 'password123',
      phone: input.phone,
      role: 'shopkeeper',
      shopDetails: {
        shopName: input.shopName,
        category: input.category,
        description: input.description,
        street: input.street,
        locality: input.locality,
        city: input.city,
        pincode: input.serviceablePincodes[0] || '110001',
        serviceablePincodes: input.serviceablePincodes,
        coordinates: input.coordinates,
        gstin: input.gstin,
        tradeLicenseNo: input.tradeLicenseNo,
      },
    });

    setIsAuthModalOpen(false);
    const shop = res.shopId ? dbStore.getShopById(res.shopId) || ({} as Shop) : ({} as Shop);
    return {
      user: mapUnifiedUser(res)!,
      shop,
    };
  };

  const registerAdmin = (input: { name: string; email: string; phone: string }) => {
    const user = dbStore.registerAdmin(input);
    return user;
  };

  const logout = () => {
    unified.logout();
  };

  const switchUser = (userId: string) => {
    dbStore.setActiveUser(userId);
    refreshUserData();
  };

  const addAddress = (address: Omit<UserAddress, 'id' | 'userId'>) => {
    return unified.addAddress(address);
  };

  const openAuthModal = (mode: 'login' | 'register_customer' | 'register_shopkeeper' | 'register_admin' = 'login') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setIsAuthModalOpen(false);
  };

  const role: UserRole | 'guest' = currentUser ? currentUser.role : 'guest';

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        allUsers,
        role,
        isApprovedShopkeeper,
        isAuthenticated: Boolean(currentUser),
        login,
        loginWithGoogle,
        registerCustomer,
        registerShopkeeper,
        registerAdmin,
        logout,
        switchUser,
        addAddress,
        refreshUserData,
        isAuthModalOpen,
        authModalMode,
        openAuthModal,
        closeAuthModal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
