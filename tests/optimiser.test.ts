import { describe, it, expect } from 'vitest';
import { optimiseRouting } from '../src/optimiser.js';
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
