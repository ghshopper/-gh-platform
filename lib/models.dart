import 'package:flutter/material.dart';

import 'theme.dart';

double _d(dynamic v) {
  if (v == null) return 0;
  if (v is num) return v.toDouble();
  return double.tryParse(v.toString()) ?? 0;
}

double? _dn(dynamic v) {
  if (v == null) return null;
  if (v is num) return v.toDouble();
  return double.tryParse(v.toString());
}

DateTime? _dt(dynamic v) => v == null ? null : DateTime.tryParse(v.toString());

String? _s(dynamic v) {
  if (v == null) return null;
  final s = v.toString();
  return s.isEmpty ? null : s;
}

class Customer {
  Customer({
    required this.id,
    required this.name,
    this.phone,
    this.city,
    this.notes,
  });

  final String id;
  final String name;
  final String? phone;
  final String? city;
  final String? notes;

  factory Customer.fromMap(Map<String, dynamic> m) => Customer(
        id: m['id'] as String,
        name: (m['name'] ?? '').toString(),
        phone: _s(m['phone']),
        city: _s(m['city']),
        notes: _s(m['notes']),
      );
}

enum ItemStatus { requested, purchased, arrived, delivered, cancelled }

ItemStatus itemStatusFrom(String? s) => ItemStatus.values.firstWhere(
      (e) => e.name == s,
      orElse: () => ItemStatus.requested,
    );

extension ItemStatusX on ItemStatus {
  String get label {
    switch (this) {
      case ItemStatus.requested:
        return 'بانتظار الشراء';
      case ItemStatus.purchased:
        return 'تم الشراء';
      case ItemStatus.arrived:
        return 'وصلت مسقط';
      case ItemStatus.delivered:
        return 'تم التسليم';
      case ItemStatus.cancelled:
        return 'ملغية';
    }
  }

  String get english {
    switch (this) {
      case ItemStatus.requested:
        return 'Requested';
      case ItemStatus.purchased:
        return 'Purchased';
      case ItemStatus.arrived:
        return 'Arrived';
      case ItemStatus.delivered:
        return 'Delivered';
      case ItemStatus.cancelled:
        return 'Cancelled';
    }
  }

  Color get color {
    switch (this) {
      case ItemStatus.requested:
        return GH.muted;
      case ItemStatus.purchased:
        return GH.goldDark;
      case ItemStatus.arrived:
        return GH.green;
      case ItemStatus.delivered:
        return GH.burgundy;
      case ItemStatus.cancelled:
        return Colors.grey;
    }
  }

  /// The next step in the normal flow, or null when finished.
  ItemStatus? get next {
    switch (this) {
      case ItemStatus.requested:
        return ItemStatus.purchased;
      case ItemStatus.purchased:
        return ItemStatus.arrived;
      case ItemStatus.arrived:
        return ItemStatus.delivered;
      case ItemStatus.delivered:
      case ItemStatus.cancelled:
        return null;
    }
  }

  /// Button text for moving an item to this status.
  String get actionLabel {
    switch (this) {
      case ItemStatus.requested:
        return 'رجّعها مطلوبة';
      case ItemStatus.purchased:
        return 'اشتريتها';
      case ItemStatus.arrived:
        return 'وصلت مسقط';
      case ItemStatus.delivered:
        return 'سلّمتها';
      case ItemStatus.cancelled:
        return 'إلغاء القطعة';
    }
  }
}

/// Where an item was bought. Fixed tax-free rules per place.
enum PurchasePlace { boutiqueEu, airport, dubai, other }

PurchasePlace? purchasePlaceFrom(String? s) {
  switch (s) {
    case 'boutique_eu':
      return PurchasePlace.boutiqueEu;
    case 'airport':
      return PurchasePlace.airport;
    case 'dubai':
      return PurchasePlace.dubai;
    case 'other':
      return PurchasePlace.other;
  }
  return null;
}

extension PurchasePlaceX on PurchasePlace {
  String get key {
    switch (this) {
      case PurchasePlace.boutiqueEu:
        return 'boutique_eu';
      case PurchasePlace.airport:
        return 'airport';
      case PurchasePlace.dubai:
        return 'dubai';
      case PurchasePlace.other:
        return 'other';
    }
  }

  String get label {
    switch (this) {
      case PurchasePlace.boutiqueEu:
        return 'بوتيك أوروبا';
      case PurchasePlace.airport:
        return 'مطار (ديوتي فري)';
      case PurchasePlace.dubai:
        return 'دبي';
      case PurchasePlace.other:
        return 'مكان ثاني';
    }
  }

