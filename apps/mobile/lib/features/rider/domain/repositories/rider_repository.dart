import '../../../../core/errors/failures.dart';
import '../entities/trip_entity.dart';

abstract class RiderRepository {
  Future<({TripEntity? trip, Failure? failure})> requestPoolRide({
    required String pickupAddress,
    required double pickupLat,
    required double pickupLng,
    required String dropoffAddress,
    required double dropoffLat,
    required double dropoffLng,
    required int seats,
  });

  Future<({Map<String, dynamic>? estimate, Failure? failure})> estimateFare({
    required double pickupLat,
    required double pickupLng,
    required double dropoffLat,
    required double dropoffLng,
    required int seats,
  });

  Future<({Failure? failure})> cancelRide(String tripId);
  Future<({TripEntity? trip, Failure? failure})> getTripById(String tripId);
  Future<({List<TripEntity>? trips, Failure? failure})> getTripHistory();
}
