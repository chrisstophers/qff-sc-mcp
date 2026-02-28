import { calculateStatusCredits } from './calculator.js';
import { getEarningTable, isValidDirectLeg } from './earning-tables.js';
import { resolveWithAliases } from './airports.js';
import { getAliases, resolveRegion } from './regions.js';
import { CalculationError, type CabinClass, type OptimiserResult, type OptimiserOption } from './types.js';

/**
 * Find the routing between two cities that earns the most Qantas Status Credits,
 * using common oneworld hub connections.
 *
 * @param origin - Origin airport code or city name
 * @param destination - Destination airport code or city name
 * @param cabinClass - Cabin class for all legs
 * @param airlineCode - Airline (determines which hub airports are considered)
 * @param maxStops - Maximum number of intermediate stops (1 or 2, default 2, max 3)
 * @param topN - Maximum number of options to return (default 5)
 */
export function optimiseRouting(
  origin: string,
  destination: string,
  cabinClass: string,
  airlineCode: string,
  maxStops: number = 2,
  topN: number = 5,
): OptimiserResult {
  const aliases = getAliases();
  const upperAirline = airlineCode.toUpperCase();

  // Resolve origin and destination to IATA codes
  const originAirports = resolveWithAliases(origin, aliases, false);
  if (originAirports.length === 0) {
    throw new CalculationError('UNKNOWN_AIRPORT', `Unknown origin: "${origin}"`);
  }

  const destAirports = resolveWithAliases(destination, aliases, false);
  if (destAirports.length === 0) {
    throw new CalculationError('UNKNOWN_AIRPORT', `Unknown destination: "${destination}"`);
  }

  const earningTable = getEarningTable(upperAirline);
  if (!earningTable) {
    throw new CalculationError(
      'UNKNOWN_AIRLINE',
      `No earning table found for airline "${upperAirline}"`,
    );
  }

  const hubs = earningTable.hub_airports;
  const clampedMaxStops = Math.min(Math.max(maxStops, 0), 3);

  // Build all candidate routings
  const candidates: string[][] = [];

  for (const originAirport of originAirports) {
    for (const destAirport of destAirports) {
      const orig = originAirport.iata;
      const dest = destAirport.iata;

      // Skip if origin equals destination
      if (orig === dest) continue;

      // Region of the origin — used below to prevent backtracking (hubs in the
      // same region as the origin would just bring the routing home again).
      const origRegion = resolveRegion(orig);

      // Returns true if a hub is an acceptable intermediate stop.
      // A hub must not be in the same Qantas region as the origin — that would
      // create a backtracking itinerary (e.g. SYD→LAX→BNE→LHR is absurd).
      // If the origin or hub has no region, we can't determine this, so we allow it.
      const isNonBacktrackingHub = (hub: string): boolean => {
        if (!origRegion) return true;
        const hubRegion = resolveRegion(hub);
        return !hubRegion || hubRegion !== origRegion;
      };

      // Direct (0 stops) — only if the airline actually flies this city pair
      if (isValidDirectLeg(orig, dest, earningTable)) {
        candidates.push([orig, dest]);
      }

      if (clampedMaxStops >= 1) {
        // 1 stop via each hub — all three legs must be valid direct segments
        for (const hub1 of hubs) {
          if (hub1 !== orig && hub1 !== dest && isNonBacktrackingHub(hub1)) {
            if (
              isValidDirectLeg(orig, hub1, earningTable) &&
              isValidDirectLeg(hub1, dest, earningTable)
            ) {
              candidates.push([orig, hub1, dest]);
            }
          }
        }
      }

      if (clampedMaxStops >= 2) {
        // 2 stops via all hub pairs
        for (const hub1 of hubs) {
          for (const hub2 of hubs) {
            if (
              hub1 !== hub2 &&
              hub1 !== orig &&
              hub1 !== dest &&
              hub2 !== orig &&
              hub2 !== dest &&
              isNonBacktrackingHub(hub1) &&
              isNonBacktrackingHub(hub2)
            ) {
              if (
                isValidDirectLeg(orig, hub1, earningTable) &&
                isValidDirectLeg(hub1, hub2, earningTable) &&
                isValidDirectLeg(hub2, dest, earningTable)
              ) {
                candidates.push([orig, hub1, hub2, dest]);
              }
            }
          }
        }
      }

      if (clampedMaxStops >= 3) {
        // 3 stops via all hub triples
        for (const hub1 of hubs) {
          for (const hub2 of hubs) {
            for (const hub3 of hubs) {
              if (
                hub1 !== hub2 &&
                hub1 !== hub3 &&
                hub2 !== hub3 &&
                hub1 !== orig && hub1 !== dest &&
                hub2 !== orig && hub2 !== dest &&
                hub3 !== orig && hub3 !== dest &&
                isNonBacktrackingHub(hub1) &&
                isNonBacktrackingHub(hub2) &&
                isNonBacktrackingHub(hub3)
              ) {
                if (
                  isValidDirectLeg(orig, hub1, earningTable) &&
                  isValidDirectLeg(hub1, hub2, earningTable) &&
                  isValidDirectLeg(hub2, hub3, earningTable) &&
                  isValidDirectLeg(hub3, dest, earningTable)
                ) {
                  candidates.push([orig, hub1, hub2, hub3, dest]);
                }
              }
            }
          }
        }
      }
    }
  }

  // Deduplicate candidates
  const seen = new Set<string>();
  const uniqueCandidates = candidates.filter(routing => {
    const key = routing.join('-');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Calculate SCs for each candidate, silently skipping failures
  const options: OptimiserOption[] = [];

  for (const routing of uniqueCandidates) {
    try {
      const result = calculateStatusCredits(routing, cabinClass, upperAirline);

      const notes: string[] = [];

      // Note connecting hubs (intermediate airports only)
      const stops = routing.slice(1, -1);
      if (stops.length > 0) {
        const hubStops = stops.filter(s => hubs.includes(s));
        if (hubStops.length > 0) {
          notes.push(`Connects via ${hubStops.join(' → ')} hub${hubStops.length > 1 ? 's' : ''}`);
        }
      }

      // Note any unverified data warnings
      if (result.warnings.some(w => w.toLowerCase().includes('verified'))) {
        notes.push('Some status credit values are unverified — check against Qantas calculator');
      }

      options.push({
        routing: result.routing,
        total_status_credits: result.total_status_credits,
        total_distance_miles: result.total_distance_miles,
        legs: result.legs,
        notes,
      });
    } catch {
      // Skip candidates that can't be calculated (e.g. unknown airports)
    }
  }

  // Sort: most SCs first, then fewest miles (prefer shorter routing for equal SCs)
  options.sort((a, b) => {
    if (b.total_status_credits !== a.total_status_credits) {
      return b.total_status_credits - a.total_status_credits;
    }
    return a.total_distance_miles - b.total_distance_miles;
  });

  // Primary origin and destination codes for the result
  const resolvedOrigin = originAirports[0].iata;
  const resolvedDest = destAirports[0].iata;

  return {
    origin: resolvedOrigin,
    destination: resolvedDest,
    airline: upperAirline,
    cabin_class: cabinClass as CabinClass,
    options: options.slice(0, topN),
  };
}
