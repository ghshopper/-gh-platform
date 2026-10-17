import 'package:flutter/material.dart';

import 'format.dart';
import 'models.dart';
import 'repo.dart';
import 'theme.dart';
import 'widgets.dart';

// Remembered while the app is open, so a trip's purchases are quick to enter.
PurchasePlace _lastPlace = PurchasePlace.boutiqueEu;
final Map<String, double> _lastRates = {};

/// Asks where the item was bought and for how much, then saves it.
/// Returns true when saved.
Future<bool> showPurchaseDialog(BuildContext context, OrderItem item) async {
  final saved = await showDialog<bool>(
    context: context,
    builder: (_) => _PurchaseDialog(item: item),
  );
  return saved ?? false;
}

class _PurchaseDialog extends StatefulWidget {
  const _PurchaseDialog({required this.item});

  final OrderItem item;

  @override
  State<_PurchaseDialog> createState() => _PurchaseDialogState();
}

class _PurchaseDialogState extends State<_PurchaseDialog> {
  final _form = GlobalKey<FormState>();
  late PurchasePlace _place;
  late String _currency;
  late final TextEditingController _price;
  late final TextEditingController _rate;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final i = widget.item;
    _place = i.purchasePlace ?? _lastPlace;
    _currency = i.costCurrency ?? _place.currency;
    _price = TextEditingController(
        text: i.costAmount == null ? '' : i.costAmount!.toStringAsFixed(2));
    _rate = TextEditingController(text: _rateFor(_currency, i.costRate).toString());
  }

  double _rateFor(String currency, [double? current]) =>
      current ?? _lastRates[currency] ?? defaultRates[currency] ?? 1;

  @override
  void dispose() {
    _price.dispose();
    _rate.dispose();
    super.dispose();
  }

  void _choosePlace(PurchasePlace p) {
    setState(() {
      _place = p;
      if (p != PurchasePlace.other) {
        _currency = p.currency;
        _rate.text = _rateFor(_currency).toString();
      }
    });
  }

  Future<void> _save() async {
    if (!(_form.currentState?.validate() ?? false)) return;
    final price = parseAmount(_price.text) ?? 0;
    final rate = parseAmount(_rate.text) ?? 0;
    if (rate <= 0) {
      showMsg(context, 'سعر الصرف لازم يكون أكبر من صفر', error: true);
      return;
    }
    setState(() => _saving = true);
    try {
      await Repo.recordPurchase(widget.item,
          place: _place, price: price, currency: _currency, rate: rate);
      _lastPlace = _place;
      _lastRates[_currency] = rate;
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        showMsg(context, errorText(e), error: true);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final price = parseAmount(_price.text) ?? 0;
    final rate = parseAmount(_rate.text) ?? 0;
    final pct = _place.taxFreePct;
    final taxFree = price * pct / 100;
    return AlertDialog(
      title: Text('شراء: ${widget.item.name}'),
      content: Form(
        key: _form,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('وين اشتريتها؟',
                  style: TextStyle(fontWeight: FontWeight.w700, color: GH.burgundy)),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: PurchasePlace.values
                    .map((p) => ChoiceChip(
                          label: Text(p.label),
                          selected: _place == p,
                          selectedColor: GH.sand,
                          onSelected: (_) => _choosePlace(p),
                        ))
                    .toList(),
              ),
              const SizedBox(height: 14),
              if (_place == PurchasePlace.other) ...[
                DropdownButtonFormField<String>(
                  value: _currency,
                  decoration: const InputDecoration(labelText: 'العملة'),
                  items: defaultRates.keys
                      .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                      .toList(),
                  onChanged: (v) {
                    if (v == null) return;
                    setState(() {
                      _currency = v;
                      _rate.text = _rateFor(v).toString();
                    });
                  },
                ),
                const SizedBox(height: 12),
              ],
              AmountField(
                controller: _price,
                label: 'سعر الشراء',
                suffix: _currency,
                required: true,
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 12),
              AmountField(
                controller: _rate,
                label: 'سعر الصرف (ريال لكل 1 $_currency)',
                suffix: '',
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: GH.cream,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: GH.sand),
                ),
                child: Column(
                  children: [
                    KeyValue('بالريال تقريباً', omr(price * rate)),
                    KeyValue(
                      pct > 0
                          ? 'تاكس فري المفروض (${pct.toStringAsFixed(0)}٪)'
                          : 'تاكس فري',
                      pct > 0 ? money(taxFree, _currency) : 'ما في',
                      strong: pct > 0,
                      color: pct > 0 ? GH.green : GH.muted,
                    ),
                    KeyValue('سعر البيع للعميلة', omr(widget.item.price),
                        color: GH.muted),
                  ],
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'هذي البيانات لك بس، وما تطلع في فاتورة العميلة. المبلغ ينخصم من رصيدها.',
                style: TextStyle(color: GH.muted, fontSize: 12),
              ),
            ],
          ),
        ),
      ),
      actions: [
        TextButton(
            onPressed: _saving ? null : () => Navigator.pop(context, false),
            child: const Text('إلغاء')),
        FilledButton(
          onPressed: _saving ? null : _save,
          child: const Text('دفعت'),
        ),
      ],
    );
  }
}
