import 'package:dio/dio.dart';

import '../../../../core/errors/failures.dart';
import '../../../../core/network/api_client.dart';
import '../../domain/entities/trip_entity.dart';
import '../../domain/repositories/rider_repository.dart';
import '../datasources/rider_remote_datasource.dart';

class RiderRepositoryImpl implements RiderRepository {
  final RiderRemoteDataSource _remote;
  const RiderRepositoryImpl(this._remote);

  @override
  Future<({TripEntity? trip, Failure? failure})> requestPoolRide({
    required String pickupAddress,
    required double pickupLat,
    required double pickupLng,
    required String dropoffAddress,
    required double dropoffLat,
    required double dropoffLng,
    required int seats,
  }) async {
    try {
      final model = await _remote.requestPoolRide(
        pickupAddress:  pickupAddress,
        pickupLat:      pickupLat,
        pickupLng:      pickupLng,
        dropoffAddress: dropoffAddress,
        dropoffLat:     dropoffLat,
        dropoffLng:     dropoffLng,
        seats:          seats,
      );
      return (trip: model.toEntity(), failure: null);
    } on DioException catch (e) {
      return (trip: null, failure: dioToFailure(e));
    }
  }

  @override
  Future<({Map<String, dynamic>? estimate, Failure? failure})> estimateFare({
    required double pickupLat,
    required double pickupLng,
    required double dropoffLat,
    required double dropoffLng,
    required int seats,
  }) async {
    try {
      final data = await _remote.estimateFare(
        pickupLat:  pickupLat,
        pickupLng:  pickupLng,
        dropoffLat: dropoffLat,
        dropoffLng: dropoffLng,
        seats:      seats,
      );
      return (estimate: data, failure: null);
    } on DioException catch (e) {
      return (estimate: null, failure: dioToFailure(e));
    }
  }

  @override
  Future<({Failure? failure})> cancelRide(String tripId) async {
    try {
      await _remote.cancelRide(tripId);
      return (failure: null);
    } on DioException catch (e) {
      return (failure: dioToFailure(e));
    }
  }

  @override
  Future<({TripEntity? trip, Failure? failure})> getTripById(String tripId) async {
    try {
      final model = await _remote.getTripById(tripId);
      return (trip: model.toEntity(), failure: null);
    } on DioException catch (e) {
      return (trip: null, failure: dioToFailure(e));
    }
  }

  @override
  Future<({List<TripEntity>? trips, Failure? failure})> getTripHistory() async {
    try {
      final models = await _remote.getTripHistory();
      return (trips: models.map((m) => m.toEntity()).toList(), failure: null);
    } on DioException catch (e) {
      return (trips: null, failure: dioToFailure(e));
    }
  }
}
