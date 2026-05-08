import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { Logger, UseFilters, UsePipes, ValidationPipe } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

import {
  CLIENT_EVENTS,
  SERVER_EVENTS,
  ROOMS,
  LocationPayload,
  TripAcceptPayload,
  TripDeclinePayload,
  TripArrivedPayload,
  TripPickupPayload,
  TripDropoffPayload,
  TripJoinRoomPayload,
} from './events';

import { LocationTrackerService }        from './location-tracker.service';
import { TripEventsService }             from './trip-events.service';
import { NotificationDispatcherService } from './notification-dispatcher.service';

import { DriverProfile } from '../modules/drivers/entities/driver-profile.entity';
import { Trip }          from '../modules/trips/entities/trip.entity';
import { TripPassenger } from '../modules/trips/entities/trip-passenger.entity';
import { TripStatus, PassengerStatus } from '../common/constants/trip-status.enum';
import { UserRole }      from '../common/constants/roles.enum';

const HEARTBEAT_TTL_SEC = 60;
const ONLINE_KEY = (id: string) => `ws:online:${id}`;

@WebSocketGateway({
  cors:            { origin: process.env.CORS_ORIGIN ?? '*', credentials: true },
  namespace:       '/',
  transports:      ['websocket', 'polling'],
  pingTimeout:     20_000,
  pingInterval:    10_000,
})
export class AppGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(AppGateway.name);

  constructor(
    private readonly jwtService:          JwtService,
    private readonly config:              ConfigService,
    private readonly locationTracker:     LocationTrackerService,
    private readonly tripEvents:          TripEventsService,
    private readonly notificationDispatcher: NotificationDispatcherService,
    @InjectRedis() private readonly redis: Redis,
    @InjectRepository(DriverProfile) private readonly driverRepo: Repository<DriverProfile>,
    @InjectRepository(Trip)          private readonly tripRepo:   Repository<Trip>,
    @InjectRepository(TripPassenger) private readonly passengerRepo: Repository<TripPassenger>,
  ) {}

  afterInit(server: Server) {
    this.locationTracker.setServer(server);
    this.tripEvents.setServer(server);
    this.notificationDispatcher.setServer(server);
    this.logger.log('WebSocket gateway initialised');
  }

  /* ─── Connection lifecycle ─────────────────────────────────────────────── */

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ??
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) throw new WsException('Missing token');

      const payload = this.jwtService.verify<{ sub: string; role: string; phone: string }>(
        token,
        { secret: this.config.get<string>('jwt.secret') },
      );

      client.data.user = payload;

      // Join personal room
      const personalRoom =
        payload.role === UserRole.DRIVER
          ? ROOMS.driver(payload.sub)
          : ROOMS.rider(payload.sub);
      client.join(personalRoom);

      if (payload.role === UserRole.ADMIN) client.join(ROOMS.admin);

      // Heartbeat presence marker
      await this.redis.setex(ONLINE_KEY(payload.sub), HEARTBEAT_TTL_SEC, '1');

      // Mark driver online in DB
      if (payload.role === UserRole.DRIVER) {
        await this.driverRepo.update({ userId: payload.sub }, { isOnline: true });
      }

      this.logger.log(`[WS] connect  ${payload.sub} (${payload.role})`);
    } catch {
      client.emit(SERVER_EVENTS.ERROR, { code: 'AUTH_FAILED', message: 'Authentication failed' });
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket) {
    const user = client.data?.user;
    if (!user) return;

    await this.redis.del(ONLINE_KEY(user.sub));

    if (user.role === UserRole.DRIVER) {
      await this.driverRepo.update({ userId: user.sub }, { isOnline: false });
      await this.locationTracker.removeDriver(user.sub);
    }

    this.logger.log(`[WS] disconnect ${user.sub} (${user.role})`);
  }

  /* ─── Driver → Server: location ────────────────────────────────────────── */

  @SubscribeMessage(CLIENT_EVENTS.DRIVER_LOCATION)
  async handleDriverLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: LocationPayload,
  ) {
    const user = client.data?.user;
    if (!user || user.role !== UserRole.DRIVER) return;

    // Refresh heartbeat
    await this.redis.setex(ONLINE_KEY(user.sub), HEARTBEAT_TTL_SEC, '1');

    await this.locationTracker.updateDriverLocation(user.sub, payload);
  }

  /* ─── Driver → Server: online/offline toggles ──────────────────────────── */

  @SubscribeMessage(CLIENT_EVENTS.DRIVER_ONLINE)
  async handleDriverOnline(@ConnectedSocket() client: Socket) {
    const user = client.data?.user;
    if (!user || user.role !== UserRole.DRIVER) return;
    await this.driverRepo.update({ userId: user.sub }, { isOnline: true });
    await this.redis.setex(ONLINE_KEY(user.sub), HEARTBEAT_TTL_SEC, '1');
  }

  @SubscribeMessage(CLIENT_EVENTS.DRIVER_OFFLINE)
  async handleDriverOffline(@ConnectedSocket() client: Socket) {
    const user = client.data?.user;
    if (!user || user.role !== UserRole.DRIVER) return;
    await this.driverRepo.update({ userId: user.sub }, { isOnline: false });
    await this.redis.del(ONLINE_KEY(user.sub));
    await this.locationTracker.removeDriver(user.sub);
  }

  /* ─── Driver → Server: trip accept / decline ────────────────────────────── */

  @SubscribeMessage(CLIENT_EVENTS.TRIP_ACCEPT)
  async handleTripAccept(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: TripAcceptPayload,
  ) {
    const user = client.data?.user;
    if (!user || user.role !== UserRole.DRIVER) return;

    const trip = await this.tripRepo.findOne({ where: { id: payload.tripId } });
    if (!trip || trip.status !== TripStatus.SEARCHING) return;

    await this.tripRepo.update(payload.tripId, {
      status:    TripStatus.MATCHED,
      driverId:  user.sub,
      matchedAt: new Date(),
    });

    // Join driver socket to trip room
    client.join(ROOMS.trip(payload.tripId));

    // Bring all rider sockets into the trip room
    const passengers = await this.passengerRepo.find({ where: { tripId: payload.tripId } });
    for (const p of passengers) {
      this.tripEvents.joinPersonalRoomToTrip(ROOMS.rider(p.riderId), payload.tripId);
    }

    // Resolve driver profile for matched payload
    const driverProfile = await this.driverRepo.findOne({
      where:    { userId: user.sub },
      relations: ['vehicle', 'user'],
    });

    this.tripEvents.broadcastTripMatched({
      tripId:       payload.tripId,
      driverId:     user.sub,
      driverName:   (driverProfile as any)?.user?.fullName ?? '',
      vehicleMake:  driverProfile?.vehicles?.[0]?.make ?? '',
      vehicleModel: driverProfile?.vehicles?.[0]?.model ?? '',
      plateNumber:  driverProfile?.vehicles?.[0]?.plateNumber ?? '',
      etaMinutes:   5,   // TODO: calculate from live location
      driverLat:    0,
      driverLng:    0,
    });
  }

  @SubscribeMessage(CLIENT_EVENTS.TRIP_DECLINE)
  async handleTripDecline(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: TripDeclinePayload,
  ) {
    // In the full flow, MatchingService retries with the next nearest driver.
    // The gateway just acknowledges; orchestration stays in the service layer.
    this.logger.debug(`Driver ${client.data?.user?.sub} declined trip ${payload.tripId}`);
  }

  /* ─── Driver → Server: arrived / pickup / dropoff ───────────────────────── */

  @SubscribeMessage(CLIENT_EVENTS.TRIP_ARRIVED)
  async handleDriverArrived(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: TripArrivedPayload,
  ) {
    const user = client.data?.user;
    if (!user || user.role !== UserRole.DRIVER) return;

    await this.tripRepo.update(payload.tripId, {
      status:          TripStatus.ARRIVED,
      driverArrivedAt: new Date(),
    });

    const arrivedAt = new Date().toISOString();
    this.tripEvents.broadcastDriverArrived(payload.tripId, arrivedAt);
    this.tripEvents.broadcastStatusChange({
      tripId:    payload.tripId,
      status:    TripStatus.ARRIVED,
      timestamp: arrivedAt,
    });
  }

  @SubscribeMessage(CLIENT_EVENTS.TRIP_PICKUP)
  async handlePickup(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: TripPickupPayload,
  ) {
    const user = client.data?.user;
    if (!user || user.role !== UserRole.DRIVER) return;

    // Mark this passenger as picked up
    await this.passengerRepo.update(
      { id: payload.passengerId },
      { status: PassengerStatus.PICKED_UP, pickedUpAt: new Date() },
    );

    // Transition trip to IN_PROGRESS on first pickup
    const trip = await this.tripRepo.findOne({ where: { id: payload.tripId } });
    if (trip?.status === TripStatus.ARRIVED) {
      const now = new Date().toISOString();
      await this.tripRepo.update(payload.tripId, {
        status:    TripStatus.IN_PROGRESS,
        startedAt: new Date(),
      });
      this.tripEvents.broadcastStatusChange({
        tripId:    payload.tripId,
        status:    TripStatus.IN_PROGRESS,
        timestamp: now,
        meta:      { passengerId: payload.passengerId },
      });
    }
  }

  @SubscribeMessage(CLIENT_EVENTS.TRIP_DROPOFF)
  async handleDropoff(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: TripDropoffPayload,
  ) {
    const user = client.data?.user;
    if (!user || user.role !== UserRole.DRIVER) return;

    await this.passengerRepo.update(
      { id: payload.passengerId },
      { status: PassengerStatus.DROPPED_OFF, droppedOffAt: new Date() },
    );

    if (payload.isFinalStop) {
      const now = new Date().toISOString();
      const trip = await this.tripRepo.findOne({ where: { id: payload.tripId } });

      await this.tripRepo.update(payload.tripId, {
        status:      TripStatus.COMPLETED,
        completedAt: new Date(),
      });

      this.tripEvents.broadcastTripCompleted({
        tripId:      payload.tripId,
        completedAt: now,
        fareAmount:  Number(trip?.totalFare ?? 0),
        distanceKm:  Number(trip?.totalDistanceKm ?? 0),
        durationMin: Number(trip?.totalDurationMin ?? 0),
      });
    } else {
      this.tripEvents.broadcastStatusChange({
        tripId:    payload.tripId,
        status:    TripStatus.IN_PROGRESS,
        timestamp: new Date().toISOString(),
        meta:      { passengerId: payload.passengerId, dropped: true },
      });
    }
  }

  /* ─── Rider → Server: join trip room ───────────────────────────────────── */

  @SubscribeMessage(CLIENT_EVENTS.TRIP_JOIN_ROOM)
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: TripJoinRoomPayload,
  ) {
    const user = client.data?.user;
    if (!user) return;

    // Verify the rider belongs to this trip before joining
    const passenger = await this.passengerRepo.findOne({
      where: { tripId: payload.tripId, riderId: user.sub },
    });
    if (!passenger) {
      client.emit(SERVER_EVENTS.ERROR, { code: 'FORBIDDEN', message: 'Not a trip participant' });
      return;
    }

    client.join(ROOMS.trip(payload.tripId));
  }

  /* ─── Public API used by service layer ──────────────────────────────────── */

  /** Called by PoolingService / MatchingService to push a new trip request */
  sendTripRequestToDriver(driverId: string, payload: Parameters<TripEventsService['sendTripRequest']>[1]) {
    this.tripEvents.sendTripRequest(driverId, payload);
  }

  /** Called when no driver was found after exhausting retries */
  sendNoDriverFound(riderId: string, tripId: string) {
    this.tripEvents.sendNoDriver(riderId, tripId);
  }
}
