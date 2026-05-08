import { LatLng, haversineKm } from './geo-utils';

/* ─── Constants ─────────────────────────────────────────────────────────── */

const BASE_FARE = 30;           // flat pickup fee (currency units)
const PER_KM_RATE = 12;         // per km rate
const PER_MIN_RATE = 0;         // per minute rate (0 = distance-only model)
const MINIMUM_FARE = 40;        // floor per rider
const POOL_DISCOUNT_PCT = 35;   // % off solo fare for pool riders
const PLATFORM_COMMISSION = 20; // % platform takes from driver gross
const CANCELLATION_AFTER_MATCH = 30;  // flat fee after driver is matched
const CANCELLATION_AFTER_ARRIVE = 50; // flat fee after driver arrives

/* ─── Types ──────────────────────────────────────────────────────────────── */

export interface RiderFareInput {
  riderId: string;
  pickup: LatLng;
  dropoff: LatLng;
  seatsRequested: number;
}

export interface RiderFareResult {
  riderId: string;
  distanceKm: number;
  soloFare: number;             // what they'd pay solo
  poolDiscount: number;         // discount applied
  baseFare: number;             // after discount, before promo
  promoDiscount: number;        // if promo applied
  finalFare: number;            // what rider pays
  savingsVsSolo: number;
}

export interface TripFareBreakdown {
  riders: RiderFareResult[];
  driverGrossEarnings: number;  // sum of all rider fares
  platformCommission: number;
  driverNetPayout: number;
  surgeMultiplier: number;
  isDriverProfitableVsSolo: boolean;
  driverSoloEquivalent: number; // what driver would earn on a solo trip (same route)
}

export interface CancellationFeeResult {
  fee: number;
  reason: string;
  isRefundable: boolean;
}

export type TripPhase = 'SEARCHING' | 'MATCHED' | 'ARRIVING' | 'ARRIVED' | 'IN_PROGRESS';

/* ─── Calculator ─────────────────────────────────────────────────────────── */

/**
 * FareCalculator — pure fare calculation with no I/O.
 *
 * Supports two fare split models:
 *  1. Equal split: each rider pays the same pool fare (simple, default)
 *  2. Route-weighted split: fare proportional to each rider's distance segment
 *     (fairer for riders with very different trip lengths in the same pool)
 */
export class FareCalculator {
  constructor(private readonly surgeMultiplier = 1.0) {}

  /**
   * Calculate per-rider fares using equal-split model.
   * All riders in the pool pay the same discounted fare.
   */
  calculateEqualSplit(riders: RiderFareInput[]): TripFareBreakdown {
    const results: RiderFareResult[] = riders.map((r) =>
      this.calcRiderFare(r, false),
    );
    return this.buildBreakdown(results, riders);
  }

  /**
   * Calculate per-rider fares using route-weighted split model.
   *
   * Each rider's fare is proportional to their route distance contribution.
   * The total must equal what the driver needs to earn to be profitable.
   *
   * Formula:
   *   weight_i   = riderDistKm_i / totalDistKm
   *   adjustedFare_i = poolGross × weight_i
   *   (subject to MINIMUM_FARE floor)
   */
  calculateRouteWeightedSplit(
    riders: RiderFareInput[],
    totalRouteDistanceKm: number,
  ): TripFareBreakdown {
    // Get the longest-rider's solo fare as the gross pool target
    const longestRider = riders.reduce((max, r) =>
      haversineKm(r.pickup, r.dropoff) > haversineKm(max.pickup, max.dropoff) ? r : max,
    );
    const grossTarget = this.soloFare(haversineKm(longestRider.pickup, longestRider.dropoff));

    const riderDistances = riders.map((r) => ({
      riderId: r.riderId,
      distKm: haversineKm(r.pickup, r.dropoff),
    }));

    const totalRiderDistKm = riderDistances.reduce((s, r) => s + r.distKm, 0);

    const results: RiderFareResult[] = riders.map((r, idx) => {
      const distKm = riderDistances[idx].distKm;
      const weight = totalRiderDistKm > 0 ? distKm / totalRiderDistKm : 1 / riders.length;
      const soloF = this.soloFare(distKm);
      const weightedPoolFare = Math.max(grossTarget * weight * 0.65, MINIMUM_FARE);
      const discount = soloF - weightedPoolFare;

      return {
        riderId: r.riderId,
        distanceKm: +distKm.toFixed(2),
        soloFare: +soloF.toFixed(2),
        poolDiscount: +Math.max(discount, 0).toFixed(2),
        baseFare: +weightedPoolFare.toFixed(2),
        promoDiscount: 0,
        finalFare: +weightedPoolFare.toFixed(2),
        savingsVsSolo: +Math.max(discount, 0).toFixed(2),
      };
    });

    return this.buildBreakdown(results, riders);
  }

