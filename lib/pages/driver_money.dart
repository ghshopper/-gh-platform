import 'package:flutter/cupertino.dart';

import '../data/api.dart';
import '../format.dart';
import '../models.dart';
import '../ui/colors.dart';
import '../ui/kit.dart';

double _d(dynamic v) => double.tryParse('${v ?? ''}') ?? 0;

/// A driver's money with us (from the server).
class DriverAccount {
  DriverAccount(this.m);

  final Map<String, dynamic> m;

  double get rate => _d(m['pay_per_delivery']);
  int get deliveries => int.tryParse('${m['deliveries'] ?? 0}') ?? 0;
  int get monthDeliveries => int.tryParse('${m['month_deliveries'] ?? 0}') ?? 0;
  double get monthEarned => _d(m['month_earned']);
  double get collected => _d(m['collected']);
  double get handed => _d(m['handed']);
  double get cash => _d(m['cash_with_driver']);
  double get earned => _d(m['earned']);
  double get paid => _d(m['paid']);
  double get owed => _d(m['owed_to_driver']);

  /// > 0: the driver hands this to us · < 0: we transfer it to him.
  double get net => _d(m['net']);

  List<DriverEntry> get entries => ((m['entries'] as List?) ?? const [])
      .whereType<Map>()
      .map((e) => DriverEntry(Map<String, dynamic>.from(e)))
      .toList();

  List<PastDelivery> get recent => ((m['recent'] as List?) ?? const [])
      .whereType<Map>()
      .map((e) => PastDelivery(Map<String, dynamic>.from(e)))
      .toList();
}

class DriverEntry {
  DriverEntry(this.m);
  final Map<String, dynamic> m;
  String get id => '${m['id']}';
  bool get isHandover => m['type'] == 'handover';
  double get amount => _d(m['amount']);
  String? get note => (m['note'] ?? '').toString().trim().isEmpty ? null : m['note'].toString();
  DateTime? get date => DateTime.tryParse('${m['on_date'] ?? ''}');
}

class PastDelivery {
  PastDelivery(this.m);
  final Map<String, dynamic> m;
  String get id => '${m['id']}';
  String get customer => (m['customer_name'] ?? '').toString();
  String? get city => m['customer_city']?.toString();
  DateTime? get at => DateTime.tryParse('${m['delivered_at'] ?? ''}')?.toLocal();
  double get collected => _d(m['collected']);
  double get pay => _d(m['pay']);
  String get invoiceNo {
    final n = int.tryParse('${m['order_no'] ?? 0}') ?? 0;
    return invoiceNumber(n, DateTime.tryParse('${m['created_at'] ?? ''}'));
  }
}

// ───────────────────────── Shared pieces ─────────────────────────

/// The big money card: who owes whom.
class DriverBalanceCard extends StatelessWidget {
  const DriverBalanceCard(this.a, {super.key, this.forDriver = true});

  final DriverAccount a;

  /// Wording for the driver ("you") or for the admin ("he").
  final bool forDriver;

  @override
  Widget build(BuildContext context) {
    final net = a.net;
    final settled = net.abs() < 0.0005;
    final title = settled
        ? 'الحساب صافي ✓'
        : net > 0
            ? (forDriver ? 'سلّم لنا' : 'يسلّم لنا')
            : (forDriver ? 'بنحوّل لك' : 'نحوّل له');
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
      child: Container(
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          gradient: GH.brandGradient,
          borderRadius: BorderRadius.circular(22),
          boxShadow: [BoxShadow(color: GH.burgundyDeep.withAlpha(70), blurRadius: 22, offset: const Offset(0, 10))],
        ),
        child: Stack(children: [
          PositionedDirectional(
            end: -24,
            bottom: 8,
            child: Opacity(opacity: .2, child: Image.asset('assets/images/story_cheetah_light.png', width: 170)),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 18, 18, 18),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(title, style: const TextStyle(fontSize: 14, color: GH.goldLight, fontWeight: FontWeight.w500)),
              const SizedBox(height: 4),
              Text(settled ? omr(0) : omr(net.abs()),
                  style: T.big.copyWith(color: CupertinoColors.white, fontSize: 30)),
              const SizedBox(height: 14),
              Row(children: [
                Expanded(
                  child: _Mini(forDriver ? 'كاش عندك لنا' : 'كاش عنده لنا', omr(a.cash),
                      forDriver ? 'حصّلته من العملاء ولسا ما سلّمته' : 'حصّله من العملاء ولسا ما سلّمه'),
                ),
                Container(width: 1, height: 44, color: const Color(0x33FFFFFF), margin: const EdgeInsets.symmetric(horizontal: 12)),
                Expanded(
                  child: _Mini(forDriver ? 'لك عندنا' : 'له عندنا', omr(a.owed),
                      a.rate > 0 ? '${omr(a.rate)} لكل توصيلة' : 'أجرة التوصيل'),
                ),
              ]),
            ]),
          ),
        ]),
      ),
    );
  }
}

