import 'package:flutter/cupertino.dart';

import '../data/api.dart';
import '../data/store.dart';
import '../format.dart';
import '../models.dart';
import '../ui/kit.dart';

/// Pieces that came back: they leave the order's total, the money given back
/// is recorded (a negative payment) and the points earned on them come back.
class ReturnPage extends StatefulWidget {
  const ReturnPage({super.key, required this.order});

  final Order order;

  @override
  State<ReturnPage> createState() => _ReturnPageState();
}

class _ReturnPageState extends State<ReturnPage> {
  final Set<String> _ids = {};
  final _refund = TextEditingController();
  final _reason = TextEditingController();
  String _method = 'أموال';
  bool _saving = false;

  @override
  void dispose() {
    _refund.dispose();
    _reason.dispose();
    super.dispose();
  }

  void _toggle(OrderItem i, bool on) {
    setState(() {
      on ? _ids.add(i.id) : _ids.remove(i.id);
      final sum = widget.order.activeItems.where((x) => _ids.contains(x.id)).fold<double>(0, (a, x) => a + x.price);
      final paid = widget.order.paid;
      final v = sum < paid ? sum : (paid > 0 ? paid : 0);
      _refund.text = v.toStringAsFixed(3);
    });
  }

  Future<void> _save() async {
    if (_ids.isEmpty) {
      toast(context, 'اختر القطع المرتجعة', error: true);
      return;
    }
    setState(() => _saving = true);
    try {
      final res = await Api.i.post('/ps/orders/${widget.order.id}/return', {
        'item_ids': _ids.toList(),
        'refund': parseAmount(_refund.text) ?? 0,
        'reason': _reason.text.trim().isEmpty ? null : _reason.text.trim(),
        'method': _method,
      });
      await Store.i.refresh();
      if (!mounted) return;
      final pts = (res is Map ? res['points_back'] : null) as num?;
      toast(context, 'تم تسجيل المرتجع${pts != null && pts > 0 ? ' · رجّعنا ${pts.toInt()} نقطة' : ''}');
      Navigator.pop(context, true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      toast(context, errorText(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final o = widget.order;
    return GHPage(
      title: 'إرجاع قطع',
      leading: NavButton('إلغاء', onPressed: () => Navigator.pop(context)),
      trailing: _saving ? const CupertinoActivityIndicator() : NavButton('تسجيل', bold: true, onPressed: _save),
      children: [
        Section(
          header: 'القطع المرتجعة',
          children: [
            for (final i in o.activeItems)
              SwitchRow(label: i.title, subtitle: omr(i.price), value: _ids.contains(i.id), onChanged: (v) => _toggle(i, v)),
          ],
        ),
        Section(
          header: 'المبلغ المسترجع',
          footer: 'المدفوع على الطلب: ${omr(o.paid)}. اكتب 0 إذا ما رجّعت فلوس.',
          children: [
            AmountRow(label: 'المبلغ', controller: _refund),
            Segments<String>(
              value: _method,
              options: const {'أموال': 'البطاقة', 'تحويل بنكي': 'تحويل', 'نقداً': 'نقداً', 'رصيد': 'رصيد'},
              onChanged: (v) => setState(() => _method = v),
            ),
          ],
        ),
        Section(
          header: 'السبب',
          children: [FieldRow(label: 'السبب', controller: _reason, placeholder: 'مثلاً: المقاس ما ناسب')],
        ),
      ],
    );
  }
}
