import 'package:supabase_flutter/supabase_flutter.dart';

import 'models.dart';

/// All reads and writes to the GH tables in Supabase.
class Repo {
  static SupabaseClient get _db => Supabase.instance.client;

  static const _orderSelect = '*, gh_customers(*), gh_order_items(*), gh_payments(*)';

  static String _now() => DateTime.now().toUtc().toIso8601String();
  static String _day(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  // ---------------- Customers ----------------

  static Future<List<Customer>> customers() async {
    final rows = await _db.from('gh_customers').select().order('name');
    return rows.map((e) => Customer.fromMap(e)).toList();
  }

  static Future<Customer> saveCustomer({
    String? id,
    required String name,
    String? phone,
    String? city,
    String? notes,
  }) async {
    final data = <String, dynamic>{
      'name': name,
      'phone': phone,
      'city': city,
      'notes': notes,
    };
    final Map<String, dynamic> row;
    if (id == null) {
      row = await _db.from('gh_customers').insert(data).select().single();
    } else {
      row = await _db
          .from('gh_customers')
          .update(data)
          .eq('id', id)
          .select()
          .single();
    }
    return Customer.fromMap(row);
  }

  static Future<void> deleteCustomer(String id) async {
    await _db.from('gh_customers').delete().eq('id', id);
  }

  // ---------------- Orders ----------------

  static Future<List<Order>> orders({String? customerId}) async {
    var query = _db.from('gh_orders').select(_orderSelect);
    if (customerId != null) query = query.eq('customer_id', customerId);
    final rows = await query.order('created_at', ascending: false);
    return rows.map((e) => Order.fromMap(e)).toList();
  }

  static Future<Order> order(String id) async {
    final row =
        await _db.from('gh_orders').select(_orderSelect).eq('id', id).single();
    return Order.fromMap(row);
  }

  static Future<String> createOrder({
    required String customerId,
    String? trip,
    double deliveryFee = 0,
    String? notes,
    required List<Map<String, dynamic>> items,
    double deposit = 0,
    String? depositMethod,
  }) async {
    final row = await _db
        .from('gh_orders')
        .insert({
          'customer_id': customerId,
          'trip': trip,
          'delivery_fee': deliveryFee,
          'notes': notes,
        })
        .select('id')
        .single();
    final orderId = row['id'] as String;
    if (items.isNotEmpty) {
      await _db.from('gh_order_items').insert(
            items.map((i) => {...i, 'order_id': orderId}).toList(),
          );
    }
    if (deposit > 0) {
      await _db.from('gh_payments').insert({
        'order_id': orderId,
        'amount': deposit,
        'method': depositMethod,
        'note': 'عربون',
      });
    }
    return orderId;
  }

  static Future<void> updateOrder(String id, Map<String, dynamic> data) async {
    await _db.from('gh_orders').update(data).eq('id', id);
  }

  static Future<void> deleteOrder(String id) async {
    await _db.from('gh_orders').delete().eq('id', id);
  }

  // ---------------- Items ----------------

  static Future<void> addItem(String orderId,
      {required String name, String? details, required double price}) async {
    await _db.from('gh_order_items').insert({
      'order_id': orderId,
      'name': name,
      'details': details,
      'price': price,
    });
  }

  static Future<void> updateItem(String id,
      {required String name, String? details, required double price}) async {
    await _db.from('gh_order_items').update({
      'name': name,
      'details': details,
      'price': price,
    }).eq('id', id);
  }

  static Future<void> deleteItem(String id) async {
    await _db.from('gh_order_items').delete().eq('id', id);
  }

  static Future<void> setItemStatus(OrderItem item, ItemStatus status) async {
    final data = <String, dynamic>{'status': status.name};
    final now = _now();
    if (status == ItemStatus.purchased && item.purchasedAt == null) {
      data['purchased_at'] = now;
    }
    if (status == ItemStatus.arrived) {
      if (item.purchasedAt == null) data['purchased_at'] = now;
      if (item.arrivedAt == null) data['arrived_at'] = now;
    }
    if (status == ItemStatus.delivered) {
      if (item.purchasedAt == null) data['purchased_at'] = now;
      if (item.arrivedAt == null) data['arrived_at'] = now;
      if (item.deliveredAt == null) data['delivered_at'] = now;
    }
    await _db.from('gh_order_items').update(data).eq('id', item.id);
  }

  /// Items not yet linked to a purchase invoice (to attach to a new one).
  static Future<List<OrderItem>> unlinkedItems() async {
    final rows = await _db
        .from('gh_order_items')
        .select('*, gh_orders(order_no, gh_customers(name))')
        .isFilter('purchase_invoice_id', null)
        .neq('status', 'cancelled')
        .order('created_at');
    return rows.map((e) => OrderItem.fromMap(e)).toList();
  }

  static Future<List<OrderItem>> itemsOfInvoice(String invoiceId) async {
    final rows = await _db
        .from('gh_order_items')
        .select('*, gh_orders(order_no, gh_customers(name))')
        .eq('purchase_invoice_id', invoiceId)
        .order('created_at');
    return rows.map((e) => OrderItem.fromMap(e)).toList();
  }

  // ---------------- Payments ----------------

  static Future<void> addPayment(String orderId,
      {required double amount,
      String? method,
      DateTime? paidOn,
      String? note}) async {
    await _db.from('gh_payments').insert({
      'order_id': orderId,
      'amount': amount,
      'method': method,
      'paid_on': _day(paidOn ?? DateTime.now()),
      'note': note,
    });
  }

  static Future<void> deletePayment(String id) async {
    await _db.from('gh_payments').delete().eq('id', id);
  }

  // ---------------- Purchase invoices ----------------

  static Future<List<PurchaseInvoice>> purchaseInvoices() async {
    final rows = await _db
        .from('gh_purchase_invoices')
        .select('*, gh_order_items(count)')
        .order('purchased_on', ascending: false);
    return rows.map((e) => PurchaseInvoice.fromMap(e)).toList();
  }

  static Future<String> savePurchaseInvoice({
    String? id,
    required String store,
    String? invoiceNo,
    required DateTime purchasedOn,
    String? country,
    required String currency,
    required double rate,
    required double totalAmount,
    String? notes,
  }) async {
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
    if (id == null) {
      final row = await _db
          .from('gh_purchase_invoices')
          .insert(data)
          .select('id')
          .single();
      return row['id'] as String;
    }
    await _db.from('gh_purchase_invoices').update(data).eq('id', id);
    // keep linked items' currency and rate in step with the invoice
    await _db
        .from('gh_order_items')
        .update({'cost_currency': currency, 'cost_rate': rate})
        .eq('purchase_invoice_id', id);
    return id;
  }

  static Future<void> deletePurchaseInvoice(String id) async {
    await _db.from('gh_order_items').update({
      'purchase_invoice_id': null,
      'cost_amount': null,
      'cost_currency': null,
      'cost_rate': null,
    }).eq('purchase_invoice_id', id);
    await _db.from('gh_purchase_invoices').delete().eq('id', id);
  }

  /// Links an item to an invoice with its cost (in the invoice currency) and
  /// marks it purchased if it was still waiting.
  static Future<void> linkItem({
    required OrderItem item,
    required String invoiceId,
    required double cost,
    required String currency,
    required double rate,
    required DateTime purchasedOn,
  }) async {
    final data = <String, dynamic>{
      'purchase_invoice_id': invoiceId,
      'cost_amount': cost,
      'cost_currency': currency,
      'cost_rate': rate,
    };
    if (item.status == ItemStatus.requested) {
      data['status'] = ItemStatus.purchased.name;
    }
    if (item.purchasedAt == null) {
      data['purchased_at'] = purchasedOn.toUtc().toIso8601String();
    }
    await _db.from('gh_order_items').update(data).eq('id', item.id);
  }

  static Future<void> unlinkItem(String itemId) async {
    await _db.from('gh_order_items').update({
      'purchase_invoice_id': null,
      'cost_amount': null,
      'cost_currency': null,
      'cost_rate': null,
    }).eq('id', itemId);
  }
}
