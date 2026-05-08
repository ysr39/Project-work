import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Trip } from '../trips/entities/trip.entity';
import { TripPassenger } from '../trips/entities/trip-passenger.entity';
import { TripStop } from '../trips/entities/trip-stop.entity';
import { TripStatus, TripType, StopType, PassengerStatus } from '../../common/constants/trip-status.enum';
import { MatchingService, PoolMatchResult } from './matching.service';
import { CancellationService } from './cancellation.service';
import { FareCalculator } from './algorithms/fare-calculator';
import { haversineKm } from './algorithms/geo-utils';
import { PoolRequestDto, FareEstimateDto } from './dto/pool-request.dto';

@Injectable()
export class PoolingService {
  private readonly logger = new Logger(PoolingService.name);
  private readonly fareCalc = new FareCalculator();

  constructor(
    @InjectRepository(Trip) private readonly tripRepo: Repository<Trip>,
    @InjectRepository(TripPassenger) private readonly passengerRepo: Repository<TripPassenger>,
    @InjectRepository(TripStop) private readonly stopRepo: Repository<TripStop>,
    private readonly matchingService: MatchingService,
    private readonly cancellationService: CancellationService,
  ) {}

  /**
   * Main entry point for a ride request.
   * Creates the trip + passenger record, then runs pool matching.
   */
  async requestRide(riderId: string, dto: PoolRequestDto): Promise<PoolMatchResult> {
    const distanceKm = haversineKm(
      { lat: dto.pickupLat, lng: dto.pickupLng },
      { lat: dto.dropoffLat, lng: dto.dropoffLng },
    );

    const isPool = dto.tripType === TripType.POOL;
    const fareCalc = new FareCalculator();
    const fareEst = fareCalc.calculateEqualSplit([{
      riderId,
      pickup: { lat: dto.pickupLat, lng: dto.pickupLng },
      dropoff: { lat: dto.dropoffLat, lng: dto.dropoffLng },
      seatsRequested: dto.seatsRequested,
    }]);
    const riderFare = fareEst.riders[0];

    // Create trip skeleton
    const trip = await this.tripRepo.save(
      this.tripRepo.create({
        tripType: dto.tripType,
        status: TripStatus.SEARCHING,
        pickupAddress: dto.pickupAddress,
        pickupLat: dto.pickupLat,
        pickupLng: dto.pickupLng,
        dropoffAddress: dto.dropoffAddress,
        dropoffLat: dto.dropoffLat,
        dropoffLng: dto.dropoffLng,
        totalSeats: 3,
        seatsFilled: dto.seatsRequested,
        totalDistanceKm: +distanceKm.toFixed(2),
        baseFare: 30,
        perKmRate: 12,
        surgeMultiplier: 1.0,
        poolDiscountPct: isPool ? 35 : 0,
      }),
    );

    // Create passenger record
    const passenger = await this.passengerRepo.save(
      this.passengerRepo.create({
        tripId: trip.id,
        riderId,
        seatsRequested: dto.seatsRequested,
        pickupAddress: dto.pickupAddress,
        pickupLat: dto.pickupLat,
        pickupLng: dto.pickupLng,
        dropoffAddress: dto.dropoffAddress,
        dropoffLat: dto.dropoffLat,
        dropoffLng: dto.dropoffLng,
        fareAmount: riderFare.baseFare,
        finalFare: riderFare.finalFare,
        discountAmount: riderFare.poolDiscount,
        status: PassengerStatus.CONFIRMED,
        pickupOrder: 1,
        dropoffOrder: 1,
      }),
    );

    // Create initial stops
    await this.stopRepo.save([
      {
        tripId: trip.id, tripPassengerId: passenger.id,
        stopType: StopType.PICKUP, address: dto.pickupAddress,
        lat: dto.pickupLat, lng: dto.pickupLng, sequenceOrder: 1,
      },
      {
        tripId: trip.id, tripPassengerId: passenger.id,
        stopType: StopType.DROPOFF, address: dto.dropoffAddress,
        lat: dto.dropoffLat, lng: dto.dropoffLng, sequenceOrder: 2,
      },
    ]);

    // Run pool matching pipeline
    const matchResult = await this.matchingService.matchPool(trip, passenger);

    this.logger.log(
      `Ride request ${trip.id} → ${matchResult.type} (riders: ${matchResult.fareBreakdown.riders.length})`,
    );

    return matchResult;
  }

