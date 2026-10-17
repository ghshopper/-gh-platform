import 'package:local_auth/local_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Optional Face ID / passcode lock when opening the app.
class AppLock {
  AppLock._();
  static final AppLock i = AppLock._();

  static const _key = 'gh_face_id';
  final _auth = LocalAuthentication();

  Future<bool> isEnabled() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_key) ?? false;
  }

  Future<void> setEnabled(bool value) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_key, value);
  }

  Future<bool> isAvailable() async {
    try {
      return await _auth.isDeviceSupported();
    } catch (_) {
      return false;
    }
  }

  Future<bool> unlock() async {
    try {
      return await _auth.authenticate(
        localizedReason: 'افتح GH Shopper',
      );
    } catch (_) {
      return false;
    }
  }
}
