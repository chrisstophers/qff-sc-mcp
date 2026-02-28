import airportsData from './data/airports.json' with { type: 'json' };
import type { Airport, AirportMap } from './types.js';

const airports = airportsData as AirportMap;

// ─── In-memory indexes ────────────────────────────────────────────────────────
// Built once at module load — O(1) lookups throughout the process lifetime.

/** Lowercase city name → array of Airport objects. */
const cityIndex = new Map<string, Airport[]>();

for (const airport of Object.values(airports)) {
  const key = airport.city.toLowerCase();
  const existing = cityIndex.get(key);
  if (existing) {
    existing.push(airport);
  } else {
    cityIndex.set(key, [airport]);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Look up an airport directly by IATA code (case-insensitive).
 * Returns null if the code isn't in the dataset.
 */
export function getAirport(iataCode: string): Airport | null {
  return airports[iataCode.toUpperCase()] ?? null;
}

/**
 * Find all airports matching a city name (case-insensitive).
 * e.g. "Los Angeles" → [LAX], "New York" → [] (JFK/LGA/EWR are not in cityIndex under "New York" — use aliases for that).
 */
export function getAirportsByCity(cityName: string): Airport[] {
  return cityIndex.get(cityName.toLowerCase()) ?? [];
}

/**
 * Resolve a string that could be either an IATA code or a city name.
 * - Tries IATA code first.
 * - Falls back to city name lookup.
 * - Returns null if no match is found.
 * - When multiple airports serve a city, returns the first one (alphabetical by IATA).
 *   For multi-airport cities, prefer explicit IATA codes or use resolveWithAliases().
 */
export function resolveAirport(input: string): Airport | null {
  const upper = input.toUpperCase().trim();

  // 1. Try direct IATA lookup (3-letter codes)
  if (/^[A-Z]{3}$/.test(upper)) {
    const airport = getAirport(upper);
    if (airport) return airport;
  }

  // 2. Fall back to city name lookup
  const byCity = getAirportsByCity(input.trim());
  if (byCity.length > 0) {
    // Sort by IATA to get a deterministic primary airport
    return byCity.sort((a, b) => a.iata.localeCompare(b.iata))[0];
  }

  return null;
}

/**
 * Resolve an airport input using the regions.json aliases for multi-airport cities.
 * This is the full resolver used by the calculator — it checks IATA first,
 * then city name, then region aliases.
 *
 * @param input - IATA code or city name
 * @param aliases - The aliases map from regions.json (passed in to avoid circular deps)
 * @param preferPrimary - When a city resolves to multiple airports, return the first only
 * @returns Array of resolved Airport objects (usually 1, but could be multiple for cities with multiple airports)
 */
export function resolveWithAliases(
  input: string,
  aliases: Record<string, string[]>,
  preferPrimary: boolean = true,
): Airport[] {
  const trimmed = input.trim();
  const upper = trimmed.toUpperCase();

  // 1. Direct IATA lookup
  if (/^[A-Z]{3}$/.test(upper)) {
    const airport = getAirport(upper);
    if (airport) return [airport];
  }

  // 2. Check region aliases (case-insensitive key match)
  for (const [cityName, iataCodes] of Object.entries(aliases)) {
    if (cityName.toLowerCase() === trimmed.toLowerCase()) {
      const resolved = iataCodes
        .map(code => getAirport(code))
        .filter((a): a is Airport => a !== null);
      if (resolved.length > 0) {
        return preferPrimary ? [resolved[0]] : resolved;
      }
    }
  }

  // 3. Fall back to city name index
  const byCity = getAirportsByCity(trimmed);
  if (byCity.length > 0) {
    const sorted = byCity.sort((a, b) => a.iata.localeCompare(b.iata));
    return preferPrimary ? [sorted[0]] : sorted;
  }

  return [];
}

/**
 * Suggest the closest airport IATA code for a possibly-misspelled input.
 * Uses a simple 2-of-3 character overlap check — good enough for typo correction.
 * Returns null if no reasonable suggestion is found.
 */
export function suggestAirport(input: string): string | null {
  const upper = input.toUpperCase().trim();
  const allCodes = Object.keys(airports);

  // Exact match — no suggestion needed
  if (airports[upper]) return null;

  // Find codes that share at least 2 characters with the input
  const suggestions = allCodes.filter(code => {
    const matches = [...upper].filter((ch, i) => code[i] === ch).length;
    return matches >= 2;
  });

  return suggestions.length === 1 ? suggestions[0] : null;
}

/**
 * Get all airports as a flat array.
 */
export function getAllAirports(): Airport[] {
  return Object.values(airports);
}
