import 'package:flutter/cupertino.dart';
import 'package:url_launcher/url_launcher.dart';

import '../data/store.dart';
import '../format.dart';
import '../models.dart';
import '../ui/colors.dart';
import '../ui/kit.dart';
import 'order_detail_page.dart';
import 'order_form_page.dart';
import 'orders_page.dart';

bool _matches(Customer c, String query) {
  final q = normalizeDigits(query).trim().toLowerCase();
  if (q.isEmpty) return true;
  return c.name.toLowerCase().contains(q) ||
      normalizeDigits(c.phone ?? '').contains(q);
}

class CustomersPage extends StatefulWidget {
  const CustomersPage({super.key});

  @override
  State<CustomersPage> createState() => _CustomersPageState();
}

class _CustomersPageState extends State<CustomersPage> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Store.i,
      builder: (context, _) {
        final store = Store.i;
        final list = store.customers.where((c) => _matches(c, _query)).toList();
        return GHPage(
          title: 'العملاء',
          onRefresh: store.refresh,
          trailing: NavIcon(CupertinoIcons.person_add,
              onPressed: () => presentForm(context, const CustomerFormPage())),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
              child: CupertinoSearchTextField(
                placeholder: 'بحث بالاسم أو الرقم',
                onChanged: (v) => setState(() => _query = v),
              ),
            ),
            if (!store.ready)
              const Loading()
            else if (store.customers.isEmpty)
              const EmptyState(
                  icon: CupertinoIcons.person_2, title: 'ما في عملاء للحين')
            else
              Section(
                header: '${list.length} عميل',
                children: list.map((c) {
                  final orders = store.ordersOf(c.id);
                  final owed = orders.fold<double>(
                      0, (s, o) => s + (o.remaining > 0 ? o.remaining : 0));
                  return Tile(
                    leading: Avatar(c.name),
                    title: c.name,
                    subtitle: [
                      if (c.phone != null) c.phone!,
                      '${orders.length} طلب',
                    ].join(' · '),
                    value: owed > 0.0005 ? omr(owed) : null,
                    valueStyle: const TextStyle(fontSize: 14, color: GH.red),
                    onTap: () =>
                        pushPage(context, CustomerDetailPage(customerId: c.id)),
                  );
                }).toList(),
              ),
          ],
        );
      },
    );
  }
}

// ───────────────────────── Detail ─────────────────────────

class CustomerDetailPage extends StatelessWidget {
  const CustomerDetailPage({super.key, required this.customerId});

  final String customerId;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Store.i,
      builder: (context, _) {
        final store = Store.i;
        final c = store.customer(customerId);
        if (c == null) {
          return const GHPage(title: 'العميل', children: [
            EmptyState(icon: CupertinoIcons.person, title: 'غير موجود'),
          ]);
        }
        final orders = store.ordersOf(c.id);
        final total = orders.fold<double>(0, (s, o) => s + o.total);
        final owed = orders.fold<double>(
            0, (s, o) => s + (o.remaining > 0 ? o.remaining : 0));
        final balance = orders.fold<double>(0, (s, o) => s + o.customerBalance);

        Future<void> delete() async {
          if (orders.isNotEmpty) {
            toast(context, 'عنده طلبات. احذف الطلبات أول.', error: true);
            return;
          }
          if (await confirm(context, 'حذف ${c.name}؟')) {
            try {
              await store.deleteCustomer(c.id);
              if (context.mounted) Navigator.pop(context);
            } catch (e) {
              if (context.mounted) toast(context, errorText(e), error: true);
            }
          }
        }

        return GHPage(
          title: c.name,
          previousPageTitle: 'العملاء',
          trailing: NavButton('تعديل',
              onPressed: () =>
                  presentForm(context, CustomerFormPage(customer: c))),
          bottom: PrimaryButton('طلب جديد له',
              icon: CupertinoIcons.add,
              onPressed: () async {
                final id = await presentForm<String>(
                    context, OrderFormPage(customer: c));
                if (id != null && context.mounted) {
                  pushPage(context, OrderDetailPage(orderId: id));
                }
              }),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
              child: Row(
                children: [
                  Expanded(
                      child: StatCard(label: 'المشتريات', value: omr(total), hero: true, icon: CupertinoIcons.bag_fill)),
                  const SizedBox(width: 10),
                  Expanded(
                      child: StatCard(
                          label: 'عليه',
                          value: omr(owed),
                          color: GH.red)),
                ],
              ),
            ),
            Section(children: [
              if (c.phone != null)
                Tile(
                  leading: const IconBox(CupertinoIcons.chat_bubble_fill,
                      color: Color(0xFF25D366)),
                  title: 'واتساب',
                  value: c.phone,
                  onTap: () {
                    final p = waPhone(c.phone);
                    if (p != null) {
                      launchUrl(Uri.parse('https://wa.me/$p'),
                          mode: LaunchMode.externalApplication);
                    }
                  },
                ),
              if (c.phone != null)
                Tile(
                  leading: const IconBox(CupertinoIcons.phone_fill,
                      color: GH.green),
                  title: 'اتصال',
                  onTap: () => launchUrl(Uri.parse('tel:${c.phone}')),
                ),
              Tile(
                  title: 'النوع',
                  value: c.isMale ? 'عميل' : 'عميلة',
                  chevron: false),
              if (c.city != null)
                Tile(title: 'المنطقة', value: c.city, chevron: false),
              if (c.address != null)
                Tile(title: 'العنوان', subtitle: c.address, chevron: false),
              Tile(
                  title: 'رصيده عندك',
                  value: omr(balance),
                  valueStyle: TextStyle(
                      fontSize: 16,
                      color: balance < -0.0005 ? GH.red : GH.green),
                  chevron: false),
            ]),
            if (c.notes != null)
              Section(header: 'ملاحظات', children: [
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(c.notes!, style: T.body),
                ),
              ]),
            if (orders.isEmpty)
              const EmptyState(
                  icon: CupertinoIcons.doc_text, title: 'ما عنده طلبات')
            else
              Section(
                header: 'الطلبات',
                children: orders
                    .map((o) => OrderRow(
                          order: o,
                          showCustomer: false,
                          onTap: () =>
                              pushPage(context, OrderDetailPage(orderId: o.id)),
                        ))
                    .toList(),
              ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 24, 16, 0),
              child: CupertinoButton(
                onPressed: delete,
                child: const Text('حذف العميل',
                    style: TextStyle(color: GH.red)),
              ),
            ),
          ],
        );
      },
    );
  }
}