  /// Default currency for this place.
  String get currency {
    switch (this) {
      case PurchasePlace.boutiqueEu:
      case PurchasePlace.airport:
        return 'EUR';
      case PurchasePlace.dubai:
        return 'AED';
      case PurchasePlace.other:
        return 'EUR';
    }
  }

  /// Tax-free refund percentage you should get back.
  double get taxFreePct {
    switch (this) {
      case PurchasePlace.boutiqueEu:
        return 12;
      case PurchasePlace.dubai:
        return 4;
      case PurchasePlace.airport:
      case PurchasePlace.other:
        return 0;
    }
  }
}

class OrderItem {
  OrderItem({
    required this.id,
    required this.orderId,
    required this.name,
    this.details,
    required this.price,
    required this.status,
    this.purchaseInvoiceId,
    this.costAmount,
    this.costCurrency,
    this.costRate,
    this.purchasePlace,
    this.taxFreePct,
    this.taxFreeReceived = false,
    this.purchasedAt,
    this.arrivedAt,
    this.deliveredAt,
    this.createdAt,
    this.orderNo,
    this.customerName,
  });

  final String id;
  final String orderId;
  final String name;
  final String? details;
  final double price;
  final ItemStatus status;
  final String? purchaseInvoiceId;
  final double? costAmount;
  final String? costCurrency;
  final double? costRate;
  final PurchasePlace? purchasePlace;
  final double? taxFreePct;
  final bool taxFreeReceived;
  final DateTime? purchasedAt;
  final DateTime? arrivedAt;
  final DateTime? deliveredAt;
  final DateTime? createdAt;

  /// Filled only when items are loaded together with their order.
  final int? orderNo;
  final String? customerName;

  double? get costOmr =>
      (costAmount == null || costRate == null) ? null : costAmount! * costRate!;

  /// Tax-free refund expected for this item, in the purchase currency.
  double get taxFreeAmount {
    final pct = taxFreePct ?? 0;
    if (costAmount == null || pct <= 0) return 0;
    return costAmount! * pct / 100;
  }

  bool get hasTaxFree => taxFreeAmount > 0;

  factory OrderItem.fromMap(Map<String, dynamic> m) {
    int? orderNo;
    String? customerName;
    final o = m['gh_orders'];
    if (o is Map) {
      final n = o['order_no'];
      orderNo = n is num ? n.toInt() : int.tryParse('$n');
      final c = o['gh_customers'];
      if (c is Map) customerName = _s(c['name']);
    }
    return OrderItem(
      id: m['id'] as String,
      orderId: m['order_id'] as String,
      name: (m['name'] ?? '').toString(),
      details: _s(m['details']),
      price: _d(m['price']),
      status: itemStatusFrom(m['status'] as String?),
      purchaseInvoiceId: _s(m['purchase_invoice_id']),
      costAmount: _dn(m['cost_amount']),
      costCurrency: _s(m['cost_currency']),
      costRate: _dn(m['cost_rate']),
      purchasePlace: purchasePlaceFrom(m['purchase_place'] as String?),
      taxFreePct: _dn(m['tax_free_pct']),
      taxFreeReceived: m['tax_free_received'] == true,
      purchasedAt: _dt(m['purchased_at']),
      arrivedAt: _dt(m['arrived_at']),
      deliveredAt: _dt(m['delivered_at']),
      createdAt: _dt(m['created_at']),
      orderNo: orderNo,
      customerName: customerName,
    );
  }
}

class Payment {
  Payment({
    required this.id,
    required this.orderId,
    required this.amount,
    this.method,
    this.paidOn,
    this.note,
  });

  final String id;
  final String orderId;
  final double amount;
  final String? method;
  final DateTime? paidOn;
  final String? note;

  factory Payment.fromMap(Map<String, dynamic> m) => Payment(
        id: m['id'] as String,
        orderId: m['order_id'] as String,
        amount: _d(m['amount']),
        method: _s(m['method']),
        paidOn: _dt(m['paid_on']),
        note: _s(m['note']),
      );
}

class Order {
  Order({
    required this.id,
    required this.orderNo,
    required this.customerId,
    this.customer,
    this.trip,
    required this.deliveryFee,
    this.notes,
    this.createdAt,
    required this.items,
    required this.payments,
  });

  final String id;
  final int orderNo;
  final String customerId;
  final Customer? customer;
  final String? trip;
  final double deliveryFee;
  final String? notes;
  final DateTime? createdAt;
  final List<OrderItem> items;
  final List<Payment> payments;

  String get invoiceNo => 'GH-${orderNo.toString().padLeft(4, '0')}';
  String get customerName => customer?.name ?? '—';

