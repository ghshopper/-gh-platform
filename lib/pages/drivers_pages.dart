import 'dart:math';

import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../data/store.dart';
import '../format.dart';
import '../models.dart';
import '../ui/colors.dart';
import '../ui/kit.dart';
import 'item_pages.dart' show PhotoPage, Thumb;
import 'order_detail_page.dart';

String _randomPassword() {
  final r = Random.secure();
  return List.generate(6, (_) => r.nextInt(10)).join();
}

String _displayPhone(String? digits) {
  if (digits == null) return '';
  return digits.startsWith('968') && digits.length == 11
      ? digits.substring(3)
      : digits;
}

// ───────────────────────── Drivers list ─────────────────────────

class DriversPage extends StatelessWidget {
  const DriversPage({super.key});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Store.i,
      builder: (context, _) {
        final store = Store.i;
        return GHPage(
          title: 'المناديب',
          previousPageTitle: 'المزيد',
          trailing: NavIcon(CupertinoIcons.person_add,
              onPressed: () => presentForm(context, const DriverFormPage())),
          children: [
            if (store.drivers.isEmpty)
              const EmptyState(
                icon: CupertinoIcons.car_detailed,
                title: 'ما في مناديب',
                message:
                    'أضف مندوب، وهو يدخل التطبيق برقمه وكلمة مرور. يشوف بس الطلبات اللي تسندها له.',
              )
            else
              Section(
                children: store.drivers.map((d) {
                  final active = store.orders
                      .where((o) =>
                          o.driverId == d.id &&
                          o.driverStatus != DriverStatus.delivered)
                      .length;
                  return Tile(
                    leading: Avatar(d.name),
                    title: d.name,
                    subtitle: [
                      _displayPhone(d.phone),
                      if (!d.active) 'موقوف',
                    ].where((e) => e.isNotEmpty).join(' · '),
                    value: active > 0 ? '$active طلب' : null,
                    valueStyle: const TextStyle(fontSize: 14, color: GH.blue),
                    onTap: () =>
                        pushPage(context, DriverDetailPage(driverId: d.id)),
                  );
                }).toList(),
              ),
          ],
        );
      },
    );
  }
}

// ───────────────────────── Add driver ─────────────────────────

class DriverFormPage extends StatefulWidget {
  const DriverFormPage({super.key});

  @override
  State<DriverFormPage> createState() => _DriverFormPageState();
}

class _DriverFormPageState extends State<DriverFormPage> {
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _password = TextEditingController(text: _randomPassword());
  bool _saving = false;

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final phone = normalizeDigits(_phone.text).replaceAll(RegExp(r'\D'), '');
    if (_name.text.trim().isEmpty || phone.length < 8) {
      toast(context, 'اكتب الاسم ورقم الجوال', error: true);
      return;
    }
    if (_password.text.length < 6) {
      toast(context, 'كلمة المرور ٦ خانات على الأقل', error: true);
      return;
    }
    setState(() => _saving = true);
    try {
      await Store.i.createDriver(
          name: _name.text.trim(), phone: phone, password: _password.text);
      if (!mounted) return;
      await _shareLogin(context, _name.text.trim(), phone, _password.text);
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
      title: 'مندوب جديد',
      leading: NavButton('إلغاء', onPressed: () => Navigator.pop(context)),
      trailing: _saving
          ? const CupertinoActivityIndicator()
          : NavButton('إضافة', bold: true, onPressed: _save),
      children: [
        Section(
          footer:
              'المندوب يحمّل نفس التطبيق ويدخل برقم جواله وكلمة المرور هذي.',
          children: [
            FieldRow(label: 'الاسم', controller: _name, autofocus: true),
            FieldRow(
                label: 'الجوال',
                controller: _phone,
                placeholder: '9XXXXXXX',
                keyboard: TextInputType.phone,
                ltr: true),
            FieldRow(
                label: 'كلمة المرور',
                controller: _password,
                keyboard: TextInputType.number,
                ltr: true),
          ],
        ),
      ],
    );
  }
}

/// Offers to send the driver their login details on WhatsApp.
Future<void> _shareLogin(
    BuildContext context, String name, String phone, String password) async {
  final msg = 'هلا $name 👋\n'
      'هذي بيانات دخولك لتطبيق GH Shopper للتوصيل:\n'
      'الرقم: ${_displayPhone(phone.length == 8 ? '968$phone' : phone)}\n'
      'كلمة المرور: $password';
  final a = await actionSheet<String>(context,
      title: 'تم إضافة $name',
      message: 'أرسل له بيانات الدخول؟',
      actions: const [
        SheetAction('إرسال واتساب', 'wa'),
        SheetAction('نسخ', 'copy'),
      ]);
  if (a == 'wa') {
    final p = waPhone(phone);
    await launchUrl(
        Uri.parse(
            'https://wa.me/${p ?? ''}?text=${Uri.encodeComponent(msg)}'),
        mode: LaunchMode.externalApplication);
  } else if (a == 'copy') {
    await Clipboard.setData(ClipboardData(text: msg));
  }
}

