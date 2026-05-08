import '../../../../core/constants/app_constants.dart';
import '../../../../core/network/api_client.dart';
import '../../../rider/data/models/trip_model.dart';

class HistoryRemoteDataSource {
  final ApiClient _client;
  const HistoryRemoteDataSource(this._client);

  Future<List<TripModel>> getHistory() async {
    final res = await _client.get(ApiEndpoints.tripHistory);
    final list = (res.data as Map<String, dynamic>)['data'] as List<dynamic>;
    return list.map((e) => TripModel.fromJson(e as Map<String, dynamic>)).toList();
  }
}