class _Mini extends StatelessWidget {
  const _Mini(this.label, this.value, this.hint);
  final String label;
  final String value;
  final String hint;

  @override
  Widget build(BuildContext context) => Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(label, style: const TextStyle(fontSize: 12.5, color: GH.goldLight)),
        const SizedBox(height: 2),
        FittedBox(
          fit: BoxFit.scaleDown,
          alignment: AlignmentDirectional.centerStart,
          child: Text(value, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: CupertinoColors.white)),
        ),
        Text(hint, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 11, color: Color(0xB3FFFFFF))),
      ]);
}

class DriverEntryTile extends StatelessWidget {
  const DriverEntryTile(this.e, {super.key, this.forDriver = true, this.onDelete});

  final DriverEntry e;
  final bool forDriver;
  final VoidCallback? onDelete;

  @override
  Widget build(BuildContext context) => Tile(
        leading: IconBox(e.isHandover ? CupertinoIcons.arrow_up_circle_fill : CupertinoIcons.arrow_down_circle_fill,
            color: e.isHandover ? GH.green : GH.blue),
        title: e.isHandover
            ? (forDriver ? 'سلّمت لنا كاش' : 'استلمنا منه كاش')
            : (forDriver ? 'حوّلنا لك' : 'حوّلنا له'),
        subtitle: [dateStr(e.date), if (e.note != null) e.note!].join(' · '),
        value: omr(e.amount),
        valueStyle: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: e.isHandover ? GH.green : GH.blue),
        chevron: false,
        onTap: onDelete,
      );
}

class PastDeliveryTile extends StatelessWidget {
  const PastDeliveryTile(this.d, {super.key, this.onTap});

  final PastDelivery d;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Tile(
        leading: Avatar(d.customer, size: 34),
        title: d.customer,
        subtitle: [
          dateStr(d.at),
          if (d.city != null && d.city!.isNotEmpty) d.city!,
          if (d.collected > 0) 'حصّل ${omr(d.collected)}',
        ].join(' · '),
        value: d.pay > 0 ? '+${omr(d.pay)}' : null,
        valueStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: GH.green),
        onTap: onTap,
        chevron: onTap != null,
      );
}

// ───────────────────────── Admin: a driver's money ─────────────────────────

/// On the driver's page in the admin app: balance, pay per delivery, record
/// cash he handed over or money we transferred.
class AdminDriverMoney extends StatefulWidget {
  const AdminDriverMoney({super.key, required this.driverId, required this.name, this.initial});

  final String driverId;
  final String name;

  /// Ready account (screenshots); nothing is loaded then.
  final DriverAccount? initial;

  @override
  State<AdminDriverMoney> createState() => _AdminDriverMoneyState();
}

class _AdminDriverMoneyState extends State<AdminDriverMoney> {
  DriverAccount? _a;
  String? _error;

  @override
  void initState() {
    super.initState();
    _a = widget.initial;
    if (_a == null) _load();
  }

  Future<void> _load() async {
    try {
      final res = await Api.i.get('/ps/drivers/${widget.driverId}/account');
      if (mounted) setState(() => _a = DriverAccount(Map<String, dynamic>.from(res as Map)));
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    }
  }

