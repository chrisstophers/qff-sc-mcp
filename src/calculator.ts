import { getAirport, resolveWithAliases } from './airports.js';
import { airportDistance } from './distance.js';
import { resolveRegion, getAliases } from './regions.js';
import { getEarningTable, findRouteTable, findDistanceTable, getSupportedAirlines } from './earning-tables.js';
import {
  CABIN_CLASSES,
  CalculationError,
  type CabinClass,
  type Airport,
  type LegResult,
  type CalculationResult,
  type ComparisonResult,
} from './types.js';

// ─── Input validation ──────────────────────────────────────────────────────────

function validateCabinClass(cabinClass: string): CabinClass {
  if (!CABIN_CLASSES.includes(cabinClass as CabinClass)) {
    throw new CalculationError(
      'INVALID_CABIN_CLASS',
      `Invalid cabin class: "${cabinClass}". Must be one of: ${CABIN_CLASSES.join(', ')}`,
    );
  }
  return cabinClass as CabinClass;
}

function validateAirline(airlineCode: string): void {
  const table = getEarningTable(airlineCode);
  if (!table) {
    throw new CalculationError(
      'UNKNOWN_AIRLINE',
      `No earning table found for airline "${airlineCode}". Supported airlines: ${getSupportedAirlines().join(', ')}`,
    );
  }
}

function resolveAirportInput(input: string): Airport {
  const aliases = getAliases();

  // Try resolving with aliases first (handles multi-airport cities)
  const resolved = resolveWithAliases(input, aliases, true);
  if (resolved.length > 0) return resolved[0];

  // Suggest a correction if possible
  const upper = input.toUpperCase().trim();
  const suggestion = getAirport(upper) ? null : `Did you mean a different code?`;

  throw new CalculationError(
    'UNKNOWN_AIRPORT',
    `Unknown airport: "${input}".${suggestion ? ` ${suggestion}` : ''}`,
  );
}

// ─── Core calculation ─────────────────────────────────────────────────────────

/**
 * Calculate Qantas Frequent Flyer Status Credits for a flight routing.
 *
 * @param routing - Array of airport codes or city names (minimum 2)
 * @param cabinClass - One of the CabinClass values
 * @param airlineCode - IATA airline code (e.g. "AA")
 * @returns Full calculation result with per-leg breakdown and totals
 * @throws CalculationError for hard failures (unknown airport/airline, invalid class, too few stops)
 */
export function calculateStatusCredits(
  routing: string[],
  cabinClass: string,
  airlineCode: string,
): CalculationResult {
  // ── Validate inputs ──────────────────────────────────────────────────────
  if (routing.length < 2) {
    throw new CalculationError(
      'ROUTING_TOO_SHORT',
      'Routing must contain at least 2 airports (origin and destination)',
    );
  }

  const validatedCabinClass = validateCabinClass(cabinClass);
  const upperAirline = airlineCode.toUpperCase();
  validateAirline(upperAirline);

  const earningTable = getEarningTable(upperAirline)!;
  const warnings: string[] = [];

  // ── Resolve all airports ─────────────────────────────────────────────────
  const resolvedAirports = routing.map(input => resolveAirportInput(input));
  const resolvedCodes = resolvedAirports.map(a => a.iata);

  // ── Calculate per-leg results ────────────────────────────────────────────
  const legs: LegResult[] = [];

  for (let i = 0; i < resolvedAirports.length - 1; i++) {
    const origin = resolvedAirports[i];
    const destination = resolvedAirports[i + 1];

    const distanceMiles = airportDistance(origin, destination);
    const originRegion = resolveRegion(origin.iata);
    const destinationRegion = resolveRegion(destination.iata);

    let statusCredits = 0;
    let matchedTable = 'no_match';

    // ── Route classification waterfall ───────────────────────────────────
    // 1. Try route table if both airports are in known regions
    if (originRegion && destinationRegion) {
      const routeEntry = findRouteTable(earningTable, originRegion, destinationRegion);
      if (routeEntry) {
        statusCredits = routeEntry.status_credits[validatedCabinClass];
        matchedTable = routeEntry.id;
      }
    }

    // 2. Fall back to distance band (covers both the "no region" case and
    //    same-region legs that aren't explicitly listed)
    if (matchedTable === 'no_match') {
      const distanceBand = findDistanceTable(earningTable, distanceMiles);
      if (distanceBand) {
        statusCredits = distanceBand.status_credits[validatedCabinClass];
        matchedTable = distanceBand.id;

        // Warn if the distance band data is unverified
        if (distanceBand.verified === false) {
          warnings.push(
            `Distance band "${distanceBand.id}" (${distanceBand.min_miles}–${distanceBand.max_miles} mi) has not been verified against the Qantas calculator. ${distanceBand.todo ?? ''}`.trim(),
          );
        }
      }
    }

    // 3. Add a warning if an airport is not in any Qantas earning region
    if (!originRegion) {
      warnings.push(
        `Airport ${origin.iata} is not mapped to a Qantas earning region — used distance-based table for ${origin.iata}→${destination.iata}.`,
      );
    }
    if (!destinationRegion) {
      warnings.push(
        `Airport ${destination.iata} is not mapped to a Qantas earning region — used distance-based table for ${origin.iata}→${destination.iata}.`,
      );
    }

    legs.push({
      origin: origin.iata,
      destination: destination.iata,
      distance_miles: distanceMiles,
      origin_region: originRegion,
      destination_region: destinationRegion,
      cabin_class: validatedCabinClass,
      status_credits: statusCredits,
      matched_table: matchedTable,
    });
  }

  const totalStatusCredits = legs.reduce((sum, leg) => sum + leg.status_credits, 0);
  const totalDistanceMiles = legs.reduce((sum, leg) => sum + leg.distance_miles, 0);

  // Deduplicate warnings
  const uniqueWarnings = [...new Set(warnings)];

  return {
    routing: resolvedCodes,
    airline: upperAirline,
    cabin_class: validatedCabinClass,
    legs,
    total_status_credits: totalStatusCredits,
    total_distance_miles: totalDistanceMiles,
    warnings: uniqueWarnings,
  };
}

/**
 * Compare Status Credits earned on two different routings side by side.
 *
 * @param routingA - First routing (array of airport codes or city names)
 * @param routingB - Second routing
 * @param cabinClass - Cabin class applied to both routings
 * @param airlineCode - Airline applied to both routings
 */
export function compareRoutings(
  routingA: string[],
  routingB: string[],
  cabinClass: string,
  airlineCode: string,
): ComparisonResult {
  const resultA = calculateStatusCredits(routingA, cabinClass, airlineCode);
  const resultB = calculateStatusCredits(routingB, cabinClass, airlineCode);

  const difference = resultA.total_status_credits - resultB.total_status_credits;

  let recommendation: string;
  if (difference > 0) {
    recommendation = `Routing A earns ${difference} more Status Credit${difference === 1 ? '' : 's'} (${resultA.total_status_credits} vs ${resultB.total_status_credits}).`;
  } else if (difference < 0) {
    recommendation = `Routing B earns ${Math.abs(difference)} more Status Credit${Math.abs(difference) === 1 ? '' : 's'} (${resultB.total_status_credits} vs ${resultA.total_status_credits}).`;
  } else {
    recommendation = `Both routings earn the same number of Status Credits (${resultA.total_status_credits}).`;
  }

  return {
    routing_a: resultA,
    routing_b: resultB,
    difference,
    recommendation,
  };
}
