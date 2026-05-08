import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Trip } from './entities/trip.entity';
import { TripPassenger } from './entities/trip-passenger.entity';
import { TripStop } from './entities/trip-stop.entity';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripStatusDto } from './dto/update-trip-status.dto';
import { TripFsmService } from './trip-fsm.service';
import { TripStatus, TripType, PassengerStatus, StopType } from '../../common/constants/trip-status.enum';
import { PaginationDto, paginate } from '../../common/dto/pagination.dto';

const BASE_FARE = 30;
const PER_KM_RATE = 12;
const POOL_DISCOUNT = 35;
const MAX_POOL_SEATS = 3;

@Injectable()
export class TripsService {
  constructor(
    @InjectRepository(Trip) private readonly tripRepo: Repository<Trip>,
    @InjectRepository(TripPassenger) private readonly passengerRepo: Repository<TripPassenger>,
    @InjectRepository(TripStop) private readonly stopRepo: Repository<TripStop>,
    private readonly fsm: TripFsmService,
  ) {}

  async estimateFare(dto: CreateTripDto) {
    const distanceKm = this.haversineKm(
      dto.pickupLat, dto.pickupLng, dto.dropoffLat, dto.dropoffLng,
    );
    const solo = BASE_FARE + distanceKm * PER_KM_RATE;
    const poolPerRider = solo * (1 - POOL_DISCOUNT / 100);

    return {
      distanceKm: +distanceKm.toFixed(2),
      soloFare: +solo.toFixed(2),
      poolFarePerRider: +poolPerRider.toFixed(2),
      poolSavings: +(solo - poolPerRider).toFixed(2),
      poolDiscountPct: POOL_DISCOUNT,
    };
  }

  async create(riderId: string, dto: CreateTripDto) {
    const distanceKm = this.haversineKm(
      dto.pickupLat, dto.pickupLng, dto.dropoffLat, dto.dropoffLng,
    );

    const soloFare = BASE_FARE + distanceKm * PER_KM_RATE;
    const isPool = dto.tripType === TripType.POOL;
    const farePerRider = isPool ? soloFare * (1 - POOL_DISCOUNT / 100) : soloFare;

    const trip = this.tripRepo.create({
      tripType: dto.tripType,
      status: TripStatus.SEARCHING,
      pickupAddress: dto.pickupAddress,
      pickupLat: dto.pickupLat,
      pickupLng: dto.pickupLng,
      dropoffAddress: dto.dropoffAddress,
      dropoffLat: dto.dropoffLat,
      dropoffLng: dto.dropoffLng,
      totalSeats: MAX_POOL_SEATS,
      seatsFilled: dto.seatsRequested,
      baseFare: BASE_FARE,
      perKmRate: PER_KM_RATE,
      poolDiscountPct: isPool ? POOL_DISCOUNT : 0,
      totalDistanceKm: +distanceKm.toFixed(2),
    });
    const savedTrip = await this.tripRepo.save(trip);

    const passenger = this.passengerRepo.create({
      tripId: savedTrip.id,
      riderId,
      seatsRequested: dto.seatsRequested,
      pickupAddress: dto.pickupAddress,
      pickupLat: dto.pickupLat,
      pickupLng: dto.pickupLng,
      dropoffAddress: dto.dropoffAddress,
      dropoffLat: dto.dropoffLat,
      dropoffLng: dto.dropoffLng,
      fareAmount: +farePerRider.toFixed(2),
      finalFare: +farePerRider.toFixed(2),
      pickupOrder: 1,
      dropoffOrder: 1,
    });
    await this.passengerRepo.save(passenger);

    await this.buildStops(savedTrip.id, [passenger]);

    return this.findById(savedTrip.id);
  }

  async findById(id: string): Promise<Trip> {
    const trip = await this.tripRepo.findOne({
      where: { id },
      relations: ['driver', 'vehicle', 'passengers', 'stops'],
    });
    if (!trip) throw new NotFoundException('Trip not found');
    return trip;
  }

  async updateStatus(tripId: string, actorId: string, dto: UpdateTripStatusDto) {
    const trip = await this.findById(tripId);
    this.fsm.assertTransition(trip.status, dto.status);

    const timestampField = this.fsm.getTimestampField(dto.status);
    const update: Partial<Trip> = { status: dto.status };
    if (timestampField) update[timestampField] = new Date();
    if (dto.status === TripStatus.CANCELLED) {
      update.cancelledBy = actorId;
      update.cancellationReason = dto.cancellationReason;
    }

    await this.tripRepo.update(tripId, update);
    return this.findById(tripId);
  }

  async cancel(tripId: string, riderId: string, reason?: string) {
    const trip = await this.findById(tripId);
    const passenger = trip.passengers?.find((p) => p.riderId === riderId);
    if (!passenger) throw new ForbiddenException('Not a passenger on this trip');

    if ([TripStatus.COMPLETED, TripStatus.CANCELLED, TripStatus.IN_PROGRESS].includes(trip.status)) {
      throw new BadRequestException('Trip cannot be cancelled at this stage');
    }

    this.fsm.assertTransition(trip.status, TripStatus.CANCELLED);
    await this.tripRepo.update(tripId, {
      status: TripStatus.CANCELLED,
      cancelledBy: riderId,
      cancellationReason: reason,
      cancelledAt: new Date(),
    });
    return { message: 'Trip cancelled' };
  }

  async getRiderHistory(riderId: string, dto: PaginationDto) {
    const [data, total] = await this.passengerRepo.findAndCount({
      where: { riderId },
      relations: ['trip'],
      skip: dto.skip,
      take: dto.limit,
      order: { createdAt: 'DESC' },
    });
    return paginate(data, total, dto);
  }

  async getDriverHistory(driverId: string, dto: PaginationDto) {
    const [data, total] = await this.tripRepo.findAndCount({
      where: { driverId },
      skip: dto.skip,
      take: dto.limit,
      order: { createdAt: 'DESC' },
    });
    return paginate(data, total, dto);
  }

  private async buildStops(tripId: string, passengers: TripPassenger[]) {
    const stops: Partial<TripStop>[] = [];
    let seq = 1;
    passengers.forEach((p) => {
      stops.push({
        tripId,
        tripPassengerId: p.id,
        stopType: StopType.PICKUP,
        address: p.pickupAddress,
        lat: p.pickupLat,
        lng: p.pickupLng,
        sequenceOrder: seq++,
      });
    });
    passengers.forEach((p) => {
      stops.push({
        tripId,
        tripPassengerId: p.id,
        stopType: StopType.DROPOFF,
        address: p.dropoffAddress,
        lat: p.dropoffLat,
        lng: p.dropoffLng,
        sequenceOrder: seq++,
      });
    });
    await this.stopRepo.save(stops);
  }

  private haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private toRad(deg: number) {
    return (deg * Math.PI) / 180;
  }
}
