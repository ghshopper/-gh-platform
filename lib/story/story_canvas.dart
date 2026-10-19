import 'dart:math' as math;

import 'package:flutter/cupertino.dart';
import 'package:flutter/rendering.dart';

/// One product on an Instagram story.
class StoryData {
  StoryData({
    required this.brand,
    required this.name,
    required this.price,
    this.was,
    this.image,
  });

  String brand;
  String name;
  double price;

  /// The old price (crossed out on the offer story). Null when no discount.
  double? was;
  ImageProvider? image;

  /// Photo size (1 = fits its place) and how far it is moved up (−) or down (+).
  double zoom = 1;
  double shiftY = 0;

  /// Show the product name under the brand.
  bool showName = true;

  int? get offPercent {
    final w = was;
    if (w == null || w <= price || w <= 0) return null;
    return ((w - price) / w * 100).round();
  }
}

/// The six approved story designs (1080 × 1920).
enum StoryTemplate {
  classic('كلاسيك'),
  arch('القوس'),
  tag('بطاقة السعر'),
  editorial('مجلة'),
  offer('عرض / خصم'),
  clean('نظيف');

  const StoryTemplate(this.label);
  final String label;
}

class _C {
  static const beige = Color(0xFFF3ECE1);
  static const beige2 = Color(0xFFE9DFCF);
  static const ink = Color(0xFF1F1915);
  static const sub = Color(0xFF6E6258);
  static const maroon = Color(0xFF5C0B16);
  static const gold = Color(0xFF967034);
  static const goldLight = Color(0xFFE2C88C);
  static const white = Color(0xFFFFFFFF);
}

const _serif = 'Cormorant';
const _arabic = 'IBMPlexSansArabic';

TextStyle _latin(double size,
        {Color color = _C.ink, double weight = 500, double spacing = 0}) =>
    TextStyle(
      fontFamily: _serif,
      fontSize: size,
      color: color,
      letterSpacing: spacing,
      height: 1.05,
      fontVariations: [FontVariation('wght', weight)],
      decoration: TextDecoration.none,
    );

TextStyle _ar(double size,
        {Color color = _C.ink, FontWeight weight = FontWeight.w400}) =>
    TextStyle(
      fontFamily: _arabic,
      fontSize: size,
      color: color,
      fontWeight: weight,
      height: 1.35,
      decoration: TextDecoration.none,
    );

String storyPrice(double v) => v.toStringAsFixed(3);

/// Prices: clean, even digits.
TextStyle _num(double size, {Color color = _C.ink, FontWeight weight = FontWeight.w600}) => TextStyle(
      fontFamily: _arabic,
      fontSize: size,
      color: color,
      fontWeight: weight,
      height: 1.1,
      letterSpacing: size * .01,
      fontFeatures: const [FontFeature.tabularFigures()],
      decoration: TextDecoration.none,
    );

/// A product photo blended into the background (white photo backgrounds
/// disappear into the beige, like `mix-blend-mode: multiply`).
class _Multiply extends SingleChildRenderObjectWidget {
  const _Multiply({required Widget super.child});

  @override
  RenderObject createRenderObject(BuildContext context) => _RenderMultiply();
}

class _RenderMultiply extends RenderProxyBox {
  @override
  void paint(PaintingContext context, Offset offset) {
    final c = child;
    if (c == null) return;
    context.canvas.saveLayer(offset & size, Paint()..blendMode = BlendMode.multiply);
    context.paintChild(c, offset);
    context.canvas.restore();
  }
}

/// The story itself, always laid out at 1080 × 1920 (wrap it in a FittedBox
/// to show it smaller).
class StoryCanvas extends StatelessWidget {
  const StoryCanvas({
    super.key,
    required this.data,
    required this.template,
    this.showCta = true,
  });

  final StoryData data;
  final StoryTemplate template;

  /// "Order from the app" lines.
  final bool showCta;

  static const width = 1080.0;
  static const height = 1920.0;

  Widget _photo({bool blend = true}) {
    final img = data.image;
    if (img == null) return const SizedBox();
    final w = Image(
      image: img,
      fit: BoxFit.contain,
      filterQuality: FilterQuality.high,
      errorBuilder: (_, __, ___) => const SizedBox(),
    );
    final photo = blend ? _Multiply(child: w) : w;
    if (data.zoom == 1 && data.shiftY == 0) return photo;
    return Transform.translate(
      offset: Offset(0, data.shiftY),
      child: Transform.scale(scale: data.zoom, child: photo),
    );
  }