  /**
   * Apply a promo code discount to an already-calculated fare.
   * Mutates the fareResult in place and returns the modified copy.
   */
  applyPromo(
    fareResult: RiderFareResult,
    discountType: 'PERCENTAGE' | 'FIXED',
    discountValue: number,
    maxDiscountCap?: number,
  ): RiderFareResult {
    let promoDiscount =
      discountType === 'PERCENTAGE'
        ? (fareResult.baseFare * discountValue) / 100
        : discountValue;

    if (maxDiscountCap) promoDiscount = Math.min(promoDiscount, maxDiscountCap);
    promoDiscount = Math.min(promoDiscount, fareResult.baseFare - MINIMUM_FARE);
    promoDiscount = Math.max(promoDiscount, 0);

    const finalFare = fareResult.baseFare - promoDiscount;
    return {
      ...fareResult,
      promoDiscount: +promoDiscount.toFixed(2),
      finalFare: +finalFare.toFixed(2),
      savingsVsSolo: +(fareResult.soloFare - finalFare).toFixed(2),
    };
  }

  /**
   * Compute cancellation fee based on what phase the trip is in when cancelled.
   *
   * Policy:
   *   SEARCHING  → no fee (driver not yet assigned)
   *   MATCHED    → flat ₹30 fee (driver en route, wasted time)
   *   ARRIVING   → flat ₹30 fee
   *   ARRIVED    → flat ₹50 fee (driver physically waited)
   *   IN_PROGRESS → no cancellation allowed (trip already started)
   */
  getCancellationFee(phase: TripPhase, isRiderCancelling: boolean): CancellationFeeResult {
    if (!isRiderCancelling) {
      // Driver cancels — rider pays nothing, driver may be penalised separately
      return { fee: 0, reason: 'Driver cancelled — no charge to rider', isRefundable: true };
    }

    switch (phase) {
      case 'SEARCHING':
        return { fee: 0, reason: 'Cancelled before driver match — no charge', isRefundable: true };

      case 'MATCHED':
      case 'ARRIVING':
        return {
          fee: CANCELLATION_AFTER_MATCH,
          reason: `Driver was on the way — cancellation fee of ₹${CANCELLATION_AFTER_MATCH}`,
          isRefundable: false,
        };

      case 'ARRIVED':
        return {
          fee: CANCELLATION_AFTER_ARRIVE,
          reason: `Driver arrived and waited — cancellation fee of ₹${CANCELLATION_AFTER_ARRIVE}`,
          isRefundable: false,
        };

      case 'IN_PROGRESS':
        return {
          fee: 0,
          reason: 'Trip already started — cancellation not allowed',
          isRefundable: false,
        };
    }
  }

  /**
   * Recalculate fares after a pool rider cancels mid-SEARCHING.
   * The remaining riders may get a slightly adjusted fare.
   * Driver earnings should not decrease below solo-equivalent.
   */
  recalculateAfterCancellation(
    remainingRiders: RiderFareInput[],
    totalRouteDistanceKm: number,
  ): TripFareBreakdown {
    if (remainingRiders.length === 1) {
      // Only one rider left — convert to solo fare
      const rider = remainingRiders[0];
      const distKm = haversineKm(rider.pickup, rider.dropoff);
      const soloF = this.soloFare(distKm);
      const result: RiderFareResult = {
        riderId: rider.riderId,
        distanceKm: +distKm.toFixed(2),
        soloFare: +soloF.toFixed(2),
        poolDiscount: 0,
        baseFare: +soloF.toFixed(2),
        promoDiscount: 0,
        finalFare: +soloF.toFixed(2),
        savingsVsSolo: 0,
      };
      return this.buildBreakdown([result], remainingRiders);
    }
    return this.calculateRouteWeightedSplit(remainingRiders, totalRouteDistanceKm);
  }

  /* ─── Private helpers ─────────────────────────────────────────────────── */

  private soloFare(distKm: number): number {
    return Math.max((BASE_FARE + distKm * PER_KM_RATE) * this.surgeMultiplier, MINIMUM_FARE);
  }

  private calcRiderFare(r: RiderFareInput, weighted: boolean): RiderFareResult {
    const distKm = haversineKm(r.pickup, r.dropoff);
    const soloF = this.soloFare(distKm);
    const baseFare = Math.max(soloF * (1 - POOL_DISCOUNT_PCT / 100), MINIMUM_FARE);
    const discount = soloF - baseFare;

    return {
      riderId: r.riderId,
      distanceKm: +distKm.toFixed(2),
      soloFare: +soloF.toFixed(2),
      poolDiscount: +discount.toFixed(2),
      baseFare: +baseFare.toFixed(2),
      promoDiscount: 0,
      finalFare: +baseFare.toFixed(2),
      savingsVsSolo: +discount.toFixed(2),
    };
  }

  private buildBreakdown(results: RiderFareResult[], riders: RiderFareInput[]): TripFareBreakdown {
    const driverGross = results.reduce((s, r) => s + r.finalFare, 0);
    const commission = driverGross * (PLATFORM_COMMISSION / 100);
    const netPayout = driverGross - commission;

    // Solo equivalent: what driver would earn on the longest single-rider route
    const longestDistKm = Math.max(...riders.map((r) => haversineKm(r.pickup, r.dropoff)));
    const soloEq = this.soloFare(longestDistKm) * (1 - PLATFORM_COMMISSION / 100);

    return {
      riders: results,
      driverGrossEarnings: +driverGross.toFixed(2),
      platformCommission: +commission.toFixed(2),
      driverNetPayout: +netPayout.toFixed(2),
      surgeMultiplier: this.surgeMultiplier,
      isDriverProfitableVsSolo: netPayout >= soloEq,
      driverSoloEquivalent: +soloEq.toFixed(2),
    };
  }
}