  /**
   * Get fare estimate before booking — no trip created.
   */
  estimateFare(dto: FareEstimateDto) {
    const distanceKm = haversineKm(
      { lat: dto.pickupLat, lng: dto.pickupLng },
      { lat: dto.dropoffLat, lng: dto.dropoffLng },
    );

    const singleRider = {
      riderId: 'estimate',
      pickup: { lat: dto.pickupLat, lng: dto.pickupLng },
      dropoff: { lat: dto.dropoffLat, lng: dto.dropoffLng },
      seatsRequested: dto.seatsRequested,
    };

    const solo = this.fareCalc.calculateEqualSplit([singleRider]);
    const soloFare = solo.riders[0].soloFare;
    const poolFare = solo.riders[0].baseFare; // after pool discount

    return {
      distanceKm: +distanceKm.toFixed(2),
      solo: {
        fare: soloFare,
        driverEarnings: +(soloFare * 0.8).toFixed(2),
      },
      pool: {
        farePerRider: poolFare,
        savingsPerRider: +(soloFare - poolFare).toFixed(2),
        savingsPct: 35,
        driverEarnings2Riders: +(poolFare * 2 * 0.8).toFixed(2),
        driverEarnings3Riders: +(poolFare * 3 * 0.8).toFixed(2),
      },
      breakdown: {
        baseFare: 30,
        distanceFare: +(distanceKm * 12).toFixed(2),
        poolDiscountPct: 35,
        platformCommissionPct: 20,
      },
    };
  }

  /**
   * Get pool trip details including all stops and passenger statuses.
   */
  async getPoolDetails(tripId: string) {
    const trip = await this.tripRepo.findOne({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('Trip not found');

    const [passengers, stops] = await Promise.all([
      this.passengerRepo.find({ where: { tripId }, order: { pickupOrder: 'ASC' } }),
      this.stopRepo.find({ where: { tripId }, order: { sequenceOrder: 'ASC' } }),
    ]);

    const totalEarnings = passengers
      .filter((p) => p.status !== PassengerStatus.CANCELLED)
      .reduce((sum, p) => sum + Number(p.finalFare), 0);

    return {
      trip,
      passengers: passengers.map((p) => ({
        id: p.id,
        riderId: p.riderId,
        status: p.status,
        seatsRequested: p.seatsRequested,
        pickupAddress: p.pickupAddress,
        dropoffAddress: p.dropoffAddress,
        fareAmount: p.fareAmount,
        finalFare: p.finalFare,
        pickupOrder: p.pickupOrder,
        dropoffOrder: p.dropoffOrder,
      })),
      stops: stops.map((s) => ({
        type: s.stopType,
        address: s.address,
        lat: s.lat,
        lng: s.lng,
        sequence: s.sequenceOrder,
        completedAt: s.completedAt,
      })),
      financials: {
        totalDriverEarnings: +totalEarnings.toFixed(2),
        platformCommission: +(totalEarnings * 0.2).toFixed(2),
        driverPayout: +(totalEarnings * 0.8).toFixed(2),
        activeRiders: passengers.filter((p) => p.status !== PassengerStatus.CANCELLED).length,
        availableSeats: trip.totalSeats - trip.seatsFilled,
      },
    };
  }

  async cancelRide(tripId: string, riderId: string, reason?: string) {
    return this.cancellationService.cancelByRider(tripId, riderId, reason);
  }

  async cancelByDriver(tripId: string, driverId: string, reason?: string) {
    return this.cancellationService.cancelByDriver(tripId, driverId, reason);
  }

  /**
   * Check whether a new rider can still join an existing pool.
   */
  async checkJoinEligibility(tripId: string, seatsRequested: number) {
    const trip = await this.tripRepo.findOne({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('Trip not found');

    const available = trip.totalSeats - trip.seatsFilled;
    return {
      eligible: trip.status === TripStatus.SEARCHING && available >= seatsRequested,
      availableSeats: available,
      tripStatus: trip.status,
      reason: trip.status !== TripStatus.SEARCHING
        ? 'Trip no longer accepting new passengers'
        : available < seatsRequested
          ? 'Not enough seats available'
          : 'Eligible to join',
    };
  }
}
