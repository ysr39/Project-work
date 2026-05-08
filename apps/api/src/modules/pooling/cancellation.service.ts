import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Trip } from '../trips/entities/trip.entity';
import { TripPassenger } from '../trips/entities/trip-passenger.entity';
import { TripStop } from '../trips/entities/trip-stop.entity';
import { Payment } from '../payments/entities/payment.entity';
import { TripStatus, PassengerStatus, PaymentStatus } from '../../common/constants/trip-status.enum';
import { FareCalculator, TripPhase } from './algorithms/fare-calculator';
import { MatchingService } from './matching.service';
import { StopOptimizer } from './algorithms/stop-optimizer';

export interface CancellationResult {
  tripCancelled: boolean;         // was the whole trip cancelled, or just this rider removed?
  cancellationFee: number;
  refundAmount: number;
  message: string;
  remainingRiders: number;
}

@Injectable()
export class CancellationService {
  private readonly logger = new Logger(CancellationService.name);
  private readonly fareCalc = new FareCalculator();
  private readonly optimizer = new StopOptimizer();

  constructor(
    @InjectRepository(Trip) private readonly tripRepo: Repository<Trip>,
    @InjectRepository(TripPassenger) private readonly passengerRepo: Repository<TripPassenger>,
    @InjectRepository(TripStop) private readonly stopRepo: Repository<TripStop>,
    @InjectRepository(Payment) private readonly paymentRepo: Repository<Payment>,
    private readonly matchingService: MatchingService,
  ) {}

  /**
   * Handle rider-initiated cancellation.
   *
   * Logic:
   *   1. Validate the rider is on this trip and can cancel
   *   2. Calculate cancellation fee based on trip phase
   *   3. If solo trip or last rider → cancel entire trip
   *   4. If pool with other riders → remove this rider, reoptimize stops
   *   5. Trigger refund minus cancellation fee
   */
  async cancelByRider(
    tripId: string,
    riderId: string,
    reason?: string,
  ): Promise<CancellationResult> {
    const trip = await this.tripRepo.findOne({
      where: { id: tripId },
      relations: ['passengers', 'stops'],
    });
    if (!trip) throw new NotFoundException('Trip not found');

    const passenger = trip.passengers?.find((p) => p.riderId === riderId);
    if (!passenger) throw new NotFoundException('You are not a passenger on this trip');

    if (passenger.status === PassengerStatus.DROPPED_OFF) {
      throw new BadRequestException('Trip already completed for this rider');
    }

    if (trip.status === TripStatus.IN_PROGRESS && passenger.status === PassengerStatus.PICKED_UP) {
      throw new BadRequestException('Cannot cancel a trip already in progress');
    }

    const phase = this.toPhase(trip.status);
    const feeResult = this.fareCalc.getCancellationFee(phase, true);

    const payment = await this.paymentRepo.findOne({
      where: { tripPassengerId: passenger.id },
    });

    const refundAmount = payment?.status === PaymentStatus.CAPTURED
      ? Math.max(Number(payment.amount) - feeResult.fee, 0)
      : 0;

    // Mark this passenger cancelled
    await this.passengerRepo.update(passenger.id, {
      status: PassengerStatus.CANCELLED,
    });

    const activePassengers = (trip.passengers ?? []).filter(
      (p) => p.riderId !== riderId && p.status !== PassengerStatus.CANCELLED,
    );

    if (activePassengers.length === 0) {
      // Last rider — cancel entire trip
      await this.tripRepo.update(tripId, {
        status: TripStatus.CANCELLED,
        cancelledBy: riderId,
        cancellationReason: reason ?? 'Rider cancelled',
        cancellationFee: feeResult.fee,
        cancelledAt: new Date(),
      });

      this.logger.log(`Trip ${tripId} cancelled — no riders remaining`);
      return {
        tripCancelled: true,
        cancellationFee: feeResult.fee,
        refundAmount,
        message: feeResult.reason,
        remainingRiders: 0,
      };
    }

    // Pool with other riders — remove this rider and reoptimize
    await this.matchingService.updateSeatCount(tripId, -passenger.seatsRequested);
    await this.reoptimizeStops(tripId, activePassengers);
    await this.recalculateFares(tripId, activePassengers);

    this.logger.log(`Rider ${riderId} removed from pool ${tripId}. Remaining: ${activePassengers.length}`);

    return {
      tripCancelled: false,
      cancellationFee: feeResult.fee,
      refundAmount,
      message: feeResult.reason,
      remainingRiders: activePassengers.length,
    };
  }