  List<OrderItem> get activeItems =>
      items.where((i) => i.status != ItemStatus.cancelled).toList();

  double get itemsTotal =>
      activeItems.fold<double>(0, (sum, i) => sum + i.price);
  double get total => itemsTotal + deliveryFee;
  double get paid => payments.fold<double>(0, (sum, p) => sum + p.amount);
  double get remaining => total - paid;
  bool get hasBalance => remaining > 0.0005;

  double get costOmr =>
      activeItems.fold<double>(0, (sum, i) => sum + (i.costOmr ?? 0));

  /// What the customer transferred minus what you paid for her items.
  double get customerBalance => paid - costOmr;

  /// Tax-free still to collect, grouped by currency.
  Map<String, double> get taxFreePending {
    final map = <String, double>{};
    for (final i in activeItems) {
      if (!i.hasTaxFree || i.taxFreeReceived) continue;
      final c = i.costCurrency ?? 'EUR';
      map[c] = (map[c] ?? 0) + i.taxFreeAmount;
    }
    return map;
  }

  /// The least-advanced status among active items (what still needs doing).
  ItemStatus get overallStatus {
    final active = activeItems;
    if (active.isEmpty) return ItemStatus.cancelled;
    var minIndex = ItemStatus.delivered.index;
    for (final i in active) {
      if (i.status.index < minIndex) minIndex = i.status.index;
    }
    return ItemStatus.values[minIndex];
  }

  factory Order.fromMap(Map<String, dynamic> m) {
    final n = m['order_no'];
    final c = m['gh_customers'];
    final itemsRaw = (m['gh_order_items'] as List?) ?? const [];
    final paymentsRaw = (m['gh_payments'] as List?) ?? const [];
    final items = itemsRaw
        .map((e) => OrderItem.fromMap(Map<String, dynamic>.from(e as Map)))
        .toList()
      ..sort((a, b) => (a.createdAt ?? DateTime(2000))
          .compareTo(b.createdAt ?? DateTime(2000)));
    final payments = paymentsRaw
        .map((e) => Payment.fromMap(Map<String, dynamic>.from(e as Map)))
        .toList()
      ..sort((a, b) =>
          (a.paidOn ?? DateTime(2000)).compareTo(b.paidOn ?? DateTime(2000)));
    return Order(
      id: m['id'] as String,
      orderNo: n is num ? n.toInt() : int.tryParse('$n') ?? 0,
      customerId: m['customer_id'] as String,
      customer: c is Map ? Customer.fromMap(Map<String, dynamic>.from(c)) : null,
      trip: _s(m['trip']),
      deliveryFee: _d(m['delivery_fee']),
      notes: _s(m['notes']),
      createdAt: _dt(m['created_at']),
      items: items,
      payments: payments,
    );
  }
}

class PurchaseInvoice {
  PurchaseInvoice({
    required this.id,
    required this.store,
    this.invoiceNo,
    this.purchasedOn,
    this.country,
    required this.currency,
    required this.rate,
    required this.totalAmount,
    this.notes,
    this.itemCount = 0,
  });

  final String id;
  final String store;
  final String? invoiceNo;
  final DateTime? purchasedOn;
  final String? country;
  final String currency;
  final double rate;
  final double totalAmount;
  final String? notes;
  final int itemCount;

  double get totalOmr => totalAmount * rate;

  factory PurchaseInvoice.fromMap(Map<String, dynamic> m) {
    var count = 0;
    final items = m['gh_order_items'];
    if (items is List && items.isNotEmpty) {
      final first = items.first;
      if (first is Map && first['count'] != null) {
        final c = first['count'];
        count = c is num ? c.toInt() : int.tryParse('$c') ?? 0;
      } else {
        count = items.length;
      }
    }
    return PurchaseInvoice(
      id: m['id'] as String,
      store: (m['store'] ?? '').toString(),
      invoiceNo: _s(m['invoice_no']),
      purchasedOn: _dt(m['purchased_on']),
      country: _s(m['country']),
      currency: (m['currency'] ?? 'EUR').toString(),
      rate: _d(m['exchange_rate']),
      totalAmount: _d(m['total_amount']),
      notes: _s(m['notes']),
      itemCount: count,
    );
  }
}

/// Default exchange rates (OMR per one unit). Editable on every invoice.
const Map<String, double> defaultRates = {
  'EUR': 0.42,
  'GBP': 0.49,
  'USD': 0.385,
  'CHF': 0.44,
  'AED': 0.105,
  'SAR': 0.1026,
  'OMR': 1.0,
};
