export enum TripType {
  SOLO = 'SOLO',
  POOL = 'POOL',
}

export enum TripStatus {
  SEARCHING = 'SEARCHING',
  MATCHED = 'MATCHED',
  ARRIVING = 'ARRIVING',
  ARRIVED = 'ARRIVED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum PassengerStatus {
  CONFIRMED = 'CONFIRMED',
  PICKED_UP = 'PICKED_UP',
  DROPPED_OFF = 'DROPPED_OFF',
  CANCELLED = 'CANCELLED',
}

export enum StopType {
  PICKUP = 'PICKUP',
  DROPOFF = 'DROPOFF',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  AUTHORIZED = 'AUTHORIZED',
  CAPTURED = 'CAPTURED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
}

export enum PaymentMethod {
  CARD = 'CARD',
  WALLET = 'WALLET',
  CASH = 'CASH',
}

export enum PayoutStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  PAID = 'PAID',
  FAILED = 'FAILED',
}

// Allowed FSM transitions
export const TRIP_TRANSITIONS: Record<TripStatus, TripStatus[]> = {
  [TripStatus.SEARCHING]: [TripStatus.MATCHED, TripStatus.CANCELLED],
  [TripStatus.MATCHED]: [TripStatus.ARRIVING, TripStatus.CANCELLED],
  [TripStatus.ARRIVING]: [TripStatus.ARRIVED, TripStatus.CANCELLED],
  [TripStatus.ARRIVED]: [TripStatus.IN_PROGRESS, TripStatus.CANCELLED],
  [TripStatus.IN_PROGRESS]: [TripStatus.COMPLETED],
  [TripStatus.COMPLETED]: [],
  [TripStatus.CANCELLED]: [],
};
