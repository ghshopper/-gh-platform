import Foundation
import Security

// Compiled into BOTH the app (GHAdmin) and the widget extension (GHAdminWidgets).
// Every name here starts with GW so it never clashes with the app's own types.

// MARK: - What the widgets show

/// The staff summary (GET /ps/widget, or worked out in the app from its data).
struct GWSummary: Codable, Equatable {
    var todayOrders: Int = 0
    var todaySales: Double = 0
    var todayCollected: Double = 0
    var monthSales: Double = 0
    var monthProfit: Double = 0
    var monthOrders: Int = 0
    /// 0 when unknown (older server).
    var lastMonthSales: Double = 0
    var heldBalance: Double = 0
    var toCollect: Double = 0
    var requestsNew: Int = 0
    var chatsUnread: Int = 0
    var failedDeliveries: Int = 0
    var handoversPending: Int = 0
    var unpaidOrders: Int = 0
    var trip: GWTrip?
    var latest: [GWOrderLine] = []
    var updatedAt = Date()

    var attentionTotal: Int { requestsNew + chatsUnread + failedDeliveries + handoversPending + unpaidOrders }

    init() {}

    /// From the server's JSON (GET /ps/widget).
    init(server m: [String: Any]) {
        let today = gwObj(m["today"])
        let month = gwObj(m["month"])
        let pending = gwObj(m["pending"])
        todayOrders = gwInt(today["orders"])
        todaySales = gwNum(today["sales"])
        todayCollected = gwNum(today["collected"])
        monthSales = gwNum(month["sales"])
        monthProfit = gwNum(month["profit_estimate"])
        monthOrders = gwInt(month["orders"])
        lastMonthSales = gwNum(month["last_month_sales"])
        heldBalance = gwNum(m["held_balance"])
        toCollect = gwNum(m["to_collect"])
        requestsNew = gwInt(pending["requests_new"])
        chatsUnread = gwInt(pending["chats_unread"])
        failedDeliveries = gwInt(pending["failed_deliveries"])
        handoversPending = gwInt(pending["handovers_pending"])
        unpaidOrders = gwInt(pending["unpaid_orders"])
        if let t = m["trip"] as? [String: Any] { trip = GWTrip(server: t) }
        let rows = (m["latest_orders"] as? [Any]) ?? []
        latest = rows.compactMap { $0 as? [String: Any] }.map { GWOrderLine(server: $0) }
        updatedAt = Date()
    }
}

struct GWShop: Codable, Equatable {
    var name: String
    var count: Int
}

/// The shopping trip on now (or next) with pieces still to buy.
struct GWTrip: Codable, Equatable {
    var id: String
    var name: String
    var itemsLeft: Int
    var itemsTotal: Int
    var shops: [GWShop]

    init(id: String, name: String, itemsLeft: Int, itemsTotal: Int, shops: [GWShop]) {
        self.id = id
        self.name = name
        self.itemsLeft = itemsLeft
        self.itemsTotal = itemsTotal
        self.shops = shops
    }

    init(server m: [String: Any]) {
        id = gwStr(m["id"])
        name = gwStr(m["name"])
        itemsLeft = gwInt(m["items_left"])
        itemsTotal = max(gwInt(m["items_total"]), itemsLeft)
        let rows = (m["shops"] as? [Any]) ?? []
        shops = rows.compactMap { $0 as? [String: Any] }.map { GWShop(name: gwStr($0["name"]), count: gwInt($0["count"])) }
    }

    /// 0…1: how much of the list is bought.
    var progress: Double {
        guard itemsTotal > 0 else { return 0 }
        return Double(itemsTotal - itemsLeft) / Double(itemsTotal)
    }
}

struct GWOrderLine: Codable, Equatable {
    var id: String
    var invoiceNo: String
    var customer: String
    var total: Double
    /// requested / purchased / arrived / out_for_delivery / delivered / cancelled
    var status: String
    var statusLabel: String

    init(id: String, invoiceNo: String, customer: String, total: Double, status: String, statusLabel: String) {
        self.id = id
        self.invoiceNo = invoiceNo
        self.customer = customer
        self.total = total
        self.status = status
        self.statusLabel = statusLabel
    }

    init(server m: [String: Any]) {
        id = gwStr(m["id"])
        invoiceNo = gwStr(m["invoice_no"])
        customer = gwStr(m["customer"])
        total = gwNum(m["total"])
        status = gwStr(m["status"])
        statusLabel = gwStr(m["status_label"])
    }
}

