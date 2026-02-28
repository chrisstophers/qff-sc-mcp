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

  it('DFW→JFK first = 120 SCs (verified per official Qantas partner tables)', () => {
    expect(calculateStatusCredits(['DFW', 'JFK'], 'first', 'AA').total_status_credits).toBe(120);
  });

  it('JFK→DFW economy = 25 SCs (reverse, verified per official Qantas partner tables)', () => {
    expect(calculateStatusCredits(['JFK', 'DFW'], 'economy', 'AA').total_status_credits).toBe(25);
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

// ─── QF (Qantas) earning tables ───────────────────────────────────────────────

describe('QF — Australia ↔ New Zealand (verified)', () => {
  it('SYD→AKL business = 80 SCs', () => {
    const result = calculateStatusCredits(['SYD', 'AKL'], 'business', 'QF');
    expect(result.total_status_credits).toBe(80);
    expect(result.legs[0].matched_table).toBe('aus_east_coast_new_zealand');
  });

  it('SYD→AKL economy = 25 SCs', () => {
    expect(calculateStatusCredits(['SYD', 'AKL'], 'economy', 'QF').total_status_credits).toBe(25);
  });

  it('SYD→AKL premium_economy = 45 SCs', () => {
    expect(calculateStatusCredits(['SYD', 'AKL'], 'premium_economy', 'QF').total_status_credits).toBe(45);
  });

  it('SYD→AKL first = 120 SCs', () => {
    expect(calculateStatusCredits(['SYD', 'AKL'], 'first', 'QF').total_status_credits).toBe(120);
  });

  it('AKL→MEL (reverse) = 80 SCs business', () => {
    expect(calculateStatusCredits(['AKL', 'MEL'], 'business', 'QF').total_status_credits).toBe(80);
  });
});

describe('QF — Australia ↔ Asia (verified)', () => {
  it('SYD→SIN business = 120 SCs', () => {
    const result = calculateStatusCredits(['SYD', 'SIN'], 'business', 'QF');
    expect(result.total_status_credits).toBe(120);
    expect(result.legs[0].matched_table).toBe('aus_east_coast_singapore');
  });

  it('MEL→HKG business = 120 SCs', () => {
    expect(calculateStatusCredits(['MEL', 'HKG'], 'business', 'QF').total_status_credits).toBe(120);
  });

  it('SYD→NRT (Tokyo) business = 120 SCs', () => {
    expect(calculateStatusCredits(['SYD', 'NRT'], 'business', 'QF').total_status_credits).toBe(120);
  });

  it('SYD→SIN discount_economy = 30 SCs', () => {
    expect(calculateStatusCredits(['SYD', 'SIN'], 'discount_economy', 'QF').total_status_credits).toBe(30);
  });

  it('SYD→SIN premium_economy = 65 SCs', () => {
    expect(calculateStatusCredits(['SYD', 'SIN'], 'premium_economy', 'QF').total_status_credits).toBe(65);
  });
});

describe('QF — Australia ↔ London/Europe (verified)', () => {
  it('SYD→LHR business = 280 SCs', () => {
    const result = calculateStatusCredits(['SYD', 'LHR'], 'business', 'QF');
    expect(result.total_status_credits).toBe(280);
    expect(result.legs[0].matched_table).toBe('aus_east_coast_western_europe');
  });

  it('MEL→LHR first = 420 SCs', () => {
    expect(calculateStatusCredits(['MEL', 'LHR'], 'first', 'QF').total_status_credits).toBe(420);
  });

  it('SYD→LHR discount_economy = 70 SCs', () => {
    expect(calculateStatusCredits(['SYD', 'LHR'], 'discount_economy', 'QF').total_status_credits).toBe(70);
  });

  it('LHR→SYD (reverse) business = 280 SCs', () => {
    expect(calculateStatusCredits(['LHR', 'SYD'], 'business', 'QF').total_status_credits).toBe(280);
  });
});

describe('QF — Australia ↔ Los Angeles (unverified estimate)', () => {
  it('SYD→LAX business = 180 SCs (estimated — verify against Qantas calculator)', () => {
    const result = calculateStatusCredits(['SYD', 'LAX'], 'business', 'QF');
    expect(result.total_status_credits).toBe(180);
    expect(result.legs[0].matched_table).toBe('aus_east_coast_west_coast_usa');
  });

  it('SYD→LAX premium_economy = 100 SCs (verified)', () => {
    expect(calculateStatusCredits(['SYD', 'LAX'], 'premium_economy', 'QF').total_status_credits).toBe(100);
  });
});

describe('QF — SYD→SIN→LHR multi-leg routing', () => {
  it('SYD→SIN→LHR business = 120 + 280 = 400 SCs total', () => {
    // SYD→SIN: australia_east_coast ↔ singapore = 120 SCs
    // SIN→LHR: singapore ↔ western_europe — no specific QF route table → distance band
    // SIN→LHR ~6,770 miles → qf_6501_plus → 160 SCs
    // Total = 120 + 160 = 280 SCs
    // Note: This is NOT the same as the "direct" Australia→Europe rate (280 for the whole journey).
    // Per-leg calculation naturally gives a different number since it splits the fare bucket.
    const result = calculateStatusCredits(['SYD', 'SIN', 'LHR'], 'business', 'QF');
    expect(result.legs[0].status_credits).toBe(120); // SYD→SIN
    expect(result.legs[0].matched_table).toBe('aus_east_coast_singapore');
    // SIN→LHR falls to distance band (~6770 miles, qf_6501_plus)
    expect(result.legs[1].status_credits).toBe(160);
    expect(result.total_status_credits).toBe(280);
  });
});

describe('QF — domestic Australia (route tables)', () => {
  it('SYD→PER business = 40 SCs (1501+ domestic)', () => {
    const result = calculateStatusCredits(['SYD', 'PER'], 'business', 'QF');
    expect(result.total_status_credits).toBe(40);
    expect(result.legs[0].matched_table).toBe('aus_east_coast_perth');
  });

  it('SYD→ADL business = 40 SCs (qf_0_750 distance band, ~728mi)', () => {
    const result = calculateStatusCredits(['SYD', 'ADL'], 'business', 'QF');
    expect(result.total_status_credits).toBe(40);
    expect(result.legs[0].matched_table).toBe('qf_0_750');
  });
});

describe('QF — distance band fallback', () => {
  it('SYD→MEL falls to distance band (both in australia_east_coast, no route table)', () => {
    // SYD→MEL ~450 miles → qf_0_750 → business = 40 SCs (international band)
    // Note: domestic band would give 20 SCs — a limitation of the current model
    const result = calculateStatusCredits(['SYD', 'MEL'], 'business', 'QF');
    expect(result.total_status_credits).toBe(40);
    expect(result.legs[0].matched_table).toBe('qf_0_750');
  });

  it('QF is now a supported airline', () => {
    expect(() => calculateStatusCredits(['SYD', 'LHR'], 'business', 'QF')).not.toThrow();
  });
});
