import 'package:flutter/material.dart';

import '../format.dart';
import '../models.dart';
import '../repo.dart';
import '../theme.dart';
import '../widgets.dart';
import 'order_detail_screen.dart';
import 'order_form_screen.dart';

enum _Filter { all, requested, purchased, arrived, delivered, balance }

extension on _Filter {
  String get label {
    switch (this) {
      case _Filter.all:
        return 'الكل';
      case _Filter.requested:
        return 'بانتظار الشراء';
      case _Filter.purchased:
        return 'تم الشراء';
      case _Filter.arrived:
        return 'وصلت';
      case _Filter.delivered:
        return 'تم التسليم';
      case _Filter.balance:
        return 'عليها مبلغ';
    }
  }
}

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  late Future<List<Order>> _future;
  _Filter _filter = _Filter.all;
  String _query = '';

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

  bool _matches(Order o) {
    final q = _query.trim();
    if (q.isNotEmpty) {
      final hay =
          '${o.customerName} ${o.invoiceNo} ${o.items.map((i) => i.name).join(' ')}'
              .toLowerCase();
      if (!hay.contains(q.toLowerCase())) return false;
    }
    switch (_filter) {
      case _Filter.all:
        return true;
      case _Filter.requested:
        return o.overallStatus == ItemStatus.requested;
      case _Filter.purchased:
        return o.overallStatus == ItemStatus.purchased;
      case _Filter.arrived:
        return o.overallStatus == ItemStatus.arrived;
      case _Filter.delivered:
        return o.overallStatus == ItemStatus.delivered;
      case _Filter.balance:
        return o.hasBalance;
    }
  }

  Future<void> _open(Order o) async {
    await Navigator.push(context,
        MaterialPageRoute(builder: (_) => OrderDetailScreen(orderId: o.id)));
    _reload();
  }

  Future<void> _create() async {
    final id = await Navigator.push<String>(
        context, MaterialPageRoute(builder: (_) => const OrderFormScreen()));
    await _reload();
    if (id != null && mounted) {
      await Navigator.push(context,
          MaterialPageRoute(builder: (_) => OrderDetailScreen(orderId: id)));
      _reload();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('الطلبات')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _create,
        icon: const Icon(Icons.add),
        label: const Text('طلب جديد'),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
            child: TextField(
              decoration: const InputDecoration(
                hintText: 'ابحث باسم العميلة أو القطعة أو رقم الفاتورة',
                prefixIcon: Icon(Icons.search),
              ),
              onChanged: (v) => setState(() => _query = v),
            ),
          ),
          SizedBox(
            height: 44,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              children: _Filter.values
                  .map((f) => Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 4),
                        child: ChoiceChip(
                          label: Text(f.label),
                          selected: _filter == f,
                          selectedColor: GH.sand,
                          onSelected: (_) => setState(() => _filter = f),
                        ),
                      ))
                  .toList(),
            ),
          ),
          Expanded(
            child: FutureBuilder<List<Order>>(
              future: _future,
              builder: (context, snap) {
                if (snap.connectionState != ConnectionState.done) {
                  return const Center(child: CircularProgressIndicator());
                }
                if (snap.hasError) {
                  return ErrorRetry(error: snap.error!, onRetry: _reload);
                }
                final all = snap.data ?? const <Order>[];
                final list = all.where(_matches).toList();
                if (all.isEmpty) {
                  return const EmptyState(
                      icon: Icons.receipt_long,
                      text: 'ما في طلبات للحين.\nاضغط «طلب جديد» عشان تبدأ.');
                }
                return RefreshIndicator(
                  onRefresh: _reload,
                  child: list.isEmpty
                      ? ListView(children: const [
                          SizedBox(height: 80),
                          EmptyState(
                              icon: Icons.search_off,
                              text: 'ما في نتائج بهذا البحث'),
                        ])
                      : ListView.separated(
                          padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
                          itemCount: list.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 10),
                          itemBuilder: (_, i) =>
                              OrderCard(order: list[i], onTap: () => _open(list[i])),
                        ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class OrderCard extends StatelessWidget {
  const OrderCard({super.key, required this.order, this.onTap});

  final Order order;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final o = order;
    final st = o.overallStatus;
    return GhCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(o.customerName,
                    style: const TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w700,
                        color: GH.ink)),
              ),
              StatusPill(label: st.label, color: st.color),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            '${o.invoiceNo} · ${dateStr(o.createdAt)} · ${o.activeItems.length} قطعة',
            style: const TextStyle(color: GH.muted, fontSize: 13),
          ),
          if (o.activeItems.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              o.activeItems.map((i) => i.name).join('، '),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(color: GH.ink, fontSize: 14),
            ),
          ],
          const SizedBox(height: 8),
          Row(
            children: [
              Text('المجموع ${omr(o.total)}',
                  style: const TextStyle(
                      fontWeight: FontWeight.w700, color: GH.burgundy)),
              const Spacer(),
              Text(
                o.hasBalance ? 'المتبقي ${omr(o.remaining)}' : 'مدفوع بالكامل',
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  color: o.hasBalance ? GH.red : GH.green,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
