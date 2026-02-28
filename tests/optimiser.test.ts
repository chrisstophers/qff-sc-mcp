import { describe, it, expect } from 'vitest';
import { optimiseRouting } from '../src/optimiser.js';
import { isValidDirectLeg, getEarningTable } from '../src/earning-tables.js';
import { CalculationError } from '../src/types.js';

describe('optimiseRouting', () => {
  it('returns at most topN options', () => {
    const result = optimiseRouting('LAX', 'YYZ', 'business', 'AA', 2, 3);
    expect(result.options.length).toBeLessThanOrEqual(3);
  });

  it('includes a direct routing option when topN is large enough', () => {
    // LAX→JFK direct = 100 SCs, but 2-stop routings via DFW hub score much higher.
    // Request enough options to capture the direct route even after hub routes rank above it.
    const result = optimiseRouting('LAX', 'JFK', 'business', 'AA', 2, 100);
    const routings = result.options.map(o => o.routing.join('-'));
    expect(routings).toContain('LAX-JFK');
  });

  it('options are sorted by total_status_credits descending', () => {
    const result = optimiseRouting('SYD', 'JFK', 'business', 'AA', 2, 10);
    for (let i = 0; i < result.options.length - 1; i++) {
      expect(result.options[i].total_status_credits).toBeGreaterThanOrEqual(
        result.options[i + 1].total_status_credits,
      );
    }
  });

  it('connecting via DFW from LAX→YYZ earns more than direct (if DFW hub adds SCs)', () => {
    // LAX→DFW→LGA→YYZ = 100+80+distance = more than direct LAX→YYZ (distance band)
    const result = optimiseRouting('LAX', 'YYZ', 'business', 'AA', 2, 10);
    const direct = result.options.find(o => o.routing.length === 2);
    const multiLeg = result.options.find(o => o.routing.length > 2);

    if (direct && multiLeg) {
      // Best option should have >= SCs as direct
      expect(result.options[0].total_status_credits).toBeGreaterThanOrEqual(
        direct.total_status_credits,
      );
    }
  });

  it('respects max_stops=1 — no 3-airport routings returned', () => {
    const result = optimiseRouting('LAX', 'JFK', 'business', 'AA', 1, 10);
    for (const option of result.options) {
      expect(option.routing.length).toBeLessThanOrEqual(3); // origin + 1 stop + dest = 3
    }
  });

  it('max_stops=0 — only direct routing', () => {
    const result = optimiseRouting('LAX', 'JFK', 'business', 'AA', 0, 10);
    expect(result.options).toHaveLength(1);
    expect(result.options[0].routing).toEqual(['LAX', 'JFK']);
  });

  it('per-leg total matches total_status_credits', () => {
    const result = optimiseRouting('LAX', 'YYZ', 'business', 'AA', 2, 5);
    for (const option of result.options) {
      const legSum = option.legs.reduce((s, l) => s + l.status_credits, 0);
      expect(option.total_status_credits).toBe(legSum);
    }
  });

  it('resolved origin and destination are IATA codes', () => {
    const result = optimiseRouting('Dallas', 'New York', 'business', 'AA', 2, 5);
    expect(result.origin).toBe('DFW');
    expect(result.destination).toBe('JFK');
  });

  it('city names work as input', () => {
    expect(() => optimiseRouting('Dallas', 'New York', 'business', 'AA')).not.toThrow();
  });

  it('throws for unknown origin', () => {
    expect(() => optimiseRouting('XYZ', 'LAX', 'business', 'AA')).toThrow(CalculationError);
  });

  it('throws for unknown destination', () => {
    expect(() => optimiseRouting('LAX', 'XYZ', 'business', 'AA')).toThrow(CalculationError);
  });

  it('throws for unknown airline', () => {
    expect(() => optimiseRouting('LAX', 'JFK', 'business', 'ZZ')).toThrow(CalculationError);
  });
});

// ─── Gateway airport constraints ──────────────────────────────────────────────

