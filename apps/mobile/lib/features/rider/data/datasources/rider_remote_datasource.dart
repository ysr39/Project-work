import '../../../../core/constants/app_constants.dart';
import '../../../../core/network/api_client.dart';
import '../models/trip_model.dart';

class RiderRemoteDataSource {
  final ApiClient _client;
  const RiderRemoteDataSource(this._client);

  Future<TripModel> requestPoolRide({
    required String pickupAddress,
    required double pickupLat,
    required double pickupLng,
    required String dropoffAddress,
    required double dropoffLat,
    required double dropoffLng,
    required int seats,
  }) async {
    final res = await _client.post(ApiEndpoints.poolRequest, data: {
      'pickupAddress':  pickupAddress,
      'pickupLat':      pickupLat,
      'pickupLng':      pickupLng,
      'dropoffAddress': dropoffAddress,
      'dropoffLat':     dropoffLat,
      'dropoffLng':     dropoffLng,
      'seatsRequested': seats,
      'tripType':       'POOL',
    });
    return TripModel.fromJson(
      (res.data as Map<String, dynamic>)['data'] as Map<String, dynamic>,
    );
  }

  Future<Map<String, dynamic>> estimateFare({
    required double pickupLat,
    required double pickupLng,
    required double dropoffLat,
    required double dropoffLng,
    required int seats,
  }) async {
    final res = await _client.post(ApiEndpoints.poolEstimate, data: {
      'pickupLat':  pickupLat,
      'pickupLng':  pickupLng,
      'dropoffLat': dropoffLat,
      'dropoffLng': dropoffLng,
      'seats':      seats,
    });
    return (res.data as Map<String, dynamic>)['data'] as Map<String, dynamic>;
  }

  Future<void> cancelRide(String tripId) =>
      _client.delete(ApiEndpoints.cancelRider(tripId));

  Future<TripModel> getTripById(String tripId) async {
    final res = await _client.get(ApiEndpoints.poolTrip(tripId));
    return TripModel.fromJson(
      (res.data as Map<String, dynamic>)['data'] as Map<String, dynamic>,
    );
  }

  Future<List<TripModel>> getTripHistory() async {
    final res = await _client.get(ApiEndpoints.tripHistory);
    final list = (res.data as Map<String, dynamic>)['data'] as List<dynamic>;
    return list
        .map((e) => TripModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}
