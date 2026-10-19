import 'package:flutter/cupertino.dart';

import '../data/store.dart';
import '../format.dart';
import '../models.dart';
import '../ui/colors.dart';
import '../ui/kit.dart';
import 'order_detail_page.dart';
import 'scanner_page.dart';
import 'order_form_page.dart';

enum OrderFilter { all, requested, purchased, arrived, outForDelivery, delivered, balance, website }

extension OrderFilterX on OrderFilter {
  String get label {
    switch (this) {
      case OrderFilter.all:
        return 'الكل';
      case OrderFilter.requested:
        return 'بانتظار الشراء';
      case OrderFilter.purchased:
        return 'تم الشراء';
      case OrderFilter.arrived:
        return 'وصلت';
      case OrderFilter.outForDelivery:
        return 'خرجت للتوصيل';
      case OrderFilter.delivered:
        return 'تم التسليم';
      case OrderFilter.balance:
        return 'عليها مبلغ';
      case OrderFilter.website:
        return 'من الموقع';
    }
  }

  bool matches(Order o) {
    switch (this) {
      case OrderFilter.all:
        return true;
      case OrderFilter.requested:
        return o.overallStatus == ItemStatus.requested;
      case OrderFilter.purchased:
        return o.overallStatus == ItemStatus.purchased;
      case OrderFilter.arrived:
        return o.overallStatus == ItemStatus.arrived;
      case OrderFilter.outForDelivery:
        return o.overallStatus == ItemStatus.outForDelivery;
      case OrderFilter.delivered:
        return o.overallStatus == ItemStatus.delivered;
      case OrderFilter.balance:
        return o.hasBalance;
      case OrderFilter.website:
        return o.fromStore;
    }
  }
}

class OrdersPage extends StatefulWidget {
  const OrdersPage({super.key});

  @override
  State<OrdersPage> createState() => _OrdersPageState();
}

class _OrdersPageState extends State<OrdersPage> {
  OrderFilter _filter = OrderFilter.all;
  String _query = '';

  bool _search(Order o) {
    final q = normalizeDigits(_query).trim().toLowerCase();
    if (q.isEmpty) return true;
    final hay = [
      Store.i.customerName(o),
      Store.i.customer(o.customerId)?.phone ?? '',
      o.invoiceNo,
      '${o.orderNo}',
      o.storeOrderNumber ?? '',
      ...o.items.map((i) => '${i.brand ?? ''} ${i.name}'),
    ].join(' ').toLowerCase();
    return hay.contains(q);
  }

  Future<void> _new() async {
    final id = await presentForm<String>(context, const OrderFormPage());
    if (id != null && mounted) {
      pushPage(context, OrderDetailPage(orderId: id));
    }
  }

  /// Opens an order by scanning its waybill.
  Future<void> _scan() => scanAndOpen(context);

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Store.i,
      builder: (context, _) {
        final store = Store.i;
        final list =
            store.orders.where((o) => _filter.matches(o) && _search(o)).toList();
        return GHPage(
          title: 'الطلبات',
          onRefresh: store.refresh,
          leading: NavIcon(CupertinoIcons.qrcode_viewfinder, onPressed: _scan),
          trailing: NavIcon(CupertinoIcons.add_circled_solid, onPressed: _new),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
              child: CupertinoSearchTextField(
                placeholder: 'بحث بالاسم أو الرقم أو القطعة أو الفاتورة',
                onChanged: (v) => setState(() => _query = v),
              ),
            ),
            SizedBox(
              height: 52,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.fromLTRB(16, 10, 16, 6),
                children: OrderFilter.values
                    .map((f) => Padding(
                          padding: const EdgeInsetsDirectional.only(end: 8),
                          child: Chip(f.label,
                              selected: _filter == f,
                              onTap: () => setState(() => _filter = f)),
                        ))
                    .toList(),
              ),
            ),
            if (!store.ready)
              const Loading()
            else if (store.orders.isEmpty)
              EmptyState(
                icon: CupertinoIcons.doc_text,
                title: 'ما في طلبات للحين',
                message: 'أضف أول طلب وابدأ.',
                action: SizedBox(
                    width: 200,
                    child: PrimaryButton('طلب جديد',
                        icon: CupertinoIcons.add, onPressed: _new)),
              )
            else if (list.isEmpty)
              const EmptyState(
                  icon: CupertinoIcons.search, title: 'ما في نتائج')
            else
              Section(
                header: '${list.length} طلب',
                children: list
                    .map((o) => OrderRow(
                          order: o,
                          onTap: () =>
                              pushPage(context, OrderDetailPage(orderId: o.id)),
                        ))
                    .toList(),
              ),
          ],
        );
      },
    );
  }
}

/// One order in a list: customer, number, items, status and amounts.
class OrderRow extends StatelessWidget {
  const OrderRow({super.key, required this.order, this.onTap, this.showCustomer = true});

  final Order order;
  final VoidCallback? onTap;
  final bool showCustomer;

  @override
  Widget build(BuildContext context) {
    final o = order;
    final st = o.overallStatus;
    final title = showCustomer ? Store.i.customerName(o) : o.invoiceNo;
    return Pressable(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsetsDirectional.fromSTEB(16, 12, 12, 12),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                          child: Text(title,
                              style: T.title,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis)),
                      Text(omr(o.total), style: T.money),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Text(
                    [
                      if (o.fromStore) o.sourceLabel,
                      if (showCustomer) o.invoiceNo,
                      dateStr(o.createdAt),
                      '${o.activeItems.length} قطعة',
                    ].join(' · '),
                    style: T.sub,
                  ),
                  if (o.activeItems.isNotEmpty) ...[
                    const SizedBox(height: 3),
                    Text(
                      o.activeItems.map((i) => i.title).join('، '),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: T.sub.copyWith(color: GH.label),
                    ),
                  ],
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Badge(st.label, color: st.color),
                      const Spacer(),
                      if (o.hasBalance)
                        Badge('متبقي ${omr(o.remaining)}', color: GH.red)
                      else if (o.total > 0)
                        const Badge('مدفوع', color: GH.green),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(width: 6),
            const Icon(CupertinoIcons.forward,
                size: 16, color: GH.tertiary),
          ],
        ),
      ),
    );
  }
}
