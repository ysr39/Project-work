import 'package:equatable/equatable.dart';

class TripEntity extends Equatable {
  final String id;
  final String status;
  final String pickupAddress;
  final double pickupLat;
  final double pickupLng;
  final String dropoffAddress;
  final double dropoffLat;
  final double dropoffLng;
  final double estimatedFare;
  final int    seats;
  final String? driverId;
  final String? driverName;
  final String? driverPhone;
  final double? driverLat;
  final double? driverLng;
  final int?    etaMinutes;
  final String? plateNumber;
  final String? vehicleMake;
  final String? vehicleModel;
  final List<TripStopEntity> stops;
  final DateTime createdAt;

  const TripEntity({
    required this.id,
    required this.status,
    required this.pickupAddress,
    required this.pickupLat,
    required this.pickupLng,
    required this.dropoffAddress,
    required this.dropoffLat,
    required this.dropoffLng,
    required this.estimatedFare,
    required this.seats,
    this.driverId,
    this.driverName,
    this.driverPhone,
    this.driverLat,
    this.driverLng,
    this.etaMinutes,
    this.plateNumber,
    this.vehicleMake,
    this.vehicleModel,
    required this.stops,
    required this.createdAt,
  });

  TripEntity copyWith({
    String? status,
    double? driverLat,
    double? driverLng,
    int?    etaMinutes,
    String? driverId,
    String? driverName,
    String? plateNumber,
  }) =>
      TripEntity(
        id:             id,
        status:         status         ?? this.status,
        pickupAddress:  pickupAddress,
        pickupLat:      pickupLat,
        pickupLng:      pickupLng,
        dropoffAddress: dropoffAddress,
        dropoffLat:     dropoffLat,
        dropoffLng:     dropoffLng,
        estimatedFare:  estimatedFare,
        seats:          seats,
        driverId:       driverId       ?? this.driverId,
        driverName:     driverName     ?? this.driverName,
        driverPhone:    driverPhone,
        driverLat:      driverLat      ?? this.driverLat,
        driverLng:      driverLng      ?? this.driverLng,
        etaMinutes:     etaMinutes     ?? this.etaMinutes,
        plateNumber:    plateNumber    ?? this.plateNumber,
        vehicleMake:    vehicleMake,
        vehicleModel:   vehicleModel,
        stops:          stops,
        createdAt:      createdAt,
      );

  @override
  List<Object?> get props => [id, status];
}

class TripStopEntity extends Equatable {
  final String id;
  final String type;
  final String address;
  final double lat;
  final double lng;
  final int    order;
  final bool   completed;

  const TripStopEntity({
    required this.id,
    required this.type,
    required this.address,
    required this.lat,
    required this.lng,
    required this.order,
    required this.completed,
  });

  @override
  List<Object?> get props => [id, order, completed];
}
