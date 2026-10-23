import SwiftUI

private func two(_ v: Int) -> String { String(format: "%02d", v) }

/// GH-MM-DD-NNN: month and day the order was created, then its number.
func invoiceNumber(_ orderNo: Int, _ createdAt: Date?) -> String {
    let c = Calendar(identifier: .gregorian).dateComponents([.month, .day], from: createdAt ?? Date())
    return "GH-\(two(c.month ?? 1))-\(two(c.day ?? 1))-\(String(format: "%03d", orderNo))"
}

// MARK: - Customers

struct Customer: Identifiable, Hashable {
    let id: String
    var name: String
    var phone: String?
    var city: String?
    /// Default delivery address (area, street, house, or a maps link).
    var address: String?
    var notes: String?
    /// Used to word messages ("طلبكَ" / "طلبكِ").
    var isMale: Bool = false
    /// Points and tier from the customer app / website.
    var loyaltyPoints: Int = 0
    var loyaltyTier: String?

    var firstName: String {
        let n = name.trimmingCharacters(in: .whitespaces)
        return n.isEmpty ? "" : String(n.split(separator: " ").first ?? "")
    }

    init(id: String, name: String, phone: String? = nil, city: String? = nil, address: String? = nil,
         notes: String? = nil, isMale: Bool = false, loyaltyPoints: Int = 0, loyaltyTier: String? = nil) {
        self.id = id; self.name = name; self.phone = phone; self.city = city; self.address = address
        self.notes = notes; self.isMale = isMale; self.loyaltyPoints = loyaltyPoints; self.loyaltyTier = loyaltyTier
    }

    init(_ m: JSON) {
        id = jstr(m["id"])
        name = jstr(m["name"])
        phone = js(m["phone"])
        city = js(m["city"])
        address = js(m["address"])
        notes = js(m["notes"])
        isMale = js(m["gender"]) == "m"
        loyaltyPoints = ji(m["loyalty_points"])
        loyaltyTier = js(m["loyalty_tier"])
    }
}

// MARK: - Settings

/// How long delivery takes from one origin: min–max working days (Sun–Thu) or calendar days.
struct EtaRule: Hashable {
    var min: Int
    var max: Int
    var workDays: Bool = true

    static let origins: [(key: String, label: String)] = [("dubai", "من دبي"), ("europe", "من أوروبا"), ("oman", "متوفر في عُمان")]
    static let defaults: [String: EtaRule] = [
        "oman": EtaRule(min: 1, max: 2),
        "dubai": EtaRule(min: 4, max: 4),
        "europe": EtaRule(min: 7, max: 12, workDays: false),
    ]

    static func parse(_ raw: Any?) -> [String: EtaRule] {
        var out = defaults
        if let m = raw as? JSON {
            for k in defaults.keys {
                if let v = m[k] as? JSON {
                    let mn = Int(jstr(v["min"])) ?? defaults[k]!.min
                    let mx = Int(jstr(v["max"])) ?? defaults[k]!.max
                    out[k] = EtaRule(min: mn, max: mx < mn ? mn : mx, workDays: js(v["unit"]) != "days")
                }
            }
        }
        return out
    }

    var json: JSON { ["min": min, "max": max, "unit": workDays ? "work" : "days"] }

    /// "4 أيام عمل" · "7–12 يوم"
    var label: String {
        let n = min == max ? "\(max)" : "\(min)–\(max)"
        if workDays { return max == 1 ? "يوم عمل" : "\(n) أيام عمل" }
        return max == 1 ? "يوم" : "\(n) \(max <= 10 ? "أيام" : "يوم")"
    }
}

/// Business details printed on invoices; edited in Settings.
struct BusinessSettings: Hashable {
    var companyName: String?
    var companyNameEn: String?
    var crNumber: String?
    var taxNumber: String?
    var phone: String?
    var instagram: String?
    var address: String?
    var bankDetails: String?
    var invoiceNote: String?
    /// Fixed delivery prices inside Muscat.
    var deliveryHomeFee: Double = 2
    var deliveryOfficeFee: Double = 1
    /// Delivery time per origin ("oman", "dubai", "europe").
    var eta: [String: EtaRule] = EtaRule.defaults

