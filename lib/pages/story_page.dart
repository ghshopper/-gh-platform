import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/cupertino.dart';
import 'package:flutter/rendering.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../config.dart';
import '../story/cutout.dart';
import '../story/story_canvas.dart';
import '../ui/colors.dart';
import '../ui/kit.dart';
import 'products_page.dart';

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
  final Map<int, StoryProduct> _chosen = {};

  @override
  Widget build(BuildContext context) {
    final n = _chosen.length;
    return GHPage(
      title: 'ستوري المنتجات',
      previousPageTitle: 'رجوع',
      bottom: PrimaryButton(
        n == 0 ? 'اختر منتج أو أكثر' : 'التالي · $n ${n == 1 ? 'منتج' : 'منتجات'}',
        icon: CupertinoIcons.sparkles,
        onPressed: n == 0
            ? null
            : () => pushPage(context, StoryComposePage(products: _chosen.values.toList())),
      ),
      children: [
        ProductBrowser(
          isSelected: (p) => _chosen.containsKey(p.id),
          onTap: (p) => setState(() => _chosen.containsKey(p.id) ? _chosen.remove(p.id) : _chosen[p.id] = p.toStory()),
        ),
      ],
    );
  }
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
  List<Future<void>> _cutouts = [];
  int _cutting = 0;
  int _cutFailed = 0;
  bool _names = true;
  bool _shadow = true; // take the soft shadow out too
  bool _move = false; // drag / pinch the photo instead of swiping
  double _baseZoom = 1;
  Offset _baseShift = Offset.zero;
  Offset _startFocal = Offset.zero;

  void _cutAll() {
    _cutFailed = 0;
    _cutouts = [for (var i = 0; i < _data.length; i++) _cut(i)];
  }

  Future<void> _cut(int i) async {
    final url = widget.dataOverride == null && i < widget.products.length ? widget.products[i].image : null;
    if (url == null) return;
    setState(() => _cutting++);
    try {
      final img = await cutoutImage(url, removeShadow: _shadow);
      if (img != null && mounted) setState(() => _data[i].image = img);
      if (img == null && mounted) setState(() => _cutFailed++);
    } finally {
      if (mounted) setState(() => _cutting--);
    }
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _cutAll());
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
    if (i < _cutouts.length) await _cutouts[i];
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
                physics: _move ? const NeverScrollableScrollPhysics() : null,
                itemCount: _data.length,
                onPageChanged: (i) => setState(() => _page = i),
                itemBuilder: (_, i) => Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                  child: Center(
                    child: AspectRatio(
                      aspectRatio: 9 / 16,
                      child: LayoutBuilder(builder: (context, box) => GestureDetector(
                        onScaleStart: !_move || i != _page
                            ? null
                            : (d) {
                                _baseZoom = _data[i].zoom;
                                _baseShift = Offset(_data[i].shiftX, _data[i].shiftY);
                                _startFocal = d.focalPoint;
                              },
                        onScaleUpdate: !_move || i != _page
                            ? null
                            : (d) {
                                final k = StoryCanvas.width / box.maxWidth;
                                final o = _baseShift + (d.focalPoint - _startFocal) * k;
                                setState(() {
                                  _data[i].zoom = (_baseZoom * d.scale).clamp(0.4, 2.6);
                                  _data[i].shiftX = o.dx.clamp(-700.0, 700.0);
                                  _data[i].shiftY = o.dy.clamp(-1100.0, 1100.0);
                                });
                              },
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
                      )),
                    ),
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                  [
                    if (_move) 'اسحب الصورة لتحريكها، وكبّرها بإصبعين',
                    if (_cutting > 0) 'يشيل خلفية الصور…',
                    if (_cutting == 0 && _cutFailed > 0) 'ما قدرت أجيب الصورة الأصلية لشيل الخلفية ($_cutFailed)',
                    if (many && !_move) '${_page + 1} من ${_data.length} · اسحب للمنتج الثاني',
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
            // Options, side by side.
            SizedBox(
              height: 44,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                children: [
                  _Toggle('تحريك الصورة', CupertinoIcons.hand_draw, _move, (v) => setState(() => _move = v)),
                  _Toggle('شيل الظل', CupertinoIcons.sun_min, _shadow, (v) {
                    setState(() => _shadow = v);
                    _cutAll();
                  }),
                  _Toggle('اسم المنتج', CupertinoIcons.textformat, _names, (v) => setState(() {
                        _names = v;
                        for (final d in _data) {
                          d.showName = v;
                        }
                      })),
                  _Toggle('«اطلب من التطبيق»', CupertinoIcons.device_phone_portrait, _cta, (v) => setState(() => _cta = v)),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 2, 12, 0),
              child: Row(children: [
                const Icon(CupertinoIcons.zoom_in, size: 20, color: GH.secondary),
                const SizedBox(width: 6),
                const Text('الحجم', style: TextStyle(fontSize: 14, color: GH.label)),
                Expanded(
                  child: CupertinoSlider(
                    value: _data[_page].zoom.clamp(0.4, 2.6),
                    min: 0.4,
                    max: 2.6,
                    activeColor: GH.burgundy,
                    onChanged: (v) => setState(() => _data[_page].zoom = v),
                  ),
                ),
                CupertinoButton(
                  padding: const EdgeInsets.symmetric(horizontal: 6),
                  minSize: 30,
                  onPressed: () => setState(() {
                    _data[_page].zoom = 1;
                    _data[_page].shiftX = 0;
                    _data[_page].shiftY = 0;
                  }),
                  child: const Icon(CupertinoIcons.arrow_counterclockwise, size: 20, color: GH.burgundy),
                ),
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

/// An on/off chip in the options bar.
class _Toggle extends StatelessWidget {
  const _Toggle(this.label, this.icon, this.on, this.onChanged);

  final String label;
  final IconData icon;
  final bool on;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsetsDirectional.only(end: 8),
        child: GestureDetector(
          onTap: () => onChanged(!on),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 150),
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: on ? GH.burgundy : GH.card,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: on ? GH.burgundy : const Color(0xFFE4D8C8)),
            ),
            child: Row(mainAxisSize: MainAxisSize.min, children: [
              Icon(icon, size: 16, color: on ? GH.goldLight : GH.secondary),
              const SizedBox(width: 6),
              Text(label,
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: on ? CupertinoColors.white : GH.label)),
            ]),
          ),
        ),
      );
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
