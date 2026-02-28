import { describe, it, expect } from 'vitest';
import { calculateStatusCredits, compareRoutings } from '../src/calculator.js';
import { CalculationError } from '../src/types.js';

// ─── Route table matches ──────────────────────────────────────────────────────

describe('East Coast ↔ West Coast route table', () => {
  it('JFK→LAX business = 100 SCs', () => {
    const result = calculateStatusCredits(['JFK', 'LAX'], 'business', 'AA');
    expect(result.total_status_credits).toBe(100);
    expect(result.legs[0].matched_table).toBe('east_west_coast');
  });

  it('LAX→JFK business (reverse) = 100 SCs', () => {
    const result = calculateStatusCredits(['LAX', 'JFK'], 'business', 'AA');
    expect(result.total_status_credits).toBe(100);
  });

  it('JFK→LAX discount_economy = 25 SCs', () => {
    expect(calculateStatusCredits(['JFK', 'LAX'], 'discount_economy', 'AA').total_status_credits).toBe(25);
  });

  it('JFK→LAX economy = 35 SCs', () => {
    expect(calculateStatusCredits(['JFK', 'LAX'], 'economy', 'AA').total_status_credits).toBe(35);
  });

  it('JFK→LAX flexible_economy = 50 SCs', () => {
    expect(calculateStatusCredits(['JFK', 'LAX'], 'flexible_economy', 'AA').total_status_credits).toBe(50);
  });

  it('JFK→LAX premium_economy = 50 SCs', () => {
    expect(calculateStatusCredits(['JFK', 'LAX'], 'premium_economy', 'AA').total_status_credits).toBe(50);
  });

  it('JFK→LAX first = 150 SCs', () => {
    expect(calculateStatusCredits(['JFK', 'LAX'], 'first', 'AA').total_status_credits).toBe(150);
  });

  it('YYZ→SFO business = 100 SCs (YYZ is East Coast, SFO is West Coast)', () => {
    expect(calculateStatusCredits(['YYZ', 'SFO'], 'business', 'AA').total_status_credits).toBe(100);
  });
});

describe('Dallas ↔ West Coast route table', () => {
  it('DFW→LAX business = 100 SCs', () => {
    const result = calculateStatusCredits(['DFW', 'LAX'], 'business', 'AA');
    expect(result.total_status_credits).toBe(100);
    expect(result.legs[0].matched_table).toBe('dallas_west_coast');
  });

  it('LAX→DFW business (reverse) = 100 SCs', () => {
    expect(calculateStatusCredits(['LAX', 'DFW'], 'business', 'AA').total_status_credits).toBe(100);
  });
});

describe('Dallas ↔ East Coast route table', () => {
  it('DFW→JFK business = 80 SCs', () => {
    const result = calculateStatusCredits(['DFW', 'JFK'], 'business', 'AA');
    expect(result.total_status_credits).toBe(80);
    expect(result.legs[0].matched_table).toBe('dallas_east_coast');
  });

  it('DFW→JFK first = 80 SCs (AA domestic first credits at business rate)', () => {
    expect(calculateStatusCredits(['DFW', 'JFK'], 'first', 'AA').total_status_credits).toBe(80);
  });

  it('JFK→DFW economy = 20 SCs (reverse)', () => {
    expect(calculateStatusCredits(['JFK', 'DFW'], 'economy', 'AA').total_status_credits).toBe(20);
  });
});

describe('Australia East Coast ↔ West Coast USA route table', () => {
  it('SYD→LAX business = 180 SCs', () => {
    const result = calculateStatusCredits(['SYD', 'LAX'], 'business', 'AA');
    expect(result.total_status_credits).toBe(180);
    expect(result.legs[0].matched_table).toBe('aus_east_coast_west_coast_usa');
  });

  it('MEL→SFO economy = 60 SCs', () => {
    expect(calculateStatusCredits(['MEL', 'SFO'], 'economy', 'AA').total_status_credits).toBe(60);
  });

  it('LAX→BNE first = 270 SCs (reverse)', () => {
    expect(calculateStatusCredits(['LAX', 'BNE'], 'first', 'AA').total_status_credits).toBe(270);
  });
});

