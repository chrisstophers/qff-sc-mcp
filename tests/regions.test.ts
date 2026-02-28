import { describe, it, expect } from 'vitest';
import {
  resolveRegion,
  getRegionLabel,
  getAirportsInRegion,
  getAliases,
  getAllRegionKeys,
} from '../src/regions.js';

describe('resolveRegion', () => {
  it('DFW resolves to dallas', () => {
    expect(resolveRegion('DFW')).toBe('dallas');
  });

  it('LAX resolves to west_coast_usa_canada', () => {
    expect(resolveRegion('LAX')).toBe('west_coast_usa_canada');
  });

  it('SFO resolves to west_coast_usa_canada', () => {
    expect(resolveRegion('SFO')).toBe('west_coast_usa_canada');
  });

  it('JFK resolves to east_coast_usa_canada', () => {
    expect(resolveRegion('JFK')).toBe('east_coast_usa_canada');
  });

  it('LGA resolves to east_coast_usa_canada', () => {
    expect(resolveRegion('LGA')).toBe('east_coast_usa_canada');
  });

  it('YYZ resolves to east_coast_usa_canada', () => {
    expect(resolveRegion('YYZ')).toBe('east_coast_usa_canada');
  });

  it('SYD resolves to australia_east_coast', () => {
    expect(resolveRegion('SYD')).toBe('australia_east_coast');
  });

  it('MEL resolves to australia_east_coast', () => {
    expect(resolveRegion('MEL')).toBe('australia_east_coast');
  });

  it('LHR resolves to western_europe', () => {
    expect(resolveRegion('LHR')).toBe('western_europe');
  });

  it('DOH resolves to middle_east', () => {
    expect(resolveRegion('DOH')).toBe('middle_east');
  });

  it('is case-insensitive', () => {
    expect(resolveRegion('lax')).toBe('west_coast_usa_canada');
    expect(resolveRegion('Dfw')).toBe('dallas');
  });

  // ORD is intentionally not in any region — it falls to distance-based tables.
  // This is correct Qantas behaviour.
  it('ORD returns null (not in any Qantas earning region)', () => {
    expect(resolveRegion('ORD')).toBeNull();
  });

  it('unknown airport returns null', () => {
    expect(resolveRegion('XYZ')).toBeNull();
  });
});

describe('getRegionLabel', () => {
  it('returns human-readable label for dallas', () => {
    expect(getRegionLabel('dallas')).toBe('Dallas');
  });

  it('returns label for east_coast_usa_canada', () => {
    expect(getRegionLabel('east_coast_usa_canada')).toBe('East Coast USA/Canada');
  });

  it('returns null for unknown region key', () => {
    expect(getRegionLabel('made_up_region')).toBeNull();
  });
});

describe('getAirportsInRegion', () => {
  it('returns airports for east_coast_usa_canada including all major airports', () => {
    const airports = getAirportsInRegion('east_coast_usa_canada');
    expect(airports).toContain('JFK');
    expect(airports).toContain('LGA');
    expect(airports).toContain('EWR');
    expect(airports).toContain('YYZ');
    expect(airports).toContain('ATL');
  });

  it('dallas region only contains DFW', () => {
    expect(getAirportsInRegion('dallas')).toEqual(['DFW']);
  });

  it('returns empty array for unknown region', () => {
    expect(getAirportsInRegion('fake_region')).toEqual([]);
  });
});

describe('getAliases', () => {
  it('New York maps to JFK, LGA, EWR', () => {
    const aliases = getAliases();
    expect(aliases['New York']).toEqual(['JFK', 'LGA', 'EWR']);
  });

  it('Dallas maps to DFW', () => {
    const aliases = getAliases();
    expect(aliases['Dallas']).toEqual(['DFW']);
  });

  it('London maps to multiple airports', () => {
    const aliases = getAliases();
    expect(aliases['London']).toContain('LHR');
    expect(aliases['London']).toContain('LGW');
  });
});

describe('getAllRegionKeys', () => {
  it('contains 21 regions', () => {
    expect(getAllRegionKeys()).toHaveLength(21);
  });

  it('contains the expected core regions', () => {
    const keys = getAllRegionKeys();
    expect(keys).toContain('dallas');
    expect(keys).toContain('east_coast_usa_canada');
    expect(keys).toContain('west_coast_usa_canada');
    expect(keys).toContain('australia_east_coast');
    expect(keys).toContain('western_europe');
    expect(keys).toContain('middle_east');
  });
});

describe('data integrity', () => {
  it('no airport appears in more than one region', () => {
    const seen = new Map<string, string>();
    const keys = getAllRegionKeys();
    for (const regionKey of keys) {
      for (const iata of getAirportsInRegion(regionKey)) {
        if (seen.has(iata)) {
          throw new Error(`Airport ${iata} appears in both ${seen.get(iata)} and ${regionKey}`);
        }
        seen.set(iata, regionKey);
      }
    }
  });
});
