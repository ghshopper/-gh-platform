import 'package:flutter/cupertino.dart';

import 'ui/colors.dart';

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

String _two(int v) => v.toString().padLeft(2, '0');

/// GH-MM-DD-NNN: month and day the order was created, then its number.
String invoiceNumber(int orderNo, DateTime? createdAt) {
  final d = (createdAt ?? DateTime.now()).toLocal();
  return 'GH-${_two(d.month)}-${_two(d.day)}-${orderNo.toString().padLeft(3, '0')}';
}

// ───────────────────────── Customers ─────────────────────────

class Customer {
  Customer({
    required this.id,
    required this.name,
    this.phone,
    this.city,
    this.address,
    this.notes,
    this.isMale = false,
    this.loyaltyPoints = 0,
    this.loyaltyTier,
  });

  final String id;
  final String name;

  /// Points and tier from the customer app / website (0 / null if none).
  final int loyaltyPoints;
  final String? loyaltyTier;
  final String? phone;
  final String? city;

  /// Default delivery address (area, street, house, or a maps link).
  final String? address;
  final String? notes;

  /// Used to word messages ("طلبكَ" / "طلبكِ").
  final bool isMale;

  String get firstName {
    final n = name.trim();
    return n.isEmpty ? '' : n.split(' ').first;
  }

  factory Customer.fromMap(Map<String, dynamic> m) => Customer(
        id: m['id'].toString(),
        name: (m['name'] ?? '').toString(),
        phone: _s(m['phone']),
        city: _s(m['city']),
        address: _s(m['address']),
        notes: _s(m['notes']),
        isMale: m['gender'] == 'm',
        loyaltyPoints: (m['loyalty_points'] is num)
            ? (m['loyalty_points'] as num).toInt()
            : int.tryParse('${m['loyalty_points'] ?? ''}') ?? 0,
        loyaltyTier: _s(m['loyalty_tier']),
      );
}

// ───────────────────────── Settings ─────────────────────────

/// Business details printed on invoices; edited in Settings.
class BusinessSettings {
  BusinessSettings({
    this.companyName,
    this.companyNameEn,
    this.crNumber,
    this.taxNumber,
    this.phone,
    this.instagram,
    this.address,
    this.bankDetails,
    this.invoiceNote,
    this.deliveryHomeFee = 2,
    this.deliveryOfficeFee = 1,
    this.eta = EtaRule.defaults,
  });

  /// Delivery time per origin ('oman', 'dubai', 'europe'), shown to customers.
  final Map<String, EtaRule> eta;

  final String? companyName;
  final String? companyNameEn;
  final String? crNumber;
  final String? taxNumber;
  final String? phone;
  final String? instagram;
  final String? address;
  final String? bankDetails;
  final String? invoiceNote;

  /// Fixed delivery prices inside Muscat.
  final double deliveryHomeFee;
  final double deliveryOfficeFee;

  /// Door delivery (our driver or a courier) uses the home fee; pickup at a
  /// courier's branch uses the branch fee.
  double feeFor(DeliveryMethod? m) {
    if (m == null) return 0;
    if (m == DeliveryMethod.office || m.toBranch) return deliveryOfficeFee;
    return deliveryHomeFee;
  }

  factory BusinessSettings.fromMap(Map<String, dynamic> m) => BusinessSettings(
        companyName: _s(m['company_name']),
        companyNameEn: _s(m['company_name_en']),
        crNumber: _s(m['cr_number']),
        taxNumber: _s(m['tax_number']),
        phone: _s(m['phone']),
        instagram: _s(m['instagram']),
        address: _s(m['address']),
        bankDetails: _s(m['bank_details']),
        invoiceNote: _s(m['invoice_note']),
        deliveryHomeFee: m['delivery_home_fee'] == null ? 2 : _d(m['delivery_home_fee']),
        deliveryOfficeFee:
            m['delivery_office_fee'] == null ? 1 : _d(m['delivery_office_fee']),
        eta: EtaRule.parse(m['delivery_eta']),
      );
}

/// How long delivery takes from one origin: [min]–[max] working days
/// (Sun–Thu) or calendar days.
class EtaRule {
  const EtaRule(this.min, this.max, {this.workDays = true});

  final int min;
  final int max;
  final bool workDays;

  static const origins = {'dubai': 'من دبي', 'europe': 'من أوروبا', 'oman': 'متوفر في عُمان'};

