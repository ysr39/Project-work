import { BadRequestException } from '@nestjs/common';
import { TripFsmService } from '../trip-fsm.service';
import { TripStatus } from '../../../common/constants/trip-status.enum';

describe('TripFsmService', () => {
  let fsm: TripFsmService;

  beforeEach(() => {
    fsm = new TripFsmService();
  });

  // ── isValidTransition ─────────────────────────────────────────────────────
  describe('isValidTransition', () => {
    const valid: [TripStatus, TripStatus][] = [
      [TripStatus.SEARCHING,   TripStatus.MATCHED],
      [TripStatus.SEARCHING,   TripStatus.CANCELLED],
      [TripStatus.MATCHED,     TripStatus.ARRIVING],
      [TripStatus.MATCHED,     TripStatus.CANCELLED],
      [TripStatus.ARRIVING,    TripStatus.ARRIVED],
      [TripStatus.ARRIVING,    TripStatus.CANCELLED],
      [TripStatus.ARRIVED,     TripStatus.IN_PROGRESS],
      [TripStatus.ARRIVED,     TripStatus.CANCELLED],
      [TripStatus.IN_PROGRESS, TripStatus.COMPLETED],
    ];

    test.each(valid)('%s → %s is allowed', (from, to) => {
      expect(fsm.isValidTransition(from, to)).toBe(true);
    });

    const invalid: [TripStatus, TripStatus][] = [
      [TripStatus.SEARCHING,   TripStatus.IN_PROGRESS],
      [TripStatus.SEARCHING,   TripStatus.COMPLETED],
      [TripStatus.MATCHED,     TripStatus.COMPLETED],
      [TripStatus.IN_PROGRESS, TripStatus.CANCELLED],
      [TripStatus.COMPLETED,   TripStatus.CANCELLED],
      [TripStatus.COMPLETED,   TripStatus.SEARCHING],
      [TripStatus.CANCELLED,   TripStatus.SEARCHING],
      [TripStatus.CANCELLED,   TripStatus.MATCHED],
    ];

    test.each(invalid)('%s → %s is rejected', (from, to) => {
      expect(fsm.isValidTransition(from, to)).toBe(false);
    });
  });

  // ── assertTransition ──────────────────────────────────────────────────────
  describe('assertTransition', () => {
    it('does not throw for a valid transition', () => {
      expect(() => fsm.assertTransition(TripStatus.SEARCHING, TripStatus.MATCHED)).not.toThrow();
    });

    it('throws BadRequestException for an invalid transition', () => {
      expect(() => fsm.assertTransition(TripStatus.COMPLETED, TripStatus.CANCELLED))
        .toThrow(BadRequestException);
    });

    it('includes descriptive error message', () => {
      try {
        fsm.assertTransition(TripStatus.COMPLETED, TripStatus.SEARCHING);
      } catch (e: any) {
        expect(e.message).toContain(TripStatus.COMPLETED);
        expect(e.message).toContain(TripStatus.SEARCHING);
      }
    });
  });

  // ── getTimestampField ─────────────────────────────────────────────────────
  describe('getTimestampField', () => {
    it.each([
      [TripStatus.MATCHED,     'matchedAt'],
      [TripStatus.ARRIVED,     'driverArrivedAt'],
      [TripStatus.IN_PROGRESS, 'startedAt'],
      [TripStatus.COMPLETED,   'completedAt'],
      [TripStatus.CANCELLED,   'cancelledAt'],
    ])('%s maps to %s', (status, field) => {
      expect(fsm.getTimestampField(status)).toBe(field);
    });

    it('returns null for statuses without a dedicated timestamp', () => {
      expect(fsm.getTimestampField(TripStatus.SEARCHING)).toBeNull();
      expect(fsm.getTimestampField(TripStatus.ARRIVING)).toBeNull();
    });
  });
});
