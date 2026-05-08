/**
 * All geographic primitives used by the pooling engine.
 * Pure functions — no side effects, no external deps, fully testable.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;

/** Haversine great-circle distance in km */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Compass bearing from a → b in degrees [0, 360) */
export function bearing(a: LatLng, b: LatLng): number {
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Absolute angular difference between two bearings [0, 180] */
export function bearingDiff(b1: number, b2: number): number {
  const diff = Math.abs(b1 - b2) % 360;
  return diff > 180 ? 360 - diff : diff;
}

/**
 * Perpendicular distance from point P to the line segment A→B in km.
 * Used to check whether a new rider's pickup falls near an existing route corridor.
 */
export function perpendicularDistanceKm(p: LatLng, a: LatLng, b: LatLng): number {
  const abKm = haversineKm(a, b);
  if (abKm < 0.001) return haversineKm(p, a);

  // Project p onto infinite line through a and b using parametric t
  const t = clamp(
    ((p.lat - a.lat) * (b.lat - a.lat) + (p.lng - a.lng) * (b.lng - a.lng)) /
      ((b.lat - a.lat) ** 2 + (b.lng - a.lng) ** 2),
    0,
    1,
  );
  const closest: LatLng = {
    lat: a.lat + t * (b.lat - a.lat),
    lng: a.lng + t * (b.lng - a.lng),
  };
  return haversineKm(p, closest);
}

/**
 * Check whether point P lies within a corridor of widthKm around segment A→B.
 * Also checks that P is "between" A and B longitudinally (not behind or ahead).
 */
export function isNearCorridor(
  p: LatLng,
  a: LatLng,
  b: LatLng,
  widthKm: number,
): boolean {
  const perpDist = perpendicularDistanceKm(p, a, b);
  if (perpDist > widthKm) return false;

  // Also check the bearing from A→B roughly matches A→P (rider going same direction)
  const routeBearing = bearing(a, b);
  const pointBearing = bearing(a, p);
  return bearingDiff(routeBearing, pointBearing) <= 90;
}

/**
 * Total polyline length: sum of consecutive haversine distances.
 */
export function polylineDistanceKm(stops: LatLng[]): number {
  let total = 0;
  for (let i = 0; i + 1 < stops.length; i++) {
    total += haversineKm(stops[i], stops[i + 1]);
  }
  return total;
}

/**
 * Estimate drive time in minutes from distance assuming avgSpeedKmh.
 */
export function estimateDriveMin(distanceKm: number, avgSpeedKmh = 30): number {
  return (distanceKm / avgSpeedKmh) * 60;
}

/**
 * Mid-point of two coordinates (for corridor centroid checks).
 */
export function midpoint(a: LatLng, b: LatLng): LatLng {
  return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