  static const defaults = {
    'oman': EtaRule(1, 2),
    'dubai': EtaRule(4, 4),
    'europe': EtaRule(7, 12, workDays: false),
  };

  static Map<String, EtaRule> parse(dynamic raw) {
    final out = Map<String, EtaRule>.of(defaults);
    if (raw is Map) {
      for (final k in defaults.keys) {
        final v = raw[k];
        if (v is Map) {
          final min = int.tryParse('${v['min']}') ?? defaults[k]!.min;
          final max = int.tryParse('${v['max']}') ?? defaults[k]!.max;
          out[k] = EtaRule(min, max < min ? min : max, workDays: v['unit'] != 'days');
        }
      }
    }
    return out;
  }

  Map<String, dynamic> toJson() => {'min': min, 'max': max, 'unit': workDays ? 'work' : 'days'};

  /// "4 أيام عمل" · "7–12 يوم"
  String get label {
    final n = min == max ? '$max' : '$min–$max';
    if (workDays) return max == 1 ? 'يوم عمل' : '$n أيام عمل';
    return max == 1 ? 'يوم' : '$n ${max <= 10 ? 'أيام' : 'يوم'}';
  }
}

/// How an order reaches the customer.
/// home = our driver to the door (Muscat). Couriers (Nool, Genacom) either
/// deliver to the door or the customer picks up at their branch.
/// [office] is legacy (old orders only, not offered any more).
/// gccGenacom / gccDhl = shipping to another Gulf country (door delivery).
enum DeliveryMethod { home, office, nool, noolOffice, genacom, genacomOffice, gccGenacom, gccDhl }

/// Who carries the parcel.
enum Carrier { own, nool, genacom, dhl }

extension CarrierX on Carrier {
  String get label => switch (this) {
        Carrier.own => 'مندوبنا',
        Carrier.nool => 'نول',
        Carrier.genacom => 'جيناكم',
        Carrier.dhl => 'DHL',
      };
}

DeliveryMethod? deliveryMethodFrom(String? v) {
  for (final m in DeliveryMethod.values) {
    if (m.key == v) return m;
  }
  return null;
}

/// The method for a carrier and destination (branch pickup or door).
DeliveryMethod deliveryMethodOf(Carrier c, {required bool branch}) =>
    switch (c) {
      Carrier.own => DeliveryMethod.home,
      Carrier.nool => branch ? DeliveryMethod.noolOffice : DeliveryMethod.nool,
      Carrier.genacom =>
        branch ? DeliveryMethod.genacomOffice : DeliveryMethod.genacom,
      Carrier.dhl => DeliveryMethod.gccDhl,
    };

extension DeliveryMethodX on DeliveryMethod {
  /// Value stored on the server.
  String get key => switch (this) {
        DeliveryMethod.noolOffice => 'nool_office',
        DeliveryMethod.genacomOffice => 'genacom_office',
        DeliveryMethod.gccGenacom => 'gcc_genacom',
        DeliveryMethod.gccDhl => 'gcc_dhl',
        _ => name,
      };

  Carrier get carrier => switch (this) {
        DeliveryMethod.nool || DeliveryMethod.noolOffice => Carrier.nool,
        DeliveryMethod.genacom ||
        DeliveryMethod.genacomOffice ||
        DeliveryMethod.gccGenacom =>
          Carrier.genacom,
        DeliveryMethod.gccDhl => Carrier.dhl,
        _ => Carrier.own,
      };

  /// Shipped to another Gulf country.
  bool get isGulf =>
      this == DeliveryMethod.gccGenacom || this == DeliveryMethod.gccDhl;

  /// Customer collects from the courier's branch.
  bool get toBranch =>
      this == DeliveryMethod.noolOffice ||
      this == DeliveryMethod.genacomOffice;

  /// Carrier name only (for "شحن مع …").
  String get carrierName => carrier.label;

  String get label => switch (this) {
        DeliveryMethod.home => 'مندوبنا · للبيت',
        DeliveryMethod.office => 'إلى المكتب',
        DeliveryMethod.nool => 'نول · للبيت',
        DeliveryMethod.noolOffice => 'نول · من الفرع',
        DeliveryMethod.genacom => 'جيناكم · للبيت',
        DeliveryMethod.genacomOffice => 'جيناكم · من الفرع',
        DeliveryMethod.gccGenacom => 'جيناكم · شحن خليجي',
        DeliveryMethod.gccDhl => 'DHL · شحن خليجي',
      };

