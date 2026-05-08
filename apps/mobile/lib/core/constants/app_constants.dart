class AppConstants {
  AppConstants._();

  static const String appName = 'TaxiPool';
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:3000/api/v1',
  );
  static const String socketUrl = String.fromEnvironment(
    'SOCKET_URL',
    defaultValue: 'http://10.0.2.2:3000',
  );
  static const String googleMapsApiKey = String.fromEnvironment('MAPS_API_KEY');

  // Storage keys
  static const String accessTokenKey  = 'access_token';
  static const String refreshTokenKey = 'refresh_token';
  static const String userRoleKey     = 'user_role';
  static const String userIdKey       = 'user_id';

  // Timeouts
  static const Duration connectTimeout = Duration(seconds: 15);
  static const Duration receiveTimeout = Duration(seconds: 30);

  // Map defaults
  static const double defaultZoom      = 15.0;
  static const double nearbyDriverZoom = 14.0;

  // Trip accept window
  static const int tripAcceptWindowSec = 30;
}

class ApiEndpoints {
  ApiEndpoints._();

  // Auth
  static const String sendOtp    = '/auth/send-otp';
  static const String verifyOtp  = '/auth/verify-otp';
  static const String refresh    = '/auth/refresh';
  static const String logout     = '/auth/logout';

  // Users
  static const String me         = '/users/me';
  static const String updateMe   = '/users/me';

  // Drivers
  static const String driverMe   = '/drivers/me';
  static const String driverOnboard = '/drivers/onboard';
  static const String driverStatus  = '/drivers/me/status';

  // Pooling
  static const String poolRequest   = '/pooling/request';
  static const String poolEstimate  = '/pooling/estimate';
  static String poolTrip(String id)    => '/pooling/$id';
  static String cancelRider(String id) => '/pooling/$id/cancel';

  // Trips
  static const String tripHistory      = '/trips/history';
  static const String driverHistory    = '/trips/driver/history';
  static String tripById(String id)    => '/trips/$id';

  // Payments
  static const String paymentIntent    = '/payments/intent';
  static const String paymentHistory   = '/payments/history';
}
