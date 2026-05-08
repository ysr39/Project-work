import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';

import { TripsService } from '../trips.service';
import { TripFsmService } from '../trip-fsm.service';
import { Trip } from '../entities/trip.entity';
import { TripPassenger } from '../entities/trip-passenger.entity';
import { TripStop } from '../entities/trip-stop.entity';
import { TripStatus, TripType, PassengerStatus } from '../../../common/constants/trip-status.enum';

const mockRepo = () => ({
  findOne:      jest.fn(),
  findAndCount: jest.fn(),
  find:         jest.fn(),
  save:         jest.fn(),
  create:       jest.fn(),
  update:       jest.fn(),
});

const makeTripDto = (overrides = {}) => ({
  tripType:        TripType.POOL,
  pickupAddress:   'MG Road, Bangalore',
  pickupLat:       12.9716,
  pickupLng:       77.5946,
  dropoffAddress:  'Whitefield, Bangalore',
  dropoffLat:      12.9698,
  dropoffLng:      77.7500,
  seatsRequested:  1,
  ...overrides,
});

describe('TripsService', () => {
  let service:    TripsService;
  let tripRepo:   ReturnType<typeof mockRepo>;
  let passengerRepo: ReturnType<typeof mockRepo>;
  let stopRepo:   ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TripsService,
        TripFsmService,
        { provide: getRepositoryToken(Trip),          useFactory: mockRepo },
        { provide: getRepositoryToken(TripPassenger), useFactory: mockRepo },
        { provide: getRepositoryToken(TripStop),      useFactory: mockRepo },
      ],
    }).compile();

    service      = module.get(TripsService);
    tripRepo     = module.get(getRepositoryToken(Trip));
    passengerRepo = module.get(getRepositoryToken(TripPassenger));
    stopRepo     = module.get(getRepositoryToken(TripStop));
  });

  afterEach(() => jest.clearAllMocks());

  // ── estimateFare ──────────────────────────────────────────────────────────
  describe('estimateFare', () => {
    it('returns fare breakdown with pool discount', async () => {
      const dto = makeTripDto();
      const result = await service.estimateFare(dto);

      expect(result.distanceKm).toBeGreaterThan(0);
      expect(result.poolFarePerRider).toBeLessThan(result.soloFare);
      expect(result.poolSavings).toBeCloseTo(result.soloFare - result.poolFarePerRider, 1);
      expect(result.poolDiscountPct).toBe(35);
    });

    it('calculates a short trip (≈ 1 km) correctly', async () => {
      // Two points ~1 km apart
      const dto = makeTripDto({ dropoffLat: 12.9806, dropoffLng: 77.5946 });
      const result = await service.estimateFare(dto);

      expect(result.distanceKm).toBeGreaterThan(0.5);
      expect(result.distanceKm).toBeLessThan(2);
      expect(result.soloFare).toBeGreaterThan(30);   // at minimum base fare
    });
  });

  // ── create ────────────────────────────────────────────────────────────────
  describe('create', () => {
    it('creates trip + passenger record and returns both', async () => {
      const dto = makeTripDto();
      const savedTrip = { id: 'trip-1', ...dto, status: TripStatus.SEARCHING };
      const savedPassenger = { id: 'pax-1', tripId: 'trip-1', riderId: 'rider-1' };

      tripRepo.create.mockReturnValue(savedTrip);
      tripRepo.save.mockResolvedValue(savedTrip);
      passengerRepo.create.mockReturnValue(savedPassenger);
      passengerRepo.save.mockResolvedValue(savedPassenger);
      stopRepo.create.mockReturnValue({});
      stopRepo.save.mockResolvedValue({});

      const result = await service.create('rider-1', dto);

      expect(tripRepo.save).toHaveBeenCalledTimes(1);
      expect(passengerRepo.save).toHaveBeenCalledTimes(1);
      expect(result).toHaveProperty('trip');
      expect(result).toHaveProperty('passenger');
    });
  });

  // ── findById ──────────────────────────────────────────────────────────────
  describe('findById', () => {
    it('throws NotFoundException when trip does not exist', async () => {
      tripRepo.findOne.mockResolvedValue(null);
      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('returns the trip when found', async () => {
      const trip = { id: 'trip-1', status: TripStatus.SEARCHING } as Trip;
      tripRepo.findOne.mockResolvedValue(trip);
      await expect(service.findById('trip-1')).resolves.toEqual(trip);
    });
  });

  // ── updateStatus ──────────────────────────────────────────────────────────
  describe('updateStatus', () => {
    const buildTrip = (status: TripStatus, driverId = 'driver-1') =>
      ({ id: 'trip-1', status, driverId } as Trip);

    it('updates status and sets matched timestamp', async () => {
      tripRepo.findOne.mockResolvedValue(buildTrip(TripStatus.SEARCHING));
      tripRepo.update.mockResolvedValue({});
      const updated = buildTrip(TripStatus.MATCHED);
      tripRepo.findOne.mockResolvedValueOnce(buildTrip(TripStatus.SEARCHING))
                      .mockResolvedValueOnce(updated);

      const result = await service.updateStatus('trip-1', 'driver-1', {
        status: TripStatus.MATCHED,
      });

      expect(tripRepo.update).toHaveBeenCalledWith(
        'trip-1',
        expect.objectContaining({ status: TripStatus.MATCHED, matchedAt: expect.any(Date) }),
      );
    });

    it('rejects an invalid FSM transition', async () => {
      tripRepo.findOne.mockResolvedValue(buildTrip(TripStatus.COMPLETED));
      await expect(
        service.updateStatus('trip-1', 'driver-1', { status: TripStatus.CANCELLED }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects cancellation by an unauthorized user', async () => {
      tripRepo.findOne.mockResolvedValue(buildTrip(TripStatus.SEARCHING, 'driver-99'));
      // A random user (neither driver nor rider of this trip) cannot cancel
      passengerRepo.findOne.mockResolvedValue(null);
      await expect(
        service.updateStatus('trip-1', 'intruder-id', { status: TripStatus.CANCELLED }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