  /// A shipping company (own shipment number / tracking link, no driver).
  bool get isCourier => carrier != Carrier.own;
}

// ───────────────────────── Trips ─────────────────────────

class Trip {
  Trip({
    required this.id,
    required this.name,
    this.destination,
    this.startsOn,
    this.endsOn,
    this.notes,
  });

  final String id;
  final String name;
  final String? destination;
  final DateTime? startsOn;
  final DateTime? endsOn;
  final String? notes;

  factory Trip.fromMap(Map<String, dynamic> m) => Trip(
        id: m['id'].toString(),
        name: (m['name'] ?? '').toString(),
        destination: _s(m['destination']),
        startsOn: _dt(m['starts_on']),
        endsOn: _dt(m['ends_on']),
        notes: _s(m['notes']),
      );
}

class TripExpense {
  TripExpense({
    required this.id,
    this.tripId,
    required this.title,
    required this.amount,
    required this.currency,
    required this.rate,
    this.spentOn,
  });

  final String id;

  /// null for a general business expense (not tied to a trip).
  final String? tripId;
  final String title;
  final double amount;
  final String currency;
  final double rate;
  final DateTime? spentOn;

  double get omr => amount * rate;

  factory TripExpense.fromMap(Map<String, dynamic> m) => TripExpense(
        id: m['id'].toString(),
        tripId: _s(m['trip_id']),
        title: (m['title'] ?? '').toString(),
        amount: _d(m['amount']),
        currency: (m['currency'] ?? 'OMR').toString(),
        rate: _d(m['exchange_rate']),
        spentOn: _dt(m['spent_on']),
      );
}

// ───────────────────────── Items ─────────────────────────

enum ItemStatus { requested, purchased, arrived, outForDelivery, delivered, cancelled }

ItemStatus itemStatusFrom(String? s) => ItemStatus.values.firstWhere(
      (e) => e.key == s,
      orElse: () => ItemStatus.requested,
    );

extension ItemStatusX on ItemStatus {
  /// Name used by the server.
  String get key => this == ItemStatus.outForDelivery ? 'out_for_delivery' : name;

  String get label {
    switch (this) {
      case ItemStatus.requested:
        return 'بانتظار الشراء';
      case ItemStatus.purchased:
        return 'تم الشراء';
      case ItemStatus.arrived:
        return 'وصلت مسقط';
      case ItemStatus.outForDelivery:
        return 'خرجت للتوصيل';
      case ItemStatus.delivered:
        return 'تم التسليم';
      case ItemStatus.cancelled:
        return 'ملغية';
    }
  }

  Color get color {
    switch (this) {
      case ItemStatus.requested:
        return GH.statusRequested;
      case ItemStatus.purchased:
        return GH.statusPurchased;
      case ItemStatus.arrived:
        return GH.statusArrived;
      case ItemStatus.outForDelivery:
        return GH.teal;
      case ItemStatus.delivered:
        return GH.statusDelivered;
      case ItemStatus.cancelled:
        return CupertinoColors.systemGrey;
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
        return ItemStatus.outForDelivery;
      case ItemStatus.outForDelivery:
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
        return 'رجّعها بانتظار الشراء';
      case ItemStatus.purchased:
        return 'اشتريتها';
      case ItemStatus.arrived:
        return 'وصلت مسقط';
      case ItemStatus.outForDelivery:
        return 'طلعت للتوصيل';
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
        return 'مطار';
      case PurchasePlace.dubai:
        return 'دبي';
      case PurchasePlace.other:
        return 'مكان ثاني';
    }
  }

  String get currency {
    switch (this) {
      case PurchasePlace.boutiqueEu:
      case PurchasePlace.airport:
      case PurchasePlace.other:
        return 'EUR';
      case PurchasePlace.dubai:
        return 'AED';
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
    this.brand,
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
    this.listPrice,
    this.listCurrency,
    this.planPlace,
    this.planStore,
    this.estCost,
    this.estCurrency,
    this.estRate,
    this.commissionPct,
    this.photoPath,
    this.receiptPath,
    this.purchasedAt,
    this.arrivedAt,
    this.deliveredAt,
    this.createdAt,
  });

