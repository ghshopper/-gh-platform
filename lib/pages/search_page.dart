import 'dart:async';

import 'package:flutter/cupertino.dart';

import '../data/api.dart';
import '../data/store.dart';
import '../format.dart';
import '../models.dart';
import '../ui/colors.dart';
import '../ui/kit.dart';
import 'customers_page.dart';
import 'order_detail_page.dart';
import 'orders_page.dart' show OrderRow;
import 'products_page.dart';

/// A search bar look-alike that opens the global search.
class SearchLauncher extends StatelessWidget {
  const SearchLauncher({super.key, required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 40,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          color: GH.card,
          borderRadius: BorderRadius.circular(12),
          boxShadow: GH.shadow,
        ),
        child: const Row(children: [
          Icon(CupertinoIcons.search, size: 19, color: GH.secondary),
          SizedBox(width: 8),
          Expanded(
            child: Text('ابحث في الطلبات والعملاء والمنتجات',
                maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 15, color: GH.tertiary)),
          ),
        ]),
      ),
    );
  }
}

/// One search over orders (ref / number / name / phone / piece), customers
/// (name / phone) and store products (from the server).
class SearchPage extends StatefulWidget {
  const SearchPage({super.key, this.todayOnly = false, this.initialQuery = '', this.initialProducts});

  /// Opened from «طلبات اليوم»: lists today's orders, search narrows them.
  final bool todayOnly;
  final String initialQuery;

  /// Ready product results (screenshots); nothing is loaded then.
  final List<AdminProduct>? initialProducts;

  @override
  State<SearchPage> createState() => _SearchPageState();
}

class _SearchPageState extends State<SearchPage> {
  late final _field = TextEditingController(text: widget.initialQuery);
  late String _q = widget.initialQuery;
  Timer? _debounce;
  late List<AdminProduct> _products = widget.initialProducts ?? [];
  bool _loadingProducts = false;
  int _seq = 0;

  @override
  void dispose() {
    _debounce?.cancel();
    _field.dispose();
    super.dispose();
  }

  String _norm(String s) => normalizeDigits(s).trim().toLowerCase();

  void _changed(String v) {
    setState(() => _q = v);
    if (widget.initialProducts != null) return;
    _debounce?.cancel();
    final q = _norm(v);
    if (q.length < 2) {
      setState(() {
        _products = [];
        _loadingProducts = false;
      });
      return;
    }
    _debounce = Timer(const Duration(milliseconds: 350), () => _loadProducts(q));
  }

  Future<void> _loadProducts(String q) async {
    final seq = ++_seq;
    setState(() => _loadingProducts = true);
    try {
      final res = await Api.i.get('/admin/products?per_page=12&page=1&search=${Uri.encodeQueryComponent(q)}');
      final list = res is Map ? (res['data'] as List? ?? const []) : (res as List? ?? const []);
      if (!mounted || seq != _seq) return;
      setState(() {
        _products = list.whereType<Map>().map((m) => AdminProduct(Map<String, dynamic>.from(m))).toList();
        _loadingProducts = false;
      });
    } catch (_) {
      if (mounted && seq == _seq) setState(() => _loadingProducts = false);
    }
  }

