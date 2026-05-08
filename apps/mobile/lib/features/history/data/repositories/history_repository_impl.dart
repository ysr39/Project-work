import 'package:dio/dio.dart';

import '../../../../core/errors/failures.dart';
import '../../../../core/network/api_client.dart';
import '../../../rider/domain/entities/trip_entity.dart';
import '../../domain/repositories/history_repository.dart';
import '../datasources/history_remote_datasource.dart';

class HistoryRepositoryImpl implements HistoryRepository {
  final HistoryRemoteDataSource _remote;
  const HistoryRepositoryImpl(this._remote);

  @override
  Future<({List<TripEntity>? trips, Failure? failure})> getHistory() async {
    try {
      final models = await _remote.getHistory();
      return (trips: models.map((m) => m.toEntity()).toList(), failure: null);
    } on DioException catch (e) {
      return (trips: null, failure: dioToFailure(e));
    }
  }
}
