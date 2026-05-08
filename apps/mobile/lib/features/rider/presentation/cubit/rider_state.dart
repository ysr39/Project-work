part of 'rider_cubit.dart';

sealed class RiderState extends Equatable {
  @override
  List<Object?> get props => [];
}

final class RiderInitial extends RiderState {}

final class RiderSearching extends RiderState {}

final class RiderWaitingForMatch extends RiderState {
  final TripEntity trip;
  const RiderWaitingForMatch(this.trip);
  @override List<Object?> get props => [trip.id, trip.status];
}

final class RiderMatched extends RiderState {
  final TripEntity trip;
  const RiderMatched(this.trip);
  @override List<Object?> get props => [trip.id, trip.status, trip.driverLat, trip.driverLng, trip.etaMinutes];
}

final class RiderInProgress extends RiderState {
  final TripEntity trip;
  const RiderInProgress(this.trip);
  @override List<Object?> get props => [trip.id, trip.status, trip.driverLat, trip.driverLng];
}

final class RiderCompleted extends RiderState {
  final TripEntity trip;
  final Map<String, dynamic> summary;
  const RiderCompleted(this.trip, this.summary);
  @override List<Object?> get props => [trip.id];
}

final class RiderError extends RiderState {
  final String message;
  const RiderError(this.message);
  @override List<Object?> get props => [message];
}
