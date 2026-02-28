/**
 * Shared TypeScript types for the QFF Status Credit calculator.
 * These types flow through every module — define them first, use them everywhere.
 */

// ─── Cabin classes ───────────────────────────────────────────────────────────

/** The earn category a flight leg is credited at in QFF. */
export type CabinClass =
  | 'discount_economy'
  | 'economy'
  | 'flexible_economy'
  | 'premium_economy'
  | 'business'
  | 'first';

/** Ordered list of valid cabin class strings — useful for validation. */
export const CABIN_CLASSES: CabinClass[] = [
  'discount_economy',
  'economy',
  'flexible_economy',
  'premium_economy',
  'business',
  'first',
];

// ─── Airport data ─────────────────────────────────────────────────────────────

/** A single airport entry from airports.json. */
export interface Airport {
  iata: string;
  icao: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
}

/** The shape of airports.json — a map keyed by IATA code. */
export type AirportMap = Record<string, Airport>;

// ─── Region data ──────────────────────────────────────────────────────────────

/** A single earning region from regions.json. */
export interface RegionDefinition {
  label: string;
  airports: string[];
}

/** The shape of regions.json. */
export interface RegionsData {
  last_updated: string;
  regions: Record<string, RegionDefinition>;
  /** City name → array of IATA codes (e.g. "New York" → ["JFK", "LGA", "EWR"]). */
  aliases: Record<string, string[]>;
}

// ─── Earning table data ───────────────────────────────────────────────────────

/** Status Credits (and optionally Qantas Points) per cabin class. */
export interface StatusCreditsMap {
  discount_economy: number;
  economy: number;
  flexible_economy: number;
  premium_economy: number;
  business: number;
  first: number;
}

/** Optional Qantas Points map — mirrors StatusCreditsMap shape. */
export type QantasPointsMap = StatusCreditsMap;

/** A route-pair based earning table entry (e.g. East Coast ↔ West Coast). */
export interface RouteTable {
  id: string;
  origin_region: string;
  destination_region: string;
  bidirectional: boolean;
  status_credits: StatusCreditsMap;
  qantas_points?: QantasPointsMap;
  verified?: boolean;
  todo?: string;
  /**
   * Optional: specifies which airports at each end of this route actually have
   * direct service. Keyed by region name (matching origin_region / destination_region).
   *
   * - If this field is absent: the optimiser treats any airport-to-airport leg
   *   between the two regions as a valid direct segment (safe default for domestic
   *   and short-haul routes where any hub-to-hub pairing is realistic).
   *
   * - If this field is present: the optimiser ONLY generates direct legs between
   *   airports that appear in their respective gateway list.
   *   An empty list for a region means NO direct service exists for that side
   *   (e.g. AA has no direct flights from Australia to East Coast US cities).
   *
   * This field does NOT affect the calculator — it still applies the earning rate
   * to any manually-supplied leg. It only gates what the optimiser invents.
   */
  gateway_airports?: Record<string, string[]>;
}

/** A distance-band based earning table entry (e.g. 0–400 mi intra-USA). */
export interface DistanceTable {
  id: string;
  applies_to: string;
  min_miles: number;
  max_miles: number;
  status_credits: StatusCreditsMap;
  qantas_points?: QantasPointsMap;
  verified?: boolean;
  todo?: string;
}

/** Full earning table for one airline, loaded from a JSON file. */
export interface EarningTable {
  airline: string;
  name: string;
  data_version: string;
  last_verified: string;
  source_url: string;
  notes: string[];
  hub_airports: string[];
  /** Booking class letter → cabin class (for future use). */
  earn_category_mapping: Record<string, CabinClass>;
  route_tables: RouteTable[];
  distance_tables: DistanceTable[];
}

// ─── Calculation results ──────────────────────────────────────────────────────

/** Result for a single flight leg within a routing. */
export interface LegResult {
  origin: string;
  destination: string;
  distance_miles: number;
  origin_region: string | null;
  destination_region: string | null;
  cabin_class: CabinClass;
  status_credits: number;
  /** Which table was used: a route table id, distance band id, or "no_match". */
  matched_table: string;
}

/** Full result for a routing calculation. */
export interface CalculationResult {
  routing: string[];
  airline: string;
  cabin_class: CabinClass;
  legs: LegResult[];
  total_status_credits: number;
  total_distance_miles: number;
  /** Soft warnings (e.g. unverified data, unknown regions). */
  warnings: string[];
}

/** A single routing option from the optimiser. */
export interface OptimiserOption {
  routing: string[];
  total_status_credits: number;
  total_distance_miles: number;
  legs: LegResult[];
  notes: string[];
}

/** Full result from the route optimiser. */
export interface OptimiserResult {
  origin: string;
  destination: string;
  airline: string;
  cabin_class: CabinClass;
  options: OptimiserOption[];
}

/** Side-by-side comparison of two routings. */
export interface ComparisonResult {
  routing_a: CalculationResult;
  routing_b: CalculationResult;
  /** routing_a.total − routing_b.total (positive means A earns more). */
  difference: number;
  recommendation: string;
}

// ─── Errors ───────────────────────────────────────────────────────────────────

/** Structured error thrown by the calculator on hard failures. */
export class CalculationError extends Error {
  constructor(
    public readonly code:
      | 'UNKNOWN_AIRPORT'
      | 'UNKNOWN_AIRLINE'
      | 'INVALID_CABIN_CLASS'
      | 'ROUTING_TOO_SHORT',
    message: string,
  ) {
    super(message);
    this.name = 'CalculationError';
  }
}
