import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../models.dart';
import 'api.dart';

/// Single source of truth for the app.
///
/// Everything is loaded in one request (`/ps/bootstrap`), kept in memory and
/// cached on the phone, so every screen opens instantly; after each change
/// the data is refreshed in the background and listeners rebuild.
class Store extends ChangeNotifier {
  Store._();
  static final Store i = Store._();

  Api get _api => Api.i;

  List<Order> orders = [];
  List<Customer> customers = [];
  List<Trip> trips = [];
  List<TripExpense> expenses = [];
  List<PurchaseInvoice> invoices = [];
  List<Driver> drivers = [];
  List<PieceRequest> requests = [];
  BusinessSettings settings = BusinessSettings();

  Map<String, Customer> _customerById = {};
  Map<String, Trip> _tripById = {};
  Map<String, Order> _orderById = {};

  bool ready = false;
  bool syncing = false;
  Object? lastError;

  static const _cacheKey = 'gh_cache_v3';

  // ───────────── loading ─────────────

  String get _userKey => '$_cacheKey:${_api.cacheKey}';

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
      final raw = Map<String, dynamic>.from(await _api.get('/ps/bootstrap') as Map);
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
    drivers = rows('drivers').map(Driver.fromMap).toList();
    requests = rows('requests').map(PieceRequest.fromMap).toList();
    final s = raw['settings'];
    settings = s is Map
        ? BusinessSettings.fromMap(Map<String, dynamic>.from(s))
        : BusinessSettings();
    _customerById = {for (final c in customers) c.id: c};
    _tripById = {for (final t in trips) t.id: t};
    _orderById = {for (final o in orders) o.id: o};
  }

  /// Loads a bootstrap snapshot directly (screenshots / tests).
  @visibleForTesting
  void loadSnapshot(Map<String, dynamic> raw) {
    _apply(raw);
    ready = true;
    notifyListeners();
  }

  void clear() {
    orders = [];
    customers = [];
    trips = [];
    expenses = [];
    invoices = [];
    drivers = [];
    requests = [];
    settings = BusinessSettings();
    _customerById = {};
    _tripById = {};
    _orderById = {};
    _signed.clear();
    ready = false;
    notifyListeners();
  }

  // ───────────── lookups ─────────────

  Customer? customer(String? id) => id == null ? null : _customerById[id];
  Trip? trip(String? id) => id == null ? null : _tripById[id];
  Order? order(String id) => _orderById[id];
  Driver? driver(String? id) {
    if (id == null) return null;
    for (final d in drivers) {
      if (d.id == id) return d;
    }
    return null;
  }

  /// Orders handed to a driver and not yet delivered.
  List<Order> get withDrivers => orders
      .where((o) =>
          o.driverId != null && o.driverStatus != DriverStatus.delivered)
      .toList();

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
    String? address,
    String? notes,
    bool isMale = false,
  }) {
    return _write(() async {
      final data = <String, dynamic>{
        'name': name,
        'phone': phone,
        'city': city,
        'address': address,
        'notes': notes,
        'gender': isMale ? 'm' : 'f',
      };
      final res = id == null
          ? await _api.post('/ps/customers', data)
          : await _api.put('/ps/customers/$id', data);
      return Customer.fromMap(
          Map<String, dynamic>.from((res as Map)['customer'] as Map));
    });
  }

  Future<void> deleteCustomer(String id) =>
      _write(() => _api.delete('/ps/customers/$id'));

  /// The customer's private page listing all of their orders and invoices.
  /// [reset] issues a new link and the old one stops working.
  Future<String> customerPortalLink(String id, {bool reset = false}) async {
    final res = await _api.post(
        '/ps/customers/$id/portal-link${reset ? '?reset=1' : ''}');
    return (res as Map)['url'] as String;
  }

  /// The order's payment link (card / Apple Pay with Amwal). The customer
  /// pays what is left; the payment is added to the order by itself.
  Future<String> orderPayLink(String id, {bool reset = false}) async {
    final res = await _api.post('/ps/orders/$id/pay-link${reset ? '?reset=1' : ''}');
    return (res as Map)['url'] as String;
  }

  // ───────────── piece requests ─────────────

  /// Turns a customer's piece request into an order. Returns the new
  /// order's id and its payment link.
  Future<({String orderId, String payUrl})> convertRequest(String id, Map<String, dynamic> data) {
    return _write(() async {
      final res = Map<String, dynamic>.from(
          await _api.post('/ps/requests/$id/convert', data) as Map);
      return (orderId: res['order_id'].toString(), payUrl: res['pay_url'].toString());
    });
  }

  Future<void> setRequestStatus(String id, String status) =>
      _write(() => _api.put('/ps/requests/$id', {'status': status}));

  // ───────────── orders ─────────────

  Future<String> createOrder({
    required String customerId,
    String? tripId,
    double deliveryFee = 0,
    String? deliveryMethod,
    String? notes,
    required List<Map<String, dynamic>> items,
    double deposit = 0,
    String? depositMethod,
  }) {
    return _write(() async {
      final res = await _api.post('/ps/orders', {
        'customer_id': customerId,
        'trip_id': tripId,
        'delivery_fee': deliveryFee,
        'delivery_method': deliveryMethod,
        'notes': notes,
        'items': items,
        'deposit': deposit,
        'deposit_method': depositMethod,
      });
      return (res as Map)['id'] as String;
    });
  }

  /// [data] may contain trip_id, delivery_fee and notes.
  Future<void> updateOrder(String id, Map<String, dynamic> data) {
    final o = order(id);
    return _write(() => _api.put('/ps/orders/$id', {
          'trip_id': o?.tripId,
          'notes': o?.notes,
          ...data,
        }));
  }

  /// Records that the shipping label was printed (first time only).
  Future<void> markLabelPrinted(String orderId) async {
    if (order(orderId)?.labelPrintedAt != null) return;
    await _write(() => _api.post('/ps/orders/$orderId/label'));
  }

  /// Finds an order from a scanned waybill QR (tracking link).
  Order? orderByToken(String token) {
    for (final o in orders) {
      if (o.trackingToken == token) return o;
    }
    return null;
  }

  Future<void> deleteOrder(String id) =>
      _write(() => _api.delete('/ps/orders/$id'));

  // ───────────── items ─────────────

  Future<void> saveItem({
    String? id,
    required String orderId,
    required String name,
    String? brand,
    String? details,
    required double price,
    Map<String, dynamic> pricing = const {},
  }) {
    return _write(() async {
      final data = {
        'order_id': orderId,
        'name': name,
        'brand': brand,
        'details': details,
        'price': price,
        ...pricing,
      };
      if (id == null) {
        await _api.post('/ps/items', data);
      } else {
        await _api.put('/ps/items/$id', data);
      }
    });
  }

  Future<void> deleteItem(String id) =>
      _write(() => _api.delete('/ps/items/$id'));

  Future<void> setItemStatus(OrderItem item, ItemStatus status) =>
      setItemsStatus([item], status);

  Future<void> setItemsStatus(List<OrderItem> items, ItemStatus status) =>
      _write(() => _api.post('/ps/items/status', {
            'ids': items.map((i) => i.id).toList(),
            'status': status.key,
          }));

  /// Records where an item was bought and for how much, and marks it bought.
  /// The amount is deducted from the customer's balance automatically.
  Future<void> recordPurchase(
    OrderItem item, {
    required PurchasePlace place,
    required double price,
    required String currency,
    required double rate,
  }) {
    return _write(() => _api.put('/ps/items/${item.id}/purchase', {
          'place': place.key,
          'price': price,
          'currency': currency,
          'rate': rate,
          'tax_free_pct': place.taxFreePct,
        }));
  }

  Future<void> setTaxFreeReceived(String itemId, bool received) => _write(
      () => _api.put('/ps/items/$itemId/tax-free', {'received': received}));

  // ───────────── photos ─────────────

  final Map<String, String> _signed = {};

  /// Uploads a photo for an item. [kind] is 'photo' or 'receipt'.
  Future<void> uploadItemPhoto(OrderItem item, String kind, Uint8List bytes) {
    return _write(() async {
      final res = await _api.upload('/ps/items/${item.id}/photo', 'file', bytes,
          fields: {'kind': kind});
      if (res is Map && res['path'] != null && res['url'] != null) {
        _signed[res['path'] as String] = res['url'] as String;
      }
    });
  }

  Future<void> removeItemPhoto(OrderItem item, String kind) => _write(
      () => _api.delete('/ps/items/${item.id}/photo', {'kind': kind}));

  /// A temporary link (24 h) to show a private photo.
  Future<String> photoUrl(String path) async {
    final cached = _signed[path];
    if (cached != null) return cached;
    final res = await _api.post('/ps/files/url', {'path': path});
    final url = (res as Map)['url'] as String;
    _signed[path] = url;
    return url;
  }

  // ───────────── drivers ─────────────

  Future<void> createDriver(
          {required String name,
          required String phone,
          required String password}) =>
      _write(() => _api.post('/ps/drivers',
          {'name': name, 'phone': phone, 'password': password}));

  Future<void> setDriverPassword(String driverId, String password) =>
      _api.put('/ps/drivers/$driverId', {'password': password});

  Future<void> deleteDriver(String driverId) =>
      _write(() => _api.delete('/ps/drivers/$driverId'));

  Future<void> saveDriver(String id, {String? name, bool? active}) =>
      _write(() => _api.put('/ps/drivers/$id', {
            if (name != null) 'name': name,
            if (active != null) 'active': active,
          }));

  /// Hands an order to a driver (or takes it back when [driverId] is null).
  Future<void> setDelivery(
    Order o, {
    required String? driverId,
    String? address,
    bool? collect,
    String? note,
  }) {
    return _write(() => _api.put('/ps/orders/${o.id}/delivery', {
          'driver_id': driverId,
          'address': address,
          'collect': collect,
          'note': note,
        }));
  }

  // ───────────── payments ─────────────

  Future<void> addPayment(String orderId,
      {required double amount, String? method, DateTime? paidOn, String? note}) {
    return _write(() => _api.post('/ps/payments', {
          'order_id': orderId,
          'amount': amount,
          'method': method,
          'paid_on': _day(paidOn ?? DateTime.now()),
          'note': note,
        }));
  }

  Future<void> deletePayment(String id) =>
      _write(() => _api.delete('/ps/payments/$id'));

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
      final res = id == null
          ? await _api.post('/ps/trips', data)
          : await _api.put('/ps/trips/$id', data);
      return (res as Map)['id'] as String;
    });
  }

  Future<void> deleteTrip(String id) =>
      _write(() => _api.delete('/ps/trips/$id'));

  Future<void> addExpense({
    String? tripId,
    required String title,
    required double amount,
    required String currency,
    required double rate,
    DateTime? spentOn,
  }) {
    return _write(() => _api.post('/ps/expenses', {
          'trip_id': tripId,
          'title': title,
          'amount': amount,
          'currency': currency,
          'exchange_rate': rate,
          'spent_on': _day(spentOn ?? DateTime.now()),
        }));
  }

  Future<void> deleteExpense(String id) =>
      _write(() => _api.delete('/ps/expenses/$id'));

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
        'link': link.entries
            .map((e) => {'item_id': e.key.id, 'cost': e.value})
            .toList(),
      };
      final res = id == null
          ? await _api.post('/ps/purchase-invoices', data)
          : await _api.put('/ps/purchase-invoices/$id', data);
      return (res as Map)['id'] as String;
    });
  }

  Future<void> deletePurchaseInvoice(String id) =>
      _write(() => _api.delete('/ps/purchase-invoices/$id'));

  Future<void> unlinkItem(String itemId) =>
      _write(() => _api.put('/ps/items/$itemId/unlink'));

  // ───────────── settings ─────────────

  Future<void> saveSettings(Map<String, dynamic> data) =>
      _write(() => _api.put('/ps/settings', data));
}
