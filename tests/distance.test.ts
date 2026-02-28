import { describe, it, expect } from 'vitest';
import { haversineDistance, airportDistance } from '../src/distance.js';
import type { Airport } from '../src/types.js';

describe('haversineDistance', () => {
  it('LAX to JFK ~2,475 mi', () => {
    const dist = haversineDistance(33.9425, -118.4081, 40.6398, -73.7789);
    expect(dist).toBeGreaterThan(2450);
    expect(dist).toBeLessThan(2510);
  });

  it('SYD to LAX ~7,488 mi', () => {
    const dist = haversineDistance(-33.9461, 151.1772, 33.9425, -118.4081);
    expect(dist).toBeGreaterThan(7440);
    expect(dist).toBeLessThan(7540);
  });

  it('LHR to CDG ~213 mi', () => {
    const dist = haversineDistance(51.477, -0.4614, 49.0097, 2.5479);
    expect(dist).toBeGreaterThan(200);
    expect(dist).toBeLessThan(230);
  });

  it('LAX to SFO — in the 0–400 mile band', () => {
    const dist = haversineDistance(33.9425, -118.4081, 37.6213, -122.379);
    expect(dist).toBeGreaterThan(0);
    expect(dist).toBeLessThanOrEqual(400);
  });

  it('DFW to ATL — in the 401–750 mile band', () => {
    const dist = haversineDistance(32.8998, -97.0403, 33.6407, -84.4277);
    expect(dist).toBeGreaterThan(400);
    expect(dist).toBeLessThanOrEqual(750);
  });

  it('same airport is zero distance', () => {
    expect(haversineDistance(33.9425, -118.4081, 33.9425, -118.4081)).toBe(0);
  });

  it('returns a round number (no decimal places)', () => {
    const dist = haversineDistance(33.9425, -118.4081, 40.6398, -73.7789);
    expect(Number.isInteger(dist)).toBe(true);
  });
});

describe('airportDistance', () => {
  const lax: Airport = {
    iata: 'LAX',
    icao: 'KLAX',
    name: 'Los Angeles International',
    city: 'Los Angeles',
    country: 'US',
    lat: 33.9425,
    lon: -118.4081,
  };
  const jfk: Airport = {
    iata: 'JFK',
    icao: 'KJFK',
    name: 'John F Kennedy International',
    city: 'New York',
    country: 'US',
    lat: 40.6398,
    lon: -73.7789,
  };

  it('wraps haversineDistance with Airport objects', () => {
    const dist = airportDistance(lax, jfk);
    expect(dist).toBeGreaterThan(2450);
    expect(dist).toBeLessThan(2510);
  });
});
