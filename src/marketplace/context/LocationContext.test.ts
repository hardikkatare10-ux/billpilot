import { describe, expect, it } from 'vitest';
import {
  parseLocationPreference,
  serializeLocationPreference,
  type LocationPreference,
} from './LocationContext';
import type { CustomerLocation } from '../types';

const savedLocation: CustomerLocation = {
  city: 'Pune',
  locality: 'Kothrud',
  coordinates: { latitude: 18.5074, longitude: 73.8077 },
  formattedAddress: 'Kothrud, Pune',
};

describe('location preference persistence', () => {
  it('restores a saved location from the legacy device-storage format without prompting again', () => {
    expect(parseLocationPreference(JSON.stringify(savedLocation))).toEqual({
      location: savedLocation,
      dismissed: true,
    });
  });

  it('round-trips an explicitly dismissed location prompt', () => {
    const preference: LocationPreference = { location: null, dismissed: true };
    expect(parseLocationPreference(serializeLocationPreference(preference))).toEqual(preference);
  });

  it('round-trips a selected location and its dismissal state', () => {
    const preference: LocationPreference = { location: savedLocation, dismissed: true };
    expect(parseLocationPreference(serializeLocationPreference(preference))).toEqual(preference);
  });

  it('ignores corrupt or incomplete saved location data', () => {
    expect(parseLocationPreference('{invalid')).toBeNull();
    expect(parseLocationPreference(JSON.stringify({
      city: 'Pune',
      locality: 'Kothrud',
      coordinates: { latitude: 200, longitude: 73 },
      formattedAddress: 'Kothrud, Pune',
    }))).toBeNull();
  });
});
