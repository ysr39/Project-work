import { Injectable } from '@nestjs/common';

export interface CommissionBreakdown {
  grossEarnings:    number;
  commissionRate:   number;   // percent (e.g., 20 = 20%)
  commissionAmount: number;
  netEarnings:      number;
  tier:             string;
}

/**
 * Tiered commission schedule.
 * Drivers who complete more trips per month earn a lower commission rate
 * as an incentive, improving platform supply.
 *
 * | Monthly trips | Commission |
 * |---------------|------------|
 * | 0–30          | 25 %       |
 * | 31–80         | 20 %       |
 * | 81–150        | 17 %       |
 * | 151+          | 15 %       |
 */
const COMMISSION_TIERS = [
  { minTrips: 0,   maxTrips: 30,   rate: 25, label: 'Standard'  },
  { minTrips: 31,  maxTrips: 80,   rate: 20, label: 'Silver'    },
  { minTrips: 81,  maxTrips: 150,  rate: 17, label: 'Gold'      },
  { minTrips: 151, maxTrips: Infinity, rate: 15, label: 'Platinum' },
] as const;

@Injectable()
export class CommissionService {
  /** Return the applicable commission rate for a driver's monthly trip count */
  getRateForTripCount(monthlyTrips: number): { rate: number; tier: string } {
    const tier = COMMISSION_TIERS.find(
      (t) => monthlyTrips >= t.minTrips && monthlyTrips <= t.maxTrips,
    ) ?? COMMISSION_TIERS[0];
    return { rate: tier.rate, tier: tier.label };
  }

  /** Compute full commission breakdown for a given gross amount */
  compute(grossEarnings: number, monthlyTrips: number): CommissionBreakdown {
    const { rate, tier } = this.getRateForTripCount(monthlyTrips);
    const commissionAmount = +(grossEarnings * (rate / 100)).toFixed(2);
    const netEarnings      = +(grossEarnings - commissionAmount).toFixed(2);

    return {
      grossEarnings,
      commissionRate:   rate,
      commissionAmount,
      netEarnings,
      tier,
    };
  }

  /** Convert rupees to paise (Stripe requires smallest unit) */
  toPaise(rupees: number): number {
    return Math.round(rupees * 100);
  }

  /** Convert paise to rupees */
  toRupees(paise: number): number {
    return +(paise / 100).toFixed(2);
  }
}
