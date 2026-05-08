import 'dart:async';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';
import 'package:geolocator/geolocator.dart';

import '../../../../core/network/socket_client.dart';
import '../../../../core/constants/app_constants.dart';
import '../../domain/repositories/driver_repository.dart';

part 'driver_state.dart';

class DriverCubit extends Cubit<DriverState> {
  final DriverRepository _repo;
  final SocketClient     _socket;

  StreamSubscription<Position>? _locationSub;
  String? _activeTripId;

  DriverCubit(this._repo, this._socket) : super(DriverOffline()) {
    _registerSocketListeners();
  }

  void _registerSocketListeners() {
    _socket.on(SocketEvents.tripNewRequest, (data) {
      if (isClosed) return;
      emit(DriverTripRequest(
        tripId:          data['tripId'] as String,
        pickupAddress:   data['pickupAddress'] as String,
        dropoffAddress:  data['dropoffAddress'] as String,
        seats:           data['seats'] as int? ?? 1,
        estimatedFare:   (data['estimatedFare'] as num?)?.toDouble() ?? 0,
        distanceKm:      (data['distanceKm'] as num?)?.toDouble() ?? 0,
        expiresIn:       data['expiresIn'] as int? ?? AppConstants.tripAcceptWindowSec,
      ));
    });

    _socket.on(SocketEvents.tripAcceptTimeout, (data) {
      if (isClosed) return;
      emit(DriverOnline(isAcceptingRides: true));
    });
  }

  Future<void> goOnline() async {
    await _socket.connect();
    _socket.emit(SocketEvents.driverOnline, {});

    final permResult = await Geolocator.requestPermission();
    if (permResult == LocationPermission.denied || permResult == LocationPermission.deniedForever) {
      emit(const DriverError('Location permission required'));
      return;
    }

    _locationSub = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, distanceFilter: 20),
    ).listen((pos) {
      _socket.emit(SocketEvents.driverLocation, {
        'lat':     pos.latitude,
        'lng':     pos.longitude,
        'heading': pos.heading,
        'speed':   pos.speed * 3.6, // m/s → km/h
        'ts':      pos.timestamp.millisecondsSinceEpoch,
        if (_activeTripId != null) 'tripId': _activeTripId,
      });
    });

    emit(DriverOnline(isAcceptingRides: true));
  }

  Future<void> goOffline() async {
    _locationSub?.cancel();
    _locationSub = null;
    _socket.emit(SocketEvents.driverOffline, {});
    emit(DriverOffline());
  }

  Future<void> acceptTrip(String tripId) async {
    _activeTripId = tripId;
    _socket.emit(SocketEvents.tripAccept, {'tripId': tripId});
    emit(DriverEnRoute(tripId: tripId));
  }

  void declineTrip(String tripId) {
    _socket.emit(SocketEvents.tripDecline, {'tripId': tripId});
    emit(DriverOnline(isAcceptingRides: true));
  }

  void markArrived(String tripId) {
    _socket.emit(SocketEvents.tripArrived, {'tripId': tripId});
    emit(DriverArrived(tripId: tripId));
  }

  void pickupPassenger(String tripId, String passengerId) {
    _socket.emit(SocketEvents.tripPickup, {'tripId': tripId, 'passengerId': passengerId});
    emit(DriverInProgress(tripId: tripId));
  }

  void dropoffPassenger(String tripId, String passengerId, {required bool isFinalStop}) {
    _socket.emit(SocketEvents.tripDropoff, {
      'tripId':       tripId,
      'passengerId':  passengerId,
      'isFinalStop':  isFinalStop,
    });
    if (isFinalStop) {
      _activeTripId = null;
      emit(DriverOnline(isAcceptingRides: true));
    }
  }

  @override
  Future<void> close() {
    _locationSub?.cancel();
    return super.close();
  }
}
