import 'package:get_it/get_it.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../network/api_client.dart';
import '../network/socket_client.dart';

import '../../features/auth/data/datasources/auth_remote_datasource.dart';
import '../../features/auth/data/repositories/auth_repository_impl.dart';
import '../../features/auth/domain/repositories/auth_repository.dart';
import '../../features/auth/domain/usecases/send_otp_usecase.dart';
import '../../features/auth/domain/usecases/verify_otp_usecase.dart';
import '../../features/auth/presentation/cubit/auth_cubit.dart';

import '../../features/rider/data/datasources/rider_remote_datasource.dart';
import '../../features/rider/data/repositories/rider_repository_impl.dart';
import '../../features/rider/domain/repositories/rider_repository.dart';
import '../../features/rider/domain/usecases/request_pool_ride_usecase.dart';
import '../../features/rider/domain/usecases/cancel_ride_usecase.dart';
import '../../features/rider/presentation/cubit/rider_cubit.dart';

import '../../features/driver/data/datasources/driver_remote_datasource.dart';
import '../../features/driver/data/repositories/driver_repository_impl.dart';
import '../../features/driver/domain/repositories/driver_repository.dart';
import '../../features/driver/presentation/cubit/driver_cubit.dart';

import '../../features/wallet/data/datasources/wallet_remote_datasource.dart';
import '../../features/wallet/data/repositories/wallet_repository_impl.dart';
import '../../features/wallet/domain/repositories/wallet_repository.dart';
import '../../features/wallet/presentation/cubit/wallet_cubit.dart';

import '../../features/history/data/datasources/history_remote_datasource.dart';
import '../../features/history/data/repositories/history_repository_impl.dart';
import '../../features/history/domain/repositories/history_repository.dart';
import '../../features/history/presentation/cubit/history_cubit.dart';

final sl = GetIt.instance;

Future<void> configureDependencies() async {
  // Core
  const storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );
  final prefs = await SharedPreferences.getInstance();

  sl
    ..registerSingleton<FlutterSecureStorage>(storage)
    ..registerSingleton<SharedPreferences>(prefs)
    ..registerSingleton<ApiClient>(ApiClient(storage))
    ..registerSingleton<SocketClient>(SocketClient(storage));

  // Auth
  sl
    ..registerSingleton<AuthRemoteDataSource>(AuthRemoteDataSource(sl()))
    ..registerSingleton<AuthRepository>(AuthRepositoryImpl(sl(), sl()))
    ..registerFactory<SendOtpUseCase>(() => SendOtpUseCase(sl()))
    ..registerFactory<VerifyOtpUseCase>(() => VerifyOtpUseCase(sl()))
    ..registerFactory<AuthCubit>(() => AuthCubit(sl(), sl()));

  // Rider
  sl
    ..registerSingleton<RiderRemoteDataSource>(RiderRemoteDataSource(sl()))
    ..registerSingleton<RiderRepository>(RiderRepositoryImpl(sl()))
    ..registerFactory<RequestPoolRideUseCase>(() => RequestPoolRideUseCase(sl()))
    ..registerFactory<CancelRideUseCase>(() => CancelRideUseCase(sl()))
    ..registerFactory<RiderCubit>(() => RiderCubit(sl(), sl(), sl()));

  // Driver
  sl
    ..registerSingleton<DriverRemoteDataSource>(DriverRemoteDataSource(sl()))
    ..registerSingleton<DriverRepository>(DriverRepositoryImpl(sl()))
    ..registerFactory<DriverCubit>(() => DriverCubit(sl(), sl()));

  // Wallet
  sl
    ..registerSingleton<WalletRemoteDataSource>(WalletRemoteDataSource(sl()))
    ..registerSingleton<WalletRepository>(WalletRepositoryImpl(sl()))
    ..registerFactory<WalletCubit>(() => WalletCubit(sl()));

  // History
  sl
    ..registerSingleton<HistoryRemoteDataSource>(HistoryRemoteDataSource(sl()))
    ..registerSingleton<HistoryRepository>(HistoryRepositoryImpl(sl()))
    ..registerFactory<HistoryCubit>(() => HistoryCubit(sl()));
}