    init() {}

    init(_ m: JSON) {
        companyName = js(m["company_name"])
        companyNameEn = js(m["company_name_en"])
        crNumber = js(m["cr_number"])
        taxNumber = js(m["tax_number"])
        phone = js(m["phone"])
        instagram = js(m["instagram"])
        address = js(m["address"])
        bankDetails = js(m["bank_details"])
        invoiceNote = js(m["invoice_note"])
        deliveryHomeFee = m["delivery_home_fee"] == nil || m["delivery_home_fee"] is NSNull ? 2 : jd(m["delivery_home_fee"])
        deliveryOfficeFee = m["delivery_office_fee"] == nil || m["delivery_office_fee"] is NSNull ? 1 : jd(m["delivery_office_fee"])
        eta = EtaRule.parse(m["delivery_eta"])
    }

    /// Door delivery (our driver or a courier) uses the home fee; pickup at a courier's branch uses the branch fee.
    func feeFor(_ m: DeliveryMethod?) -> Double {
        guard let m else { return 0 }
        if m == .office || m.toBranch { return deliveryOfficeFee }
        return deliveryHomeFee
    }
}

// MARK: - Delivery

/// Who carries the parcel.
enum Carrier: String, CaseIterable, Hashable {
    case own, nool, genacom, dhl
    var label: String {
        switch self {
        case .own: return "مندوبنا"
        case .nool: return "نول"
        case .genacom: return "جيناكم"
        case .dhl: return "DHL"
        }
    }
}

/// How an order reaches the customer. home = our driver to the door (Muscat).
/// Couriers (Nool, Genacom) deliver to the door or the customer picks up at
/// their branch. office is legacy. gcc* = shipping to another Gulf country.
enum DeliveryMethod: String, CaseIterable, Hashable {
    case home
    case office
    case nool
    case noolOffice = "nool_office"
    case genacom
    case genacomOffice = "genacom_office"
    case gccGenacom = "gcc_genacom"
    case gccDhl = "gcc_dhl"

    static func from(_ v: String?) -> DeliveryMethod? { v.flatMap { DeliveryMethod(rawValue: $0) } }

    /// The method for a carrier and destination (branch pickup or door).
    static func of(_ c: Carrier, branch: Bool) -> DeliveryMethod {
        switch c {
        case .own: return .home
        case .nool: return branch ? .noolOffice : .nool
        case .genacom: return branch ? .genacomOffice : .genacom
        case .dhl: return .gccDhl
        }
    }

    /// Value stored on the server.
    var key: String { rawValue }

    var carrier: Carrier {
        switch self {
        case .nool, .noolOffice: return .nool
        case .genacom, .genacomOffice, .gccGenacom: return .genacom
        case .gccDhl: return .dhl
        default: return .own
        }
    }

    var isGulf: Bool { self == .gccGenacom || self == .gccDhl }
    var toBranch: Bool { self == .noolOffice || self == .genacomOffice }
    var carrierName: String { carrier.label }
    var isCourier: Bool { carrier != .own }

    var label: String {
        switch self {
        case .home: return "مندوبنا · للبيت"
        case .office: return "إلى المكتب"
        case .nool: return "نول · للبيت"
        case .noolOffice: return "نول · من الفرع"
        case .genacom: return "جيناكم · للبيت"
        case .genacomOffice: return "جيناكم · من الفرع"
        case .gccGenacom: return "جيناكم · شحن خليجي"
        case .gccDhl: return "DHL · شحن خليجي"
        }
    }
}

// MARK: - Trips

struct Trip: Identifiable, Hashable {
    let id: String
    var name: String
    var destination: String?
    var startsOn: Date?
    var endsOn: Date?
    var notes: String?

    init(_ m: JSON) {
        id = jstr(m["id"])
        name = jstr(m["name"])
        destination = js(m["destination"])
        startsOn = jdate(m["starts_on"])
        endsOn = jdate(m["ends_on"])
        notes = js(m["notes"])
    }
}

struct TripExpense: Identifiable, Hashable {
    let id: String
    /// nil for a general business expense (not tied to a trip).
    var tripId: String?
    var title: String
    var amount: Double
    var currency: String
    var rate: Double
    var spentOn: Date?

