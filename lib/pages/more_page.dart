import 'package:flutter/cupertino.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../data/lock.dart';
import '../data/rates.dart';
import '../data/report.dart';
import '../data/store.dart';
import '../format.dart';
import '../models.dart';
import '../ui/colors.dart';
import '../ui/kit.dart';
import 'purchases_pages.dart';

class MorePage extends StatefulWidget {
  const MorePage({super.key});

  @override
  State<MorePage> createState() => _MorePageState();
}

class _MorePageState extends State<MorePage> {
  bool _faceId = false;
  bool _faceIdAvailable = false;

  @override
  void initState() {
    super.initState();
    AppLock.i.isEnabled().then((v) {
      if (mounted) setState(() => _faceId = v);
    });
    AppLock.i.isAvailable().then((v) {
      if (mounted) setState(() => _faceIdAvailable = v);
    });
  }

  Future<void> _toggleFaceId(bool v) async {
    if (v) {
      final ok = await AppLock.i.unlock();
      if (!ok) return;
    }
    await AppLock.i.setEnabled(v);
    if (mounted) setState(() => _faceId = v);
  }

  Future<void> _export() async {
    final now = DateTime.now();
    final months = List.generate(6, (k) => DateTime(now.year, now.month - k));
    const names = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];
    final m = await actionSheet<DateTime>(context,
        title: 'تقرير Excel',
        message: 'اختر الشهر',
        actions: months
            .map((d) => SheetAction('${names[d.month - 1]} ${d.year}', d))
            .toList());
    if (m == null) return;
    try {
      await Report.shareMonth(m.year, m.month);
    } catch (e) {
      if (mounted) toast(context, errorText(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final email = Supabase.instance.client.auth.currentUser?.email ?? '';
    return GHPage(
      title: 'المزيد',
      children: [
        Section(children: [
          Tile(
            leading: const IconBox(CupertinoIcons.chart_pie_fill, color: GH.burgundy),
            title: 'الملخص والأرباح',
            onTap: () => pushPage(context, const SummaryPage()),
          ),
          Tile(
            leading: const IconBox(CupertinoIcons.bag_fill, color: GH.gold),
            title: 'فواتير الشراء',
            onTap: () => pushPage(context, const PurchaseInvoicesPage()),
          ),
          Tile(
            leading: const IconBox(CupertinoIcons.table_fill, color: GH.green),
            title: 'تقرير Excel شهري',
            onTap: _export,
          ),
        ]),
        Section(children: [
          Tile(
            leading: const IconBox(CupertinoIcons.building_2_fill,
                color: Color(0xFF5856D6)),
            title: 'بيانات الشركة',
            subtitle: 'تطلع في الفاتورة',
            onTap: () => pushPage(context, const SettingsPage()),
          ),
          if (_faceIdAvailable)
            SwitchRow(
              label: 'قفل بالـ Face ID',
              value: _faceId,
              onChanged: _toggleFaceId,
            ),
          Tile(
            leading: const IconBox(CupertinoIcons.arrow_2_circlepath,
                color: Color(0xFF007AFF)),
            title: 'أسعار الصرف',
            subtitle: Rates.i.isLive
                ? 'محدّثة ${dateStr(Rates.i.updatedAt)}'
                : 'تقريبية',
            value: '1 € = ${Rates.i.rateText('EUR')} · 1 د.إ = ${Rates.i.rateText('AED')}',
            valueStyle: const TextStyle(fontSize: 13, color: GH.secondary),
            chevron: false,
          ),
        ]),
        Section(
          footer: email,
          children: [
            Tile(
              title: 'تسجيل خروج',
              titleStyle: const TextStyle(fontSize: 16, color: GH.red),
              chevron: false,
              onTap: () async {
                if (await confirm(context, 'تسجيل خروج؟',
                    ok: 'خروج', destructive: true)) {
                  await Supabase.instance.client.auth.signOut();
                }
              },
            ),
          ],
        ),
        const Padding(
          padding: EdgeInsets.only(top: 24),
          child: Center(child: Text('GH Shopper · 1.1', style: T.small)),
        ),
      ],
    );
  }
}

// ───────────────────────── Summary ─────────────────────────

enum _Period { month, lastMonth, year, all }

class SummaryPage extends StatefulWidget {
  const SummaryPage({super.key});

  @override
  State<SummaryPage> createState() => _SummaryPageState();
}

class _SummaryPageState extends State<SummaryPage> {
  _Period _period = _Period.month;

  bool _in(Order o) {
    final d = o.createdAt?.toLocal();
    if (d == null) return _period == _Period.all;
    final now = DateTime.now();
    switch (_period) {
      case _Period.month:
        return d.year == now.year && d.month == now.month;
      case _Period.lastMonth:
        final lm = DateTime(now.year, now.month - 1);
        return d.year == lm.year && d.month == lm.month;
      case _Period.year:
        return d.year == now.year;
      case _Period.all:
        return true;
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Store.i,
      builder: (context, _) {
        final store = Store.i;
        final orders = store.orders.where(_in).toList();
        final sales = orders.fold<double>(0, (s, o) => s + o.itemsTotal);
        final delivery = orders.fold<double>(0, (s, o) => s + o.deliveryFee);
        final collected = orders.fold<double>(0, (s, o) => s + o.paid);
        final costed = orders
            .expand((o) => o.activeItems)
            .where((i) => i.costOmr != null)
            .toList();
        final cost = costed.fold<double>(0, (s, i) => s + i.costOmr!);
        final costedSales = costed.fold<double>(0, (s, i) => s + i.price);
        final itemCount = orders.expand((o) => o.activeItems).length;

        final brands = <String, double>{};
        for (final o in orders) {
          for (final i in o.activeItems) {
            final b = i.brand ?? 'أخرى';
            brands[b] = (brands[b] ?? 0) + i.price;
          }
        }
        final topBrands = brands.entries.toList()
          ..sort((a, b) => b.value.compareTo(a.value));

        return GHPage(
          title: 'الملخص',
          previousPageTitle: 'المزيد',
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
              child: CupertinoSlidingSegmentedControl<_Period>(
                groupValue: _period,
                children: const {
                  _Period.month: Padding(
                      padding: EdgeInsets.symmetric(vertical: 6),
                      child: Text('هذا الشهر')),
                  _Period.lastMonth: Text('الماضي'),
                  _Period.year: Text('السنة'),
                  _Period.all: Text('الكل'),
                },
                onValueChanged: (v) {
                  if (v != null) setState(() => _period = v);
                },
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
              child: Row(children: [
                Expanded(child: StatCard(label: 'المبيعات', value: omr(sales))),
                const SizedBox(width: 10),
                Expanded(
                    child: StatCard(
                        label: 'الربح',
                        value: omr(costedSales - cost),
                        color: GH.green)),
              ]),
            ),
            Section(children: [
              KV('عدد الطلبات', '${orders.length}'),
              KV('عدد القطع', '$itemCount'),
              KV('مبيعات القطع', omr(sales)),
              KV('رسوم التوصيل', omr(delivery)),
              KV('المحصّل', omr(collected), color: GH.green),
              KV('تكلفة الشراء', omr(cost)),
              KV('ربح القطع المسجّل شراؤها', omr(costedSales - cost),
                  strong: true, color: GH.burgundy),
            ], footer: costed.length < itemCount
                ? 'الربح محسوب للقطع اللي مسجّل سعر شرائها فقط.'
                : null),
            if (topBrands.isNotEmpty)
              Section(
                header: 'أكثر البراندات مبيعاً',
                children: topBrands
                    .take(6)
                    .map((e) => KV(e.key, omr(e.value)))
                    .toList(),
              ),
          ],
        );
      },
    );
  }
}

// ───────────────────────── Company settings ─────────────────────────

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  late final BusinessSettings _s = Store.i.settings;
  late final _name = TextEditingController(text: _s.companyName);
  late final _nameEn = TextEditingController(text: _s.companyNameEn);
  late final _cr = TextEditingController(text: _s.crNumber);
  late final _phone = TextEditingController(text: _s.phone);
  late final _insta = TextEditingController(text: _s.instagram);
  late final _address = TextEditingController(text: _s.address);
  late final _bank = TextEditingController(text: _s.bankDetails);
  late final _note = TextEditingController(text: _s.invoiceNote);
  bool _saving = false;

