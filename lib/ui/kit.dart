import 'dart:async';

import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';

import '../format.dart';
import 'colors.dart';

// ───────────────────────── Text styles ─────────────────────────

class T {
  static const title = TextStyle(
      fontSize: 17, fontWeight: FontWeight.w600, color: GH.label, height: 1.3);
  static const body = TextStyle(fontSize: 16, color: GH.label, height: 1.35);
  static const sub = TextStyle(fontSize: 13.5, color: GH.secondary, height: 1.35);
  static const small = TextStyle(fontSize: 12, color: GH.secondary, height: 1.3);
  static const header = TextStyle(
      fontSize: 13, color: GH.secondary, fontWeight: FontWeight.w500);
  static const money = TextStyle(
      fontSize: 16, fontWeight: FontWeight.w600, color: GH.label,
      fontFeatures: [FontFeature.tabularFigures()]);
  static const big = TextStyle(
      fontSize: 28, fontWeight: FontWeight.w700, color: GH.label,
      letterSpacing: -0.5, fontFeatures: [FontFeature.tabularFigures()]);
}

// ───────────────────────── Page ─────────────────────────

/// An iOS page with a large collapsing title, optional pull-to-refresh and a
/// pinned bottom bar.
class GHPage extends StatelessWidget {
  const GHPage({
    super.key,
    required this.title,
    required this.children,
    this.trailing,
    this.leading,
    this.onRefresh,
    this.bottom,
    this.previousPageTitle,
  });

  final String title;
  final List<Widget> children;
  final Widget? trailing;
  final Widget? leading;
  final Future<void> Function()? onRefresh;
  final Widget? bottom;
  final String? previousPageTitle;

  @override
  Widget build(BuildContext context) {
    return CupertinoPageScaffold(
      backgroundColor: GH.bg,
      child: Column(
        children: [
          Expanded(
            child: CustomScrollView(
              physics: const BouncingScrollPhysics(
                  parent: AlwaysScrollableScrollPhysics()),
              slivers: [
                CupertinoSliverNavigationBar(
                  largeTitle: Text(title),
                  trailing: trailing,
                  leading: leading,
                  previousPageTitle: previousPageTitle,
                  backgroundColor: const Color(0xF2F7F3EE),
                  border: null,
                  transitionBetweenRoutes: false,
                ),
                if (onRefresh != null)
                  CupertinoSliverRefreshControl(onRefresh: onRefresh),
                SliverPadding(
                  padding: const EdgeInsets.only(bottom: 32),
                  sliver: SliverList(
                      delegate: SliverChildListDelegate(children)),
                ),
              ],
            ),
          ),
          if (bottom != null)
            Container(
              decoration: const BoxDecoration(
                color: Color(0xF7FFFFFF),
                border: Border(top: BorderSide(color: GH.separator, width: 0.5)),
              ),
              child: SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 10, 16, 8),
                  child: bottom,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Text button for navigation bars.
class NavButton extends StatelessWidget {
  const NavButton(this.label, {super.key, required this.onPressed, this.bold = false});

  final String label;
  final VoidCallback? onPressed;
  final bool bold;

  @override
  Widget build(BuildContext context) {
    return CupertinoButton(
      padding: EdgeInsets.zero,
      minSize: 32,
      onPressed: onPressed,
      child: Text(label,
          style: TextStyle(
              fontSize: 17,
              fontWeight: bold ? FontWeight.w600 : FontWeight.w400,
              color: onPressed == null ? GH.tertiary : GH.burgundy)),
    );
  }
}

class NavIcon extends StatelessWidget {
  const NavIcon(this.icon, {super.key, required this.onPressed});

  final IconData icon;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return CupertinoButton(
      padding: EdgeInsets.zero,
      minSize: 32,
      onPressed: onPressed,
      child: Icon(icon, size: 26, color: GH.burgundy),
    );
  }
}

// ───────────────────────── Sections & rows ─────────────────────────

/// iOS inset-grouped section: a header, a white rounded group, a footer.
class Section extends StatelessWidget {
  const Section({
    super.key,
    this.header,
    this.footer,
    this.trailing,
    required this.children,
  });

  final String? header;
  final String? footer;
  final Widget? trailing;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final rows = <Widget>[];
    for (var i = 0; i < children.length; i++) {
      rows.add(children[i]);
      if (i < children.length - 1) {
        rows.add(Container(
          height: 0.5,
          color: GH.separator,
          margin: const EdgeInsetsDirectional.only(start: 16),
        ));
      }
    }
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (header != null || trailing != null)
            Padding(
              padding: const EdgeInsetsDirectional.fromSTEB(16, 0, 4, 6),
              child: Row(
                children: [
                  Expanded(child: Text(header ?? '', style: T.header)),
                  if (trailing != null) trailing!,
                ],
              ),
            ),
          if (rows.isNotEmpty)
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Container(
                color: GH.card,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: rows,
                ),
              ),
            ),
          if (footer != null)
            Padding(
              padding: const EdgeInsetsDirectional.fromSTEB(16, 6, 16, 0),
              child: Text(footer!, style: T.small),
            ),
        ],
      ),
    );
  }
}

