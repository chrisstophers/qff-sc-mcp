import aaTable from './data/earning-tables/american-airlines.json' with { type: 'json' };
import type { EarningTable, RouteTable, DistanceTable } from './types.js';

// ─── Registry ─────────────────────────────────────────────────────────────────
// Add new airlines here as they're implemented (Phase 4+).

const registry: Record<string, EarningTable> = {
  AA: aaTable as EarningTable,
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Get the earning table for an airline by IATA code (case-insensitive).
 * Returns null if the airline isn't supported yet.
 */
export function getEarningTable(airlineCode: string): EarningTable | null {
  return registry[airlineCode.toUpperCase()] ?? null;
}

/**
 * List all supported airline codes.
 */
export function getSupportedAirlines(): string[] {
  return Object.keys(registry);
}

/**
 * Find a specific route table entry for a given origin/destination region pair.
 *
 * Handles bidirectional routes — if a table has `bidirectional: true`, it matches
 * both origin→destination AND destination→origin.
 *
 * Returns null if no route table matches (caller should fall back to distance tables).
 */
export function findRouteTable(
  table: EarningTable,
  originRegion: string,
  destinationRegion: string,
): RouteTable | null {
  for (const entry of table.route_tables) {
    const forwardMatch =
      entry.origin_region === originRegion && entry.destination_region === destinationRegion;

    const reverseMatch =
      entry.bidirectional &&
      entry.origin_region === destinationRegion &&
      entry.destination_region === originRegion;

    if (forwardMatch || reverseMatch) {
      return entry;
    }
  }
  return null;
}

/**
 * Find the distance band table that covers a given distance in statute miles.
 * Returns null if no band matches (shouldn't happen if bands cover 0–99999).
 */
export function findDistanceTable(
  table: EarningTable,
  distanceMiles: number,
): DistanceTable | null {
  for (const band of table.distance_tables) {
    if (distanceMiles >= band.min_miles && distanceMiles <= band.max_miles) {
      return band;
    }
  }
  return null;
}
