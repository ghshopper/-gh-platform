import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import '../pages/order_detail_page.dart';
import '../pages/requests_page.dart';
import '../ui/kit.dart';
import 'api.dart';
import 'store.dart';

/// The navigator of the app that is showing now (one per light/dark build),
/// so a tapped notification can open a page from anywhere.
final navigatorKeys = <bool, GlobalKey<NavigatorState>>{
  false: GlobalKey<NavigatorState>(debugLabel: 'light'),
  true: GlobalKey<NavigatorState>(debugLabel: 'dark'),
};
GlobalKey<NavigatorState> currentNavigator = navigatorKeys[false]!;

/// Staff notifications (new order, payment, piece request) through Firebase.
///
/// Firebase is set up from `assets/firebase/GoogleService-Info.plist` when
/// it is in the app, or from the plist in the iOS bundle. Anything missing
/// or failing is ignored: the app works the same, just without pushes.
class Push {
  Push._();
  static final Push i = Push._();

  bool _ready = false;
  bool _listening = false;
  String? _sentFor;

  /// Reads the options out of the bundled GoogleService-Info.plist.
  static Future<FirebaseOptions?> _optionsFromAsset() async {
    try {
      final xml = await rootBundle.loadString('assets/firebase/GoogleService-Info.plist');
      String? v(String key) => RegExp('<key>$key</key>\\s*<string>([^<]*)</string>').firstMatch(xml)?.group(1);
      final apiKey = v('API_KEY');
      final appId = v('GOOGLE_APP_ID');
      final sender = v('GCM_SENDER_ID');
      final project = v('PROJECT_ID');
      if (apiKey == null || appId == null || sender == null || project == null) return null;
      return FirebaseOptions(
        apiKey: apiKey,
        appId: appId,
        messagingSenderId: sender,
        projectId: project,
        storageBucket: v('STORAGE_BUCKET'),
        iosBundleId: v('BUNDLE_ID'),
      );
    } catch (_) {
      return null;
    }
  }

  Future<bool> _init() async {
    if (_ready) return true;
    if (kIsWeb || defaultTargetPlatform != TargetPlatform.iOS && defaultTargetPlatform != TargetPlatform.android) {
      return false;
    }
    try {
      if (Firebase.apps.isEmpty) {
        final options = await _optionsFromAsset();
        if (options != null) {
          await Firebase.initializeApp(options: options);
        } else {
          await Firebase.initializeApp(); // native plist, if there is one
        }
      }
      _ready = true;
    } catch (e) {
      debugPrint('Push: Firebase not set up ($e)');
    }
    return _ready;
  }

  /// After sign-in (staff only): ask for permission, send the token to the
  /// server and listen for notifications. Never throws.
  Future<void> start() async {
    try {
      final session = Api.i.session;
      if (session == null || session.isDriver) return;
      if (!await _init()) return;
      final fm = FirebaseMessaging.instance;
      final perm = await fm.requestPermission(alert: true, badge: true, sound: true);
      if (perm.authorizationStatus == AuthorizationStatus.denied) return;
      await fm.setForegroundNotificationPresentationOptions(alert: false, badge: true, sound: true);

      if (!_listening) {
        _listening = true;
        FirebaseMessaging.onMessage.listen(_onForeground);
        FirebaseMessaging.onMessageOpenedApp.listen((m) => open(m.data));
        fm.onTokenRefresh.listen(_register);
        final first = await fm.getInitialMessage();
        if (first != null) {
          // Give the tabs a moment to load before opening the page.
          Future.delayed(const Duration(milliseconds: 700), () => open(first.data));
        }
      }

      // On iOS the FCM token needs the APNs token first; it can take a moment.
      if (defaultTargetPlatform == TargetPlatform.iOS) {
        for (var i = 0; i < 10 && await fm.getAPNSToken() == null; i++) {
          await Future.delayed(const Duration(milliseconds: 600));
        }
      }
      final token = await fm.getToken();
      if (token != null) await _register(token);
    } catch (e) {
      debugPrint('Push: start failed ($e)');
    }
  }

  Future<void> _register(String token) async {
    final key = '${Api.i.session?.token}:$token';
    if (_sentFor == key) return;
    try {
      await Api.i.post('/ps/push-device', {
        'token': token,
        'platform': defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android',
      });
      _sentFor = key;
    } catch (e) {
      debugPrint('Push: register failed ($e)');
    }
  }

  void _onForeground(RemoteMessage m) {
    if (m.data['channel'] != null && m.data['channel'] != 'staff') return;
    Store.i.refresh();
    final ctx = currentNavigator.currentContext;
    if (ctx == null) return;
    final n = m.notification;
    final text = [n?.title, n?.body].whereType<String>().where((s) => s.trim().isNotEmpty).join(' · ');
    toast(ctx, text.isEmpty ? 'إشعار جديد' : text,
        icon: _icon(m.data['type']?.toString()), onTap: () => open(m.data));
  }

  static IconData _icon(String? type) => switch (type) {
        'payment' => CupertinoIcons.creditcard_fill,
        'product_request' => CupertinoIcons.sparkles,
        _ => CupertinoIcons.bell_fill,
      };

  /// Opens what a notification is about: the order, or the piece requests.
  Future<void> open(Map<String, dynamic> data) async {
    final nav = currentNavigator.currentState;
    if (nav == null) return;
    final type = data['type']?.toString();
    final orderId = data['ps_order_id']?.toString();
    if (type == 'product_request' || (orderId == null || orderId.isEmpty)) {
      if (type == 'product_request') {
        Store.i.refresh();
        nav.push(CupertinoPageRoute(builder: (_) => const RequestsPage()));
      }
      return;
    }
    if (Store.i.order(orderId) == null) {
      await Store.i.refresh();
    }
    if (Store.i.order(orderId) == null) return;
    currentNavigator.currentState
        ?.push(CupertinoPageRoute(builder: (_) => OrderDetailPage(orderId: orderId)));
  }
}
