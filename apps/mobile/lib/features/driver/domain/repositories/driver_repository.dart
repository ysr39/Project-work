import '../../../../core/errors/failures.dart';

abstract class DriverRepository {
  Future<({Failure? failure})> toggleOnlineStatus(bool isOnline);
  Future<({Map<String, dynamic>? profile, Failure? failure})> getDriverProfile();
  Future<({Failure? failure})> acceptTrip(String tripId);
  Future<({Failure? failure})> declineTrip(String tripId, {String? reason});
  Future<({List<Map<String, dynamic>>? history, Failure? failure})> getTripHistory();
}
