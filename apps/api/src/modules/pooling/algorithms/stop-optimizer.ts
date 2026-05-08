import { LatLng, haversineKm, polylineDistanceKm, estimateDriveMin } from './geo-utils';

export type StopKind = 'PICKUP' | 'DROPOFF';

export interface Stop {
  id: string;            // unique stop id (e.g., `${passengerId}_PICKUP`)
  passengerId: string;
  kind: StopKind;
  location: LatLng;
  address: string;
}

export interface OptimizedRoute {
  stops: Stop[];              // final ordered stops
  totalDistanceKm: number;
  estimatedDurationMin: number;
  perRiderWaitDeltaMin: Record<string, number>;  // extra wait vs direct
}

const MAX_EXTRA_WAIT_MIN = 10;   // reject orderings that add > 10 min for any one rider

/**
 * StopOptimizer — finds the optimal pickup/dropoff sequence for N ≤ 3 riders.
 *
 * Hard constraints:
 *   - PICKUP_i must appear before DROPOFF_i for every rider i
 *   - No rider waits more than MAX_EXTRA_WAIT_MIN beyond their direct route time
 *
 * Algorithm:
 *   - Generate all permutations of the stop list
 *   - Filter to only constraint-satisfying orderings
 *   - Score by total polyline distance
 *   - Return the minimum-distance valid ordering
 *
 * Complexity: O((2N)!) — trivially tractable for N ≤ 3 (max 720 permutations, ~90 valid)
 */
export class StopOptimizer {
  /**
   * Compute the optimal stop sequence for all riders combined.
   * @param stops Full list of stops across all riders (2 per rider: pickup + dropoff)
   * @param originLocation Driver's current position (start of route)
   */
  optimize(stops: Stop[], originLocation: LatLng): OptimizedRoute {
    if (stops.length === 0) {
      return { stops: [], totalDistanceKm: 0, estimatedDurationMin: 0, perRiderWaitDeltaMin: {} };
    }

    // Direct durations per rider (for wait-delta constraint)
    const directDurations = this.computeDirectDurations(stops);

    const allPermutations = this.permutations(stops);
    let bestRoute: Stop[] | null = null;
    let bestDistance = Infinity;

    for (const perm of allPermutations) {
      if (!this.satisfiesConstraints(perm)) continue;

      const waitDeltas = this.computeWaitDeltas(perm, originLocation, directDurations);
      const maxDelta = Math.max(...Object.values(waitDeltas));
      if (maxDelta > MAX_EXTRA_WAIT_MIN) continue;

      const routePoints = [originLocation, ...perm.map((s) => s.location)];
      const dist = polylineDistanceKm(routePoints);
      if (dist < bestDistance) {
        bestDistance = dist;
        bestRoute = perm;
      }
    }

    // Fallback: if no permutation satisfies wait constraint, relax and use min-distance
    if (!bestRoute) {
      bestRoute = this.fallbackOptimize(stops, originLocation);
      bestDistance = polylineDistanceKm([originLocation, ...bestRoute.map((s) => s.location)]);
    }

    return {
      stops: bestRoute,
      totalDistanceKm: +bestDistance.toFixed(3),
      estimatedDurationMin: +estimateDriveMin(bestDistance).toFixed(1),
      perRiderWaitDeltaMin: this.computeWaitDeltas(bestRoute, originLocation, directDurations),
    };
  }

  /**
   * Constraint: for every rider, their PICKUP appears before their DROPOFF.
   */
  satisfiesConstraints(stops: Stop[]): boolean {
    const pickupIndex: Record<string, number> = {};
    for (let i = 0; i < stops.length; i++) {
      const s = stops[i];
      if (s.kind === 'PICKUP') {
        pickupIndex[s.passengerId] = i;
      } else {
        const pi = pickupIndex[s.passengerId];
        if (pi === undefined || pi >= i) return false;
      }
    }
    return true;
  }

  /**
   * Calculate how much longer each rider waits vs their direct pickup→dropoff drive.
   */
  computeWaitDeltas(
    orderedStops: Stop[],
    origin: LatLng,
    directDurations: Record<string, number>,
  ): Record<string, number> {
    const deltas: Record<string, number> = {};
    let cumulativeDistKm = 0;
    let prev = origin;
    const pickupDistances: Record<string, number> = {};

    for (const stop of orderedStops) {
      cumulativeDistKm += haversineKm(prev, stop.location);
      prev = stop.location;

      if (stop.kind === 'PICKUP') {
        pickupDistances[stop.passengerId] = cumulativeDistKm;
      } else {
        const rideDistKm = cumulativeDistKm - (pickupDistances[stop.passengerId] ?? 0);
        const rideTimeMin = estimateDriveMin(rideDistKm);
        const direct = directDurations[stop.passengerId] ?? 0;
        deltas[stop.passengerId] = +(rideTimeMin - direct).toFixed(2);
      }
    }
    return deltas;
  }

  /**
   * Greedy nearest-neighbor fallback when TSP constraint relaxation needed.
   * Ensures pickup-before-dropoff constraint is always respected.
   */
  private fallbackOptimize(stops: Stop[], origin: LatLng): Stop[] {
    const remaining = [...stops];
    const result: Stop[] = [];
    const pickedUp = new Set<string>();
    let current = origin;

    while (remaining.length > 0) {
      // Only consider pickups if not yet picked up, or dropoffs if already picked up
      const eligible = remaining.filter(
        (s) => s.kind === 'PICKUP' || pickedUp.has(s.passengerId),
      );

      // Nearest eligible stop
      eligible.sort((a, b) => haversineKm(current, a.location) - haversineKm(current, b.location));
      const chosen = eligible[0];

      result.push(chosen);
      remaining.splice(remaining.indexOf(chosen), 1);
      if (chosen.kind === 'PICKUP') pickedUp.add(chosen.passengerId);
      current = chosen.location;
    }

    return result;
  }

  /** Direct drive time (pickup → dropoff) for each rider, ignoring other stops */
  private computeDirectDurations(stops: Stop[]): Record<string, number> {
    const pickups: Record<string, LatLng> = {};
    const result: Record<string, number> = {};

    for (const stop of stops) {
      if (stop.kind === 'PICKUP') {
        pickups[stop.passengerId] = stop.location;
      } else if (pickups[stop.passengerId]) {
        const dist = haversineKm(pickups[stop.passengerId], stop.location);
        result[stop.passengerId] = estimateDriveMin(dist);
      }
    }
    return result;
  }

  /** Generate all permutations of an array */
  private permutations<T>(arr: T[]): T[][] {
    if (arr.length <= 1) return [arr];
    const result: T[][] = [];
    for (let i = 0; i < arr.length; i++) {
      const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
      for (const perm of this.permutations(rest)) {
        result.push([arr[i], ...perm]);
      }
    }
    return result;
  }
}
