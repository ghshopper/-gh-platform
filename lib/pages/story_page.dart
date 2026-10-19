import 'dart:async';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/cupertino.dart';
import 'package:flutter/rendering.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../config.dart';
import '../data/api.dart';
import '../story/cutout.dart';
import '../story/story_canvas.dart';
import '../ui/colors.dart';
import '../ui/kit.dart';

/// A store product, as the story needs it.
class StoryProduct {
  StoryProduct({
    required this.id,
    required this.name,
    required this.brand,
    required this.price,
    this.was,
    this.image,
  });

  final int id;
  final String name;
  final String brand;
  final double price;
  final double? was;
  final String? image;

  static double _n(dynamic v) => double.tryParse('${v ?? ''}') ?? 0;

  /// Same rule as the website: a discount counts while it is lower than the
  /// price and not expired.
  factory StoryProduct.fromJson(Map<String, dynamic> j) {
    final price = _n(j['price']);
    final compare = _n(j['compare_price']);
    final until = DateTime.tryParse('${j['discount_expires_at'] ?? ''}');
    final onSale = compare > 0 && compare < price && (until == null || until.isAfter(DateTime.now()));
    final img = (j['primary_image'] ?? j['image'] ?? '').toString();
    return StoryProduct(
      id: int.tryParse('${j['id']}') ?? 0,
      name: ((j['name_ar'] ?? '').toString().trim().isNotEmpty ? j['name_ar'] : j['name_en'] ?? '').toString(),
      brand: (j['brand_name_en'] ?? j['brand_name'] ?? j['brand_name_ar'] ?? '').toString(),
      price: onSale ? compare : price,
      was: onSale ? price : null,
      image: img.isEmpty ? null : storyImageUrl(img),
    );
  }

  StoryData toData() => StoryData(
        brand: brand,
        name: name,
        price: price,
        was: was,
        image: image == null ? null : NetworkImage(image!),
      );
}

String storyImageUrl(String path) {
  if (path.startsWith('http')) return path;
  final site = AppConfig.apiBaseUrl.replaceFirst(RegExp(r'/api/?$'), '');
  return '$site${path.startsWith('/') ? '' : '/'}$path';
}

// ───────────────────────── Pick products ─────────────────────────

/// Step 1: choose one or more store products.
class StoryPickPage extends StatefulWidget {
  const StoryPickPage({super.key});

  @override
  State<StoryPickPage> createState() => _StoryPickPageState();
}

class _StoryPickPageState extends State<StoryPickPage> {
  final _search = TextEditingController();
  List<StoryProduct> _items = [];
  final Map<int, StoryProduct> _chosen = {};
  bool _loading = true;
  bool _more = false;
  int _page = 1;
  int _total = 0;
  String? _error;
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  /// Every product in the store (search by name or brand), 60 at a time.
  Future<void> _load({bool next = false}) async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final q = Uri.encodeQueryComponent(_search.text.trim());
      final page = next ? _page + 1 : 1;
      final res = await Api.i.get('/admin/products?per_page=60&page=$page${q.isEmpty ? '' : '&search=$q'}');
      final rows = res is Map ? (res['data'] ?? []) : res;
      final list = (rows as List).whereType<Map>().map((e) => StoryProduct.fromJson(Map<String, dynamic>.from(e))).toList();
      if (mounted) {
        setState(() {
          _items = next ? [..._items, ...list] : list;
          _page = page;
          _total = res is Map ? int.tryParse('${res['total'] ?? ''}') ?? _items.length : _items.length;
          _more = res is Map && (int.tryParse('${res['last_page'] ?? 1}') ?? 1) > page;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _onSearch(String _) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 450), _load);
  }