  /**
   * Handle driver-initiated cancellation.
   * Riders get a full refund. Trip returns to SEARCHING if riders remain,
   * or is cancelled if no riders found a new driver within timeout.
   */
  async cancelByDriver(tripId: string, driverId: string, reason?: string): Promise<void> {
    const trip = await this.tripRepo.findOne({
      where: { id: tripId, driverId },
      relations: ['passengers'],
    });
    if (!trip) throw new NotFoundException('Trip not found or not assigned to this driver');

    if ([TripStatus.COMPLETED, TripStatus.CANCELLED].includes(trip.status)) {
      throw new BadRequestException('Trip is already finalized');
    }

    // Return trip to SEARCHING — riders keep their seats, driver is unassigned
    await this.tripRepo.update(tripId, {
      status: TripStatus.SEARCHING,
      driverId: null,
      vehicleId: null,
      matchedAt: null,
    });

    // Full refund for all captured payments (driver's fault)
    const passengers = trip.passengers ?? [];
    for (const p of passengers) {
      if (p.status === PassengerStatus.CANCELLED) continue;
      const payment = await this.paymentRepo.findOne({ where: { tripPassengerId: p.id } });
      if (payment?.status === PaymentStatus.CAPTURED) {
        await this.paymentRepo.update(payment.id, {
          status: PaymentStatus.REFUNDED,
          refundAmount: payment.amount,
          refundReason: 'Driver cancelled',
          refundedAt: new Date(),
        });
      }
    }

    this.logger.log(`Driver ${driverId} cancelled trip ${tripId}. Trip returned to SEARCHING.`);
  }

  /* ─── Private helpers ───────────────────────────────────────────── */

  private async reoptimizeStops(tripId: string, activePassengers: TripPassenger[]): Promise<void> {
    const stops = activePassengers.flatMap((p) => [
      {
        id: `${p.id}_PICKUP`,
        passengerId: p.id,
        kind: 'PICKUP' as const,
        location: { lat: Number(p.pickupLat), lng: Number(p.pickupLng) },
        address: p.pickupAddress,
      },
      {
        id: `${p.id}_DROPOFF`,
        passengerId: p.id,
        kind: 'DROPOFF' as const,
        location: { lat: Number(p.dropoffLat), lng: Number(p.dropoffLng) },
        address: p.dropoffAddress,
      },
    ]);

    // Use first remaining pickup as origin approximation
    const origin = { lat: Number(activePassengers[0].pickupLat), lng: Number(activePassengers[0].pickupLng) };
    const optimized = this.optimizer.optimize(stops, origin);

    await this.stopRepo.delete({ tripId });
    const newStops = optimized.stops.map((s, idx) => ({
      tripId,
      tripPassengerId: s.passengerId,
      stopType: s.kind,
      address: s.address,
      lat: s.location.lat,
      lng: s.location.lng,
      sequenceOrder: idx + 1,
    }));
    await this.stopRepo.save(newStops);
  }

  private async recalculateFares(tripId: string, activePassengers: TripPassenger[]): Promise<void> {
    const fareInputs = activePassengers.map((p) => ({
      riderId: p.riderId,
      pickup: { lat: Number(p.pickupLat), lng: Number(p.pickupLng) },
      dropoff: { lat: Number(p.dropoffLat), lng: Number(p.dropoffLng) },
      seatsRequested: p.seatsRequested,
    }));

    const trip = await this.tripRepo.findOne({ where: { id: tripId } });
    const breakdown = this.fareCalc.recalculateAfterCancellation(
      fareInputs,
      Number(trip?.totalDistanceKm ?? 10),
    );

    for (const riderFare of breakdown.riders) {
      const p = activePassengers.find((ap) => ap.riderId === riderFare.riderId);
      if (p) {
        await this.passengerRepo.update(p.id, {
          fareAmount: riderFare.baseFare,
          finalFare: riderFare.finalFare,
        });
      }
    }
  }

  private toPhase(status: TripStatus): TripPhase {
    const map: Record<TripStatus, TripPhase> = {
      [TripStatus.SEARCHING]: 'SEARCHING',
      [TripStatus.MATCHED]: 'MATCHED',
      [TripStatus.ARRIVING]: 'ARRIVING',
      [TripStatus.ARRIVED]: 'ARRIVED',
      [TripStatus.IN_PROGRESS]: 'IN_PROGRESS',
      [TripStatus.COMPLETED]: 'IN_PROGRESS', // shouldn't happen
      [TripStatus.CANCELLED]: 'SEARCHING',   // shouldn't happen
    };
    return map[status];
  }
}
