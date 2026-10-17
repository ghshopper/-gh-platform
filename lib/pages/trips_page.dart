import 'package:flutter/cupertino.dart';

import '../data/rates.dart';
import '../data/store.dart';
import '../format.dart';
import '../models.dart';
import '../ui/colors.dart';
import '../ui/kit.dart';
import 'item_pages.dart';
import 'order_detail_page.dart';
import 'order_form_page.dart';
import 'orders_page.dart';

/// Lets the user choose a trip. Returns the trip id, '' for "no trip", or
/// null when cancelled.
Future<String?> pickTrip(BuildContext context, {String? current}) async {
  final trips = Store.i.trips;
  final v = await actionSheet<String>(context, title: 'الرحلة', actions: [
    ...trips.map((t) => SheetAction(t.id == current ? '✓ ${t.name}' : t.name, t.id)),
    const SheetAction('بدون رحلة', ''),
    const SheetAction('＋ رحلة جديدة', '__new'),
  ]);
  if (v == '__new' && context.mounted) {
    return presentForm<String>(context, const TripFormPage());
  }
  return v;
}

class _TripStats {
  _TripStats(Trip t) {
    final store = Store.i;
    orders = store.ordersOfTrip(t.id);
    expenses = store.expensesOf(t.id);
    sales = orders.fold<double>(0, (s, o) => s + o.itemsTotal);
    cost = orders.fold<double>(0, (s, o) => s + o.costOmr);
    spent = expenses.fold<double>(0, (s, e) => s + e.omr);
    toBuy = orders
        .expand((o) => o.activeItems)
        .where((i) => i.status == ItemStatus.requested)
        .length;
  }

  late final List<Order> orders;
  late final List<TripExpense> expenses;
  late final double sales;
  late final double cost;
  late final double spent;
  late final int toBuy;

  double get profit => sales - cost - spent;
}

class TripsPage extends StatelessWidget {
  const TripsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Store.i,
      builder: (context, _) {
        final store = Store.i;
        return GHPage(
          title: 'الرحلات',
          onRefresh: store.refresh,
          trailing: NavIcon(CupertinoIcons.add_circled_solid,
              onPressed: () => presentForm(context, const TripFormPage())),
          children: [
            if (!store.ready)
              const Loading()
            else if (store.trips.isEmpty)
              EmptyState(
                icon: CupertinoIcons.airplane,
                title: 'ما في رحلات',
                message:
                    'سوّ رحلة (مثلاً «ميلان أكتوبر») واربط فيها الطلبات، وبتطلع لك قائمة تسوّق مرتبة حسب البراند وحساب ربح الرحلة.',
                action: SizedBox(
                  width: 200,
                  child: PrimaryButton('رحلة جديدة',
                      icon: CupertinoIcons.add,
                      onPressed: () =>
                          presentForm(context, const TripFormPage())),
                ),
              )
            else
              Section(
                children: store.trips.map((t) {
                  final s = _TripStats(t);
                  return Tile(
                    leading: const IconBox(CupertinoIcons.airplane,
                        color: GH.gold),
                    title: t.name,
                    subtitle: [
                      if (t.startsOn != null) dateStr(t.startsOn),
                      '${s.orders.length} طلب',
                      if (s.toBuy > 0) '${s.toBuy} قطعة للشراء',
                    ].join(' · '),
                    onTap: () => pushPage(context, TripDetailPage(tripId: t.id)),
                  );
                }).toList(),
              ),
          ],
        );
      },
    );
  }
}

enum _TripView { shopping, orders, expenses }

class TripDetailPage extends StatefulWidget {
  const TripDetailPage({super.key, required this.tripId});

  final String tripId;

  @override
  State<TripDetailPage> createState() => _TripDetailPageState();
}

