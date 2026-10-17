import 'dart:typed_data';

import 'package:flutter/cupertino.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../format.dart';
import '../models.dart';
import '../ui/colors.dart';
import '../ui/kit.dart';
import 'item_pages.dart' show PhotoPage, Thumb;

/// Loads the signed-in driver's orders through the secure RPCs.
class DriverData extends ChangeNotifier {
  DriverData._();
  static final DriverData i = DriverData._();

  SupabaseClient get _db => Supabase.instance.client;

  List<DriverOrder> orders = [];
  bool ready = false;
  Object? error;

  Future<void> refresh() async {
    try {
      final res = await _db.rpc('gh_driver_orders');
      final list = (res as List?) ?? const [];
      orders = list
          .map((e) => DriverOrder.fromMap(Map<String, dynamic>.from(e as Map)))
          .toList();
      error = null;
    } catch (e) {
      error = e;
    } finally {
      ready = true;
      notifyListeners();
    }
  }

  Future<void> setStatus(DriverOrder o, DriverStatus s,
      {List<int>? photoBytes}) async {
    String? path;
    if (photoBytes != null) {
      final uid = _db.auth.currentUser!.id;
      path = '$uid/delivery-${o.id}-${DateTime.now().millisecondsSinceEpoch}.jpg';
      await _db.storage.from('gh-photos').uploadBinary(
            path,
            Uint8List.fromList(photoBytes),
            fileOptions: const FileOptions(contentType: 'image/jpeg'),
          );
    }
    await _db.rpc('gh_driver_update', params: {
      'p_order': o.id,
      'p_status': s.name,
      'p_photo': path,
    });
    await refresh();
  }

  void clear() {
    orders = [];
    ready = false;
  }
}

// ───────────────────────── Home ─────────────────────────

class DriverHome extends StatefulWidget {
  const DriverHome({super.key, required this.name});

  final String name;

  @override
  State<DriverHome> createState() => _DriverHomeState();
}

class _DriverHomeState extends State<DriverHome> {
  bool _showDone = false;

  @override
  void initState() {
    super.initState();
    DriverData.i.refresh();
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: DriverData.i,
      builder: (context, _) {
        final data = DriverData.i;
        final open = data.orders.where((o) => !o.isDone).toList();
        final done = data.orders.where((o) => o.isDone).toList();
        final list = _showDone ? done : open;
        final collect = open
            .where((o) => o.collect)
            .fold<double>(0, (s, o) => s + o.deliveryFee);
        return GHPage(
          title: 'توصيلاتي',
          onRefresh: data.refresh,
          trailing: NavButton('خروج', onPressed: () async {
            if (await confirm(context, 'تسجيل خروج؟',
                ok: 'خروج', destructive: true)) {
              DriverData.i.clear();
              await Supabase.instance.client.auth.signOut();
            }
          }),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 4),
              child: Text('هلا ${widget.name} 👋', style: T.sub),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: Row(children: [
                Expanded(
                    child: StatCard(
                        label: 'للتوصيل',
                        value: '${open.length}',
                        hero: true,
                        icon: CupertinoIcons.car_detailed)),
                const SizedBox(width: 10),
                Expanded(
                    child: StatCard(
                        label: 'تحصّل توصيل',
                        value: omr(collect),
                        color: GH.amber,
                        icon: CupertinoIcons.money_dollar_circle_fill)),
              ]),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
              child: CupertinoSlidingSegmentedControl<bool>(
                groupValue: _showDone,
                children: {
                  false: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: Text('الحالية (${open.length})')),
                  true: Text('المسلّمة (${done.length})'),
                },
                onValueChanged: (v) => setState(() => _showDone = v ?? false),
              ),
            ),
            if (!data.ready)
              const Loading()
            else if (data.error != null && data.orders.isEmpty)
              EmptyState(
                icon: CupertinoIcons.wifi_exclamationmark,
                title: 'ما قدرنا نحمّل الطلبات',
                message: errorText(data.error!),
              )
            else if (list.isEmpty)
              EmptyState(
                icon: _showDone
                    ? CupertinoIcons.checkmark_seal
                    : CupertinoIcons.cube_box,
                title: _showDone ? 'ما سلّمت شي للحين' : 'ما عندك توصيلات الحين',
                message: _showDone ? null : 'اسحب لتحت عشان تحدّث.',
              )
            else
              Section(
                children: list
                    .map((o) => Tile(
                          leading: Avatar(o.customerName),
                          title: o.customerName,
                          subtitle: [
                            o.customerCity ?? o.address ?? o.invoiceNo,
                            '${o.items.length} قطعة',
                          ].join(' · '),
                          trailing: o.isDone
                              ? Badge('تم ✓', color: GH.green)
                              : o.collect && o.deliveryFee > 0
                                  ? Badge('حصّل ${omr(o.deliveryFee)}',
                                      color: GH.amber)
                                  : Badge('مدفوع', color: GH.blue),
                          onTap: () => pushPage(
                              context, DriverOrderPage(orderId: o.id)),
                        ))
                    .toList(),
              ),
          ],
        );
      },
    );
  }
}

// ───────────────────────── One delivery ─────────────────────────

class DriverOrderPage extends StatefulWidget {
  const DriverOrderPage({super.key, required this.orderId});

  final String orderId;

  @override
  State<DriverOrderPage> createState() => _DriverOrderPageState();
}

class _DriverOrderPageState extends State<DriverOrderPage> {
  bool _busy = false;