// ───────────────────────── Driver detail ─────────────────────────

class DriverDetailPage extends StatelessWidget {
  const DriverDetailPage({super.key, required this.driverId});

  final String driverId;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Store.i,
      builder: (context, _) {
        final store = Store.i;
        final d = store.driver(driverId);
        if (d == null) {
          return const GHPage(title: 'المندوب', children: [
            EmptyState(icon: CupertinoIcons.person, title: 'غير موجود'),
          ]);
        }
        final orders = store.orders.where((o) => o.driverId == d.id).toList();
        final open =
            orders.where((o) => o.driverStatus != DriverStatus.delivered).toList();
        final done =
            orders.where((o) => o.driverStatus == DriverStatus.delivered).toList();
        final collect = open
            .where((o) => o.deliveryCollect)
            .fold<double>(0, (s, o) => s + o.deliveryFee);

        Future<void> resetPassword() async {
          final pw = _randomPassword();
          try {
            await store.setDriverPassword(d.id, pw);
            if (context.mounted) {
              await _shareLogin(context, d.name, d.phone ?? '', pw);
            }
          } catch (e) {
            if (context.mounted) toast(context, errorText(e), error: true);
          }
        }

        Future<void> delete() async {
          if (!await confirm(context, 'حذف ${d.name}؟',
              message: 'يتسكّر حسابه، والطلبات تبقى عندك.', ok: 'حذف')) {
            return;
          }
          try {
            await store.deleteDriver(d.id);
            if (context.mounted) Navigator.pop(context);
          } catch (e) {
            if (context.mounted) toast(context, errorText(e), error: true);
          }
        }

        return GHPage(
          title: d.name,
          previousPageTitle: 'المناديب',
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
              child: Row(children: [
                Expanded(
                    child: StatCard(
                        label: 'طلبات معه',
                        value: '${open.length}',
                        hero: true,
                        icon: CupertinoIcons.car_detailed)),
                const SizedBox(width: 10),
                Expanded(
                    child: StatCard(
                        label: 'توصيل يحصّله',
                        value: omr(collect),
                        color: GH.amber,
                        icon: CupertinoIcons.money_dollar_circle_fill)),
              ]),
            ),
            Section(children: [
              Tile(
                leading: const IconBox(CupertinoIcons.chat_bubble_fill,
                    color: Color(0xFF25D366)),
                title: 'واتساب',
                value: _displayPhone(d.phone),
                onTap: () {
                  final p = waPhone(d.phone);
                  if (p != null) {
                    launchUrl(Uri.parse('https://wa.me/$p'),
                        mode: LaunchMode.externalApplication);
                  }
                },
              ),
              SwitchRow(
                label: 'الحساب شغّال',
                subtitle: d.active ? null : 'ما يقدر يشوف أي طلب',
                value: d.active,
                onChanged: (v) => store.saveDriver(d.id, active: v),
              ),
              Tile(
                leading: const IconBox(CupertinoIcons.lock_rotation,
                    color: GH.purple),
                title: 'كلمة مرور جديدة',
                onTap: resetPassword,
              ),
            ]),
            if (open.isNotEmpty)
              Section(
                header: 'معه الحين',
                children: open.map((o) => _DeliveryRow(order: o)).toList(),
              ),
            if (done.isNotEmpty)
              Section(
                header: 'سلّمها',
                children: done.take(20).map((o) => _DeliveryRow(order: o)).toList(),
              ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 24, 16, 0),
              child: CupertinoButton(
                onPressed: delete,
                child: const Text('حذف المندوب',
                    style: TextStyle(color: GH.red)),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _DeliveryRow extends StatelessWidget {
  const _DeliveryRow({required this.order});

  final Order order;

  @override
  Widget build(BuildContext context) {
    final s = order.driverStatus;
    return Tile(
      leading: order.deliveryPhotoPath == null
          ? Avatar(Store.i.customerName(order), size: 34)
          : Thumb(order.deliveryPhotoPath!, size: 38),
      title: Store.i.customerName(order),
      subtitle: [
        order.invoiceNo,
        if (order.deliveryCollect && order.deliveryFee > 0)
          'يحصّل ${omr(order.deliveryFee)}',
      ].join(' · '),
      trailing: s == null ? null : Badge(s.label, color: s.color),
      onTap: () => pushPage(context, OrderDetailPage(orderId: order.id)),
    );
  }
}

// ───────────────────────── Delivery of one order ─────────────────────────

/// Choose the driver, address and who pays delivery for an order.
class DeliveryPage extends StatefulWidget {
  const DeliveryPage({super.key, required this.order});

  final Order order;

  @override
  State<DeliveryPage> createState() => _DeliveryPageState();
}

class _DeliveryPageState extends State<DeliveryPage> {
  late final Order _o = widget.order;
  late String? _driverId = _o.driverId;
  late final _address = TextEditingController(
      text: _o.deliveryAddress ?? Store.i.customer(_o.customerId)?.address);
  late final _note = TextEditingController(text: _o.driverNote);
  late bool _collect = _o.driverId == null
      ? _o.deliveryFee > 0 && _o.hasBalance
      : _o.deliveryCollect;
  late DeliveryMethod _method = _o.deliveryMethod ?? DeliveryMethod.home;
  late final _fee = TextEditingController(text: plainFee(_o.deliveryFee));
  late final _tracking = TextEditingController(text: _o.carrierTracking);
  bool _saving = false;

  static String plainFee(double v) =>
      v == v.roundToDouble() ? v.toStringAsFixed(0) : v.toString();

  void _chooseMethod(DeliveryMethod m) {
    setState(() {
      _method = m;
      if (!m.isCourier) _fee.text = plainFee(Store.i.settings.feeFor(m));
      if (m.isCourier) _driverId = null;
    });
  }

  @override
  void dispose() {
    _address.dispose();
    _note.dispose();
    _fee.dispose();
    _tracking.dispose();
    super.dispose();
  }

  Future<void> _pickDriver() async {
    final drivers = Store.i.drivers.where((d) => d.active).toList();
    if (drivers.isEmpty) {
      toast(context, 'أضف مندوب أول من المزيد ← المناديب', error: true);
      return;
    }
    final id = await actionSheet<String>(context,
        title: 'المندوب',
        actions: [
          for (final d in drivers) SheetAction(d.name, d.id),
          if (_driverId != null)
            const SheetAction('بدون مندوب', '', destructive: true),
        ]);
    if (id != null) setState(() => _driverId = id.isEmpty ? null : id);
  }

  Future<void> _save() async {
    setState(() => _saving = true);
    try {
      final addr = _address.text.trim();
      final trk = _tracking.text.trim();
      await Store.i.updateOrder(_o.id, {
        'delivery_method': _method.name,
        'delivery_fee': parseAmount(_fee.text) ?? 0,
        'carrier_tracking': _method.isCourier && trk.isNotEmpty ? trk : null,
      });
      await Store.i.setDelivery(
        _o,
        driverId: _driverId,
        address: addr.isEmpty ? null : addr,
        collect: _collect,
        note: _note.text.trim().isEmpty ? null : _note.text.trim(),
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
    final s = _o.driverId == _driverId ? _o.driverStatus : null;
    return GHPage(
      title: 'التوصيل',
      leading: NavButton('إلغاء', onPressed: () => Navigator.pop(context)),
      trailing: _saving
          ? const CupertinoActivityIndicator()
          : NavButton('حفظ', bold: true, onPressed: _save),
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(32, 0, 32, 0),
          child: Text(
              '${Store.i.customerName(_o)} · ${_o.invoiceNo}', style: T.sub),
        ),
        Section(
          header: 'طريقة التوصيل',
          children: [
            Segments<DeliveryMethod>(
              value: _method,
              options: {for (final m in DeliveryMethod.values) m: m.label},
              onChanged: _chooseMethod,
            ),
            AmountRow(label: 'رسوم التوصيل', controller: _fee),
            if (_method.isCourier)
              FieldRow(
                label: 'رقم الشحنة',
                controller: _tracking,
                placeholder: 'من ${_method.label}',
                ltr: true,
              ),
          ],
        ),
        if (!_method.isCourier) Section(children: [
          PickerRow(
            label: 'المندوب',
            value: Store.i.driver(_driverId)?.name,
            placeholder: 'اختر',
            onTap: _pickDriver,
          ),
          if (s != null)
            Tile(
              title: 'الحالة',
              trailing: Badge(s.label, color: s.color),
              chevron: false,
            ),
        ]),
        Section(
          header: 'العنوان',
          footer: 'يطلع للمندوب. تقدر تلصق رابط الموقع من خرائط قوقل.',
          children: [
            NotesRow(
                controller: _address,
                placeholder: 'الحي، السكة، رقم المنزل، أو رابط الموقع'),
          ],
        ),
        if (!_method.isCourier) Section(
          header: 'الدفع',
          children: [
            Segments<bool>(
              value: _collect,
              options: const {
                false: 'مدفوعة مسبقاً',
                true: 'يحصّلها المندوب',
              },
              onChanged: (v) => setState(() => _collect = v),
            ),
          ],
        ),
        if (!_method.isCourier) Section(
          header: 'ملاحظة للمندوب',
          children: [
            NotesRow(
                controller: _note,
                placeholder: 'مثلاً: اتصل قبل لا توصل، بعد الساعة ٥'),
          ],
        ),
        if (_o.deliveryPhotoPath != null)
          Section(
            header: 'صورة التسليم',
            children: [
              Tile(
                leading: Thumb(_o.deliveryPhotoPath!, size: 52),
                title: 'صورة من المندوب',
                subtitle: _o.driverDeliveredAt == null
                    ? null
                    : dateStr(_o.driverDeliveredAt),
                onTap: () => pushPage(
                    context,
                    PhotoPage(
                        path: _o.deliveryPhotoPath!, title: 'صورة التسليم')),
              ),
            ],
          ),
      ],
    );
  }
}