/// The next stop of a driver.
struct GWDriverStop: Codable, Equatable {
    var id: String
    var name: String
    var area: String
    /// 0: nothing to collect (مدفوع).
    var collect: Double
    /// assigned / picked / failed
    var status: String
}

/// A driver's day (GET /ps/driver/orders + /ps/driver/account).
struct GWDriverSummary: Codable, Equatable {
    var name: String = ""
    var left: Int = 0
    var onTheWay: Int = 0
    var deliveredToday: Int = 0
    var cash: Double = 0
    var toCollect: Double = 0
    var next: GWDriverStop?
    var updatedAt = Date()

    init() {}

    /// From the driver endpoints' raw JSON (the widget extension has no app models).
    init(orders: [[String: Any]], account: [String: Any]?, name: String) {
        self.name = name
        let indexed = Array(orders.enumerated())
        let sorted = indexed.sorted { a, b in
            let pa = gwIntOpt(a.element["route_pos"]) ?? Int.max
            let pb = gwIntOpt(b.element["route_pos"]) ?? Int.max
            if pa != pb { return pa < pb }
            return a.offset < b.offset
        }.map { $0.element }
        let open = sorted.filter { gwStr($0["driver_status"]) != "delivered" }
        left = open.count
        onTheWay = open.filter { gwStr($0["driver_status"]) == "picked" }.count
        toCollect = open.reduce(0.0) { $0 + GWDriverSummary.collectOf($1) }
        let cal = Calendar.current
        deliveredToday = sorted.filter { o in
            guard gwStr(o["driver_status"]) == "delivered", let d = gwDate(o["driver_delivered_at"]) else { return false }
            return cal.isDateInToday(d)
        }.count
        cash = gwNum(account?["cash_with_driver"])
        let first = open.first { gwStr($0["driver_status"]) == "picked" } ?? open.first
        if let o = first {
            next = GWDriverStop(id: gwStr(o["id"]), name: GWDriverSummary.recipient(o), area: GWDriverSummary.area(o),
                                collect: GWDriverSummary.collectOf(o), status: gwStr(o["driver_status"]))
        }
        updatedAt = Date()
    }

    private static func collectOf(_ o: [String: Any]) -> Double {
        if let cod = gwNumOpt(o["cod_amount"]) { return cod }
        let fee = gwNum(o["delivery_fee"])
        return gwBool(o["delivery_collect"]) && fee > 0 ? fee : 0
    }

    private static func recipient(_ o: [String: Any]) -> String {
        let gift = gwObj(o["gift"])
        let to = gwStr(gift["to"]).trimmingCharacters(in: .whitespaces)
        return to.isEmpty ? gwStr(o["customer_name"]) : to
    }

    /// Like the driver app: the city, else the first part of the address (links removed).
    static func area(_ o: [String: Any]) -> String {
        let city = gwStr(o["customer_city"]).trimmingCharacters(in: .whitespaces)
        if !city.isEmpty { return city }
        return gwAreaFromAddress(gwStr(o["address"]))
    }
}

/// "الخوير ٣٣، شارع…" → "الخوير ٣٣" (links dropped).
func gwAreaFromAddress(_ address: String) -> String {
    let words = address.split(separator: " ").filter { !$0.hasPrefix("http://") && !$0.hasPrefix("https://") }
    let clean = words.joined(separator: " ")
    let first = clean.split(whereSeparator: { $0 == "،" || $0 == "," }).first.map(String.init) ?? clean
    return first.trimmingCharacters(in: .whitespaces)
}

/// The signed-in account, shared with the widgets.
struct GWSession: Codable, Equatable {
    var token: String
    /// admin / driver
    var role: String
    var name: String
    var api: String

    var isDriver: Bool { role == "driver" }
    var isDemo: Bool { token == "demo" }
}

// MARK: - Shared storage (keychain access group, no App Group needed)

/// The app writes the session and the latest numbers; the widget extension reads them.
/// Stored in the keychain group "<TEAM>.app.ghshopper.shared" (keychain-access-groups
/// entitlement in both targets). Without a signed team (simulator CI builds) it falls back to
/// the app's own keychain, so nothing breaks.
enum GWShared {
    private static let service = "app.ghshopper.shared"
    private static let kSession = "gw_session"
    private static let kSummary = "gw_summary"
    private static let kDriver = "gw_driver"