  Future<void> _entry(String type) async {
    final a = _a;
    final amount = TextEditingController(
        text: a == null
            ? ''
            : type == 'handover'
                ? (a.cash > 0 ? a.cash.toStringAsFixed(3) : '')
                : (a.owed > 0 ? a.owed.toStringAsFixed(3) : ''));
    final note = TextEditingController();
    final ok = await presentForm<bool>(
      context,
      GHPage(
        title: type == 'handover' ? 'استلمت منه كاش' : 'حوّلت له',
        leading: Builder(builder: (c) => NavButton('إلغاء', onPressed: () => Navigator.pop(c, false))),
        trailing: Builder(builder: (c) => NavButton('حفظ', bold: true, onPressed: () => Navigator.pop(c, true))),
        children: [
          Section(
            footer: type == 'handover'
                ? 'الكاش اللي حصّله من العملاء وسلّمه لك.'
                : 'أجرة التوصيل اللي حوّلتها له.',
            children: [
              AmountRow(label: 'المبلغ', controller: amount, autofocus: true),
              FieldRow(label: 'ملاحظة', controller: note, placeholder: 'اختياري'),
            ],
          ),
        ],
      ),
    );
    if (ok != true) return;
    final v = double.tryParse(normalizeDigits(amount.text).replaceAll(',', '.'));
    if (v == null || v <= 0) {
      if (mounted) toast(context, 'اكتب المبلغ', error: true);
      return;
    }
    try {
      final res = await Api.i.post('/ps/drivers/${widget.driverId}/entries',
          {'type': type, 'amount': v, if (note.text.trim().isNotEmpty) 'note': note.text.trim()});
      if (mounted) {
        setState(() => _a = DriverAccount(Map<String, dynamic>.from(res as Map)));
        toast(context, 'انحفظ ✓');
      }
    } catch (e) {
      if (mounted) toast(context, errorText(e), error: true);
    }
  }

  Future<void> _rate() async {
    final c = TextEditingController(text: (_a?.rate ?? 0) > 0 ? _a!.rate.toStringAsFixed(3) : '');
    final ok = await presentForm<bool>(
      context,
      GHPage(
        title: 'أجرة التوصيلة',
        leading: Builder(builder: (x) => NavButton('إلغاء', onPressed: () => Navigator.pop(x, false))),
        trailing: Builder(builder: (x) => NavButton('حفظ', bold: true, onPressed: () => Navigator.pop(x, true))),
        children: [
          Section(
            footer: 'تنحسب له مع كل توصيلة يسلّمها من الحين. التوصيلات القديمة تبقى على أجرتها.',
            children: [AmountRow(label: 'لكل توصيلة', controller: c, autofocus: true)],
          ),
        ],
      ),
    );
    if (ok != true) return;
    final v = double.tryParse(normalizeDigits(c.text).replaceAll(',', '.')) ?? 0;
    try {
      await Api.i.put('/ps/drivers/${widget.driverId}', {'pay_per_delivery': v});
      await _load();
    } catch (e) {
      if (mounted) toast(context, errorText(e), error: true);
    }
  }

  Future<void> _delete(DriverEntry e) async {
    if (!await confirm(context, 'حذف هذا القيد؟', message: '${omr(e.amount)} · ${dateStr(e.date)}')) return;
    try {
      final res = await Api.i.delete('/ps/drivers/${widget.driverId}/entries/${e.id}');
      if (mounted) setState(() => _a = DriverAccount(Map<String, dynamic>.from(res as Map)));
    } catch (err) {
      if (mounted) toast(context, errorText(err), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = _a;
    if (a == null) {
      return _error == null
          ? const Loading()
          : Section(children: [Tile(title: 'ما قدرنا نجيب الحساب', subtitle: _error, onTap: _load)]);
    }
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      DriverBalanceCard(a, forDriver: false),
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
        child: Row(children: [
          Expanded(child: SecondaryButton('استلمت منه', icon: CupertinoIcons.arrow_up_circle, onPressed: () => _entry('handover'))),
          const SizedBox(width: 10),
          Expanded(child: SecondaryButton('حوّلت له', icon: CupertinoIcons.arrow_down_circle, onPressed: () => _entry('payout'))),
        ]),
      ),
      Section(header: 'الحساب', children: [
        Tile(
          leading: const IconBox(CupertinoIcons.money_dollar, color: GH.gold),
          title: 'أجرة التوصيلة',
          value: a.rate > 0 ? omr(a.rate) : 'حدّدها',
          onTap: _rate,
        ),
        KV('توصيلات هالشهر', '${a.monthDeliveries}'),
        KV('أجرته هالشهر', omr(a.monthEarned)),
        KV('كل اللي حصّله من العملاء', omr(a.collected)),
        KV('سلّمه لنا', omr(a.handed)),
        KV('كل أجرته', omr(a.earned)),
        KV('حوّلنا له', omr(a.paid)),
      ]),
      if (a.entries.isNotEmpty)
        Section(
          header: 'التسليم والتحويلات',
          footer: 'اضغط على قيد عشان تحذفه.',
          children: a.entries.map((e) => DriverEntryTile(e, forDriver: false, onDelete: () => _delete(e))).toList(),
        ),
    ]);
  }
}