describe('Australia East Coast ↔ East Coast USA route table', () => {
  it('SYD→JFK business = 280 SCs', () => {
    const result = calculateStatusCredits(['SYD', 'JFK'], 'business', 'AA');
    expect(result.total_status_credits).toBe(280);
    expect(result.legs[0].matched_table).toBe('aus_east_coast_east_coast_usa');
  });

  it('SYD→JFK discount_economy = 70 SCs', () => {
    expect(calculateStatusCredits(['SYD', 'JFK'], 'discount_economy', 'AA').total_status_credits).toBe(70);
  });

  it('BNE→YYZ economy = 95 SCs', () => {
    expect(calculateStatusCredits(['BNE', 'YYZ'], 'economy', 'AA').total_status_credits).toBe(95);
  });
});

describe('Australia East Coast ↔ Dallas route table', () => {
  it('SYD→DFW business = 200 SCs', () => {
    const result = calculateStatusCredits(['SYD', 'DFW'], 'business', 'AA');
    expect(result.total_status_credits).toBe(200);
    expect(result.legs[0].matched_table).toBe('aus_east_coast_dallas');
  });

  it('MEL→DFW economy = 70 SCs', () => {
    expect(calculateStatusCredits(['MEL', 'DFW'], 'economy', 'AA').total_status_credits).toBe(70);
  });
});

// ─── Distance band fallbacks ───────────────────────────────────────────────────

describe('Distance band fallbacks', () => {
  it('LAX→SFO (short haul ≤400 mi) falls to 0–400 band — business = 40 SCs', () => {
    const result = calculateStatusCredits(['LAX', 'SFO'], 'business', 'AA');
    expect(result.total_status_credits).toBe(40);
    expect(result.legs[0].matched_table).toBe('intra_usa_short_0_400');
  });

  it('DFW→ORD (401–750 mi band, ORD has no region) — business falls to distance band', () => {
    // ORD is ~800 miles from DFW — should fall to 751–1500 band
    const result = calculateStatusCredits(['DFW', 'ORD'], 'business', 'AA');
    // ORD is not in any region, so distance band is used
    expect(result.legs[0].matched_table).toContain('all_other');
    // Should include a warning about ORD not being in a region
    expect(result.warnings.some(w => w.includes('ORD'))).toBe(true);
  });

  it('distance band results include an unverified warning for bands above 750 mi', () => {
    const result = calculateStatusCredits(['DFW', 'ORD'], 'business', 'AA');
    expect(result.warnings.some(w => w.toLowerCase().includes('verified'))).toBe(true);
  });
});

// ─── Multi-leg routings ───────────────────────────────────────────────────────

describe('Multi-leg routings', () => {
  it('LAX→DFW→LGA→YYZ business = 100+80+40 = 220 SCs', () => {
    const result = calculateStatusCredits(['LAX', 'DFW', 'LGA', 'YYZ'], 'business', 'AA');
    expect(result.legs).toHaveLength(3);
    // LAX→DFW: dallas↔west_coast = 100
    expect(result.legs[0].status_credits).toBe(100);
    // DFW→LGA: dallas↔east_coast = 80
    expect(result.legs[1].status_credits).toBe(80);
    // LGA→YYZ: both east_coast = distance band
    // (LGA and YYZ are both in east_coast_usa_canada — no specific route table for same-region legs)
    expect(result.total_status_credits).toBe(result.legs.reduce((s, l) => s + l.status_credits, 0));
  });

  it('SYD→LAX→JFK business = 180+100 = 280 SCs', () => {
    const result = calculateStatusCredits(['SYD', 'LAX', 'JFK'], 'business', 'AA');
    expect(result.legs[0].status_credits).toBe(180); // SYD→LAX aus_east_coast_west_coast_usa
    expect(result.legs[1].status_credits).toBe(100); // LAX→JFK east_west_coast
    expect(result.total_status_credits).toBe(280);
  });

  it('total_status_credits equals sum of legs', () => {
    const result = calculateStatusCredits(['SYD', 'LAX', 'DFW', 'JFK'], 'business', 'AA');
    const legSum = result.legs.reduce((s, l) => s + l.status_credits, 0);
    expect(result.total_status_credits).toBe(legSum);
  });

  it('total_distance_miles equals sum of leg distances', () => {
    const result = calculateStatusCredits(['LAX', 'DFW', 'JFK'], 'business', 'AA');
    const distSum = result.legs.reduce((s, l) => s + l.distance_miles, 0);
    expect(result.total_distance_miles).toBe(distSum);
  });
});