/// Small text button used in section headers.
class HeaderButton extends StatelessWidget {
  const HeaderButton(this.label, {super.key, required this.onPressed, this.icon});

  final String label;
  final IconData? icon;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return CupertinoButton(
      padding: EdgeInsets.zero,
      minSize: 28,
      onPressed: onPressed,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) Icon(icon, size: 18, color: GH.burgundy),
          if (icon != null) const SizedBox(width: 4),
          Text(label,
              style: const TextStyle(
                  fontSize: 15, color: GH.burgundy, fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }
}

/// Highlights while pressed, like a native table cell.
class Pressable extends StatefulWidget {
  const Pressable({super.key, required this.child, this.onTap, this.onLongPress});

  final Widget child;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;

  @override
  State<Pressable> createState() => _PressableState();
}

class _PressableState extends State<Pressable> {
  bool _down = false;

  void _set(bool v) {
    if (widget.onTap == null && widget.onLongPress == null) return;
    if (_down != v) setState(() => _down = v);
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => _set(true),
      onTapUp: (_) => _set(false),
      onTapCancel: () => _set(false),
      onTap: widget.onTap == null
          ? null
          : () {
              HapticFeedback.selectionClick();
              widget.onTap!();
            },
      onLongPress: widget.onLongPress,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 90),
        color: _down ? const Color(0xFFF1EAE1) : const Color(0x00FFFFFF),
        child: widget.child,
      ),
    );
  }
}

/// A list row: leading icon, title, subtitle, trailing value and chevron.
class Tile extends StatelessWidget {
  const Tile({
    super.key,
    required this.title,
    this.subtitle,
    this.leading,
    this.value,
    this.valueStyle,
    this.trailing,
    this.onTap,
    this.chevron,
    this.titleStyle,
  });

  final String title;
  final String? subtitle;
  final Widget? leading;
  final String? value;
  final TextStyle? valueStyle;
  final Widget? trailing;
  final VoidCallback? onTap;
  final bool? chevron;
  final TextStyle? titleStyle;

  @override
  Widget build(BuildContext context) {
    final showChevron = chevron ?? onTap != null;
    return Pressable(
      onTap: onTap,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 48),
        child: Padding(
          padding: const EdgeInsetsDirectional.fromSTEB(16, 11, 12, 11),
          child: Row(
            children: [
              if (leading != null) ...[leading!, const SizedBox(width: 12)],
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(title, style: titleStyle ?? T.body),
                    if (subtitle != null) ...[
                      const SizedBox(height: 2),
                      Text(subtitle!, style: T.sub),
                    ],
                  ],
                ),
              ),
              if (value != null) ...[
                const SizedBox(width: 8),
                Text(value!,
                    style: valueStyle ??
                        const TextStyle(fontSize: 16, color: GH.secondary)),
              ],
              if (trailing != null) ...[const SizedBox(width: 8), trailing!],
              if (showChevron) ...[
                const SizedBox(width: 6),
                const Icon(CupertinoIcons.forward,
                    size: 16, color: GH.tertiary),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// Label on one side, value on the other (for totals).
class KV extends StatelessWidget {
  const KV(this.label, this.value,
      {super.key, this.strong = false, this.color, this.padding});

  final String label;
  final String value;
  final bool strong;
  final Color? color;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: padding ?? const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
      child: Row(
        children: [
          Expanded(
            child: Text(label,
                style: strong
                    ? T.title
                    : const TextStyle(fontSize: 15.5, color: GH.label)),
          ),
          Text(value,
              style: (strong ? T.money.copyWith(fontSize: 17) : T.money.copyWith(
                  fontWeight: FontWeight.w500, fontSize: 15.5))
                  .copyWith(color: color)),
        ],
      ),
    );
  }
}

/// Shopify-style status pill.
class Badge extends StatelessWidget {
  const Badge(this.label, {super.key, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withAlpha(28),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 6,
            height: 6,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 5),
          Text(label,
              style: TextStyle(
                  fontSize: 12, fontWeight: FontWeight.w600, color: color)),
        ],
      ),
    );
  }
}

