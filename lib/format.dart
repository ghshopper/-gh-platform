import 'package:intl/intl.dart';

final _omr = NumberFormat('#,##0.000');
final _cur = NumberFormat('#,##0.00');
final _date = DateFormat('d/M/yyyy');

/// 12.500 ر.ع
String omr(num v) => '${_omr.format(v)} ر.ع';

/// 12.500 OMR (for PDFs, where mixed-direction text is safer in Latin)
String omrLatin(num v) => '${_omr.format(v)} OMR';

String plainOmr(num v) => _omr.format(v);

String money(num v, String currency) => '${_cur.format(v)} $currency';

String dateStr(DateTime? d) => d == null ? '—' : _date.format(d.toLocal());

/// Converts Arabic-Indic / Persian digits and separators to ASCII so that
/// numbers typed on an Arabic keyboard parse correctly.
String normalizeDigits(String input) {
  const arabic = '٠١٢٣٤٥٦٧٨٩';
  const persian = '۰۱۲۳۴۵۶۷۸۹';
  final b = StringBuffer();
  for (final ch in input.split('')) {
    final a = arabic.indexOf(ch);
    final p = persian.indexOf(ch);
    if (a >= 0) {
      b.write(a);
    } else if (p >= 0) {
      b.write(p);
    } else if (ch == '٫' || ch == ',') {
      b.write('.');
    } else if (ch == '٬') {
      // thousands separator: skip
    } else {
      b.write(ch);
    }
  }
  return b.toString().trim();
}

double? parseAmount(String input) {
  final s = normalizeDigits(input);
  if (s.isEmpty) return null;
  return double.tryParse(s);
}

/// Phone number in the form wa.me expects (digits only, with country code).
String? waPhone(String? phone) {
  if (phone == null) return null;
  var d = normalizeDigits(phone).replaceAll(RegExp(r'[^0-9]'), '');
  if (d.isEmpty) return null;
  if (d.startsWith('00')) d = d.substring(2);
  if (d.length == 8) d = '968$d'; // Omani local number
  return d;
}
