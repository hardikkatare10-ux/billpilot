/**
 * Dukan Yantra and NearBasket - Unified Authentication & Role Authorization Context
 * 
 * Implements Phase 4:
 * - Single Firebase Authentication system across Dukan Yantra and NearBasket
 * - Role-based authorization: Consumer vs Shopkeeper vs Admin
 * - Safe shopkeeper approval flow (selecting Shopkeeper NEVER grants immediate privileged access)
 * - Anti-tampering protection against browser state / localStorage privilege escalation
 * - Seamless view switching for approved shopkeepers (ERP <-> Marketplace) without re-login
 * - Integration with offline-first private cloudSync
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, signInWithGoogle, isFirebaseConfigured } from '../lib/firebase';
import { hydrateFromCloud, flushPending, stopSync, clearLocalBusinessData } from '../lib/cloudSync';
import { dbStore, sanitizePincodes } from '../marketplace/services/db/store';
import { Shop, User, UserAddress } from '../marketplace/types';
import {
  canManageShop,
  requestedRoleFromProfile,
  registrationRoleFields,
  type AccountRole,
  type RegistrationRole,
  type ShopkeeperStatus,
} from './authRoles';

export type { AccountRole, ShopkeeperStatus } from './authRoles';

export interface UnifiedUser {
  id: string; // Firebase uid
  name: string;
  email: string;
  phone: string;
  role: AccountRole;
  requestedRole: RegistrationRole;
  shopkeeperStatus: ShopkeeperStatus;
  shopId?: string;
  shopName?: string;
  addresses: UserAddress[];
  createdAt: string;
  gstin?: string;
}

export interface RegisterShopkeeperDetails {
  shopName: string;
  category: string;
  description: string;
  street: string;
  locality: string;
  city: string;
  pincode: string;
  serviceablePincodes: string[];
  coordinates: { latitude: number; longitude: number };
  gstin?: string;
  tradeLicenseNo?: string;
}

export interface UnifiedAuthContextType {
  currentUser: UnifiedUser | null;
  firebaseUser: FirebaseUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isApprovedShopkeeper: boolean;
  isAdmin: boolean;
  activeMode: 'consumer' | 'shopkeeper' | 'admin';
  setActiveMode: (mode: 'consumer' | 'shopkeeper' | 'admin') => void;
  login: (email: string, password?: string) => Promise<UnifiedUser>;
  loginWithGooglePopup: () => Promise<UnifiedUser>;
  register: (input: {
    name: string;
    email: string;
    password?: string;
    phone: string;
    role: RegistrationRole;
    shopDetails?: RegisterShopkeeperDetails;
  }) => Promise<UnifiedUser>;
  logout: () => Promise<void>;
  approveShopkeeper: (userId: string, shopId?: string) => Promise<void>;
  setShopVerification: (shopId: string, status: Shop['verificationStatus'], notes?: string) => Promise<void>;
  rejectShopkeeper: (userId: string, reason?: string) => Promise<void>;
  addAddress: (address: Omit<UserAddress, 'id' | 'userId'>) => UserAddress;
  refreshUserData: () => Promise<void>;
}

const UnifiedAuthContext = createContext<UnifiedAuthContextType | undefined>(undefined);

const ADMIN_EMAILS = ['hardikkatare10@gmail.com', 'admin@billpilot.app'];

export const UnifiedAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UnifiedUser | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeMode, setActiveMode] = useState<'consumer' | 'shopkeeper' | 'admin'>('consumer');

  // Verify whether active user has authenticated shopkeeper privileges
  const isApprovedShopkeeper = Boolean(
    currentUser &&
    canManageShop(currentUser.role, currentUser.shopkeeperStatus)
  );

  const isAdmin = Boolean(
    currentUser &&
    (currentUser.role === 'admin' || ADMIN_EMAILS.includes(currentUser.email?.toLowerCase()))
  );

  // Load Firestore profile or local fallback
  const fetchUserProfile = useCallback(async (fbUser: FirebaseUser): Promise<UnifiedUser> => {
    const userRef = doc(db, 'users', fbUser.uid);
    let userData: Partial<UnifiedUser> = {};

    try {
      const snap = await getDoc(userRef);
      if (snap.exists()) {
        userData = snap.data() as Partial<UnifiedUser>;
      }
    } catch (e) {
      console.warn('Could not read user doc from Firestore, using cached/fallback:', e);
    }

    const emailIsAdmin = ADMIN_EMAILS.includes(fbUser.email?.toLowerCase() || '');
    const requestedRole = requestedRoleFromProfile(userData);
    const shopkeeperStatus: ShopkeeperStatus =
      userData.shopkeeperStatus === 'pending' ||
      userData.shopkeeperStatus === 'approved' ||
      userData.shopkeeperStatus === 'rejected'
        ? userData.shopkeeperStatus
        : 'none';
    const userRole: AccountRole = emailIsAdmin ? 'admin' : requestedRole;

    const unifiedUser: UnifiedUser = {
      id: fbUser.uid,
      name: userData.name || fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
      email: fbUser.email || '',
      phone: userData.phone || '',
      role: userRole,
      requestedRole,
      shopkeeperStatus: emailIsAdmin ? 'approved' : shopkeeperStatus,
      shopId: userData.shopId,
      shopName: userData.shopName,
      addresses: userData.addresses || [],
      createdAt: userData.createdAt || new Date().toISOString(),
      gstin: userData.gstin,
    };

    // Keep dbStore in sync for marketplace queries
    dbStore.syncUserRecord({
      id: unifiedUser.id,
      name: unifiedUser.name,
      email: unifiedUser.email,
      phone: unifiedUser.phone,
      role: unifiedUser.role,
      requestedRole: unifiedUser.requestedRole,
      shopkeeperStatus: unifiedUser.shopkeeperStatus,
      shopId: unifiedUser.shopId,
      addresses: unifiedUser.addresses,
      createdAt: unifiedUser.createdAt,
    });

    return unifiedUser;
  }, []);

  // Listen to Firebase Auth state
  useEffect(() => {
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (!isMounted) return;

      if (fbUser) {
        setFirebaseUser(fbUser);
        try {
          const profile = await fetchUserProfile(fbUser);
          if (!isMounted) return;
          setCurrentUser(profile);

          // If approved shopkeeper, hydrate ERP cloud sync and set active mode
          if (profile.role === 'shopkeeper' && profile.shopkeeperStatus === 'approved') {
            try {
              await hydrateFromCloud(fbUser.uid);
            } catch (err) {
              console.warn('Shopkeeper cloud sync hydration notice:', err);
            }
            setActiveMode('shopkeeper');
          } else if (profile.role === 'admin') {
            setActiveMode('admin');
          } else {
            setActiveMode('consumer');
          }
        } catch (err) {
          console.error('Error bootstrapping authenticated user:', err);
        }
      } else {
        setFirebaseUser(null);
        setCurrentUser(null);
        setActiveMode('consumer');
        stopSync();
      }
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [fetchUserProfile]);

  const refreshUserData = async () => {
    if (firebaseUser) {
      const updated = await fetchUserProfile(firebaseUser);
      setCurrentUser(updated);
    }
  };

  const login = async (email: string, password?: string): Promise<UnifiedUser> => {
    setIsLoading(true);
    try {
      let fbUser: FirebaseUser;
      if (password) {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
        fbUser = cred.user;
      } else {
        // Fallback for test / dev passwordless
        throw new Error('Password required for secure authentication.');
      }
      const profile = await fetchUserProfile(fbUser);
      setCurrentUser(profile);
      return profile;
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGooglePopup = async (): Promise<UnifiedUser> => {
    setIsLoading(true);
    try {
      const fbUser = await signInWithGoogle();
      const profile = await fetchUserProfile(fbUser);
      setCurrentUser(profile);
      return profile;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (input: {
    name: string;
    email: string;
    password?: string;
    phone: string;
    role: RegistrationRole;
    shopDetails?: RegisterShopkeeperDetails;
  }): Promise<UnifiedUser> => {
    setIsLoading(true);
    try {
      if (!input.password || input.password.length < 6) {
        throw new Error('Password must be at least 6 characters.');
      }
      const roleFields = registrationRoleFields(input.role);
      if (input.role === 'shopkeeper' && !input.shopDetails) {
        throw new Error('Shop details are required to register as a shopkeeper.');
      }

      const cred = await createUserWithEmailAndPassword(auth, input.email.trim(), input.password);
      const uid = cred.user.uid;
      const nowIso = new Date().toISOString();

      let shopId: string | undefined = undefined;
      const shopkeeperStatus = roleFields.shopkeeperStatus;
      let cloudWriteError: unknown = null;

      // Safe role assignment: Requesting Shopkeeper initiates approval process
      if (input.role === 'shopkeeper' && input.shopDetails) {
        shopId = 'shop_' + uid.substring(0, 8);

        const sanitizedPincodes = sanitizePincodes([
          input.shopDetails.pincode,
          ...(input.shopDetails.serviceablePincodes || []),
        ]);

        const newShop: Shop = {
          id: shopId,
          name: input.shopDetails.shopName.trim(),
          ownerId: uid,
          ownerName: input.name.trim(),
          phone: input.phone.trim(),
          email: input.email.trim(),
          category: input.shopDetails.category || 'General Store',
          description: input.shopDetails.description || '',
          imageUrl:
            'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=400&q=80',
          rating: 5.0,
          reviewCount: 1,
          verificationStatus: 'pending',
          verificationDetails: {
            gstin: input.shopDetails.gstin,
            tradeLicenseNo: input.shopDetails.tradeLicenseNo,
            notes: 'Applied during Dukan Yantra merchant onboarding. Pending admin review.',
          },
          address: {
            street: input.shopDetails.street.trim(),
            locality: input.shopDetails.locality.trim(),
            city: input.shopDetails.city.trim(),
            pincode: input.shopDetails.pincode.trim(),
            coordinates: input.shopDetails.coordinates,
          },
          operatingHours: {
            openTime: '08:00',
            closeTime: '22:00',
            isOpenSunday: true,
          },
          deliverySettings: {
            isDeliveryAvailable: true,
            serviceRadiusKm: 10,
            baseDeliveryCharge: 3000,
            freeDeliveryThreshold: 50000,
            minOrderValue: 10000,
            estimatedPrepMinutes: 20,
            estimatedDeliveryMinutes: 25,
            maxConcurrentOrders: 10,
            isAcceptingOrders: true,
            serviceableLocalities: [input.shopDetails.locality.trim()],
            serviceablePincodes: sanitizedPincodes,
          },
          createdAt: nowIso,
        };

        // Save shop in Firestore
        try {
          await setDoc(doc(db, 'shops', shopId), newShop);
        } catch (e) {
          console.error('Firestore shop create failed:', e);
          cloudWriteError = e;
        }
        dbStore.addShop(newShop);
      }

      // Persist the requested account role while keeping merchant access gated by approval status.
      const profileData: UnifiedUser = {
        id: uid,
        name: input.name.trim(),
        email: input.email.trim(),
        phone: input.phone.trim(),
        ...roleFields,
        shopId,
        shopName: input.shopDetails?.shopName,
        addresses: [],
        createdAt: nowIso,
        gstin: input.shopDetails?.gstin,
      };

      try {
        await setDoc(doc(db, 'users', uid), profileData);
      } catch (e) {
        console.error('Firestore user profile create failed:', e);
        cloudWriteError = cloudWriteError || e;
      }

      setCurrentUser(profileData);
      setActiveMode('consumer');

      if (cloudWriteError) {
        const code = (cloudWriteError as { code?: string })?.code || 'unknown';
        throw new Error(
          'Your account was created, but saving it to the cloud failed (' + code + '). ' +
          'Check that firestore.rules are deployed to the same Firestore database the app uses.'
        );
      }
      return profileData;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await flushPending();
      stopSync();
      await signOut(auth);
      clearLocalBusinessData();
      setCurrentUser(null);
      setFirebaseUser(null);
      setActiveMode('consumer');
    } finally {
      setIsLoading(false);
    }
  };

  // Safe Server-Side / Administrator Approval Action
  const approveShopkeeper = async (userId: string, shopId?: string) => {
    if (!isAdmin) {
      throw new Error('Unauthorized: Administrator privileges required to approve shopkeepers.');
    }

    try {
      await updateDoc(doc(db, 'users', userId), {
        role: 'shopkeeper',
        shopkeeperStatus: 'approved',
        updatedAt: new Date().toISOString(),
      });

      if (shopId) {
        await updateDoc(doc(db, 'shops', shopId), {
          verificationStatus: 'verified',
          'verificationDetails.verifiedAt': new Date().toISOString(),
          'verificationDetails.verifiedBy': currentUser?.email || 'admin',
          updatedAt: new Date().toISOString(),
        });
        dbStore.updateShopVerification(shopId, 'verified', currentUser?.id || 'admin');
      }

      if (currentUser?.id === userId) {
        await refreshUserData();
      }
    } catch (err) {
      console.error('Failed to approve shopkeeper:', err);
      throw err;
    }
  };

  // Admin: change a shop's verification status in Firestore (shop doc + owner's account), then locally.
  const setShopVerification = async (
    shopId: string,
    status: Shop['verificationStatus'],
    notes?: string
  ) => {
    if (!isAdmin) {
      throw new Error('Unauthorized: Administrator privileges required.');
    }
    const nowIso = new Date().toISOString();
    const shop = dbStore.getShopById(shopId);
    if (!shop) {
      throw new Error('Shop application could not be found. Refresh the admin page and try again.');
    }
    const ownerId = shop.ownerId;

    const shopUpdate: Record<string, unknown> = {
      verificationStatus: status,
      'verificationDetails.verifiedAt': nowIso,
      'verificationDetails.verifiedBy': currentUser?.email || 'admin',
      updatedAt: nowIso,
    };
    if (notes) shopUpdate['verificationDetails.notes'] = notes;
    const batch = writeBatch(db);
    batch.update(doc(db, 'shops', shopId), shopUpdate);

    if (ownerId) {
      if (status === 'verified') {
        batch.update(doc(db, 'users', ownerId), {
          role: 'shopkeeper',
          shopkeeperStatus: 'approved',
          updatedAt: nowIso,
        });
      } else if (status === 'rejected') {
        batch.update(doc(db, 'users', ownerId), {
          shopkeeperStatus: 'rejected',
          updatedAt: nowIso,
        });
      }
    }
    await batch.commit();

    try {
      dbStore.updateShopVerification(shopId, status, currentUser?.id || 'admin_operations', notes);
    } catch {
      /* shop not in local store yet; Firestore listener will bring it in */
    }
  };

  const rejectShopkeeper = async (userId: string, reason?: string) => {
    if (!isAdmin) {
      throw new Error('Unauthorized: Administrator privileges required to reject shopkeepers.');
    }

    try {
      await updateDoc(doc(db, 'users', userId), {
        shopkeeperStatus: 'rejected',
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Failed to reject shopkeeper:', err);
      throw err;
    }
  };

  const addAddress = (addressInput: Omit<UserAddress, 'id' | 'userId'>): UserAddress => {
    const addressId = 'addr_' + Date.now();
    const newAddress: UserAddress = {
      ...addressInput,
      id: addressId,
      userId: currentUser?.id || 'guest',
    };

    if (currentUser) {
      const updatedAddresses = [...currentUser.addresses, newAddress];
      const updatedUser = { ...currentUser, addresses: updatedAddresses };
      setCurrentUser(updatedUser);

      // Async update to Firestore
      if (db && firebaseUser) {
        updateDoc(doc(db, 'users', currentUser.id), {
          addresses: updatedAddresses,
        }).catch((e) => console.warn('Address sync notice:', e));
      }
      dbStore.addAddress(currentUser.id, newAddress);
    }

    return newAddress;
  };

  return (
    <UnifiedAuthContext.Provider
      value={{
        currentUser,
        firebaseUser,
        isLoading,
        isAuthenticated: Boolean(currentUser),
        isApprovedShopkeeper,
        isAdmin,
        activeMode,
        setActiveMode,
        login,
        loginWithGooglePopup,
        register,
        logout,
        approveShopkeeper,
        setShopVerification,
        rejectShopkeeper,
        addAddress,
        refreshUserData,
      }}
    >
      {children}
    </UnifiedAuthContext.Provider>
  );
};

export const useUnifiedAuth = (): UnifiedAuthContextType => {
  const context = useContext(UnifiedAuthContext);
  if (!context) {
    throw new Error('useUnifiedAuth must be used within a UnifiedAuthProvider');
  }
  return context;
};
