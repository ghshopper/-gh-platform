import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../theme.dart';
import '../widgets.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  bool _signUp = false;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final email = _email.text.trim();
    final password = _password.text;
    if (email.isEmpty || password.length < 6) {
      showMsg(context, 'اكتب الإيميل وكلمة مرور ٦ أحرف أو أكثر', error: true);
      return;
    }
    setState(() => _busy = true);
    final auth = Supabase.instance.client.auth;
    try {
      if (_signUp) {
        final res = await auth.signUp(email: email, password: password);
        if (res.session == null && mounted) {
          showMsg(context, 'تم إنشاء الحساب. افتح الإيميل وأكّد الحساب ثم سجّل دخول');
          setState(() => _signUp = false);
        }
      } else {
        await auth.signInWithPassword(email: email, password: password);
      }
    } on AuthException catch (e) {
      if (mounted) {
        final msg = e.message.contains('Invalid login')
            ? 'الإيميل أو كلمة المرور غلط'
            : e.message;
        showMsg(context, msg, error: true);
      }
    } catch (e) {
      if (mounted) showMsg(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(28),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Image.asset('assets/images/logo.png', height: 140),
                  const SizedBox(height: 28),
                  Text(
                    _signUp ? 'إنشاء حساب' : 'أهلاً فيك',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontFamily: 'ArefRuqaa',
                      fontSize: 32,
                      fontWeight: FontWeight.w700,
                      color: GH.burgundy,
                    ),
                  ),
                  const SizedBox(height: 20),
                  TextField(
                    controller: _email,
                    keyboardType: TextInputType.emailAddress,
                    textDirection: TextDirection.ltr,
                    autocorrect: false,
                    decoration: const InputDecoration(labelText: 'الإيميل'),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _password,
                    obscureText: true,
                    textDirection: TextDirection.ltr,
                    decoration: const InputDecoration(labelText: 'كلمة المرور'),
                    onSubmitted: (_) => _submit(),
                  ),
                  const SizedBox(height: 20),
                  FilledButton(
                    onPressed: _busy ? null : _submit,
                    child: _busy
                        ? const SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(
                                strokeWidth: 2, color: Colors.white))
                        : Text(_signUp ? 'إنشاء الحساب' : 'دخول'),
                  ),
                  const SizedBox(height: 8),
                  TextButton(
                    onPressed: _busy
                        ? null
                        : () => setState(() => _signUp = !_signUp),
                    child: Text(_signUp
                        ? 'عندي حساب، أبي أسجّل دخول'
                        : 'أول مرة؟ أنشئ حساب'),
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
