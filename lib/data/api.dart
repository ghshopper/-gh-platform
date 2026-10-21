import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;

import '../config.dart';

/// A failed request, with a message that can be shown to the user.
class ApiException implements Exception {
  ApiException(this.message, {this.status});
  final String message;
  final int? status;
  @override
  String toString() => message;
}

/// The signed-in account: the owner (admin) or a delivery driver.
class Session {
  Session({required this.token, required this.role, required this.name});
  final String token;
  final String role; // admin / driver
  final String name;

  bool get isDriver => role == 'driver';
}

/// Talks to the GH Shopper server (ghshopper.com). The login token is kept
/// in the iPhone keychain.
/// The account asks for the authenticator code before signing in.
class TwoFactorRequired implements Exception {
  TwoFactorRequired(this.challenge);
  final String challenge;
}

class Api extends ChangeNotifier {
  Api._();
  static final Api i = Api._();

  static const _storage = FlutterSecureStorage();
  static const _kToken = 'gh_api_token';
  static const _kRole = 'gh_api_role';
  static const _kName = 'gh_api_name';

  Session? session;
  bool restored = false;

  String get base => AppConfig.apiBaseUrl;

  /// A stable key for the on-phone cache of the current account.
  String get cacheKey => '${session?.role ?? ''}:${session?.name ?? ''}';

  // ───────────── session ─────────────

  Future<void> restore() async {
    try {
      final token = await _storage.read(key: _kToken);
      final role = await _storage.read(key: _kRole);
      final name = await _storage.read(key: _kName);
      if (token != null && role != null) {
        session = Session(token: token, role: role, name: name ?? '');
      }
    } catch (_) {
      session = null;
    }
    restored = true;
    notifyListeners();
  }

  /// Drivers type their phone; it maps to their private sign-in e-mail.
  static String loginEmail(String input) {
    final t = input.trim();
    if (t.contains('@')) return t;
    var d = t.replaceAll(RegExp(r'\D'), '');
    if (d.length == 8) d = '968$d';
    return 'd$d@drivers.ghshopper.com';
  }

  Future<void> login(String emailOrPhone, String password) async {
    final res = await _send('POST', '/auth/login',
        body: {
          'email': loginEmail(emailOrPhone),
          'password': password,
          'device': 'gh-iphone',
        },
        auth: false);
    // the authenticator-app step is on for this account
    if (res['two_factor_required'] == true) {
      throw TwoFactorRequired((res['challenge'] ?? '').toString());
    }
    final token = res['token'] as String?;
    if (token == null) throw ApiException('ما قدرنا نسجّل دخول');
    await _finishLogin(token);
  }

  /// Second step: the 6-digit code from the authenticator app.
  Future<void> loginTwoFactor(String challenge, String code) async {
    final res = await _send('POST', '/auth/two-factor',
        body: {'challenge': challenge, 'code': code}, auth: false);
    final token = res['token'] as String?;
    if (token == null) throw ApiException('الرمز غير صحيح');
    await _finishLogin(token);
  }

  Future<void> _finishLogin(String token) async {
    final me = await _send('GET', '/ps/me', token: token);
    final role = (me['role'] ?? 'none').toString();
    if (role != 'admin' && role != 'driver') {
      _send('POST', '/auth/logout', token: token).ignore();
      throw ApiException('هذا الحساب ما له صلاحية على التطبيق');
    }
    session = Session(token: token, role: role, name: (me['name'] ?? '').toString());
    await _storage.write(key: _kToken, value: token);
    await _storage.write(key: _kRole, value: role);
    await _storage.write(key: _kName, value: session!.name);
    notifyListeners();
  }

  Future<void> logout() async {
    final token = session?.token;
    session = null;
    await _storage.delete(key: _kToken);
    await _storage.delete(key: _kRole);
    await _storage.delete(key: _kName);
    notifyListeners();
    if (token != null) {
      _send('POST', '/auth/logout', token: token).ignore();
    }
  }

  // ───────────── requests ─────────────

  Future<dynamic> get(String path) => _send('GET', path);
  Future<dynamic> post(String path, [Map<String, dynamic>? body]) =>
      _send('POST', path, body: body ?? {});
  Future<dynamic> put(String path, [Map<String, dynamic>? body]) =>
      _send('PUT', path, body: body ?? {});
  Future<dynamic> patch(String path, [Map<String, dynamic>? body]) =>
      _send('PATCH', path, body: body ?? {});
  Future<dynamic> delete(String path, [Map<String, dynamic>? body]) =>
      _send('DELETE', path, body: body);

  /// Sends a photo with optional form fields.
  Future<dynamic> upload(String path, String field, Uint8List bytes,
      {Map<String, String> fields = const {}}) async {
    final req = http.MultipartRequest('POST', Uri.parse('$base$path'))
      ..headers.addAll(_headers(session?.token))
      ..fields.addAll(fields)
      ..files.add(http.MultipartFile.fromBytes(field, bytes,
          filename: 'photo.jpg'));
    final streamed =
        await req.send().timeout(const Duration(seconds: 60));
    final res = await http.Response.fromStream(streamed);
    return _decode(res);
  }

  Map<String, String> _headers(String? token) => {
        'Accept': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      };

  Future<dynamic> _send(String method, String path,
      {Map<String, dynamic>? body, bool auth = true, String? token}) async {
    final t = token ?? (auth ? session?.token : null);
    final headers = _headers(t);
    if (body != null) headers['Content-Type'] = 'application/json';
    final req = http.Request(method, Uri.parse('$base$path'))
      ..headers.addAll(headers);
    if (body != null) req.body = jsonEncode(body);
    final http.Response res;
    try {
      res = await http.Response.fromStream(
          await req.send().timeout(const Duration(seconds: 30)));
    } catch (_) {
      throw ApiException('ما في اتصال بالإنترنت أو السيرفر ما رد');
    }
    return _decode(res);
  }

  dynamic _decode(http.Response res) {
    dynamic data;
    try {
      data = res.body.isEmpty ? null : jsonDecode(utf8.decode(res.bodyBytes));
    } catch (_) {
      data = null;
    }
    if (res.statusCode >= 200 && res.statusCode < 300) return data;

    final expired = res.statusCode == 401 && session != null;
    if (expired) logout(); // token expired or revoked
    String? msg;
    if (data is Map) {
      msg = data['message']?.toString();
      final errors = data['errors'];
      if (errors is Map && errors.isNotEmpty) {
        final first = errors.values.first;
        msg = first is List && first.isNotEmpty ? first.first.toString() : msg;
      }
    }
    if (expired) msg = 'انتهت الجلسة، سجّل دخول مرة ثانية';
    if (res.statusCode == 403) msg ??= 'ما عندك صلاحية';
    if (res.statusCode >= 500) msg = 'صار خطأ في السيرفر، حاول بعد شوي';
    throw ApiException(msg ?? 'صار خطأ (${res.statusCode})',
        status: res.statusCode);
  }
}
