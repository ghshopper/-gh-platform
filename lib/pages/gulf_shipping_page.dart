import 'package:flutter/cupertino.dart';

import '../data/api.dart';
import '../format.dart';
import '../ui/colors.dart';
import '../ui/kit.dart';

/// Shipping to the other Gulf countries: one switch turns it on for the
/// website and the customer app. Customers see prices in their currency;
/// every payment stays in Omani rials (Amwal). Same settings as the
/// dashboard's "شحن الخليج" page.
class GulfShippingPage extends StatefulWidget {
  const GulfShippingPage({super.key});

  @override
  State<GulfShippingPage> createState() => _GulfShippingPageState();
}

class _GulfShippingPageState extends State<GulfShippingPage> {
  Map<String, dynamic>? _s;
  List<Map<String, dynamic>> _meta = const [];
  final _fee = TextEditingController();
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _fee.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final res = await Api.i.get('/admin/gcc-shipping');
      final data = Map<String, dynamic>.from(res['data'] as Map);
      setState(() {
        _s = data;
        _meta = [for (final c in (res['countries'] as List? ?? const [])) Map<String, dynamic>.from(c as Map)];
        _fee.text = '${data['fee'] ?? 5}';
      });
    } catch (e) {
      setState(() => _error = errorText(e));
    }
  }

  Map<String, dynamic> get _countries => Map<String, dynamic>.from(_s!['countries'] as Map);

  Future<void> _save({bool quiet = false}) async {
    final s = _s;
    if (s == null) return;
    setState(() => _saving = true);
    try {
      final body = Map<String, dynamic>.from(s)..['fee'] = parseAmount(_fee.text) ?? s['fee'];
      final res = await Api.i.put('/admin/gcc-shipping', body);
      if (!mounted) return;
      setState(() {
        _s = Map<String, dynamic>.from(res['data'] as Map);
        _saving = false;
      });
      if (!quiet) toast(context, 'تم الحفظ، ويطلع للعملاء على طول');
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      toast(context, errorText(e), error: true);
    }
  }

  Future<void> _toggle(bool on) async {
    final ok = await confirm(
      context,
      on ? 'نشغّل الشحن للخليج؟' : 'نوقف الشحن للخليج؟',
      message: on
          ? 'العملاء في السعودية والإمارات والكويت وقطر والبحرين يقدرون يطلبون من الموقع والتطبيق.'
          : 'الطلبات الحالية ما تتأثر.',
      ok: on ? 'شغّل' : 'وقّف',
      destructive: !on,
    );
    if (!ok) return;
    setState(() => _saving = true);
    try {
      // only the switch: unsaved edits on the page stay unsaved
      final current = await Api.i.get('/admin/gcc-shipping');
      final body = Map<String, dynamic>.from(current['data'] as Map)..['enabled'] = on;
      await Api.i.put('/admin/gcc-shipping', body);
      if (!mounted) return;
      setState(() {
        _s!['enabled'] = on;
        _saving = false;
      });
      toast(context, on ? 'الشحن للخليج شغّال' : 'الشحن للخليج موقّف');
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      toast(context, errorText(e), error: true);
    }
  }

  Widget _stepper(String label, int value, ValueChanged<int> onChanged) {
    return Tile(
      title: label,
      chevron: false,
      trailing: Row(mainAxisSize: MainAxisSize.min, children: [
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
      ]),
    );
  }

  @override
  Widget build(BuildContext context) {
    final s = _s;
    return GHPage(
      title: 'شحن الخليج',
      previousPageTitle: 'المزيد',
      trailing: _saving
          ? const CupertinoActivityIndicator()
          : s == null
              ? null
              : NavButton('حفظ', bold: true, onPressed: _save),
      children: [
        if (s == null)
          Padding(
            padding: const EdgeInsets.all(40),
            child: _error == null
                ? const CupertinoActivityIndicator()
                : Text(_error!, style: T.sub, textAlign: TextAlign.center),
          )
        else ...[
          Section(
            footer: 'الأسعار تطلع للعميل بعملة بلده، والدفع دايماً بالريال العماني عبر أموال.',
            children: [
              SwitchRow(
                label: 'الشحن لدول الخليج',
                subtitle: s['enabled'] == true ? 'شغّال في الموقع والتطبيق' : 'موقّف',
                value: s['enabled'] == true,
                onChanged: _toggle,
              ),
            ],
          ),
          Section(
            header: 'السعر والمدة',
            footer: 'المدة تنضاف على مدة تجهيز الطلب نفسه (أيام عمل).',
            children: [
              AmountRow(label: 'سعر الشحن', controller: _fee),
              _stepper('من', (s['min_days'] as num?)?.toInt() ?? 3, (v) => setState(() {
                    s['min_days'] = v;
                    if (((s['max_days'] as num?) ?? 0) < v) s['max_days'] = v;
                  })),
              _stepper('إلى', (s['max_days'] as num?)?.toInt() ?? 5, (v) => setState(() {
                    s['max_days'] = v < ((s['min_days'] as num?) ?? 0) ? s['min_days'] : v;
                  })),
            ],
          ),
          Section(
            header: 'الشركة الافتراضية للطلبات الجديدة',
            footer: 'العميل يشوف «شحن سريع لباب البيت» بدون اسم الشركة. تختار جيناكم أو DHL لكل طلب من صفحة الطلب.',
            children: [
              Segments<String>(
                value: (s['carrier'] as String?) ?? 'genacom',
                options: const {'genacom': 'جيناكم', 'dhl': 'DHL'},
                onChanged: (v) => setState(() => s['carrier'] = v),
              ),
            ],
          ),
          Section(
            header: 'الدول',
            children: [
              for (final m in _meta)
                SwitchRow(
                  label: '${m['name_ar']}',
                  subtitle: '1 ر.ع = ${_countries[m['code']]?['rate'] ?? m['default_rate']} ${m['symbol']}',
                  value: _countries[m['code']]?['enabled'] == true,
                  onChanged: (v) => setState(() {
                    final c = _countries;
                    c[m['code'] as String] = {...Map<String, dynamic>.from(c[m['code']] as Map? ?? {}), 'enabled': v};
                    s['countries'] = c;
                  }),
                ),
            ],
          ),
          const Padding(
            padding: EdgeInsets.fromLTRB(32, 0, 32, 24),
            child: Text('أسعار الصرف وروابط التتبّع والملاحظة للعميل تتعدّل من لوحة التحكم.', style: T.small),
          ),
        ],
      ],
    );
  }
}
