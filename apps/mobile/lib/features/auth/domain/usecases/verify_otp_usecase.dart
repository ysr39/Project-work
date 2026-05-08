import '../../../../core/errors/failures.dart';
import '../entities/user_entity.dart';
import '../repositories/auth_repository.dart';

class VerifyOtpUseCase {
  final AuthRepository _repo;
  const VerifyOtpUseCase(this._repo);

  Future<({TokenPairEntity? tokens, Failure? failure})> call({
    required String phone,
    required String otp,
    required String role,
  }) =>
      _repo.verifyOtp(phone: phone, otp: otp, role: role);
}