/// Coloured round icon, like iOS Settings.
class IconBox extends StatelessWidget {
  const IconBox(this.icon, {super.key, this.color = GH.burgundy, this.size = 30});

  final IconData icon;
  final Color color;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(size * 0.24),
      ),
      child: Icon(icon, size: size * 0.6, color: CupertinoColors.white),
    );
  }
}

class Avatar extends StatelessWidget {
  const Avatar(this.name, {super.key, this.size = 36});

  final String name;
  final double size;

  @override
  Widget build(BuildContext context) {
    final letter = name.trim().isEmpty ? '؟' : name.trim()[0];
    final c = GH.avatarFor(name.trim());
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color.lerp(c, CupertinoColors.white, 0.18)!, c],
        ),
      ),
      child: Text(letter,
          style: TextStyle(
              fontSize: size * 0.42,
              fontWeight: FontWeight.w700,
              color: CupertinoColors.white)),
    );
  }
}

/// A big number card for dashboards. [hero] paints it in the brand gradient.
class StatCard extends StatelessWidget {
  const StatCard(
      {super.key,
      required this.label,
      required this.value,
      this.icon,
      this.color = GH.burgundy,
      this.hero = false,
      this.onTap});

  final String label;
  final String value;
  final IconData? icon;
  final Color color;
  final bool hero;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final fg = hero ? CupertinoColors.white : GH.label;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          gradient: hero ? GH.brandGradient : null,
          color: hero ? null : GH.card,
          borderRadius: BorderRadius.circular(18),
          border: hero ? null : Border.all(color: GH.separator),
          boxShadow: hero
              ? [
                  BoxShadow(
                      color: GH.burgundyDeep.withAlpha(60),
                      blurRadius: 18,
                      offset: const Offset(0, 8))
                ]
              : null,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                if (icon != null)
                  Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      color: hero ? CupertinoColors.white.withAlpha(30) : color.withAlpha(24),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(icon,
                        size: 15,
                        color: hero ? GH.goldLight : color),
                  ),
                if (icon != null) const SizedBox(width: 8),
                Expanded(
                    child: Text(label,
                        style: T.sub.copyWith(
                            color: hero
                                ? GH.goldLight
                                : GH.secondary,
                            fontWeight: FontWeight.w500))),
              ],
            ),
            const SizedBox(height: 10),
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: AlignmentDirectional.centerStart,
              child: Text(value,
                  style: T.big.copyWith(fontSize: 22, color: fg)),
            ),
          ],
        ),
      ),
    );
  }
}

// ───────────────────────── Buttons ─────────────────────────

class PrimaryButton extends StatelessWidget {
  const PrimaryButton(this.label,
      {super.key, required this.onPressed, this.icon, this.busy = false});

  final String label;
  final IconData? icon;
  final VoidCallback? onPressed;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 50,
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: onPressed == null || busy ? null : GH.brandGradient,
          color: onPressed == null || busy ? const Color(0xFFD8CBC3) : null,
          borderRadius: BorderRadius.circular(14),
          boxShadow: onPressed == null || busy
              ? null
              : [
                  BoxShadow(
                      color: GH.burgundy.withAlpha(60),
                      blurRadius: 12,
                      offset: const Offset(0, 4))
                ],
        ),
        child: CupertinoButton(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        borderRadius: BorderRadius.circular(14),
        onPressed: busy ? null : onPressed,
        child: busy
            ? const CupertinoActivityIndicator(color: CupertinoColors.white)
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (icon != null)
                    Icon(icon, size: 20, color: CupertinoColors.white),
                  if (icon != null) const SizedBox(width: 8),
                  Text(label,
                      style: const TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w600,
                          color: CupertinoColors.white)),
                ],
              ),
        ),
      ),
    );
  }
}

