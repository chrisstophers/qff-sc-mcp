import regionsData from './data/regions.json' with { type: 'json' };
import type { RegionsData, RegionDefinition } from './types.js';

const data = regionsData as RegionsData;

// Build a reverse index: IATA code → region key.
// Constructed once at module load — O(1) lookups thereafter.
const airportToRegion = new Map<string, string>();
for (const [regionKey, region] of Object.entries(data.regions)) {
  for (const iata of region.airports) {
    airportToRegion.set(iata.toUpperCase(), regionKey);
  }
}

/**
 * Resolve an airport IATA code to its Qantas earning region key.
 * Returns null if the airport isn't in any defined region
 * (it will then fall through to distance-based tables in the calculator).
 */
export function resolveRegion(airportCode: string): string | null {
  return airportToRegion.get(airportCode.toUpperCase()) ?? null;
}

/**
 * Get the human-readable label for a region key (e.g. "east_coast_usa_canada" → "East Coast USA/Canada").
 */
export function getRegionLabel(regionKey: string): string | null {
  return data.regions[regionKey]?.label ?? null;
}

/**
 * Get all IATA codes in a given region.
 */
export function getAirportsInRegion(regionKey: string): string[] {
  return data.regions[regionKey]?.airports ?? [];
}

/**
 * Get the full region definition object.
 */
export function getRegion(regionKey: string): RegionDefinition | null {
  return data.regions[regionKey] ?? null;
}

/**
 * Get the city-name aliases map (e.g. "New York" → ["JFK", "LGA", "EWR"]).
 */
export function getAliases(): Record<string, string[]> {
  return data.aliases;
}

/**
 * Get all region keys in the data file.
 */
export function getAllRegionKeys(): string[] {
  return Object.keys(data.regions);
}

/**
 * Get all airports that have region mappings (useful for validation).
 */
export function getAllMappedAirports(): string[] {
  return Array.from(airportToRegion.keys());
}