    var omr: Double { amount * rate }

    init(_ m: JSON) {
        id = jstr(m["id"])
        tripId = js(m["trip_id"])
        title = jstr(m["title"])
        amount = jd(m["amount"])
        currency = js(m["currency"]) ?? "OMR"
        rate = jd(m["exchange_rate"])
        spentOn = jdate(m["spent_on"])
    }
}

// MARK: - Items

enum ItemStatus: Int, CaseIterable, Comparable, Hashable {
    case requested = 0, purchased, arrived, outForDelivery, delivered, cancelled

    static func < (a: ItemStatus, b: ItemStatus) -> Bool { a.rawValue < b.rawValue }

    static func from(_ s: String?) -> ItemStatus { allCases.first { $0.key == s } ?? .requested }

    /// Name used by the server.
    var key: String {
        switch self {
        case .requested: return "requested"
        case .purchased: return "purchased"
        case .arrived: return "arrived"
        case .outForDelivery: return "out_for_delivery"
        case .delivered: return "delivered"
        case .cancelled: return "cancelled"
        }
    }

    var index: Int { rawValue }

    var label: String {
        switch self {
        case .requested: return "بانتظار الشراء"
        case .purchased: return "تم الشراء"
        case .arrived: return "وصلت مسقط"
        case .outForDelivery: return "خرجت للتوصيل"
        case .delivered: return "تم التسليم"
        case .cancelled: return "ملغية"
        }
    }

    var color: Color {
        switch self {
        case .requested: return GH.statusRequested
        case .purchased: return GH.statusPurchased
        case .arrived: return GH.statusArrived
        case .outForDelivery: return GH.teal
        case .delivered: return GH.statusDelivered
        case .cancelled: return GH.grey
        }
    }

    /// The next step in the normal flow, or nil when finished.
    var next: ItemStatus? {
        switch self {
        case .requested: return .purchased
        case .purchased: return .arrived
        case .arrived: return .outForDelivery
        case .outForDelivery: return .delivered
        case .delivered, .cancelled: return nil
        }
    }

    /// Button text for moving an item to this status.
    var actionLabel: String {
        switch self {
        case .requested: return "رجّعها بانتظار الشراء"
        case .purchased: return "اشتريتها"
        case .arrived: return "وصلت مسقط"
        case .outForDelivery: return "طلعت للتوصيل"
        case .delivered: return "سلّمتها"
        case .cancelled: return "إلغاء القطعة"
        }
    }
}

/// Where an item was bought. Fixed tax-free rules per place.
enum PurchasePlace: String, CaseIterable, Hashable {
    case boutiqueEu = "boutique_eu"
    case airport
    case dubai
    case other

    static func from(_ s: String?) -> PurchasePlace? { s.flatMap { PurchasePlace(rawValue: $0) } }

    var key: String { rawValue }

    var label: String {
        switch self {
        case .boutiqueEu: return "بوتيك أوروبا"
        case .airport: return "مطار"
        case .dubai: return "دبي"
        case .other: return "مكان ثاني"
        }
    }

    var currency: String { self == .dubai ? "AED" : "EUR" }

    /// Tax-free refund percentage you should get back.
    var taxFreePct: Double {
        switch self {
        case .boutiqueEu: return 12
        case .dubai: return 4
        case .airport, .other: return 0
        }
    }
}

struct ItemEstimate: Hashable {
    let amount: Double
    let currency: String
    let fromList: Bool
}

struct OrderItem: Identifiable, Hashable {
    let id: String
    var orderId: String
    var name: String
    var brand: String?
    var details: String?
    var price: Double
    var status: ItemStatus
    var purchaseInvoiceId: String?
    var costAmount: Double?
    var costCurrency: String?
    var costRate: Double?
    var purchasePlace: PurchasePlace?
    var taxFreePct: Double?
    var taxFreeReceived: Bool = false
    /// Price as quoted to the customer in a foreign currency (private).
    var listPrice: Double?
    var listCurrency: String?
    /// The buying plan, before the trip (private).
    var planPlace: PurchasePlace?
    var planStore: String?
    var estCost: Double?
    var estCurrency: String?
    var estRate: Double?
    var commissionPct: Double?
    var photoPath: String?
    var receiptPath: String?
    var purchasedAt: Date?
    var arrivedAt: Date?
    var deliveredAt: Date?
    var createdAt: Date?