class SecondaryButton extends StatelessWidget {
  const SecondaryButton(this.label,
      {super.key, required this.onPressed, this.icon});

  final String label;
  final IconData? icon;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 50,
      child: CupertinoButton(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        color: const Color(0xFFF2EAE0),
        borderRadius: BorderRadius.circular(12),
        onPressed: onPressed,
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) Icon(icon, size: 20, color: GH.burgundy),
            if (icon != null) const SizedBox(width: 8),
            Text(label,
                style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w600,
                    color: GH.burgundy)),
          ],
        ),
      ),
    );
  }
}

/// Small rounded chip button (filters, quick actions).
class Chip extends StatelessWidget {
  const Chip(this.label,
      {super.key, this.selected = false, required this.onTap, this.icon});

  final String label;
  final bool selected;
  final IconData? icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          color: selected ? GH.burgundy : GH.card,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: selected ? GH.burgundy : GH.separator),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null)
              Icon(icon,
                  size: 16,
                  color: selected ? CupertinoColors.white : GH.burgundy),
            if (icon != null) const SizedBox(width: 5),
            Text(label,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: selected ? CupertinoColors.white : GH.label,
                )),
          ],
        ),
      ),
    );
  }
}

// ───────────────────────── Form fields ─────────────────────────

/// iOS Settings-style input row: label then field.
class FieldRow extends StatelessWidget {
  const FieldRow({
    super.key,
    required this.label,
    required this.controller,
    this.placeholder,
    this.keyboard,
    this.suffix,
    this.onChanged,
    this.ltr = false,
    this.autofocus = false,
  });

  final String label;
  final TextEditingController controller;
  final String? placeholder;
  final TextInputType? keyboard;
  final String? suffix;
  final ValueChanged<String>? onChanged;
  final bool ltr;
  final bool autofocus;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsetsDirectional.fromSTEB(16, 4, 12, 4),
      child: Row(
        children: [
          SizedBox(
              width: 112,
              child: Text(label, style: const TextStyle(fontSize: 16, color: GH.label))),
          Expanded(
            child: CupertinoTextField(
              controller: controller,
              placeholder: placeholder,
              keyboardType: keyboard,
              autofocus: autofocus,
              onChanged: onChanged,
              textDirection: ltr ? TextDirection.ltr : null,
              textAlign: ltr ? TextAlign.end : TextAlign.start,
              padding: const EdgeInsets.symmetric(vertical: 10),
              decoration: null,
              style: const TextStyle(fontSize: 16, color: GH.label),
              placeholderStyle:
                  const TextStyle(fontSize: 16, color: GH.tertiary),
              suffix: suffix == null
                  ? null
                  : Padding(
                      padding: const EdgeInsetsDirectional.only(start: 6),
                      child: Text(suffix!, style: T.sub),
                    ),
              clearButtonMode: OverlayVisibilityMode.never,
            ),
          ),
        ],
      ),
    );
  }
}

/// Money / number input row (accepts Arabic digits).
class AmountRow extends StatelessWidget {
  const AmountRow({
    super.key,
    required this.label,
    required this.controller,
    this.suffix = 'ر.ع',
    this.onChanged,
    this.autofocus = false,
  });

  final String label;
  final TextEditingController controller;
  final String suffix;
  final ValueChanged<String>? onChanged;
  final bool autofocus;

  @override
  Widget build(BuildContext context) {
    return FieldRow(
      label: label,
      controller: controller,
      placeholder: '0',
      keyboard: const TextInputType.numberWithOptions(decimal: true),
      suffix: suffix.isEmpty ? null : suffix,
      onChanged: onChanged,
      ltr: true,
      autofocus: autofocus,
    );
  }
}

/// Multi-line text area inside a section.
class NotesRow extends StatelessWidget {
  const NotesRow({super.key, required this.controller, this.placeholder});

  final TextEditingController controller;
  final String? placeholder;

  @override
  Widget build(BuildContext context) {
    return CupertinoTextField(
      controller: controller,
      placeholder: placeholder,
      minLines: 3,
      maxLines: 8,
      padding: const EdgeInsets.all(16),
      decoration: null,
      style: const TextStyle(fontSize: 16, color: GH.label),
      placeholderStyle: const TextStyle(fontSize: 16, color: GH.tertiary),
    );
  }
}

