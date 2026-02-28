import type { Airport } from './types.js';

/** Earth's mean radius in statute miles — Qantas uses statute miles for distance bands. */
const EARTH_RADIUS_MILES = 3958.8;

/**
 * Great circle distance between two lat/lon points using the Haversine formula.
 * Returns distance in statute miles, rounded to the nearest mile.
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(EARTH_RADIUS_MILES * c);
}

/**
 * Distance between two airports in statute miles.
 * Convenience wrapper around haversineDistance that accepts Airport objects.
 */
export function airportDistance(origin: Airport, destination: Airport): number {
  return haversineDistance(origin.lat, origin.lon, destination.lat, destination.lon);
}
