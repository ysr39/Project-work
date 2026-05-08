import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

import '../constants/app_constants.dart';

// Mirror of server-side event names
class SocketEvents {
  SocketEvents._();

  // Client → Server
  static const String driverLocation = 'driver:location';
  static const String driverOnline   = 'driver:online';
  static const String driverOffline  = 'driver:offline';
  static const String tripAccept     = 'trip:accept';
  static const String tripDecline    = 'trip:decline';
  static const String tripArrived    = 'trip:arrived';
  static const String tripPickup     = 'trip:pickup';
  static const String tripDropoff    = 'trip:dropoff';
  static const String tripJoinRoom   = 'trip:join_room';

  // Server → Client
  static const String tripNewRequest     = 'trip:new_request';
  static const String tripAcceptTimeout  = 'trip:accept_timeout';
  static const String tripMatched        = 'trip:matched';
  static const String tripDriverLocation = 'trip:driver_location';
  static const String tripStatusChanged  = 'trip:status_changed';
  static const String tripDriverArrived  = 'trip:driver_arrived';
  static const String tripCompleted      = 'trip:completed';
  static const String tripCancelled      = 'trip:cancelled';
  static const String tripNoDriver       = 'trip:no_driver';
  static const String notificationPush   = 'notification:push';
  static const String adminLiveUpdate    = 'admin:live_update';
  static const String error              = 'error';
}

class SocketClient {
  io.Socket? _socket;
  final FlutterSecureStorage _storage;

  SocketClient(this._storage);

  bool get isConnected => _socket?.connected ?? false;

  Future<void> connect() async {
    if (isConnected) return;

    final token = await _storage.read(key: AppConstants.accessTokenKey);
    if (token == null) return;

    _socket = io.io(
      AppConstants.socketUrl,
      io.OptionBuilder()
          .setTransports(['websocket'])
          .disableAutoConnect()
          .setAuth({'token': token})
          .setTimeout(20000)
          .setReconnectionAttempts(5)
          .setReconnectionDelay(2000)
          .build(),
    );

    _socket!.connect();
  }

  void disconnect() {
    _socket?.disconnect();
    _socket = null;
  }

  void emit(String event, dynamic data) {
    _socket?.emit(event, data);
  }

  void on(String event, void Function(dynamic) callback) {
    _socket?.on(event, callback);
  }

  void off(String event) {
    _socket?.off(event);
  }

  void onConnect(void Function() callback) {
    _socket?.onConnect((_) => callback());
  }

  void onDisconnect(void Function() callback) {
    _socket?.onDisconnect((_) => callback());
  }

  void onError(void Function(dynamic) callback) {
    _socket?.on(SocketEvents.error, callback);
  }
}
