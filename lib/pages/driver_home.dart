import 'dart:typed_data';

import 'package:flutter/cupertino.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';

import '../data/api.dart';
import 'scanner_page.dart';
import 'driver_money.dart';
import '../format.dart';
import '../models.dart';
import '../ui/colors.dart';
import '../ui/kit.dart';

/// Loads the signed-in driver's orders (only theirs, without prices).
class DriverData extends ChangeNotifier {
  DriverData._();
  static final DriverData i = DriverData._();

  List<DriverOrder> orders = [];
  DriverAccount? account;
  bool ready = false;
  Object? error;

  Future<void> refresh() async {
    // money and past deliveries (newer server); the list works without it
    Api.i.get('/ps/driver/account').then((res) {
      account = DriverAccount(Map<String, dynamic>.from(res as Map));
      notifyListeners();
    }).catchError((_) {});
    try {
      final res = await Api.i.get('/ps/driver/orders');
      final list = ((res as Map)['orders'] as List?) ?? const [];
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
    if (photoBytes != null) {
      await Api.i.upload('/ps/driver/orders/${o.id}', 'photo',
          Uint8List.fromList(photoBytes),
          fields: {'status': s.name});
    } else {
      await Api.i.post('/ps/driver/orders/${o.id}', {'status': s.name});
    }
    await refresh();
  }

  void clear() {
    orders = [];
    account = null;
    ready = false;
  }
}

// ───────────────────────── Home ─────────────────────────

class DriverHome extends StatefulWidget {
  const DriverHome({super.key, required this.name, this.initialTab = 0});

  final String name;
  final int initialTab;

  @override
  State<DriverHome> createState() => _DriverHomeState();
}

class _DriverHomeState extends State<DriverHome> {
  late int _tab = widget.initialTab; // 0 now · 1 previous · 2 my money

  @override
  void initState() {
    super.initState();
    if (!DriverData.i.ready) DriverData.i.refresh();
  }

  /// Pick-up: scanning the label hands the parcel to this driver.
  Future<void> _scan() async {
    final code = await scanCode(context);
    if (code == null || !mounted) return;
    try {
      final res = await Api.i.post('/ps/driver/scan', {'code': code});
      await DriverData.i.refresh();
      if (!mounted) return;
      final id = (res as Map)['id'] as String;
      toast(context, res['status'] == 'delivered' ? 'الطلب متسلّم من قبل' : 'استلمت الطلب ✓');
      pushPage(context, DriverOrderPage(orderId: id));
    } catch (e) {
      if (mounted) toast(context, errorText(e), error: true);
    }
  }

