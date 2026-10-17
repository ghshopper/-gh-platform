import 'package:flutter/material.dart';

import '../format.dart';
import '../models.dart';
import '../repo.dart';
import '../theme.dart';
import '../widgets.dart';

class _Link {
  _Link(this.item, {String cost = ''}) : cost = TextEditingController(text: cost);

  final OrderItem item;
  final TextEditingController cost;
}

/// Adds or edits a purchase invoice and links order items to it.
class PurchaseFormScreen extends StatefulWidget {
  const PurchaseFormScreen({super.key, this.invoice});

  final PurchaseInvoice? invoice;

  @override
  State<PurchaseFormScreen> createState() => _PurchaseFormScreenState();
}

class _PurchaseFormScreenState extends State<PurchaseFormScreen> {
  final _form = GlobalKey<FormState>();
  late final _store = TextEditingController(text: widget.invoice?.store);
  late final _no = TextEditingController(text: widget.invoice?.invoiceNo);
  late final _country = TextEditingController(text: widget.invoice?.country);
  late final _total = TextEditingController(
      text: widget.invoice == null
          ? ''
          : widget.invoice!.totalAmount.toStringAsFixed(2));
  late final _rate = TextEditingController(
      text: (widget.invoice?.rate ?? defaultRates['EUR']!).toString());
  late final _notes = TextEditingController(text: widget.invoice?.notes);
  late String _currency = widget.invoice?.currency ?? 'EUR';
  late DateTime _date = widget.invoice?.purchasedOn ?? DateTime.now();

  /// Items already linked (existing invoice) and newly added links.
  List<OrderItem> _linked = [];
  final List<_Link> _newLinks = [];
  bool _loading = false;
  bool _saving = false;

  bool get _isEdit => widget.invoice != null;

  @override
  void initState() {
    super.initState();
    if (_isEdit) _loadLinked();
  }

