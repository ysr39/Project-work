part of 'driver_cubit.dart';

sealed class DriverState extends Equatable {
  @override
  List<Object?> get props => [];
}

final class DriverOffline extends DriverState {}

final class DriverOnline extends DriverState {
  final bool isAcceptingRides;
  const DriverOnline({required this.isAcceptingRides});
  @override List<Object?> get props => [isAcceptingRides];
}

final class DriverTripRequest extends DriverState {
  final String tripId;
  final String pickupAddress;
  final String dropoffAddress;
  final int    seats;
  final double estimatedFare;
  final double distanceKm;
  final int    expiresIn;

  const DriverTripRequest({
    required this.tripId,
    required this.pickupAddress,
    required this.dropoffAddress,
    required this.seats,
    required this.estimatedFare,
    required this.distanceKm,
    required this.expiresIn,
  });

  @override
  List<Object?> get props => [tripId];
}

final class DriverEnRoute extends DriverState {
  final String tripId;
  const DriverEnRoute({required this.tripId});
  @override List<Object?> get props => [tripId];
}

final class DriverArrived extends DriverState {
  final String tripId;
  const DriverArrived({required this.tripId});
  @override List<Object?> get props => [tripId];
}

final class DriverInProgress extends DriverState {
  final String tripId;
  const DriverInProgress({required this.tripId});
  @override List<Object?> get props => [tripId];
}

final class DriverError extends DriverState {
  final String message;
  const DriverError(this.message);
  @override List<Object?> get props => [message];
}
