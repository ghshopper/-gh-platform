import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../format.dart';
import '../models.dart';
import '../repo.dart';
import '../theme.dart';
import '../widgets.dart';
import 'customer_form_screen.dart';
import 'order_detail_screen.dart';
import 'order_form_screen.dart';
import 'orders_screen.dart';

class CustomersScreen extends StatefulWidget {
  const CustomersScreen({super.key});

  @override
  State<CustomersScreen> createState() => _CustomersScreenState();
}

class _CustomersScreenState extends State<CustomersScreen> {
  late Future<List<Customer>> _future;
  String _query = '';

  @override
  void initState() {
    super.initState();
    _future = Repo.customers();
  }

  Future<void> _reload() async {
    final f = Repo.customers();
    setState(() => _future = f);
    await f;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('العملاء')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          await Navigator.push(context,
              MaterialPageRoute(builder: (_) => const CustomerFormScreen()));
          _reload();
        },
        icon: const Icon(Icons.person_add_alt_1),
        label: const Text('عميلة جديدة'),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
            child: TextField(
              decoration: const InputDecoration(
                hintText: 'ابحث بالاسم أو الرقم',
                prefixIcon: Icon(Icons.search),
              ),
              onChanged: (v) => setState(() => _query = v),
            ),
          ),
          Expanded(
            child: FutureBuilder<List<Customer>>(
              future: _future,
              builder: (context, snap) {
                if (snap.connectionState != ConnectionState.done) {
                  return const Center(child: CircularProgressIndicator());
                }
                if (snap.hasError) {
                  return ErrorRetry(error: snap.error!, onRetry: _reload);
                }
                final all = snap.data ?? const <Customer>[];
                if (all.isEmpty) {
                  return const EmptyState(
                      icon: Icons.people, text: 'ما في عملاء للحين');
                }
                final q = normalizeDigits(_query).toLowerCase();
                final list = all
                    .where((c) =>
                        q.isEmpty ||
                        c.name.toLowerCase().contains(q) ||
                        normalizeDigits(c.phone ?? '').contains(q))
                    .toList();
                return RefreshIndicator(
                  onRefresh: _reload,
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
                    itemCount: list.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (_, i) {
                      final c = list[i];
                      return GhCard(
                        onTap: () async {
                          await Navigator.push(
                              context,
                              MaterialPageRoute(
                                  builder: (_) =>
                                      CustomerDetailScreen(customer: c)));
                          _reload();
                        },
                        child: Row(
                          children: [
                            CircleAvatar(
                              backgroundColor: GH.sand,
                              foregroundColor: GH.burgundy,
                              child: Text(c.name.isEmpty ? '?' : c.name[0]),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(c.name,
                                      style: const TextStyle(
                                          fontSize: 16,
                                          fontWeight: FontWeight.w700)),
                                  if (c.phone != null || c.city != null)
                                    Text(
                                      [c.phone, c.city]
                                          .whereType<String>()
                                          .join(' · '),
                                      style: const TextStyle(color: GH.muted),
                                    ),
                                ],
                              ),
                            ),
                            const Icon(Icons.chevron_left, color: GH.muted),
                          ],
                        ),
                      );
                    },
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

class CustomerDetailScreen extends StatefulWidget {
  const CustomerDetailScreen({super.key, required this.customer});

  final Customer customer;

  @override
  State<CustomerDetailScreen> createState() => _CustomerDetailScreenState();
}

class _CustomerDetailScreenState extends State<CustomerDetailScreen> {
  late Customer _c = widget.customer;
  late Future<List<Order>> _future;

  @override
  void initState() {
    super.initState();
    _future = Repo.orders(customerId: _c.id);
  }

  Future<void> _reload() async {
    final f = Repo.orders(customerId: _c.id);
    setState(() => _future = f);
    await f;
  }

  Future<void> _edit() async {
    final c = await Navigator.push<Customer>(context,
        MaterialPageRoute(builder: (_) => CustomerFormScreen(customer: _c)));
    if (c != null) setState(() => _c = c);
  }

  Future<void> _delete(int orderCount) async {
    if (orderCount > 0) {
      showMsg(context, 'ما تقدر تحذفها وعندها طلبات. احذف الطلبات أول.',
          error: true);
      return;
    }
    if (!await confirm(context, 'حذف ${_c.name}؟')) return;
    try {
      await Repo.deleteCustomer(_c.id);
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) showMsg(context, errorText(e), error: true);
    }
  }

  Future<void> _whatsapp() async {
    final p = waPhone(_c.phone);
    if (p == null) {
      showMsg(context, 'ما في رقم لهذي العميلة', error: true);
      return;
    }
    await launchUrl(Uri.parse('https://wa.me/$p'),
        mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<Order>>(
      future: _future,
      builder: (context, snap) {
        final orders = snap.data ?? const <Order>[];
        final total = orders.fold<double>(0, (s, o) => s + o.total);
        final remaining = orders.fold<double>(
            0, (s, o) => s + (o.remaining > 0 ? o.remaining : 0));
        return Scaffold(
          appBar: AppBar(
            title: Text(_c.name),
            actions: [
              IconButton(
                  tooltip: 'تعديل',
                  onPressed: _edit,
                  icon: const Icon(Icons.edit_outlined)),
              IconButton(
                  tooltip: 'حذف',
                  onPressed: () => _delete(orders.length),
                  icon: const Icon(Icons.delete_outline)),
            ],
          ),
          floatingActionButton: FloatingActionButton.extended(
            onPressed: () async {
              final id = await Navigator.push<String>(
                  context,
                  MaterialPageRoute(
                      builder: (_) => OrderFormScreen(customer: _c)));
              await _reload();
              if (id != null && mounted) {
                await Navigator.push(
                    context,
                    MaterialPageRoute(
                        builder: (_) => OrderDetailScreen(orderId: id)));
                _reload();
              }
            },
            icon: const Icon(Icons.add),
            label: const Text('طلب لها'),
          ),
          body: RefreshIndicator(
            onRefresh: _reload,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
              children: [
                GhCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (_c.phone != null)
                        Row(
                          children: [
                            Expanded(
                              child: Text(_c.phone!,
                                  textDirection: TextDirection.ltr,
                                  textAlign: TextAlign.right,
                                  style: const TextStyle(fontSize: 16)),
                            ),
                            OutlinedButton.icon(
                              onPressed: _whatsapp,
                              icon: const Icon(Icons.chat_outlined),
                              label: const Text('واتساب'),
                            ),
                          ],
                        ),
                      if (_c.city != null) KeyValue('المنطقة', _c.city!),
                      if (_c.notes != null) ...[
                        const SizedBox(height: 6),
                        Text(_c.notes!,
                            style: const TextStyle(color: GH.muted)),
                      ],
                      const Divider(height: 20),
                      KeyValue('عدد الطلبات', '${orders.length}'),
                      KeyValue('مجموع مشترياتها', omr(total)),
                      KeyValue('المتبقي عليها', omr(remaining),
                          strong: true,
                          color: remaining > 0.0005 ? GH.red : GH.green),
                    ],
                  ),
                ),
                const SectionTitle('طلباتها'),
                if (snap.connectionState != ConnectionState.done)
                  const Padding(
                    padding: EdgeInsets.all(24),
                    child: Center(child: CircularProgressIndicator()),
                  )
                else if (snap.hasError)
                  ErrorRetry(error: snap.error!, onRetry: _reload)
                else if (orders.isEmpty)
                  const EmptyState(
                      icon: Icons.receipt_long, text: 'ما عندها طلبات للحين')
                else
                  ...orders.map((o) => Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: OrderCard(
                          order: o,
                          onTap: () async {
                            await Navigator.push(
                                context,
                                MaterialPageRoute(
                                    builder: (_) =>
                                        OrderDetailScreen(orderId: o.id)));
                            _reload();
                          },
                        ),
                      )),
              ],
            ),
          ),
        );
      },
    );
  }
}