    var title: String { brand == nil ? name : "\(brand!) · \(name)" }

    var costOmr: Double? {
        guard let a = costAmount, let r = costRate else { return nil }
        return a * r
    }

    /// Tax-free refund expected for this item, in the purchase currency.
    var taxFreeAmount: Double {
        let pct = taxFreePct ?? 0
        guard let a = costAmount, pct > 0 else { return 0 }
        return a * pct / 100
    }

    var hasTaxFree: Bool { taxFreeAmount > 0 }
    var hasPlan: Bool { planStore != nil || planPlace != nil || estCost != nil }

    /// What it should cost before it's bought: the planned estimate, else the boutique price from the quote.
    var estimate: ItemEstimate? {
        if let e = estCost, e > 0, let c = estCurrency { return ItemEstimate(amount: e, currency: c, fromList: false) }
        if let l = listPrice, l > 0, let c = listCurrency { return ItemEstimate(amount: l, currency: c, fromList: true) }
        return nil
    }

    init(_ m: JSON) {
        id = jstr(m["id"])
        orderId = jstr(m["order_id"])
        name = jstr(m["name"])
        brand = js(m["brand"])
        details = js(m["details"])
        price = jd(m["price"])
        status = ItemStatus.from(js(m["status"]))
        purchaseInvoiceId = js(m["purchase_invoice_id"])
        costAmount = jdn(m["cost_amount"])
        costCurrency = js(m["cost_currency"])
        costRate = jdn(m["cost_rate"])
        purchasePlace = PurchasePlace.from(js(m["purchase_place"]))
        taxFreePct = jdn(m["tax_free_pct"])
        taxFreeReceived = jb(m["tax_free_received"])
        listPrice = jdn(m["list_price"])
        listCurrency = js(m["list_currency"])
        planPlace = PurchasePlace.from(js(m["plan_place"]))
        planStore = js(m["plan_store"])
        estCost = jdn(m["est_cost"])
        estCurrency = js(m["est_currency"])
        estRate = jdn(m["est_rate"])
        commissionPct = jdn(m["commission_pct"])
        photoPath = js(m["photo_path"])
        receiptPath = js(m["receipt_path"])
        purchasedAt = jdate(m["purchased_at"])
        arrivedAt = jdate(m["arrived_at"])
        deliveredAt = jdate(m["delivered_at"])
        createdAt = jdate(m["created_at"])
    }
}

// MARK: - Payments

struct Payment: Identifiable, Hashable {
    let id: String
    var orderId: String
    var amount: Double
    var method: String?
    var paidOn: Date?
    var note: String?

    init(_ m: JSON) {
        id = jstr(m["id"])
        orderId = jstr(m["order_id"])
        amount = jd(m["amount"])
        method = js(m["method"])
        paidOn = jdate(m["paid_on"])
        note = js(m["note"])
    }
}

// MARK: - Orders

enum DriverStatus: String, CaseIterable, Hashable {
    case assigned, picked, delivered

    static func from(_ v: String?) -> DriverStatus? { v.flatMap { DriverStatus(rawValue: $0) } }

    var label: String {
        switch self {
        case .assigned: return "عند المندوب"
        case .picked: return "في الطريق"
        case .delivered: return "تم التسليم"
        }
    }

    var color: Color {
        switch self {
        case .assigned: return GH.blue
        case .picked: return GH.amber
        case .delivered: return GH.green
        }
    }
}

/// One step in an order's history (created, purchased, picked up…).
struct OrderEvent: Hashable {
    var type: String
    var note: String?
    var at: Date?

    init(_ m: JSON) {
        type = jstr(m["type"])
        note = js(m["note"])
        at = jdate(m["at"])
    }