  Widget _pos(double top, double left, double w, double h, Widget child) =>
      Positioned(top: top, left: left, width: w, height: h, child: child);

  /// Shrinks long brand names to the given width.
  Widget _fit(double maxWidth, Widget child) => SizedBox(
        width: maxWidth,
        child: FittedBox(fit: BoxFit.scaleDown, child: child),
      );

  Widget _brand(double size, {double spacing = .2, Color color = _C.ink, double maxWidth = 900}) =>
      _fit(
          maxWidth,
          Text(data.brand.toUpperCase(),
              textDirection: TextDirection.ltr,
              maxLines: 1,
              style: _latin(size, color: color, spacing: size * spacing)));

  Widget _name(double size, {Color color = _C.sub, double maxWidth = 900}) => !data.showName || data.name.trim().isEmpty
      ? const SizedBox.shrink()
      : SizedBox(
        width: maxWidth,
        child: Text(data.name,
            textAlign: TextAlign.center,
            textDirection: TextDirection.rtl,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: _ar(size, color: color)),
      );

  Widget _price(double size, {Color color = _C.maroon, bool currencyBelow = false}) {
    final n = Text(storyPrice(data.price),
        textDirection: TextDirection.ltr,
        style: _num(size * .78, color: color));
    final c = Text('ر.ع',
        textDirection: TextDirection.rtl,
        style: _ar(size * .36, color: color, weight: FontWeight.w500));
    if (currencyBelow) {
      return Column(mainAxisSize: MainAxisSize.min, children: [n, const SizedBox(height: 6), c]);
    }
    return Row(
      mainAxisSize: MainAxisSize.min,
      textDirection: TextDirection.ltr,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [n, SizedBox(width: size * .18), c],
    );
  }

  Widget _kicker(String s, {Color color = _C.gold, double size = 30}) => Text(s,
      textDirection: TextDirection.ltr,
      style: _latin(size, color: color, spacing: size * .42));

