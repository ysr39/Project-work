import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Trip } from '../trips/entities/trip.entity';
import { TripPassenger } from '../trips/entities/trip-passenger.entity';
import { TripStop } from '../trips/entities/trip-stop.entity';
import { DriverProfile } from '../drivers/entities/driver-profile.entity';
import { Vehicle } from '../drivers/entities/vehicle.entity';
import { TripStatus, TripType, PassengerStatus, StopType } from '../../common/constants/trip-status.enum';
import { DriverApprovalStatus } from '../../common/constants/roles.enum';
import { RouteService } from './route.service';
import { FareService } from './fare.service';

const MAX_DETOUR_PCT = 30;      // Allow up to 30% route deviation for pool
const SEARCH_RADIUS_KM = 5;
const MAX_POOL_SEATS = 3;
const MATCH_TIMEOUT_MS = 60_000;

interface MatchResult {
  driverId: string;
  vehicleId: string;
  eta: number;
}

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  constructor(
    @InjectRepository(Trip) private readonly tripRepo: Repository<Trip>,
    @InjectRepository(TripPassenger) private readonly passengerRepo: Repository<TripPassenger>,
    @InjectRepository(TripStop) private readonly stopRepo: Repository<TripStop>,
    @InjectRepository(DriverProfile) private readonly driverRepo: Repository<DriverProfile>,
    @InjectRepository(Vehicle) private readonly vehicleRepo: Repository<Vehicle>,
    private readonly routeService: RouteService,
    private readonly fareService: FareService,
  ) {}

  async findMatch(trip: Trip): Promise<MatchResult | null> {
    // 1. Find online, approved drivers within radius using PostGIS
    const nearbyDrivers = await this.driverRepo
      .createQueryBuilder('d')
      .addSelect(
        `ST_Distance(
          ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
          ST_SetSRID(ST_MakePoint(
            CAST(d.current_location_lng AS float),
            CAST(d.current_location_lat AS float)
          ), 4326)::geography
        ) / 1000`,
        'distance_km',
      )
      .where('d.is_online = true')
      .andWhere('d.approval_status = :status', { status: DriverApprovalStatus.APPROVED })
      .setParameter('lat', trip.pickupLat)
      .setParameter('lng', trip.pickupLng)
      .orderBy('distance_km', 'ASC')
      .limit(10)
      .getMany();

    for (const driver of nearbyDrivers) {
      const vehicle = await this.vehicleRepo.findOne({
        where: { driverId: driver.id, isActive: true },
      });
      if (!vehicle) continue;

      const eta = await this.routeService.getEta(
        { lat: driver.lastLocationAt ? Number(driver.currentHeading) : trip.pickupLat, lng: Number(driver.currentSpeed) },
        { lat: trip.pickupLat, lng: trip.pickupLng },
      );

      return { driverId: driver.id, vehicleId: vehicle.id, eta };
    }

    return null;
  }

  async tryPoolJoin(newTrip: Trip): Promise<Trip | null> {
    if (newTrip.tripType !== TripType.POOL) return null;

    // Find SEARCHING pool trips with available seats near same corridor
    const candidates = await this.tripRepo
      .createQueryBuilder('t')
      .where('t.status = :status', { status: TripStatus.SEARCHING })
      .andWhere('t.trip_type = :type', { type: TripType.POOL })
      .andWhere('t.seats_filled + :seats <= t.total_seats', { seats: 1 })
      .andWhere(
        `SQRT(POW(t.pickup_lat - :lat, 2) + POW(t.pickup_lng - :lng, 2)) < 0.05`,
        { lat: newTrip.pickupLat, lng: newTrip.pickupLng },
      )
      .andWhere('t.id != :id', { id: newTrip.id })
      .orderBy('t.created_at', 'ASC')
      .limit(5)
      .getMany();

    for (const candidate of candidates) {
      const detourOk = await this.isDetourAcceptable(candidate, newTrip);
      if (detourOk) return candidate;
    }

    return null;
  }

  private async isDetourAcceptable(existingTrip: Trip, newTrip: Trip): Promise<boolean> {
    const original = await this.routeService.getRoute(
      { lat: existingTrip.pickupLat, lng: existingTrip.pickupLng },
      { lat: existingTrip.dropoffLat, lng: existingTrip.dropoffLng },
    );

    const withDetour = await this.routeService.getRoute(
      { lat: existingTrip.pickupLat, lng: existingTrip.pickupLng },
      { lat: existingTrip.dropoffLat, lng: existingTrip.dropoffLng },
      [{ lat: newTrip.pickupLat, lng: newTrip.pickupLng }],
    );

    const detourPct = ((withDetour.distanceKm - original.distanceKm) / original.distanceKm) * 100;
    return detourPct <= MAX_DETOUR_PCT;
  }

  async addPassengerToPool(poolTrip: Trip, newPassenger: TripPassenger): Promise<void> {
    const existingPassengers = await this.passengerRepo.find({
      where: { tripId: poolTrip.id, status: PassengerStatus.CONFIRMED },
      order: { pickupOrder: 'ASC' },
    });

    const newPickupOrder = existingPassengers.length + 1;
    const newDropoffOrder = existingPassengers.length + 1;

    await this.passengerRepo.update(newPassenger.id, {
      tripId: poolTrip.id,
      pickupOrder: newPickupOrder,
      dropoffOrder: newDropoffOrder,
    });

    await this.tripRepo.update(poolTrip.id, {
      seatsFilled: () => 'seats_filled + 1',
    });

    // Rebuild stops
    const allPassengers = [...existingPassengers, { ...newPassenger, pickupOrder: newPickupOrder }];
    await this.stopRepo.delete({ tripId: poolTrip.id });

    const stops = [];
    allPassengers.sort((a, b) => a.pickupOrder - b.pickupOrder).forEach((p, i) => {
      stops.push({ tripId: poolTrip.id, tripPassengerId: p.id, stopType: StopType.PICKUP, address: p.pickupAddress, lat: p.pickupLat, lng: p.pickupLng, sequenceOrder: i + 1 });
    });
    allPassengers.sort((a, b) => a.dropoffOrder - b.dropoffOrder).forEach((p, i) => {
      stops.push({ tripId: poolTrip.id, tripPassengerId: p.id, stopType: StopType.DROPOFF, address: p.dropoffAddress, lat: p.dropoffLat, lng: p.dropoffLng, sequenceOrder: allPassengers.length + i + 1 });
    });
    await this.stopRepo.save(stops);
  }
}