    var label: String {
        switch type {
        case "created": return "تم إنشاء الطلب"
        case "purchased": return "تم الشراء"
        case "shipped": return "في الطريق لعُمان"
        case "arrived": return "وصل مسقط"
        case "out_for_delivery": return "خرج للتوصيل"
        case "label": return "طُبعت البوليصة"
        case "assigned": return "سُلّم للمندوب"
        case "unassigned": return "سُحب من المندوب"
        case "picked": return "المندوب استلم الطلب"
        case "delivered": return "تم التسليم"
        case "cancelled": return "إلغاء"
        case "requested": return "رجع لانتظار الشراء"
        case "paid": return "دفع أونلاين"
        case "returned": return "مرتجع"
        case "past": return "طلب سابق"
        case "note": return "ملاحظة"
        default: return type
        }
    }

    /// SF Symbol
    var icon: String {
        switch type {
        case "created": return "doc.text.fill"
        case "purchased": return "bag.fill"
        case "arrived": return "airplane"
        case "shipped": return "paperplane.fill"
        case "label": return "barcode"
        case "assigned", "unassigned": return "person.fill"
        case "picked", "out_for_delivery": return "car.fill"
        case "delivered": return "checkmark.seal.fill"
        case "cancelled": return "xmark.circle.fill"
        case "paid": return "creditcard.fill"
        case "returned": return "arrow.uturn.left.circle.fill"
        default: return "circle.fill"
        }
    }

    var color: Color {
        switch type {
        case "purchased": return GH.statusPurchased
        case "arrived": return GH.statusArrived
        case "shipped": return GH.teal
        case "assigned", "picked": return GH.blue
        case "out_for_delivery": return GH.teal
        case "delivered": return GH.statusDelivered
        case "cancelled": return GH.red
        case "paid": return GH.green
        case "returned": return GH.amber
        default: return GH.secondary
        }
    }
}

struct Order: Identifiable, Hashable {
    let id: String
    var orderNo: Int
    /// The short number from the server (191001 = 19 Oct, first order).
    var refNo: String?
    var customerId: String
    var tripId: String?
    var trackingToken: String?
    /// Free-text trip name from before trips existed.
    var trip: String?
    var deliveryFee: Double
    var notes: String?
    var createdAt: Date?
    var items: [OrderItem]
    var payments: [Payment]
    // Delivery by a driver
    var driverId: String?
    var deliveryAddress: String?
    /// true: the driver collects the delivery fee from the customer.
    var deliveryCollect: Bool = false
    var driverStatus: DriverStatus?
    var driverNote: String?
    var deliveryPhotoPath: String?
    var driverDeliveredAt: Date?
    var labelPrintedAt: Date?
    var events: [OrderEvent] = []
    var deliveryMethod: DeliveryMethod?
    /// Shipment number or tracking link from Nool / Genacom.
    var carrierTracking: String?
    /// Set when the order came from the website / customer app.
    var storeOrderNumber: String?
    /// Cash the driver collects for a cash-on-delivery website order.
    var codAmount: Double?
    var discount: Double = 0
    var discountLabel: String?
    var tax: Double = 0
    /// "app" or "web" for online orders.
    var storeSource: String?
    /// Paid online by card / Apple Pay (Amwal).
    var paidOnline: Bool = false

    var fromStore: Bool { storeOrderNumber != nil }
    var sourceLabel: String { storeSource == "app" ? "من التطبيق" : "من الموقع" }

    /// What the driver collects at the door.
    var toCollect: Double { codAmount ?? (deliveryCollect && deliveryFee > 0 ? deliveryFee : 0) }

    var carrierIsLink: Bool { carrierTracking.map { $0.hasPrefix("http://") || $0.hasPrefix("https://") } ?? false }

    /// Shipping label number, e.g. GH-000123.
    var waybillNo: String { "GH-\(String(format: "%06d", orderNo))" }
    var invoiceNo: String { (refNo?.isEmpty == false) ? refNo! : invoiceNumber(orderNo, createdAt) }

