import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../format.dart';
import '../models.dart';
import '../repo.dart';
import '../theme.dart';
import '../widgets.dart';

enum _Period { month, lastMonth, all }

class SummaryScreen extends StatefulWidget {
  const SummaryScreen({super.key});

  @override
  State<SummaryScreen> createState() => _SummaryScreenState();
}

class _SummaryScreenState extends State<SummaryScreen> {
  late Future<List<Order>> _future;
  _Period _period = _Period.month;

  @override
  void initState() {
    super.initState();
    _future = Repo.orders();
  }

  Future<void> _reload() async {
    final f = Repo.orders();
    setState(() => _future = f);
    await f;
  }

  bool _inPeriod(Order o) {
    final d = o.createdAt?.toLocal();
    if (d == null) return _period == _Period.all;
    final now = DateTime.now();
    switch (_period) {
      case _Period.month:
        return d.year == now.year && d.month == now.month;
      case _Period.lastMonth:
        final lm = DateTime(now.year, now.month - 1);
        return d.year == lm.year && d.month == lm.month;
      case _Period.all:
        return true;
    }
  }

  Future<void> _logout() async {
    if (!await confirm(context, 'تسجيل خروج؟', ok: 'خروج', danger: false)) {
      return;
    }
    await Supabase.instance.client.auth.signOut();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('الملخص'),
        actions: [
          IconButton(
              tooltip: 'تسجيل خروج',
              onPressed: _logout,
              icon: const Icon(Icons.logout)),
        ],
      ),
      body: FutureBuilder<List<Order>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return ErrorRetry(error: snap.error!, onRetry: _reload);
          }
          final allOrders = snap.data ?? const <Order>[];
          final orders = allOrders.where(_inPeriod).toList();

          final sales = orders.fold<double>(0, (s, o) => s + o.itemsTotal);
          final delivery = orders.fold<double>(0, (s, o) => s + o.deliveryFee);
          final collected = orders.fold<double>(0, (s, o) => s + o.paid);
          final costed = orders
              .expand((o) => o.activeItems)
              .where((i) => i.costOmr != null)
              .toList();
          final cost = costed.fold<double>(0, (s, i) => s + i.costOmr!);
          final costedSales = costed.fold<double>(0, (s, i) => s + i.price);

          // Workload is always across all orders, not just the period.
          final items = allOrders.expand((o) => o.activeItems).toList();
          int count(ItemStatus s) => items.where((i) => i.status == s).length;
          final owed = allOrders.fold<double>(
              0, (s, o) => s + (o.remaining > 0 ? o.remaining : 0));

          return RefreshIndicator(
            onRefresh: _reload,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
              children: [
                SegmentedButton<_Period>(
                  segments: const [
                    ButtonSegment(value: _Period.month, label: Text('هذا الشهر')),
                    ButtonSegment(
                        value: _Period.lastMonth, label: Text('الشهر الماضي')),
                    ButtonSegment(value: _Period.all, label: Text('الكل')),
                  ],
                  selected: {_period},
                  onSelectionChanged: (s) => setState(() => _period = s.first),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    Expanded(
                        child: _Stat(
                            label: 'المبيعات', value: omr(sales), big: true)),
                    const SizedBox(width: 10),
                    Expanded(
                        child: _Stat(
                            label: 'الطلبات', value: '${orders.length}', big: true)),
                  ],
                ),
                const SizedBox(height: 10),
                GhCard(
                  child: Column(
                    children: [
                      KeyValue('مبيعات القطع', omr(sales)),
                      KeyValue('رسوم التوصيل', omr(delivery)),
                      KeyValue('المحصّل', omr(collected), color: GH.green),
                      const Divider(height: 20),
                      KeyValue('تكلفة القطع المشتراة', omr(cost)),
                      KeyValue('ربح القطع المسجّل تكلفتها',
                          omr(costedSales - cost),
                          strong: true, color: GH.burgundy),
                      if (costed.length <
                          orders.expand((o) => o.activeItems).length)
                        const Padding(
                          padding: EdgeInsets.only(top: 6),
                          child: Text(
                            'الربح محسوب للقطع اللي مربوطة بفاتورة شراء فقط.',
                            style: TextStyle(color: GH.muted, fontSize: 12),
                          ),
                        ),
                    ],
                  ),
                ),
                const SectionTitle('الشغل الحالي'),
                GhCard(
                  child: Column(
                    children: [
                      _statusLine(ItemStatus.requested, count(ItemStatus.requested)),
                      _statusLine(ItemStatus.purchased, count(ItemStatus.purchased)),
                      _statusLine(ItemStatus.arrived, count(ItemStatus.arrived)),
                      const Divider(height: 20),
                      KeyValue('مبالغ متبقية عند العملاء', omr(owed),
                          strong: true,
                          color: owed > 0.0005 ? GH.red : GH.green),
                    ],
                  ),
                ),
                const SizedBox(height: 24),
                Center(
                  child: Text(
                    Supabase.instance.client.auth.currentUser?.email ?? '',
                    style: const TextStyle(color: GH.muted, fontSize: 12),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _statusLine(ItemStatus s, int n) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(color: s.color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 10),
          Expanded(child: Text('قطع ${s.label}')),
          Text('$n',
              style: const TextStyle(
                  fontWeight: FontWeight.w700, fontSize: 16, color: GH.ink)),
        ],
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value, this.big = false});

  final String label;
  final String value;
  final bool big;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: GH.burgundy,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: GH.sand, fontSize: 13)),
          const SizedBox(height: 4),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: AlignmentDirectional.centerStart,
            child: Text(
              value,
              style: TextStyle(
                color: Colors.white,
                fontSize: big ? 22 : 16,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
