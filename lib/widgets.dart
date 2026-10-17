import 'package:flutter/material.dart';

import 'format.dart';
import 'theme.dart';

void showMsg(BuildContext context, String text, {bool error = false}) {
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(
      content: Text(text),
      backgroundColor: error ? GH.red : GH.burgundy,
    ),
  );
}

String errorText(Object e) {
  final s = e.toString();
  if (s.contains('Failed host lookup') || s.contains('SocketException')) {
    return 'ما في اتصال بالإنترنت';
  }
  return 'صار خطأ: $s';
}

Future<bool> confirm(BuildContext context, String title,
    {String? body, String ok = 'نعم', bool danger = true}) async {
  final r = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(title),
      content: body == null ? null : Text(body),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('إلغاء')),
        FilledButton(
          style: FilledButton.styleFrom(
              backgroundColor: danger ? GH.red : GH.burgundy),
          onPressed: () => Navigator.pop(ctx, true),
          child: Text(ok),
        ),
      ],
    ),
  );
  return r ?? false;
}

/// A text field for money amounts that accepts Arabic digits.
class AmountField extends StatelessWidget {
  const AmountField({
    super.key,
    required this.controller,
    required this.label,
    this.suffix = 'ر.ع',
    this.required = false,
    this.onChanged,
  });

  final TextEditingController controller;
  final String label;
  final String suffix;
  final bool required;
  final ValueChanged<String>? onChanged;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      keyboardType: const TextInputType.numberWithOptions(decimal: true),
      textDirection: TextDirection.ltr,
      decoration: InputDecoration(labelText: label, suffixText: suffix),
      onChanged: onChanged,
      validator: (v) {
        final t = (v ?? '').trim();
        if (t.isEmpty) return required ? 'مطلوب' : null;
        if (parseAmount(t) == null) return 'رقم غير صحيح';
        return null;
      },
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 48, color: GH.gold),
            const SizedBox(height: 12),
            Text(text,
                textAlign: TextAlign.center,
                style: const TextStyle(color: GH.muted, fontSize: 15)),
          ],
        ),
      ),
    );
  }
}

class ErrorRetry extends StatelessWidget {
  const ErrorRetry({super.key, required this.error, required this.onRetry});

  final Object error;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(errorText(error),
                textAlign: TextAlign.center,
                style: const TextStyle(color: GH.red)),
            const SizedBox(height: 12),
            OutlinedButton(onPressed: onRetry, child: const Text('حاول مرة ثانية')),
          ],
        ),
      ),
    );
  }
}

/// Label + value line used in summaries.
class KeyValue extends StatelessWidget {
  const KeyValue(this.label, this.value,
      {super.key, this.strong = false, this.color});

  final String label;
  final String value;
  final bool strong;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final style = TextStyle(
      fontSize: strong ? 16 : 14,
      fontWeight: strong ? FontWeight.w700 : FontWeight.w400,
      color: color ?? GH.ink,
    );
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          Expanded(child: Text(label, style: style)),
          Text(value, style: style),
        ],
      ),
    );
  }
}
