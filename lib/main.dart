import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import 'data/api.dart';
import 'data/lock.dart';
import 'data/push.dart';
import 'data/rates.dart';
import 'data/store.dart';
import 'pages/driver_home.dart';
import 'pages/login_page.dart';
import 'pages/tabs.dart';
import 'ui/colors.dart';
import 'ui/kit.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  await Api.i.restore();
  Rates.i.load();
  runApp(const GhApp());
}

const ghFont = 'IBMPlexSansArabic';

/// The app's look: brand maroon, warm cream and the brand font everywhere.
/// No fixed brightness: Cupertino controls follow the phone's appearance and
/// the GH colours switch with [GH.dark].
const ghTheme = CupertinoThemeData(
  primaryColor: GH.burgundy,
  scaffoldBackgroundColor: GH.bg,
  barBackgroundColor: GH.bar,
  textTheme: CupertinoTextThemeData(
    primaryColor: GH.burgundy,
    textStyle: TextStyle(fontFamily: ghFont, fontSize: 16, color: GH.label),
    actionTextStyle: TextStyle(fontFamily: ghFont, fontSize: 16, color: GH.burgundy),
    tabLabelTextStyle: TextStyle(fontFamily: ghFont, fontSize: 10.5, fontWeight: FontWeight.w500),
    navTitleTextStyle: TextStyle(fontFamily: ghFont, fontSize: 17, fontWeight: FontWeight.w600, color: GH.label),
    navLargeTitleTextStyle: TextStyle(fontFamily: ghFont, fontSize: 31, fontWeight: FontWeight.w700, color: GH.label, letterSpacing: -0.4),
    navActionTextStyle: TextStyle(fontFamily: ghFont, fontSize: 16.5, color: GH.burgundy),
    pickerTextStyle: TextStyle(fontFamily: ghFont, fontSize: 21, color: GH.label),
    dateTimePickerTextStyle: TextStyle(fontFamily: ghFont, fontSize: 21, color: GH.label),
  ),
);

class GhApp extends StatefulWidget {
  const GhApp({super.key});

  @override
  State<GhApp> createState() => _GhAppState();
}

class _GhAppState extends State<GhApp> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  // Dark mode follows the system.
  @override
  void didChangePlatformBrightness() => setState(() {});

  @override
  Widget build(BuildContext context) {
    final dark = WidgetsBinding.instance.platformDispatcher.platformBrightness == Brightness.dark;
    GH.dark = dark;
    currentNavigator = navigatorKeys[dark]!;
    // The GH colours are constants that read GH.dark when painted, so the
    // whole tree is rebuilt (new key) when the appearance changes.
    return CupertinoApp(
      key: ValueKey(dark),
      navigatorKey: currentNavigator,
      title: 'GH Shopper',
      debugShowCheckedModeBanner: false,
      theme: ghTheme,
      locale: const Locale('ar'),
      supportedLocales: const [Locale('ar'), Locale('en')],
      localizationsDelegates: const [
        GlobalCupertinoLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
      ],
      home: const AuthGate(),
    );
  }
}

class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Api.i,
      builder: (context, _) {
        if (!Api.i.restored) {
          return const CupertinoPageScaffold(
            backgroundColor: GH.bg,
            child: Center(child: CupertinoActivityIndicator()),
          );
        }
        final session = Api.i.session;
        if (session == null) {
          if (Store.i.ready) {
            WidgetsBinding.instance
                .addPostFrameCallback((_) => Store.i.clear());
          }
          return const LoginPage();
        }
        if (session.isDriver) {
          return LockGate(
              key: ValueKey(session.token),
              child: DriverHome(name: session.name));
        }
        return LockGate(key: ValueKey(session.token), child: const Tabs());
      },
    );
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

  /// Unlocked since the app last went to the background. Survives the
  /// rebuild after a light/dark switch, so that doesn't ask for Face ID again.
  static bool _unlocked = false;

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
      _unlocked = false;
      AppLock.i.isEnabled().then((on) {
        if (on && mounted) setState(() => _locked = true);
      });
    }
  }

  Future<void> _check() async {
    final on = await AppLock.i.isEnabled() && !_unlocked;
    if (!mounted) return;
    setState(() => _locked = on);
    if (on) _unlock();
  }

  Future<void> _unlock() async {
    final ok = await AppLock.i.unlock();
    if (ok) _unlocked = true;
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
