/**
 * NearBasket - Customer Delivery Location Context
 * 
 * Manages customer's active delivery locality, coordinates,
 * and first-launch Swiggy-style location selection modal prompt.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { CustomerLocation } from '../types';

const LOCATION_STORAGE_KEY = 'billpilot_local_customer_loc';
const LOCATION_PROMPT_COOKIE_KEY = 'billpilot_local_location_prompt_dismissed';
const LOCATION_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export interface LocationPreference {
  location: CustomerLocation | null;
  dismissed: boolean;
}

function isCustomerLocation(value: unknown): value is CustomerLocation {
  if (!value || typeof value !== 'object') return false;
  const location = value as Partial<CustomerLocation>;
  const coordinates = location.coordinates;
  return typeof location.city === 'string' &&
    typeof location.locality === 'string' &&
    typeof location.formattedAddress === 'string' &&
    Boolean(coordinates) &&
    Number.isFinite(coordinates?.latitude) &&
    Number.isFinite(coordinates?.longitude) &&
    Math.abs(coordinates!.latitude) <= 90 &&
    Math.abs(coordinates!.longitude) <= 180;
}

export function parseLocationPreference(raw: string | null): LocationPreference | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return null;

    const preference = value as Partial<LocationPreference>;
    if (typeof preference.dismissed === 'boolean' && 'location' in preference) {
      if (preference.location !== null && !isCustomerLocation(preference.location)) return null;
      return { location: preference.location || null, dismissed: preference.dismissed };
    }

    // Migrate the original localStorage format, which stored only the selected location.
    return isCustomerLocation(value) ? { location: value, dismissed: true } : null;
  } catch {
    return null;
  }
}

export function serializeLocationPreference(preference: LocationPreference): string {
  return JSON.stringify(preference);
}

function readLocationPreference(): LocationPreference {
  let preference: LocationPreference | null = null;
  let rawLocalPreference: string | null = null;
  try {
    rawLocalPreference = localStorage.getItem(LOCATION_STORAGE_KEY);
    preference = parseLocationPreference(rawLocalPreference);
  } catch {
    // Continue to the cookie fallback when localStorage is unavailable.
  }

  if (preference) {
    if (rawLocalPreference !== serializeLocationPreference(preference)) {
      try {
        localStorage.setItem(LOCATION_STORAGE_KEY, serializeLocationPreference(preference));
      } catch {
        // Keep using the parsed value for this session.
      }
    }
    persistLocationPromptDismissal(preference.dismissed);
    return preference;
  }

  if (typeof document !== 'undefined') {
    const cookie = document.cookie
      .split('; ')
      .find((entry) => entry.startsWith(`${LOCATION_PROMPT_COOKIE_KEY}=`))
      ?.slice(LOCATION_PROMPT_COOKIE_KEY.length + 1);
    if (cookie === '1') return { location: null, dismissed: true };
  }
  return { location: null, dismissed: false };
}

function persistLocationPreference(preference: LocationPreference): void {
  try {
    localStorage.setItem(LOCATION_STORAGE_KEY, serializeLocationPreference(preference));
  } catch {
    // The location remains available in memory for this session.
  }

  persistLocationPromptDismissal(preference.dismissed);
}

function persistLocationPromptDismissal(dismissed: boolean): void {
  if (typeof document !== 'undefined') {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    const maxAge = dismissed ? LOCATION_COOKIE_MAX_AGE : 0;
    const value = dismissed ? '1' : '';
    try {
      document.cookie = `${LOCATION_PROMPT_COOKIE_KEY}=${value}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
    } catch (error) {
      console.warn('Could not persist the location prompt preference in a browser cookie:', error);
    }
  }
}

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
  const [initialPreference] = useState(readLocationPreference);
  const [location, setLocationState] = useState<CustomerLocation | null>(initialPreference.location);
  const [locationPromptDismissed, setLocationPromptDismissed] = useState(initialPreference.dismissed);

  const [isLocationModalOpen, setIsLocationModalOpen] = useState<boolean>(false);

  // Ask only once on this device unless the user explicitly clears their saved location.
  useEffect(() => {
    if (!location && !locationPromptDismissed) {
      const timer = setTimeout(() => {
        setIsLocationModalOpen(true);
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [location, locationPromptDismissed]);

  const setLocation = (newLoc: CustomerLocation) => {
    setLocationState(newLoc);
    setLocationPromptDismissed(true);
    persistLocationPreference({ location: newLoc, dismissed: true });
    setIsLocationModalOpen(false);
  };

  const clearLocation = () => {
    setLocationState(null);
    setLocationPromptDismissed(false);
    persistLocationPreference({ location: null, dismissed: false });
    setIsLocationModalOpen(true);
  };

  const openLocationModal = () => setIsLocationModalOpen(true);
  const closeLocationModal = () => {
    setIsLocationModalOpen(false);
    if (!location) {
      setLocationPromptDismissed(true);
      persistLocationPreference({ location: null, dismissed: true });
    }
  };

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
