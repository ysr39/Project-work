import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';

import {
  SERVER_EVENTS,
  ROOMS,
  NewTripRequestPayload,
  TripMatchedPayload,
  TripStatusChangedPayload,
  TripCompletedPayload,
  TripCancelledPayload,
  AdminLiveUpdatePayload,
} from './events';

@Injectable()
export class TripEventsService {
  private readonly logger = new Logger(TripEventsService.name);
  private server: Server;

  setServer(server: Server) {
    this.server = server;
  }

  /** Send a new trip request to a single driver */
  sendTripRequest(driverId: string, payload: NewTripRequestPayload): void {
    this.server?.to(ROOMS.driver(driverId)).emit(SERVER_EVENTS.TRIP_NEW_REQUEST, payload);
    this.logger.debug(`Trip request ${payload.tripId} → driver ${driverId}`);
  }

  /** Notify driver that accept window expired */
  sendAcceptTimeout(driverId: string, tripId: string): void {
    this.server?.to(ROOMS.driver(driverId)).emit(SERVER_EVENTS.TRIP_ACCEPT_TIMEOUT, { tripId });
  }

  /** Broadcast match confirmation to the trip room (all parties) */
  broadcastTripMatched(payload: TripMatchedPayload): void {
    this.server?.to(ROOMS.trip(payload.tripId)).emit(SERVER_EVENTS.TRIP_MATCHED, payload);
    this._adminUpdate('trip_matched', payload.tripId, payload.driverId, payload as unknown as Record<string, unknown>);
  }

  /** Broadcast any FSM status change to the trip room */
  broadcastStatusChange(payload: TripStatusChangedPayload): void {
    this.server?.to(ROOMS.trip(payload.tripId)).emit(SERVER_EVENTS.TRIP_STATUS_CHANGED, payload);
    this._adminUpdate('trip_status_changed', payload.tripId, undefined, { status: payload.status });
  }

  /** Notify trip room that driver has physically arrived */
  broadcastDriverArrived(tripId: string, arrivedAt: string): void {
    this.server?.to(ROOMS.trip(tripId)).emit(SERVER_EVENTS.TRIP_DRIVER_ARRIVED, { tripId, arrivedAt });
  }

  /** Broadcast trip completion to the trip room */
  broadcastTripCompleted(payload: TripCompletedPayload): void {
    this.server?.to(ROOMS.trip(payload.tripId)).emit(SERVER_EVENTS.TRIP_COMPLETED, payload);
    this._adminUpdate('trip_completed', payload.tripId, undefined, payload as unknown as Record<string, unknown>);
  }

  /** Broadcast trip cancellation to the trip room */
  broadcastTripCancelled(payload: TripCancelledPayload): void {
    this.server?.to(ROOMS.trip(payload.tripId)).emit(SERVER_EVENTS.TRIP_CANCELLED, payload);
    this._adminUpdate('trip_cancelled', payload.tripId, undefined, payload as unknown as Record<string, unknown>);
  }

  /** Inform a specific rider that no driver was found */
  sendNoDriver(riderId: string, tripId: string): void {
    this.server?.to(ROOMS.rider(riderId)).emit(SERVER_EVENTS.TRIP_NO_DRIVER, { tripId });
  }

  /** Add a socket (by socketId) to the trip room */
  joinSocketToTripRoom(socketId: string, tripId: string): void {
    this.server?.in(socketId).socketsJoin(ROOMS.trip(tripId));
  }

  /** Move all sockets in a personal room into the trip room */
  joinPersonalRoomToTrip(personalRoom: string, tripId: string): void {
    this.server?.in(personalRoom).socketsJoin(ROOMS.trip(tripId));
  }

  private _adminUpdate(
    event: string,
    tripId?: string,
    driverId?: string,
    data: Record<string, unknown> = {},
  ): void {
    const update: AdminLiveUpdatePayload = { event, tripId, driverId, data };
    this.server?.to(ROOMS.admin).emit(SERVER_EVENTS.ADMIN_LIVE_UPDATE, update);
  }
}
