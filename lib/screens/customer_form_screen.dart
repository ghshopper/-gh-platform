import 'package:flutter/material.dart';

import '../models.dart';
import '../repo.dart';
import '../widgets.dart';

/// Adds or edits a customer. Returns the saved [Customer].
class CustomerFormScreen extends StatefulWidget {
  const CustomerFormScreen({super.key, this.customer});

  final Customer? customer;

  @override
  State<CustomerFormScreen> createState() => _CustomerFormScreenState();
}

class _CustomerFormScreenState extends State<CustomerFormScreen> {
  final _form = GlobalKey<FormState>();
  late final _name = TextEditingController(text: widget.customer?.name);
  late final _phone = TextEditingController(text: widget.customer?.phone);
  late final _city = TextEditingController(text: widget.customer?.city);
  late final _notes = TextEditingController(text: widget.customer?.notes);
  bool _saving = false;

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    _city.dispose();
    _notes.dispose();
    super.dispose();
  }

  String? _clean(TextEditingController c) {
    final t = c.text.trim();
    return t.isEmpty ? null : t;
  }

  Future<void> _save() async {
    if (!(_form.currentState?.validate() ?? false)) return;
    setState(() => _saving = true);
    try {
      final c = await Repo.saveCustomer(
        id: widget.customer?.id,
        name: _name.text.trim(),
        phone: _clean(_phone),
        city: _clean(_city),
        notes: _clean(_notes),
      );
      if (mounted) Navigator.pop(context, c);
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        showMsg(context, errorText(e), error: true);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
          title: Text(widget.customer == null ? 'عميلة جديدة' : 'تعديل العميلة')),
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            TextFormField(
              controller: _name,
              decoration: const InputDecoration(labelText: 'الاسم'),
              validator: (v) =>
                  (v ?? '').trim().isEmpty ? 'اكتب اسم العميلة' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _phone,
              keyboardType: TextInputType.phone,
              textDirection: TextDirection.ltr,
              decoration: const InputDecoration(
                  labelText: 'رقم الجوال (واتساب)', hintText: '9XXXXXXX'),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _city,
              decoration: const InputDecoration(labelText: 'المنطقة (اختياري)'),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _notes,
              maxLines: 3,
              decoration: const InputDecoration(
                  labelText: 'ملاحظات (اختياري)',
                  hintText: 'المقاسات، الذوق، المفضلات…'),
            ),
            const SizedBox(height: 24),
            FilledButton(
              onPressed: _saving ? null : _save,
              child: _saving
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(
                          strokeWidth: 2, color: Colors.white))
                  : const Text('حفظ'),
            ),
          ],
        ),
      ),
    );
  }
}
