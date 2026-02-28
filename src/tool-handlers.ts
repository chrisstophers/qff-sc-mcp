/**
 * Shared MCP tool handlers — used by both the stdio server (Phase 2) and the
 * HTTP server on Vercel (Phase 3). All tool logic lives here; the transports
 * just call these functions and relay the results.
 */

import { z } from 'zod';
import { calculateStatusCredits, compareRoutings } from './calculator.js';
import { optimiseRouting } from './optimiser.js';
import { resolveRegion, getRegionLabel, getAirportsInRegion, getAliases } from './regions.js';
import { resolveWithAliases, suggestAirport } from './airports.js';
import { CalculationError, CABIN_CLASSES } from './types.js';

// ─── MCP tool result type ─────────────────────────────────────────────────────

export interface ToolContent {
  type: 'text';
  text: string;
}

export interface ToolResult {
  content: ToolContent[];
  isError?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ok(data: unknown): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

function err(message: string): ToolResult {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}

function handleKnownError(e: unknown): ToolResult {
  if (e instanceof CalculationError) return err(e.message);
  if (e instanceof z.ZodError) {
    const issues = e.issues
      .map(i => `${i.path.map(String).join('.')}: ${i.message}`)
      .join('; ');
    return err(`Invalid arguments: ${issues}`);
  }
  if (e instanceof Error) return err(`Unexpected error: ${e.message}`);
  return err('An unexpected error occurred');
}

// ─── Input schemas ────────────────────────────────────────────────────────────

const calculateSchema = z.object({
  routing: z.array(z.string().min(1)).min(2, 'routing must contain at least 2 airports'),
  cabin_class: z.enum(CABIN_CLASSES as [string, ...string[]]),
  airline: z.string().min(1),
});

const lookupRegionSchema = z.object({
  airport: z.string().min(1),
});

const optimiseSchema = z.object({
  origin: z.string().min(1),
  destination: z.string().min(1),
  cabin_class: z.enum(CABIN_CLASSES as [string, ...string[]]),
  airline: z.string().min(1),
  max_stops: z.number().int().min(0).max(3).default(2),
});

const compareSchema = z.object({
  routing_a: z.array(z.string().min(1)).min(2),
  routing_b: z.array(z.string().min(1)).min(2),
  cabin_class: z.enum(CABIN_CLASSES as [string, ...string[]]),
  airline: z.string().min(1),
});

// ─── Tool handlers ────────────────────────────────────────────────────────────

/**
 * Tool 1: calculate_status_credits
 * Calculates QFF Status Credits for a multi-leg routing.
 */
export function handleCalculateStatusCredits(args: unknown): ToolResult {
  try {
    const { routing, cabin_class, airline } = calculateSchema.parse(args);
    const result = calculateStatusCredits(routing, cabin_class, airline);
    return ok(result);
  } catch (e) {
    return handleKnownError(e);
  }
}

/**
 * Tool 2: lookup_region
 * Looks up which Qantas earning region an airport belongs to,
 * and lists other airports in the same region.
 */
export function handleLookupRegion(args: unknown): ToolResult {
  try {
    const { airport } = lookupRegionSchema.parse(args);
    const upper = airport.toUpperCase().trim();

    // Try resolving via aliases first (city names like "New York")
    const aliases = getAliases();
    const resolved = resolveWithAliases(airport, aliases, true);
    const iata = resolved.length > 0 ? resolved[0].iata : upper;

    const regionKey = resolveRegion(iata);

    if (!regionKey) {
      // Try a typo suggestion
      const suggestion = suggestAirport(iata);
      const suffix = suggestion ? ` Did you mean ${suggestion}?` : '';
      return ok({
        airport: iata,
        region: null,
        message: `${iata} is not mapped to any Qantas earning region. It will use distance-based Status Credit tables.${suffix}`,
      });
    }

    return ok({
      airport: iata,
      region_key: regionKey,
      region_label: getRegionLabel(regionKey),
      other_airports_in_region: getAirportsInRegion(regionKey).filter(a => a !== iata),
    });
  } catch (e) {
    return handleKnownError(e);
  }
}

/**
 * Tool 3: optimise_routing
 * Finds routings that maximise Status Credits between two cities.
 */
export function handleOptimiseRouting(args: unknown): ToolResult {
  try {
    const { origin, destination, cabin_class, airline, max_stops } = optimiseSchema.parse(args);
    const result = optimiseRouting(origin, destination, cabin_class, airline, max_stops);
    return ok(result);
  } catch (e) {
    return handleKnownError(e);
  }
}

/**
 * Tool 4: compare_routings
 * Compares Status Credits earned on two different routings side by side.
 */
export function handleCompareRoutings(args: unknown): ToolResult {
  try {
    const { routing_a, routing_b, cabin_class, airline } = compareSchema.parse(args);
    const result = compareRoutings(routing_a, routing_b, cabin_class, airline);
    return ok(result);
  } catch (e) {
    return handleKnownError(e);
  }
}

// ─── Tool registry ────────────────────────────────────────────────────────────

/**
 * MCP tool definitions — the schemas Claude sees when listing available tools.
 * Exported as a constant so both the stdio server and HTTP handler can use them.
 */
export const TOOLS = [
  {
    name: 'calculate_status_credits',
    description:
      'Calculate Qantas Frequent Flyer Status Credits for a flight routing. ' +
      'Provide airport codes or city names for each stop, plus the cabin class and airline.',
    inputSchema: {
      type: 'object',
      properties: {
        routing: {
          type: 'array',
          items: { type: 'string' },
          minItems: 2,
          description:
            'Airport IATA codes or city names in order (e.g. ["SYD", "LAX", "JFK"]). Minimum 2.',
        },
        cabin_class: {
          type: 'string',
          enum: CABIN_CLASSES,
          description:
            'Cabin class: discount_economy, economy, flexible_economy, premium_economy, business, or first.',
        },
        airline: {
          type: 'string',
          description:
            'IATA airline code for the marketing carrier (e.g. "AA" for American Airlines).',
        },
      },
      required: ['routing', 'cabin_class', 'airline'],
    },
  },
  {
    name: 'lookup_region',
    description:
      'Look up which Qantas Frequent Flyer earning region an airport belongs to. ' +
      'Also returns other airports in the same region.',
    inputSchema: {
      type: 'object',
      properties: {
        airport: {
          type: 'string',
          description: 'Airport IATA code (e.g. "DFW") or city name (e.g. "Dallas").',
        },
      },
      required: ['airport'],
    },
  },
  {
    name: 'optimise_routing',
    description:
      'Find the routing between two cities that earns the most Qantas Status Credits, ' +
      'using common oneworld hub connections. Returns the top options ranked by total SCs.',
    inputSchema: {
      type: 'object',
      properties: {
        origin: {
          type: 'string',
          description: 'Origin airport code or city name.',
        },
        destination: {
          type: 'string',
          description: 'Destination airport code or city name.',
        },
        cabin_class: {
          type: 'string',
          enum: CABIN_CLASSES,
          description: 'Cabin class to use for all legs.',
        },
        airline: {
          type: 'string',
          description: 'IATA airline code (e.g. "AA").',
        },
        max_stops: {
          type: 'number',
          minimum: 0,
          maximum: 3,
          default: 2,
          description: 'Maximum number of intermediate stops (0–3). Default: 2.',
        },
      },
      required: ['origin', 'destination', 'cabin_class', 'airline'],
    },
  },
  {
    name: 'compare_routings',
    description:
      'Compare Status Credits earned on two different routings side by side. ' +
      'Shows per-leg breakdown for each and the difference in total SCs.',
    inputSchema: {
      type: 'object',
      properties: {
        routing_a: {
          type: 'array',
          items: { type: 'string' },
          minItems: 2,
          description: 'First routing as airport codes or city names.',
        },
        routing_b: {
          type: 'array',
          items: { type: 'string' },
          minItems: 2,
          description: 'Second routing as airport codes or city names.',
        },
        cabin_class: {
          type: 'string',
          enum: CABIN_CLASSES,
          description: 'Cabin class applied to both routings.',
        },
        airline: {
          type: 'string',
          description: 'IATA airline code applied to both routings.',
        },
      },
      required: ['routing_a', 'routing_b', 'cabin_class', 'airline'],
    },
  },
] as const;

/**
 * Dispatch a tool call by name to the correct handler.
 * Returns an error result if the tool name is unknown.
 */
export function handleTool(toolName: string, args: unknown): ToolResult {
  switch (toolName) {
    case 'calculate_status_credits':
      return handleCalculateStatusCredits(args);
    case 'lookup_region':
      return handleLookupRegion(args);
    case 'optimise_routing':
      return handleOptimiseRouting(args);
    case 'compare_routings':
      return handleCompareRoutings(args);
    default:
      return err(`Unknown tool: "${toolName}"`);
  }
}
