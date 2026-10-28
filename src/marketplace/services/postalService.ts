/**
 * NearBasket - Official Indian Postal Directory Service
 * 
 * Provides unified, indexed access to official Indian postal data:
 * - 4-step hierarchical navigation (State -> District/City -> Town/Village -> 6-Digit PIN Code)
 * - Automatic State and District identification from 6-digit PIN code
 * - Resolves all matching post offices under a PIN code (e.g. 482002 -> Lordganj, Agasaud, Jabalpur City, etc.)
 * - Multi-tier retrieval: Local indexed store -> Backend /api/postal -> Public India Post service fallback
 * - Conflict detection & bulk import capabilities
 */

import { PostalRecord } from '../types';
import {
  INDIAN_STATES_AND_UTS,
  OFFICIAL_DISTRICTS_BY_STATE,
  VERIFIED_POSTAL_DIRECTORY,
  deduceStateFromPincode,
  IndianState,
} from '../data/postalData';

export interface PincodeLookupResult {
  pincode: string;
  state: string;
  district: string;
  postOffices: PostalRecord[];
  source: 'cache' | 'backend_api' | 'webservice' | 'baseline_directory';
}

class IndianPostalService {
  private cache = new Map<string, PostalRecord[]>();
  private postOfficeNameIndex = new Map<string, PostalRecord[]>();
  private customImportedRecords: PostalRecord[] = [];

  constructor() {
    this.indexRecords(VERIFIED_POSTAL_DIRECTORY);
    this.loadCustomImportsFromStorage();
  }

  private loadCustomImportsFromStorage(): void {
    try {
      const stored = localStorage.getItem('billpilot_imported_postal_records');
      if (stored) {
        const parsed = JSON.parse(stored) as PostalRecord[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.customImportedRecords = parsed;
          this.indexRecords(parsed);
        }
      }
    } catch {
      // Ignore parse errors
    }
  }

  private indexRecords(records: PostalRecord[]): void {
    for (const r of records) {
      // Index by PIN code
      const list = this.cache.get(r.pincode) || [];
      if (!list.some((existing) => existing.name.toLowerCase() === r.name.toLowerCase())) {
        list.push(r);
      }
      this.cache.set(r.pincode, list);

      // Index by Post Office / Town Name (lower-case key)
      const nameKey = r.name.toLowerCase().trim();
      const nameList = this.postOfficeNameIndex.get(nameKey) || [];
      if (!nameList.some((existing) => existing.pincode === r.pincode && existing.name === r.name)) {
        nameList.push(r);
      }
      this.postOfficeNameIndex.set(nameKey, nameList);
    }
  }

