import 'package:dio/dio.dart';

import '../../../../core/errors/failures.dart';
import '../../../../core/network/api_client.dart';
import '../../domain/repositories/wallet_repository.dart';
import '../datasources/wallet_remote_datasource.dart';

class WalletRepositoryImpl implements WalletRepository {
  final WalletRemoteDataSource _remote;
  const WalletRepositoryImpl(this._remote);

  @override
  Future<({List<Map<String, dynamic>>? history, Failure? failure})> getPaymentHistory() async {
    try {
      final data = await _remote.getPaymentHistory();
      return (history: data, failure: null);
    } on DioException catch (e) {
      return (history: null, failure: dioToFailure(e));
    }
  }

  @override
  Future<({Map<String, dynamic>? intent, Failure? failure})> createPaymentIntent(
    double amount,
    String tripId,
  ) async {
    try {
      final data = await _remote.createPaymentIntent(amount, tripId);
      return (intent: data, failure: null);
    } on DioException catch (e) {
      return (intent: null, failure: dioToFailure(e));
    }
  }
}
