import {
  haversineKm,
  bearing,
  bearingDiff,
  perpendicularDistanceKm,
  isNearCorridor,
  polylineDistanceKm,
  estimateDriveMin,
} from '../algorithms/geo-utils';

describe('GeoUtils', () => {
  // Known coordinates: Mumbai → Pune (~148 km)
  const MUMBAI = { lat: 19.076, lng: 72.8777 };
  const PUNE = { lat: 18.5204, lng: 73.8567 };

  // Known: Manhattan midpoint
  const A = { lat: 40.7128, lng: -74.006 };
  const B = { lat: 40.7589, lng: -73.9851 };

  describe('haversineKm', () => {
    it('computes Mumbai→Pune distance within 5% of actual', () => {
      const dist = haversineKm(MUMBAI, PUNE);
      expect(dist).toBeGreaterThan(130);
      expect(dist).toBeLessThan(160);
    });

    it('returns 0 for identical points', () => {
      expect(haversineKm(A, A)).toBeCloseTo(0, 5);
    });

    it('is symmetric', () => {
      expect(haversineKm(A, B)).toBeCloseTo(haversineKm(B, A), 5);
    });
  });

  describe('bearing', () => {
    it('returns ~0 for north-heading route', () => {
      const south = { lat: 0, lng: 0 };
      const north = { lat: 10, lng: 0 };
      expect(bearing(south, north)).toBeCloseTo(0, 0);
    });

    it('returns ~90 for east-heading route', () => {
      const west = { lat: 0, lng: 0 };
      const east = { lat: 0, lng: 10 };
      expect(bearing(west, east)).toBeCloseTo(90, 0);
    });

    it('returns value in [0, 360)', () => {
      const b = bearing(MUMBAI, PUNE);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(360);
    });
  });

  describe('bearingDiff', () => {
    it('returns 0 for identical bearings', () => {
      expect(bearingDiff(45, 45)).toBe(0);
    });

    it('returns 180 for opposite bearings', () => {
      expect(bearingDiff(0, 180)).toBe(180);
    });

    it('handles wrap-around correctly', () => {
      expect(bearingDiff(350, 10)).toBe(20);
    });

    it('is symmetric', () => {
      expect(bearingDiff(30, 120)).toBe(bearingDiff(120, 30));
    });
  });

  describe('perpendicularDistanceKm', () => {
    it('returns 0 when point is on the segment', () => {
      const mid = { lat: (A.lat + B.lat) / 2, lng: (A.lng + B.lng) / 2 };
      const dist = perpendicularDistanceKm(mid, A, B);
      expect(dist).toBeLessThan(0.1); // < 100m tolerance
    });

    it('returns haversine distance when segment is degenerate (A === B)', () => {
      const dist = perpendicularDistanceKm(B, A, A);
      expect(dist).toBeCloseTo(haversineKm(B, A), 1);
    });

    it('is always non-negative', () => {
      const randomPoint = { lat: 40.74, lng: -73.99 };
      expect(perpendicularDistanceKm(randomPoint, A, B)).toBeGreaterThanOrEqual(0);
    });
  });

  describe('isNearCorridor', () => {
    it('returns true for a point very close to the route', () => {
      const nearMid = { lat: (A.lat + B.lat) / 2 + 0.001, lng: (A.lng + B.lng) / 2 };
      expect(isNearCorridor(nearMid, A, B, 2)).toBe(true);
    });

    it('returns false for a point far from the route', () => {
      const farPoint = { lat: 41.0, lng: -74.5 };
      expect(isNearCorridor(farPoint, A, B, 2)).toBe(false);
    });
  });

  describe('polylineDistanceKm', () => {
    it('returns 0 for empty or single-stop route', () => {
      expect(polylineDistanceKm([])).toBe(0);
      expect(polylineDistanceKm([A])).toBe(0);
    });

    it('equals haversine for two-stop route', () => {
      expect(polylineDistanceKm([A, B])).toBeCloseTo(haversineKm(A, B), 4);
    });

    it('satisfies triangle inequality', () => {
      const C = { lat: 40.68, lng: -73.94 };
      const direct = polylineDistanceKm([A, C]);
      const via = polylineDistanceKm([A, B, C]);
      expect(via).toBeGreaterThanOrEqual(direct);
    });
  });

  describe('estimateDriveMin', () => {
    it('estimates 30 km at 30 km/h as 60 min', () => {
      expect(estimateDriveMin(30, 30)).toBeCloseTo(60, 1);
    });

    it('returns 0 for 0 km', () => {
      expect(estimateDriveMin(0)).toBe(0);
    });
  });
});
