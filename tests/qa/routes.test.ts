/**
 * QA test suite — verifies the calculator against routes.json.
 *
 * Routes with verified:true are ground-truth checks (confirmed against the
 * official Qantas partner earning tables page). Routes with verified:false
 * check that the calculator is self-consistent with the current earning table
 * data; those expected values still need scraper validation in Phase 4 QA.
 */
import { describe, it, expect } from 'vitest';
import { calculateStatusCredits } from '../../src/calculator.js';
import qaRoutes from './routes.json' with { type: 'json' };

// ─── Type helpers ─────────────────────────────────────────────────────────────

interface QARoute {
  id: string;
  category: string;
  description: string;
  routing: string[];
  cabin_class: string;
  airline: string;
  expected_total_sc: number;
  expected_table?: string;
  expected_tables?: string[];
  verified: boolean;
  note?: string;
}

const routes = qaRoutes.routes as QARoute[];
const verifiedRoutes = routes.filter(r => r.verified);
const unverifiedRoutes = routes.filter(r => !r.verified);

// ─── Verified routes — must match exactly ────────────────────────────────────

describe('QA verified routes (ground truth from official Qantas tables)', () => {
  for (const route of verifiedRoutes) {
    it(`${route.id}: ${route.description}`, () => {
      const result = calculateStatusCredits(route.routing, route.cabin_class, route.airline);
      expect(result.total_status_credits).toBe(route.expected_total_sc);

      // Verify the correct earning table was used for single-leg routes
      if (route.expected_table && route.routing.length === 2) {
        expect(result.legs[0].matched_table).toBe(route.expected_table);
      }

      // Verify per-leg table sequence for multi-leg routes
      if (route.expected_tables) {
        const actualTables = result.legs.map(l => l.matched_table);
        expect(actualTables).toEqual(route.expected_tables);
      }
    });
  }
});

// ─── Unverified routes — calculator must not error, and must match our data ──

describe('QA unverified routes (estimated values — pending scraper verification)', () => {
  for (const route of unverifiedRoutes) {
    it(`${route.id}: ${route.description}`, () => {
      // Calculator must not throw
      expect(() =>
        calculateStatusCredits(route.routing, route.cabin_class, route.airline),
      ).not.toThrow();

      const result = calculateStatusCredits(route.routing, route.cabin_class, route.airline);

      // Matches our current earning table data (may change when verified against Qantas)
      expect(result.total_status_credits).toBe(route.expected_total_sc);

      if (route.expected_table && route.routing.length === 2) {
        expect(result.legs[0].matched_table).toBe(route.expected_table);
      }
    });
  }
});

// ─── Coverage summary ─────────────────────────────────────────────────────────

describe('QA coverage', () => {
  it('routes.json contains at least 36 test routes', () => {
    expect(routes.length).toBeGreaterThanOrEqual(36);
  });

  it('has routes for AA and QF airlines', () => {
    const airlines = new Set(routes.map(r => r.airline));
    expect(airlines.has('AA')).toBe(true);
    expect(airlines.has('QF')).toBe(true);
  });

  it('has at least 5 categories covered', () => {
    const categories = new Set(routes.map(r => r.category));
    expect(categories.size).toBeGreaterThanOrEqual(5);
  });

  it('has multi-leg test routes', () => {
    const multiLeg = routes.filter(r => r.routing.length > 2);
    expect(multiLeg.length).toBeGreaterThanOrEqual(4);
  });

  it('majority of AA routes are verified', () => {
    const aaRoutes = routes.filter(r => r.airline === 'AA');
    const aaVerified = aaRoutes.filter(r => r.verified);
    expect(aaVerified.length).toBeGreaterThan(aaRoutes.length / 2);
  });
});
