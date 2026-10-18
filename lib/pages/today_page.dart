import 'package:flutter/cupertino.dart';

import '../data/store.dart';
import '../format.dart';
import '../models.dart';
import '../ui/colors.dart';
import '../ui/kit.dart';
import 'item_pages.dart';
import 'order_detail_page.dart';
import 'order_form_page.dart';

/// What needs doing today: buy, deliver, collect.
class TodayPage extends StatelessWidget {
  const TodayPage({super.key});

  String _greeting() {
    final h = DateTime.now().hour;
    if (h < 12) return 'صباح الخير';
    if (h < 18) return 'مساء الخير';
    return 'مساء النور';
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Store.i,
      builder: (context, _) {
        final store = Store.i;
        final now = DateTime.now();
        final monthOrders = store.orders.where((o) {
          final d = o.createdAt?.toLocal();
          return d != null && d.year == now.year && d.month == now.month;
        }).toList();
        final sales = monthOrders.fold<double>(0, (s, o) => s + o.netSales);
        final owed = store.orders
            .fold<double>(0, (s, o) => s + (o.remaining > 0 ? o.remaining : 0));
        final held = store.orders.fold<double>(
            0, (s, o) => s + (o.customerBalance > 0 ? o.customerBalance : 0));

        final items = store.allItems.toList();
        final toBuy =
            items.where((e) => e.value.status == ItemStatus.requested).toList();
        final toDeliver =
            items.where((e) => e.value.status == ItemStatus.arrived).toList();
        final outForDelivery = items
            .where((e) => e.value.status == ItemStatus.outForDelivery)
            .toList();
        final unpaid = store.orders.where((o) => o.hasBalance).toList();
        // Online orders (app / website) not bought yet: new work to look at.
        final newOnline = store.orders
            .where((o) =>
                o.fromStore && o.overallStatus == ItemStatus.requested)
            .toList();
        final taxFree = <String, double>{};
        for (final o in store.orders) {
          o.taxFreePending
              .forEach((c, v) => taxFree[c] = (taxFree[c] ?? 0) + v);
        }

        Widget itemTile(MapEntry<Order, OrderItem> e, {VoidCallback? onTap}) {
          final o = e.key;
          final i = e.value;
          return Tile(
            leading: i.photoPath == null ? null : Thumb(i.photoPath!, size: 38),
            title: i.title,
            subtitle: '${store.customerName(o)} · ${o.invoiceNo}',
            value: omr(i.price),
            onTap: onTap ??
                () => pushPage(context, OrderDetailPage(orderId: o.id)),
          );
        }

        return GHPage(
          title: 'اليوم',
          onRefresh: store.refresh,
          trailing: NavIcon(CupertinoIcons.add_circled_solid, onPressed: () async {
            final id = await presentForm<String>(context, const OrderFormPage());
            if (id != null && context.mounted) {
              pushPage(context, OrderDetailPage(orderId: id));
            }
          }),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 4),
              child: Text(
                  '${_greeting()} · ${dateStr(now)}${store.syncing ? ' · يحدّث…' : ''}',
                  style: T.sub),
            ),
            if (!store.ready)
              const Loading()
            else ...[
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                child: Column(children: [
                  Row(children: [
                    Expanded(
                        child: StatCard(
                            icon: CupertinoIcons.chart_bar_alt_fill,
                            hero: true,
                            label: 'مبيعات الشهر',
                            value: omr(sales))),
                    const SizedBox(width: 10),
                    Expanded(
                        child: StatCard(
                            icon: CupertinoIcons.exclamationmark_circle_fill,
                            color: GH.red,
                            label: 'عند العملاء',
                            value: omr(owed))),
                  ]),
                  const SizedBox(height: 10),
                  Row(children: [
                    Expanded(
                        child: StatCard(
                            icon: CupertinoIcons.creditcard_fill,
                            color: GH.green,
                            label: 'أرصدة العملاء عندك',
                            value: omr(held))),
                    const SizedBox(width: 10),
                    Expanded(
                        child: StatCard(
                            icon: CupertinoIcons.arrow_2_circlepath,
                            color: GH.purple,
                            label: 'تاكس فري باقي',
                            value: taxFree.isEmpty
                                ? '—'
                                : taxFree.entries
                                    .map((e) => money(e.value, e.key))
                                    .join(' + '))),
                  ]),
                ]),
              ),
              if (newOnline.isEmpty && toBuy.isEmpty && toDeliver.isEmpty && outForDelivery.isEmpty && unpaid.isEmpty && store.withDrivers.isEmpty)
                const EmptyState(
                  icon: CupertinoIcons.checkmark_seal,
                  title: 'كل شي تمام',
                  message: 'ما في شي يحتاج منك شغل اليوم.',
                ),
              if (newOnline.isNotEmpty)
                Section(
                  header: 'طلبات أونلاين جديدة · ${newOnline.length}',
                  children: newOnline
                      .take(8)
                      .map((o) => Tile(
                            leading: Avatar(store.customerName(o), size: 32),
                            title: store.customerName(o),
                            subtitle: [
                              o.sourceLabel,
                              o.invoiceNo,
                              '${o.activeItems.length} قطعة',
                            ].join(' · '),
                            value: omr(o.total),
                            trailing: o.paidOnline
                                ? const Badge('مدفوع', color: GH.green)
                                : null,
                            onTap: () => pushPage(
                                context, OrderDetailPage(orderId: o.id)),
                          ))
                      .toList(),
                ),
              if (outForDelivery.isNotEmpty)
                Section(
                  header: 'خرجت للتوصيل · ${outForDelivery.length}',
                  children: outForDelivery.take(8).map((e) => itemTile(e)).toList(),
                ),
              if (toDeliver.isNotEmpty)
                Section(
                  header: 'وصلت وتنتظر التسليم · ${toDeliver.length}',
                  children: toDeliver.take(8).map((e) => itemTile(e)).toList(),
                ),
              if (store.withDrivers.isNotEmpty)
                Section(
                  header: 'مع المناديب · ${store.withDrivers.length}',
                  children: store.withDrivers
                      .take(8)
                      .map((o) => Tile(
                            leading: Avatar(store.customerName(o), size: 32),
                            title: store.customerName(o),
                            subtitle:
                                '${store.driver(o.driverId)?.name ?? ''} · ${o.invoiceNo}',
                            trailing: Badge(o.driverStatus?.label ?? '',
                                color: o.driverStatus?.color ?? GH.blue),
                            onTap: () => pushPage(
                                context, OrderDetailPage(orderId: o.id)),
                          ))
                      .toList(),
                ),
              if (toBuy.isNotEmpty)
                Section(
                  header: 'تنتظر الشراء · ${toBuy.length}',
                  footer: toBuy.length > 8
                      ? 'تلقى القائمة كاملة مرتبة حسب البراند في الرحلات.'
                      : null,
                  children: toBuy
                      .take(8)
                      .map((e) => itemTile(e,
                          onTap: () => presentForm(
                              context, PurchasePage(item: e.value))))
                      .toList(),
                ),
              if (unpaid.isNotEmpty)
                Section(
                  header: 'عليهم مبالغ · ${unpaid.length}',
                  children: unpaid
                      .take(8)
                      .map((o) => Tile(
                            leading: Avatar(store.customerName(o), size: 32),
                            title: store.customerName(o),
                            subtitle: o.invoiceNo,
                            value: omr(o.remaining),
                            valueStyle:
                                const TextStyle(fontSize: 15, color: GH.red),
                            onTap: () => pushPage(
                                context, OrderDetailPage(orderId: o.id)),
                          ))
                      .toList(),
                ),
            ],
          ],
        );
      },
    );
  }
}
