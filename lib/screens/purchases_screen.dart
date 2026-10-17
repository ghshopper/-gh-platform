import 'package:flutter/material.dart';

import '../format.dart';
import '../models.dart';
import '../repo.dart';
import '../theme.dart';
import '../widgets.dart';
import 'purchase_form_screen.dart';

class PurchasesScreen extends StatefulWidget {
  const PurchasesScreen({super.key});

  @override
  State<PurchasesScreen> createState() => _PurchasesScreenState();
}

class _PurchasesScreenState extends State<PurchasesScreen> {
  late Future<List<PurchaseInvoice>> _future;

  @override
  void initState() {
    super.initState();
    _future = Repo.purchaseInvoices();
  }

  Future<void> _reload() async {
    final f = Repo.purchaseInvoices();
    setState(() => _future = f);
    await f;
  }

  Future<void> _open([PurchaseInvoice? inv]) async {
    await Navigator.push(context,
        MaterialPageRoute(builder: (_) => PurchaseFormScreen(invoice: inv)));
    _reload();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('فواتير الشراء')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _open(),
        icon: const Icon(Icons.add),
        label: const Text('فاتورة شراء'),
      ),
      body: FutureBuilder<List<PurchaseInvoice>>(
        future: _future,
        builder: (context, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const Center(child: CircularProgressIndicator());
          }
          if (snap.hasError) {
            return ErrorRetry(error: snap.error!, onRetry: _reload);
          }
          final list = snap.data ?? const <PurchaseInvoice>[];
          if (list.isEmpty) {
            return const EmptyState(
              icon: Icons.shopping_bag,
              text:
                  'سجّل هنا فواتير المحلات اللي تشتري منها،\nواربط كل قطعة بطلب العميلة عشان تعرف ربحك.',
            );
          }
          final totalOmr = list.fold<double>(0, (s, i) => s + i.totalOmr);
          return RefreshIndicator(
            onRefresh: _reload,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
              children: [
                GhCard(
                  child: KeyValue('مجموع المشتريات', omr(totalOmr),
                      strong: true, color: GH.burgundy),
                ),
                const SizedBox(height: 12),
                ...list.map((inv) => Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: GhCard(
                        onTap: () => _open(inv),
                        child: Row(
                          children: [
                            const CircleAvatar(
                              backgroundColor: GH.sand,
                              foregroundColor: GH.burgundy,
                              child: Icon(Icons.storefront_outlined),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(inv.store,
                                      style: const TextStyle(
                                          fontSize: 16,
                                          fontWeight: FontWeight.w700)),
                                  Text(
                                    [
                                      dateStr(inv.purchasedOn),
                                      if (inv.country != null) inv.country!,
                                      '${inv.itemCount} قطعة',
                                    ].join(' · '),
                                    style: const TextStyle(color: GH.muted),
                                  ),
                                ],
                              ),
                            ),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(money(inv.totalAmount, inv.currency),
                                    textDirection: TextDirection.ltr,
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w700)),
                                Text('≈ ${omr(inv.totalOmr)}',
                                    style: const TextStyle(
                                        color: GH.muted, fontSize: 12)),
                              ],
                            ),
                          ],
                        ),
                      ),
                    )),
              ],
            ),
          );
        },
      ),
    );
  }
}