  final String id;
  final String orderId;
  final String name;
  final String? brand;
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
  /// Price as quoted to the customer in a foreign currency (private).
  final double? listPrice;
  final String? listCurrency;
  /// The buying plan, before the trip: where and roughly how much (private).
  final PurchasePlace? planPlace;
  final String? planStore;
  final double? estCost;
  final String? estCurrency;
  final double? estRate;
  final double? commissionPct;
  final String? photoPath;
  final String? receiptPath;
  final DateTime? purchasedAt;
  final DateTime? arrivedAt;
  final DateTime? deliveredAt;
  final DateTime? createdAt;

  String get title => brand == null ? name : '$brand · $name';

  double? get costOmr =>
      (costAmount == null || costRate == null) ? null : costAmount! * costRate!;

  /// Tax-free refund expected for this item, in the purchase currency.
  double get taxFreeAmount {
    final pct = taxFreePct ?? 0;
    if (costAmount == null || pct <= 0) return 0;
    return costAmount! * pct / 100;
  }

  bool get hasTaxFree => taxFreeAmount > 0;

  bool get hasPlan => planStore != null || planPlace != null || estCost != null;

  /// What it should cost before it's bought: the planned estimate, else the
  /// boutique price from the quote. Null when neither is known.
  ({double amount, String currency, bool fromList})? get estimate {
    if (estCost != null && estCost! > 0 && estCurrency != null) {
      return (amount: estCost!, currency: estCurrency!, fromList: false);
    }
    if (listPrice != null && listPrice! > 0 && listCurrency != null) {
      return (amount: listPrice!, currency: listCurrency!, fromList: true);
    }
    return null;
  }

  factory OrderItem.fromMap(Map<String, dynamic> m) => OrderItem(
        id: m['id'].toString(),
        orderId: m['order_id'].toString(),
        name: (m['name'] ?? '').toString(),
        brand: _s(m['brand']),
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
        listPrice: _dn(m['list_price']),
        listCurrency: _s(m['list_currency']),
        planPlace: purchasePlaceFrom(m['plan_place'] as String?),
        planStore: _s(m['plan_store']),
        estCost: _dn(m['est_cost']),
        estCurrency: _s(m['est_currency']),
        estRate: _dn(m['est_rate']),
        commissionPct: _dn(m['commission_pct']),
        photoPath: _s(m['photo_path']),
        receiptPath: _s(m['receipt_path']),
        purchasedAt: _dt(m['purchased_at']),
        arrivedAt: _dt(m['arrived_at']),
        deliveredAt: _dt(m['delivered_at']),
        createdAt: _dt(m['created_at']),
      );
}

// ───────────────────────── Payments ─────────────────────────

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
        id: m['id'].toString(),
        orderId: m['order_id'].toString(),
        amount: _d(m['amount']),
        method: _s(m['method']),
        paidOn: _dt(m['paid_on']),
        note: _s(m['note']),
      );
}

// ───────────────────────── Orders ─────────────────────────

class Order {
  Order({
    required this.id,
    required this.orderNo,
    this.refNo,
    required this.customerId,
    this.tripId,
    this.trackingToken,
    this.trip,
    required this.deliveryFee,
    this.notes,
    this.createdAt,
    required this.items,
    required this.payments,
    this.driverId,
    this.deliveryAddress,
    this.deliveryCollect = false,
    this.driverStatus,
    this.driverNote,
    this.deliveryPhotoPath,
    this.driverDeliveredAt,
    this.labelPrintedAt,
    this.events = const [],
    this.deliveryMethod,
    this.carrierTracking,
    this.storeOrderNumber,
    this.codAmount,
    this.discount = 0,
    this.discountLabel,
    this.tax = 0,
    this.storeSource,
    this.paidOnline = false,
  });

  final String id;
  final int orderNo;

  /// The short number from the server (191001 = 19 Oct, first order).
  final String? refNo;
  final String customerId;
  final String? tripId;
  final String? trackingToken;

  /// Free-text trip name from before trips existed.
  final String? trip;
  final double deliveryFee;
  final String? notes;
  final DateTime? createdAt;
  final List<OrderItem> items;
  final List<Payment> payments;

  // Delivery by a driver
  final String? driverId;
  final String? deliveryAddress;

  /// true: the driver collects the delivery fee from the customer.
  final bool deliveryCollect;
  final DriverStatus? driverStatus;
  final String? driverNote;
  final String? deliveryPhotoPath;
  final DateTime? driverDeliveredAt;
  final DateTime? labelPrintedAt;
  final DeliveryMethod? deliveryMethod;