  /**
   * Returns all 36 Indian States and Union Territories sorted alphabetically
   */
  public getStates(): IndianState[] {
    return [...INDIAN_STATES_AND_UTS].sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Returns all official districts for a selected state
   */
  public getDistricts(stateName: string): string[] {
    if (!stateName) return [];

    // Check exact name match or fuzzy
    const exact = OFFICIAL_DISTRICTS_BY_STATE[stateName];
    if (exact) return [...exact].sort((a, b) => a.localeCompare(b));

    const matchedKey = Object.keys(OFFICIAL_DISTRICTS_BY_STATE).find(
      (k) => k.toLowerCase() === stateName.toLowerCase().trim()
    );
    if (matchedKey) {
      return [...OFFICIAL_DISTRICTS_BY_STATE[matchedKey]].sort((a, b) => a.localeCompare(b));
    }

    return [];
  }

  /**
   * Search town, village, locality, or post office name across the directory
   */
  public searchPostOffices(
    query: string,
    stateFilter?: string,
    districtFilter?: string,
    limit: number = 30
  ): PostalRecord[] {
    const q = query.trim().toLowerCase();
    if (!q) {
      // Return known post offices in state/district if filters provided
      if (stateFilter) {
        const results: PostalRecord[] = [];
        this.cache.forEach((records) => {
          for (const r of records) {
            if (
              r.state.toLowerCase() === stateFilter.toLowerCase() &&
              (!districtFilter || r.district.toLowerCase() === districtFilter.toLowerCase())
            ) {
              results.push(r);
            }
          }
        });
        return results.slice(0, limit);
      }
      return [];
    }

    const matches: PostalRecord[] = [];
    const seen = new Set<string>();

    this.cache.forEach((records) => {
      for (const r of records) {
        if (stateFilter && r.state.toLowerCase() !== stateFilter.toLowerCase()) continue;
        if (districtFilter && r.district.toLowerCase() !== districtFilter.toLowerCase()) continue;

        const key = `${r.pincode}_${r.name}`;
        if (seen.has(key)) continue;

        const nameMatch = r.name.toLowerCase().includes(q);
        const pinMatch = r.pincode.startsWith(q);
        const blockMatch = r.block?.toLowerCase().includes(q);
        const distMatch = r.district.toLowerCase().includes(q);

        if (nameMatch || pinMatch || blockMatch || distMatch) {
          seen.add(key);
          matches.push(r);
          if (matches.length >= limit) return;
        }
      }
    });

    return matches;
  }

  /**
   * Lookup 6-digit PIN code across local cache, backend proxy, and official webservice
   */
  public async lookupPincode(pincode: string): Promise<PincodeLookupResult> {
    const cleaned = pincode.replace(/\D/g, '').trim();

    if (cleaned.length !== 6) {
      throw new Error('PIN code must be exactly six numeric digits (e.g., 482002).');
    }

    // 1. Check in-memory indexed cache
    if (this.cache.has(cleaned)) {
      const cached = this.cache.get(cleaned)!;
      if (cached.length > 0) {
        return {
          pincode: cleaned,
          state: cached[0].state,
          district: cached[0].district,
          postOffices: cached,
          source: 'cache',
        };
      }
    }

    // 2. Try fetching from backend server proxy `/api/postal/pincode/:pincode`
    try {
      const response = await fetch(`/api/postal/pincode/${cleaned}`, {
        headers: { Accept: 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.postOffices && data.postOffices.length > 0) {
          this.indexRecords(data.postOffices);
          return {
            pincode: cleaned,
            state: data.state || data.postOffices[0].state,
            district: data.district || data.postOffices[0].district,
            postOffices: data.postOffices,
            source: 'backend_api',
          };
        }
      }
    } catch {
      // Backend not running or offline; proceed to direct webservice fallback
    }

    // 3. Fallback: Query India Post public web service
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(`https://api.postalpincode.in/pincode/${cleaned}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        if (Array.isArray(json) && json[0] && json[0].Status === 'Success' && Array.isArray(json[0].PostOffice)) {
          const rawList = json[0].PostOffice;
          const normalized: PostalRecord[] = rawList.map((item: any) => ({
            name: item.Name || 'Post Office',
            branchType: item.BranchType || 'Sub Post Office',
            deliveryStatus: item.DeliveryStatus === 'Delivery' ? 'Delivery' : 'Non-Delivery',
            circle: item.Circle || item.State,
            district: item.District || 'District',
            division: item.Division || '',
            region: item.Region || '',
            block: item.Block || '',
            state: item.State || 'India',
            country: item.Country || 'India',
            pincode: cleaned,
          }));

          if (normalized.length > 0) {
            this.indexRecords(normalized);
            return {
              pincode: cleaned,
              state: normalized[0].state,
              district: normalized[0].district,
              postOffices: normalized,
              source: 'webservice',
            };
          }
        }
      }
    } catch {
      // Web API timed out or network blocked; proceed to deduction fallback
    }

    // 4. Fallback deduction: Deduce State from PIN code prefix
    const deducedState = deduceStateFromPincode(cleaned);
    if (deducedState) {
      const districts = this.getDistricts(deducedState);
      const primaryDistrict = districts.length > 0 ? districts[0] : 'General';

      const fallbackRecord: PostalRecord = {
        name: `${cleaned} Delivery Area`,
        branchType: 'Sub Post Office',
        deliveryStatus: 'Delivery',
        circle: deducedState,
        district: primaryDistrict,
        state: deducedState,
        country: 'India',
        pincode: cleaned,
      };

      const recordList = [fallbackRecord];
      this.indexRecords(recordList);

      return {
        pincode: cleaned,
        state: deducedState,
        district: primaryDistrict,
        postOffices: recordList,
        source: 'baseline_directory',
      };
    }

    throw new Error(`PIN code ${cleaned} could not be resolved in the postal directory.`);
  }

  /**
   * Helper to deduce state from PIN code synchronously
   */
  public deduceState(pincode: string): string | null {
    return deduceStateFromPincode(pincode);
  }

  /**
   * Bulk import official postal dataset (CSV or JSON from data.gov.in)
   */
  public importPostalRecords(records: Partial<PostalRecord>[]): {
    imported: number;
    errors: string[];
  } {
    const valid: PostalRecord[] = [];
    const errors: string[] = [];

    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      if (!r.pincode || !r.name || !r.state || !r.district) {
        errors.push(`Row ${i + 1}: Missing mandatory fields (pincode, name, state, district).`);
        continue;
      }

      valid.push({
        name: r.name.trim(),
        branchType: r.branchType || 'Sub Post Office',
        deliveryStatus: r.deliveryStatus === 'Delivery' ? 'Delivery' : 'Non-Delivery',
        circle: r.circle || r.state,
        district: r.district.trim(),
        division: r.division,
        region: r.region,
        block: r.block,
        state: r.state.trim(),
        country: 'India',
        pincode: r.pincode.trim(),
        latitude: r.latitude,
        longitude: r.longitude,
      });
    }

    if (valid.length > 0) {
      this.customImportedRecords = [...this.customImportedRecords, ...valid];
      this.indexRecords(valid);
      try {
        localStorage.setItem(
          'billpilot_imported_postal_records',
          JSON.stringify(this.customImportedRecords)
        );
      } catch {
        // Storage limit warning
      }
    }

    return { imported: valid.length, errors };
  }

  /**
   * Check total indexed post offices and PIN codes
   */
  public getStats(): { totalPincodes: number; totalPostOffices: number; customImports: number } {
    let totalOffices = 0;
    this.cache.forEach((list) => {
      totalOffices += list.length;
    });

    return {
      totalPincodes: this.cache.size,
      totalPostOffices: totalOffices,
      customImports: this.customImportedRecords.length,
    };
  }
}

export const postalService = new IndianPostalService();
