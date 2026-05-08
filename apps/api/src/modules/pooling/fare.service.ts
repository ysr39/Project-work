import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

interface FareInput {
  distanceKm: number;
  durationMin?: number;
  passengerCount: number;
  surgeMultiplier?: number;
  isPool?: boolean;
}

interface FareResult {
  baseFare: number;
  distanceFare: number;
  surgeFare: number;
  grossFare: number;
  poolDiscount: number;
  farePerRider: number;
  totalDriverEarnings: number;
  platformCommission: number;
  driverPayout: number;
}

const COMMISSION_RATE = 0.20;

@Injectable()
export class FareService {
  calculate(input: FareInput): FareResult {
    const {
      distanceKm,
      passengerCount,
      surgeMultiplier = 1,
      isPool = true,
    } = input;

    const BASE = 30;
    const PER_KM = 12;
    const POOL_DISCOUNT_PCT = 0.35;

    const baseFare = BASE;
    const distanceFare = distanceKm * PER_KM;
    const rawFare = (baseFare + distanceFare) * surgeMultiplier;
    const surgeFare = rawFare - (baseFare + distanceFare);

    const farePerRider = isPool ? rawFare * (1 - POOL_DISCOUNT_PCT) : rawFare;
    const poolDiscount = isPool ? rawFare - farePerRider : 0;
    const totalDriverEarnings = farePerRider * passengerCount;
    const platformCommission = totalDriverEarnings * COMMISSION_RATE;
    const driverPayout = totalDriverEarnings - platformCommission;

    return {
      baseFare: +baseFare.toFixed(2),
      distanceFare: +distanceFare.toFixed(2),
      surgeFare: +surgeFare.toFixed(2),
      grossFare: +rawFare.toFixed(2),
      poolDiscount: +poolDiscount.toFixed(2),
      farePerRider: +farePerRider.toFixed(2),
      totalDriverEarnings: +totalDriverEarnings.toFixed(2),
      platformCommission: +platformCommission.toFixed(2),
      driverPayout: +driverPayout.toFixed(2),
    };
  }

  splitFareForPool(baseFare: number, passengerCount: number): number {
    return +( baseFare / passengerCount).toFixed(2);
  }
}
