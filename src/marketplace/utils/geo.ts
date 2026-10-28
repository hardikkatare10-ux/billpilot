/**
 * NearBasket - Geographical & Area Directory Utilities
 * 
 * Includes high-precision Haversine distance calculations,
 * coordinates validation, and bulk CSV/JSON import parsers.
 */

import { AreaRecord, AreaLevel } from '../types';

/**
 * Calculates great-circle distance between two geographic coordinates in kilometers
 * using the Haversine formula.
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;

  const R = 6371; // Earth's mean radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  // Return distance rounded to 2 decimal places
  return Math.round(distance * 100) / 100;
}

/**
 * Formats a kilometer distance for customer-facing display
 */
export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1)} km`;
}

/**
 * Pre-verified hierarchical metro locality baseline
 */
export const BASELINE_AREAS: AreaRecord[] = [
  // BENGALURU
  {
    id: 'blr_indiranagar',
    name: 'Indiranagar',
    city: 'Bengaluru',
    state: 'Karnataka',
    country: 'India',
    pincode: '560038',
    level: 'locality',
    aliases: ['Indira Nagar', 'CMH Road', '100 Feet Road', 'Defense Colony', 'HAL 2nd Stage'],
    coordinates: { latitude: 12.9784, longitude: 77.6408 },
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'blr_indiranagar_defcol',
    name: 'Defense Colony',
    city: 'Bengaluru',
    state: 'Karnataka',
    country: 'India',
    pincode: '560038',
    level: 'sub_locality',
    parentAreaId: 'blr_indiranagar',
    aliases: ['Defence Colony Indiranagar'],
    coordinates: { latitude: 12.9812, longitude: 77.6435 },
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'blr_koramangala',
    name: 'Koramangala',
    city: 'Bengaluru',
    state: 'Karnataka',
    country: 'India',
    pincode: '560034',
    level: 'locality',
    aliases: ['Koramangala 4th Block', 'Koramangala 5th Block', 'Sony World Signal', 'Jyoti Nivas'],
    coordinates: { latitude: 12.9352, longitude: 77.6245 },
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'blr_koramangala_4th',
    name: 'Koramangala 4th Block',
    city: 'Bengaluru',
    state: 'Karnataka',
    country: 'India',
    pincode: '560034',
    level: 'sub_locality',
    parentAreaId: 'blr_koramangala',
    aliases: ['Block 4 Koramangala', 'ST Bed Layout'],
    coordinates: { latitude: 12.9341, longitude: 77.6291 },
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'blr_hsr_layout',
    name: 'HSR Layout',
    city: 'Bengaluru',
    state: 'Karnataka',
    country: 'India',
    pincode: '560102',
    level: 'locality',
    aliases: ['Hosur Sarjapur Road Layout', '27th Main HSR', 'Sector 1 HSR', 'Sector 2 HSR'],
    coordinates: { latitude: 12.9121, longitude: 77.6446 },
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'blr_hsr_sec1',
    name: 'HSR Sector 1',
    city: 'Bengaluru',
    state: 'Karnataka',
    country: 'India',
    pincode: '560102',
    level: 'sub_locality',
    parentAreaId: 'blr_hsr_layout',
    aliases: ['Sector 1 HSR Layout', 'Agara Lake Road'],
    coordinates: { latitude: 12.9189, longitude: 77.6495 },
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'blr_whitefield',
    name: 'Whitefield',
    city: 'Bengaluru',
    state: 'Karnataka',
    country: 'India',
    pincode: '560066',
    level: 'locality',
    aliases: ['ITPL', 'Hope Farm', 'Kadugodi', 'EPIP Zone'],
    coordinates: { latitude: 12.9698, longitude: 77.7500 },
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'blr_jp_nagar',
    name: 'JP Nagar',
    city: 'Bengaluru',
    state: 'Karnataka',
    country: 'India',
    pincode: '560078',
    level: 'locality',
    aliases: ['Jayaprakash Narayan Nagar', 'JP Nagar 2nd Phase', 'JP Nagar 7th Phase'],
    coordinates: { latitude: 12.9063, longitude: 77.5857 },
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'blr_jayanagar',
    name: 'Jayanagar',
    city: 'Bengaluru',
    state: 'Karnataka',
    country: 'India',
    pincode: '560011',
    level: 'locality',
    aliases: ['Jayanagar 4th Block', 'Jayanagar Shopping Complex', 'South End Circle'],
    coordinates: { latitude: 12.9308, longitude: 77.5838 },
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },

  // MUMBAI
  {
    id: 'mum_bandra_west',
    name: 'Bandra West',
    city: 'Mumbai',
    state: 'Maharashtra',
    country: 'India',
    pincode: '400050',
    level: 'locality',
    aliases: ['Bandra', 'Hill Road', 'Pali Hill', 'Carter Road', 'Linking Road'],
    coordinates: { latitude: 19.0596, longitude: 72.8295 },
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'mum_pali_hill',
    name: 'Pali Hill',
    city: 'Mumbai',
    state: 'Maharashtra',
    country: 'India',
    pincode: '400050',
    level: 'sub_locality',
    parentAreaId: 'mum_bandra_west',
    aliases: ['Pali Naka', 'Dr Ambedkar Road Bandra'],
    coordinates: { latitude: 19.0652, longitude: 72.8318 },
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'mum_andheri_west',
    name: 'Andheri West',
    city: 'Mumbai',
    state: 'Maharashtra',
    country: 'India',
    pincode: '400053',
    level: 'locality',
    aliases: ['Lokhandwala', 'Oshiwara', 'Versova', 'DN Nagar'],
    coordinates: { latitude: 19.1363, longitude: 72.8277 },
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'mum_powai',
    name: 'Powai',
    city: 'Mumbai',
    state: 'Maharashtra',
    country: 'India',
    pincode: '400076',
    level: 'locality',
    aliases: ['Hiranandani Gardens Powai', 'IIT Bombay', 'Powai Lake'],
    coordinates: { latitude: 19.1176, longitude: 72.9060 },
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'mum_colaba',
    name: 'Colaba',
    city: 'Mumbai',
    state: 'Maharashtra',
    country: 'India',
    pincode: '400005',
    level: 'locality',
    aliases: ['Colaba Causeway', 'Gateway of India', 'Cuffe Parade'],
    coordinates: { latitude: 18.9067, longitude: 72.8147 },
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },

  // DELHI-NCR
  {
    id: 'del_connaught_place',
    name: 'Connaught Place',
    city: 'Delhi-NCR',
    state: 'Delhi',
    country: 'India',
    pincode: '110001',
    level: 'locality',
    aliases: ['CP', 'Rajiv Chowk', 'Barakhamba Road', 'Janpath'],
    coordinates: { latitude: 28.6304, longitude: 77.2177 },
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'del_hauz_khas',
    name: 'Hauz Khas',
    city: 'Delhi-NCR',
    state: 'Delhi',
    country: 'India',
    pincode: '110016',
    level: 'locality',
    aliases: ['HKV', 'Hauz Khas Village', 'Green Park', 'Aurobindo Marg'],
    coordinates: { latitude: 28.5494, longitude: 77.2001 },
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'del_gurugram_cybercity',
    name: 'DLF Cyber City',
    city: 'Delhi-NCR',
    state: 'Haryana',
    country: 'India',
    pincode: '122002',
    level: 'locality',
    aliases: ['Cyber City Gurugram', 'DLF Phase 2', 'Cyber Hub Gurgaon'],
    coordinates: { latitude: 28.4907, longitude: 77.0898 },
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },

  // HYDERABAD
  {
    id: 'hyd_gachibowli',
    name: 'Gachibowli',
    city: 'Hyderabad',
    state: 'Telangana',
    country: 'India',
    pincode: '500032',
    level: 'locality',
    aliases: ['Financial District Gachibowli', 'Outer Ring Road', 'Wipro Circle'],
    coordinates: { latitude: 17.4401, longitude: 78.3489 },
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'hyd_jubilee_hills',
    name: 'Jubilee Hills',
    city: 'Hyderabad',
    state: 'Telangana',
    country: 'India',
    pincode: '500033',
    level: 'locality',
    aliases: ['Road No 36 Jubilee Hills', 'Road No 45', 'Film Nagar'],
    coordinates: { latitude: 17.4319, longitude: 78.4073 },
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'hyd_madhapur',
    name: 'Madhapur',
    city: 'Hyderabad',
    state: 'Telangana',
    country: 'India',
    pincode: '500081',
    level: 'locality',
    aliases: ['Hitec City', 'Cyber Towers', 'Inorbit Mall'],
    coordinates: { latitude: 17.4483, longitude: 78.3915 },
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },

  // PUNE
  {
    id: 'pun_koregaon_park',
    name: 'Koregaon Park',
    city: 'Pune',
    state: 'Maharashtra',
    country: 'India',
    pincode: '411001',
    level: 'locality',
    aliases: ['KP', 'North Main Road', 'South Main Road', 'Lane 7'],
    coordinates: { latitude: 18.5362, longitude: 73.8940 },
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'pun_baner',
    name: 'Baner',
    city: 'Pune',
    state: 'Maharashtra',
    country: 'India',
    pincode: '411045',
    level: 'locality',
    aliases: ['Baner Road', 'High Street Baner', 'Balewadi'],
    coordinates: { latitude: 18.5590, longitude: 73.7868 },
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },

  // CHENNAI
  {
    id: 'chn_t_nagar',
    name: 'T. Nagar',
    city: 'Chennai',
    state: 'Tamil Nadu',
    country: 'India',
    pincode: '600017',
    level: 'locality',
    aliases: ['Thyagaraya Nagar', 'Pondy Bazaar', 'Usman Road', 'Panagal Park'],
    coordinates: { latitude: 13.0418, longitude: 80.2341 },
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'chn_adyar',
    name: 'Adyar',
    city: 'Chennai',
    state: 'Tamil Nadu',
    country: 'India',
    pincode: '600020',
    level: 'locality',
    aliases: ['Gandhi Nagar Adyar', 'Besant Avenue', 'Kasturibai Nagar'],
    coordinates: { latitude: 13.0012, longitude: 80.2565 },
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

/**
 * Validates and parses bulk CSV input into AreaRecord candidates.
 * Expected columns: name, city, state, country, pincode, level, latitude, longitude, aliases
 */
export function parseAreaCSV(csvText: string): {
  validRecords: Omit<AreaRecord, 'id' | 'createdAt' | 'updatedAt'>[];
  errors: string[];
} {
  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) {
    return { validRecords: [], errors: ['CSV must contain a header row and at least one data row'] };
  }

  const header = lines[0].toLowerCase().split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''));
  const nameIdx = header.indexOf('name');
  const cityIdx = header.indexOf('city');
  const stateIdx = header.indexOf('state');
  const pincodeIdx = header.indexOf('pincode');
  const latIdx = header.indexOf('latitude');
  const lonIdx = header.indexOf('longitude');
  const levelIdx = header.indexOf('level');
  const countryIdx = header.indexOf('country');
  const aliasesIdx = header.indexOf('aliases');

  if (nameIdx === -1 || cityIdx === -1 || pincodeIdx === -1 || latIdx === -1 || lonIdx === -1) {
    return {
      validRecords: [],
      errors: ['Missing required columns: "name", "city", "pincode", "latitude", "longitude" are required.'],
    };
  }

  const validRecords: Omit<AreaRecord, 'id' | 'createdAt' | 'updatedAt'>[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rawLine = lines[i];
    // Simple split accounting for quoted values
    const cols = parseCSVRow(rawLine);
    if (cols.length < 5) {
      errors.push(`Row ${i + 1}: Insufficient column values.`);
      continue;
    }

    const name = cols[nameIdx]?.trim();
    const city = cols[cityIdx]?.trim();
    const pincode = cols[pincodeIdx]?.trim();
    const lat = parseFloat(cols[latIdx]);
    const lon = parseFloat(cols[lonIdx]);
    const state = stateIdx !== -1 && cols[stateIdx] ? cols[stateIdx].trim() : 'India';
    const country = countryIdx !== -1 && cols[countryIdx] ? cols[countryIdx].trim() : 'India';
    const levelStr = levelIdx !== -1 && cols[levelIdx] ? cols[levelIdx].trim().toLowerCase() : 'locality';
    const level: AreaLevel = levelStr === 'sub_locality' || levelStr === 'city' ? levelStr : 'locality';
    const aliases = aliasesIdx !== -1 && cols[aliasesIdx]
      ? cols[aliasesIdx].split(';').map((a) => a.trim()).filter(Boolean)
      : [];

    if (!name || !city || !pincode) {
      errors.push(`Row ${i + 1}: Name, city, and pincode are required.`);
      continue;
    }

    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      errors.push(`Row ${i + 1} ("${name}"): Invalid geographic coordinates (${cols[latIdx]}, ${cols[lonIdx]}).`);
      continue;
    }

    validRecords.push({
      name,
      city,
      state,
      country,
      pincode,
      level,
      aliases,
      coordinates: { latitude: lat, longitude: lon },
      status: 'active',
    });
  }

  return { validRecords, errors };
}

/**
 * Validates and parses bulk JSON input into AreaRecord candidates.
 */
export function parseAreaJSON(jsonText: string): {
  validRecords: Omit<AreaRecord, 'id' | 'createdAt' | 'updatedAt'>[];
  errors: string[];
} {
  try {
    const parsed = JSON.parse(jsonText);
    const items = Array.isArray(parsed) ? parsed : [parsed];
    const validRecords: Omit<AreaRecord, 'id' | 'createdAt' | 'updatedAt'>[] = [];
    const errors: string[] = [];

    items.forEach((item, idx) => {
      const name = item.name?.toString().trim();
      const city = item.city?.toString().trim();
      const pincode = item.pincode?.toString().trim();
      const lat = typeof item.latitude === 'number' ? item.latitude : parseFloat(item.coordinates?.latitude || item.latitude);
      const lon = typeof item.longitude === 'number' ? item.longitude : parseFloat(item.coordinates?.longitude || item.longitude);

      if (!name || !city || !pincode) {
        errors.push(`Item #${idx + 1}: "name", "city", and "pincode" are required fields.`);
        return;
      }

      if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        errors.push(`Item #${idx + 1} ("${name}"): Invalid geographic coordinates.`);
        return;
      }

      const aliases = Array.isArray(item.aliases)
        ? item.aliases.map((a: unknown) => String(a).trim()).filter(Boolean)
        : typeof item.aliases === 'string'
        ? item.aliases.split(';').map((a: string) => a.trim()).filter(Boolean)
        : [];

      validRecords.push({
        name,
        city,
        state: item.state?.toString().trim() || 'India',
        country: item.country?.toString().trim() || 'India',
        pincode,
        level: item.level === 'sub_locality' || item.level === 'city' ? item.level : 'locality',
        parentAreaId: item.parentAreaId?.toString().trim() || undefined,
        aliases,
        coordinates: { latitude: lat, longitude: lon },
        status: item.status === 'inactive' ? 'inactive' : 'active',
      });
    });

    return { validRecords, errors };
  } catch (err) {
    return {
      validRecords: [],
      errors: [`Invalid JSON format: ${err instanceof Error ? err.message : 'Syntax error'}`],
    };
  }
}

