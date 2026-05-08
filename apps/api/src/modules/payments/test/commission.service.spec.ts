import { CommissionService } from '../commission.service';

describe('CommissionService', () => {
  let service: CommissionService;

  beforeEach(() => {
    service = new CommissionService();
  });

  // ── getRateForTripCount ────────────────────────────────────────────────────
  describe('getRateForTripCount', () => {
    it.each([
      [0,   25, 'Standard'],
      [1,   25, 'Standard'],
      [30,  25, 'Standard'],
      [31,  20, 'Silver'],
      [80,  20, 'Silver'],
      [81,  17, 'Gold'],
      [150, 17, 'Gold'],
      [151, 15, 'Platinum'],
      [500, 15, 'Platinum'],
    ])('%i trips → %i%% (%s)', (trips, rate, tier) => {
      const result = service.getRateForTripCount(trips);
      expect(result.rate).toBe(rate);
      expect(result.tier).toBe(tier);
    });
  });

  // ── compute ───────────────────────────────────────────────────────────────
  describe('compute', () => {
    it('computes Standard tier for a new driver (0 trips)', () => {
      const result = service.compute(1000, 0);

      expect(result.grossEarnings).toBe(1000);
      expect(result.commissionRate).toBe(25);
      expect(result.commissionAmount).toBe(250);
      expect(result.netEarnings).toBe(750);
      expect(result.tier).toBe('Standard');
    });

    it('computes Platinum tier for a top driver (200 trips)', () => {
      const result = service.compute(1000, 200);

      expect(result.commissionRate).toBe(15);
      expect(result.commissionAmount).toBe(150);
      expect(result.netEarnings).toBe(850);
      expect(result.tier).toBe('Platinum');
    });

    it('gross = commission + net (no rounding leakage)', () => {
      // Use an amount that requires rounding
      const result = service.compute(333.33, 50);
      expect(result.commissionAmount + result.netEarnings).toBeCloseTo(result.grossEarnings, 2);
    });

    it('handles zero gross earnings', () => {
      const result = service.compute(0, 100);
      expect(result.commissionAmount).toBe(0);
      expect(result.netEarnings).toBe(0);
    });
  });

  // ── toPaise / toRupees ────────────────────────────────────────────────────
  describe('toPaise', () => {
    it('converts rupees to paise correctly', () => {
      expect(service.toPaise(100)).toBe(10000);
      expect(service.toPaise(0.5)).toBe(50);
      expect(service.toPaise(99.99)).toBe(9999);
    });
  });

  describe('toRupees', () => {
    it('converts paise to rupees correctly', () => {
      expect(service.toRupees(10000)).toBe(100);
      expect(service.toRupees(50)).toBe(0.5);
      expect(service.toRupees(9999)).toBe(99.99);
    });

    it('toPaise and toRupees are inverse operations', () => {
      const original = 750.50;
      expect(service.toRupees(service.toPaise(original))).toBe(original);
    });
  });
});
