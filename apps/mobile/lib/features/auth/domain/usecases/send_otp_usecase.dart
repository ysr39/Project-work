import '../../../../core/errors/failures.dart';
import '../repositories/auth_repository.dart';

class SendOtpUseCase {
  final AuthRepository _repo;
  const SendOtpUseCase(this._repo);

  Future<({Failure? failure})> call({
    required String phone,
    required String role,
  }) =>
      _repo.sendOtp(phone: phone, role: role);
}