    /// "<TEAM>.app.ghshopper.shared" from Info.plist (GHKeychainGroup = $(AppIdentifierPrefix)app.ghshopper.shared).
    static var accessGroup: String? {
        guard let g = Bundle.main.object(forInfoDictionaryKey: "GHKeychainGroup") as? String else { return nil }
        let bare = "app.ghshopper.shared"
        if !g.hasSuffix(bare) || g.count <= bare.count + 1 || g.contains("$(") { return nil }
        return g
    }

    static func saveSession(_ s: GWSession?) { write(kSession, s.flatMap { try? JSONEncoder().encode($0) }) }
    static func loadSession() -> GWSession? { read(kSession).flatMap { try? JSONDecoder().decode(GWSession.self, from: $0) } }

    static func saveSummary(_ s: GWSummary?) { write(kSummary, s.flatMap { try? JSONEncoder().encode($0) }) }
    static func loadSummary() -> GWSummary? { read(kSummary).flatMap { try? JSONDecoder().decode(GWSummary.self, from: $0) } }

    static func saveDriver(_ s: GWDriverSummary?) { write(kDriver, s.flatMap { try? JSONEncoder().encode($0) }) }
    static func loadDriver() -> GWDriverSummary? { read(kDriver).flatMap { try? JSONDecoder().decode(GWDriverSummary.self, from: $0) } }

    private static func base(_ key: String, group: String?) -> [String: Any] {
        var q: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
                                kSecAttrService as String: service,
                                kSecAttrAccount as String: key]
        if let group { q[kSecAttrAccessGroup as String] = group }
        return q
    }

    private static func write(_ key: String, _ data: Data?) {
        let group = accessGroup
        SecItemDelete(base(key, group: group) as CFDictionary)
        if group != nil { SecItemDelete(base(key, group: nil) as CFDictionary) }
        guard let data else { return }
        var add = base(key, group: group)
        add[kSecValueData as String] = data
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        let status = SecItemAdd(add as CFDictionary, nil)
        if status != errSecSuccess && group != nil {
            // not entitled (unsigned build): keep it in our own keychain
            var plain = base(key, group: nil)
            plain[kSecValueData as String] = data
            plain[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
            SecItemAdd(plain as CFDictionary, nil)
        }
    }

    private static func read(_ key: String) -> Data? {
        if let g = accessGroup, let d = readOne(key, group: g) { return d }
        return readOne(key, group: nil)
    }

    private static func readOne(_ key: String, group: String?) -> Data? {
        var q = base(key, group: group)
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var out: AnyObject?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess else { return nil }
        return out as? Data
    }
}

// MARK: - Formatting (Arabic digits, short money)

enum GWFmt {
    /// Widgets show Arabic-Indic digits (٣ طلبات · ١٢٠ ر.ع). Set false for Latin digits like the app's lists.
    static let arabicDigits = true

    private static func formatter(_ fraction: Int) -> NumberFormatter {
        let f = NumberFormatter()
        f.locale = Locale(identifier: arabicDigits ? "ar@numbers=arab" : "en_US_POSIX")
        f.numberStyle = .decimal
        f.usesGroupingSeparator = true
        f.minimumFractionDigits = 0
        f.maximumFractionDigits = fraction
        return f
    }

    private static let whole = formatter(0)
    private static let one = formatter(1)
    private static let three = formatter(3)

    static func count(_ n: Int) -> String { whole.string(from: NSNumber(value: n)) ?? "\(n)" }

    /// Short amount without the currency: 1,234 · 45.5 · 0.75 (whole rials from 100 up).
    static func amount(_ v: Double) -> String {
        let f = abs(v) >= 100 ? whole : three
        return f.string(from: NSNumber(value: v)) ?? String(format: "%.3f", v)
    }

    /// 1,234 ر.ع
    static func money(_ v: Double) -> String { "\(amount(v)) ر.ع" }

    /// Big numbers in thousands: 67.9 ألف (from 10,000 up), else money().
    static func compactMoney(_ v: Double) -> String {
        if abs(v) >= 10_000 {
            let k = (one.string(from: NSNumber(value: v / 1000)) ?? "\(Int(v / 1000))")
            return "\(k) ألف ر.ع"
        }
        return money(v)
    }

    static func percent(_ p: Double) -> String { "\(count(Int((p * 100).rounded())))٪" }

