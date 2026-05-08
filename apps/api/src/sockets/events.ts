export const SOCKET_EVENTS = {
  // Client → Server
  DRIVER_LOCATION: 'driver:location',
  TRIP_RESPONSE: 'trip:response',
  TRIP_ARRIVED: 'trip:arrived',
  TRIP_PICKUP: 'trip:pickup',
  TRIP_DROPOFF: 'trip:dropoff',

  // Server → Client
  TRIP_NEW_REQUEST: 'trip:new_request',
  TRIP_MATCHED: 'trip:matched',
  TRIP_STATUS_UPDATE: 'trip:status_update',
  DRIVER_LOCATION_UPDATE: 'driver:location_update',
  DRIVER_ARRIVED: 'driver:arrived',
  TRIP_COMPLETED: 'trip:completed',
  TRIP_CANCELLED: 'trip:cancelled',
} as const;

export const SOCKET_ROOMS = {
  driver: (id: string) => `driver:${id}`,
  rider: (id: string) => `rider:${id}`,
  trip: (id: string) => `trip:${id}`,
  adminOps: 'admin:ops',
};
