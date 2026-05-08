import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../constants/app_constants.dart';
import '../di/injection.dart';
import '../../features/auth/presentation/pages/phone_entry_page.dart';
import '../../features/auth/presentation/pages/otp_verification_page.dart';
import '../../features/rider/presentation/pages/rider_dashboard_page.dart';
import '../../features/rider/presentation/pages/booking_page.dart';
import '../../features/rider/presentation/pages/ride_tracking_page.dart';
import '../../features/driver/presentation/pages/driver_dashboard_page.dart';
import '../../features/driver/presentation/pages/driver_trip_page.dart';
import '../../features/wallet/presentation/pages/wallet_page.dart';
import '../../features/history/presentation/pages/history_page.dart';

class AppRoutes {
  AppRoutes._();
  static const String splash          = '/';
  static const String phoneEntry      = '/auth/phone';
  static const String otpVerification = '/auth/otp';
  static const String riderDashboard  = '/rider';
  static const String booking         = '/rider/booking';
  static const String rideTracking    = '/rider/tracking';
  static const String driverDashboard = '/driver';
  static const String driverTrip      = '/driver/trip';
  static const String wallet          = '/wallet';
  static const String history         = '/history';
}

GoRouter buildAppRouter() {
  final storage = sl<FlutterSecureStorage>();

  return GoRouter(
    initialLocation: AppRoutes.splash,
    redirect: (context, state) async {
      final token = await storage.read(key: AppConstants.accessTokenKey);
      final role  = await storage.read(key: AppConstants.userRoleKey);
      final isAuth = token != null;

      final onAuth = state.matchedLocation == AppRoutes.phoneEntry ||
          state.matchedLocation == AppRoutes.otpVerification;

      if (!isAuth && !onAuth) return AppRoutes.phoneEntry;
      if (isAuth && state.matchedLocation == AppRoutes.splash) {
        return role == 'DRIVER' ? AppRoutes.driverDashboard : AppRoutes.riderDashboard;
      }
      return null;
    },
    routes: [
      GoRoute(path: AppRoutes.splash, builder: (_, __) => const _SplashPage()),
      GoRoute(path: AppRoutes.phoneEntry, builder: (_, __) => const PhoneEntryPage()),
      GoRoute(
        path: AppRoutes.otpVerification,
        builder: (_, state) {
          final extra = state.extra as Map<String, String>;
          return OtpVerificationPage(phone: extra['phone']!, role: extra['role']!);
        },
      ),
      GoRoute(path: AppRoutes.riderDashboard, builder: (_, __) => const RiderDashboardPage()),
      GoRoute(
        path: AppRoutes.booking,
        builder: (_, state) {
          final extra = state.extra as Map<String, dynamic>?;
          return BookingPage(initialAddress: extra?['address'] as String?);
        },
      ),
      GoRoute(
        path: AppRoutes.rideTracking,
        builder: (_, state) {
          final tripId = state.extra as String;
          return RideTrackingPage(tripId: tripId);
        },
      ),
      GoRoute(path: AppRoutes.driverDashboard, builder: (_, __) => const DriverDashboardPage()),
      GoRoute(
        path: AppRoutes.driverTrip,
        builder: (_, state) {
          final tripId = state.extra as String;
          return DriverTripPage(tripId: tripId);
        },
      ),
      GoRoute(path: AppRoutes.wallet,  builder: (_, __) => const WalletPage()),
      GoRoute(path: AppRoutes.history, builder: (_, __) => const HistoryPage()),
    ],
  );
}

class _SplashPage extends StatelessWidget {
  const _SplashPage();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(child: CircularProgressIndicator()),
    );
  }
}
