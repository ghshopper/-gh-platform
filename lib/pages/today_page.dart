import 'package:flutter/cupertino.dart';

import '../data/store.dart';
import '../format.dart';
import '../models.dart';
import '../ui/colors.dart';
import '../ui/kit.dart';
import 'item_pages.dart';
import 'order_detail_page.dart';
import 'requests_page.dart';
import 'order_form_page.dart';
import 'more_page.dart' show SummaryPage;
import 'story_page.dart';
import 'products_page.dart';
import 'drivers_pages.dart' show DriverDetailPage;
import 'scanner_page.dart';
import 'search_page.dart';

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
        final newRequests = store.requests.where((r) => r.status == 'pending').toList();
        // Online orders (app / website) not bought yet: new work to look at.
        final newOnline = store.orders
            .where((o) =>
                o.fromStore && o.overallStatus == ItemStatus.requested)
            .toList();
        // Today's numbers.
        bool isToday(DateTime? d) {
          final l = d?.toLocal();
          return l != null && l.year == now.year && l.month == now.month && l.day == now.day;
        }
        final todayOrders = store.orders.where((o) => isToday(o.createdAt)).toList();
        final todaySales = todayOrders.fold<double>(0, (s, o) => s + o.netSales);
        final collectedToday = store.orders.fold<double>(
            0, (s, o) => s + o.payments.where((p) => isToday(p.paidOn)).fold<double>(0, (a, p) => a + p.amount));

        // Late: open for more than two weeks, or arrived and waiting 3+ days.
        final lateOrders = <(Order, String)>[];
        for (final o in store.orders) {
          final st = o.overallStatus;
          if (st == ItemStatus.delivered || o.activeItems.isEmpty) continue;
          final age = o.createdAt == null ? 0 : now.difference(o.createdAt!).inDays;
          if (st == ItemStatus.arrived) {
            DateTime? arrived;
            for (final e in o.events) {
              if (e.type == 'arrived' && e.at != null) arrived = e.at;
            }
            final waited = arrived == null ? 0 : now.difference(arrived).inDays;
            if (waited >= 3) lateOrders.add((o, 'وصلت من $waited أيام وما تسلّمت'));
          } else if (age >= 14) {
            lateOrders.add((o, 'مفتوح من $age يوم · ${st.label}'));
          }
        }

        // Drivers on the road, with what they carry.
        final byDriver = <String, List<Order>>{};
        for (final o in store.withDrivers) {
          byDriver.putIfAbsent(o.driverId!, () => []).add(o);
        }

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
          leading: NavIcon(CupertinoIcons.qrcode_viewfinder, onPressed: () => scanAndOpen(context)),
          trailing: NavIcon(CupertinoIcons.add_circled_solid, onPressed: () async {
            final id = await presentForm<String>(context, const OrderFormPage());
            if (id != null && context.mounted) {
              pushPage(context, OrderDetailPage(orderId: id));
            }
          }),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 2),
              child: Row(children: [
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(_greeting(), style: T.title.copyWith(fontSize: 18)),
                    Text('${dateStr(now)}${store.syncing ? ' · يحدّث…' : ''}', style: T.sub),
                  ]),
                ),
                Image.asset('assets/images/story_logo.png', height: 44),
              ]),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: SearchLauncher(onTap: () => pushPage(context, const SearchPage())),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 2),
              child: Row(children: [
                Expanded(
                    child: QuickAction(
                        icon: CupertinoIcons.add,
                        label: 'طلب جديد',
                        onTap: () async {
                          final id = await presentForm<String>(context, const OrderFormPage());
                          if (id != null && context.mounted) {
                            pushPage(context, OrderDetailPage(orderId: id));
                          }
                        })),
                Expanded(
                    child: QuickAction(
                        icon: CupertinoIcons.camera_on_rectangle,
                        color: GH.pink,
                        label: 'ستوري',
                        onTap: () => pushPage(context, const StoryPickPage()))),
                Expanded(
                    child: QuickAction(
                        icon: CupertinoIcons.bag,
                        color: GH.gold,
                        label: 'المنتجات',
                        onTap: () => pushPage(context, const ProductsPage()))),
                Expanded(
                    child: QuickAction(
                        icon: CupertinoIcons.sparkles,
                        color: GH.blue,
                        label: 'طلبات القطع',
                        onTap: () => pushPage(context, const RequestsPage()))),
                Expanded(
                    child: QuickAction(
                        icon: CupertinoIcons.chart_pie,
                        color: GH.green,
                        label: 'الأرباح',
                        onTap: () => pushPage(context, const SummaryPage()))),
              ]),
            ),
            if (!store.ready)
              const Loading()
            else ...[
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
                child: _TodayStrip(cells: [
                  (CupertinoIcons.doc_text_fill, GH.blue, 'طلبات اليوم', '${todayOrders.length}',
                      () => pushPage(context, const SearchPage(todayOnly: true))),
                  (CupertinoIcons.bag_fill, GH.burgundy, 'مبيعات اليوم', plainOmr(todaySales), null),
                  (CupertinoIcons.money_dollar_circle_fill, GH.green, 'محصّل اليوم', plainOmr(collectedToday), null),
                ]),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
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
              if (newRequests.isEmpty && newOnline.isEmpty && toBuy.isEmpty && toDeliver.isEmpty && outForDelivery.isEmpty && unpaid.isEmpty && store.withDrivers.isEmpty && lateOrders.isEmpty)
                const EmptyState(
                  icon: CupertinoIcons.checkmark_seal,
                  title: 'كل شي تمام',
                  message: 'ما في شي يحتاج منك شغل اليوم.',
                ),
              if (newRequests.isNotEmpty)
                Section(
                  header: 'طلبات قطع جديدة · ${newRequests.length}',
                  trailing: HeaderButton('الكل', onPressed: () => pushPage(context, const RequestsPage())),
                  children: newRequests.take(5).map((r) => RequestTile(r)).toList(),
                ),
              if (lateOrders.isNotEmpty)
                Section(
                  header: 'متأخرة · ${lateOrders.length}',
                  children: lateOrders
                      .take(6)
                      .map((e) => Tile(
                            leading: const IconBox(CupertinoIcons.clock_fill, color: GH.red),
                            title: '${store.customerName(e.$1)} · ${e.$1.invoiceNo}',
                            subtitle: e.$2,
                            onTap: () => pushPage(context, OrderDetailPage(orderId: e.$1.id)),
                          ))
                      .toList(),
                ),
              if (byDriver.isNotEmpty)
                Section(
                  header: 'المناديب في التوصيل · ${byDriver.length}',
                  children: byDriver.entries.map((e) {
                    final d = store.driver(e.key);
                    final onRoad = e.value.where((o) => o.driverStatus == DriverStatus.picked).length;
                    final collect = e.value.fold<double>(0, (s, o) => s + (o.toCollect > 0 ? o.toCollect : 0));
                    return Tile(
                      leading: Avatar(d?.name ?? 'مندوب', size: 32),
                      title: d?.name ?? 'مندوب',
                      subtitle: [
                        '${e.value.length} طلب',
                        if (onRoad > 0) 'في الطريق $onRoad',
                        if (collect > 0) 'يحصّل ${omr(collect)}',
                      ].join(' · '),
                      trailing: Badge(onRoad > 0 ? 'في الطريق' : 'عنده', color: onRoad > 0 ? GH.amber : GH.blue),
                      onTap: () => pushPage(context, DriverDetailPage(driverId: e.key)),
                    );
                  }).toList(),
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

/// Today's three numbers in one card.
class _TodayStrip extends StatelessWidget {
  const _TodayStrip({required this.cells});

  final List<(IconData, Color, String, String, VoidCallback?)> cells;

  @override
  Widget build(BuildContext context) {
    final children = <Widget>[];
    for (var i = 0; i < cells.length; i++) {
      final c = cells[i];
      if (i > 0) children.add(Container(width: 0.5, height: 44, color: GH.separator));
      children.add(Expanded(
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: c.$5,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Icon(c.$1, size: 15, color: c.$2),
                const SizedBox(width: 4),
                Flexible(child: Text(c.$3, maxLines: 1, overflow: TextOverflow.ellipsis, style: T.small)),
              ]),
              const SizedBox(height: 6),
              FittedBox(
                fit: BoxFit.scaleDown,
                alignment: AlignmentDirectional.centerStart,
                child: Text(c.$4, style: T.money.copyWith(fontSize: 19, fontWeight: FontWeight.w700)),
              ),
            ]),
          ),
        ),
      ));
    }
    return Container(
      decoration: BoxDecoration(color: GH.card, borderRadius: BorderRadius.circular(18), boxShadow: GH.shadow),
      child: Row(children: children),
    );
  }
}