  Widget _centered(double top, Widget child) => Positioned(
        top: top,
        left: 0,
        right: 0,
        child: Center(child: child),
      );

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: width,
      height: height,
      child: Directionality(
        textDirection: TextDirection.rtl,
        child: ClipRect(child: _build()),
      ),
    );
  }

  Widget _build() {
    switch (template) {
      case StoryTemplate.classic:
        return _classic();
      case StoryTemplate.arch:
        return _arch();
      case StoryTemplate.tag:
        return _tag();
      case StoryTemplate.editorial:
        return _editorial();
      case StoryTemplate.offer:
        return _offer();
      case StoryTemplate.clean:
        return _clean();
    }
  }

  // 1 · Classic
  Widget _classic() => Container(
        color: _C.beige,
        child: Stack(children: [
          _centered(250, Image.asset('assets/images/story_logo.png', width: 170)),
          _centered(470, _kicker('NEW IN')),
          _pos(530, 140, 800, 700, _photo()),
          _centered(
              1250,
              Column(mainAxisSize: MainAxisSize.min, children: [
                _brand(66),
                const SizedBox(height: 8),
                _name(38),
                Container(width: 70, height: 2, color: _C.gold, margin: const EdgeInsets.symmetric(vertical: 30)),
                _price(96),
              ])),
          if (showCta)
            _centered(1640, Text('متوفر الحين في تطبيق GH Shopper', style: _ar(32, color: _C.sub, weight: FontWeight.w500))),
        ]),
      );

  // 2 · Arch
  Widget _arch() => Container(
        color: _C.beige2,
        child: Stack(children: [
          _pos(
              250,
              130,
              820,
              1000,
              ClipRRect(
                borderRadius: const BorderRadius.vertical(top: Radius.circular(410)),
                child: Container(
                  color: _C.white,
                  child: Stack(children: [
                    Positioned(
                      top: 18,
                      left: 18,
                      right: 18,
                      height: 1100,
                      child: Container(
                        decoration: BoxDecoration(
                          border: Border.all(color: _C.goldLight, width: 2),
                          borderRadius: const BorderRadius.vertical(top: Radius.circular(392)),
                        ),
                      ),
                    ),
                    _pos(170, 60, 700, 780, _photo()),
                  ]),
                ),
              )),
          Positioned(
            top: 1250,
            left: 130,
            width: 820,
            child: Container(
              color: _C.beige,
              padding: const EdgeInsets.fromLTRB(60, 56, 60, 60),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                _brand(58, maxWidth: 700, spacing: .22),
                const SizedBox(height: 6),
                _name(36, maxWidth: 700),
                const SizedBox(height: 34),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 44, vertical: 16),
                  decoration: BoxDecoration(color: _C.maroon, borderRadius: BorderRadius.circular(999)),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    if (showCta) ...[
                      Text('اطلبه الحين', style: _ar(28, color: _C.goldLight)),
                      const SizedBox(width: 22),
                    ],
                    _price(64, color: _C.white),
                  ]),
                ),
              ]),
            ),
          ),
          _centered(1648, Image.asset('assets/images/story_cheetah.png', width: 300)),
        ]),
      );

  // 3 · Price tag
  Widget _tag() => Container(
        color: _C.beige,
        child: Stack(children: [
          _centered(
              260,
              Column(mainAxisSize: MainAxisSize.min, children: [
                _brand(84),
                const SizedBox(height: 14),
                _name(38),
              ])),
          _pos(470, 90, 760, 980, _photo()),
          _pos(800, 690, 220, 160, CustomPaint(painter: _StringPainter())),
          Positioned(
            top: 900,
            right: 70,
            width: 300,
            height: 420,
            child: Transform.rotate(
              angle: 8 * math.pi / 180,
              child: ClipPath(
                clipper: _TagClipper(),
                child: Container(
                  color: _C.maroon,
                  padding: const EdgeInsets.only(top: 70),
                  child: Stack(clipBehavior: Clip.none, children: [
                    Positioned(
                      top: -26,
                      left: 135,
                      child: Container(
                          width: 30,
                          height: 30,
                          decoration: const BoxDecoration(color: _C.beige, shape: BoxShape.circle)),
                    ),
                    Center(
                      child: Column(mainAxisSize: MainAxisSize.min, children: [
                        _kicker('PRICE', color: _C.goldLight, size: 24),
                        Container(width: 50, height: 1, color: _C.goldLight, margin: const EdgeInsets.symmetric(vertical: 14)),
                        _fit(260, _price(84, color: _C.white, currencyBelow: true)),
                        Container(width: 50, height: 1, color: _C.goldLight, margin: const EdgeInsets.symmetric(vertical: 14)),
                        _kicker('GH', color: _C.goldLight, size: 24),
                      ]),
                    ),
                  ]),
                ),
              ),
            ),
          ),
          if (showCta)
            _centered(
                1520,
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 48, vertical: 18),
                  decoration: BoxDecoration(border: Border.all(color: _C.ink, width: 1.5)),
                  child: Text('اطلبه من التطبيق', style: _ar(32, weight: FontWeight.w500)),
                )),
        ]),
      );

  // 4 · Editorial
  Widget _editorial() {
    final big = data.brand.toUpperCase();
    final parts = data.name.split(' · ');
    return Container(
      color: _C.beige,
      child: Stack(children: [
        _centered(
            250,
            _fit(
                980,
                Stack(children: [
                  Text(big,
                      textDirection: TextDirection.ltr,
                      maxLines: 1,
                      style: _latin(250, color: _C.beige2)),
                  Text(big,
                      textDirection: TextDirection.ltr,
                      maxLines: 1,
                      style: TextStyle(
                          fontFamily: _serif,
                          fontSize: 250,
                          height: 1.05,
                          fontVariations: const [FontVariation('wght', 500)],
                          decoration: TextDecoration.none,
                          foreground: Paint()
                            ..style = PaintingStyle.stroke
                            ..strokeWidth = 2
                            ..color = _C.gold)),
                ]))),
        _pos(360, 120, 840, 980, _photo()),
        Positioned(
          top: 1350,
          left: 90,
          right: 90,
          child: Container(
            padding: const EdgeInsets.only(top: 34),
            decoration: const BoxDecoration(border: Border(top: BorderSide(color: _C.ink, width: 1.5))),
            child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                  Text('N° 01 — New in', textDirection: TextDirection.ltr, style: _latin(34, color: _C.gold)),
                  if (data.showName && data.name.trim().isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(parts.first, maxLines: 2, overflow: TextOverflow.ellipsis, style: _ar(42, weight: FontWeight.w600)),
                    if (parts.length > 1) Text(parts.sublist(1).join(' · '), style: _ar(30, color: _C.sub)),
                  ] else
                    Text(data.brand.toUpperCase(), textDirection: TextDirection.ltr, style: _latin(44, spacing: 8)),
                ]),
              ),
              const SizedBox(width: 24),
              _price(92, color: _C.ink),
            ]),
          ),
        ),
        Positioned(
          top: 1560,
          left: 90,
          right: 90,
          child: Row(children: [
            Text('ghshopper.com', textDirection: TextDirection.ltr, style: _ar(30, color: _C.sub)),
            const Spacer(),
            Image.asset('assets/images/story_logo.png', height: 60),
          ]),
        ),
      ]),
    );
  }

  // 5 · Offer
  Widget _offer() {
    final off = data.offPercent;
    return Container(
      color: _C.maroon,
      child: Stack(children: [
        _pos(250, 70, 940, 1380, Container(color: _C.beige)),
        Positioned(
          top: 300,
          right: -20,
          child: ClipPath(
            clipper: _RibbonClipper(),
            child: Container(
              color: _C.goldLight,
              padding: const EdgeInsets.fromLTRB(54, 14, 44, 14),
              child: Text(off != null ? 'خصم $off٪' : 'عرض خاص',
                  style: _ar(44, color: _C.maroon, weight: FontWeight.w700)),
            ),
          ),
        ),
        Positioned(top: 306, left: 130, child: _kicker('SPECIAL OFFER')),
        _pos(400, 170, 740, 760, _photo()),
        _centered(
            1180,
            Column(mainAxisSize: MainAxisSize.min, children: [
              _brand(56, maxWidth: 820),
              const SizedBox(height: 4),
              _name(34, maxWidth: 820),
              const SizedBox(height: 26),
              Row(
                mainAxisSize: MainAxisSize.min,
                textDirection: TextDirection.ltr,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  if (data.was != null && off != null) ...[
                    Text(storyPrice(data.was!),
                        textDirection: TextDirection.ltr,
                        style: _num(46, color: _C.sub, weight: FontWeight.w400).copyWith(
                            decoration: TextDecoration.lineThrough,
                            decorationColor: _C.sub,
                            decorationThickness: 1.5)),
                    const SizedBox(width: 34),
                  ],
                  _price(100),
                ],
              ),
            ])),
        _centered(
            1668,
            Column(mainAxisSize: MainAxisSize.min, children: [
              Image.asset('assets/images/story_cheetah_light.png', width: 250),
              const SizedBox(height: 18),
              Text(showCta ? 'العرض لفترة محدودة · في التطبيق' : 'العرض لفترة محدودة',
                  style: _ar(30, color: _C.goldLight)),
            ])),
      ]),
    );
  }

  // 6 · Clean (no call to action)
  Widget _clean() => Container(
        color: _C.beige,
        child: Stack(children: [
          _centered(270, Image.asset('assets/images/story_logo.png', width: 120)),
          _pos(410, 110, 860, 850, _photo()),
          _centered(
              1290,
              Column(mainAxisSize: MainAxisSize.min, children: [
                _brand(60, spacing: .24),
                const SizedBox(height: 8),
                _name(36),
                const SizedBox(height: 30),
                _price(84),
              ])),
          _centered(1640, Opacity(opacity: .8, child: Image.asset('assets/images/story_cheetah.png', width: 170))),
        ]),
      );
}

class _TagClipper extends CustomClipper<Path> {
  @override
  Path getClip(Size s) => Path()
    ..moveTo(s.width / 2, 0)
    ..lineTo(s.width, s.height * .16)
    ..lineTo(s.width, s.height)
    ..lineTo(0, s.height)
    ..lineTo(0, s.height * .16)
    ..close();

  @override
  bool shouldReclip(covariant CustomClipper<Path> oldClipper) => false;
}

class _RibbonClipper extends CustomClipper<Path> {
  @override
  Path getClip(Size s) => Path()
    ..moveTo(0, 0)
    ..lineTo(s.width, 0)
    ..lineTo(s.width, s.height)
    ..lineTo(0, s.height)
    ..lineTo(22, s.height / 2)
    ..close();

  @override
  bool shouldReclip(covariant CustomClipper<Path> oldClipper) => false;
}

/// The string the price tag hangs from.
class _StringPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final p = Paint()
      ..color = _C.gold
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.5;
    final path = Path()
      ..moveTo(size.width * .62, size.height)
      ..quadraticBezierTo(size.width * .1, size.height * .1, size.width * .05, 0);
    canvas.drawPath(path, p);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
