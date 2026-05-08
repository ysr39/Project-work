import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

import 'core/di/injection.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';

final _localNotifications = FlutterLocalNotificationsPlugin();

@pragma('vm:entry-point')
Future<void> _firebaseBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  // Background FCM handler — minimal work only
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Firebase.initializeApp();
  FirebaseMessaging.onBackgroundMessage(_firebaseBackgroundHandler);

  // Local notifications for foreground FCM
  await _localNotifications.initialize(
    const InitializationSettings(
      android: AndroidInitializationSettings('@mipmap/ic_launcher'),
      iOS:     DarwinInitializationSettings(),
    ),
  );

  await configureDependencies();

  runApp(const TaxiPoolApp());
}

class TaxiPoolApp extends StatefulWidget {
  const TaxiPoolApp({super.key});

  @override
  State<TaxiPoolApp> createState() => _TaxiPoolAppState();
}

class _TaxiPoolAppState extends State<TaxiPoolApp> {
  late final _router = buildAppRouter();

  @override
  void initState() {
    super.initState();
    _setupForegroundFCM();
  }

  void _setupForegroundFCM() {
    FirebaseMessaging.onMessage.listen((msg) {
      final notification = msg.notification;
      if (notification == null) return;

      _localNotifications.show(
        notification.hashCode,
        notification.title,
        notification.body,
        NotificationDetails(
          android: AndroidNotificationDetails(
            'taxipool_channel',
            'TaxiPool Notifications',
            importance: Importance.high,
            priority:   Priority.high,
            icon:       '@mipmap/ic_launcher',
          ),
          iOS: const DarwinNotificationDetails(),
        ),
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title:        'TaxiPool',
      theme:        AppTheme.light,
      routerConfig: _router,
      debugShowCheckedModeBanner: false,
    );
  }
}
