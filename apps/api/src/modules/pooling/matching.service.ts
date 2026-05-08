import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';

import { Trip } from '../trips/entities/trip.entity';
import { TripPassenger } from '../trips/entities/trip-passenger.entity';
import { TripStop } from '../trips/entities/trip-stop.entity';
import { DriverProfile } from '../drivers/entities/driver-profile.entity';
import { Vehicle } from '../drivers/entities/vehicle.entity';
import { TripStatus, TripType, PassengerStatus, StopType } from '../../common/constants/trip-status.enum';
import { DriverApprovalStatus } from '../../common/constants/roles.enum';

import { RouteScorer, RiderRoute } from './algorithms/route-scorer';
import { StopOptimizer, Stop } from './algorithms/stop-optimizer';
import { FareCalculator, RiderFareInput, TripFareBreakdown } from './algorithms/fare-calculator';
import { LatLng, haversineKm } from './algorithms/geo-utils';
import { RouteService } from './route.service';

const MAX_POOL_AGE_MINUTES = 5;    // don't join a pool that's been searching > 5 min
const MATCH_SEARCH_RADIUS_KM = 10;
const MAX_POOL_SEATS = 3;
const DISPATCH_TIMEOUT_MS = 15_000; // driver has 15s to accept

export interface PoolMatchResult {
  type: 'JOINED_POOL' | 'NEW_POOL';
  tripId: string;
  fareBreakdown: TripFareBreakdown;
  optimizedStops: Stop[];
  etaMinutes?: number;
}

