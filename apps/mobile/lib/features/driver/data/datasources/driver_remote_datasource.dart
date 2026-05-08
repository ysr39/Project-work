import '../../../../core/constants/app_constants.dart';
import '../../../../core/network/api_client.dart';

class DriverRemoteDataSource {
  final ApiClient _client;
  const DriverRemoteDataSource(this._client);

  Future<void> toggleOnline(bool isOnline) => _client.patch(
        ApiEndpoints.driverStatus,
        data: {'isOnline': isOnline},
      );

  Future<Map<String, dynamic>> getProfile() async {
    final res = await _client.get(ApiEndpoints.driverMe);
    return (res.data as Map<String, dynamic>)['data'] as Map<String, dynamic>;
  }

  Future<List<Map<String, dynamic>>> getTripHistory() async {
    final res = await _client.get(ApiEndpoints.driverHistory);
    return ((res.data as Map<String, dynamic>)['data'] as List<dynamic>)
        .map((e) => e as Map<String, dynamic>)
        .toList();
  }
}
