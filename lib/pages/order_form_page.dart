import 'package:flutter/cupertino.dart';

import '../data/store.dart';
import '../format.dart';
import '../models.dart';
import '../ui/colors.dart';
import '../ui/kit.dart';
import 'customers_page.dart';
import 'price_entry.dart';
import 'trips_page.dart';

const paymentMethods = ['تحويل بنكي', 'نقداً', 'رابط دفع', 'أخرى'];

class _ItemDraft {
  final brand = TextEditingController();
  final name = TextEditingController();
  final details = TextEditingController();
  final price = PriceDraft();

  void dispose() {
    brand.dispose();
    name.dispose();
    details.dispose();
    price.dispose();
  }
}

/// New order. Returns the new order id.
class OrderFormPage extends StatefulWidget {
  const OrderFormPage({super.key, this.customer, this.tripId});

  final Customer? customer;
  final String? tripId;

  @override
  State<OrderFormPage> createState() => _OrderFormPageState();
}

class _OrderFormPageState extends State<OrderFormPage> {
  Customer? _customer;
  String? _tripId;
  final _delivery = TextEditingController();
  final _deposit = TextEditingController();
  final _notes = TextEditingController();
  final List<_ItemDraft> _items = [_ItemDraft()];
  String _method = paymentMethods.first;
  DeliveryMethod _deliveryMethod = DeliveryMethod.home;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _customer = widget.customer;
    _delivery.text = _fee(Store.i.settings.deliveryHomeFee);
    _tripId = widget.tripId ??
        (Store.i.trips.isNotEmpty ? Store.i.trips.first.id : null);
  }

  @override
  void dispose() {
    _delivery.dispose();
    _deposit.dispose();
    _notes.dispose();
    for (final i in _items) {
      i.dispose();
    }
    super.dispose();
  }

  String _fee(double v) => v == v.roundToDouble() ? v.toStringAsFixed(0) : v.toString();

  void _chooseDelivery(DeliveryMethod m) {
    setState(() {
      _deliveryMethod = m;
      _delivery.text =
          m.isCourier ? '' : _fee(Store.i.settings.feeFor(m));
    });
  }

  double get _itemsTotal =>
      _items.fold<double>(0, (s, d) => s + d.price.omrValue);

  Future<void> _pickCustomer() async {
    final c = await pushPage<Customer>(context, const CustomerPickerPage());
    if (c != null) setState(() => _customer = c);
  }

  Future<void> _pickTrip() async {
    final id = await pickTrip(context, current: _tripId);
    if (id != null) setState(() => _tripId = id.isEmpty ? null : id);
  }

  Future<void> _pickMethod() async {
    final m = await actionSheet<String>(context,
        title: 'طريقة الدفع',
        actions: paymentMethods.map((m) => SheetAction(m, m)).toList());
    if (m != null) setState(() => _method = m);
  }

  Future<void> _save() async {
    if (_customer == null) {
      toast(context, 'اختر العميل أول', error: true);
      return;
    }
    final items = _items
        .where((d) => d.name.text.trim().isNotEmpty)
        .map((d) => <String, dynamic>{
              'name': d.name.text.trim(),
              'brand': d.brand.text.trim().isEmpty ? null : d.brand.text.trim(),
              'details':
                  d.details.text.trim().isEmpty ? null : d.details.text.trim(),
              ...d.price.toMap(),
            })
        .toList();
    if (items.isEmpty) {
      toast(context, 'أضف قطعة وحدة على الأقل', error: true);
      return;
    }
    setState(() => _saving = true);
    try {
      final id = await Store.i.createOrder(
        customerId: _customer!.id,
        tripId: _tripId,
        deliveryFee: parseAmount(_delivery.text) ?? 0,
        deliveryMethod: _deliveryMethod.name,
        notes: _notes.text.trim().isEmpty ? null : _notes.text.trim(),
        items: items,
        deposit: parseAmount(_deposit.text) ?? 0,
        depositMethod: _method,
      );
      for (final d in _items) {
        await d.price.remember();
      }
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
    final delivery = parseAmount(_delivery.text) ?? 0;
    return GHPage(
      title: 'طلب جديد',
      leading: NavButton('إلغاء', onPressed: () => Navigator.pop(context)),
      trailing: _saving
          ? const CupertinoActivityIndicator()
          : NavButton('حفظ', bold: true, onPressed: _save),
      children: [
        Section(
          children: [
            PickerRow(
              label: 'العميل',
              value: _customer?.name,
              placeholder: 'اختر',
              onTap: _pickCustomer,
            ),
            PickerRow(
              label: 'الرحلة',
              value: Store.i.trip(_tripId)?.name,
              placeholder: 'بدون رحلة',
              onTap: _pickTrip,
            ),
          ],
        ),
        for (var k = 0; k < _items.length; k++)
          Section(
            header: 'القطعة ${k + 1}',
            trailing: _items.length > 1
                ? HeaderButton('حذف',
                    onPressed: () => setState(() => _items.removeAt(k).dispose()))
                : null,
            children: [
              FieldRow(
                  label: 'البراند',
                  controller: _items[k].brand,
                  placeholder: 'Cartier'),
              FieldRow(
                  label: 'القطعة',
                  controller: _items[k].name,
                  placeholder: 'Love Bracelet'),
              FieldRow(
                  label: 'التفاصيل',
                  controller: _items[k].details,
                  placeholder: 'المقاس، اللون…'),
              ..._items[k].price.rows(() => setState(() {})),
            ],
          ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
          child: SecondaryButton('إضافة قطعة',
              icon: CupertinoIcons.add,
              onPressed: () => setState(() => _items.add(_ItemDraft()))),
        ),
        Section(
          header: 'التوصيل والعربون',
          footer: _deliveryMethod.isCourier
              ? 'شحن خارج مسقط: اكتب سعر الشحن، ورقم الشحنة تضيفه من الطلب بعدين.'
              : 'سعر ثابت، تقدر تغيّره من بيانات الشركة.',
          children: [
            Segments<DeliveryMethod>(
              value: _deliveryMethod,
              options: {for (final m in DeliveryMethod.values) m: m.label},
              onChanged: _chooseDelivery,
            ),
            AmountRow(
                label: 'رسوم التوصيل',
                controller: _delivery,
                onChanged: (_) => setState(() {})),
            AmountRow(label: 'العربون', controller: _deposit),
            PickerRow(label: 'طريقة الدفع', value: _method, onTap: _pickMethod),
          ],
        ),
        Section(
          header: 'ملاحظات',
          children: [NotesRow(controller: _notes, placeholder: 'اختياري')],
        ),
        Section(
          children: [
            KV('مجموع القطع', omr(_itemsTotal)),
            KV('التوصيل', omr(delivery)),
            KV('الإجمالي', omr(_itemsTotal + delivery),
                strong: true, color: GH.burgundy),
          ],
        ),
      ],
    );
  }
}