  String _greeting() {
    final h = DateTime.now().hour;
    if (h < 12) return 'صباح الخير';
    if (h < 18) return 'مساء الخير';
    return 'مساء النور';
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: DriverData.i,
      builder: (context, _) {
        final data = DriverData.i;
        final acc = data.account;
        final open = data.orders.where((o) => !o.isDone).toList();
        final done = data.orders.where((o) => o.isDone).toList();
        final collect = open.fold<double>(0, (s, o) => s + o.toCollect);

        final children = <Widget>[
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 2),
            child: Row(children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text('${_greeting()} ${widget.name}', style: T.title.copyWith(fontSize: 18)),
                  Text(dateStr(DateTime.now()), style: T.sub),
                ]),
              ),
              Image.asset('assets/images/story_logo.png', height: 44),
            ]),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: Row(children: [
              Expanded(
                  child: StatCard(
                      label: 'للتوصيل الحين',
                      value: '${open.length}',
                      hero: true,
                      icon: CupertinoIcons.car_detailed)),
              const SizedBox(width: 10),
              Expanded(
                  child: StatCard(
                      label: 'تحصّل اليوم',
                      value: omr(collect),
                      color: GH.amber,
                      icon: CupertinoIcons.money_dollar_circle_fill)),
            ]),
          ),
          if (acc != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
              child: GestureDetector(
                onTap: () => setState(() => _tab = 2),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(color: GH.card, borderRadius: BorderRadius.circular(16), boxShadow: GH.shadow),
                  child: Row(children: [
                    IconBox(acc.net >= 0 ? CupertinoIcons.arrow_up_circle_fill : CupertinoIcons.arrow_down_circle_fill,
                        color: acc.net >= 0 ? GH.amber : GH.green),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        acc.net.abs() < 0.0005
                            ? 'حسابك معنا صافي ✓'
                            : acc.net > 0
                                ? 'عندك لنا ${omr(acc.net)}'
                                : 'لك عندنا ${omr(-acc.net)}',
                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: GH.label),
                      ),
                    ),
                    const Text('حسابي', style: TextStyle(fontSize: 14, color: GH.burgundy)),
                    const Icon(CupertinoIcons.forward, size: 16, color: GH.tertiary),
                  ]),
                ),
              ),
            ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
            child: CupertinoSlidingSegmentedControl<int>(
              groupValue: _tab,
              children: {
                0: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 6),
                    child: Text('الحالية (${open.length})')),
                1: const Text('السابقة'),
                2: const Text('حسابي'),
              },
              onValueChanged: (v) => setState(() => _tab = v ?? 0),
            ),
          ),
        ];

        if (!data.ready) {
          children.add(const Loading());
        } else if (data.error != null && data.orders.isEmpty && _tab == 0) {
          children.add(EmptyState(
            icon: CupertinoIcons.wifi_exclamationmark,
            title: 'ما قدرنا نحمّل الطلبات',
            message: errorText(data.error!),
          ));
        } else if (_tab == 0) {
          if (open.isEmpty) {
            children.add(const EmptyState(
              icon: CupertinoIcons.cube_box,
              title: 'ما عندك توصيلات الحين',
              message: 'امسح بوليصة الطلب عشان تستلمه، أو اسحب لتحت عشان تحدّث.',
            ));
          } else {
            children.addAll(open.map((o) => _DeliveryCard(o)));
          }
        } else if (_tab == 1) {
          final past = acc?.recent ?? const <PastDelivery>[];
          if (acc == null && done.isNotEmpty) {
            // older server: the deliveries of the last 30 days
            children.add(Section(
              header: 'المسلّمة · ${done.length}',
              children: done
                  .map((o) => Tile(
                        leading: Avatar(o.customerName, size: 34),
                        title: o.customerName,
                        subtitle: [dateStr(o.deliveredAt), o.customerCity ?? o.invoiceNo].join(' · '),
                        onTap: () => pushPage(context, DriverOrderPage(orderId: o.id)),
                      ))
                  .toList(),
            ));
          } else if (past.isEmpty) {
            children.add(const EmptyState(icon: CupertinoIcons.checkmark_seal, title: 'ما سلّمت شي للحين'));
          } else {
            children.add(Section(
              header: 'سلّمتها · ${acc!.deliveries}',
              children: past
                  .map((d) => PastDeliveryTile(d,
                      onTap: data.orders.any((o) => o.id == d.id)
                          ? () => pushPage(context, DriverOrderPage(orderId: d.id))
                          : null))
                  .toList(),
            ));
          }
        } else {
          if (acc == null) {
            children.add(const EmptyState(icon: CupertinoIcons.money_dollar_circle, title: 'الحساب يتحمّل…'));
          } else {
            children.add(DriverBalanceCard(acc));
            children.add(Section(header: 'هالشهر', children: [
              KV('توصيلاتك', '${acc.monthDeliveries}'),
              KV('أجرتك', omr(acc.monthEarned)),
              if (acc.rate > 0) KV('لكل توصيلة', omr(acc.rate)),
            ]));
            children.add(Section(header: 'من البداية', children: [
              KV('حصّلت من العملاء', omr(acc.collected)),
              KV('سلّمت لنا', omr(acc.handed)),
              KV('أجرتك كلها', omr(acc.earned)),
              KV('حوّلنا لك', omr(acc.paid)),
            ]));
            if (acc.entries.isNotEmpty) {
              children.add(Section(
                header: 'التسليم والتحويلات',
                children: acc.entries.map((e) => DriverEntryTile(e)).toList(),
              ));
            }
          }
        }

        return GHPage(
          title: 'توصيلاتي',
          onRefresh: data.refresh,
          bottom: PrimaryButton('امسح بوليصة واستلم الطلب',
              icon: CupertinoIcons.qrcode_viewfinder, onPressed: _scan),
          trailing: NavButton('خروج', onPressed: () async {
            if (await confirm(context, 'تسجيل خروج؟',
                ok: 'خروج', destructive: true)) {
              DriverData.i.clear();
              await Api.i.logout();
            }
          }),
          children: children,
        );
      },
    );
  }
}

/// One delivery waiting: customer, where, what to collect, step.
class _DeliveryCard extends StatelessWidget {
  const _DeliveryCard(this.o);
  final DriverOrder o;

