import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:equatable/equatable.dart';

import '../../domain/usecases/send_otp_usecase.dart';
import '../../domain/usecases/verify_otp_usecase.dart';
import '../../domain/entities/user_entity.dart';

part 'auth_state.dart';

class AuthCubit extends Cubit<AuthState> {
  final SendOtpUseCase   _sendOtp;
  final VerifyOtpUseCase _verifyOtp;

  AuthCubit(this._sendOtp, this._verifyOtp) : super(AuthInitial());

  Future<void> sendOtp({required String phone, required String role}) async {
    emit(AuthLoading());
    final result = await _sendOtp(phone: phone, role: role);
    if (result.failure != null) {
      emit(AuthError(result.failure!.message));
    } else {
      emit(OtpSent(phone: phone, role: role));
    }
  }

  Future<void> verifyOtp({
    required String phone,
    required String otp,
    required String role,
  }) async {
    emit(AuthLoading());
    final result = await _verifyOtp(phone: phone, otp: otp, role: role);
    if (result.failure != null) {
      emit(AuthError(result.failure!.message));
    } else {
      emit(Authenticated(result.tokens!.user));
    }
  }
}