  Future<void> _picked(DriverOrder o) async {
    setState(() => _busy = true);
    try {
      await DriverData.i.setStatus(o, DriverStatus.picked);
      if (mounted) toast(context, 'بالتوفيق 🚗');
    } catch (e) {
      if (mounted) toast(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _delivered(DriverOrder o) async {
    final source = await actionSheet<ImageSource>(context,
        title: 'صورة التسليم',
        message: 'صوّر الطلب مع الزبون أو عند الباب',
        actions: const [
          SheetAction('الكاميرا', ImageSource.camera),
          SheetAction('من الصور', ImageSource.gallery),
        ]);
    if (source == null) return;
    final file = await ImagePicker()
        .pickImage(source: source, maxWidth: 1600, imageQuality: 75);
    if (file == null) return;
    if (o.collect && o.deliveryFee > 0 && mounted) {
      final ok = await confirm(context, 'حصّلت ${omr(o.deliveryFee)}؟',
          message: 'رسوم التوصيل من الزبون.', ok: 'إي حصّلتها',
          destructive: false);
      if (!ok) return;
    }
    setState(() => _busy = true);
    try {
      final bytes = await file.readAsBytes();
      await DriverData.i.setStatus(o, DriverStatus.delivered, photoBytes: bytes);
      if (mounted) {
        toast(context, 'تم التسليم ✓');
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _busy = false);
        toast(context, errorText(e), error: true);
      }
    }
  }

  void _openMaps(String address) {
    final link = RegExp(r'https?://\S+').firstMatch(address)?.group(0);
    final uri = link != null
        ? Uri.parse(link)
        : Uri.parse(
            'https://maps.apple.com/?q=${Uri.encodeComponent(address)}');
    launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: DriverData.i,
      builder: (context, _) {
        DriverOrder? o;
        for (final x in DriverData.i.orders) {
          if (x.id == widget.orderId) o = x;
        }
        if (o == null) {
          return const GHPage(title: 'الطلب', children: [
            EmptyState(icon: CupertinoIcons.cube_box, title: 'الطلب مب موجود'),
          ]);
        }
        final order = o;
        final phone = waPhone(order.customerPhone);

        Widget? bottom;
        if (!order.isDone) {
          bottom = order.status == DriverStatus.picked
              ? PrimaryButton('تم التسليم',
                  icon: CupertinoIcons.camera_fill,
                  busy: _busy,
                  onPressed: () => _delivered(order))
              : PrimaryButton('استلمت الطلب، طالع أوصله',
                  icon: CupertinoIcons.car_detailed,
                  busy: _busy,
                  onPressed: () => _picked(order));
        }

        return GHPage(
          title: order.customerName,
          previousPageTitle: 'توصيلاتي',
          bottom: bottom,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 0),
              child: Row(children: [
                Text(order.invoiceNo, style: T.sub),
                const Spacer(),
                if (order.status != null)
                  Badge(order.status!.label, color: order.status!.color),
              ]),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  gradient: order.collect && order.deliveryFee > 0
                      ? const LinearGradient(
                          colors: [Color(0xFFF08C00), Color(0xFFD9480F)])
                      : const LinearGradient(
                          colors: [Color(0xFF1FA35B), Color(0xFF13795B)]),
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Row(children: [
                  Icon(
                      order.collect && order.deliveryFee > 0
                          ? CupertinoIcons.money_dollar_circle_fill
                          : CupertinoIcons.checkmark_seal_fill,
                      color: CupertinoColors.white,
                      size: 30),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      order.collect && order.deliveryFee > 0
                          ? 'حصّل رسوم التوصيل ${omr(order.deliveryFee)} عند التسليم'
                          : 'التوصيل مدفوع، لا تحصّل شي',
                      style: const TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w700,
                          color: CupertinoColors.white),
                    ),
                  ),
                ]),
              ),
            ),
            Section(children: [
              if (phone != null)
                Tile(
                  leading: const IconBox(CupertinoIcons.phone_fill,
                      color: GH.green),
                  title: 'اتصال',
                  value: order.customerPhone,
                  onTap: () => launchUrl(Uri.parse('tel:+$phone')),
                ),
              if (phone != null)
                Tile(
                  leading: const IconBox(CupertinoIcons.chat_bubble_fill,
                      color: Color(0xFF25D366)),
                  title: 'واتساب',
                  onTap: () => launchUrl(Uri.parse('https://wa.me/$phone'),
                      mode: LaunchMode.externalApplication),
                ),
              Tile(
                leading:
                    const IconBox(CupertinoIcons.location_solid, color: GH.blue),
                title: order.address ?? order.customerCity ?? 'ما في عنوان',
                subtitle: order.address != null ? order.customerCity : null,
                onTap: order.address == null && order.customerCity == null
                    ? null
                    : () => _openMaps(order.address ?? order.customerCity!),
              ),
            ]),
            if (order.note != null)
              Section(header: 'ملاحظة', children: [
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(order.note!, style: T.body),
                ),
              ]),
            Section(
              header: 'القطع · ${order.items.length}',
              children: order.items
                  .map((i) => Tile(
                        leading: const IconBox(CupertinoIcons.bag_fill,
                            color: GH.gold),
                        title: i.brand == null ? i.name : '${i.brand} · ${i.name}',
                        subtitle: i.details,
                        chevron: false,
                      ))
                  .toList(),
            ),
            if (order.photoPath != null)
              Section(header: 'صورة التسليم', children: [
                Tile(
                  leading: Thumb(order.photoPath!, size: 52),
                  title: 'تم التسليم',
                  subtitle: dateStr(order.deliveredAt),
                  onTap: () => pushPage(
                      context,
                      PhotoPage(
                          path: order.photoPath!, title: 'صورة التسليم')),
                ),
              ]),
          ],
        );
      },
    );
  }
}
