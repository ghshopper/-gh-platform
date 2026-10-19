import 'package:flutter/cupertino.dart';

/// GH Shopper palette: the brand's deep maroon and gold (same identity as
/// the customer app and the website) on warm cream neutrals.
class GH {
  static const burgundy = Color(0xFF5C0B16);
  static const burgundyDeep = Color(0xFF350304);
  static const rose = Color(0xFFA8455A);
  static const gold = Color(0xFFB08A45);
  static const goldLight = Color(0xFFEADCBA);
  static const sand = Color(0xFFF3EBDF);
  static const ink = Color(0xFF1F1915);

  // Warm beige neutrals (2026 look: beige page, white cards, soft shadows)
  static const bg = Color(0xFFF4EEE6);
  static const card = Color(0xFFFFFFFF);
  static const separator = Color(0xFFEDE5DA);
  static const label = Color(0xFF1F1915);
  static const secondary = Color(0xFF7A6C66);
  static const tertiary = Color(0xFFB9AEA7);

  /// Soft card shadow.
  static const shadow = [
    BoxShadow(color: Color(0x0F3A2414), blurRadius: 18, offset: Offset(0, 6)),
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
