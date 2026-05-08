import '../../../../core/constants/app_constants.dart';
import '../../../../core/network/api_client.dart';

class WalletRemoteDataSource {
  final ApiClient _client;
  const WalletRemoteDataSource(this._client);

  Future<List<Map<String, dynamic>>> getPaymentHistory() async {
    final res = await _client.get(ApiEndpoints.paymentHistory);
    return ((res.data as Map<String, dynamic>)['data'] as List<dynamic>)
        .map((e) => e as Map<String, dynamic>)
        .toList();
  }

  Future<Map<String, dynamic>> createPaymentIntent(double amount, String tripId) async {
    final res = await _client.post(ApiEndpoints.paymentIntent, data: {
      'amount': (amount * 100).toInt(),
      'tripId': tripId,
    });
    return (res.data as Map<String, dynamic>)['data'] as Map<String, dynamic>;
  }
}
