import '../../../../core/errors/failures.dart';
import '../../../rider/domain/entities/trip_entity.dart';

abstract class HistoryRepository {
  Future<({List<TripEntity>? trips, Failure? failure})> getHistory();
}
