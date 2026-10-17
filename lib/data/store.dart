import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../models.dart';

/// Single source of truth for the app.
///
/// Everything is loaded in one parallel batch, kept in memory and cached on
/// the phone, so every screen opens instantly; after each change the batch is
/// refreshed in the background and listeners rebuild.
class Store extends ChangeNotifier {
  Store._();
  static final Store i = Store._();

  SupabaseClient get _db => Supabase.instance.client;

  List<Order> orders = [];
  List<Customer> customers = [];
  List<Trip> trips = [];
  List<TripExpense> expenses = [];
  List<PurchaseInvoice> invoices = [];
  BusinessSettings settings = BusinessSettings();

  Map<String, Customer> _customerById = {};
  Map<String, Trip> _tripById = {};
  Map<String, Order> _orderById = {};

  bool ready = false;
  bool syncing = false;
  Object? lastError;

  static const _cacheKey = 'gh_cache_v2';

  // ───────────── loading ─────────────

  String get _userKey => '$_cacheKey:${_db.auth.currentUser?.id ?? ''}';

  /// Shows the cached snapshot immediately, then refreshes from the server.
  Future<void> start() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_userKey);
      if (raw != null) {
        _apply(jsonDecode(raw) as Map<String, dynamic>);
        ready = true;
        notifyListeners();
      }
    } catch (_) {
      // A broken cache is ignored; the network load replaces it.
    }
    await refresh();
  }

  Future<void> refresh() async {
    syncing = true;
    notifyListeners();
    try {
      final results = await Future.wait<dynamic>([
        _db
            .from('gh_orders')
            .select('*, gh_order_items(*), gh_payments(*)')
            .order('created_at', ascending: false),
        _db.from('gh_customers').select().order('name'),
        _db.from('gh_trips').select().order('created_at', ascending: false),
        _db.from('gh_trip_expenses').select().order('spent_on'),
        _db
            .from('gh_purchase_invoices')
            .select()
            .order('purchased_on', ascending: false),
        _db.from('gh_settings').select().maybeSingle(),
      ]);
      final raw = <String, dynamic>{
        'orders': results[0],
        'customers': results[1],
        'trips': results[2],
        'expenses': results[3],
        'invoices': results[4],
        'settings': results[5],
      };
      _apply(raw);
      lastError = null;
      ready = true;
      SharedPreferences.getInstance()
          .then((p) => p.setString(_userKey, jsonEncode(raw)));
    } catch (e) {
      lastError = e;
      ready = true;
    } finally {
      syncing = false;
      notifyListeners();
    }
  }

  void _apply(Map<String, dynamic> raw) {
    List<Map<String, dynamic>> rows(String k) => ((raw[k] as List?) ?? const [])
        .map((e) => Map<String, dynamic>.from(e as Map))
        .toList();
    orders = rows('orders').map(Order.fromMap).toList();
    customers = rows('customers').map(Customer.fromMap).toList();
    trips = rows('trips').map(Trip.fromMap).toList();
    expenses = rows('expenses').map(TripExpense.fromMap).toList();
    invoices = rows('invoices').map(PurchaseInvoice.fromMap).toList();
    final s = raw['settings'];
    settings = s is Map
        ? BusinessSettings.fromMap(Map<String, dynamic>.from(s))
        : BusinessSettings();
    _customerById = {for (final c in customers) c.id: c};
    _tripById = {for (final t in trips) t.id: t};
    _orderById = {for (final o in orders) o.id: o};
  }

  void clear() {
    orders = [];
    customers = [];
    trips = [];
    expenses = [];
    invoices = [];
    settings = BusinessSettings();
    _customerById = {};
    _tripById = {};
    _orderById = {};
    ready = false;
    notifyListeners();
  }

  // ───────────── lookups ─────────────

  Customer? customer(String? id) => id == null ? null : _customerById[id];
  Trip? trip(String? id) => id == null ? null : _tripById[id];
  Order? order(String id) => _orderById[id];

  String customerName(Order o) => customer(o.customerId)?.name ?? '—';

  List<Order> ordersOf(String customerId) =>
      orders.where((o) => o.customerId == customerId).toList();

  List<Order> ordersOfTrip(String tripId) =>
      orders.where((o) => o.tripId == tripId).toList();

  List<TripExpense> expensesOf(String tripId) =>
      expenses.where((e) => e.tripId == tripId).toList();

  /// Every active item with its order, newest order first.
  Iterable<MapEntry<Order, OrderItem>> get allItems sync* {
    for (final o in orders) {
      for (final it in o.activeItems) {
        yield MapEntry(o, it);
      }
    }
  }

  // ───────────── helpers ─────────────

  static String _now() => DateTime.now().toUtc().toIso8601String();
  static String _day(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  /// Runs a write then refreshes everything.
  Future<T> _write<T>(Future<T> Function() action) async {
    final r = await action();
    await refresh();
    if (lastError != null) {
      final e = lastError!;
      lastError = null;
      throw e;
    }
    return r;
  }

  // ───────────── customers ─────────────

  Future<Customer> saveCustomer({
    String? id,
    required String name,
    String? phone,
    String? city,
    String? notes,
    bool isMale = false,
  }) {
    return _write(() async {
      final data = <String, dynamic>{
        'name': name,
        'phone': phone,
        'city': city,
        'notes': notes,
        'gender': isMale ? 'm' : 'f',
      };
      final Map<String, dynamic> row = id == null
          ? await _db.from('gh_customers').insert(data).select().single()
          : await _db
              .from('gh_customers')
              .update(data)
              .eq('id', id)
              .select()
              .single();
      return Customer.fromMap(row);
    });
  }

  Future<void> deleteCustomer(String id) =>
      _write(() async => _db.from('gh_customers').delete().eq('id', id));

  // ───────────── orders ─────────────

  Future<String> createOrder({
    required String customerId,
    String? tripId,
    double deliveryFee = 0,
    String? notes,
    required List<Map<String, dynamic>> items,
    double deposit = 0,
    String? depositMethod,
  }) {
    return _write(() async {
      final row = await _db
          .from('gh_orders')
          .insert({
            'customer_id': customerId,
            'trip_id': tripId,
            'delivery_fee': deliveryFee,
            'notes': notes,
          })
          .select('id')
          .single();
      final orderId = row['id'] as String;
      final writes = <Future<dynamic>>[];
      if (items.isNotEmpty) {
        writes.add(_db
            .from('gh_order_items')
            .insert(items.map((i) => {...i, 'order_id': orderId}).toList()));
      }
      if (deposit > 0) {
        writes.add(_db.from('gh_payments').insert({
          'order_id': orderId,
          'amount': deposit,
          'method': depositMethod,
          'note': 'عربون',
          'paid_on': _day(DateTime.now()),
        }));
      }
      await Future.wait(writes);
      return orderId;
    });
  }

  Future<void> updateOrder(String id, Map<String, dynamic> data) =>
      _write(() async => _db.from('gh_orders').update(data).eq('id', id));

  Future<void> deleteOrder(String id) =>
      _write(() async => _db.from('gh_orders').delete().eq('id', id));

  // ───────────── items ─────────────

  Future<void> saveItem({
    String? id,
    required String orderId,
    required String name,
    String? brand,
    String? details,
    required double price,
  }) {
    return _write(() async {
      final data = {
        'name': name,
        'brand': brand,
        'details': details,
        'price': price,
      };
      if (id == null) {
        await _db.from('gh_order_items').insert({...data, 'order_id': orderId});
      } else {
        await _db.from('gh_order_items').update(data).eq('id', id);
      }
    });
  }

  Future<void> deleteItem(String id) =>
      _write(() async => _db.from('gh_order_items').delete().eq('id', id));

  Map<String, dynamic> _statusData(OrderItem item, ItemStatus status) {
    final data = <String, dynamic>{'status': status.name};
    final now = _now();
    if (status.index >= ItemStatus.purchased.index &&
        status != ItemStatus.cancelled &&
        item.purchasedAt == null) {
      data['purchased_at'] = now;
    }
    if ((status == ItemStatus.arrived || status == ItemStatus.delivered) &&
        item.arrivedAt == null) {
      data['arrived_at'] = now;
    }
    if (status == ItemStatus.delivered && item.deliveredAt == null) {
      data['delivered_at'] = now;
    }
    return data;
  }

  Future<void> setItemStatus(OrderItem item, ItemStatus status) => _write(
      () async => _db
          .from('gh_order_items')
          .update(_statusData(item, status))
          .eq('id', item.id));

  Future<void> setItemsStatus(List<OrderItem> items, ItemStatus status) =>
      _write(() async {
        await Future.wait(items.map((i) => _db
            .from('gh_order_items')
            .update(_statusData(i, status))
            .eq('id', i.id)));
      });

  /// Records where an item was bought and for how much, and marks it bought.
  /// The amount is deducted from the customer's balance automatically.
  Future<void> recordPurchase(
    OrderItem item, {
    required PurchasePlace place,
    required double price,
    required String currency,
    required double rate,
  }) {
    return _write(() async {
      final data = <String, dynamic>{
        'purchase_place': place.key,
        'cost_amount': price,
        'cost_currency': currency,
        'cost_rate': rate,
        'tax_free_pct': place.taxFreePct,
      };
      if (item.status == ItemStatus.requested) {
        data['status'] = ItemStatus.purchased.name;
      }
      if (item.purchasedAt == null) data['purchased_at'] = _now();
      await _db.from('gh_order_items').update(data).eq('id', item.id);
    });
  }

  Future<void> setTaxFreeReceived(String itemId, bool received) =>
      _write(() async => _db
          .from('gh_order_items')
          .update({'tax_free_received': received}).eq('id', itemId));

  // ───────────── photos ─────────────

  final Map<String, String> _signed = {};

  /// Uploads a photo for an item. [kind] is 'photo' or 'receipt'.
  Future<void> uploadItemPhoto(OrderItem item, String kind, Uint8List bytes) {
    return _write(() async {
      final uid = _db.auth.currentUser!.id;
      final path = '$uid/${item.id}-$kind-${DateTime.now().millisecondsSinceEpoch}.jpg';
      await _db.storage.from('gh-photos').uploadBinary(
            path,
            bytes,
            fileOptions: const FileOptions(contentType: 'image/jpeg'),
          );
      await _db
          .from('gh_order_items')
          .update({'${kind}_path': path}).eq('id', item.id);
      final old = kind == 'photo' ? item.photoPath : item.receiptPath;
      if (old != null) {
        _db.storage.from('gh-photos').remove([old]).ignore();
      }
    });
  }

  Future<void> removeItemPhoto(OrderItem item, String kind) {
    return _write(() async {
      final old = kind == 'photo' ? item.photoPath : item.receiptPath;
      await _db
          .from('gh_order_items')
          .update({'${kind}_path': null}).eq('id', item.id);
      if (old != null) await _db.storage.from('gh-photos').remove([old]);
    });
  }

  Future<String> photoUrl(String path) async {
    final cached = _signed[path];
    if (cached != null) return cached;
    final url =
        await _db.storage.from('gh-photos').createSignedUrl(path, 60 * 60 * 24);
    _signed[path] = url;
    return url;
  }

  // ───────────── payments ─────────────

  Future<void> addPayment(String orderId,
      {required double amount, String? method, DateTime? paidOn, String? note}) {
    return _write(() async => _db.from('gh_payments').insert({
          'order_id': orderId,
          'amount': amount,
          'method': method,
          'paid_on': _day(paidOn ?? DateTime.now()),
          'note': note,
        }));
  }

  Future<void> deletePayment(String id) =>
      _write(() async => _db.from('gh_payments').delete().eq('id', id));

  // ───────────── trips ─────────────

  Future<String> saveTrip({
    String? id,
    required String name,
    String? destination,
    DateTime? startsOn,
    DateTime? endsOn,
    String? notes,
  }) {
    return _write(() async {
      final data = {
        'name': name,
        'destination': destination,
        'starts_on': startsOn == null ? null : _day(startsOn),
        'ends_on': endsOn == null ? null : _day(endsOn),
        'notes': notes,
      };
      if (id == null) {
        final row =
            await _db.from('gh_trips').insert(data).select('id').single();
        return row['id'] as String;
      }
      await _db.from('gh_trips').update(data).eq('id', id);
      return id;
    });
  }

  Future<void> deleteTrip(String id) =>
      _write(() async => _db.from('gh_trips').delete().eq('id', id));

  Future<void> addExpense({
    required String tripId,
    required String title,
    required double amount,
    required String currency,
    required double rate,
    DateTime? spentOn,
  }) {
    return _write(() async => _db.from('gh_trip_expenses').insert({
          'trip_id': tripId,
          'title': title,
          'amount': amount,
          'currency': currency,
          'exchange_rate': rate,
          'spent_on': _day(spentOn ?? DateTime.now()),
        }));
  }

  Future<void> deleteExpense(String id) =>
      _write(() async => _db.from('gh_trip_expenses').delete().eq('id', id));

  // ───────────── purchase invoices ─────────────

  Future<String> savePurchaseInvoice({
    String? id,
    required String store,
    String? invoiceNo,
    required DateTime purchasedOn,
    String? country,
    required String currency,
    required double rate,
    required double totalAmount,
    String? notes,
    Map<OrderItem, double> link = const {},
  }) {
    return _write(() async {
      final data = <String, dynamic>{
        'store': store,
        'invoice_no': invoiceNo,
        'purchased_on': _day(purchasedOn),
        'country': country,
        'currency': currency,
        'exchange_rate': rate,
        'total_amount': totalAmount,
        'notes': notes,
      };
      String invoiceId;
      if (id == null) {
        final row = await _db
            .from('gh_purchase_invoices')
            .insert(data)
            .select('id')
            .single();
        invoiceId = row['id'] as String;
      } else {
        invoiceId = id;
        await _db.from('gh_purchase_invoices').update(data).eq('id', id);
        await _db
            .from('gh_order_items')
            .update({'cost_currency': currency, 'cost_rate': rate}).eq(
                'purchase_invoice_id', id);
      }
      await Future.wait(link.entries.map((e) {
        final item = e.key;
        final upd = <String, dynamic>{
          'purchase_invoice_id': invoiceId,
          'cost_amount': e.value,
          'cost_currency': currency,
          'cost_rate': rate,
        };
        if (item.status == ItemStatus.requested) {
          upd['status'] = ItemStatus.purchased.name;
        }
        if (item.purchasedAt == null) {
          upd['purchased_at'] = purchasedOn.toUtc().toIso8601String();
        }
        return _db.from('gh_order_items').update(upd).eq('id', item.id);
      }));
      return invoiceId;
    });
  }

  Future<void> deletePurchaseInvoice(String id) {
    return _write(() async {
      await _db.from('gh_order_items').update({
        'purchase_invoice_id': null,
      }).eq('purchase_invoice_id', id);
      await _db.from('gh_purchase_invoices').delete().eq('id', id);
    });
  }

  Future<void> unlinkItem(String itemId) => _write(() async => _db
      .from('gh_order_items')
      .update({'purchase_invoice_id': null}).eq('id', itemId));

  // ───────────── settings ─────────────

  Future<void> saveSettings(Map<String, dynamic> data) {
    return _write(() async => _db.from('gh_settings').upsert({
          ...data,
          'owner': _db.auth.currentUser!.id,
          'updated_at': _now(),
        }));
  }
}