    var activeItems: [OrderItem] { items.filter { $0.status != .cancelled } }
    var itemsTotal: Double { activeItems.reduce(0) { $0 + $1.price } }
    var total: Double { itemsTotal + deliveryFee + tax - discount }
    /// What the pieces sold for after the discount (tax and delivery aside).
    var netSales: Double { itemsTotal - discount }
    /// Estimated profit on the pieces, after the discount.
    var itemProfit: Double { netSales - costOmr }
    var paid: Double { payments.reduce(0) { $0 + $1.amount } }
    var remaining: Double { total - paid }
    var hasBalance: Bool { remaining > 0.0005 }
    var costOmr: Double { activeItems.reduce(0) { $0 + ($1.costOmr ?? 0) } }
    /// What the customer transferred minus what you paid for her items.
    var customerBalance: Double { paid - costOmr }

    /// Tax-free still to collect, grouped by currency.
    var taxFreePending: [String: Double] {
        var map: [String: Double] = [:]
        for i in activeItems where i.hasTaxFree && !i.taxFreeReceived {
            let c = i.costCurrency ?? "EUR"
            map[c, default: 0] += i.taxFreeAmount
        }
        return map
    }

    /// The least-advanced status among active items (what still needs doing).
    var overallStatus: ItemStatus {
        let active = activeItems
        if active.isEmpty { return .cancelled }
        return active.map(\.status).min() ?? .delivered
    }

    init(_ m: JSON) {
        id = jstr(m["id"])
        orderNo = ji(m["order_no"])
        refNo = js(m["ref_no"])
        customerId = jstr(m["customer_id"])
        tripId = js(m["trip_id"])
        trackingToken = js(m["tracking_token"])
        trip = js(m["trip"])
        deliveryFee = jd(m["delivery_fee"])
        notes = js(m["notes"])
        createdAt = jdate(m["created_at"])
        let old = Date(timeIntervalSince1970: 946_684_800)
        items = jlist(m["items"] ?? m["gh_order_items"]).map(OrderItem.init)
            .sorted { ($0.createdAt ?? old) < ($1.createdAt ?? old) }
        payments = jlist(m["payments"] ?? m["gh_payments"]).map(Payment.init)
            .sorted { ($0.paidOn ?? old) < ($1.paidOn ?? old) }
        driverId = js(m["driver_id"])
        deliveryAddress = js(m["delivery_address"])
        deliveryCollect = jb(m["delivery_collect"])
        driverStatus = DriverStatus.from(js(m["driver_status"]))
        driverNote = js(m["driver_note"])
        deliveryPhotoPath = js(m["delivery_photo_path"])
        driverDeliveredAt = jdate(m["driver_delivered_at"])
        labelPrintedAt = jdate(m["label_printed_at"])
        deliveryMethod = DeliveryMethod.from(js(m["delivery_method"]))
        carrierTracking = js(m["carrier_tracking"])
        storeOrderNumber = js(m["store_order_number"])
        codAmount = jdn(m["cod_amount"])
        discount = jd(m["discount"])
        discountLabel = js(m["discount_label"])
        tax = jd(m["tax"])
        storeSource = js(m["store_source"])
        paidOnline = jb(m["store_paid_online"])
        events = jlist(m["events"]).map(OrderEvent.init)
    }
}

// MARK: - Drivers

struct Driver: Identifiable, Hashable {
    let id: String
    var name: String
    var phone: String?
    var userId: String?
    var active: Bool = true

    init(_ m: JSON) {
        id = jstr(m["id"])
        name = jstr(m["name"])
        phone = js(m["phone"])
        userId = js(m["user_id"])
        active = !(m["active"] as? Bool == false || (m["active"] as? NSNumber)?.intValue == 0)
    }
}

struct DriverOrderItem: Hashable {
    var brand: String?
    var name: String
    var details: String?
}

/// An order as a driver sees it: no prices.
struct DriverOrder: Identifiable, Hashable {
    let id: String
    var invoiceNo: String
    var customerName: String
    var customerPhone: String?
    var customerCity: String?
    var address: String?
    var deliveryFee: Double
    var collect: Bool
    var status: DriverStatus?
    var note: String?
    var photoPath: String?
    /// Temporary link to the delivery photo (from the server).
    var photoUrl: String?
    var deliveredAt: Date?
    var waybillNo: String?
    var customerIsMale: Bool = false
    var codAmount: Double?
    var items: [DriverOrderItem]

