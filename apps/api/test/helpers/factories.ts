import { TripType } from '../../src/common/constants/trip-status.enum';
import { UserRole } from '../../src/common/constants/roles.enum';

let counter = 0;
const uid = () => `+9190000${String(++counter).padStart(5, '0')}`;

export const PhoneFactory = {
  rider:  () => uid(),
  driver: () => uid(),
};

export const CreateTripFactory = {
  pool: (overrides = {}) => ({
    tripType:       TripType.POOL,
    pickupAddress:  'MG Road, Bangalore',
    pickupLat:      12.9716,
    pickupLng:      77.5946,
    dropoffAddress: 'Whitefield, Bangalore',
    dropoffLat:     12.9698,
    dropoffLng:     77.7500,
    seatsRequested: 1,
    ...overrides,
  }),
  solo: (overrides = {}) => ({
    tripType:       TripType.SOLO,
    pickupAddress:  'Koramangala, Bangalore',
    pickupLat:      12.9352,
    pickupLng:      77.6245,
    dropoffAddress: 'Indiranagar, Bangalore',
    dropoffLat:     12.9784,
    dropoffLng:     77.6408,
    seatsRequested: 1,
    ...overrides,
  }),
};

export const PaymentIntentFactory = {
  card: (tripPassengerId: string) => ({
    tripPassengerId,
    paymentMethod: 'CARD',
  }),
};
