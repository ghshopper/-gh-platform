import 'package:flutter/cupertino.dart';

/// GH Shopper palette: brand burgundy & gold on a warm, lively iOS base.
class GH {
  static const burgundy = Color(0xFF7A1530);
  static const burgundyDeep = Color(0xFF4A0B1B);
  static const rose = Color(0xFFC2415F);
  static const gold = Color(0xFFC79A4B);
  static const goldLight = Color(0xFFF3E3C3);
  static const sand = Color(0xFFF6E9DA);

  // Warm iOS / Shopify-like neutrals
  static const bg = Color(0xFFF7F2EE);
  static const card = Color(0xFFFFFFFF);
  static const separator = Color(0xFFEDE6E1);
  static const label = Color(0xFF1C1C1E);
  static const secondary = Color(0xFF6E6A70);
  static const tertiary = Color(0xFFB3ADB2);

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
    colors: [Color(0xFF8E1B3A), Color(0xFF4A0B1B)],
  );

  /// Friendly avatar colours, picked by name.
  static const avatars = [
    Color(0xFF7A1530),
    Color(0xFFC79A4B),
    Color(0xFF2F7CF6),
    Color(0xFF1FA35B),
    Color(0xFF8E4FD8),
    Color(0xFFE5508C),
    Color(0xFF13A8A8),
    Color(0xFFF08C00),
  ];

  static Color avatarFor(String name) =>
      avatars[name.runes.fold<int>(0, (s, r) => s + r) % avatars.length];
}
