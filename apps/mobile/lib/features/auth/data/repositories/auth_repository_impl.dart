import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../../../core/constants/app_constants.dart';
import '../../../../core/errors/failures.dart';
import '../../../../core/network/api_client.dart';
import '../../domain/entities/user_entity.dart';
import '../../domain/repositories/auth_repository.dart';
import '../datasources/auth_remote_datasource.dart';

class AuthRepositoryImpl implements AuthRepository {
  final AuthRemoteDataSource _remote;
  final FlutterSecureStorage _storage;

  const AuthRepositoryImpl(this._remote, this._storage);

  @override
  Future<({Failure? failure})> sendOtp({
    required String phone,
    required String role,
  }) async {
    try {
      await _remote.sendOtp(phone: phone, role: role);
      return (failure: null);
    } on DioException catch (e) {
      return (failure: dioToFailure(e));
    }
  }

  @override
  Future<({TokenPairEntity? tokens, Failure? failure})> verifyOtp({
    required String phone,
    required String otp,
    required String role,
  }) async {
    try {
      final model = await _remote.verifyOtp(phone: phone, otp: otp, role: role);
      final entity = model.toEntity();

      // Persist tokens and user info
      await _storage.write(key: AppConstants.accessTokenKey,  value: entity.accessToken);
      await _storage.write(key: AppConstants.refreshTokenKey, value: entity.refreshToken);
      await _storage.write(key: AppConstants.userRoleKey,     value: entity.user.role);
      await _storage.write(key: AppConstants.userIdKey,       value: entity.user.id);

      return (tokens: entity, failure: null);
    } on DioException catch (e) {
      return (tokens: null, failure: dioToFailure(e));
    }
  }

  @override
  Future<void> logout() async {
    final refresh = await _storage.read(key: AppConstants.refreshTokenKey);
    if (refresh != null) {
      try {
        await _remote.logout(refreshToken: refresh);
      } catch (_) {}
    }
    await _storage.deleteAll();
  }

  @override
  Future<UserEntity?> getCurrentUser() async {
    try {
      final model = await _remote.getMe();
      return model.toEntity();
    } catch (_) {
      return null;
    }
  }
}
