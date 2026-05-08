import '../../../../core/errors/failures.dart';
import '../entities/user_entity.dart';

abstract class AuthRepository {
  Future<({Failure? failure})> sendOtp({
    required String phone,
    required String role,
  });

  Future<({TokenPairEntity? tokens, Failure? failure})> verifyOtp({
    required String phone,
    required String otp,
    required String role,
  });

  Future<void> logout();
  Future<UserEntity?> getCurrentUser();
}
