import { describe, it, expect } from 'vitest';
import { calculateStatusCredits, compareRoutings } from '../src/calculator.js';
import { optimiseRouting } from '../src/optimiser.js';

/**
 * Integration tests — end-to-end scenarios that exercise the full stack:
 * airport resolution → distance → region lookup → route table or distance band → SC calculation.
 *
 * These are the "spec sheet" tests. If any of these fail after a data or logic change,
 * something important has broken.
 */

describe('Key routing scenarios (spec sheet)', () => {
  it('LAX→DFW→LGA→YYZ business: per-leg and total SCs', () => {
    const result = calculateStatusCredits(['LAX', 'DFW', 'LGA', 'YYZ'], 'business', 'AA');

    // LAX→DFW: west_coast ↔ dallas = 100
    expect(result.legs[0].origin).toBe('LAX');
    expect(result.legs[0].destination).toBe('DFW');
    expect(result.legs[0].status_credits).toBe(100);
    expect(result.legs[0].matched_table).toBe('dallas_west_coast');

    // DFW→LGA: dallas ↔ east_coast = 80
    expect(result.legs[1].origin).toBe('DFW');
    expect(result.legs[1].destination).toBe('LGA');
    expect(result.legs[1].status_credits).toBe(80);
    expect(result.legs[1].matched_table).toBe('dallas_east_coast');

    // LGA→YYZ: both east_coast_usa_canada — no dedicated route table,
    // falls to distance band (~365 mi → 0–400 band → business = 40 SCs)
    expect(result.legs[2].origin).toBe('LGA');
    expect(result.legs[2].destination).toBe('YYZ');
    expect(result.legs[2].status_credits).toBe(40);

    // Total
    expect(result.total_status_credits).toBe(100 + 80 + 40);
  });

  it('SYD→LAX→JFK business = 180+100 = 280 SCs', () => {
    const result = calculateStatusCredits(['SYD', 'LAX', 'JFK'], 'business', 'AA');
    expect(result.legs[0].status_credits).toBe(180);
    expect(result.legs[1].status_credits).toBe(100);
    expect(result.total_status_credits).toBe(280);
  });

  it('SYD→DFW business = 200 SCs', () => {
    const result = calculateStatusCredits(['SYD', 'DFW'], 'business', 'AA');
    expect(result.total_status_credits).toBe(200);
  });

  it('All cabin classes on SYD→DFW', () => {
    const expected = {
      discount_economy: 50,
      economy: 70,
      flexible_economy: 100,
      premium_economy: 100,
      business: 200,
      first: 300,
    };

    for (const [cabinClass, expectedSCs] of Object.entries(expected)) {
      const result = calculateStatusCredits(['SYD', 'DFW'], cabinClass, 'AA');
      expect(result.total_status_credits, `cabin class: ${cabinClass}`).toBe(expectedSCs);
    }
  });

  it('All cabin classes on JFK→LAX', () => {
    const expected = {
      discount_economy: 25,
      economy: 35,
      flexible_economy: 50,
      premium_economy: 50,
      business: 100,
      first: 150,
    };

    for (const [cabinClass, expectedSCs] of Object.entries(expected)) {
      const result = calculateStatusCredits(['JFK', 'LAX'], cabinClass, 'AA');
      expect(result.total_status_credits, `cabin class: ${cabinClass}`).toBe(expectedSCs);
    }
  });

  it('ORD (no region) falls to distance band gracefully', () => {
    // ORD is not in any Qantas earning region — should not throw, should use distance band
    expect(() => calculateStatusCredits(['DFW', 'ORD'], 'business', 'AA')).not.toThrow();
    const result = calculateStatusCredits(['DFW', 'ORD'], 'business', 'AA');
    expect(result.total_status_credits).toBeGreaterThan(0);
    expect(result.warnings.some(w => w.includes('ORD'))).toBe(true);
  });
});

describe('Multi-stop vs direct comparison', () => {
  it('SYD→LAX→JFK earns more than SYD→LAX', () => {
    const multiLeg = calculateStatusCredits(['SYD', 'LAX', 'JFK'], 'business', 'AA');
    const direct = calculateStatusCredits(['SYD', 'LAX'], 'business', 'AA');
    expect(multiLeg.total_status_credits).toBeGreaterThan(direct.total_status_credits);
  });

  it('compareRoutings: SYD→JFK vs SYD→LAX — A earns 100 more', () => {
    const result = compareRoutings(['SYD', 'JFK'], ['SYD', 'LAX'], 'business', 'AA');
    expect(result.difference).toBe(100);
    expect(result.recommendation).toContain('Routing A earns 100 more');
  });
});

describe('Optimiser integration', () => {
  it('optimiser returns valid options for LAX→YYZ', () => {
    const result = optimiseRouting('LAX', 'YYZ', 'business', 'AA', 2, 5);
    expect(result.options.length).toBeGreaterThan(0);
    for (const option of result.options) {
      // Each option's leg sum should equal total
      const legSum = option.legs.reduce((s, l) => s + l.status_credits, 0);
      expect(option.total_status_credits).toBe(legSum);
    }
  });

  it('optimiser results are sorted by SCs descending', () => {
    const result = optimiseRouting('SYD', 'JFK', 'business', 'AA', 2, 10);
    for (let i = 0; i < result.options.length - 1; i++) {
      expect(result.options[i].total_status_credits).toBeGreaterThanOrEqual(
        result.options[i + 1].total_status_credits,
      );
    }
  });
});

describe('Routing result structure', () => {
  it('routing array contains resolved IATA codes', () => {
    const result = calculateStatusCredits(['SYD', 'LAX'], 'business', 'AA');
    expect(result.routing).toEqual(['SYD', 'LAX']);
  });

  it('legs array length is routing.length - 1', () => {
    const result = calculateStatusCredits(['SYD', 'LAX', 'JFK'], 'business', 'AA');
    expect(result.legs).toHaveLength(2);
  });

  it('each leg has required fields', () => {
    const result = calculateStatusCredits(['SYD', 'LAX'], 'business', 'AA');
    const leg = result.legs[0];
    expect(leg.origin).toBe('SYD');
    expect(leg.destination).toBe('LAX');
    expect(typeof leg.distance_miles).toBe('number');
    expect(leg.distance_miles).toBeGreaterThan(0);
    expect(typeof leg.status_credits).toBe('number');
    expect(typeof leg.matched_table).toBe('string');
    expect(leg.matched_table).not.toBe('');
  });
});
