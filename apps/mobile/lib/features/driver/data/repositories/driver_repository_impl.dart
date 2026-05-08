import 'package:dio/dio.dart';

import '../../../../core/errors/failures.dart';
import '../../../../core/network/api_client.dart';
import '../../domain/repositories/driver_repository.dart';
import '../datasources/driver_remote_datasource.dart';

class DriverRepositoryImpl implements DriverRepository {
  final DriverRemoteDataSource _remote;
  const DriverRepositoryImpl(this._remote);

  @override
  Future<({Failure? failure})> toggleOnlineStatus(bool isOnline) async {
    try {
      await _remote.toggleOnline(isOnline);
      return (failure: null);
    } on DioException catch (e) {
      return (failure: dioToFailure(e));
    }
  }

  @override
  Future<({Map<String, dynamic>? profile, Failure? failure})> getDriverProfile() async {
    try {
      final data = await _remote.getProfile();
      return (profile: data, failure: null);
    } on DioException catch (e) {
      return (profile: null, failure: dioToFailure(e));
    }
  }

  @override
  Future<({Failure? failure})> acceptTrip(String tripId) async => (failure: null);

  @override
  Future<({Failure? failure})> declineTrip(String tripId, {String? reason}) async => (failure: null);

  @override
  Future<({List<Map<String, dynamic>>? history, Failure? failure})> getTripHistory() async {
    try {
      final data = await _remote.getTripHistory();
      return (history: data, failure: null);
    } on DioException catch (e) {
      return (history: null, failure: dioToFailure(e));
    }
  }
}