/// A row that opens a picker (shows the chosen value).
class PickerRow extends StatelessWidget {
  const PickerRow(
      {super.key, required this.label, required this.value, required this.onTap, this.placeholder});

  final String label;
  final String? value;
  final String? placeholder;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Tile(
      title: label,
      value: value ?? placeholder ?? 'اختر',
      valueStyle: TextStyle(
          fontSize: 16, color: value == null ? GH.tertiary : GH.secondary),
      onTap: onTap,
    );
  }
}

class SwitchRow extends StatelessWidget {
  const SwitchRow(
      {super.key, required this.label, required this.value, required this.onChanged, this.subtitle});

  final String label;
  final String? subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return Tile(
      title: label,
      subtitle: subtitle,
      chevron: false,
      trailing: CupertinoSwitch(
          value: value, activeTrackColor: GH.burgundy, onChanged: onChanged),
    );
  }
}

/// Sliding segmented control inside a padded row.
class Segments<T extends Object> extends StatelessWidget {
  const Segments(
      {super.key, required this.value, required this.options, required this.onChanged});

  final T value;
  final Map<T, String> options;
  final ValueChanged<T> onChanged;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(10),
      child: CupertinoSlidingSegmentedControl<T>(
        groupValue: value,
        children: options.map((k, v) => MapEntry(
            k,
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 6),
              child: Text(v, style: const TextStyle(fontSize: 14)),
            ))),
        onValueChanged: (v) {
          if (v != null) onChanged(v);
        },
      ),
    );
  }
}

// ───────────────────────── Feedback ─────────────────────────

/// A short message that slides in at the top and disappears.
void toast(BuildContext context, String message, {bool error = false}) {
  final overlay = Overlay.maybeOf(context, rootOverlay: true);
  if (overlay == null) return;
  late OverlayEntry entry;
  entry = OverlayEntry(
    builder: (ctx) => _Toast(
      message: message,
      error: error,
      onDone: () => entry.remove(),
    ),
  );
  overlay.insert(entry);
  if (error) {
    HapticFeedback.heavyImpact();
  } else {
    HapticFeedback.lightImpact();
  }
}

class _Toast extends StatefulWidget {
  const _Toast({required this.message, required this.error, required this.onDone});

  final String message;
  final bool error;
  final VoidCallback onDone;

  @override
  State<_Toast> createState() => _ToastState();
}

