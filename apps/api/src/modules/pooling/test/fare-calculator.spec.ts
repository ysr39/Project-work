import { FareCalculator } from '../algorithms/fare-calculator';
import { LatLng } from '../algorithms/geo-utils';

describe('FareCalculator', () => {
  const calc = new FareCalculator(1.0);

  // 10 km route (solo fare = 30 + 10*12 = 150)
  const PICKUP: LatLng   = { lat: 40.70, lng: -74.00 };
  const DROPOFF: LatLng  = { lat: 40.789, lng: -74.00 }; // ~10 km north

  const singleRider = {
    riderId: 'r1',
    pickup: PICKUP,
    dropoff: DROPOFF,
    seatsRequested: 1,
  };

  describe('calculateEqualSplit — 1 rider', () => {
    it('solo fare is at least base+distance', () => {
      const result = calc.calculateEqualSplit([singleRider]);
      expect(result.riders[0].soloFare).toBeGreaterThan(30);
    });

    it('pool fare is less than solo fare', () => {
      const result = calc.calculateEqualSplit([singleRider]);
      expect(result.riders[0].finalFare).toBeLessThan(result.riders[0].soloFare);
    });

    it('pool discount is 35%', () => {
      const result = calc.calculateEqualSplit([singleRider]);
      const r = result.riders[0];
      const expectedFare = r.soloFare * 0.65;
      expect(r.baseFare).toBeCloseTo(Math.max(expectedFare, 40), 0);
    });

    it('commission + payout equals gross earnings', () => {
      const result = calc.calculateEqualSplit([singleRider]);
      expect(result.platformCommission + result.driverNetPayout).toBeCloseTo(
        result.driverGrossEarnings, 1,
      );
    });
  });

  describe('calculateEqualSplit — 2 riders (same route)', () => {
    const rider2 = { ...singleRider, riderId: 'r2' };

    it('each rider pays pool fare', () => {
      const result = calc.calculateEqualSplit([singleRider, rider2]);
      expect(result.riders[0].finalFare).toBeCloseTo(result.riders[1].finalFare, 1);
    });

    it('driver earns more than solo equivalent', () => {
      const result = calc.calculateEqualSplit([singleRider, rider2]);
      expect(result.isDriverProfitableVsSolo).toBe(true);
    });

    it('each rider saves vs solo', () => {
      const result = calc.calculateEqualSplit([singleRider, rider2]);
      result.riders.forEach((r) => expect(r.savingsVsSolo).toBeGreaterThanOrEqual(0));
    });
  });

  describe('calculateRouteWeightedSplit', () => {
    const shortRider = {
      riderId: 'r_short',
      pickup: { lat: 40.70, lng: -74.00 },
      dropoff: { lat: 40.73, lng: -74.00 }, // ~3 km
      seatsRequested: 1,
    };
    const longRider = {
      riderId: 'r_long',
      pickup: { lat: 40.71, lng: -74.00 },
      dropoff: { lat: 40.80, lng: -74.00 }, // ~10 km
      seatsRequested: 1,
    };

    it('long-distance rider pays more than short-distance rider', () => {
      const result = calc.calculateRouteWeightedSplit([shortRider, longRider], 12);
      const shortFare = result.riders.find((r) => r.riderId === 'r_short')!.finalFare;
      const longFare = result.riders.find((r) => r.riderId === 'r_long')!.finalFare;
      expect(longFare).toBeGreaterThan(shortFare);
    });

    it('all fares are above minimum floor', () => {
      const result = calc.calculateRouteWeightedSplit([shortRider, longRider], 12);
      result.riders.forEach((r) => expect(r.finalFare).toBeGreaterThanOrEqual(40));
    });
  });

  describe('applyPromo', () => {
    it('applies percentage discount correctly', () => {
      const fareResult = calc.calculateEqualSplit([singleRider]).riders[0];
      const withPromo = calc.applyPromo(fareResult, 'PERCENTAGE', 10);
      expect(withPromo.finalFare).toBeCloseTo(fareResult.baseFare * 0.9, 1);
      expect(withPromo.promoDiscount).toBeGreaterThan(0);
    });

    it('applies fixed discount correctly', () => {
      const fareResult = calc.calculateEqualSplit([singleRider]).riders[0];
      const withPromo = calc.applyPromo(fareResult, 'FIXED', 20);
      expect(withPromo.finalFare).toBeCloseTo(fareResult.baseFare - 20, 1);
    });

    it('never lets fare drop below minimum floor', () => {
      const fareResult = calc.calculateEqualSplit([singleRider]).riders[0];
      const withPromo = calc.applyPromo(fareResult, 'FIXED', 10000);
      expect(withPromo.finalFare).toBeGreaterThanOrEqual(40);
    });

    it('respects maxDiscountCap', () => {
      const fareResult = calc.calculateEqualSplit([singleRider]).riders[0];
      const withPromo = calc.applyPromo(fareResult, 'PERCENTAGE', 50, 10);
      expect(withPromo.promoDiscount).toBeLessThanOrEqual(10);
    });
  });

  describe('getCancellationFee', () => {
    it('charges nothing before match', () => {
      const result = calc.getCancellationFee('SEARCHING', true);
      expect(result.fee).toBe(0);
      expect(result.isRefundable).toBe(true);
    });

    it('charges flat fee after match', () => {
      const result = calc.getCancellationFee('MATCHED', true);
      expect(result.fee).toBeGreaterThan(0);
      expect(result.isRefundable).toBe(false);
    });

    it('charges higher fee after driver arrived', () => {
      const matchedFee = calc.getCancellationFee('MATCHED', true).fee;
      const arrivedFee = calc.getCancellationFee('ARRIVED', true).fee;
      expect(arrivedFee).toBeGreaterThanOrEqual(matchedFee);
    });

    it('charges nothing when driver cancels', () => {
      const result = calc.getCancellationFee('MATCHED', false);
      expect(result.fee).toBe(0);
      expect(result.isRefundable).toBe(true);
    });
  });

  describe('recalculateAfterCancellation', () => {
    it('converts to solo fare when only 1 rider remains', () => {
      const result = calc.recalculateAfterCancellation([singleRider], 10);
      const r = result.riders[0];
      expect(r.poolDiscount).toBe(0);
      expect(r.savingsVsSolo).toBe(0);
      expect(r.finalFare).toBeCloseTo(r.soloFare, 1);
    });

    it('still applies pool pricing for 2 remaining riders', () => {
      const rider2 = { ...singleRider, riderId: 'r2' };
      const result = calc.recalculateAfterCancellation([singleRider, rider2], 10);
      result.riders.forEach((r) => {
        expect(r.finalFare).toBeLessThan(r.soloFare);
      });
    });
  });

  describe('surge pricing', () => {
    it('applies surge multiplier to all fares', () => {
      const normalCalc = new FareCalculator(1.0);
      const surgeCalc = new FareCalculator(1.5);
      const normal = normalCalc.calculateEqualSplit([singleRider]);
      const surge = surgeCalc.calculateEqualSplit([singleRider]);
      expect(surge.riders[0].soloFare).toBeGreaterThan(normal.riders[0].soloFare);
    });
  });
});
