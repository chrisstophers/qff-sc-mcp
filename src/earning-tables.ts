import aaTable from './data/earning-tables/american-airlines.json' with { type: 'json' };
import type { EarningTable, RouteTable, DistanceTable } from './types.js';
import { resolveRegion } from './regions.js';

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
 * Check whether a direct (non-stop) leg between two airports is valid for the
 * optimiser to suggest, based on the route table's gateway_airports constraints.
 *
 * Rules:
 * - If neither airport is in a region, OR no route table exists for that pair,
 *   there are no constraints → returns true (will fall to distance band).
 * - If the route table has no gateway_airports field → returns true (unconstrained).
 * - If a region's gateway list is empty → no direct service on that side → returns false.
 * - Otherwise, both airports must appear in their respective gateway lists.
 *
 * This only affects the optimiser's candidate generation, NOT the calculator.
 */
export function isValidDirectLeg(
  originIata: string,
  destIata: string,
  table: EarningTable,
): boolean {
  const originRegion = resolveRegion(originIata);
  const destRegion = resolveRegion(destIata);

  // Both airports lack a region → no route table possible → unconstrained
  if (!originRegion && !destRegion) return true;

  // One airport has a region, the other doesn't.
  // Check whether the regioned airport is "fully gateway-constrained" — i.e. every
  // route table for its region requires specific gateways.  If so, it cannot fly
  // directly to an unregioned airport (no valid route table could ever match, and the
  // distance-band fallback doesn't represent a real AA transoceanic route).
  // If at least one route table for the region is unconstrained, the airport can
  // reach unregioned destinations via the distance-band tables (e.g. LAX→ORD).
  if (!originRegion || !destRegion) {
    const regionedSide = originRegion ?? destRegion!;
    const entries = table.route_tables.filter(
      entry =>
        entry.origin_region === regionedSide ||
        (entry.bidirectional && entry.destination_region === regionedSide),
    );
    // No route tables at all → fully distance-band driven → unconstrained
    if (entries.length === 0) return true;
    // Any unconstrained table means the airport can fly to unregioned destinations
    if (entries.some(entry => !entry.gateway_airports)) return true;
    // All tables have gateway constraints → can't reach an unregioned airport directly
    return false;
  }

  const routeTable = findRouteTable(table, originRegion, destRegion);

  // No specific route table → will use distance band → unconstrained
  if (!routeTable || !routeTable.gateway_airports) return true;

  const gateways = routeTable.gateway_airports;
  const originGateways = gateways[originRegion];
  const destGateways = gateways[destRegion];

  // An empty gateway list means no direct service exists on that side
  if (originGateways !== undefined && originGateways.length === 0) return false;
  if (destGateways !== undefined && destGateways.length === 0) return false;

  // If a gateway list is defined and non-empty, the airport must be in it
  if (originGateways !== undefined && !originGateways.includes(originIata)) return false;
  if (destGateways !== undefined && !destGateways.includes(destIata)) return false;

  return true;
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