export interface DriverMatchResult {
  driverId: string;
  vehicleId: string;
  etaMinutes: number;
}

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);
  private readonly scorer = new RouteScorer();
  private readonly optimizer = new StopOptimizer();

  constructor(
    @InjectRepository(Trip) private readonly tripRepo: Repository<Trip>,
    @InjectRepository(TripPassenger) private readonly passengerRepo: Repository<TripPassenger>,
    @InjectRepository(TripStop) private readonly stopRepo: Repository<TripStop>,
    @InjectRepository(DriverProfile) private readonly driverRepo: Repository<DriverProfile>,
    @InjectRepository(Vehicle) private readonly vehicleRepo: Repository<Vehicle>,
    private readonly routeService: RouteService,
  ) {}

  /* ═══════════════════════════════════════════════════════════════
     STAGE A: Pool matching — find or create a pool for new rider
  ═══════════════════════════════════════════════════════════════ */

  async matchPool(
    newTrip: Trip,
    newPassenger: TripPassenger,
    surgeMultiplier = 1.0,
  ): Promise<PoolMatchResult> {
    if (newTrip.tripType === TripType.SOLO) {
      return this.buildSoloResult(newTrip, newPassenger, surgeMultiplier);
    }

    // Stage 1: Spatial pre-filter — candidate pools near pickup
    const candidates = await this.findCandidatePools(newTrip, newPassenger);
    this.logger.log(`Found ${candidates.length} candidate pools for trip ${newTrip.id}`);

    if (candidates.length === 0) {
      return this.buildNewPoolResult(newTrip, newPassenger, surgeMultiplier);
    }

    // Stage 2–3: Score and rank candidates
    const newRiderRoute: RiderRoute = {
      riderId: newPassenger.riderId,
      pickup: { lat: Number(newPassenger.pickupLat), lng: Number(newPassenger.pickupLng) },
      dropoff: { lat: Number(newPassenger.dropoffLat), lng: Number(newPassenger.dropoffLng) },
    };

    const scoredCandidates = await this.scoreAllCandidates(candidates, newRiderRoute);
    if (scoredCandidates.length === 0) {
      return this.buildNewPoolResult(newTrip, newPassenger, surgeMultiplier);
    }

    // Take best candidate
    const best = scoredCandidates[0];
    const poolTrip = candidates.find((c) => c.id === best.tripId)!;

    // Stage 4: Optimize stop sequence with new rider included
    const allPassengers = await this.passengerRepo.find({ where: { tripId: poolTrip.id } });
    const stops = this.buildStopList([...allPassengers, newPassenger]);
    const driverLocation = await this.getDriverLocation(poolTrip.driverId);
    const optimized = this.optimizer.optimize(stops, driverLocation);

    // Stage 5: Recalculate fares with all riders
    const fareInputs = this.buildFareInputs([...allPassengers, newPassenger]);
    const routeResult = await this.routeService.getRoute(
      { lat: Number(poolTrip.pickupLat), lng: Number(poolTrip.pickupLng) },
      { lat: Number(poolTrip.dropoffLat), lng: Number(poolTrip.dropoffLng) },
    );
    const calculator = new FareCalculator(surgeMultiplier);
    const fareBreakdown = calculator.calculateRouteWeightedSplit(fareInputs, routeResult.distanceKm);

    // Persist the pool join
    await this.persistPoolJoin(poolTrip, newPassenger, fareBreakdown, optimized.stops);

    return {
      type: 'JOINED_POOL',
      tripId: poolTrip.id,
      fareBreakdown,
      optimizedStops: optimized.stops,
      etaMinutes: optimized.estimatedDurationMin,
    };
  }

  /* ═══════════════════════════════════════════════════════════════
     STAGE B: Driver matching — find nearest available driver
  ═══════════════════════════════════════════════════════════════ */

  async findDriver(trip: Trip): Promise<DriverMatchResult | null> {
    const pickupLat = Number(trip.pickupLat);
    const pickupLng = Number(trip.pickupLng);

    // Nearest online approved drivers (PostGIS query)
    const nearbyDrivers = await this.driverRepo
      .createQueryBuilder('d')
      .where('d.is_online = true')
      .andWhere('d.approval_status = :status', { status: DriverApprovalStatus.APPROVED })
      .andWhere('d.id NOT IN (SELECT driver_id FROM trips WHERE status IN (:...activeStatuses))', {
        activeStatuses: [TripStatus.MATCHED, TripStatus.ARRIVING, TripStatus.ARRIVED, TripStatus.IN_PROGRESS],
      })
      .orderBy(
        `(CAST(d.current_heading AS float) - :lat)^2 + (CAST(d.current_speed AS float) - :lng)^2`,
        'ASC',
      )
      .setParameter('lat', pickupLat)
      .setParameter('lng', pickupLng)
      .limit(10)
      .getMany();

    for (const driver of nearbyDrivers) {
      const vehicle = await this.vehicleRepo.findOne({
        where: { driverId: driver.id, isActive: true },
      });
      if (!vehicle) continue;
      if (vehicle.capacity < trip.seatsFilled) continue;

      // Get ETA from driver's last known location to pickup
      const driverLoc = await this.getDriverLocation(driver.id);
      const eta = await this.routeService.getEta(driverLoc, {
        lat: pickupLat,
        lng: pickupLng,
      });

      return { driverId: driver.id, vehicleId: vehicle.id, etaMinutes: eta };
    }

    return null;
  }

  /* ═══════════════════════════════════════════════════════════════
     SEAT AVAILABILITY
  ═══════════════════════════════════════════════════════════════ */

  async checkSeatAvailability(tripId: string, seatsRequested: number): Promise<boolean> {
    const trip = await this.tripRepo.findOne({ where: { id: tripId } });
    if (!trip) return false;
    return trip.seatsFilled + seatsRequested <= trip.totalSeats;
  }

  async updateSeatCount(tripId: string, delta: number): Promise<void> {
    await this.tripRepo
      .createQueryBuilder()
      .update(Trip)
      .set({ seatsFilled: () => `seats_filled + ${delta}` })
      .where('id = :id', { id: tripId })
      .execute();
  }

  /* ═══════════════════════════════════════════════════════════════
     PRIVATE HELPERS
  ═══════════════════════════════════════════════════════════════ */

  private async findCandidatePools(trip: Trip, passenger: TripPassenger): Promise<Trip[]> {
    const cutoff = new Date(Date.now() - MAX_POOL_AGE_MINUTES * 60 * 1000);

    const candidates = await this.tripRepo
      .createQueryBuilder('t')
      .where('t.status = :status', { status: TripStatus.SEARCHING })
      .andWhere('t.trip_type = :type', { type: TripType.POOL })
      .andWhere('t.id != :newTripId', { newTripId: trip.id })
      .andWhere('t.seats_filled + :seats <= t.total_seats', {
        seats: passenger.seatsRequested,
      })
      .andWhere('t.created_at >= :cutoff', { cutoff })
      .orderBy('t.created_at', 'ASC')
      .limit(20)
      .getMany();

    // Further filter by pickup proximity (haversine — DB already indexed)
    return candidates.filter((c) => {
      const dist = haversineKm(
        { lat: Number(passenger.pickupLat), lng: Number(passenger.pickupLng) },
        { lat: Number(c.pickupLat), lng: Number(c.pickupLng) },
      );
      return dist <= MATCH_SEARCH_RADIUS_KM;
    });
  }

  private async scoreAllCandidates(
    candidates: Trip[],
    newRiderRoute: RiderRoute,
  ) {
    const scoringInputs = await Promise.all(
      candidates.map(async (c) => {
        const passengers = await this.passengerRepo.find({ where: { tripId: c.id } });
        const stops = await this.stopRepo.find({
          where: { tripId: c.id },
          order: { sequenceOrder: 'ASC' },
        });
        return {
          tripId: c.id,
          stops: stops.map((s) => ({ lat: Number(s.lat), lng: Number(s.lng) })),
          riders: passengers.map((p) => ({
            riderId: p.riderId,
            pickup: { lat: Number(p.pickupLat), lng: Number(p.pickupLng) },
            dropoff: { lat: Number(p.dropoffLat), lng: Number(p.dropoffLng) },
          })),
        };
      }),
    );

    return this.scorer.scoreAndRank(scoringInputs, newRiderRoute);
  }

  private buildStopList(passengers: TripPassenger[]): Stop[] {
    const stops: Stop[] = [];
    passengers.forEach((p) => {
      stops.push({
        id: `${p.id}_PICKUP`,
        passengerId: p.id,
        kind: 'PICKUP',
        location: { lat: Number(p.pickupLat), lng: Number(p.pickupLng) },
        address: p.pickupAddress,
      });
      stops.push({
        id: `${p.id}_DROPOFF`,
        passengerId: p.id,
        kind: 'DROPOFF',
        location: { lat: Number(p.dropoffLat), lng: Number(p.dropoffLng) },
        address: p.dropoffAddress,
      });
    });
    return stops;
  }

  private buildFareInputs(passengers: TripPassenger[]): RiderFareInput[] {
    return passengers.map((p) => ({
      riderId: p.riderId,
      pickup: { lat: Number(p.pickupLat), lng: Number(p.pickupLng) },
      dropoff: { lat: Number(p.dropoffLat), lng: Number(p.dropoffLng) },
      seatsRequested: p.seatsRequested,
    }));
  }

  private async persistPoolJoin(
    poolTrip: Trip,
    newPassenger: TripPassenger,
    fareBreakdown: TripFareBreakdown,
    optimizedStops: Stop[],
  ): Promise<void> {
    // Update new passenger with pool trip id and their fare
    const newRiderFare = fareBreakdown.riders.find((r) => r.riderId === newPassenger.riderId);
    await this.passengerRepo.update(newPassenger.id, {
      tripId: poolTrip.id,
      fareAmount: newRiderFare?.baseFare ?? newPassenger.fareAmount,
      finalFare: newRiderFare?.finalFare ?? newPassenger.finalFare,
    });

    // Update existing passengers' fares (route-weighted may change them)
    for (const riderFare of fareBreakdown.riders) {
      if (riderFare.riderId === newPassenger.riderId) continue;
      const existingPassenger = await this.passengerRepo.findOne({
        where: { tripId: poolTrip.id, riderId: riderFare.riderId },
      });
      if (existingPassenger) {
        await this.passengerRepo.update(existingPassenger.id, {
          fareAmount: riderFare.baseFare,
          finalFare: riderFare.finalFare,
        });
      }
    }

    // Rebuild stops from optimized sequence
    await this.stopRepo.delete({ tripId: poolTrip.id });
    const stopEntities = optimizedStops.map((s, idx) => ({
      tripId: poolTrip.id,
      tripPassengerId: s.passengerId,
      stopType: s.kind as StopType,
      address: s.address,
      lat: s.location.lat,
      lng: s.location.lng,
      sequenceOrder: idx + 1,
    }));
    await this.stopRepo.save(stopEntities);

    // Update pool seat count
    await this.updateSeatCount(poolTrip.id, newPassenger.seatsRequested);
  }

  private async getDriverLocation(driverId: string | null): Promise<LatLng> {
    if (!driverId) return { lat: 0, lng: 0 };
    const driver = await this.driverRepo.findOne({ where: { id: driverId } });
    // In production: use Redis cached location. currentHeading/speed repurposed as lat/lng here
    // until PostGIS column is wired up properly.
    return { lat: Number(driver?.currentHeading ?? 0), lng: Number(driver?.currentSpeed ?? 0) };
  }

  private buildNewPoolResult(
    trip: Trip,
    passenger: TripPassenger,
    surgeMultiplier: number,
  ): PoolMatchResult {
    const calculator = new FareCalculator(surgeMultiplier);
    const fareBreakdown = calculator.calculateEqualSplit([
      {
        riderId: passenger.riderId,
        pickup: { lat: Number(passenger.pickupLat), lng: Number(passenger.pickupLng) },
        dropoff: { lat: Number(passenger.dropoffLat), lng: Number(passenger.dropoffLng) },
        seatsRequested: passenger.seatsRequested,
      },
    ]);
    const stops = this.buildStopList([passenger]);
    return { type: 'NEW_POOL', tripId: trip.id, fareBreakdown, optimizedStops: stops };
  }

  private buildSoloResult(
    trip: Trip,
    passenger: TripPassenger,
    surgeMultiplier: number,
  ): PoolMatchResult {
    const calculator = new FareCalculator(surgeMultiplier);
    const distKm = haversineKm(
      { lat: Number(passenger.pickupLat), lng: Number(passenger.pickupLng) },
      { lat: Number(passenger.dropoffLat), lng: Number(passenger.dropoffLng) },
    );
    const soloFare = (30 + distKm * 12) * surgeMultiplier;
    const fareBreakdown: TripFareBreakdown = {
      riders: [{
        riderId: passenger.riderId,
        distanceKm: +distKm.toFixed(2),
        soloFare: +soloFare.toFixed(2),
        poolDiscount: 0,
        baseFare: +soloFare.toFixed(2),
        promoDiscount: 0,
        finalFare: +soloFare.toFixed(2),
        savingsVsSolo: 0,
      }],
      driverGrossEarnings: +soloFare.toFixed(2),
      platformCommission: +(soloFare * 0.2).toFixed(2),
      driverNetPayout: +(soloFare * 0.8).toFixed(2),
      surgeMultiplier,
      isDriverProfitableVsSolo: true,
      driverSoloEquivalent: +(soloFare * 0.8).toFixed(2),
    };
    const stops = this.buildStopList([passenger]);
    return { type: 'NEW_POOL', tripId: trip.id, fareBreakdown, optimizedStops: stops };
  }
}
