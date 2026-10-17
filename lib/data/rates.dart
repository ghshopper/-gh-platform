import 'dart:convert';

import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

import '../models.dart';

/// Live exchange rates (OMR per one unit of a currency), refreshed at most
/// every 6 hours and cached on the phone. Falls back to [defaultRates].
class Rates {
  Rates._();
  static final Rates i = Rates._();

  static const _key = 'gh_rates_v1';
  Map<String, double> _rates = {};
  DateTime? updatedAt;

  double rate(String currency) =>
      _rates[currency] ?? defaultRates[currency] ?? 1;

  bool get isLive => _rates.isNotEmpty;

  Future<void> load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_key);
      if (raw != null) {
        final m = jsonDecode(raw) as Map<String, dynamic>;
        _rates = (m['rates'] as Map)
            .map((k, v) => MapEntry(k as String, (v as num).toDouble()));
        updatedAt = DateTime.tryParse(m['at'] as String? ?? '');
      }
      final fresh = updatedAt != null &&
          DateTime.now().difference(updatedAt!) < const Duration(hours: 6);
      if (!fresh) await _fetch(prefs);
    } catch (_) {
      // Offline or service down: keep cached/default rates.
    }
  }

  Future<void> _fetch(SharedPreferences prefs) async {
    final res = await http
        .get(Uri.parse('https://open.er-api.com/v6/latest/OMR'))
        .timeout(const Duration(seconds: 8));
    if (res.statusCode != 200) return;
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    final perOmr = (body['rates'] as Map?) ?? const {};
    final out = <String, double>{};
    for (final c in defaultRates.keys) {
      final v = perOmr[c];
      if (v is num && v > 0) out[c] = 1 / v.toDouble();
    }
    if (out.isEmpty) return;
    _rates = out;
    updatedAt = DateTime.now();
    await prefs.setString(
        _key, jsonEncode({'rates': out, 'at': updatedAt!.toIso8601String()}));
  }

  /// Rounded for display in input fields.
  String rateText(String currency) {
    final r = rate(currency);
    return r >= 1 ? r.toStringAsFixed(3) : r.toStringAsFixed(4);
  }
}
