import '../../../../core/errors/failures.dart';
import '../repositories/rider_repository.dart';

class CancelRideUseCase {
  final RiderRepository _repo;
  const CancelRideUseCase(this._repo);

  Future<({Failure? failure})> call(String tripId) => _repo.cancelRide(tripId);
}