class _ToastState extends State<_Toast> {
  bool _shown = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) setState(() => _shown = true);
    });
    Timer(const Duration(milliseconds: 2400), () {
      if (mounted) setState(() => _shown = false);
      Timer(const Duration(milliseconds: 300), widget.onDone);
    });
  }

  @override
  Widget build(BuildContext context) {
    final top = MediaQuery.of(context).padding.top + 8;
    return AnimatedPositioned(
      duration: const Duration(milliseconds: 260),
      curve: Curves.easeOutCubic,
      top: _shown ? top : -120,
      left: 16,
      right: 16,
      child: IgnorePointer(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
          decoration: BoxDecoration(
            color: widget.error ? const Color(0xFFB3261E) : const Color(0xF21C1C1E),
            borderRadius: BorderRadius.circular(14),
            boxShadow: const [
              BoxShadow(color: Color(0x33000000), blurRadius: 16, offset: Offset(0, 6)),
            ],
          ),
          child: Row(
            children: [
              Icon(
                  widget.error
                      ? CupertinoIcons.exclamationmark_circle_fill
                      : CupertinoIcons.checkmark_circle_fill,
                  color: CupertinoColors.white,
                  size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Text(widget.message,
                    style: const TextStyle(
                        color: CupertinoColors.white,
                        fontSize: 15,
                        decoration: TextDecoration.none,
                        fontWeight: FontWeight.w500)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

String errorText(Object e) {
  final s = e.toString();
  if (s.contains('Failed host lookup') ||
      s.contains('SocketException') ||
      s.contains('ClientException')) {
    return 'ما في اتصال بالإنترنت';
  }
  return 'صار خطأ: $s';
}

Future<bool> confirm(BuildContext context, String title,
    {String? message, String ok = 'حذف', bool destructive = true}) async {
  final r = await showCupertinoDialog<bool>(
    context: context,
    barrierDismissible: true,
    builder: (ctx) => CupertinoAlertDialog(
      title: Text(title),
      content: message == null ? null : Text(message),
      actions: [
        CupertinoDialogAction(
          onPressed: () => Navigator.pop(ctx, false),
          child: const Text('إلغاء'),
        ),
        CupertinoDialogAction(
          isDestructiveAction: destructive,
          isDefaultAction: !destructive,
          onPressed: () => Navigator.pop(ctx, true),
          child: Text(ok),
        ),
      ],
    ),
  );
  return r ?? false;
}

class SheetAction<T> {
  const SheetAction(this.label, this.value, {this.destructive = false});

  final String label;
  final T value;
  final bool destructive;
}

/// iOS action sheet. Returns the chosen value, or null when cancelled.
Future<T?> actionSheet<T>(BuildContext context,
    {String? title, String? message, required List<SheetAction<T>> actions}) {
  return showCupertinoModalPopup<T>(
    context: context,
    builder: (ctx) => CupertinoActionSheet(
      title: title == null ? null : Text(title),
      message: message == null ? null : Text(message),
      actions: actions
          .map((a) => CupertinoActionSheetAction(
                isDestructiveAction: a.destructive,
                onPressed: () => Navigator.pop(ctx, a.value),
                child: Text(a.label),
              ))
          .toList(),
      cancelButton: CupertinoActionSheetAction(
        isDefaultAction: true,
        onPressed: () => Navigator.pop(ctx),
        child: const Text('إلغاء'),
      ),
    ),
  );
}

/// Bottom date picker with a Done button.
Future<DateTime?> pickDate(BuildContext context, DateTime initial) async {
  var value = initial;
  final ok = await showCupertinoModalPopup<bool>(
    context: context,
    builder: (ctx) => Container(
      height: 300,
      color: GH.card,
      child: SafeArea(
        top: false,
        child: Column(
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                CupertinoButton(
                    onPressed: () => Navigator.pop(ctx, false),
                    child: const Text('إلغاء')),
                CupertinoButton(
                    onPressed: () => Navigator.pop(ctx, true),
                    child: const Text('تم',
                        style: TextStyle(fontWeight: FontWeight.w600))),
              ],
            ),
            Expanded(
              child: CupertinoDatePicker(
                mode: CupertinoDatePickerMode.date,
                initialDateTime: initial,
                onDateTimeChanged: (d) => value = d,
              ),
            ),
          ],
        ),
      ),
    ),
  );
  return ok == true ? value : null;
}

// ───────────────────────── States ─────────────────────────

class EmptyState extends StatelessWidget {
  const EmptyState(
      {super.key, required this.icon, required this.title, this.message, this.action});

  final IconData icon;
  final String title;
  final String? message;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(32, 60, 32, 20),
      child: Column(
        children: [
          Icon(icon, size: 52, color: GH.tertiary),
          const SizedBox(height: 14),
          Text(title, style: T.title, textAlign: TextAlign.center),
          if (message != null) ...[
            const SizedBox(height: 6),
            Text(message!, style: T.sub, textAlign: TextAlign.center),
          ],
          if (action != null) ...[const SizedBox(height: 18), action!],
        ],
      ),
    );
  }
}

class Loading extends StatelessWidget {
  const Loading({super.key});

  @override
  Widget build(BuildContext context) => const Padding(
        padding: EdgeInsets.all(48),
        child: Center(child: CupertinoActivityIndicator(radius: 13)),
      );
}

/// Thin step indicator for item progress.
class StepDots extends StatelessWidget {
  const StepDots(this.index, {super.key});

  /// 0 = requested … 4 = delivered.
  final int index;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var k = 0; k < 5; k++) ...[
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: index >= k ? GH.burgundy : GH.separator,
            ),
          ),
          if (k < 4)
            Container(
                width: 11,
                height: 2,
                color: index > k ? GH.burgundy : GH.separator),
        ],
      ],
    );
  }
}

/// Opens a full-screen sheet-style page (like iOS "New" forms).
Future<T?> presentForm<T>(BuildContext context, Widget page) {
  return Navigator.of(context, rootNavigator: true).push<T>(
    CupertinoPageRoute<T>(fullscreenDialog: true, builder: (_) => page),
  );
}

Future<T?> pushPage<T>(BuildContext context, Widget page) {
  return Navigator.of(context, rootNavigator: true)
      .push<T>(CupertinoPageRoute<T>(builder: (_) => page));
}

/// Formats money for display; kept here so pages import one file.
String m(num v) => omr(v);
