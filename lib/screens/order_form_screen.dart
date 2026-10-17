import 'package:flutter/material.dart';

import '../format.dart';
import '../models.dart';
import '../repo.dart';
import '../theme.dart';
import '../widgets.dart';
import 'customer_form_screen.dart';

class _ItemRow {
  final name = TextEditingController();
  final details = TextEditingController();
  final price = TextEditingController();

  void dispose() {
    name.dispose();
    details.dispose();
    price.dispose();
  }
}

/// Creates a new order. Returns the new order id.
class OrderFormScreen extends StatefulWidget {
  const OrderFormScreen({super.key, this.customer});

  final Customer? customer;

  @override
  State<OrderFormScreen> createState() => _OrderFormScreenState();
}

class _OrderFormScreenState extends State<OrderFormScreen> {
  final _form = GlobalKey<FormState>();
  final _trip = TextEditingController(text: 'أوروبا');
  final _delivery = TextEditingController();
  final _deposit = TextEditingController();
  final _notes = TextEditingController();
  final List<_ItemRow> _items = [_ItemRow()];
  String _depositMethod = 'تحويل بنكي';

  List<Customer> _customers = [];
  String? _customerId;
  bool _loading = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _customerId = widget.customer?.id;
    _loadCustomers();
  }

  Future<void> _loadCustomers() async {
    try {
      final list = await Repo.customers();
      if (!mounted) return;
      setState(() {
        _customers = list;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
      showMsg(context, errorText(e), error: true);
    }
  }

  @override
  void dispose() {
    _trip.dispose();
    _delivery.dispose();
    _deposit.dispose();
    _notes.dispose();
    for (final r in _items) {
      r.dispose();
    }
    super.dispose();
  }

  Future<void> _newCustomer() async {
    final c = await Navigator.push<Customer>(
        context, MaterialPageRoute(builder: (_) => const CustomerFormScreen()));
    if (c == null) return;
    setState(() {
      _customers = [..._customers, c]..sort((a, b) => a.name.compareTo(b.name));
      _customerId = c.id;
    });
  }

  double get _itemsTotal => _items.fold<double>(
      0, (s, r) => s + (parseAmount(r.price.text) ?? 0));

  Future<void> _save() async {
    if (_customerId == null) {
      showMsg(context, 'اختر العميلة أول', error: true);
      return;
    }
    if (!(_form.currentState?.validate() ?? false)) return;
    final items = _items
        .where((r) => r.name.text.trim().isNotEmpty)
        .map((r) => <String, dynamic>{
              'name': r.name.text.trim(),
              'details':
                  r.details.text.trim().isEmpty ? null : r.details.text.trim(),
              'price': parseAmount(r.price.text) ?? 0,
            })
        .toList();
    if (items.isEmpty) {
      showMsg(context, 'أضف قطعة وحدة على الأقل', error: true);
      return;
    }
    setState(() => _saving = true);
    try {
      final id = await Repo.createOrder(
        customerId: _customerId!,
        trip: _trip.text.trim().isEmpty ? null : _trip.text.trim(),
        deliveryFee: parseAmount(_delivery.text) ?? 0,
        notes: _notes.text.trim().isEmpty ? null : _notes.text.trim(),
        items: items,
        deposit: parseAmount(_deposit.text) ?? 0,
        depositMethod: _depositMethod,
      );
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
    return Scaffold(
      appBar: AppBar(title: const Text('طلب جديد')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Form(
              key: _form,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
                children: [
                  const SectionTitle('العميلة'),
                  Row(
                    children: [
                      Expanded(
                        child: DropdownButtonFormField<String>(
                          value: _customerId,
                          isExpanded: true,
                          decoration:
                              const InputDecoration(labelText: 'اختر العميلة'),
                          items: _customers
                              .map((c) => DropdownMenuItem(
                                    value: c.id,
                                    child: Text(
                                      c.phone == null
                                          ? c.name
                                          : '${c.name} · ${c.phone}',
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ))
                              .toList(),
                          onChanged: (v) => setState(() => _customerId = v),
                        ),
                      ),
                      const SizedBox(width: 8),
                      IconButton.filled(
                        style: IconButton.styleFrom(
                            backgroundColor: GH.burgundy,
                            minimumSize: const Size(48, 48)),
                        tooltip: 'عميلة جديدة',
                        onPressed: _newCustomer,
                        icon: const Icon(Icons.person_add_alt_1),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _trip,
                    decoration: const InputDecoration(
                        labelText: 'الرحلة (اختياري)',
                        hintText: 'مثلاً: أوروبا أكتوبر'),
                  ),
                  SectionTitle(
                    'القطع',
                    trailing: TextButton.icon(
                      onPressed: () => setState(() => _items.add(_ItemRow())),
                      icon: const Icon(Icons.add),
                      label: const Text('قطعة'),
                    ),
                  ),
                  ..._items.asMap().entries.map((e) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: _itemEditor(e.key, e.value),
                      )),
                  const SectionTitle('التوصيل والعربون'),
                  AmountField(
                      controller: _delivery,
                      label: 'رسوم التوصيل',
                      onChanged: (_) => setState(() {})),
                  const SizedBox(height: 12),
                  AmountField(
                      controller: _deposit, label: 'العربون المدفوع (اختياري)'),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    value: _depositMethod,
                    decoration:
                        const InputDecoration(labelText: 'طريقة دفع العربون'),
                    items: paymentMethods
                        .map((m) => DropdownMenuItem(value: m, child: Text(m)))
                        .toList(),
                    onChanged: (v) =>
                        setState(() => _depositMethod = v ?? _depositMethod),
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _notes,
                    maxLines: 3,
                    decoration:
                        const InputDecoration(labelText: 'ملاحظات (اختياري)'),
                  ),
                  const SizedBox(height: 16),
                  GhCard(
                    child: Column(
                      children: [
                        KeyValue('مجموع القطع', omr(_itemsTotal)),
                        KeyValue('التوصيل',
                            omr(parseAmount(_delivery.text) ?? 0)),
                        KeyValue(
                          'الإجمالي',
                          omr(_itemsTotal + (parseAmount(_delivery.text) ?? 0)),
                          strong: true,
                          color: GH.burgundy,
                        ),
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
            onPressed: _saving || _loading ? null : _save,
            child: _saving
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white))
                : const Text('حفظ الطلب'),
          ),
        ),
      ),
    );
  }

  Widget _itemEditor(int index, _ItemRow r) {
    return GhCard(
      child: Column(
        children: [
          Row(
            children: [
              Text('قطعة ${index + 1}',
                  style: const TextStyle(
                      fontWeight: FontWeight.w700, color: GH.burgundy)),
              const Spacer(),
              if (_items.length > 1)
                IconButton(
                  tooltip: 'حذف',
                  icon: const Icon(Icons.delete_outline, color: GH.red),
                  onPressed: () => setState(() {
                    _items.removeAt(index).dispose();
                  }),
                ),
            ],
          ),
          TextFormField(
            controller: r.name,
            decoration: const InputDecoration(
                labelText: 'اسم القطعة', hintText: 'مثلاً: Cartier Love'),
          ),
          const SizedBox(height: 10),
          TextFormField(
            controller: r.details,
            decoration: const InputDecoration(
                labelText: 'التفاصيل (اختياري)',
                hintText: 'المقاس، اللون، المعدن…'),
          ),
          const SizedBox(height: 10),
          AmountField(
            controller: r.price,
            label: 'السعر للعميلة (شامل العمولة)',
            onChanged: (_) => setState(() {}),
          ),
        ],
      ),
    );
  }
}

const paymentMethods = ['تحويل بنكي', 'نقداً', 'رابط دفع', 'أخرى'];
