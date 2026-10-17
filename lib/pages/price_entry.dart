import 'package:flutter/cupertino.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../data/rates.dart';
import '../format.dart';
import '../models.dart';
import '../ui/colors.dart';
import '../ui/kit.dart';

/// Currencies offered when typing a selling price.
const priceCurrencies = {'OMR': 'ر.ع', 'EUR': '€ يورو', 'AED': 'درهم'};

const _commissionKey = 'gh_last_commission';
double _lastCommission = 0;
bool _commissionLoaded = false;

Future<void> _loadCommission() async {
  if (_commissionLoaded) return;
  _commissionLoaded = true;
  try {
    final p = await SharedPreferences.getInstance();
    _lastCommission = p.getDouble(_commissionKey) ?? 0;
  } catch (_) {}
}

Future<void> rememberCommission(double v) async {
  _lastCommission = v;
  try {
    final p = await SharedPreferences.getInstance();
    await p.setDouble(_commissionKey, v);
  } catch (_) {}
}

String _num(double v, {int digits = 2}) {
  var s = v.toStringAsFixed(digits);
  if (s.contains('.')) s = s.replaceFirst(RegExp(r'\.?0+$'), '');
  return s;
}

/// Selling price typed in OMR, EUR or AED. Foreign prices are converted at
/// today's rate plus a commission, and the OMR result stays editable.
class PriceDraft {
  PriceDraft({OrderItem? item}) {
    if (item != null) {
      currency = item.listCurrency ?? 'OMR';
      if (item.listPrice != null) foreign.text = _num(item.listPrice!);
      if (item.commissionPct != null) {
        commission.text = _num(item.commissionPct!);
      }
      if (item.price > 0) omrCtrl.text = _num(item.price, digits: 3);
    } else {
      _loadCommission().then((_) {
        if (commission.text.isEmpty && _lastCommission > 0) {
          commission.text = _num(_lastCommission);
        }
      });
      if (_lastCommission > 0) commission.text = _num(_lastCommission);
    }
  }

  String currency = 'OMR';
  final foreign = TextEditingController();
  final commission = TextEditingController();
  final omrCtrl = TextEditingController();

  bool get isForeign => currency != 'OMR';
  double get rate => Rates.i.rate(currency);
  double get foreignAmount => parseAmount(foreign.text) ?? 0;
  double get commissionPct => parseAmount(commission.text) ?? 0;
  double get computed => foreignAmount * rate * (1 + commissionPct / 100);
  double get omrValue => parseAmount(omrCtrl.text) ?? 0;

  void recompute() {
    if (!isForeign) return;
    omrCtrl.text = foreignAmount > 0 ? _num(computed, digits: 3) : '';
  }

  /// Database fields for gh_order_items.
  Map<String, dynamic> toMap() => {
        'price': omrValue,
        'list_price': isForeign && foreignAmount > 0 ? foreignAmount : null,
        'list_currency': isForeign && foreignAmount > 0 ? currency : null,
        'commission_pct': isForeign && foreignAmount > 0 ? commissionPct : null,
      };

  Future<void> remember() async {
    if (isForeign) await rememberCommission(commissionPct);
  }

  void dispose() {
    foreign.dispose();
    commission.dispose();
    omrCtrl.dispose();
  }

  /// Rows to place inside a [Section].
  List<Widget> rows(VoidCallback refresh) {
    final symbol = currency == 'EUR' ? '€' : currency == 'AED' ? 'د.إ' : 'ر.ع';
    return [
      Segments<String>(
        value: currency,
        options: priceCurrencies,
        onChanged: (c) {
          currency = c;
          recompute();
          refresh();
        },
      ),
      if (isForeign) ...[
        AmountRow(
          label: currency == 'EUR' ? 'السعر باليورو' : 'السعر بالدرهم',
          controller: foreign,
          suffix: symbol,
          onChanged: (_) {
            recompute();
            refresh();
          },
        ),
        AmountRow(
          label: 'العمولة',
          controller: commission,
          suffix: '٪',
          onChanged: (_) {
            recompute();
            refresh();
          },
        ),
      ],
      AmountRow(
        label: isForeign ? 'السعر للعميل' : 'السعر',
        controller: omrCtrl,
        onChanged: (_) => refresh(),
      ),
      if (isForeign && foreignAmount > 0)
        Padding(
          padding: const EdgeInsetsDirectional.fromSTEB(16, 2, 16, 10),
          child: Text(
            '${_num(foreignAmount)} $symbol × ${Rates.i.rateText(currency)}'
            '${commissionPct > 0 ? ' + ${_num(commissionPct)}٪' : ''}'
            ' = ${omr(computed)}',
            style: const TextStyle(fontSize: 12.5, color: GH.secondary),
          ),
        ),
    ];
  }
}
