import 'package:flutter/cupertino.dart';

/// GH Shopper palette: the brand's deep maroon and gold (same identity as
/// the customer app and the website) on warm cream neutrals.
/// A colour with a light and a dark value. It stays a compile-time constant
/// (so every `const TextStyle(color: GH.label)` keeps working) and picks its
/// value from [GH.dark] whenever it is painted. The app rebuilds its whole
/// tree when the system appearance changes (see `GhApp`).
class GHColor extends Color {
  const GHColor(int light, this.darkValue)
      : lightValue = light,
        super(light);

  final int lightValue;
  final int darkValue;

  int get _v => GH.dark ? darkValue : lightValue;

  @override
  double get a => ((_v >> 24) & 0xff) / 255.0;
  @override
  double get r => ((_v >> 16) & 0xff) / 255.0;
  @override
  double get g => ((_v >> 8) & 0xff) / 255.0;
  @override
  double get b => (_v & 0xff) / 255.0;
  @override
  int get value => _v;
}

class GH {
  /// True while the phone is in dark mode. Set by the app before each build.
  static bool dark = false;

  static const burgundy = GHColor(0xFF5C0B16, 0xFFC9606F);
  static const burgundyDeep = Color(0xFF350304);
  static const rose = Color(0xFFA8455A);
  static const gold = Color(0xFFB08A45);
  static const goldLight = Color(0xFFEADCBA);
  static const sand = GHColor(0xFFF3EBDF, 0xFF2A221D);
  static const ink = GHColor(0xFF1F1915, 0xFF5A4636);

  // Warm beige neutrals (2026 look: beige page, white cards, soft shadows)
  static const bg = GHColor(0xFFF4EEE6, 0xFF100C0A);
  static const card = GHColor(0xFFFFFFFF, 0xFF1E1916);
  static const separator = GHColor(0xFFEDE5DA, 0xFF332A25);
  static const label = GHColor(0xFF1F1915, 0xFFF3EBE2);
  static const secondary = GHColor(0xFF7A6C66, 0xFFB2A49B);
  static const tertiary = GHColor(0xFFB9AEA7, 0xFF6E625B);

  // Surfaces that used to be hard-coded in the pages.
  /// Translucent navigation / tab bar.
  static const bar = GHColor(0xF2F4EEE6, 0xF0171310);
  static const tabBar = GHColor(0xFCFFFFFF, 0xFC1B1613);
  static const barShadow = GHColor(0x183A2414, 0x50000000);
  /// Behind product photos.
  static const imageBg = GHColor(0xFFF7F2EB, 0xFF2A2420);
  /// A row being pressed.
  static const pressed = GHColor(0xFFF3ECE3, 0xFF2B2420);
  /// Hairline border of chips and secondary buttons.
  static const border = GHColor(0xFFE4D8C8, 0xFF3D332D);
  /// A disabled primary button.
  static const disabled = GHColor(0xFFD8CBC3, 0xFF4A403A);
  /// A quiet panel inside a card.
  static const panel = GHColor(0xFFF2EAE0, 0xFF29221E);

  /// Soft card shadow.
  static const shadow = [
    BoxShadow(color: GHColor(0x0F3A2414, 0x40000000), blurRadius: 18, offset: Offset(0, 6)),
    BoxShadow(color: Color(0x08000000), blurRadius: 2, offset: Offset(0, 1)),
  ];

  // Lively accents
  static const green = Color(0xFF1FA35B);
  static const red = Color(0xFFE5383B);
  static const amber = Color(0xFFF08C00);
  static const blue = Color(0xFF2F7CF6);
  static const purple = Color(0xFF8E4FD8);
  static const teal = Color(0xFF13A8A8);
  static const pink = Color(0xFFE5508C);

  static const statusRequested = Color(0xFF2F7CF6); // blue
  static const statusPurchased = Color(0xFFF08C00); // orange
  static const statusArrived = Color(0xFF1FA35B); // green
  static const statusDelivered = Color(0xFF8E4FD8); // purple

  static const brandGradient = LinearGradient(
    begin: AlignmentDirectional.topStart,
    end: AlignmentDirectional.bottomEnd,
    colors: [Color(0xFF6B111C), Color(0xFF350304)],
  );

  /// Friendly avatar colours, picked by name.
  static const avatars = [
    Color(0xFF5C0B16),
    Color(0xFFB08A45),
    Color(0xFF2B2522),
    Color(0xFF8C5A3C),
    Color(0xFF6F7556),
    Color(0xFF4F5B6B),
    Color(0xFF9B6B6B),
    Color(0xFF7D6A4F),
  ];

  static Color avatarFor(String name) =>
      avatars[name.runes.fold<int>(0, (s, r) => s + r) % avatars.length];
}