  bool _isToday(DateTime? d) {
    final l = d?.toLocal();
    final n = DateTime.now();
    return l != null && l.year == n.year && l.month == n.month && l.day == n.day;
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Store.i,
      builder: (context, _) {
        final store = Store.i;
        final q = _norm(_q);
        final digits = q.replaceAll(RegExp(r'\D'), '');

        bool orderHit(Order o) {
          if (q.isEmpty) return widget.todayOnly;
          final c = store.customer(o.customerId);
          final hay = [
            c?.name ?? '',
            o.invoiceNo,
            o.refNo ?? '',
            '${o.orderNo}',
            o.waybillNo,
            o.storeOrderNumber ?? '',
            ...o.items.map((i) => '${i.brand ?? ''} ${i.name}'),
          ].join(' ').toLowerCase();
          if (hay.contains(q)) return true;
          // Phones: match the digits, with or without 968.
          final phone = (c?.phone ?? '').replaceAll(RegExp(r'\D'), '');
          return digits.length >= 4 && phone.contains(digits);
        }

        final orders = store.orders
            .where((o) => (!widget.todayOnly || _isToday(o.createdAt)) && orderHit(o))
            .toList();
        final customers = q.isEmpty || widget.todayOnly
            ? <Customer>[]
            : store.customers.where((c) {
                if (c.name.toLowerCase().contains(q)) return true;
                final phone = (c.phone ?? '').replaceAll(RegExp(r'\D'), '');
                return digits.length >= 4 && phone.contains(digits);
              }).toList();
        final products = widget.todayOnly ? <AdminProduct>[] : _products;
        final nothing = q.isNotEmpty && orders.isEmpty && customers.isEmpty && products.isEmpty && !_loadingProducts;

        return GHPage(
          title: widget.todayOnly ? 'طلبات اليوم' : 'بحث',
          previousPageTitle: 'اليوم',
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
              child: CupertinoSearchTextField(
                controller: _field,
                autofocus: !widget.todayOnly && widget.initialQuery.isEmpty,
                placeholder: widget.todayOnly ? 'بحث في طلبات اليوم' : 'رقم الطلب، الاسم، الهاتف، المنتج…',
                onChanged: _changed,
              ),
            ),
            if (q.isEmpty && !widget.todayOnly)
              const EmptyState(
                icon: CupertinoIcons.search,
                title: 'ابحث في كل شي',
                message: 'رقم الطلب أو الفاتورة، اسم العميل أو رقمه، أو اسم المنتج.',
              ),
            if (nothing || (widget.todayOnly && orders.isEmpty))
              EmptyState(
                icon: CupertinoIcons.search,
                title: widget.todayOnly && q.isEmpty ? 'ما في طلبات اليوم' : 'ما لقينا شي',
                message: widget.todayOnly && q.isEmpty ? 'الطلبات الجديدة بتطلع هنا.' : 'جرّب كلمة ثانية أو رقم ثاني.',
              ),
            if (orders.isNotEmpty)
              Section(
                header: 'الطلبات · ${orders.length}',
                children: orders
                    .take(30)
                    .map((o) => OrderRow(order: o, onTap: () => pushPage(context, OrderDetailPage(orderId: o.id))))
                    .toList(),
              ),
            if (customers.isNotEmpty)
              Section(
                header: 'العملاء · ${customers.length}',
                children: customers
                    .take(20)
                    .map((c) => Tile(
                          leading: Avatar(c.name, size: 32),
                          title: c.name,
                          subtitle: [if (c.phone != null) c.phone!, if (c.city != null) c.city!].join(' · '),
                          trailing: c.loyaltyTier == null ? null : Badge(tierName(c.loyaltyTier), color: tierColor(c.loyaltyTier)),
                          onTap: () => pushPage(context, CustomerDetailPage(customerId: c.id)),
                        ))
                    .toList(),
              ),
            if (_loadingProducts && products.isEmpty && !widget.todayOnly)
              const Padding(padding: EdgeInsets.all(20), child: CupertinoActivityIndicator()),
            if (products.isNotEmpty)
              Section(
                header: 'المنتجات · ${products.length}',
                children: products
                    .map((p) => Tile(
                          leading: ClipRRect(
                            borderRadius: BorderRadius.circular(8),
                            child: Container(
                              width: 38,
                              height: 38,
                              color: GH.imageBg,
                              child: p.image == null
                                  ? const Icon(CupertinoIcons.photo, size: 18, color: GH.tertiary)
                                  : Image.network(p.image!, fit: BoxFit.contain,
                                      errorBuilder: (_, __, ___) =>
                                          const Icon(CupertinoIcons.photo, size: 18, color: GH.tertiary)),
                            ),
                          ),
                          title: p.name,
                          subtitle: [if (p.brand.isNotEmpty) p.brand, if (!p.active) 'مخفي'].join(' · '),
                          value: omr(p.sellPrice),
                          onTap: () async {
                            final changed = await pushPage<AdminProduct>(context, ProductEditPage(product: p));
                            if (changed != null && mounted) {
                              setState(() => _products = [for (final x in _products) x.id == changed.id ? changed : x]);
                            }
                          },
                        ))
                    .toList(),
              ),
          ],
        );
      },
    );
  }
}