  /// Set when the order came from the website / customer app.
  final String? storeOrderNumber;
  bool get fromStore => storeOrderNumber != null;

  /// 'app' or 'web' for online orders.
  final String? storeSource;
  String get sourceLabel => storeSource == 'app' ? 'من التطبيق' : 'من الموقع';

  /// Paid online by card / Apple Pay (Amwal).
  final bool paidOnline;

  /// Cash the driver collects for a cash-on-delivery website order.
  final double? codAmount;

  /// Discount code / loyalty discount and tax from the website or app order
  /// (kept on the order, not as item lines).
  final double discount;
  final String? discountLabel;
  final double tax;

  /// What the driver collects at the door.
  double get toCollect =>
      codAmount ?? (deliveryCollect && deliveryFee > 0 ? deliveryFee : 0);

  /// Shipment number or tracking link from Nool / Genacom.
  final String? carrierTracking;

  bool get carrierIsLink =>
      carrierTracking != null && carrierTracking!.startsWith(RegExp(r'https?://'));

  /// What happened to the order, oldest first.
  final List<OrderEvent> events;

  /// Shipping label number, e.g. GH-000123.
  String get waybillNo => 'GH-${orderNo.toString().padLeft(6, '0')}';

  String get invoiceNo => (refNo != null && refNo!.isNotEmpty) ? refNo! : invoiceNumber(orderNo, createdAt);

  List<OrderItem> get activeItems =>
      items.where((i) => i.status != ItemStatus.cancelled).toList();

  double get itemsTotal =>
      activeItems.fold<double>(0, (sum, i) => sum + i.price);
  double get total => itemsTotal + deliveryFee + tax - discount;

  /// What the pieces sold for after the discount (tax and delivery aside).
  double get netSales => itemsTotal - discount;

  /// Estimated profit on the pieces, after the discount.
  double get itemProfit => netSales - costOmr;
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
    final itemsRaw = (m['items'] ?? m['gh_order_items']) as List? ?? const [];
    final paymentsRaw = (m['payments'] ?? m['gh_payments']) as List? ?? const [];
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
      id: m['id'].toString(),
      orderNo: n is num ? n.toInt() : int.tryParse('$n') ?? 0,
      refNo: _s(m['ref_no']),
      customerId: m['customer_id'].toString(),
      tripId: _s(m['trip_id']),
      trackingToken: _s(m['tracking_token']),
      trip: _s(m['trip']),
      deliveryFee: _d(m['delivery_fee']),
      notes: _s(m['notes']),
      createdAt: _dt(m['created_at']),
      items: items,
      payments: payments,
      driverId: _s(m['driver_id']),
      deliveryAddress: _s(m['delivery_address']),
      deliveryCollect: m['delivery_collect'] == true,
      driverStatus: driverStatusFrom(m['driver_status'] as String?),
      driverNote: _s(m['driver_note']),
      deliveryPhotoPath: _s(m['delivery_photo_path']),
      driverDeliveredAt: _dt(m['driver_delivered_at']),
      labelPrintedAt: _dt(m['label_printed_at']),
      deliveryMethod: deliveryMethodFrom(m['delivery_method'] as String?),
      carrierTracking: _s(m['carrier_tracking']),
      storeOrderNumber: _s(m['store_order_number']),
      codAmount: m['cod_amount'] == null ? null : _d(m['cod_amount']),
      discount: _d(m['discount']),
      discountLabel: _s(m['discount_label']),
      tax: _d(m['tax']),
      storeSource: _s(m['store_source']),
      paidOnline: m['store_paid_online'] == true,
      events: ((m['events'] as List?) ?? const [])
          .map((e) => OrderEvent.fromMap(Map<String, dynamic>.from(e as Map)))
          .toList(),
    );
  }
}

/// One step in an order's history (created, purchased, picked up…).
class OrderEvent {
  OrderEvent({required this.type, this.note, this.at});

  final String type;
  final String? note;
  final DateTime? at;