  @override
  Widget build(BuildContext context) {
    final picked = o.status == DriverStatus.picked;
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      child: GestureDetector(
        onTap: () => pushPage(context, DriverOrderPage(orderId: o.id)),
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: GH.card, borderRadius: BorderRadius.circular(18), boxShadow: GH.shadow),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Avatar(o.customerName, size: 40),
              const SizedBox(width: 10),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(o.customerName, style: T.title),
                  Text([o.customerCity ?? '', '${o.items.length} قطعة', o.waybillNo ?? o.invoiceNo]
                      .where((e) => e.isNotEmpty)
                      .join(' · '),
                      style: T.sub),
                ]),
              ),
              Badge(picked ? 'معك' : 'جديد', color: picked ? GH.amber : GH.blue),
            ]),
            if (o.address != null) ...[
              const SizedBox(height: 10),
              Row(children: [
                const Icon(CupertinoIcons.location_solid, size: 15, color: GH.secondary),
                const SizedBox(width: 6),
                Expanded(
                    child: Text(o.address!.replaceAll(RegExp(r'https?://\S+'), '').trim(),
                        maxLines: 2, overflow: TextOverflow.ellipsis, style: T.sub)),
              ]),
            ],
            const SizedBox(height: 10),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: (o.toCollect > 0 ? GH.amber : GH.green).withAlpha(24),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(children: [
                Icon(o.toCollect > 0 ? CupertinoIcons.money_dollar_circle_fill : CupertinoIcons.checkmark_seal_fill,
                    size: 18, color: o.toCollect > 0 ? GH.amber : GH.green),
                const SizedBox(width: 8),
                Text(o.toCollect > 0 ? 'حصّل ${omr(o.toCollect)}' : 'مدفوع، لا تحصّل شي',
                    style: TextStyle(
                        fontSize: 14, fontWeight: FontWeight.w600, color: o.toCollect > 0 ? const Color(0xFFB36200) : GH.green)),
              ]),
            ),
          ]),
        ),
      ),
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
    if (o.toCollect > 0 && mounted) {
      final ok = await confirm(context, 'حصّلت ${omr(o.toCollect)}؟',
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

  /// Ready-made WhatsApp messages from the driver to the customer.
  Future<void> _sendTemplate(DriverOrder o, String phone) async {
    final m = o.customerIsMale;
    String g(String f, String male) => m ? male : f;
    final first = o.customerName.trim().split(' ').first;
    final me = Api.i.session?.name ?? 'المندوب';
    final collect = o.toCollect > 0;
    final pay = collect
        ? '\nالمبلغ ${omr(o.toCollect)} يندفع عند الاستلام.'
        : '';
    final templates = <String, String>{
      'أنا في الطريق 🚗':
          'هلا $first 👋\nمعك $me مندوب GH Shopper.\n${g('طلبكِ', 'طلبك')} في الطريق ${g('إليكِ', 'إليك')}، بوصل خلال حوالي ٢٠ دقيقة إن شاء الله.$pay',
      'وصلت عند الموقع 📍':
          'هلا $first، وصلت عند موقع${g('كِ', 'ك')} 📍\nأنا تحت مع ${g('طلبكِ', 'طلبك')} من GH Shopper.$pay',
      'ما رد على الاتصال 📞':
          'هلا $first، حاولت أتصل ${g('فيكِ', 'فيك')} بخصوص توصيل ${g('طلبكِ', 'طلبك')} من GH Shopper.\nمتى يناسب${g('كِ', 'ك')} أوصله؟',
      'أبي الموقع على الخريطة 🗺️':
          'هلا $first، معك $me مندوب GH Shopper.\nممكن ${g('ترسلين', 'ترسل')} لي موقع${g('كِ', 'ك')} على الخريطة عشان أوصل ${g('طلبكِ', 'طلبك')}؟',
      'نأجل التوصيل ⏰':
          'هلا $first، معك $me من GH Shopper.\nبنأجل توصيل ${g('طلبكِ', 'طلبك')} لوقت ثاني، ${g('تبين', 'تبي')} اليوم ولا بكرة؟',
      'تم التسليم ✨':
          'شكراً $first 🤍\nتم تسليم ${g('طلبكِ', 'طلبك')} من GH Shopper، إن شاء الله ${g('يعجبكِ', 'يعجبك')}.',
    };
    final pick = await actionSheet<String>(context,
        title: 'رسالة للعميل',
        message: 'تنفتح في واتساب، وتقدر تعدّلها قبل الإرسال',
        actions: templates.keys.map((k) => SheetAction(k, k)).toList());
    if (pick == null) return;
    await launchUrl(
        Uri.parse(
            'https://wa.me/$phone?text=${Uri.encodeComponent(templates[pick]!)}'),
        mode: LaunchMode.externalApplication);
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
                Text(order.waybillNo ?? order.invoiceNo, style: T.sub),
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
                  gradient: order.toCollect > 0
                      ? const LinearGradient(
                          colors: [Color(0xFFF08C00), Color(0xFFD9480F)])
                      : const LinearGradient(
                          colors: [Color(0xFF1FA35B), Color(0xFF13795B)]),
                  borderRadius: BorderRadius.circular(18),
                ),
                child: Row(children: [
                  Icon(
                      order.toCollect > 0
                          ? CupertinoIcons.money_dollar_circle_fill
                          : CupertinoIcons.checkmark_seal_fill,
                      color: CupertinoColors.white,
                      size: 30),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      order.toCollect > 0
                          ? 'حصّل ${omr(order.toCollect)} عند التسليم${order.isCod ? ' (قيمة الطلب)' : ''}'
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
                  leading: const IconBox(CupertinoIcons.chat_bubble_text_fill,
                      color: Color(0xFF25D366)),
                  title: 'رسائل جاهزة للعميل',
                  subtitle: 'في الطريق، وصلت، ما رديت…',
                  onTap: () => _sendTemplate(order, phone),
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
            if (order.photoUrl != null)
              Section(header: 'صورة التسليم', children: [
                Padding(
                  padding: const EdgeInsets.all(12),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Image.network(order.photoUrl!, fit: BoxFit.cover),
                  ),
                ),
                Tile(
                  title: 'تم التسليم',
                  value: dateStr(order.deliveredAt),
                  chevron: false,
                ),
              ]),
          ],
        );
      },
    );
  }
}
