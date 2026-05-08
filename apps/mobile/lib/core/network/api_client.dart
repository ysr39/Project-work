import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:pretty_dio_logger/pretty_dio_logger.dart';

import '../constants/app_constants.dart';
import '../errors/failures.dart';

class ApiClient {
  late final Dio _dio;
  final FlutterSecureStorage _storage;

  ApiClient(this._storage) {
    _dio = Dio(
      BaseOptions(
        baseUrl:        AppConstants.baseUrl,
        connectTimeout: AppConstants.connectTimeout,
        receiveTimeout: AppConstants.receiveTimeout,
        headers: {'Content-Type': 'application/json'},
      ),
    )
      ..interceptors.add(_AuthInterceptor(_storage, this))
      ..interceptors.add(PrettyDioLogger(requestBody: true, responseBody: true));
  }

  Dio get dio => _dio;

  Future<Response<T>> get<T>(String path, {Map<String, dynamic>? params}) =>
      _dio.get<T>(path, queryParameters: params);

  Future<Response<T>> post<T>(String path, {dynamic data}) =>
      _dio.post<T>(path, data: data);

  Future<Response<T>> patch<T>(String path, {dynamic data}) =>
      _dio.patch<T>(path, data: data);

  Future<Response<T>> delete<T>(String path, {dynamic data}) =>
      _dio.delete<T>(path, data: data);

  Future<String?> getAccessToken() => _storage.read(key: AppConstants.accessTokenKey);
}

class _AuthInterceptor extends Interceptor {
  final FlutterSecureStorage _storage;
  final ApiClient _client;

  _AuthInterceptor(this._storage, this._client);

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final token = await _storage.read(key: AppConstants.accessTokenKey);
    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    if (err.response?.statusCode == 401) {
      final refreshed = await _tryRefresh();
      if (refreshed) {
        final opts = err.requestOptions;
        final token = await _storage.read(key: AppConstants.accessTokenKey);
        opts.headers['Authorization'] = 'Bearer $token';
        try {
          final response = await _client.dio.fetch(opts);
          return handler.resolve(response);
        } catch (_) {}
      }
      // Refresh failed — clear tokens (router guard will redirect to login)
      await _storage.deleteAll();
    }
    handler.next(err);
  }

  Future<bool> _tryRefresh() async {
    try {
      final refresh = await _storage.read(key: AppConstants.refreshTokenKey);
      if (refresh == null) return false;

      final response = await _client.dio.post(
        ApiEndpoints.refresh,
        data: {'refreshToken': refresh},
        options: Options(headers: {'Authorization': null}),
      );

      final data = response.data as Map<String, dynamic>;
      await _storage.write(
        key: AppConstants.accessTokenKey,
        value: data['data']['accessToken'] as String,
      );
      return true;
    } catch (_) {
      return false;
    }
  }
}

Failure dioToFailure(DioException e) {
  switch (e.type) {
    case DioExceptionType.connectionTimeout:
    case DioExceptionType.receiveTimeout:
    case DioExceptionType.connectionError:
      return const NetworkFailure();
    default:
      final code = e.response?.statusCode;
      final msg  = (e.response?.data as Map<String, dynamic>?)?['message']
                   as String? ?? e.message ?? 'Unknown error';
      if (code == 401) return const UnauthorizedFailure();
      if (code == 404) return const NotFoundFailure();
      if (code == 422) return ValidationFailure(msg);
      return ServerFailure(msg);
  }
}