  String get label => switch (type) {
        'created' => 'تم إنشاء الطلب',
        'purchased' => 'تم الشراء',
        'shipped' => 'في الطريق لعُمان',
        'arrived' => 'وصل مسقط',
        'out_for_delivery' => 'خرج للتوصيل',
        'label' => 'طُبعت البوليصة',
        'assigned' => 'سُلّم للمندوب',
        'unassigned' => 'سُحب من المندوب',
        'picked' => 'المندوب استلم الطلب',
        'delivered' => 'تم التسليم',
        'cancelled' => 'إلغاء',
        'requested' => 'رجع لانتظار الشراء',
        'paid' => 'دفع أونلاين',
        'returned' => 'مرتجع',
        _ => type,
      };

  IconData get icon => switch (type) {
        'created' => CupertinoIcons.doc_text_fill,
        'purchased' => CupertinoIcons.bag_fill,
        'arrived' => CupertinoIcons.airplane,
        'shipped' => CupertinoIcons.paperplane_fill,
        'label' => CupertinoIcons.barcode,
        'assigned' || 'unassigned' => CupertinoIcons.person_fill,
        'picked' || 'out_for_delivery' => CupertinoIcons.car_detailed,
        'delivered' => CupertinoIcons.checkmark_seal_fill,
        'cancelled' => CupertinoIcons.xmark_circle_fill,
        'paid' => CupertinoIcons.creditcard_fill,
        'returned' => CupertinoIcons.arrow_uturn_left_circle_fill,
        _ => CupertinoIcons.circle_fill,
      };

  Color get color => switch (type) {
        'purchased' => GH.statusPurchased,
        'arrived' => GH.statusArrived,
        'shipped' => GH.teal,
        'assigned' || 'picked' => GH.blue,
        'out_for_delivery' => GH.teal,
        'delivered' => GH.statusDelivered,
        'cancelled' => GH.red,
        'paid' => GH.green,
        'returned' => GH.amber,
        _ => GH.secondary,
      };

  factory OrderEvent.fromMap(Map<String, dynamic> m) => OrderEvent(
        type: (m['type'] ?? '').toString(),
        note: _s(m['note']),
        at: _dt(m['at']),
      );
}

// ───────────────────────── Drivers ─────────────────────────

enum DriverStatus { assigned, picked, delivered }

DriverStatus? driverStatusFrom(String? v) {
  for (final s in DriverStatus.values) {
    if (s.name == v) return s;
  }
  return null;
}

extension DriverStatusX on DriverStatus {
  String get label => switch (this) {
        DriverStatus.assigned => 'عند المندوب',
        DriverStatus.picked => 'في الطريق',
        DriverStatus.delivered => 'تم التسليم',
      };

  Color get color => switch (this) {
        DriverStatus.assigned => GH.blue,
        DriverStatus.picked => GH.amber,
        DriverStatus.delivered => GH.green,
      };
}

class Driver {
  Driver({
    required this.id,
    required this.name,
    this.phone,
    this.userId,
    this.active = true,
  });

  final String id;
  final String name;
  final String? phone;
  final String? userId;
  final bool active;

  factory Driver.fromMap(Map<String, dynamic> m) => Driver(
        id: m['id'].toString(),
        name: (m['name'] ?? '').toString(),
        phone: _s(m['phone']),
        userId: _s(m['user_id']),
        active: m['active'] != false,
      );
}

/// An order as a driver sees it (from gh_driver_orders): no prices.
class DriverOrder {
  DriverOrder({
    required this.id,
    required this.invoiceNo,
    required this.customerName,
    this.customerPhone,
    this.customerCity,
    this.address,
    required this.deliveryFee,
    required this.collect,
    this.status,
    this.note,
    this.photoPath,
    this.photoUrl,
    this.deliveredAt,
    this.waybillNo,
    this.customerIsMale = false,
    this.codAmount,
    required this.items,
  });

  final String id;
  final String invoiceNo;
  final String customerName;
  final String? customerPhone;
  final String? customerCity;
  final String? address;
  final double deliveryFee;
  final bool collect;
  final DriverStatus? status;
  final String? note;
  final String? photoPath;

  /// Temporary link to the delivery photo (from the server).
  final String? photoUrl;
  final DateTime? deliveredAt;
  final String? waybillNo;
  final bool customerIsMale;
  final double? codAmount;

  /// What to collect at the door: the order (cash on delivery) or the fee.
  double get toCollect => codAmount ?? (collect && deliveryFee > 0 ? deliveryFee : 0);
  bool get isCod => codAmount != null;
  final List<({String? brand, String name, String? details})> items;

