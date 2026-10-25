/**
 * BillPilot Local - Customer Delivery Location Context
 * 
 * Manages customer's active delivery locality, coordinates,
 * and first-launch Swiggy-style location selection modal prompt.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { CustomerLocation } from '../types';

const LOCATION_STORAGE_KEY = 'billpilot_local_customer_loc';

interface LocationContextType {
  location: CustomerLocation | null;
  setLocation: (loc: CustomerLocation) => void;
  clearLocation: () => void;
  isLocationModalOpen: boolean;
  openLocationModal: () => void;
  closeLocationModal: () => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [location, setLocationState] = useState<CustomerLocation | null>(() => {
    try {
      const stored = localStorage.getItem(LOCATION_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // Ignore parse error
    }
    return null;
  });

  const [isLocationModalOpen, setIsLocationModalOpen] = useState<boolean>(false);

  // Trigger modal on first visit if no location is set
  useEffect(() => {
    if (!location) {
      const timer = setTimeout(() => {
        setIsLocationModalOpen(true);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [location]);

  const setLocation = (newLoc: CustomerLocation) => {
    setLocationState(newLoc);
    try {
      localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(newLoc));
    } catch {
      // LocalStorage fallback
    }
    setIsLocationModalOpen(false);
  };

  const clearLocation = () => {
    setLocationState(null);
    try {
      localStorage.removeItem(LOCATION_STORAGE_KEY);
    } catch {
      // Fallback
    }
    setIsLocationModalOpen(true);
  };

  const openLocationModal = () => setIsLocationModalOpen(true);
  const closeLocationModal = () => setIsLocationModalOpen(false);

  return (
    <LocationContext.Provider
      value={{
        location,
        setLocation,
        clearLocation,
        isLocationModalOpen,
        openLocationModal,
        closeLocationModal,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = (): LocationContextType => {
  const ctx = useContext(LocationContext);
  if (!ctx) throw new Error('useLocation must be used within a LocationProvider');
  return ctx;
};
