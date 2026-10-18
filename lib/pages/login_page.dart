import 'package:flutter/cupertino.dart';
import '../data/api.dart';

import '../format.dart';
import '../ui/colors.dart';
import '../ui/kit.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final id = normalizeDigits(_email.text.trim());
    final password = _password.text;
    if (id.isEmpty || password.length < 6) {
      toast(context, 'اكتب الإيميل أو رقمك وكلمة المرور', error: true);
      return;
    }
    setState(() => _busy = true);
    try {
      await Api.i.login(id, password);
    } catch (e) {
      if (mounted) toast(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _field(TextEditingController c, String placeholder,
      {bool obscure = false, TextInputType? keyboard}) {
    return CupertinoTextField(
      controller: c,
      placeholder: placeholder,
      obscureText: obscure,
      keyboardType: keyboard,
      autocorrect: false,
      textDirection: TextDirection.ltr,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
      style: const TextStyle(fontSize: 17, color: GH.label),
      placeholderStyle: const TextStyle(fontSize: 17, color: GH.tertiary),
      decoration: const BoxDecoration(color: GH.card),
      onSubmitted: (_) => _submit(),
    );
  }

  @override
  Widget build(BuildContext context) {
    return CupertinoPageScaffold(
      backgroundColor: GH.bg,
      child: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Image.asset('assets/images/logo.png', height: 120),
                  const SizedBox(height: 28),
                  Text(
                    'تسجيل الدخول',
                    textAlign: TextAlign.center,
                    style: T.big,
                  ),
                  const SizedBox(height: 24),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Column(
                      children: [
                        _field(_email, 'الإيميل أو رقم الجوال',
                            keyboard: TextInputType.emailAddress),
                        Container(height: 0.5, color: GH.separator),
                        _field(_password, 'كلمة المرور', obscure: true),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  PrimaryButton('دخول',
                      busy: _busy, onPressed: _submit),
                  const SizedBox(height: 14),
                  const Text(
                    'نفس حسابك في لوحة الإدارة بالموقع. المناديب يدخلون برقم الجوال.',
                    textAlign: TextAlign.center,
                    style: T.small,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