class _TripDetailPageState extends State<TripDetailPage> {
  _TripView _view = _TripView.shopping;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Store.i,
      builder: (context, _) {
        final t = Store.i.trip(widget.tripId);
        if (t == null) {
          return const GHPage(title: 'الرحلة', children: [
            EmptyState(icon: CupertinoIcons.airplane, title: 'غير موجودة'),
          ]);
        }
        final s = _TripStats(t);
        return GHPage(
          title: t.name,
          previousPageTitle: 'الرحلات',
          trailing: NavIcon(CupertinoIcons.ellipsis_circle, onPressed: () async {
            final a = await actionSheet<String>(context, actions: const [
              SheetAction('تعديل الرحلة', 'edit'),
              SheetAction('حذف الرحلة', 'delete', destructive: true),
            ]);
            if (!context.mounted) return;
            if (a == 'edit') {
              presentForm(context, TripFormPage(trip: t));
            } else if (a == 'delete') {
              if (await confirm(context, 'حذف ${t.name}؟',
                  message: 'الطلبات تبقى، بس تنفك من الرحلة.')) {
                await Store.i.deleteTrip(t.id);
                if (context.mounted) Navigator.pop(context);
              }
            }
          }),
          bottom: PrimaryButton('طلب جديد في الرحلة',
              icon: CupertinoIcons.add,
              onPressed: () async {
                final id = await presentForm<String>(
                    context, OrderFormPage(tripId: t.id));
                if (id != null && context.mounted) {
                  pushPage(context, OrderDetailPage(orderId: id));
                }
              }),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
              child: Column(
                children: [
                  Row(children: [
                    Expanded(child: StatCard(label: 'المبيعات', value: omr(s.sales), hero: true, icon: CupertinoIcons.chart_bar_alt_fill)),
                    const SizedBox(width: 10),
                    Expanded(child: StatCard(label: 'المشتريات', value: omr(s.cost), color: GH.amber, icon: CupertinoIcons.bag_fill)),
                  ]),
                  const SizedBox(height: 10),
                  Row(children: [
                    Expanded(child: StatCard(label: 'مصاريف الرحلة', value: omr(s.spent), color: GH.blue, icon: CupertinoIcons.airplane)),
                    const SizedBox(width: 10),
                    Expanded(
                        child: StatCard(
                            label: 'صافي الربح',
                            value: omr(s.profit),
                            color: s.profit < 0 ? GH.red : GH.green)),
                  ]),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
              child: CupertinoSlidingSegmentedControl<_TripView>(
                groupValue: _view,
                children: const {
                  _TripView.shopping: Padding(
                      padding: EdgeInsets.symmetric(vertical: 6),
                      child: Text('قائمة التسوّق')),
                  _TripView.orders: Text('الطلبات'),
                  _TripView.expenses: Text('المصاريف'),
                },
                onValueChanged: (v) {
                  if (v != null) setState(() => _view = v);
                },
              ),
            ),
            ...switch (_view) {
              _TripView.shopping => _shopping(context, s),
              _TripView.orders => _orders(context, s),
              _TripView.expenses => _expenses(context, t, s),
            },
          ],
        );
      },
    );
  }

  List<Widget> _shopping(BuildContext context, _TripStats s) {
    final byBrand = <String, List<MapEntry<Order, OrderItem>>>{};
    for (final o in s.orders) {
      for (final i in o.activeItems) {
        if (i.status != ItemStatus.requested) continue;
        final key = (i.brand ?? 'بدون براند').trim();
        byBrand.putIfAbsent(key, () => []).add(MapEntry(o, i));
      }
    }
    if (byBrand.isEmpty) {
      return const [
        EmptyState(
            icon: CupertinoIcons.checkmark_seal,
            title: 'ما في شي باقي تشتريه',
            message: 'كل القطع في هذي الرحلة انشرت 👌'),
      ];
    }
    final brands = byBrand.keys.toList()..sort();
    return brands.map((b) {
      final entries = byBrand[b]!;
      return Section(
        header: '$b · ${entries.length}',
        children: entries.map((e) {
          final o = e.key;
          final i = e.value;
          return Tile(
            leading: i.photoPath == null ? null : Thumb(i.photoPath!, size: 40),
            title: i.name,
            subtitle: [
              Store.i.customerName(o),
              if (i.details != null) i.details!,
            ].join(' · '),
            value: omr(i.price),
            onTap: () => presentForm(context, PurchasePage(item: i)),
          );
        }).toList(),
        footer: 'اضغط على القطعة لما تشتريها وسجّل السعر والمكان.',
      );
    }).toList();
  }

  List<Widget> _orders(BuildContext context, _TripStats s) {
    if (s.orders.isEmpty) {
      return const [
        EmptyState(icon: CupertinoIcons.doc_text, title: 'ما في طلبات في الرحلة')
      ];
    }
    return [
      Section(
        children: s.orders
            .map((o) => OrderRow(
                order: o,
                onTap: () => pushPage(context, OrderDetailPage(orderId: o.id))))
            .toList(),
      ),
    ];
  }

  List<Widget> _expenses(BuildContext context, Trip t, _TripStats s) {
    return [
      Section(
        trailing: HeaderButton('إضافة مصروف',
            icon: CupertinoIcons.add,
            onPressed: () => presentForm(context, ExpenseFormPage(tripId: t.id))),
        children: s.expenses.isEmpty
            ? [const Tile(title: 'ما في مصاريف', subtitle: 'الطيران، الفندق، المواصلات…')]
            : s.expenses
                .map((e) => Tile(
                      title: e.title,
                      subtitle: [
                        dateStr(e.spentOn),
                        if (e.currency != 'OMR') money(e.amount, e.currency),
                      ].join(' · '),
                      value: omr(e.omr),
                      chevron: false,
                      onTap: () async {
                        if (await confirm(context, 'حذف ${e.title}؟')) {
                          await Store.i.deleteExpense(e.id);
                        }
                      },
                    ))
                .toList(),
      ),
    ];
  }
}

// ───────────────────────── Trip form ─────────────────────────

/// Add or edit a trip. Returns the trip id.
class TripFormPage extends StatefulWidget {
  const TripFormPage({super.key, this.trip});

  final Trip? trip;

  @override
  State<TripFormPage> createState() => _TripFormPageState();
}