  Future<void> _loadLinked() async {
    setState(() => _loading = true);
    try {
      final items = await Repo.itemsOfInvoice(widget.invoice!.id);
      if (mounted) setState(() => _linked = items);
    } catch (e) {
      if (mounted) showMsg(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  void dispose() {
    _store.dispose();
    _no.dispose();
    _country.dispose();
    _total.dispose();
    _rate.dispose();
    _notes.dispose();
    for (final l in _newLinks) {
      l.cost.dispose();
    }
    super.dispose();
  }

  double get _rateValue => parseAmount(_rate.text) ?? 0;

  double get _linksTotal =>
      _linked.fold<double>(0, (s, i) => s + (i.costAmount ?? 0)) +
      _newLinks.fold<double>(0, (s, l) => s + (parseAmount(l.cost.text) ?? 0));

  Future<void> _pickItems() async {
    List<OrderItem> options;
    try {
      options = await Repo.unlinkedItems();
    } catch (e) {
      if (mounted) showMsg(context, errorText(e), error: true);
      return;
    }
    final already = _newLinks.map((l) => l.item.id).toSet();
    options = options.where((i) => !already.contains(i.id)).toList();
    if (!mounted) return;
    if (options.isEmpty) {
      showMsg(context, 'كل القطع مربوطة بفواتير');
      return;
    }
    final chosen = await showModalBottomSheet<List<OrderItem>>(
      context: context,
      isScrollControlled: true,
      showDragHandle: true,
      builder: (ctx) => _ItemPicker(options: options),
    );
    if (chosen == null || chosen.isEmpty) return;
    setState(() => _newLinks.addAll(chosen.map((i) => _Link(i))));
  }

  Future<void> _unlink(OrderItem item) async {
    if (!await confirm(context, 'فك ربط ${item.name} من الفاتورة؟',
        ok: 'فك الربط')) {
      return;
    }
    try {
      await Repo.unlinkItem(item.id);
      await _loadLinked();
    } catch (e) {
      if (mounted) showMsg(context, errorText(e), error: true);
    }
  }

  Future<void> _delete() async {
    if (!await confirm(context, 'حذف فاتورة ${widget.invoice!.store}؟',
        body: 'القطع المربوطة فيها بتبقى بطلباتها بدون تكلفة.')) {
      return;
    }
    try {
      await Repo.deletePurchaseInvoice(widget.invoice!.id);
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) showMsg(context, errorText(e), error: true);
    }
  }

  Future<void> _save() async {
    if (!(_form.currentState?.validate() ?? false)) return;
    if (_rateValue <= 0) {
      showMsg(context, 'سعر الصرف لازم يكون أكبر من صفر', error: true);
      return;
    }
    setState(() => _saving = true);
    try {
      var total = parseAmount(_total.text) ?? 0;
      if (total == 0) total = _linksTotal;
      final id = await Repo.savePurchaseInvoice(
        id: widget.invoice?.id,
        store: _store.text.trim(),
        invoiceNo: _no.text.trim().isEmpty ? null : _no.text.trim(),
        purchasedOn: _date,
        country: _country.text.trim().isEmpty ? null : _country.text.trim(),
        currency: _currency,
        rate: _rateValue,
        totalAmount: total,
        notes: _notes.text.trim().isEmpty ? null : _notes.text.trim(),
      );
      for (final l in _newLinks) {
        await Repo.linkItem(
          item: l.item,
          invoiceId: id,
          cost: parseAmount(l.cost.text) ?? 0,
          currency: _currency,
          rate: _rateValue,
          purchasedOn: _date,
        );
      }
      if (mounted) Navigator.pop(context, id);
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        showMsg(context, errorText(e), error: true);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final rate = _rateValue;
    return Scaffold(
      appBar: AppBar(
        title: Text(_isEdit ? 'فاتورة الشراء' : 'فاتورة شراء جديدة'),
        actions: [
          if (_isEdit)
            IconButton(
              tooltip: 'حذف',
              onPressed: _delete,
              icon: const Icon(Icons.delete_outline),
            ),
        ],
      ),
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
          children: [
            TextFormField(
              controller: _store,
              decoration: const InputDecoration(
                  labelText: 'المحل', hintText: 'مثلاً: Cartier Paris'),
              validator: (v) => (v ?? '').trim().isEmpty ? 'مطلوب' : null,
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _no,
                    decoration:
                        const InputDecoration(labelText: 'رقم الفاتورة'),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: TextFormField(
                    controller: _country,
                    decoration: const InputDecoration(labelText: 'البلد'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              icon: const Icon(Icons.event),
              label: Text('تاريخ الشراء: ${dateStr(_date)}'),
              onPressed: () async {
                final d = await showDatePicker(
                  context: context,
                  initialDate: _date,
                  firstDate: DateTime(2024),
                  lastDate: DateTime.now().add(const Duration(days: 30)),
                );
                if (d != null) setState(() => _date = d);
              },
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                SizedBox(
                  width: 120,
                  child: DropdownButtonFormField<String>(
                    value: _currency,
                    decoration: const InputDecoration(labelText: 'العملة'),
                    items: defaultRates.keys
                        .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                        .toList(),
                    onChanged: (v) {
                      if (v == null) return;
                      setState(() {
                        _currency = v;
                        _rate.text = defaultRates[v]!.toString();
                      });
                    },
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: AmountField(
                    controller: _rate,
                    label: 'سعر الصرف (ريال لكل 1 $_currency)',
                    suffix: '',
                    onChanged: (_) => setState(() {}),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            AmountField(
              controller: _total,
              label: 'مجموع الفاتورة',
              suffix: _currency,
              onChanged: (_) => setState(() {}),
            ),
            if ((parseAmount(_total.text) ?? 0) > 0 && rate > 0)
              Padding(
                padding: const EdgeInsets.only(top: 6, right: 4),
                child: Text(
                    '≈ ${omr((parseAmount(_total.text) ?? 0) * rate)}',
                    style: const TextStyle(color: GH.muted)),
              ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _notes,
              maxLines: 2,
              decoration:
                  const InputDecoration(labelText: 'ملاحظات (اختياري)'),
            ),
            SectionTitle(
              'القطع في هذي الفاتورة',
              trailing: TextButton.icon(
                onPressed: _pickItems,
                icon: const Icon(Icons.link),
                label: const Text('ربط قطع'),
              ),
            ),
            const Padding(
              padding: EdgeInsets.only(bottom: 8),
              child: Text(
                'اختر القطع من طلبات العملاء واكتب تكلفة كل قطعة بعملة الفاتورة. القطع اللي بانتظار الشراء تتحول تلقائياً إلى «تم الشراء».',
                style: TextStyle(color: GH.muted, fontSize: 13),
              ),
            ),
            if (_loading)
              const Padding(
                padding: EdgeInsets.all(16),
                child: Center(child: CircularProgressIndicator()),
              ),
            ..._linked.map((i) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: GhCard(
                    child: Row(
                      children: [
                        Expanded(child: _itemInfo(i)),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                                money(i.costAmount ?? 0,
                                    i.costCurrency ?? _currency),
                                textDirection: TextDirection.ltr,
                                style: const TextStyle(
                                    fontWeight: FontWeight.w700)),
                            if (i.costOmr != null)
                              Text('≈ ${omr(i.costOmr!)}',
                                  style: const TextStyle(
                                      color: GH.muted, fontSize: 12)),
                          ],
                        ),
                        IconButton(
                          tooltip: 'فك الربط',
                          onPressed: () => _unlink(i),
                          icon: const Icon(Icons.link_off, color: GH.muted),
                        ),
                      ],
                    ),
                  ),
                )),
            ..._newLinks.map((l) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: GhCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(child: _itemInfo(l.item)),
                            IconButton(
                              tooltip: 'إزالة',
                              onPressed: () => setState(() {
                                _newLinks.remove(l);
                              }),
                              icon: const Icon(Icons.close, color: GH.muted),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        AmountField(
                          controller: l.cost,
                          label: 'تكلفة القطعة',
                          suffix: _currency,
                          onChanged: (_) => setState(() {}),
                        ),
                      ],
                    ),
                  ),
                )),
            if (_linked.isNotEmpty || _newLinks.isNotEmpty)
              GhCard(
                child: Column(
                  children: [
                    KeyValue('مجموع تكلفة القطع',
                        money(_linksTotal, _currency)),
                    if (rate > 0)
                      KeyValue('بالريال', omr(_linksTotal * rate),
                          strong: true, color: GH.burgundy),
                  ],
                ),
              ),
          ],
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
          child: FilledButton(
            onPressed: _saving ? null : _save,
            child: _saving
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white))
                : const Text('حفظ الفاتورة'),
          ),
        ),
      ),
    );
  }

  Widget _itemInfo(OrderItem i) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(i.name, style: const TextStyle(fontWeight: FontWeight.w700)),
        Text(
          [
            if (i.customerName != null) i.customerName!,
            if (i.orderNo != null) 'GH-${i.orderNo.toString().padLeft(4, '0')}',
            'سعر البيع ${omr(i.price)}',
          ].join(' · '),
          style: const TextStyle(color: GH.muted, fontSize: 12),
        ),
      ],
    );
  }
}

