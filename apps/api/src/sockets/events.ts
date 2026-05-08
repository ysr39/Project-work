/* ─────────────────────────────────────────────────────────────────────────────
   Event name constants — single source of truth for client & server.
   Import this in both the gateway and any service that emits events.
───────────────────────────────────────────────────────────────────────────── */

export const CLIENT_EVENTS = {
  // Driver → Server
  DRIVER_LOCATION: 'driver:location',
  DRIVER_ONLINE:   'driver:online',
  DRIVER_OFFLINE:  'driver:offline',
  TRIP_ACCEPT:     'trip:accept',
  TRIP_DECLINE:    'trip:decline',
  TRIP_ARRIVED:    'trip:arrived',
  TRIP_PICKUP:     'trip:pickup',
  TRIP_DROPOFF:    'trip:dropoff',
  TRIP_JOIN_ROOM:  'trip:join_room',
} as const;

export const SERVER_EVENTS = {
  // Server → Driver
  TRIP_NEW_REQUEST:     'trip:new_request',
  TRIP_ACCEPT_TIMEOUT:  'trip:accept_timeout',

  // Server → Trip Room (all parties)
  TRIP_MATCHED:         'trip:matched',
  TRIP_DRIVER_LOCATION: 'trip:driver_location',
  TRIP_STATUS_CHANGED:  'trip:status_changed',
  TRIP_DRIVER_ARRIVED:  'trip:driver_arrived',
  TRIP_COMPLETED:       'trip:completed',
  TRIP_CANCELLED:       'trip:cancelled',

  // Server → Rider
  TRIP_NO_DRIVER:       'trip:no_driver',

  // Server → All
  NOTIFICATION_PUSH:    'notification:push',
  ADMIN_LIVE_UPDATE:    'admin:live_update',
  ERROR:                'error',
} as const;

/* ─── Room naming ────────────────────────────────────────────────────────── */

export const ROOMS = {
  driver: (id: string) => `driver:${id}`,
  rider:  (id: string) => `rider:${id}`,
  trip:   (id: string) => `trip:${id}`,
  admin:  'admin:ops',
} as const;

/* ─── Typed payloads ─────────────────────────────────────────────────────── */

export interface LocationPayload {
  tripId?:  string;
  lat:      number;
  lng:      number;
  heading?: number;   // degrees 0–360
  speed?:   number;   // km/h
  ts:       number;   // epoch ms
}

export interface TripAcceptPayload  { tripId: string }
export interface TripDeclinePayload { tripId: string; reason?: string }
export interface TripArrivedPayload { tripId: string }

export interface TripPickupPayload {
  tripId:      string;
  passengerId: string;  // TripPassenger.id
}

export interface TripDropoffPayload {
  tripId:      string;
  passengerId: string;
  isFinalStop: boolean;
}

export interface TripJoinRoomPayload { tripId: string }

/* ─── Server → Client payloads ───────────────────────────────────────────── */

export interface NewTripRequestPayload {
  tripId:          string;
  tripType:        string;
  pickupAddress:   string;
  pickupLat:       number;
  pickupLng:       number;
  dropoffAddress:  string;
  dropoffLat:      number;
  dropoffLng:      number;
  seats:           number;
  estimatedFare:   number;
  distanceKm:      number;
  stops:           Array<{ type: string; address: string; lat: number; lng: number; order: number }>;
  expiresIn:       number;   // seconds driver has to respond
}

export interface TripMatchedPayload {
  tripId:      string;
  driverId:    string;
  driverName:  string;
  vehicleMake: string;
  vehicleModel: string;
  plateNumber: string;
  etaMinutes:  number;
  driverLat:   number;
  driverLng:   number;
}

export interface DriverLocationPayload {
  tripId:   string;
  driverId: string;
  lat:      number;
  lng:      number;
  heading?: number;
  speed?:   number;
  etaMinutes?: number;
}

export interface TripStatusChangedPayload {
  tripId:    string;
  status:    string;
  timestamp: string;
  meta?:     Record<string, unknown>;
}

export interface TripCompletedPayload {
  tripId:        string;
  completedAt:   string;
  fareAmount:    number;
  distanceKm:    number;
  durationMin:   number;
  driverEarnings?: number;
}

export interface TripCancelledPayload {
  tripId:            string;
  cancelledBy:       string;
  reason?:           string;
  cancellationFee:   number;
  refundAmount:      number;
  timestamp:         string;
}

export interface NotificationPayload {
  id:       string;
  type:     string;
  title:    string;
  body:     string;
  data?:    Record<string, string>;
  ts:       string;
}

export interface AdminLiveUpdatePayload {
  event:    string;
  tripId?:  string;
  driverId?: string;
  data:     Record<string, unknown>;
}

export interface WsError {
  code:    string;
  message: string;
}
