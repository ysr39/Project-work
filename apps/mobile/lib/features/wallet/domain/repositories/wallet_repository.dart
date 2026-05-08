import '../../../../core/errors/failures.dart';

abstract class WalletRepository {
  Future<({List<Map<String, dynamic>>? history, Failure? failure})> getPaymentHistory();
  Future<({Map<String, dynamic>? intent, Failure? failure})> createPaymentIntent(double amount, String tripId);
}
