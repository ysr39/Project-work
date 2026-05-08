import '../../domain/entities/trip_entity.dart';

class TripModel {
  final String id;
  final String status;
  final String pickupAddress;
  final double pickupLat;
  final double pickupLng;
  final String dropoffAddress;
  final double dropoffLat;
  final double dropoffLng;
  final double totalFare;
  final int    totalSeats;
  final String? driverId;
  final List<TripStopModel> stops;
  final DateTime createdAt;

  const TripModel({
    required this.id,
    required this.status,
    required this.pickupAddress,
    required this.pickupLat,
    required this.pickupLng,
    required this.dropoffAddress,
    required this.dropoffLat,
    required this.dropoffLng,
    required this.totalFare,
    required this.totalSeats,
    this.driverId,
    required this.stops,
    required this.createdAt,
  });

  factory TripModel.fromJson(Map<String, dynamic> json) {
    final stopsList = (json['stops'] as List<dynamic>? ?? [])
        .map((s) => TripStopModel.fromJson(s as Map<String, dynamic>))
        .toList();
    return TripModel(
      id:             json['id'] as String,
      status:         json['status'] as String,
      pickupAddress:  json['pickupAddress'] as String,
      pickupLat:      double.parse(json['pickupLat'].toString()),
      pickupLng:      double.parse(json['pickupLng'].toString()),
      dropoffAddress: json['dropoffAddress'] as String,
      dropoffLat:     double.parse(json['dropoffLat'].toString()),
      dropoffLng:     double.parse(json['dropoffLng'].toString()),
      totalFare:      double.parse(json['totalFare']?.toString() ?? '0'),
      totalSeats:     json['totalSeats'] as int? ?? 1,
      driverId:       json['driverId'] as String?,
      stops:          stopsList,
      createdAt:      DateTime.parse(json['createdAt'] as String),
    );
  }

  TripEntity toEntity() => TripEntity(
        id:             id,
        status:         status,
        pickupAddress:  pickupAddress,
        pickupLat:      pickupLat,
        pickupLng:      pickupLng,
        dropoffAddress: dropoffAddress,
        dropoffLat:     dropoffLat,
        dropoffLng:     dropoffLng,
        estimatedFare:  totalFare,
        seats:          totalSeats,
        driverId:       driverId,
        stops:          stops.map((s) => s.toEntity()).toList(),
        createdAt:      createdAt,
      );
}

class TripStopModel {
  final String id;
  final String stopType;
  final String address;
  final double lat;
  final double lng;
  final int    sequenceOrder;
  final bool   completed;

  const TripStopModel({
    required this.id,
    required this.stopType,
    required this.address,
    required this.lat,
    required this.lng,
    required this.sequenceOrder,
    required this.completed,
  });

  factory TripStopModel.fromJson(Map<String, dynamic> json) => TripStopModel(
        id:            json['id'] as String,
        stopType:      json['stopType'] as String,
        address:       json['address'] as String,
        lat:           double.parse(json['lat'].toString()),
        lng:           double.parse(json['lng'].toString()),
        sequenceOrder: json['sequenceOrder'] as int? ?? 0,
        completed:     json['completedAt'] != null,
      );

  TripStopEntity toEntity() => TripStopEntity(
        id:        id,
        type:      stopType,
        address:   address,
        lat:       lat,
        lng:       lng,
        order:     sequenceOrder,
        completed: completed,
      );
}