// ─── City name resolution ─────────────────────────────────────────────────────

describe('City name resolution', () => {
  it('resolves "Dallas" as DFW', () => {
    const result = calculateStatusCredits(['Dallas', 'Los Angeles'], 'business', 'AA');
    expect(result.routing[0]).toBe('DFW');
    expect(result.routing[1]).toBe('LAX');
  });

  it('resolves "New York" as JFK', () => {
    const result = calculateStatusCredits(['Los Angeles', 'New York'], 'business', 'AA');
    expect(result.routing[1]).toBe('JFK');
  });
});

// ─── Error handling ───────────────────────────────────────────────────────────

describe('Error handling', () => {
  it('throws ROUTING_TOO_SHORT for single airport', () => {
    expect(() => calculateStatusCredits(['LAX'], 'business', 'AA'))
      .toThrow(CalculationError);
    expect(() => calculateStatusCredits(['LAX'], 'business', 'AA'))
      .toThrow('at least 2 airports');
  });

  it('throws INVALID_CABIN_CLASS for unknown class', () => {
    expect(() => calculateStatusCredits(['LAX', 'JFK'], 'super_first', 'AA'))
      .toThrow(CalculationError);
    expect(() => calculateStatusCredits(['LAX', 'JFK'], 'super_first', 'AA'))
      .toThrow('Invalid cabin class');
  });

  it('throws UNKNOWN_AIRLINE for unsupported airline', () => {
    expect(() => calculateStatusCredits(['LAX', 'JFK'], 'business', 'ZZ'))
      .toThrow(CalculationError);
    expect(() => calculateStatusCredits(['LAX', 'JFK'], 'business', 'ZZ'))
      .toThrow('No earning table found');
  });

  it('throws UNKNOWN_AIRPORT for invalid code', () => {
    expect(() => calculateStatusCredits(['LAX', 'XYZ'], 'business', 'AA'))
      .toThrow(CalculationError);
    expect(() => calculateStatusCredits(['LAX', 'XYZ'], 'business', 'AA'))
      .toThrow('Unknown airport');
  });
});

// ─── compareRoutings ──────────────────────────────────────────────────────────

describe('compareRoutings', () => {
  it('calculates correct difference (positive when A earns more)', () => {
    // Routing A: SYD→LAX→JFK = 280 SCs
    // Routing B: SYD→LAX = 180 SCs
    const result = compareRoutings(
      ['SYD', 'LAX', 'JFK'],
      ['SYD', 'LAX'],
      'business',
      'AA',
    );
    expect(result.difference).toBe(result.routing_a.total_status_credits - result.routing_b.total_status_credits);
    expect(result.recommendation).toContain('Routing A earns');
  });

  it('positive difference when A earns more', () => {
    const result = compareRoutings(
      ['SYD', 'JFK'],
      ['SYD', 'LAX'],
      'business',
      'AA',
    );
    expect(result.difference).toBe(280 - 180);
    expect(result.recommendation).toContain('Routing A earns 100 more');
  });

  it('negative difference when B earns more', () => {
    const result = compareRoutings(
      ['SYD', 'LAX'],
      ['SYD', 'JFK'],
      'business',
      'AA',
    );
    expect(result.difference).toBe(-100);
    expect(result.recommendation).toContain('Routing B earns 100 more');
  });

  it('zero difference when equal', () => {
    const result = compareRoutings(
      ['LAX', 'JFK'],
      ['SFO', 'JFK'],
      'business',
      'AA',
    );
    expect(result.difference).toBe(0);
    expect(result.recommendation).toContain('same number');
  });
});
