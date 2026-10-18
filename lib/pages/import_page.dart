import 'package:flutter/cupertino.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../config.dart';
import '../data/api.dart';
import '../data/store.dart';
import '../ui/colors.dart';
import '../ui/kit.dart';

bool _legacyReady = false;

Future<SupabaseClient> _legacy() async {
  if (!_legacyReady) {
    await Supabase.initialize(
      url: AppConfig.legacySupabaseUrl,
      anonKey: AppConfig.legacySupabaseKey,
    );
    _legacyReady = true;
  }
  return Supabase.instance.client;
}

/// Copies customers, orders, payments, trips, expenses, purchase invoices and
/// company details from the old app database to ghshopper.com. Safe to run
/// again: nothing is duplicated.
class ImportPage extends StatefulWidget {
  const ImportPage({super.key});

  @override
  State<ImportPage> createState() => _ImportPageState();
}

class _ImportPageState extends State<ImportPage> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  bool _needsLogin = false;
  String? _result;

  @override
  void initState() {
    super.initState();
    _legacy().then((db) {
      if (mounted) setState(() => _needsLogin = db.auth.currentSession == null);
    }).catchError((_) {
      if (mounted) setState(() => _needsLogin = true);
    });
  }

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _run() async {
    setState(() {
      _busy = true;
      _result = null;
    });
    try {
      final db = await _legacy();
      if (db.auth.currentSession == null) {
        await db.auth.signInWithPassword(
            email: _email.text.trim(), password: _password.text);
      }
      final r = await Future.wait<dynamic>([
        db.from('gh_customers').select(),
        db.from('gh_orders').select(),
        db.from('gh_order_items').select(),
        db.from('gh_payments').select(),
        db.from('gh_trips').select(),
        db.from('gh_trip_expenses').select(),
        db.from('gh_purchase_invoices').select(),
        db.from('gh_settings').select().maybeSingle(),
      ]);
      final res = await Api.i.post('/ps/import', {
        'customers': r[0],
        'orders': r[1],
        'items': r[2],
        'payments': r[3],
        'trips': r[4],
        'expenses': r[5],
        'invoices': r[6],
        'settings': r[7],
      });
      final c = Map<String, dynamic>.from((res as Map)['counts'] as Map);
      await Store.i.refresh();
      setState(() => _result =
          'تم ✓  ${c['customers']} عميل · ${c['orders']} طلب · ${c['items']} قطعة · ${c['payments']} دفعة · ${c['trips']} رحلة');
    } on AuthException {
      if (mounted) toast(context, 'الإيميل أو كلمة المرور القديمة غلط', error: true);
    } catch (e) {
      if (mounted) toast(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return GHPage(
      title: 'نقل البيانات القديمة',
      previousPageTitle: 'المزيد',
      children: [
        Section(
          footer:
              'ينسخ العملاء والطلبات والقطع والدفعات والرحلات والمصاريف وفواتير الشراء وبيانات الشركة من النظام القديم إلى ghshopper.com. تقدر تعيده بأمان، ما يتكرر شي.',
          children: [
            if (_needsLogin) ...[
              FieldRow(
                  label: 'الإيميل القديم',
                  controller: _email,
                  keyboard: TextInputType.emailAddress,
                  ltr: true),
              FieldRow(label: 'كلمة المرور', controller: _password, ltr: true),
            ],
          ],
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
          child: PrimaryButton('انقل البيانات',
              icon: CupertinoIcons.arrow_down_doc_fill,
              busy: _busy,
              onPressed: _run),
        ),
        if (_result != null)
          Padding(
            padding: const EdgeInsets.all(24),
            child: Text(_result!,
                textAlign: TextAlign.center,
                style: const TextStyle(
                    fontSize: 16, fontWeight: FontWeight.w600, color: GH.green)),
          ),
      ],
    );
  }
}
