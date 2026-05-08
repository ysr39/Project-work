import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Server } from 'socket.io';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

import { SERVER_EVENTS, ROOMS, LocationPayload, DriverLocationPayload } from './events';
import { DriverProfile } from '../modules/drivers/entities/driver-profile.entity';

const GEO_KEY     = 'geo:drivers';
const META_PREFIX = 'driver:loc:';
const TTL_SECONDS = 30;

@Injectable()
export class LocationTrackerService {
  private readonly logger = new Logger(LocationTrackerService.name);
  private server: Server;

  constructor(
    @InjectRedis() private readonly redis: Redis,
    @InjectRepository(DriverProfile) private readonly driverRepo: Repository<DriverProfile>,
  ) {}

  setServer(server: Server) {
    this.server = server;
  }

  async updateDriverLocation(
    driverId: string,
    payload: LocationPayload,
  ): Promise<void> {
    // Store in Redis GEO index for proximity queries
    await this.redis.geoadd(GEO_KEY, payload.lng, payload.lat, driverId);

    // Store full metadata with TTL so stale drivers expire automatically
    const meta = JSON.stringify({
      lat:     payload.lat,
      lng:     payload.lng,
      heading: payload.heading,
      speed:   payload.speed,
      ts:      payload.ts,
    });
    await this.redis.setex(`${META_PREFIX}${driverId}`, TTL_SECONDS, meta);

    // Persist heading/speed to DB (fire-and-forget; location itself lives in Redis/PostGIS)
    this.driverRepo.update({ userId: driverId }, {
      currentHeading:  payload.heading,
      currentSpeed:    payload.speed,
      lastLocationAt:  new Date(payload.ts),
    }).catch((err) => this.logger.error('DB location update failed', err));

    // If driver is on an active trip, fan-out to the trip room
    if (payload.tripId) {
      this.broadcastToTrip(driverId, payload.tripId, payload);
    }

    // Always fan-out to admin ops
    const adminUpdate: DriverLocationPayload = {
      tripId:   payload.tripId ?? '',
      driverId,
      lat:      payload.lat,
      lng:      payload.lng,
      heading:  payload.heading,
      speed:    payload.speed,
    };
    this.server?.to(ROOMS.admin).emit(SERVER_EVENTS.TRIP_DRIVER_LOCATION, adminUpdate);
  }

  private broadcastToTrip(driverId: string, tripId: string, payload: LocationPayload) {
    const update: DriverLocationPayload = {
      tripId,
      driverId,
      lat:     payload.lat,
      lng:     payload.lng,
      heading: payload.heading,
      speed:   payload.speed,
    };
    this.server?.to(ROOMS.trip(tripId)).emit(SERVER_EVENTS.TRIP_DRIVER_LOCATION, update);
  }

  /** Return drivers within `radiusKm` of a point, sorted nearest-first */
  async getNearbyDriverIds(lat: number, lng: number, radiusKm: number): Promise<string[]> {
    const results = await (this.redis as any).georadius(
      GEO_KEY, lng, lat,
      radiusKm * 1000, 'm',
      'ASC', 'COUNT', 20,
    ) as string[];
    return results;
  }

  async getDriverLocation(driverId: string): Promise<{ lat: number; lng: number; heading?: number; speed?: number; ts: number } | null> {
    const raw = await this.redis.get(`${META_PREFIX}${driverId}`);
    return raw ? JSON.parse(raw) : null;
  }

  async removeDriver(driverId: string): Promise<void> {
    await Promise.all([
      this.redis.zrem(GEO_KEY, driverId),
      this.redis.del(`${META_PREFIX}${driverId}`),
    ]);
  }
}