  @override
  Widget build(BuildContext context) {
    final n = _chosen.length;
    return GHPage(
      title: 'ستوري المنتجات',
      previousPageTitle: 'المزيد',
      bottom: PrimaryButton(
        n == 0 ? 'اختر منتج أو أكثر' : 'التالي · $n ${n == 1 ? 'منتج' : 'منتجات'}',
        icon: CupertinoIcons.sparkles,
        onPressed: n == 0
            ? null
            : () => pushPage(context, StoryComposePage(products: _chosen.values.toList())),
      ),
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
          child: CupertinoSearchTextField(
            controller: _search,
            placeholder: 'ابحث باسم المنتج أو البراند',
            onChanged: _onSearch,
            backgroundColor: GH.card,
          ),
        ),
        if (_loading && _items.isEmpty)
          const Loading()
        else if (_error != null)
          EmptyState(
            icon: CupertinoIcons.wifi_exclamationmark,
            title: 'ما قدرنا نجيب المنتجات',
            message: _error,
            action: SecondaryButton('حاول مرة ثانية', onPressed: _load),
          )
        else if (_items.isEmpty)
          const EmptyState(icon: CupertinoIcons.search, title: 'ما في منتجات بهذا الاسم')
        else
          Section(
            header: 'اختر المنتجات · $_total',
            footer: _more ? null : (_items.length > 8 ? 'هذي كل المنتجات' : null),
            children: _items.map((p) {
              final on = _chosen.containsKey(p.id);
              return Tile(
                leading: _ProductThumb(p.image),
                title: p.name,
                subtitle: [
                  if (p.brand.isNotEmpty) p.brand,
                  '${storyPrice(p.price)} ر.ع',
                  if (p.was != null) 'عليه خصم',
                ].join(' · '),
                chevron: false,
                trailing: Icon(
                  on ? CupertinoIcons.checkmark_circle_fill : CupertinoIcons.circle,
                  color: on ? GH.burgundy : GH.tertiary,
                  size: 26,
                ),
                onTap: () => setState(() => on ? _chosen.remove(p.id) : _chosen[p.id] = p),
              );
            }).toList(),
          ),
        if (_more)
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
            child: SecondaryButton(_loading ? 'يحمّل…' : 'عرض المزيد', onPressed: _loading ? null : () => _load(next: true)),
          ),
      ],
    );
  }
}

class _ProductThumb extends StatelessWidget {
  const _ProductThumb(this.url);
  final String? url;

  @override
  Widget build(BuildContext context) => ClipRRect(
        borderRadius: BorderRadius.circular(10),
        child: Container(
          width: 52,
          height: 52,
          color: const Color(0xFFF6F1EA),
          child: url == null
              ? const Icon(CupertinoIcons.photo, color: GH.tertiary)
              : Image.network(url!,
                  fit: BoxFit.contain,
                  errorBuilder: (_, __, ___) => const Icon(CupertinoIcons.photo, color: GH.tertiary)),
        ),
      );
}

// ───────────────────────── Design & share ─────────────────────────

/// Step 2: choose the design, check each story, then save / share them.
class StoryComposePage extends StatefulWidget {
  const StoryComposePage({super.key, required this.products, this.dataOverride});

  final List<StoryProduct> products;

  /// For screenshots: ready data (with local photos).
  final List<StoryData>? dataOverride;

  @override
  State<StoryComposePage> createState() => _StoryComposePageState();
}

class _StoryComposePageState extends State<StoryComposePage> {
  late final List<StoryData> _data =
      widget.dataOverride ?? widget.products.map((p) => p.toData()).toList();
  late final List<GlobalKey> _keys = List.generate(_data.length, (_) => GlobalKey());
  final _pages = PageController(viewportFraction: .78);
  StoryTemplate _template = StoryTemplate.classic;
  bool _cta = true;
  int _page = 0;
  bool _busy = false;

  /// Photos with the background taken out (ready one by one).
  late final List<Future<void>> _cutouts = [
    for (var i = 0; i < _data.length; i++) _cut(i),
  ];
  int _cutting = 0;
  int _cutFailed = 0;
  bool _names = true;

