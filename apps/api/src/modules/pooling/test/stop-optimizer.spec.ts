import { StopOptimizer, Stop } from '../algorithms/stop-optimizer';
import { LatLng } from '../algorithms/geo-utils';

describe('StopOptimizer', () => {
  const optimizer = new StopOptimizer();

  // Straight north-south street layout
  const ORIGIN: LatLng   = { lat: 40.70, lng: -74.00 };
  const P1: LatLng       = { lat: 40.71, lng: -74.00 };
  const D1: LatLng       = { lat: 40.75, lng: -74.00 };
  const P2: LatLng       = { lat: 40.72, lng: -74.00 };
  const D2: LatLng       = { lat: 40.78, lng: -74.00 };
  const P3: LatLng       = { lat: 40.73, lng: -74.00 };
  const D3: LatLng       = { lat: 40.80, lng: -74.00 };

  const buildStops = (riders: Array<{ id: string; pickup: LatLng; dropoff: LatLng }>): Stop[] =>
    riders.flatMap((r) => [
      { id: `${r.id}_PICKUP`, passengerId: r.id, kind: 'PICKUP', location: r.pickup, address: `Pickup ${r.id}` },
      { id: `${r.id}_DROPOFF`, passengerId: r.id, kind: 'DROPOFF', location: r.dropoff, address: `Dropoff ${r.id}` },
    ]);

  describe('satisfiesConstraints', () => {
    it('returns true when all pickups precede their dropoffs', () => {
      const stops: Stop[] = [
        { id: 'a_P', passengerId: 'a', kind: 'PICKUP', location: P1, address: '' },
        { id: 'b_P', passengerId: 'b', kind: 'PICKUP', location: P2, address: '' },
        { id: 'a_D', passengerId: 'a', kind: 'DROPOFF', location: D1, address: '' },
        { id: 'b_D', passengerId: 'b', kind: 'DROPOFF', location: D2, address: '' },
      ];
      expect(optimizer.satisfiesConstraints(stops)).toBe(true);
    });

    it('returns false when dropoff precedes pickup', () => {
      const stops: Stop[] = [
        { id: 'a_D', passengerId: 'a', kind: 'DROPOFF', location: D1, address: '' },
        { id: 'a_P', passengerId: 'a', kind: 'PICKUP', location: P1, address: '' },
      ];
      expect(optimizer.satisfiesConstraints(stops)).toBe(false);
    });
  });

  describe('optimize — 1 rider', () => {
    it('returns pickup then dropoff', () => {
      const stops = buildStops([{ id: 'r1', pickup: P1, dropoff: D1 }]);
      const result = optimizer.optimize(stops, ORIGIN);
      expect(result.stops).toHaveLength(2);
      expect(result.stops[0].kind).toBe('PICKUP');
      expect(result.stops[1].kind).toBe('DROPOFF');
    });

    it('returns positive totalDistanceKm', () => {
      const stops = buildStops([{ id: 'r1', pickup: P1, dropoff: D1 }]);
      const result = optimizer.optimize(stops, ORIGIN);
      expect(result.totalDistanceKm).toBeGreaterThan(0);
    });
  });

  describe('optimize — 2 riders on same corridor', () => {
    it('satisfies pickup-before-dropoff for all riders', () => {
      const stops = buildStops([
        { id: 'r1', pickup: P1, dropoff: D1 },
        { id: 'r2', pickup: P2, dropoff: D2 },
      ]);
      const result = optimizer.optimize(stops, ORIGIN);
      expect(optimizer.satisfiesConstraints(result.stops)).toBe(true);
    });

    it('picks P1→P2→D1→D2 as optimal on north-south corridor', () => {
      const stops = buildStops([
        { id: 'r1', pickup: P1, dropoff: D1 },
        { id: 'r2', pickup: P2, dropoff: D2 },
      ]);
      const result = optimizer.optimize(stops, ORIGIN);
      // On a north-south corridor, optimal order is both pickups then both dropoffs
      const kinds = result.stops.map((s) => s.kind);
      expect(kinds[0]).toBe('PICKUP');
      expect(kinds[1]).toBe('PICKUP');
    });

    it('total distance is less than naive P1→D1→P2→D2', () => {
      const stops = buildStops([
        { id: 'r1', pickup: P1, dropoff: D1 },
        { id: 'r2', pickup: P2, dropoff: D2 },
      ]);
      const optimized = optimizer.optimize(stops, ORIGIN);

      // Naive: pick up R1, drop R1, pick up R2, drop R2
      const { polylineDistanceKm } = require('../algorithms/geo-utils');
      const naiveDist = polylineDistanceKm([ORIGIN, P1, D1, P2, D2]);
      // Optimized should be ≤ naive
      expect(optimized.totalDistanceKm).toBeLessThanOrEqual(naiveDist + 0.01);
    });
  });

  describe('optimize — 3 riders', () => {
    it('satisfies constraints for 3 riders', () => {
      const stops = buildStops([
        { id: 'r1', pickup: P1, dropoff: D1 },
        { id: 'r2', pickup: P2, dropoff: D2 },
        { id: 'r3', pickup: P3, dropoff: D3 },
      ]);
      const result = optimizer.optimize(stops, ORIGIN);
      expect(result.stops).toHaveLength(6);
      expect(optimizer.satisfiesConstraints(result.stops)).toBe(true);
    });
  });

  describe('computeWaitDeltas', () => {
    it('returns non-negative wait delta for all riders', () => {
      const stops = buildStops([
        { id: 'r1', pickup: P1, dropoff: D1 },
        { id: 'r2', pickup: P2, dropoff: D2 },
      ]);
      const result = optimizer.optimize(stops, ORIGIN);
      for (const delta of Object.values(result.perRiderWaitDeltaMin)) {
        expect(delta).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
