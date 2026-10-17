import 'package:flutter/material.dart';

/// GH Shopper brand colours.
class GH {
  static const burgundy = Color(0xFF5A0F1C);
  static const burgundyLight = Color(0xFF7A1A28);
  static const gold = Color(0xFFC9A35F);
  static const goldDark = Color(0xFFB08A45);
  static const cream = Color(0xFFFBF7F0);
  static const sand = Color(0xFFEAD7C0);
  static const ink = Color(0xFF3A0610);
  static const muted = Color(0xFF8A6A3A);
  static const green = Color(0xFF2F5446);
  static const red = Color(0xFFA3302F);
}

ThemeData buildTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: GH.burgundy,
    primary: GH.burgundy,
    secondary: GH.gold,
  );
  final border = OutlineInputBorder(
    borderRadius: BorderRadius.circular(12),
    borderSide: const BorderSide(color: GH.sand),
  );
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    fontFamily: 'Tajawal',
    scaffoldBackgroundColor: GH.cream,
    appBarTheme: const AppBarTheme(
      backgroundColor: GH.cream,
      foregroundColor: GH.burgundy,
      surfaceTintColor: GH.cream,
      elevation: 0,
      centerTitle: true,
      titleTextStyle: TextStyle(
        fontFamily: 'ArefRuqaa',
        fontSize: 26,
        fontWeight: FontWeight.w700,
        color: GH.burgundy,
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      border: border,
      enabledBorder: border,
      focusedBorder: border.copyWith(
        borderSide: const BorderSide(color: GH.burgundy, width: 1.5),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: GH.burgundy,
        foregroundColor: Colors.white,
        minimumSize: const Size(48, 48),
        textStyle: const TextStyle(
            fontFamily: 'Tajawal', fontSize: 16, fontWeight: FontWeight.w700),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: GH.burgundy,
        minimumSize: const Size(48, 48),
        side: const BorderSide(color: GH.burgundy),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    ),
    floatingActionButtonTheme: const FloatingActionButtonThemeData(
      backgroundColor: GH.burgundy,
      foregroundColor: Colors.white,
    ),
    navigationBarTheme: const NavigationBarThemeData(
      backgroundColor: Colors.white,
      indicatorColor: GH.sand,
    ),
  );
}

/// White rounded card used across the app.
class GhCard extends StatelessWidget {
  const GhCard({super.key, required this.child, this.onTap, this.padding});

  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: GH.sand),
          ),
          padding: padding ?? const EdgeInsets.all(14),
          child: child,
        ),
      ),
    );
  }
}

/// Small coloured pill for statuses.
class StatusPill extends StatelessWidget {
  const StatusPill({super.key, required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        label,
        style: const TextStyle(
            color: Colors.white, fontSize: 12, fontWeight: FontWeight.w700),
      ),
    );
  }
}

class SectionTitle extends StatelessWidget {
  const SectionTitle(this.text, {super.key, this.trailing});

  final String text;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 18, 4, 8),
      child: Row(
        children: [
          Expanded(
            child: Text(
              text,
              style: const TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w700,
                color: GH.burgundy,
              ),
            ),
          ),
          if (trailing != null) trailing!,
        ],
      ),
    );
  }
}