class _ItemPicker extends StatefulWidget {
  const _ItemPicker({required this.options});

  final List<OrderItem> options;

  @override
  State<_ItemPicker> createState() => _ItemPickerState();
}

class _ItemPickerState extends State<_ItemPicker> {
  final Set<String> _selected = {};
  String _q = '';

  @override
  Widget build(BuildContext context) {
    final q = _q.trim().toLowerCase();
    final list = widget.options
        .where((i) =>
            q.isEmpty ||
            i.name.toLowerCase().contains(q) ||
            (i.customerName ?? '').toLowerCase().contains(q))
        .toList();
    return SafeArea(
      child: SizedBox(
        height: MediaQuery.of(context).size.height * 0.8,
        child: Column(
          children: [
            const Text('اختر القطع',
                style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: GH.burgundy)),
            Padding(
              padding: const EdgeInsets.all(12),
              child: TextField(
                decoration: const InputDecoration(
                    hintText: 'ابحث', prefixIcon: Icon(Icons.search)),
                onChanged: (v) => setState(() => _q = v),
              ),
            ),
            Expanded(
              child: ListView(
                children: list
                    .map((i) => CheckboxListTile(
                          value: _selected.contains(i.id),
                          activeColor: GH.burgundy,
                          onChanged: (v) => setState(() {
                            if (v == true) {
                              _selected.add(i.id);
                            } else {
                              _selected.remove(i.id);
                            }
                          }),
                          title: Text(i.name),
                          subtitle: Text([
                            if (i.customerName != null) i.customerName!,
                            i.status.label,
                            omr(i.price),
                          ].join(' · ')),
                        ))
                    .toList(),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(12),
              child: SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: _selected.isEmpty
                      ? null
                      : () => Navigator.pop(
                          context,
                          widget.options
                              .where((i) => _selected.contains(i.id))
                              .toList()),
                  child: Text('إضافة ${_selected.length} قطعة'),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