    /// "٣ طلبات" / "طلب واحد" / "طلبين"
    static func orders(_ n: Int) -> String {
        switch n {
        case 0: return "ما في طلبات"
        case 1: return "طلب واحد"
        case 2: return "طلبين"
        case 3...10: return "\(count(n)) طلبات"
        default: return "\(count(n)) طلب"
        }
    }

    /// Minutes as "١٢ د" / "١ س ٥ د".
    static func duration(_ seconds: TimeInterval) -> String {
        let m = max(0, Int(seconds / 60))
        if m < 60 { return "\(count(m)) د" }
        return "\(count(m / 60)) س \(count(m % 60)) د"
    }
}

// MARK: - Sample data (demo mode, widget gallery, placeholders)

enum GWSample {
    static var summary: GWSummary {
        var s = GWSummary()
        s.todayOrders = 3
        s.todaySales = 1_240
        s.todayCollected = 865.5
        s.monthSales = 18_460
        s.monthProfit = 3_215.75
        s.monthOrders = 47
        s.lastMonthSales = 24_300
        s.heldBalance = 4_120
        s.toCollect = 2_380.25
        s.requestsNew = 4
        s.chatsUnread = 3
        s.failedDeliveries = 1
        s.handoversPending = 1
        s.unpaidOrders = 6
        s.trip = GWTrip(id: "demo-trip", name: "ميلان أكتوبر", itemsLeft: 9, itemsTotal: 21, shops: [
            GWShop(name: "Dior Montenapoleone", count: 3),
            GWShop(name: "Louis Vuitton", count: 2),
            GWShop(name: "Prada", count: 2),
            GWShop(name: "Bottega Veneta", count: 1),
            GWShop(name: "Chanel · بدون محل", count: 1),
        ])
        s.latest = [
            GWOrderLine(id: "o1", invoiceNo: "241031", customer: "مريم البلوشية", total: 385, status: "requested", statusLabel: "بانتظار الشراء"),
            GWOrderLine(id: "o2", invoiceNo: "241030", customer: "سارة الهنائية", total: 1_120, status: "purchased", statusLabel: "تم الشراء"),
            GWOrderLine(id: "o3", invoiceNo: "241029", customer: "نورة الحارثية", total: 96.5, status: "arrived", statusLabel: "وصلت مسقط"),
            GWOrderLine(id: "o4", invoiceNo: "241027", customer: "هند الرواحية", total: 240, status: "out_for_delivery", statusLabel: "خرجت للتوصيل"),
            GWOrderLine(id: "o5", invoiceNo: "241025", customer: "لمياء الزدجالية", total: 610, status: "delivered", statusLabel: "تم التسليم"),
        ]
        s.updatedAt = Date()
        return s
    }

    static var driver: GWDriverSummary {
        var d = GWDriverSummary()
        d.name = "خالد"
        d.left = 4
        d.onTheWay = 2
        d.deliveredToday = 3
        d.cash = 30
        d.toCollect = 47.5
        d.next = GWDriverStop(id: "d1", name: "نورة السالمي", area: "الخوير", collect: 45.5, status: "picked")
        d.updatedAt = Date()
        return d
    }
}

// MARK: - tolerant JSON readers (numbers may come as strings)

func gwObj(_ v: Any?) -> [String: Any] { (v as? [String: Any]) ?? [:] }

func gwStr(_ v: Any?) -> String {
    if let s = v as? String { return s }
    if let n = v as? NSNumber { return n.stringValue }
    return ""
}

func gwNumOpt(_ v: Any?) -> Double? {
    if let n = v as? NSNumber { return n.doubleValue }
    if let s = v as? String { return Double(s) }
    return nil
}

func gwNum(_ v: Any?) -> Double { gwNumOpt(v) ?? 0 }

func gwIntOpt(_ v: Any?) -> Int? {
    if let n = v as? NSNumber { return n.intValue }
    if let s = v as? String, let d = Double(s) { return Int(d) }
    return nil
}

func gwInt(_ v: Any?) -> Int { gwIntOpt(v) ?? 0 }

func gwBool(_ v: Any?) -> Bool {
    if let b = v as? Bool { return b }
    if let n = v as? NSNumber { return n.intValue != 0 }
    if let s = v as? String { return s == "1" || s == "true" }
    return false
}

func gwDate(_ v: Any?) -> Date? {
    guard let s = v as? String, !s.isEmpty else { return nil }
    let f = ISO8601DateFormatter()
    if let d = f.date(from: s) { return d }
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return f.date(from: s)
}
