import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'config.dart';
import 'data/lock.dart';
import 'data/rates.dart';
import 'data/store.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'pages/driver_home.dart';
import 'pages/login_page.dart';
import 'pages/tabs.dart';
import 'ui/colors.dart';
import 'ui/kit.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  await Supabase.initialize(
    url: AppConfig.supabaseUrl,
    anonKey: AppConfig.supabaseAnonKey,
  );
  Rates.i.load();
  runApp(const GhApp());
}

class GhApp extends StatelessWidget {
  const GhApp({super.key});

  @override
  Widget build(BuildContext context) {
    return const CupertinoApp(
      title: 'GH Shopper',
      debugShowCheckedModeBanner: false,
      theme: CupertinoThemeData(
        brightness: Brightness.light,
        primaryColor: GH.burgundy,
        scaffoldBackgroundColor: GH.bg,
        barBackgroundColor: Color(0xF0F9F9F9),
      ),
      locale: Locale('ar'),
      supportedLocales: [Locale('ar'), Locale('en')],
      localizationsDelegates: [
        GlobalCupertinoLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ],
      home: AuthGate(),
    );
  }
}

class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = Supabase.instance.client.auth;
    return StreamBuilder<AuthState>(
      stream: auth.onAuthStateChange,
      builder: (context, snapshot) {
        if (auth.currentSession == null) {
          if (Store.i.ready) {
            WidgetsBinding.instance
                .addPostFrameCallback((_) => Store.i.clear());
          }
          return const LoginPage();
        }
        final uid = auth.currentUser!.id;
        return RoleGate(key: ValueKey(uid), userId: uid);
      },
    );
  }
}

/// Sends drivers to their delivery list and the owner to the full app.
/// The role is cached on the phone so the app opens instantly next time.
class RoleGate extends StatefulWidget {
  const RoleGate({super.key, required this.userId});

  final String userId;

  @override
  State<RoleGate> createState() => _RoleGateState();
}

class _RoleGateState extends State<RoleGate> {
  // null = unknown yet, '' = owner, otherwise the driver's name
  String? _role;
  Object? _error;

  String get _key => 'gh_role:${widget.userId}';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    SharedPreferences? prefs;
    try {
      prefs = await SharedPreferences.getInstance();
      final cached = prefs.getString(_key);
      if (cached != null && mounted) setState(() => _role = cached);
    } catch (_) {}
    try {
      final me = await Supabase.instance.client.rpc('gh_driver_me');
      final role = me is Map ? (me['name'] ?? 'مندوب').toString() : '';
      prefs?.setString(_key, role);
      if (mounted) setState(() => _role = role);
    } catch (e) {
      if (mounted && _role == null) setState(() => _error = e);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_role == null) {
      return CupertinoPageScaffold(
        backgroundColor: GH.bg,
        child: Center(
          child: _error == null
              ? const CupertinoActivityIndicator()
              : Column(mainAxisSize: MainAxisSize.min, children: [
                  Text(errorText(_error!), style: T.sub),
                  CupertinoButton(
                    onPressed: () {
                      setState(() => _error = null);
                      _load();
                    },
                    child: const Text('حاول مرة ثانية'),
                  ),
                ]),
        ),
      );
    }
    if (_role!.isEmpty) return const LockGate(child: Tabs());
    return LockGate(child: DriverHome(name: _role!));
  }
}

/// Asks for Face ID before showing the app, when the lock is turned on.
class LockGate extends StatefulWidget {
  const LockGate({super.key, required this.child});

  final Widget child;

  @override
  State<LockGate> createState() => _LockGateState();
}

class _LockGateState extends State<LockGate> with WidgetsBindingObserver {
  bool? _locked;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _check();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused) {
      AppLock.i.isEnabled().then((on) {
        if (on && mounted) setState(() => _locked = true);
      });
    }
  }

  Future<void> _check() async {
    final on = await AppLock.i.isEnabled();
    if (!mounted) return;
    setState(() => _locked = on);
    if (on) _unlock();
  }

  Future<void> _unlock() async {
    final ok = await AppLock.i.unlock();
    if (ok && mounted) setState(() => _locked = false);
  }

  @override
  Widget build(BuildContext context) {
    if (_locked == null) {
      return const CupertinoPageScaffold(child: SizedBox.shrink());
    }
    return Stack(
      children: [
        widget.child,
        if (_locked!)
          CupertinoPageScaffold(
            backgroundColor: GH.bg,
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Image.asset('assets/images/logo.png', height: 110),
                  const SizedBox(height: 28),
                  SizedBox(
                    width: 240,
                    child: PrimaryButton('افتح بالـ Face ID',
                        icon: CupertinoIcons.lock_open, onPressed: _unlock),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}