describe('isValidDirectLeg — gateway constraints', () => {
  const aa = getEarningTable('AA')!;

  // Unconstrained domestic routes should always be valid
  it('LAX→JFK (east_west_coast, no gateways): valid', () => {
    expect(isValidDirectLeg('LAX', 'JFK', aa)).toBe(true);
  });

  it('DFW→JFK (dallas↔east_coast, no gateways): valid', () => {
    expect(isValidDirectLeg('DFW', 'JFK', aa)).toBe(true);
  });

  // Trans-Pacific west coast: only LAX is a valid US gateway
  it('SYD→LAX (aus↔west_coast, LAX is gateway): valid', () => {
    expect(isValidDirectLeg('SYD', 'LAX', aa)).toBe(true);
  });

  it('MEL→LAX (aus↔west_coast, LAX is gateway): valid', () => {
    expect(isValidDirectLeg('MEL', 'LAX', aa)).toBe(true);
  });

  it('LAX→SYD (reverse bidirectional): valid', () => {
    expect(isValidDirectLeg('LAX', 'SYD', aa)).toBe(true);
  });

  it('SYD→PHX (aus↔west_coast, PHX not a gateway): invalid', () => {
    expect(isValidDirectLeg('SYD', 'PHX', aa)).toBe(false);
  });

  it('SYD→SFO (aus↔west_coast, SFO not a gateway): invalid', () => {
    expect(isValidDirectLeg('SYD', 'SFO', aa)).toBe(false);
  });

  // East coast from Australia: no direct AA service at all
  it('SYD→JFK (aus↔east_coast, empty gateway list): invalid', () => {
    expect(isValidDirectLeg('SYD', 'JFK', aa)).toBe(false);
  });

  it('SYD→MIA (aus↔east_coast, empty gateway list): invalid', () => {
    expect(isValidDirectLeg('SYD', 'MIA', aa)).toBe(false);
  });

  it('MIA→SYD (reverse: east_coast↔aus, empty list): invalid', () => {
    expect(isValidDirectLeg('MIA', 'SYD', aa)).toBe(false);
  });

  // Dallas from Australia: SYD→DFW is the gateway pair
  it('SYD→DFW (aus↔dallas, both are gateways): valid', () => {
    expect(isValidDirectLeg('SYD', 'DFW', aa)).toBe(true);
  });

  it('MEL→DFW (aus↔dallas, MEL not in aus gateways for this route): invalid', () => {
    // Only SYD is listed as an aus gateway for the dallas route
    expect(isValidDirectLeg('MEL', 'DFW', aa)).toBe(false);
  });

  // australia_east_coast is fully gateway-constrained — ALL its route tables require
  // specific gateways.  ORD has no region, so no route table can match, and the
  // distance-band fallback doesn't represent a real AA transoceanic route.
  it('SYD→ORD (ORD has no region, aus fully constrained): invalid', () => {
    expect(isValidDirectLeg('SYD', 'ORD', aa)).toBe(false);
  });

  // LAX (west_coast) has unconstrained route tables (e.g. east↔west, dallas↔west),
  // so it CAN fly to unregioned airports via distance band.
  it('LAX→ORD (west_coast has unconstrained tables): valid', () => {
    expect(isValidDirectLeg('LAX', 'ORD', aa)).toBe(true);
  });
});

describe('gateway constraints in optimiser candidates', () => {
  it('SYD→JFK optimiser never suggests a direct SYD→MIA leg', () => {
    const result = optimiseRouting('SYD', 'JFK', 'business', 'AA', 2, 100);
    const allLegs = result.options.flatMap(o =>
      o.legs.map(l => `${l.origin}→${l.destination}`)
    );
    // SYD→MIA as a direct segment should never appear
    expect(allLegs).not.toContain('SYD→MIA');
    // Nor should any other SYD→east_coast direct leg
    expect(allLegs).not.toContain('SYD→JFK');
    expect(allLegs).not.toContain('SYD→BOS');
    expect(allLegs).not.toContain('SYD→CLT');
  });

  it('SYD→JFK first leg is always via LAX or DFW (the real gateways)', () => {
    const result = optimiseRouting('SYD', 'JFK', 'business', 'AA', 2, 20);
    expect(result.options.length).toBeGreaterThan(0);
    for (const option of result.options) {
      // Every routing starting from SYD must go through LAX or DFW first.
      // ORD is now also blocked (australia_east_coast is fully gateway-constrained).
      const firstConnection = option.routing[1];
      expect(['LAX', 'DFW']).toContain(firstConnection);
    }
  });

  it('SYD→JFK with max_stops=1: best option goes via LAX (180+100=280 SCs)', () => {
    const result = optimiseRouting('SYD', 'JFK', 'business', 'AA', 1, 5);
    expect(result.options.length).toBeGreaterThan(0);
    // Best 1-stop from SYD to JFK is via LAX (280 SCs) or DFW (200+80=280 SCs)
    expect(result.options[0].total_status_credits).toBe(280);
    const bestRouting = result.options[0].routing;
    expect(['LAX', 'DFW']).toContain(bestRouting[1]);
  });

  it('SYD→JFK with max_stops=2: a real SYD→LAX→MIA→JFK routing earns 340 SCs', () => {
    // This is a legitimate mileage-maximising routing (SYD→LAX→MIA→JFK) that
    // earns more than the direct 2-stop options (180+100+60=340 SCs).
    const result = optimiseRouting('SYD', 'JFK', 'business', 'AA', 2, 10);
    const laxMiaJfk = result.options.find(
      o => o.routing.join('-') === 'SYD-LAX-MIA-JFK'
    );
    expect(laxMiaJfk).toBeDefined();
    expect(laxMiaJfk!.total_status_credits).toBe(340);
  });

  it('SYD→JFK max_stops=0: no options (AA has no non-stop SYD→JFK)', () => {
    // AA does not fly Sydney→New York non-stop, so the optimiser correctly
    // returns nothing when asked for a direct flight only.
    const result = optimiseRouting('SYD', 'JFK', 'business', 'AA', 0, 5);
    expect(result.options).toHaveLength(0);
  });
});