    /// What to collect at the door: the order (cash on delivery) or the fee.
    var toCollect: Double { codAmount ?? (collect && deliveryFee > 0 ? deliveryFee : 0) }
    var isCod: Bool { codAmount != nil }
    var isDone: Bool { status == .delivered }

    init(_ m: JSON) {
        id = jstr(m["id"])
        invoiceNo = js(m["ref_no"]) ?? invoiceNumber(ji(m["order_no"]), jdate(m["created_at"]))
        customerName = jstr(m["customer_name"])
        customerPhone = js(m["customer_phone"])
        customerCity = js(m["customer_city"])
        address = js(m["address"])
        deliveryFee = jd(m["delivery_fee"])
        collect = jb(m["delivery_collect"])
        status = DriverStatus.from(js(m["driver_status"]))
        note = js(m["driver_note"])
        photoPath = js(m["delivery_photo_path"])
        photoUrl = js(m["delivery_photo_url"])
        waybillNo = js(m["waybill_no"])
        customerIsMale = js(m["customer_gender"]) == "m"
        codAmount = jdn(m["cod_amount"])
        deliveredAt = jdate(m["driver_delivered_at"])
        items = jlist(m["items"]).map { DriverOrderItem(brand: js($0["brand"]), name: jstr($0["name"]), details: js($0["details"])) }
    }
}

// MARK: - Purchase invoices

struct PurchaseInvoice: Identifiable, Hashable {
    let id: String
    var store: String
    var invoiceNo: String?
    var purchasedOn: Date?
    var country: String?
    var currency: String
    var rate: Double
    var totalAmount: Double
    var notes: String?

    var totalOmr: Double { totalAmount * rate }

    init(_ m: JSON) {
        id = jstr(m["id"])
        store = jstr(m["store"])
        invoiceNo = js(m["invoice_no"])
        purchasedOn = jdate(m["purchased_on"])
        country = js(m["country"])
        currency = js(m["currency"]) ?? "EUR"
        rate = jd(m["exchange_rate"])
        totalAmount = jd(m["total_amount"])
        notes = js(m["notes"])
    }
}

/// Fallback exchange rates (OMR per one unit) when the live rate isn't loaded.
let defaultRates: [String: Double] = [
    "EUR": 0.42, "AED": 0.105, "GBP": 0.49, "USD": 0.385, "CHF": 0.44, "SAR": 0.1026, "OMR": 1.0,
]
/// The order the currencies are offered in pickers.
let rateCurrencies = ["EUR", "AED", "GBP", "USD", "CHF", "SAR", "OMR"]

// MARK: - Piece requests

/// A customer's "find me this piece" request from the app or website.
struct PieceRequest: Identifiable, Hashable {
    let id: String
    var customerName: String
    var customerPhone: String?
    var name: String
    var brand: String?
    var category: String?
    var description: String?
    var url: String?
    var imageUrl: String?
    /// pending, reviewing, found, not_found, ordered, cancelled
    var status: String
    var orderId: String?
    var createdAt: Date?

    var isOpen: Bool { ["pending", "reviewing", "found"].contains(status) }

    var statusLabel: String {
        switch status {
        case "pending": return "جديد"
        case "reviewing": return "قيد البحث"
        case "found": return "لقيناها"
        case "not_found": return "غير متوفرة"
        case "ordered": return "تحوّل لطلب"
        case "cancelled": return "ملغي"
        default: return status
        }
    }

    var statusColor: Color {
        switch status {
        case "pending": return GH.blue
        case "reviewing": return GH.amber
        case "found": return GH.green
        case "ordered": return GH.burgundy
        default: return GH.secondary
        }
    }

    init(_ m: JSON) {
        id = jstr(m["id"])
        customerName = jstr(m["customer_name"])
        customerPhone = js(m["customer_phone"])
        name = jstr(m["name"])
        brand = js(m["brand"])
        category = js(m["category"])
        description = js(m["description"])
        url = js(m["url"])
        imageUrl = js(m["image_url"])
        status = js(m["status"]) ?? "pending"
        orderId = js(m["order_id"])
        createdAt = jdate(m["created_at"])
    }
}