  Future<void> _cut(int i) async {
    final url = widget.dataOverride == null && i < widget.products.length ? widget.products[i].image : null;
    if (url == null) return;
    setState(() => _cutting++);
    try {
      final img = await cutoutImage(url);
      if (img != null && mounted) setState(() => _data[i].image = img);
      if (img == null && mounted) setState(() => _cutFailed++);
    } finally {
      if (mounted) setState(() => _cutting--);
    }
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _cutouts.length);
  }

  @override
  void dispose() {
    _pages.dispose();
    super.dispose();
  }

  Future<void> _edit(StoryData d) async {
    final brand = TextEditingController(text: d.brand);
    final name = TextEditingController(text: d.name);
    final price = TextEditingController(text: storyPrice(d.price));
    final was = TextEditingController(text: d.was == null ? '' : storyPrice(d.was!));
    final ok = await presentForm<bool>(
      context,
      _EditStoryText(brand: brand, name: name, price: price, was: was),
    );
    if (ok == true) {
      double? p(String s) => double.tryParse(s.trim().replaceAll(',', '.').replaceAllMapped(
          RegExp('[٠-٩]'), (m) => '${m[0]!.codeUnitAt(0) - 0x0660}'));
      setState(() {
        d.brand = brand.text.trim();
        d.name = name.text.trim();
        d.price = p(price.text) ?? d.price;
        d.was = was.text.trim().isEmpty ? null : p(was.text);
      });
    }
  }

  Future<File> _capture(int i) async {
    await _cutouts[i];
    await Future<void>.delayed(const Duration(milliseconds: 120));
    final ctx = _keys[i].currentContext;
    if (ctx == null) throw Exception('الصورة مب جاهزة');
    final img = _data[i].image;
    if (img != null) {
      try {
        await precacheImage(img, ctx);
      } catch (_) {}
    }
    await Future<void>.delayed(const Duration(milliseconds: 250));
    if (!ctx.mounted) throw Exception('الصورة مب جاهزة');
    final boundary = ctx.findRenderObject() as RenderRepaintBoundary;
    final ratio = StoryCanvas.width / boundary.size.width;
    final ui.Image image = await boundary.toImage(pixelRatio: ratio);
    final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
    final dir = await getTemporaryDirectory();
    final f = File('${dir.path}/gh-story-${DateTime.now().millisecondsSinceEpoch}-${i + 1}.png');
    await f.writeAsBytes(bytes!.buffer.asUint8List(), flush: true);
    return f;
  }

  Future<void> _share({required bool all}) async {
    setState(() => _busy = true);
    final box = context.findRenderObject() as RenderBox?;
    try {
      final files = <XFile>[];
      final which = all ? List.generate(_data.length, (i) => i) : [_page];
      for (final i in which) {
        if (_pages.hasClients && _page != i) {
          _pages.jumpToPage(i);
          await Future<void>.delayed(const Duration(milliseconds: 350));
        }
        files.add(XFile((await _capture(i)).path, mimeType: 'image/png'));
      }
      await Share.shareXFiles(
        files,
        sharePositionOrigin: box == null ? null : box.localToGlobal(Offset.zero) & box.size,
      );
    } catch (e) {
      if (mounted) toast(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final many = _data.length > 1;
    return CupertinoPageScaffold(
      backgroundColor: GH.bg,
      navigationBar: CupertinoNavigationBar(
        middle: const Text('تصميم الستوري'),
        previousPageTitle: 'المنتجات',
        backgroundColor: GH.bg.withAlpha(240),
        border: null,
        trailing: NavButton('تعديل الكلام', onPressed: () => _edit(_data[_page])),
      ),
      child: SafeArea(
        child: Column(
          children: [
            const SizedBox(height: 8),
            // The stories (swipe between products).
            Expanded(
              child: PageView.builder(
                controller: _pages,
                itemCount: _data.length,
                onPageChanged: (i) => setState(() => _page = i),
                itemBuilder: (_, i) => Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                  child: Center(
                    child: AspectRatio(
                      aspectRatio: 9 / 16,
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(18),
                          boxShadow: const [BoxShadow(color: Color(0x26000000), blurRadius: 24, offset: Offset(0, 10))],
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(18),
                          child: FittedBox(
                            child: RepaintBoundary(
                              key: _keys[i],
                              child: StoryCanvas(data: _data[i], template: _template, showCta: _cta),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                  [
                    if (_cutting > 0) 'يشيل خلفية الصور…',
                    if (_cutting == 0 && _cutFailed > 0) 'ما قدرت أجيب الصورة الأصلية لشيل الخلفية ($_cutFailed)',
                    if (many) '${_page + 1} من ${_data.length} · اسحب للمنتج الثاني',
                  ].join(' · '),
                  style: T.small),
            ),
            // Designs.
            SizedBox(
              height: 128,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                children: StoryTemplate.values.map((t) {
                  final on = t == _template;
                  return GestureDetector(
                    onTap: () => setState(() => _template = t),
                    child: Padding(
                      padding: const EdgeInsetsDirectional.only(end: 10),
                      child: Column(children: [
                        AnimatedContainer(
                          duration: const Duration(milliseconds: 150),
                          width: 50,
                          height: 89,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: on ? GH.burgundy : GH.separator, width: on ? 2.5 : 1),
                          ),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(6),
                            child: FittedBox(
                              child: StoryCanvas(data: _data[_page], template: t, showCta: _cta),
                            ),
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(t.label,
                            style: TextStyle(
                                fontSize: 11.5,
                                fontWeight: on ? FontWeight.w600 : FontWeight.w400,
                                color: on ? GH.burgundy : GH.secondary)),
                      ]),
                    ),
                  );
                }).toList(),
              ),
            ),
            // Photo size and position for this story.
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 6, 12, 0),
              child: Row(children: [
                const Icon(CupertinoIcons.zoom_in, size: 20, color: GH.secondary),
                const SizedBox(width: 6),
                const SizedBox(width: 44, child: Text('الحجم', style: TextStyle(fontSize: 14, color: GH.label))),
                Expanded(
                  child: CupertinoSlider(
                    value: _data[_page].zoom,
                    min: 0.6,
                    max: 1.8,
                    activeColor: GH.burgundy,
                    onChanged: (v) => setState(() => _data[_page].zoom = v),
                  ),
                ),
              ]),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 12, 0),
              child: Row(children: [
                const Icon(CupertinoIcons.arrow_up_arrow_down, size: 18, color: GH.secondary),
                const SizedBox(width: 8),
                const SizedBox(width: 42, child: Text('المكان', style: TextStyle(fontSize: 14, color: GH.label))),
                Expanded(
                  child: CupertinoSlider(
                    value: _data[_page].shiftY,
                    min: -300,
                    max: 300,
                    activeColor: GH.burgundy,
                    onChanged: (v) => setState(() => _data[_page].shiftY = v.abs() < 12 ? 0 : v),
                  ),
                ),
                CupertinoButton(
                  padding: const EdgeInsets.symmetric(horizontal: 6),
                  minSize: 30,
                  onPressed: () => setState(() {
                    _data[_page].zoom = 1;
                    _data[_page].shiftY = 0;
                  }),
                  child: const Icon(CupertinoIcons.arrow_counterclockwise, size: 20, color: GH.burgundy),
                ),
              ]),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 16, 0),
              child: Row(children: [
                const Expanded(child: Text('اسم المنتج', style: TextStyle(fontSize: 15, color: GH.label))),
                CupertinoSwitch(
                    value: _names,
                    activeTrackColor: GH.burgundy,
                    onChanged: (v) => setState(() {
                          _names = v;
                          for (final d in _data) {
                            d.showName = v;
                          }
                        })),
              ]),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 16, 0),
              child: Row(children: [
                const Expanded(child: Text('جملة «اطلب من التطبيق»', style: TextStyle(fontSize: 15, color: GH.label))),
                CupertinoSwitch(value: _cta, activeTrackColor: GH.burgundy, onChanged: (v) => setState(() => _cta = v)),
              ]),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
              child: Row(children: [
                Expanded(
                  child: PrimaryButton(many ? 'حفظ الكل' : 'حفظ / مشاركة',
                      icon: CupertinoIcons.square_arrow_down, busy: _busy, onPressed: () => _share(all: true)),
                ),
                if (many) ...[
                  const SizedBox(width: 10),
                  Expanded(
                    child: SecondaryButton('هذي بس', icon: CupertinoIcons.photo, onPressed: _busy ? null : () => _share(all: false)),
                  ),
                ],
              ]),
            ),
          ],
        ),
      ),
    );
  }
}

class _EditStoryText extends StatelessWidget {
  const _EditStoryText({required this.brand, required this.name, required this.price, required this.was});

  final TextEditingController brand;
  final TextEditingController name;
  final TextEditingController price;
  final TextEditingController was;

  @override
  Widget build(BuildContext context) {
    return GHPage(
      title: 'تعديل الكلام',
      leading: NavButton('إلغاء', onPressed: () => Navigator.pop(context, false)),
      trailing: NavButton('تم', bold: true, onPressed: () => Navigator.pop(context, true)),
      children: [
        Section(
          footer: 'التعديل للستوري بس، ما يغيّر المنتج في المتجر.',
          children: [
            FieldRow(label: 'البراند', controller: brand, ltr: true),
            FieldRow(label: 'الاسم', controller: name),
            AmountRow(label: 'السعر', controller: price),
            AmountRow(label: 'قبل الخصم', controller: was),
          ],
        ),
      ],
    );
  }
}
