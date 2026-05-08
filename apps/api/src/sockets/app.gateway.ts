import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { UseGuards, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { SOCKET_EVENTS, SOCKET_ROOMS } from './events';
import { DriverProfile } from '../modules/drivers/entities/driver-profile.entity';
import { Trip } from '../modules/trips/entities/trip.entity';
import { TripStatus } from '../common/constants/trip-status.enum';

interface LocationPayload {
  tripId?: string;
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
}

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/',
})
export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(AppGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    @InjectRepository(DriverProfile) private readonly driverRepo: Repository<DriverProfile>,
    @InjectRepository(Trip) private readonly tripRepo: Repository<Trip>,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) throw new WsException('No token provided');

      const payload = this.jwtService.verify(token, {
        secret: this.config.get('jwt.secret'),
      });

      client.data.user = payload;

      // Auto-join personal room
      const room =
        payload.role === 'DRIVER'
          ? SOCKET_ROOMS.driver(payload.sub)
          : SOCKET_ROOMS.rider(payload.sub);
      client.join(room);

      if (payload.role === 'ADMIN') client.join(SOCKET_ROOMS.adminOps);

      this.logger.log(`Client connected: ${payload.sub} [${payload.role}]`);
    } catch (err) {
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const user = client.data?.user;
    if (user) this.logger.log(`Client disconnected: ${user.sub}`);
  }

  @SubscribeMessage(SOCKET_EVENTS.DRIVER_LOCATION)
  async handleDriverLocation(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: LocationPayload,
  ) {
    const user = client.data?.user;
    if (!user || user.role !== 'DRIVER') return;

    // Update DB location
    await this.driverRepo.update(
      { userId: user.sub },
      {
        currentHeading: payload.heading,
        currentSpeed: payload.speed,
        lastLocationAt: new Date(),
      },
    );

    // Broadcast to trip room if driver is on an active trip
    if (payload.tripId) {
      this.server.to(SOCKET_ROOMS.trip(payload.tripId)).emit(
        SOCKET_EVENTS.DRIVER_LOCATION_UPDATE,
        { driverId: user.sub, lat: payload.lat, lng: payload.lng, heading: payload.heading },
      );
    }

    // Broadcast to admin ops
    this.server
      .to(SOCKET_ROOMS.adminOps)
      .emit(SOCKET_EVENTS.DRIVER_LOCATION_UPDATE, { driverId: user.sub, ...payload });
  }

  @SubscribeMessage(SOCKET_EVENTS.TRIP_RESPONSE)
  async handleTripResponse(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { tripId: string; accepted: boolean },
  ) {
    const user = client.data?.user;
    if (!user || user.role !== 'DRIVER') return;

    const trip = await this.tripRepo.findOne({ where: { id: payload.tripId } });
    if (!trip) return;

    if (payload.accepted) {
      await this.tripRepo.update(payload.tripId, {
        status: TripStatus.ARRIVING,
        driverId: user.sub,
        matchedAt: new Date(),
      });

      client.join(SOCKET_ROOMS.trip(payload.tripId));

      this.server.to(SOCKET_ROOMS.trip(payload.tripId)).emit(SOCKET_EVENTS.TRIP_MATCHED, {
        tripId: payload.tripId,
        driverId: user.sub,
      });

      this.server.to(SOCKET_ROOMS.adminOps).emit(SOCKET_EVENTS.TRIP_STATUS_UPDATE, {
        tripId: payload.tripId,
        status: TripStatus.ARRIVING,
      });
    }
  }

  @SubscribeMessage(SOCKET_EVENTS.TRIP_ARRIVED)
  async handleDriverArrived(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { tripId: string },
  ) {
    const user = client.data?.user;
    if (!user || user.role !== 'DRIVER') return;

    await this.tripRepo.update(payload.tripId, {
      status: TripStatus.ARRIVED,
      driverArrivedAt: new Date(),
    });

    this.server.to(SOCKET_ROOMS.trip(payload.tripId)).emit(SOCKET_EVENTS.DRIVER_ARRIVED, {
      tripId: payload.tripId,
      arrivedAt: new Date().toISOString(),
    });
  }

  @SubscribeMessage(SOCKET_EVENTS.TRIP_PICKUP)
  async handlePickup(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { tripId: string; passengerId: string },
  ) {
    const user = client.data?.user;
    if (!user || user.role !== 'DRIVER') return;

    await this.tripRepo.update(payload.tripId, {
      status: TripStatus.IN_PROGRESS,
      startedAt: new Date(),
    });

    this.server.to(SOCKET_ROOMS.trip(payload.tripId)).emit(SOCKET_EVENTS.TRIP_STATUS_UPDATE, {
      tripId: payload.tripId,
      status: TripStatus.IN_PROGRESS,
    });
  }

  @SubscribeMessage(SOCKET_EVENTS.TRIP_DROPOFF)
  async handleDropoff(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { tripId: string; passengerId: string; isFinalStop: boolean },
  ) {
    const user = client.data?.user;
    if (!user || user.role !== 'DRIVER') return;

    if (payload.isFinalStop) {
      await this.tripRepo.update(payload.tripId, {
        status: TripStatus.COMPLETED,
        completedAt: new Date(),
      });

      this.server.to(SOCKET_ROOMS.trip(payload.tripId)).emit(SOCKET_EVENTS.TRIP_COMPLETED, {
        tripId: payload.tripId,
        completedAt: new Date().toISOString(),
      });
    }
  }

  // Called by TripsService to dispatch new trip requests to nearby drivers
  emitTripRequest(driverId: string, tripData: object) {
    this.server
      .to(SOCKET_ROOMS.driver(driverId))
      .emit(SOCKET_EVENTS.TRIP_NEW_REQUEST, tripData);
  }

  // Join a rider to a trip room (called after matching)
  joinRiderToTrip(riderId: string, tripId: string) {
    this.server.in(SOCKET_ROOMS.rider(riderId)).socketsJoin(SOCKET_ROOMS.trip(tripId));
  }
}
