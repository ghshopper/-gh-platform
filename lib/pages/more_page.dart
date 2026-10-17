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
import 'drivers_pages.dart';
import 'purchases_pages.dart';
import 'trips_page.dart' show ExpenseFormPage;

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
            leading: const IconBox(CupertinoIcons.car_detailed, color: GH.blue),
            title: 'المناديب',
            value: Store.i.drivers.isEmpty ? null : '${Store.i.drivers.length}',
            onTap: () => pushPage(context, const DriversPage()),
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

  bool _inDate(DateTime? local) {
    final d = local?.toLocal();
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
        final orders = store.orders.where((o) => _inDate(o.createdAt)).toList();
        final sales = orders.fold<double>(0, (s, o) => s + o.itemsTotal);
        final delivery = orders.fold<double>(0, (s, o) => s + o.deliveryFee);
        final collected = orders.fold<double>(0, (s, o) => s + o.paid);
        final costed = orders
            .expand((o) => o.activeItems)
            .where((i) => i.costOmr != null)
            .toList();
        final cost = costed.fold<double>(0, (s, i) => s + i.costOmr!);
        final costedSales = costed.fold<double>(0, (s, i) => s + i.price);
        final itemProfit = costedSales - cost;
        final itemCount = orders.expand((o) => o.activeItems).length;

        final expenses =
            store.expenses.where((e) => _inDate(e.spentOn)).toList();
        final spent = expenses.fold<double>(0, (s, e) => s + e.omr);
        final net = itemProfit + delivery - spent;
        final byTitle = <String, double>{};
        for (final e in expenses) {
          byTitle[e.title] = (byTitle[e.title] ?? 0) + e.omr;
        }
        final topExpenses = byTitle.entries.toList()
          ..sort((a, b) => b.value.compareTo(a.value));

        final brands = <String, double>{};
        for (final o in orders) {
          for (final i in o.activeItems) {
            final b = i.brand ?? 'أخرى';
            brands[b] = (brands[b] ?? 0) + i.price;
          }
        }
        final topBrands = brands.entries.toList()
          ..sort((a, b) => b.value.compareTo(a.value));

        // Current work (not tied to the period)
        int count(ItemStatus s) =>
            store.allItems.where((e) => e.value.status == s).length;
        final owed = store.orders
            .fold<double>(0, (s, o) => s + (o.remaining > 0 ? o.remaining : 0));
        final held = store.orders.fold<double>(
            0, (s, o) => s + (o.customerBalance > 0 ? o.customerBalance : 0));
        final taxFree = <String, double>{};
        for (final o in store.orders) {
          o.taxFreePending
              .forEach((c, v) => taxFree[c] = (taxFree[c] ?? 0) + v);
        }

        return GHPage(
          title: 'الملخص والأرباح',
          previousPageTitle: 'المزيد',
          trailing: NavIcon(CupertinoIcons.add_circled_solid,
              onPressed: () =>
                  presentForm(context, const ExpenseFormPage())),
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
              child: Column(children: [
                Row(children: [
                  Expanded(
                      child: StatCard(
                          label: 'صافي الربح',
                          value: omr(net),
                          hero: true,
                          icon: CupertinoIcons.chart_bar_alt_fill)),
                  const SizedBox(width: 10),
                  Expanded(
                      child: StatCard(
                          label: 'المبيعات',
                          value: omr(sales),
                          color: GH.blue,
                          icon: CupertinoIcons.bag_fill)),
                ]),
                const SizedBox(height: 10),
                Row(children: [
                  Expanded(
                      child: StatCard(
                          label: 'المصاريف',
                          value: omr(spent),
                          color: GH.red,
                          icon: CupertinoIcons.arrow_down_circle_fill,
                          onTap: () =>
                              pushPage(context, const ExpensesPage()))),
                  const SizedBox(width: 10),
                  Expanded(
                      child: StatCard(
                          label: 'المحصّل',
                          value: omr(collected),
                          color: GH.green,
                          icon: CupertinoIcons.money_dollar_circle_fill)),
                ]),
              ]),
            ),
            Section(
              header: 'الأرباح',
              footer: costed.length < itemCount
                  ? 'ربح القطع محسوب للقطع اللي مسجّل سعر شرائها فقط.'
                  : null,
              children: [
                KV('عدد الطلبات', '${orders.length}'),
                KV('عدد القطع', '$itemCount'),
                KV('مبيعات القطع', omr(sales)),
                KV('تكلفة الشراء', omr(cost)),
                KV('ربح القطع', omr(itemProfit), color: GH.green),
                KV('+ رسوم التوصيل', omr(delivery)),
                KV('− المصاريف', omr(spent), color: GH.red),
                KV('صافي الربح', omr(net),
                    strong: true, color: net < 0 ? GH.red : GH.burgundy),
              ],
            ),
            Section(
              header: 'المصاريف',
              trailing: HeaderButton('إضافة',
                  icon: CupertinoIcons.add,
                  onPressed: () =>
                      presentForm(context, const ExpenseFormPage())),
              children: [
                if (topExpenses.isEmpty)
                  const Tile(title: 'ما في مصاريف في هذي الفترة', chevron: false)
                else
                  ...topExpenses.take(6).map((e) => KV(e.key, omr(e.value))),
                Tile(
                  title: 'كل المصاريف',
                  titleStyle: const TextStyle(fontSize: 16, color: GH.burgundy),
                  onTap: () => pushPage(context, const ExpensesPage()),
                ),
              ],
            ),
            Section(
              header: 'الشغل الحالي',
              children: [
                for (final s in [
                  ItemStatus.requested,
                  ItemStatus.purchased,
                  ItemStatus.arrived
                ])
                  Tile(
                    leading: Container(
                      width: 10,
                      height: 10,
                      decoration:
                          BoxDecoration(color: s.color, shape: BoxShape.circle),
                    ),
                    title: 'قطع ${s.label}',
                    value: '${count(s)}',
                    chevron: false,
                  ),
                KV('مبالغ متبقية عند العملاء', omr(owed),
                    strong: true, color: owed > 0.0005 ? GH.red : GH.green),
                KV('أرصدة العملاء عندك', omr(held), color: GH.green),
                KV(
                    'تاكس فري باقي تستلمه',
                    taxFree.isEmpty
                        ? '—'
                        : taxFree.entries
                            .map((e) => money(e.value, e.key))
                            .join(' + '),
                    color: GH.purple),
              ],
            ),
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

// ───────────────────────── Expenses ─────────────────────────

/// Every expense, general and per trip, newest first.
class ExpensesPage extends StatelessWidget {
  const ExpensesPage({super.key});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Store.i,
      builder: (context, _) {
        final store = Store.i;
        final list = store.expenses.toList()
          ..sort((a, b) => (b.spentOn ?? DateTime(2000))
              .compareTo(a.spentOn ?? DateTime(2000)));
        final total = list.fold<double>(0, (s, e) => s + e.omr);
        return GHPage(
          title: 'المصاريف',
          previousPageTitle: 'الملخص',
          trailing: NavIcon(CupertinoIcons.add_circled_solid,
              onPressed: () =>
                  presentForm(context, const ExpenseFormPage())),
          children: [
            if (list.isEmpty)
              const EmptyState(
                icon: CupertinoIcons.arrow_down_circle,
                title: 'ما في مصاريف',
                message:
                    'سجّل مصاريف الشغل مثل الإعلانات والتغليف والشحن، أو مصاريف الرحلات من صفحة الرحلة.',
              )
            else ...[
              Section(children: [KV('المجموع', omr(total), strong: true)]),
              Section(
                footer: 'اضغط على المصروف عشان تحذفه.',
                children: list.map((e) {
                  final trip = store.trip(e.tripId);
                  return Tile(
                    leading: IconBox(
                        trip == null
                            ? CupertinoIcons.briefcase_fill
                            : CupertinoIcons.airplane,
                        color: trip == null ? GH.purple : GH.blue),
                    title: e.title,
                    subtitle: [
                      dateStr(e.spentOn),
                      trip?.name ?? 'مصروف عام',
                      if (e.currency != 'OMR') money(e.amount, e.currency),
                    ].join(' · '),
                    value: omr(e.omr),
                    chevron: false,
                    onTap: () async {
                      if (await confirm(context, 'حذف «${e.title}»؟')) {
                        try {
                          await store.deleteExpense(e.id);
                        } catch (err) {
                          if (context.mounted) {
                            toast(context, errorText(err), error: true);
                          }
                        }
                      }
                    },
                  );
                }).toList(),
              ),
            ],
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
