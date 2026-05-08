import '../../../../core/errors/failures.dart';
import '../entities/trip_entity.dart';
import '../repositories/rider_repository.dart';

class RequestPoolRideUseCase {
  final RiderRepository _repo;
  const RequestPoolRideUseCase(this._repo);

  Future<({TripEntity? trip, Failure? failure})> call({
    required String pickupAddress,
    required double pickupLat,
    required double pickupLng,
    required String dropoffAddress,
    required double dropoffLat,
    required double dropoffLng,
    required int seats,
  }) =>
      _repo.requestPoolRide(
        pickupAddress:  pickupAddress,
        pickupLat:      pickupLat,
        pickupLng:      pickupLng,
        dropoffAddress: dropoffAddress,
        dropoffLat:     dropoffLat,
        dropoffLng:     dropoffLng,
        seats:          seats,
      );
}
