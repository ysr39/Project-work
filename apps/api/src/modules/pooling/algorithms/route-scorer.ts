import {
  LatLng,
  haversineKm,
  bearing,
  bearingDiff,
  perpendicularDistanceKm,
  polylineDistanceKm,
  estimateDriveMin,
} from './geo-utils';

export interface RiderRoute {
  riderId: string;
  pickup: LatLng;
  dropoff: LatLng;
}

export interface ScoredCandidate {
  tripId: string;
  score: number;             // 0 = perfect, higher = worse
  detourPct: number;         // % added to existing route distance
  timeDeltaMin: number;      // extra minutes for existing riders
  bearingScore: number;      // direction alignment [0–1], 1 = perfect
  viable: boolean;
  insertionPoints: InsertionPoint;
}

export interface InsertionPoint {
  pickupAfterIndex: number;  // insert new pickup after stop at this index
  dropoffAfterIndex: number; // insert new dropoff after stop at this index
  newRouteDistanceKm: number;
}

export interface ScoringConfig {
  maxDetourPct: number;        // default 30
  maxTimeDeltaMin: number;     // default 8
  maxCorridorWidthKm: number;  // default 2
  detourWeight: number;        // weight in composite score
  timeWeight: number;
  bearingWeight: number;
}

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  maxDetourPct: 30,
  maxTimeDeltaMin: 8,
  maxCorridorWidthKm: 2,
  detourWeight: 0.5,
  timeWeight: 0.3,
  bearingWeight: 0.2,
};

/**
 * RouteScorer — evaluates how well a new rider request fits an existing pool trip.
 *
 * For each existing pool, it:
 *  1. Finds the best insertion point for the new pickup and dropoff
 *  2. Computes the resulting detour percentage and time delta
 *  3. Scores direction alignment
 *  4. Returns a composite viability score
 */
export class RouteScorer {
  constructor(private readonly config: ScoringConfig = DEFAULT_SCORING_CONFIG) {}

  /**
   * Score a single candidate pool trip against a new rider request.
   * Returns null if basic corridor pre-filter fails (fast reject).
   */
  score(
    tripId: string,
    existingStops: LatLng[],     // ordered current stops for the pool trip
    existingRiders: RiderRoute[],
    newRider: RiderRoute,
  ): ScoredCandidate | null {
    // Pre-filter: new pickup must be near the existing route corridor
    const nearCorridor = this.isNearRouteCoridor(newRider.pickup, existingStops);
    if (!nearCorridor) return null;

    // Pre-filter: direction must be broadly compatible
    const routeBearing = bearing(existingStops[0], existingStops[existingStops.length - 1]);
    const riderBearing = bearing(newRider.pickup, newRider.dropoff);
    const bDiff = bearingDiff(routeBearing, riderBearing);
    if (bDiff > 90) return null; // going opposite direction

    const originalDistanceKm = polylineDistanceKm(existingStops);

    // Find optimal insertion for new pickup and dropoff
    const insertion = this.findBestInsertion(existingStops, newRider);
    const detourKm = insertion.newRouteDistanceKm - originalDistanceKm;
    const detourPct = (detourKm / originalDistanceKm) * 100;
    const timeDeltaMin = estimateDriveMin(detourKm);

    const viable =
      detourPct <= this.config.maxDetourPct &&
      timeDeltaMin <= this.config.maxTimeDeltaMin;

    // Bearing score: 1.0 at 0° diff, 0.0 at 90° diff
    const bearingScore = 1 - bDiff / 90;

    // Composite score (lower = better)
    const normalizedDetour = Math.min(detourPct / this.config.maxDetourPct, 1);
    const normalizedTime = Math.min(timeDeltaMin / this.config.maxTimeDeltaMin, 1);
    const score =
      normalizedDetour * this.config.detourWeight +
      normalizedTime * this.config.timeWeight +
      (1 - bearingScore) * this.config.bearingWeight;

    return {
      tripId,
      score,
      detourPct: +detourPct.toFixed(2),
      timeDeltaMin: +timeDeltaMin.toFixed(2),
      bearingScore: +bearingScore.toFixed(3),
      viable,
      insertionPoints: insertion,
    };
  }

  /**
   * Score multiple candidates and return them ranked by composite score.
   * Only viable candidates are returned.
   */
  scoreAndRank(
    candidates: Array<{ tripId: string; stops: LatLng[]; riders: RiderRoute[] }>,
    newRider: RiderRoute,
  ): ScoredCandidate[] {
    return candidates
      .map((c) => this.score(c.tripId, c.stops, c.riders, newRider))
      .filter((s): s is ScoredCandidate => s !== null && s.viable)
      .sort((a, b) => a.score - b.score);
  }

  /**
   * Find the best (pickup, dropoff) insertion into the existing stop sequence.
   *
   * Approach: try all valid (i, j) pairs where:
   *   - pickup inserted after position i (0..n)
   *   - dropoff inserted after position j where j >= i+1 (pickup must precede dropoff)
   *
   * Returns the insertion with minimum total route distance.
   */
  private findBestInsertion(existingStops: LatLng[], newRider: RiderRoute): InsertionPoint {
    const n = existingStops.length;
    let bestDistance = Infinity;
    let bestPickupIdx = 0;
    let bestDropoffIdx = 1;

    for (let pickupAfter = 0; pickupAfter < n; pickupAfter++) {
      for (let dropoffAfter = pickupAfter + 1; dropoffAfter <= n; dropoffAfter++) {
        const route = this.buildRoute(existingStops, newRider, pickupAfter, dropoffAfter);
        const dist = polylineDistanceKm(route);
        if (dist < bestDistance) {
          bestDistance = dist;
          bestPickupIdx = pickupAfter;
          bestDropoffIdx = dropoffAfter;
        }
      }
    }

    return {
      pickupAfterIndex: bestPickupIdx,
      dropoffAfterIndex: bestDropoffIdx,
      newRouteDistanceKm: +bestDistance.toFixed(3),
    };
  }

  /**
   * Build a new stop sequence by inserting pickup after pickupAfter
   * and dropoff after dropoffAfter (in the modified sequence).
   */
  private buildRoute(
    stops: LatLng[],
    newRider: RiderRoute,
    pickupAfter: number,
    dropoffAfter: number,
  ): LatLng[] {
    const withPickup = [
      ...stops.slice(0, pickupAfter + 1),
      newRider.pickup,
      ...stops.slice(pickupAfter + 1),
    ];
    // dropoffAfter is relative to the original stops array — shift by 1 for inserted pickup
    const effectiveDropoffAfter = dropoffAfter >= pickupAfter + 1 ? dropoffAfter + 1 : dropoffAfter + 1;
    return [
      ...withPickup.slice(0, effectiveDropoffAfter + 1),
      newRider.dropoff,
      ...withPickup.slice(effectiveDropoffAfter + 1),
    ];
  }

  /**
   * Check whether a point lies near any segment of the existing route.
   */
  private isNearRouteCoridor(point: LatLng, stops: LatLng[]): boolean {
    for (let i = 0; i + 1 < stops.length; i++) {
      if (
        perpendicularDistanceKm(point, stops[i], stops[i + 1]) <=
        this.config.maxCorridorWidthKm
      ) {
        return true;
      }
    }
    return false;
  }
}
