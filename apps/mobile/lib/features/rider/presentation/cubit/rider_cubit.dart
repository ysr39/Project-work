import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import '../../../../core/network/socket_client.dart';
import '../../domain/entities/trip_entity.dart';
import '../../domain/usecases/request_pool_ride_usecase.dart';
import '../../domain/usecases/cancel_ride_usecase.dart';

part 'rider_state.dart';

class RiderCubit extends Cubit<RiderState> {
  final RequestPoolRideUseCase _requestRide;
  final CancelRideUseCase      _cancelRide;
  final SocketClient           _socket;

  RiderCubit(this._requestRide, this._cancelRide, this._socket)
      : super(RiderInitial());

  Future<void> requestRide({
    required String pickupAddress,
    required LatLng pickup,
    required String dropoffAddress,
    required LatLng dropoff,
    required int seats,
  }) async {
    emit(RiderSearching());

    final result = await _requestRide(
      pickupAddress:  pickupAddress,
      pickupLat:      pickup.latitude,
      pickupLng:      pickup.longitude,
      dropoffAddress: dropoffAddress,
      dropoffLat:     dropoff.latitude,
      dropoffLng:     dropoff.longitude,
      seats:          seats,
    );

    if (result.failure != null) {
      emit(RiderError(result.failure!.message));
      return;
    }

    final trip = result.trip!;
    emit(RiderWaitingForMatch(trip));
    _listenToTripEvents(trip.id);
  }

  void _listenToTripEvents(String tripId) {
    _socket.emit(SocketEvents.tripJoinRoom, {'tripId': tripId});

    _socket.on(SocketEvents.tripMatched, (data) {
      final current = state;
      if (current is! RiderWaitingForMatch) return;
      final updated = current.trip.copyWith(
        status:      'MATCHED',
        driverId:    data['driverId'] as String?,
        driverName:  data['driverName'] as String?,
        plateNumber: data['plateNumber'] as String?,
        driverLat:   (data['driverLat'] as num?)?.toDouble(),
        driverLng:   (data['driverLng'] as num?)?.toDouble(),
        etaMinutes:  data['etaMinutes'] as int?,
      );
      emit(RiderMatched(updated));
    });

    _socket.on(SocketEvents.tripDriverLocation, (data) {
      final current = state;
      if (current is! RiderMatched && current is! RiderInProgress) return;
      final trip = current is RiderMatched ? current.trip : (current as RiderInProgress).trip;
      final updated = trip.copyWith(
        driverLat:  (data['lat'] as num).toDouble(),
        driverLng:  (data['lng'] as num).toDouble(),
        etaMinutes: data['etaMinutes'] as int?,
      );
      if (current is RiderMatched) {
        emit(RiderMatched(updated));
      } else {
        emit(RiderInProgress(updated));
      }
    });

    _socket.on(SocketEvents.tripStatusChanged, (data) {
      final status = data['status'] as String;
      final current = state;
      TripEntity? trip;
      if (current is RiderMatched)    trip = current.trip;
      if (current is RiderInProgress) trip = current.trip;
      if (trip == null) return;
      final updated = trip.copyWith(status: status);
      if (status == 'IN_PROGRESS') {
        emit(RiderInProgress(updated));
      } else {
        emit(RiderMatched(updated));
      }
    });

    _socket.on(SocketEvents.tripCompleted, (data) {
      final current = state;
      TripEntity? trip;
      if (current is RiderInProgress) trip = current.trip;
      if (trip != null) emit(RiderCompleted(trip.copyWith(status: 'COMPLETED'), data));
    });

    _socket.on(SocketEvents.tripCancelled, (data) {
      emit(RiderError('Trip cancelled: ${data['reason'] ?? 'No reason'}'));
    });

    _socket.on(SocketEvents.tripNoDriver, (_) {
      emit(const RiderError('No drivers available. Please try again.'));
    });
  }

  Future<void> cancelCurrentRide(String tripId) async {
    final result = await _cancelRide(tripId);
    if (result.failure != null) {
      emit(RiderError(result.failure!.message));
    } else {
      _socket.off(SocketEvents.tripMatched);
      _socket.off(SocketEvents.tripDriverLocation);
      _socket.off(SocketEvents.tripStatusChanged);
      _socket.off(SocketEvents.tripCompleted);
      _socket.off(SocketEvents.tripCancelled);
      emit(RiderInitial());
    }
  }

  void reset() => emit(RiderInitial());
}
