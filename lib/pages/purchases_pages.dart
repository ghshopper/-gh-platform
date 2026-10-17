import 'package:flutter/cupertino.dart';

import '../data/rates.dart';
import '../data/store.dart';
import '../format.dart';
import '../models.dart';
import '../ui/colors.dart';
import '../ui/kit.dart';

class PurchaseInvoicesPage extends StatelessWidget {
  const PurchaseInvoicesPage({super.key});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Store.i,
      builder: (context, _) {
        final store = Store.i;
        final total = store.invoices.fold<double>(0, (s, i) => s + i.totalOmr);
        return GHPage(
          title: 'فواتير الشراء',
          previousPageTitle: 'المزيد',
          trailing: NavIcon(CupertinoIcons.add_circled_solid,
              onPressed: () =>
                  presentForm(context, const PurchaseInvoiceFormPage())),
          children: [
            if (store.invoices.isEmpty)
              const EmptyState(
                icon: CupertinoIcons.bag,
                title: 'ما في فواتير شراء',
                message:
                    'سجّل فاتورة المحل إذا اشتريت أكثر من قطعة مرة وحدة، واربط فيها القطع.',
              )
            else ...[
              Section(children: [
                KV('مجموع المشتريات', omr(total), strong: true),
              ]),
              Section(
                children: store.invoices.map((inv) {
                  final count = store.allItems
                      .where((e) => e.value.purchaseInvoiceId == inv.id)
                      .length;
                  return Tile(
                    leading: const IconBox(CupertinoIcons.bag_fill, color: GH.gold),
                    title: inv.store,
                    subtitle: [
                      dateStr(inv.purchasedOn),
                      if (inv.country != null) inv.country!,
                      '$count قطعة',
                    ].join(' · '),
                    value: money(inv.totalAmount, inv.currency),
                    valueStyle: const TextStyle(fontSize: 14, color: GH.secondary),
                    onTap: () => presentForm(
                        context, PurchaseInvoiceFormPage(invoice: inv)),
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

class PurchaseInvoiceFormPage extends StatefulWidget {
  const PurchaseInvoiceFormPage({super.key, this.invoice});

  final PurchaseInvoice? invoice;

  @override
  State<PurchaseInvoiceFormPage> createState() =>
      _PurchaseInvoiceFormPageState();
}

class _PurchaseInvoiceFormPageState extends State<PurchaseInvoiceFormPage> {
  late final PurchaseInvoice? _inv = widget.invoice;
  late final _store = TextEditingController(text: _inv?.store);
  late final _no = TextEditingController(text: _inv?.invoiceNo);
  late final _country = TextEditingController(text: _inv?.country);
  late final _total = TextEditingController(
      text: _inv == null ? '' : _inv!.totalAmount.toStringAsFixed(2));
  late String _currency = _inv?.currency ?? 'EUR';
  late final _rate = TextEditingController(
      text: _inv?.rate.toString() ?? Rates.i.rateText(_currency));
  late DateTime _date = _inv?.purchasedOn ?? DateTime.now();
  final Map<String, TextEditingController> _costs = {};
  final Map<String, OrderItem> _picked = {};
  bool _saving = false;

  @override
  void dispose() {
    for (final c in [_store, _no, _country, _total, _rate, ..._costs.values]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _pickItems() async {
    final options = Store.i.allItems
        .where((e) =>
            e.value.purchaseInvoiceId == null && !_picked.containsKey(e.value.id))
        .toList();
    if (options.isEmpty) {
      toast(context, 'كل القطع مربوطة بفواتير');
      return;
    }
    final chosen = await pushPage<List<OrderItem>>(
        context, _ItemPickerPage(options: options));
    if (chosen == null) return;
    setState(() {
      for (final i in chosen) {
        _picked[i.id] = i;
        _costs[i.id] = TextEditingController(
            text: i.costAmount == null ? '' : i.costAmount!.toStringAsFixed(2));
      }
    });
  }

  Future<void> _save() async {
    final rate = parseAmount(_rate.text) ?? 0;
    if (_store.text.trim().isEmpty || rate <= 0) {
      toast(context, 'اكتب اسم المحل وسعر الصرف', error: true);
      return;
    }
    final link = <OrderItem, double>{
      for (final e in _picked.entries)
        e.value: parseAmount(_costs[e.key]!.text) ?? 0,
    };
    var total = parseAmount(_total.text) ?? 0;
    if (total == 0) total = link.values.fold<double>(0, (s, v) => s + v);
    setState(() => _saving = true);
    try {
      await Store.i.savePurchaseInvoice(
        id: _inv?.id,
        store: _store.text.trim(),
        invoiceNo: _no.text.trim().isEmpty ? null : _no.text.trim(),
        purchasedOn: _date,
        country: _country.text.trim().isEmpty ? null : _country.text.trim(),
        currency: _currency,
        rate: rate,
        totalAmount: total,
        link: link,
      );
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
    final linked = _inv == null
        ? <MapEntry<Order, OrderItem>>[]
        : Store.i.allItems
            .where((e) => e.value.purchaseInvoiceId == _inv!.id)
            .toList();
    return GHPage(
      title: _inv == null ? 'فاتورة شراء' : _inv!.store,
      leading: NavButton('إلغاء', onPressed: () => Navigator.pop(context)),
      trailing: _saving
          ? const CupertinoActivityIndicator()
          : NavButton('حفظ', bold: true, onPressed: _save),
      children: [
        Section(children: [
          FieldRow(label: 'المحل', controller: _store, placeholder: 'Cartier Paris'),
          FieldRow(label: 'رقم الفاتورة', controller: _no, ltr: true),
          FieldRow(label: 'البلد', controller: _country, placeholder: 'فرنسا'),
          PickerRow(
            label: 'التاريخ',
            value: dateStr(_date),
            onTap: () async {
              final d = await pickDate(context, _date);
              if (d != null) setState(() => _date = d);
            },
          ),
        ]),
        Section(children: [
          PickerRow(
            label: 'العملة',
            value: _currency,
            onTap: () async {
              final c = await actionSheet<String>(context,
                  actions: defaultRates.keys.map((c) => SheetAction(c, c)).toList());
              if (c != null) {
                setState(() {
                  _currency = c;
                  _rate.text = Rates.i.rateText(c);
                });
              }
            },
          ),
          AmountRow(label: 'سعر الصرف', controller: _rate, suffix: 'ر.ع / $_currency'),
          AmountRow(label: 'المجموع', controller: _total, suffix: _currency),
        ]),
        if (_inv != null && linked.isNotEmpty)
          Section(
            header: 'القطع المربوطة',
            children: linked
                .map((e) => Tile(
                      title: e.value.title,
                      subtitle: Store.i.customerName(e.key),
                      value: e.value.costAmount == null
                          ? null
                          : money(e.value.costAmount!, e.value.costCurrency ?? _currency),
                      chevron: false,
                      onTap: () async {
                        if (await confirm(context, 'فك ربط ${e.value.name}؟',
                            ok: 'فك الربط')) {
                          await Store.i.unlinkItem(e.value.id);
                          if (mounted) setState(() {});
                        }
                      },
                    ))
                .toList(),
          ),
        Section(
          header: 'ربط قطع بهذي الفاتورة',
          trailing: HeaderButton('اختيار', icon: CupertinoIcons.link, onPressed: _pickItems),
          footer: 'القطع اللي بانتظار الشراء تتحول تلقائياً إلى «تم الشراء».',
          children: _picked.values
              .map((i) => AmountRow(
                    label: i.name,
                    controller: _costs[i.id]!,
                    suffix: _currency,
                  ))
              .toList(),
        ),
        if (_inv != null)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 24, 16, 0),
            child: CupertinoButton(
              onPressed: () async {
                if (await confirm(context, 'حذف الفاتورة؟',
                    message: 'القطع تبقى في طلباتها.')) {
                  await Store.i.deletePurchaseInvoice(_inv!.id);
                  if (context.mounted) Navigator.pop(context);
                }
              },
              child: const Text('حذف الفاتورة', style: TextStyle(color: GH.red)),
            ),
          ),
      ],
    );
  }
}

class _ItemPickerPage extends StatefulWidget {
  const _ItemPickerPage({required this.options});

  final List<MapEntry<Order, OrderItem>> options;

  @override
  State<_ItemPickerPage> createState() => _ItemPickerPageState();
}

class _ItemPickerPageState extends State<_ItemPickerPage> {
  final Set<String> _sel = {};

  @override
  Widget build(BuildContext context) {
    return GHPage(
      title: 'اختر القطع',
      previousPageTitle: 'رجوع',
      trailing: NavButton('إضافة (${_sel.length})',
          bold: true,
          onPressed: _sel.isEmpty
              ? null
              : () => Navigator.pop(
                  context,
                  widget.options
                      .where((e) => _sel.contains(e.value.id))
                      .map((e) => e.value)
                      .toList())),
      children: [
        Section(
          children: widget.options.map((e) {
            final i = e.value;
            final on = _sel.contains(i.id);
            return Tile(
              leading: Icon(
                  on ? CupertinoIcons.checkmark_circle_fill : CupertinoIcons.circle,
                  color: on ? GH.burgundy : GH.tertiary),
              title: i.title,
              subtitle: '${Store.i.customerName(e.key)} · ${i.status.label}',
              value: omr(i.price),
              chevron: false,
              onTap: () => setState(() => on ? _sel.remove(i.id) : _sel.add(i.id)),
            );
          }).toList(),
        ),
      ],
    );
  }
}
