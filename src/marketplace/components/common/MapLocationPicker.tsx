/**
 * Lets the customer share their home location from Google Maps:
 * either paste a Google Maps link, or tap "Use my current location".
 */
import React, { useState } from 'react';
import { MapPin, Crosshair, CheckCircle, AlertCircle } from 'lucide-react';
import { parseGoogleMapsLocation, googleMapsUrl } from '../../utils/geo';

export interface PickedLocation {
  coordinates: { latitude: number; longitude: number };
  mapsLink: string;
}

interface Props {
  value: PickedLocation | null;
  onChange: (v: PickedLocation | null) => void;
  label?: string;
  helpText?: string;
}

export const MapLocationPicker: React.FC<Props> = ({
  value,
  onChange,
  label = 'Home location',
  helpText = 'In Google Maps, press and hold your home, tap Share, copy the link and paste it here. Or let us detect it.',
}) => {
  const [link, setLink] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const applyLink = (text: string) => {
    setLink(text);
    setError(null);
    if (!text.trim()) {
      onChange(null);
      return;
    }
    const c = parseGoogleMapsLocation(text);
    if (c) {
      onChange({ coordinates: c, mapsLink: googleMapsUrl(c) });
    } else {
      onChange(null);
      if (/goo\.gl|maps\.app/i.test(text)) {
        setError(
          'Short links cannot be read. Open the link in your browser and paste the full address-bar URL, or tap "Use my current location".'
        );
      } else {
        setError('Could not find a location in this link. Paste a Google Maps link that shows your pin.');
      }
    }
  };

  const useCurrent = () => {
    setError(null);
    if (!navigator.geolocation) {
      setError('Location is not supported in this browser. Paste a Google Maps link instead.');
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setLink('');
        onChange({ coordinates: c, mapsLink: googleMapsUrl(c) });
        setBusy(false);
      },
      () => {
        setError('Could not get your location. Allow location access, or paste a Google Maps link.');
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  return (
    <div className="space-y-2 p-3 bg-blue-50/60 border border-blue-100 rounded-xl">
      <label className="font-semibold text-slate-800 flex items-center gap-1.5 text-xs">
        <MapPin className="w-4 h-4 text-blue-600" />
        {label} (Google Maps) <span className="text-red-500">*</span>
      </label>
      <p className="text-[11px] text-slate-500">
        {helpText}
      </p>
      <input
        type="text"
        placeholder="Paste Google Maps link here"
        value={link}
        onChange={(e) => applyLink(e.target.value)}
        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs"
      />
      <button
        type="button"
        onClick={useCurrent}
        disabled={busy}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-blue-300 text-blue-700 font-semibold rounded-lg text-xs hover:bg-blue-50 cursor-pointer disabled:opacity-60"
      >
        <Crosshair className="w-3.5 h-3.5" />
        {busy ? 'Detecting...' : 'Use my current location'}
      </button>
      {value && (
        <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-semibold">
          <CheckCircle className="w-3.5 h-3.5" />
          Location saved ({value.coordinates.latitude.toFixed(5)}, {value.coordinates.longitude.toFixed(5)}) -{' '}
          <a href={value.mapsLink} target="_blank" rel="noreferrer" className="underline">
            check on map
          </a>
        </div>
      )}
      {error && (
        <div className="flex items-start gap-1.5 text-[11px] text-red-600">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
