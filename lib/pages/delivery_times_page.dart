import 'package:flutter/cupertino.dart';

import '../data/store.dart';
import '../models.dart';
import '../ui/colors.dart';
import '../ui/kit.dart';

/// How long delivery takes from Dubai, from Europe and from stock in Oman.
/// Customers see it on the product page, in the bag and at checkout.
class DeliveryTimesPage extends StatefulWidget {
  const DeliveryTimesPage({super.key});

  @override
  State<DeliveryTimesPage> createState() => _DeliveryTimesPageState();
}

class _DeliveryTimesPageState extends State<DeliveryTimesPage> {
  late final Map<String, EtaRule> _eta = Map.of(Store.i.settings.eta);
  bool _saving = false;

  void _set(String k, {int? min, int? max, bool? work}) {
    final r = _eta[k]!;
    var a = (min ?? r.min).clamp(0, 90);
    var b = (max ?? r.max).clamp(0, 120);
    if (min != null && b < a) b = a;
    if (max != null && a > b) a = b;
    setState(() => _eta[k] = EtaRule(a, b, workDays: work ?? r.workDays));
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await Store.i.saveSettings({
        'delivery_eta': {for (final e in _eta.entries) e.key: e.value.toJson()},
      });
      if (mounted) {
        toast(context, 'تم الحفظ، ويطلع للعملاء على طول');
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        toast(context, errorText(e), error: true);
      }
    }
  }

  Widget _stepper(String label, int value, ValueChanged<int> onChanged) {
    return Tile(
      title: label,
      chevron: false,
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          CupertinoButton(
            padding: const EdgeInsets.symmetric(horizontal: 10),
            minSize: 36,
            onPressed: value > 0 ? () => onChanged(value - 1) : null,
            child: const Icon(CupertinoIcons.minus_circle, size: 26),
          ),
          SizedBox(
            width: 34,
            child: Text('$value',
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: GH.label)),
          ),
          CupertinoButton(
            padding: const EdgeInsets.symmetric(horizontal: 10),
            minSize: 36,
            onPressed: () => onChanged(value + 1),
            child: const Icon(CupertinoIcons.plus_circle, size: 26),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return GHPage(
      title: 'مدة التوصيل',
      previousPageTitle: 'المزيد',
      trailing: _saving
          ? const CupertinoActivityIndicator()
          : NavButton('حفظ', bold: true, onPressed: _save),
      children: [
        for (final k in EtaRule.origins.keys)
          Section(
            header: EtaRule.origins[k],
            footer: 'يطلع للعميل: يوصلك خلال ${_eta[k]!.label}',
            children: [
              _stepper('من', _eta[k]!.min, (v) => _set(k, min: v)),
              _stepper('إلى', _eta[k]!.max, (v) => _set(k, max: v)),
              Segments<bool>(
                value: _eta[k]!.workDays,
                options: const {true: 'أيام عمل', false: 'أيام'},
                onChanged: (v) => _set(k, work: v),
              ),
            ],
          ),
        const Padding(
          padding: EdgeInsets.fromLTRB(32, 0, 32, 24),
          child: Text(
            'أيام العمل ما تحسب الجمعة والسبت. المنتج اللي ما حددت مصدره: تسليم فوري = عُمان، بالطلب = أوروبا.',
            style: T.small,
          ),
        ),
      ],
    );
  }
}