  @override
  void dispose() {
    for (final c in [_name, _nameEn, _cr, _phone, _insta, _address, _bank, _note]) {
      c.dispose();
    }
    super.dispose();
  }

  String? _v(TextEditingController c) =>
      c.text.trim().isEmpty ? null : c.text.trim();

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      await Store.i.saveSettings({
        'company_name': _v(_name),
        'company_name_en': _v(_nameEn),
        'cr_number': _v(_cr),
        'phone': _v(_phone),
        'instagram': _v(_insta),
        'address': _v(_address),
        'bank_details': _v(_bank),
        'invoice_note': _v(_note),
      });
      if (mounted) {
        toast(context, 'تم الحفظ');
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        toast(context, errorText(e), error: true);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return GHPage(
      title: 'بيانات الشركة',
      previousPageTitle: 'المزيد',
      trailing: _saving
          ? const CupertinoActivityIndicator()
          : NavButton('حفظ', bold: true, onPressed: _save),
      children: [
        Section(
          footer: 'تطلع في رأس الفاتورة وأسفلها.',
          children: [
            FieldRow(label: 'اسم الشركة', controller: _name, placeholder: 'GH Shopper'),
            FieldRow(label: 'بالإنجليزي', controller: _nameEn, placeholder: 'GH Shopper', ltr: true),
            FieldRow(label: 'السجل التجاري', controller: _cr, placeholder: 'رقم السجل', ltr: true),
            FieldRow(label: 'الجوال', controller: _phone, keyboard: TextInputType.phone, ltr: true),
            FieldRow(label: 'الانستقرام', controller: _insta, placeholder: '@ghshopper', ltr: true),
            FieldRow(label: 'العنوان', controller: _address, placeholder: 'مسقط، عُمان'),
          ],
        ),
        Section(
          header: 'بيانات التحويل البنكي',
          children: [
            NotesRow(controller: _bank, placeholder: 'اسم البنك، اسم الحساب، رقم الحساب / IBAN'),
          ],
        ),
        Section(
          header: 'ملاحظة أسفل الفاتورة',
          children: [
            NotesRow(controller: _note, placeholder: 'مثلاً: العربون غير مسترد'),
          ],
        ),
      ],
    );
  }
}