/**
 * Basic CSV row tokenizer respecting quotes
 */
function parseCSVRow(row: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    if (char === '"' || char === "'") {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim().replace(/^["']|["']$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^["']|["']$/g, ''));
  return result;
}

/**
 * Reads latitude/longitude out of a pasted Google Maps link (or plain "lat, lng" text).
 * Short links (maps.app.goo.gl / goo.gl/maps) cannot be resolved in the browser - they
 * return null and the UI asks for the full link or the current-location button instead.
 */
export function parseGoogleMapsLocation(
  input: string
): { latitude: number; longitude: number } | null {
  const text = decodeURIComponent((input || '').trim());
  if (!text) return null;
  const num = '(-?\\d{1,3}(?:\\.\\d+)?)';
  const patterns = [
    new RegExp(`!3d${num}!4d${num}`),
    new RegExp(`@${num},\\s*${num}`),
    new RegExp(`[?&](?:q|ll|query|destination|center|daddr)=${num},\\s*${num}`),
    new RegExp(`^${num}\\s*,\\s*${num}$`),
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const latitude = parseFloat(m[1]);
      const longitude = parseFloat(m[2]);
      if (latitude >= 6 && latitude <= 38 && longitude >= 68 && longitude <= 98) {
        return { latitude, longitude };
      }
    }
  }
  return null;
}

export function googleMapsUrl(c: { latitude: number; longitude: number }): string {
  return `https://www.google.com/maps?q=${c.latitude},${c.longitude}`;
}
