import 'package:dio/dio.dart';

import '../../../../core/constants/app_constants.dart';
import '../../../../core/network/api_client.dart';
import '../models/user_model.dart';

class AuthRemoteDataSource {
  final ApiClient _client;
  const AuthRemoteDataSource(this._client);

  Future<void> sendOtp({required String phone, required String role}) async {
    await _client.post(ApiEndpoints.sendOtp, data: {'phone': phone, 'role': role});
  }

  Future<TokenPairModel> verifyOtp({
    required String phone,
    required String otp,
    required String role,
  }) async {
    final res = await _client.post(
      ApiEndpoints.verifyOtp,
      data: {'phone': phone, 'otp': otp, 'role': role},
    );
    final data = (res.data as Map<String, dynamic>)['data'] as Map<String, dynamic>;
    return TokenPairModel.fromJson(data);
  }

  Future<void> logout({required String refreshToken}) async {
    await _client.post(ApiEndpoints.logout, data: {'refreshToken': refreshToken});
  }

  Future<UserModel> getMe() async {
    final res = await _client.get(ApiEndpoints.me);
    return UserModel.fromJson(
      (res.data as Map<String, dynamic>)['data'] as Map<String, dynamic>,
    );
  }
}
