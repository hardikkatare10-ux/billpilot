/**
 * NearBasket - Production-Ready India-Wide Location Search & Address Selector
 * 
 * Features:
 * - Google Maps Platform Places API (New) Autocomplete integration restricted to India ('in')
 * - Automatic 6-digit Indian PIN code detection & verified India Post directory resolution
 * - Multi-office PIN-code breakdown (e.g. Vijay Nagar, Wright Town, Jabalpur City for 482002)
 * - GPS Current Location detection with reverse geolocation
 * - Manual address entry fallback for villages and unlisted colonies
 * - Address confirmation screen with live shop delivery availability check before saving
 * - Strict cost optimization: request debouncing, session tokens, and field masks
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import {
  MapPin,
  Search,
  Navigation,
  Check,
  ChevronRight,
  X,
  AlertCircle,
  Building2,
  ArrowLeft,
  Loader2,
  ShieldCheck,
  CheckCircle2,
  Truck,
  Edit3,
  HelpCircle,
  Sparkles,
} from 'lucide-react';
import { useLocation } from '../../context/LocationContext';
import { useAuth } from '../../context/AuthContext';
import { dbStore } from '../../services/db/store';
import { CustomerLocation, Shop } from '../../types';
import {
  lookupIndiaPostPincode,
  isSixDigitPincode,
  PostOfficeRecord,
  PostalLookupResponse,
} from '../../services/postal/indiaPost';

interface SuggestionItem {
  id: string;
  primaryText: string;
  secondaryText: string;
  fullText: string;
  type: 'google_place' | 'india_post' | 'preset_area';
  rawPlacePrediction?: google.maps.places.AutocompletePrediction;
  rawPostOffice?: PostOfficeRecord;
  presetArea?: any;
}

export const LocationModal: React.FC = () => {
  const { location, setLocation, isLocationModalOpen, closeLocationModal } = useLocation();
  const { currentUser } = useAuth();

  const placesLib = useMapsLibrary('places');
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  // Search input state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Suggestions state
  const [googleSuggestions, setGoogleSuggestions] = useState<SuggestionItem[]>([]);
  const [postalResult, setPostalResult] = useState<PostalLookupResponse | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  // GPS state
  const [isDetectingGps, setIsDetectingGps] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Mode: 'search' | 'confirm' | 'manual'
  const [modalMode, setModalMode] = useState<'search' | 'confirm' | 'manual'>('search');

  // Candidate address selected for confirmation
  const [candidateLocation, setCandidateLocation] = useState<CustomerLocation | null>(null);
  const [candidateNotes, setCandidateNotes] = useState<string>(''); // e.g. Flat/House number

  // Manual fallback form state
  const [manualStreet, setManualStreet] = useState('');
  const [manualLocality, setManualLocality] = useState('');
  const [manualCity, setManualCity] = useState('');
  const [manualState, setManualState] = useState('');
  const [manualPincode, setManualPincode] = useState('');

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus search input when opened
  useEffect(() => {
    if (isLocationModalOpen) {
      setModalMode('search');
      setSearchQuery('');
      setCandidateLocation(null);
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isLocationModalOpen]);

  // Debounce search query input (300ms) to manage API calls and costs
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Initialize or reset Google AutocompleteSessionToken
  const getSessionToken = useCallback(() => {
    if (!placesLib) return null;
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = new placesLib.AutocompleteSessionToken();
    }
    return sessionTokenRef.current;
  }, [placesLib]);

  const resetSessionToken = useCallback(() => {
    sessionTokenRef.current = null;
  }, []);

  // Primary Query Effect: Handles PIN code lookup OR Google Places (New) Autocomplete
  useEffect(() => {
    let isCancelled = false;

    if (!debouncedQuery) {
      setGoogleSuggestions([]);
      setPostalResult(null);
      setIsLoading(false);
      setSearchError(null);
      return;
    }

    // CASE 1: User typed a 6-digit Indian PIN Code
    if (isSixDigitPincode(debouncedQuery)) {
      setIsLoading(true);
      setSearchError(null);
      setGoogleSuggestions([]);

      lookupIndiaPostPincode(debouncedQuery)
        .then((res) => {
          if (!isCancelled) {
            setPostalResult(res);
            setIsLoading(false);
          }
        })
        .catch((err) => {
          if (!isCancelled) {
            console.error('Error fetching postal data:', err);
            setSearchError('Could not verify PIN code. You can enter your locality manually.');
            setIsLoading(false);
          }
        });

      return () => {
        isCancelled = true;
      };
    }

    // CASE 2: Text search across India (Cities, Localities, States, Landmarks)
    setPostalResult(null);

    // If Places library is ready, execute AutocompleteSuggestion with India restriction
    if (placesLib && placesLib.AutocompleteSuggestion) {
      setIsLoading(true);
      setSearchError(null);

      const sessionToken = getSessionToken();

      const request: any = {
        input: debouncedQuery,
        includedRegionCodes: ['in'], // Restrict suggestions to India
        language: 'en',
        sessionToken,
      };

      placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions(request)
        .then((res: any) => {
          if (isCancelled) return;
          setIsLoading(false);

          if (res && res.suggestions && Array.isArray(res.suggestions)) {
            const mapped: SuggestionItem[] = res.suggestions.map((s: any, idx: number) => {
              const pred = s.placePrediction;
              return {
                id: pred?.placeId || `sug_${idx}`,
                primaryText: pred?.mainText?.text || pred?.text?.text || debouncedQuery,
                secondaryText: pred?.secondaryText?.text || 'India',
                fullText: pred?.text?.text || debouncedQuery,
                type: 'google_place',
                rawPlacePrediction: pred,
              };
            });
            setGoogleSuggestions(mapped);
          } else {
            setGoogleSuggestions([]);
          }
        })
        .catch((err: any) => {
          if (isCancelled) return;
          console.warn('Google Places Autocomplete error:', err);
          setIsLoading(false);
          // Fallback to internal directory if Google API fails or has quota issue
          setSearchError(null);
        });
    }

    return () => {
      isCancelled = true;
    };
  }, [debouncedQuery, placesLib, getSessionToken]);

  // Handle selection of a Google Places suggestion
  const handleSelectGooglePlace = async (suggestion: SuggestionItem) => {
    if (!suggestion.rawPlacePrediction) return;

    setIsLoading(true);
    try {
      // Convert prediction to Place and fetch required fields
      const place = (suggestion.rawPlacePrediction as any).toPlace();
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'location', 'addressComponents'],
      });

      // Extract structured address parts
      let locality = '';
      let subLocality = '';
      let city = '';
      let district = '';
      let state = '';
      let pincode = '';

      if (place.addressComponents && Array.isArray(place.addressComponents)) {
        for (const comp of place.addressComponents) {
          const types = comp.types || [];
          if (types.includes('sublocality_level_1') || types.includes('sublocality')) {
            subLocality = comp.longText || comp.shortText || '';
          }
          if (types.includes('locality')) {
            locality = comp.longText || comp.shortText || '';
          }
          if (types.includes('administrative_area_level_2')) {
            district = comp.longText || comp.shortText || '';
          }
          if (types.includes('administrative_area_level_1')) {
            state = comp.longText || comp.shortText || '';
          }
          if (types.includes('postal_code')) {
            pincode = comp.longText || comp.shortText || '';
          }
        }
      }

      // Sensible defaults if specific administrative layers are missing
      const resolvedLocality = locality || subLocality || suggestion.primaryText;
      const resolvedCity = city || district || locality || 'Jabalpur';
      const lat = place.location ? place.location.lat() : 23.1815;
      const lng = place.location ? place.location.lng() : 79.9864;

      const candidate: CustomerLocation = {
        city: resolvedCity,
        locality: resolvedLocality,
        subLocality: subLocality && subLocality !== resolvedLocality ? subLocality : undefined,
        district: district || resolvedCity,
        state: state || 'India',
        pincode: pincode || undefined,
        placeId: place.id,
        coordinates: { latitude: lat, longitude: lng },
        formattedAddress: place.formattedAddress || `${suggestion.primaryText}, ${suggestion.secondaryText}`,
        source: 'google_places',
        isPostalVerified: Boolean(pincode),
      };

      setCandidateLocation(candidate);
      setModalMode('confirm');
      resetSessionToken();
    } catch (err) {
      console.error('Error fetching Place fields:', err);
      // Fallback to basic prediction data
      const candidate: CustomerLocation = {
        city: suggestion.secondaryText.split(',')[0]?.trim() || 'Jabalpur',
        locality: suggestion.primaryText,
        state: suggestion.secondaryText,
        coordinates: { latitude: 23.1815, longitude: 79.9864 },
        formattedAddress: suggestion.fullText,
        source: 'google_places',
      };
      setCandidateLocation(candidate);
      setModalMode('confirm');
      resetSessionToken();
    } finally {
      setIsLoading(false);
    }
  };

  // Handle selection of a Post Office under a PIN code
  const handleSelectPostOffice = (po: PostOfficeRecord) => {
    const candidate: CustomerLocation = {
      city: po.district,
      locality: po.name,
      subLocality: po.branchType !== 'Head Post Office' ? po.name : undefined,
      district: po.district,
      state: po.state,
      pincode: po.pincode,
      postOffice: po.name,
      coordinates: { ...po.coordinates },
      formattedAddress: `${po.name}, ${po.district}, ${po.state} - ${po.pincode}`,
      source: 'india_post',
      isPostalVerified: true,
    };

    setCandidateLocation(candidate);
    setModalMode('confirm');
  };

  // Handle Browser Geolocation
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }

    setIsDetectingGps(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;

        // Try reverse geocoding via Google Maps Geocoding if key is present
        const apiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY;
        if (apiKey) {
          fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}&region=in`
          )
            .then((res) => res.json())
            .then((data) => {
              setIsDetectingGps(false);
              if (data.results && data.results.length > 0) {
                const first = data.results[0];
                let locality = '';
                let city = '';
                let district = '';
                let state = '';
                let pincode = '';

                for (const comp of first.address_components || []) {
                  const types = comp.types || [];
                  if (types.includes('sublocality_level_1') || types.includes('sublocality')) {
                    locality = comp.long_name;
                  }
                  if (types.includes('locality') && !locality) {
                    locality = comp.long_name;
                  }
                  if (types.includes('administrative_area_level_2')) {
                    district = comp.long_name;
                  }
                  if (types.includes('administrative_area_level_1')) {
                    state = comp.long_name;
                  }
                  if (types.includes('postal_code')) {
                    pincode = comp.long_name;
                  }
                }

                const candidate: CustomerLocation = {
                  city: city || district || 'Local Area',
                  locality: locality || 'Current Location',
                  district: district || undefined,
                  state: state || 'India',
                  pincode: pincode || undefined,
                  coordinates: { latitude, longitude },
                  formattedAddress: first.formatted_address || `Near ${locality || district}`,
                  source: 'gps',
                };
                setCandidateLocation(candidate);
                setModalMode('confirm');
              } else {
                fallbackGpsCandidate(latitude, longitude);
              }
            })
            .catch(() => {
              setIsDetectingGps(false);
              fallbackGpsCandidate(latitude, longitude);
            });
        } else {
          setIsDetectingGps(false);
          fallbackGpsCandidate(latitude, longitude);
        }
      },
      (err) => {
        setIsDetectingGps(false);
        setGpsError(`Could not access device location: ${err.message}. Please search your location.`);
      },
      { timeout: 9000, enableHighAccuracy: true }
    );
  };

  const fallbackGpsCandidate = (latitude: number, longitude: number) => {
    const candidate: CustomerLocation = {
      city: 'Detected City',
      locality: 'Current Location',
      coordinates: { latitude, longitude },
      formattedAddress: `GPS Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
      source: 'gps',
    };
    setCandidateLocation(candidate);
    setModalMode('confirm');
  };

  // Submit manual address entry form
  const handleSaveManualAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualLocality.trim() || !manualCity.trim()) return;

    const candidate: CustomerLocation = {
      city: manualCity.trim(),
      locality: manualLocality.trim(),
      state: manualState.trim() || 'India',
      pincode: manualPincode.trim() || undefined,
      coordinates: { latitude: 23.1815, longitude: 79.9864 }, // Default Indian centroid
      formattedAddress: `${manualStreet.trim() ? manualStreet.trim() + ', ' : ''}${manualLocality.trim()}, ${manualCity.trim()}${manualPincode.trim() ? ' - ' + manualPincode.trim() : ''}`,
      source: 'manual',
      isPostalVerified: false,
    };

    setCandidateLocation(candidate);
    setModalMode('confirm');
  };

  // Check shop delivery availability for candidate location
  const candidateCoverage = useMemo(() => {
    if (!candidateLocation) return { servingShops: [], hasService: false };

    const shopsServing = dbStore.getShopsWithDistance(
      candidateLocation.coordinates,
      {
        pincode: candidateLocation.pincode,
        locality: candidateLocation.locality,
        city: candidateLocation.city,
      }
    );

    const availableShops = shopsServing.filter((s) => s.isDeliveryAvailable);
    return {
      servingShops: availableShops,
      hasService: availableShops.length > 0,
    };
  }, [candidateLocation]);

  // Final confirmation: save location & close modal
  const handleFinalConfirm = () => {
    if (!candidateLocation) return;

    const finalAddress = candidateNotes.trim()
      ? `${candidateNotes.trim()}, ${candidateLocation.formattedAddress}`
      : candidateLocation.formattedAddress;

    const finalLoc: CustomerLocation = {
      ...candidateLocation,
      formattedAddress: finalAddress,
    };

    setLocation(finalLoc);
  };

  // Keyboard navigation for suggestions
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, googleSuggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter') {
      if (selectedIndex >= 0 && googleSuggestions[selectedIndex]) {
        e.preventDefault();
        handleSelectGooglePlace(googleSuggestions[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      if (location) closeLocationModal();
    }
  };

  if (!isLocationModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden font-sans">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between shrink-0 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            {modalMode !== 'search' && (
              <button
                type="button"
                onClick={() => setModalMode('search')}
                className="p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg cursor-pointer transition-colors"
                title="Back to search"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-1.5">
                <MapPin className="w-5 h-5 text-blue-600 shrink-0" />
                <span>
                  {modalMode === 'confirm'
                    ? 'Confirm Delivery Address'
                    : modalMode === 'manual'
                    ? 'Manual Address Entry'
                    : 'Choose Delivery Location'}
                </span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {modalMode === 'confirm'
                  ? 'Verify your address details and neighborhood shop service.'
                  : modalMode === 'manual'
                  ? 'Enter address details manually for unlisted colonies or villages.'
                  : 'Search by city, town, village, colony, landmark, or 6-digit PIN code.'}
              </p>
            </div>
          </div>

          {location && (
            <button
              onClick={closeLocationModal}
              aria-label="Close location selector"
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Modal Content Switcher */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* ========================================================
              MODE 1: SEARCH MODE
          ======================================================== */}
          {modalMode === 'search' && (
            <>
              {/* Dynamic Search Input */}
              <div className="space-y-1.5">
                <label
                  htmlFor="location-search-input"
                  className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block"
                >
                  Search Location (India-Wide)
                </label>
                <div className="relative group">
                  <Search className="w-4 h-4 text-slate-400 group-focus-within:text-blue-600 absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors" />
                  <input
                    id="location-search-input"
                    ref={searchInputRef}
                    type="text"
                    placeholder="Try 'Jabalpur', 'Vijay Nagar', '482002', or landmark..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-300 hover:border-slate-400 rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all font-medium"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        searchInputRef.current?.focus();
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-200/60 cursor-pointer"
                      title="Clear search"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {isLoading && (
                  <div className="flex items-center gap-2 text-xs text-blue-600 pt-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Searching verified Indian locations...</span>
                  </div>
                )}
              </div>

              {/* Quick Action: Use Device GPS Location */}
              {!searchQuery && (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    disabled={isDetectingGps}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100/80 text-blue-900 transition-all cursor-pointer text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                        <Navigation className={`w-4 h-4 ${isDetectingGps ? 'animate-spin' : ''}`} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 text-xs sm:text-sm">
                          {isDetectingGps ? 'Detecting Your Location...' : 'Use Current Device Location'}
                        </p>
                        <p className="text-[11px] text-slate-500 font-normal">
                          Requires browser location permission
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-blue-500 group-hover:translate-x-0.5 transition-transform" />
                  </button>

                  {gpsError && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                      <span>{gpsError}</span>
                    </div>
                  )}

                  {/* Saved Customer Addresses */}
                  {currentUser && currentUser.addresses && currentUser.addresses.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                        Saved Delivery Addresses
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {currentUser.addresses.map((addr) => (
                          <button
                            key={addr.id}
                            type="button"
                            onClick={() => {
                              const cand: CustomerLocation = {
                                city: addr.city,
                                locality: addr.locality,
                                pincode: addr.pincode,
                                coordinates: addr.coordinates || { latitude: 23.1815, longitude: 79.9864 },
                                formattedAddress: `${addr.streetAddress}, ${addr.locality}, ${addr.city} - ${addr.pincode}`,
                                source: 'manual',
                              };
                              setCandidateLocation(cand);
                              setModalMode('confirm');
                            }}
                            className="flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 text-left transition-all cursor-pointer group"
                          >
                            <Building2 className="w-4 h-4 text-slate-400 group-hover:text-blue-600 shrink-0 mt-0.5" />
                            <div className="truncate text-xs">
                              <p className="font-bold text-slate-800 group-hover:text-blue-700">{addr.label}</p>
                              <p className="text-[11px] text-slate-500 truncate">{addr.streetAddress}</p>
                              <p className="text-[10px] text-slate-400 font-mono">
                                {addr.locality}, {addr.city} - {addr.pincode}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Popular Test Cities / Prompts */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Quick Suggestions (India)
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: 'Jabalpur, MP', query: 'Jabalpur, Madhya Pradesh' },
                        { label: 'Vijay Nagar, Jabalpur', query: 'Vijay Nagar, Jabalpur' },
                        { label: 'PIN: 482002', query: '482002' },
                        { label: 'Indore, MP', query: 'Indore, Madhya Pradesh' },
                        { label: 'Bengaluru (560038)', query: 'Indiranagar, Bengaluru' },
                        { label: 'Bandra, Mumbai', query: 'Bandra West, Mumbai' },
                      ].map((chip) => (
                        <button
                          key={chip.label}
                          type="button"
                          onClick={() => {
                            setSearchQuery(chip.query);
                            searchInputRef.current?.focus();
                          }}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* CASE A: Verified Postal Data Results (When user entered 6-digit PIN) */}
              {postalResult && (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      Verified India Post Postal Records
                    </span>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                      PIN: {postalResult.pincode}
                    </span>
                  </div>

                  {!postalResult.success ? (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-2">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">Invalid or Unverified PIN Code</p>
                          <p className="text-[11px] text-amber-800 mt-0.5">{postalResult.message}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setManualPincode(searchQuery);
                          setModalMode('manual');
                        }}
                        className="text-[11px] font-bold text-blue-700 hover:underline cursor-pointer inline-flex items-center gap-1"
                      >
                        Enter your location manually instead →
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-[11px] text-slate-600">
                        {postalResult.district}, {postalResult.state} — Select your specific post office or colony:
                      </p>
                      <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl max-h-60 overflow-y-auto bg-white shadow-2xs">
                        {postalResult.postOffices.map((po, idx) => (
                          <button
                            key={`${po.name}_${idx}`}
                            type="button"
                            onClick={() => handleSelectPostOffice(po)}
                            className="w-full p-3 hover:bg-blue-50/50 text-left transition-colors flex items-center justify-between cursor-pointer group"
                          >
                            <div className="min-w-0 pr-2">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-slate-900 text-xs sm:text-sm group-hover:text-blue-700">
                                  {po.name}
                                </span>
                                <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 rounded font-semibold">
                                  Verified
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                                {po.branchType} · {po.deliveryStatus} · {po.district}, {po.state}
                              </p>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* CASE B: Google Places Autocomplete Suggestions */}
              {searchQuery && !postalResult && (
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Location Suggestions ({googleSuggestions.length})
                    </span>
                    <span className="text-[10px] text-slate-400">Google Places API (New)</span>
                  </div>

                  {googleSuggestions.length > 0 ? (
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl max-h-64 overflow-y-auto bg-white shadow-2xs">
                      {googleSuggestions.map((item, index) => {
                        const isHighlighted = selectedIndex === index;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleSelectGooglePlace(item)}
                            className={`w-full p-3 text-left transition-colors flex items-center justify-between cursor-pointer group ${
                              isHighlighted ? 'bg-blue-50/70' : 'hover:bg-slate-50/80'
                            }`}
                          >
                            <div className="flex items-start gap-2.5 min-w-0 pr-2">
                              <MapPin className="w-4 h-4 text-slate-400 group-hover:text-blue-600 shrink-0 mt-0.5" />
                              <div className="min-w-0">
                                <p className="font-bold text-slate-900 text-xs sm:text-sm group-hover:text-blue-700 truncate">
                                  {item.primaryText}
                                </p>
                                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                  {item.secondaryText}
                                </p>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    !isLoading && (
                      <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-2">
                        <p className="font-bold text-slate-800 text-xs sm:text-sm">
                          No suggestions found for &quot;{debouncedQuery}&quot;
                        </p>
                        <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                          Cannot find your village or locality? You can enter your address manually.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setManualLocality(debouncedQuery);
                            setModalMode('manual');
                          }}
                          className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer shadow-xs"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Enter Address Manually
                        </button>
                      </div>
                    )
                  )}
                </div>
              )}

              {/* Bottom Manual Fallback Link */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Cannot find your exact address?</span>
                <button
                  type="button"
                  onClick={() => setModalMode('manual')}
                  className="text-blue-600 hover:text-blue-700 font-bold hover:underline cursor-pointer"
                >
                  Enter Address Manually
                </button>
              </div>
            </>
          )}

          {/* ========================================================
              MODE 2: CONFIRMATION SCREEN
          ======================================================== */}
          {modalMode === 'confirm' && candidateLocation && (
            <div className="space-y-4 animate-in fade-in">
              {/* Address Summary Card */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
                          {candidateLocation.locality}
                        </h3>
                        {candidateLocation.isPostalVerified && (
                          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            Verified India Post
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {candidateLocation.city}
                        {candidateLocation.district && candidateLocation.district !== candidateLocation.city
                          ? ` (${candidateLocation.district} Dist.)`
                          : ''}
                        , {candidateLocation.state}
                        {candidateLocation.pincode ? ` - ${candidateLocation.pincode}` : ''}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setModalMode('search')}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                  >
                    Change
                  </button>
                </div>

                <div className="p-2.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-600">
                  <span className="font-semibold text-slate-800">Full Address: </span>
                  {candidateLocation.formattedAddress}
                </div>
              </div>

              {/* Flat / House / Landmark Optional Refinement Input */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                  Flat / House / Landmark / Apartment (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Flat 302, Green Heights, Near MR-4 Road"
                  value={candidateNotes}
                  onChange={(e) => setCandidateNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
              </div>

              {/* Shop Delivery Availability Indicator (Direct check against candidate address) */}
              <div
                className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                  candidateCoverage.hasService
                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                    : 'bg-amber-50/70 border-amber-200 text-amber-900'
                }`}
              >
                {candidateCoverage.hasService ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <Truck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                )}

                <div className="text-xs space-y-1">
                  <p className="font-bold">
                    {candidateCoverage.hasService
                      ? `${candidateCoverage.servingShops.length} neighborhood store(s) serve this area!`
                      : 'No registered shops currently deliver to this area.'}
                  </p>
                  <p className="text-[11px] opacity-90 leading-relaxed">
                    {candidateCoverage.hasService
                      ? 'Local merchants in your area are verified and ready to accept orders with doorstep delivery.'
                      : 'Our marketplace has not onboarded local merchants in this specific locality yet. You can still save this address and check back as new shops register.'}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setModalMode('search')}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Change Location
                </button>
                <button
                  type="button"
                  onClick={handleFinalConfirm}
                  className="flex-2 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl text-xs transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Confirm & Deliver Here
                </button>
              </div>
            </div>
          )}

          {/* ========================================================
              MODE 3: MANUAL ADDRESS ENTRY FALLBACK
          ======================================================== */}
          {modalMode === 'manual' && (
            <form onSubmit={handleSaveManualAddress} className="space-y-3 animate-in fade-in text-xs">
              <p className="text-[11px] text-slate-500">
                Enter your location details directly. This is useful for rural areas, new colonies, or villages not yet indexed in map directories.
              </p>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Flat, House, or Street Address
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ward 12, Main Bazar Road"
                  value={manualStreet}
                  onChange={(e) => setManualStreet(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Locality, Village, or Colony *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Vijay Nagar / Simaria"
                    value={manualLocality}
                    onChange={(e) => setManualLocality(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    City or District *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Jabalpur"
                    value={manualCity}
                    onChange={(e) => setManualCity(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    State or Union Territory
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Madhya Pradesh"
                    value={manualState}
                    onChange={(e) => setManualState(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    6-digit PIN Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 482002"
                    value={manualPincode}
                    onChange={(e) => setManualPincode(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono"
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setModalMode('search')}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-2 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl text-xs transition-colors cursor-pointer shadow-xs"
                >
                  Continue to Confirmation
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