  bool get isDone => status == DriverStatus.delivered;

  factory DriverOrder.fromMap(Map<String, dynamic> m) {
    final n = m['order_no'];
    return DriverOrder(
      id: m['id'].toString(),
      invoiceNo: _s(m['ref_no']) ?? invoiceNumber(
          n is num ? n.toInt() : int.tryParse('$n') ?? 0, _dt(m['created_at'])),
      customerName: (m['customer_name'] ?? '').toString(),
      customerPhone: _s(m['customer_phone']),
      customerCity: _s(m['customer_city']),
      address: _s(m['address']),
      deliveryFee: _d(m['delivery_fee']),
      collect: m['delivery_collect'] == true,
      status: driverStatusFrom(m['driver_status'] as String?),
      note: _s(m['driver_note']),
      photoPath: _s(m['delivery_photo_path']),
      photoUrl: _s(m['delivery_photo_url']),
      waybillNo: _s(m['waybill_no']),
      customerIsMale: m['customer_gender'] == 'm',
      codAmount: m['cod_amount'] == null ? null : _d(m['cod_amount']),
      deliveredAt: _dt(m['driver_delivered_at']),
      items: ((m['items'] as List?) ?? const [])
          .map((e) => Map<String, dynamic>.from(e as Map))
          .map((e) => (
                brand: _s(e['brand']),
                name: (e['name'] ?? '').toString(),
                details: _s(e['details']),
              ))
          .toList(),
    );
  }
}

// ───────────────────────── Purchase invoices ─────────────────────────

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

  double get totalOmr => totalAmount * rate;

  factory PurchaseInvoice.fromMap(Map<String, dynamic> m) => PurchaseInvoice(
        id: m['id'].toString(),
        store: (m['store'] ?? '').toString(),
        invoiceNo: _s(m['invoice_no']),
        purchasedOn: _dt(m['purchased_on']),
        country: _s(m['country']),
        currency: (m['currency'] ?? 'EUR').toString(),
        rate: _d(m['exchange_rate']),
        totalAmount: _d(m['total_amount']),
        notes: _s(m['notes']),
      );
}

/// Fallback exchange rates (OMR per one unit) when the live rate isn't loaded.
const Map<String, double> defaultRates = {
  'EUR': 0.42,
  'AED': 0.105,
  'GBP': 0.49,
  'USD': 0.385,
  'CHF': 0.44,
  'SAR': 0.1026,
  'OMR': 1.0,
};


// ───────────────────────── Piece requests ─────────────────────────

/// A customer's "find me this piece" request from the app or website.
class PieceRequest {
  PieceRequest({
    required this.id,
    required this.customerName,
    this.customerPhone,
    required this.name,
    this.brand,
    this.category,
    this.description,
    this.url,
    this.imageUrl,
    required this.status,
    this.orderId,
    this.createdAt,
  });

  final String id;
  final String customerName;
  final String? customerPhone;
  final String name;
  final String? brand;
  final String? category;
  final String? description;
  final String? url;
  final String? imageUrl;
  final String status; // pending, reviewing, found, not_found, ordered, cancelled
  final String? orderId;
  final DateTime? createdAt;

  bool get isOpen => const ['pending', 'reviewing', 'found'].contains(status);

  String get statusLabel => switch (status) {
        'pending' => 'جديد',
        'reviewing' => 'قيد البحث',
        'found' => 'لقيناها',
        'not_found' => 'غير متوفرة',
        'ordered' => 'تحوّل لطلب',
        'cancelled' => 'ملغي',
        _ => status,
      };

  Color get statusColor => switch (status) {
        'pending' => GH.blue,
        'reviewing' => GH.amber,
        'found' => GH.green,
        'ordered' => GH.burgundy,
        _ => GH.secondary,
      };

  factory PieceRequest.fromMap(Map<String, dynamic> m) => PieceRequest(
        id: m['id'].toString(),
        customerName: (m['customer_name'] ?? '').toString(),
        customerPhone: _s(m['customer_phone']),
        name: (m['name'] ?? '').toString(),
        brand: _s(m['brand']),
        category: _s(m['category']),
        description: _s(m['description']),
        url: _s(m['url']),
        imageUrl: _s(m['image_url']),
        status: (m['status'] ?? 'pending').toString(),
        orderId: _s(m['order_id']),
        createdAt: _dt(m['created_at']),
      );
}