class _TripFormPageState extends State<TripFormPage> {
  late final _name = TextEditingController(text: widget.trip?.name);
  late final _dest = TextEditingController(text: widget.trip?.destination);
  late final _notes = TextEditingController(text: widget.trip?.notes);
  late DateTime? _start = widget.trip?.startsOn;
  late DateTime? _end = widget.trip?.endsOn;
  bool _saving = false;

  @override
  void dispose() {
    _name.dispose();
    _dest.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_name.text.trim().isEmpty) {
      toast(context, 'اكتب اسم الرحلة', error: true);
      return;
    }
    setState(() => _saving = true);
    try {
      final id = await Store.i.saveTrip(
        id: widget.trip?.id,
        name: _name.text.trim(),
        destination: _dest.text.trim().isEmpty ? null : _dest.text.trim(),
        startsOn: _start,
        endsOn: _end,
        notes: _notes.text.trim().isEmpty ? null : _notes.text.trim(),
      );
      if (mounted) Navigator.pop(context, id);
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
      title: widget.trip == null ? 'رحلة جديدة' : 'تعديل الرحلة',
      leading: NavButton('إلغاء', onPressed: () => Navigator.pop(context)),
      trailing: _saving
          ? const CupertinoActivityIndicator()
          : NavButton('حفظ', bold: true, onPressed: _save),
      children: [
        Section(children: [
          FieldRow(
              label: 'الاسم',
              controller: _name,
              placeholder: 'ميلان أكتوبر',
              autofocus: widget.trip == null),
          FieldRow(label: 'الوجهة', controller: _dest, placeholder: 'ميلان، باريس…'),
          PickerRow(
            label: 'من',
            value: _start == null ? null : dateStr(_start),
            onTap: () async {
              final d = await pickDate(context, _start ?? DateTime.now());
              if (d != null) setState(() => _start = d);
            },
          ),
          PickerRow(
            label: 'إلى',
            value: _end == null ? null : dateStr(_end),
            onTap: () async {
              final d = await pickDate(context, _end ?? _start ?? DateTime.now());
              if (d != null) setState(() => _end = d);
            },
          ),
        ]),
        Section(
            header: 'ملاحظات',
            children: [NotesRow(controller: _notes, placeholder: 'اختياري')]),
      ],
    );
  }
}

// ───────────────────────── Expense form ─────────────────────────

class ExpenseFormPage extends StatefulWidget {
  const ExpenseFormPage({super.key, required this.tripId});

  final String tripId;

  @override
  State<ExpenseFormPage> createState() => _ExpenseFormPageState();
}

class _ExpenseFormPageState extends State<ExpenseFormPage> {
  final _title = TextEditingController();
  final _amount = TextEditingController();
  late final _rate = TextEditingController(text: '1');
  String _currency = 'OMR';
  DateTime _date = DateTime.now();
  bool _saving = false;

  static const _quick = ['طيران', 'فندق', 'مواصلات', 'أكل', 'شحن'];

  @override
  void dispose() {
    _title.dispose();
    _amount.dispose();
    _rate.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final a = parseAmount(_amount.text) ?? 0;
    final r = parseAmount(_rate.text) ?? 0;
    if (_title.text.trim().isEmpty || a <= 0 || r <= 0) {
      toast(context, 'اكتب البند والمبلغ', error: true);
      return;
    }
    setState(() => _saving = true);
    try {
      await Store.i.addExpense(
          tripId: widget.tripId,
          title: _title.text.trim(),
          amount: a,
          currency: _currency,
          rate: r,
          spentOn: _date);
      if (mounted) Navigator.pop(context);
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
      title: 'مصروف جديد',
      leading: NavButton('إلغاء', onPressed: () => Navigator.pop(context)),
      trailing: _saving
          ? const CupertinoActivityIndicator()
          : NavButton('حفظ', bold: true, onPressed: _save),
      children: [
        SizedBox(
          height: 48,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            children: _quick
                .map((q) => Padding(
                      padding: const EdgeInsetsDirectional.only(end: 8),
                      child: Chip(q,
                          selected: _title.text == q,
                          onTap: () => setState(() => _title.text = q)),
                    ))
                .toList(),
          ),
        ),
        Section(children: [
          FieldRow(label: 'البند', controller: _title, placeholder: 'طيران'),
          PickerRow(
            label: 'العملة',
            value: _currency,
            onTap: () async {
              final c = await actionSheet<String>(context,
                  actions: defaultRates.keys.map((c) => SheetAction(c, c)).toList());
              if (c != null) {
                setState(() {
                  _currency = c;
                  _rate.text = c == 'OMR' ? '1' : Rates.i.rateText(c);
                });
              }
            },
          ),
          AmountRow(label: 'المبلغ', controller: _amount, suffix: _currency),
          if (_currency != 'OMR')
            AmountRow(label: 'سعر الصرف', controller: _rate, suffix: 'ر.ع / $_currency'),
          PickerRow(
            label: 'التاريخ',
            value: dateStr(_date),
            onTap: () async {
              final d = await pickDate(context, _date);
              if (d != null) setState(() => _date = d);
            },
          ),
        ]),
      ],
    );
  }
}