// ───────────────────────── Form ─────────────────────────

/// Add or edit a customer. Returns the saved [Customer].
class CustomerFormPage extends StatefulWidget {
  const CustomerFormPage({super.key, this.customer});

  final Customer? customer;

  @override
  State<CustomerFormPage> createState() => _CustomerFormPageState();
}

class _CustomerFormPageState extends State<CustomerFormPage> {
  late final _name = TextEditingController(text: widget.customer?.name);
  late final _phone = TextEditingController(text: widget.customer?.phone);
  late final _city = TextEditingController(text: widget.customer?.city);
  late final _address = TextEditingController(text: widget.customer?.address);
  late final _notes = TextEditingController(text: widget.customer?.notes);
  late bool _male = widget.customer?.isMale ?? false;
  bool _saving = false;

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _city.dispose();
    _address.dispose();
    _notes.dispose();
    super.dispose();
  }

  String? _clean(TextEditingController c) =>
      c.text.trim().isEmpty ? null : c.text.trim();

  Future<void> _save() async {
    if (_name.text.trim().isEmpty) {
      toast(context, 'اكتب الاسم', error: true);
      return;
    }
    setState(() => _saving = true);
    try {
      final c = await Store.i.saveCustomer(
        id: widget.customer?.id,
        name: _name.text.trim(),
        phone: _clean(_phone),
        city: _clean(_city),
        address: _clean(_address),
        notes: _clean(_notes),
        isMale: _male,
      );
      if (mounted) Navigator.pop(context, c);
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
      title: widget.customer == null ? 'عميل جديد' : 'تعديل العميل',
      leading: NavButton('إلغاء', onPressed: () => Navigator.pop(context)),
      trailing: _saving
          ? const CupertinoActivityIndicator()
          : NavButton('حفظ', bold: true, onPressed: _save),
      children: [
        Section(children: [
          Segments<bool>(
            value: _male,
            options: const {false: 'عميلة', true: 'عميل'},
            onChanged: (v) => setState(() => _male = v),
          ),
          FieldRow(
              label: 'الاسم',
              controller: _name,
              autofocus: widget.customer == null),
          FieldRow(
              label: 'الجوال',
              controller: _phone,
              placeholder: '9XXXXXXX',
              keyboard: TextInputType.phone,
              ltr: true),
          FieldRow(label: 'المنطقة', controller: _city, placeholder: 'اختياري'),
          FieldRow(
              label: 'العنوان',
              controller: _address,
              placeholder: 'للمندوب: الحي، السكة، المنزل أو رابط الموقع'),
        ]),
        Section(
          header: 'ملاحظات',
          children: [
            NotesRow(
                controller: _notes,
                placeholder: 'المقاسات، الذوق، البراندات المفضلة…'),
          ],
        ),
      ],
    );
  }
}

// ───────────────────────── Picker ─────────────────────────

/// Choose a customer (or add a new one). Returns the chosen [Customer].
class CustomerPickerPage extends StatefulWidget {
  const CustomerPickerPage({super.key});

  @override
  State<CustomerPickerPage> createState() => _CustomerPickerPageState();
}

class _CustomerPickerPageState extends State<CustomerPickerPage> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final list = Store.i.customers.where((c) => _matches(c, _query)).toList();
    return GHPage(
      title: 'اختر العميل',
      previousPageTitle: 'رجوع',
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
          child: CupertinoSearchTextField(
            autofocus: true,
            onChanged: (v) => setState(() => _query = v),
          ),
        ),
        Section(children: [
          Tile(
            leading: const IconBox(CupertinoIcons.person_add),
            title: 'عميل جديد',
            titleStyle: const TextStyle(fontSize: 16, color: GH.burgundy),
            onTap: () async {
              final c = await presentForm<Customer>(
                  context, const CustomerFormPage());
              if (c != null && context.mounted) Navigator.pop(context, c);
            },
          ),
        ]),
        if (list.isNotEmpty)
          Section(
            children: list
                .map((c) => Tile(
                      leading: Avatar(c.name, size: 32),
                      title: c.name,
                      subtitle: c.phone,
                      onTap: () => Navigator.pop(context, c),
                    ))
                .toList(),
          ),
      ],
    );
  }
}
