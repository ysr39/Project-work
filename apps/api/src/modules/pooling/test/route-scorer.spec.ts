import { RouteScorer, DEFAULT_SCORING_CONFIG } from '../algorithms/route-scorer';
import { LatLng } from '../algorithms/geo-utils';

describe('RouteScorer', () => {
  const scorer = new RouteScorer(DEFAULT_SCORING_CONFIG);

  // Straight north-south corridor
  const START:  LatLng = { lat: 40.70, lng: -74.00 };
  const END:    LatLng = { lat: 40.80, lng: -74.00 };
  const MID:    LatLng = { lat: 40.75, lng: -74.00 };

  const existingRider = {
    riderId: 'existing',
    pickup: START,
    dropoff: END,
  };

  describe('score — viable match', () => {
    const newRider = {
      riderId: 'new',
      pickup: { lat: 40.72, lng: -74.00 },   // on the same corridor
      dropoff: { lat: 40.77, lng: -74.00 },
    };

    it('returns a scored candidate (not null)', () => {
      const result = scorer.score('trip-1', [START, END], [existingRider], newRider);
      expect(result).not.toBeNull();
    });

    it('marks as viable when detour is within threshold', () => {
      const result = scorer.score('trip-1', [START, END], [existingRider], newRider);
      expect(result!.viable).toBe(true);
    });

    it('score is in [0, 1]', () => {
      const result = scorer.score('trip-1', [START, END], [existingRider], newRider);
      expect(result!.score).toBeGreaterThanOrEqual(0);
      expect(result!.score).toBeLessThanOrEqual(1);
    });

    it('detourPct is non-negative', () => {
      const result = scorer.score('trip-1', [START, END], [existingRider], newRider);
      expect(result!.detourPct).toBeGreaterThanOrEqual(0);
    });
  });

  describe('score — non-viable: opposite direction', () => {
    const oppositeRider = {
      riderId: 'opposite',
      pickup: { lat: 40.79, lng: -74.00 },
      dropoff: { lat: 40.71, lng: -74.00 }, // going south, route goes north
    };

    it('returns null for opposite direction rider', () => {
      const result = scorer.score('trip-1', [START, END], [existingRider], oppositeRider);
      expect(result).toBeNull();
    });
  });

  describe('score — non-viable: far away', () => {
    const farRider = {
      riderId: 'far',
      pickup: { lat: 41.50, lng: -74.00 }, // ~88 km away
      dropoff: { lat: 41.60, lng: -74.00 },
    };

    it('returns null for rider far from corridor', () => {
      const result = scorer.score('trip-1', [START, END], [existingRider], farRider);
      expect(result).toBeNull();
    });
  });

  describe('score — excessive detour', () => {
    const highDetourRider = {
      riderId: 'detour',
      pickup: { lat: 40.72, lng: -74.00 },
      dropoff: { lat: 40.72, lng: -73.00 }, // goes far east (big detour)
    };

    it('marks as not viable when detour exceeds threshold', () => {
      const result = scorer.score('trip-1', [START, END], [existingRider], highDetourRider);
      if (result) {
        expect(result.viable).toBe(false);
      } else {
        expect(result).toBeNull(); // also acceptable
      }
    });
  });

  describe('scoreAndRank', () => {
    const candidates = [
      {
        tripId: 'trip-a',
        stops: [START, END],
        riders: [existingRider],
      },
      {
        tripId: 'trip-b',
        stops: [{ lat: 40.70, lng: -74.01 }, { lat: 40.80, lng: -74.01 }],
        riders: [{ riderId: 'r2', pickup: { lat: 40.70, lng: -74.01 }, dropoff: { lat: 40.80, lng: -74.01 } }],
      },
    ];

    const newRider = {
      riderId: 'new',
      pickup: { lat: 40.72, lng: -74.00 },
      dropoff: { lat: 40.77, lng: -74.00 },
    };

    it('returns only viable candidates', () => {
      const results = scorer.scoreAndRank(candidates, newRider);
      results.forEach((r) => expect(r.viable).toBe(true));
    });

    it('results are sorted by score ascending (best first)', () => {
      const results = scorer.scoreAndRank(candidates, newRider);
      for (let i = 0; i + 1 < results.length; i++) {
        expect(results[i].score).toBeLessThanOrEqual(results[i + 1].score);
      }
    });
  });
});
