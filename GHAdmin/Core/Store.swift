import Foundation
import SwiftUI

/// Single source of truth for the app.
///
/// Everything is loaded in one request (/ps/bootstrap), kept in memory and
/// cached on the phone, so every screen opens instantly; after each change
/// the data is refreshed in the background and screens update.
@MainActor
final class Store: ObservableObject {
    static let shared = Store()
    private init() {}

    private var api: Api { Api.shared }

    @Published var orders: [Order] = []
    @Published var customers: [Customer] = []
    @Published var trips: [Trip] = []
    @Published var expenses: [TripExpense] = []
    @Published var invoices: [PurchaseInvoice] = []
    @Published var drivers: [Driver] = []
    @Published var requests: [PieceRequest] = []
    @Published var settings = BusinessSettings()
    /// Customer chat messages staff have not read yet (المحادثات).
    @Published var chatsUnread = 0
    /// Cash handovers from drivers waiting for a staff confirm.
    @Published var driverHandoversPending = 0

    @Published var ready = false
    @Published var syncing = false
    @Published var lastError: Error?

    private var customerById: [String: Customer] = [:]
    private var tripById: [String: Trip] = [:]
    private var orderById: [String: Order] = [:]

    // MARK: disk cache + incremental refresh
    //
    // The last bootstrap is saved on the phone (Application Support, one file per signed-in
    // account, wiped on logout) and shown at launch before the network answers. After that,
    // refreshes ask only for what changed: GET /ps/bootstrap?since=<server_time> returns the
    // orders changed since then + deleted_order_ids, and everything else (customers, trips,
    // expenses, settings…) in full. The delta is merged into the orders already in memory, so
    // every screen still sees ALL orders. A full load happens every 24 h, when the server's
    // schema changes, and whenever a merge looks wrong (order count differs from the server's).

    /// Bump when the file layout changes (old files are then ignored and deleted).
    private nonisolated static let cacheVersion = 4
    private nonisolated static let cachePrefix = "gh_cache_"
    private static let fullEvery: TimeInterval = 24 * 3600
    /// Disk work (read / write / wipe), one at a time and in order.
    private nonisolated static let io = DispatchQueue(label: "app.ghshopper.store.cache", qos: .utility)

    /// The server's JSON of every order (by id), kept so the merged snapshot can be saved.
    private var rawOrders: [String: JSON] = [:]
    /// The rest of the last answer (customers, trips, settings…).
    private var rawRest: JSON = [:]
    /// The server_time of the last answer applied: the next `since`.
    private var syncedAt: String?
    /// When the last full (not incremental) load was applied.
    private var fullAt: Date?
    /// The server's bootstrap schema the cached data was built with.
    private var schema = 0
    /// Serialises refreshes: a delta must never be merged over a newer answer.
    private var refreshChain: Task<Void, Never>?

    /// Disk cache only for a real staff session (never demo mode or a driver).
    private var cacheAllowed: Bool {
        guard let s = api.session, !s.isDriver, s.token != "demo", !DemoData.isOn else { return false }
        return true
    }

    private nonisolated static var cacheDir: URL {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    private var cacheURL: URL? {
        guard cacheAllowed else { return nil }
        let safe = api.storeCacheKey.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? "x"
        return Store.cacheDir.appendingPathComponent("\(Store.cachePrefix)v\(Store.cacheVersion)_\(safe).json")
    }

    /// Shows the cached snapshot immediately, then refreshes from the server.
    func start() async {
        await loadCache()
        await refresh()
    }

    /// Puts the saved snapshot on screen (read and parsed off the main thread). Safe to call
    /// more than once: does nothing once data is showing.
    func loadCache() async {
        guard !ready, let url = cacheURL else { return }
        let key = api.storeCacheKey
        let box: JSONBox = await withCheckedContinuation { (c: CheckedContinuation<JSONBox, Never>) in
            Store.io.async {
                Store.removeOldCacheFiles()
                var obj: Any?
                if let d = try? Data(contentsOf: url) { obj = try? JSONSerialization.jsonObject(with: d) }
                c.resume(returning: JSONBox(obj))
            }
        }
        // a refresh may have finished first, or the account changed while reading
        guard !ready, cacheAllowed, api.storeCacheKey == key,
              let file = box.value as? JSON, ji(file["cache"]) == Store.cacheVersion,
              let raw = file["data"] as? JSON else { return }
        apply(raw)
        schema = ji(file["schema"])
        syncedAt = js(file["server_time"])
        let f = jd(file["full_at"])
        fullAt = f > 0 ? Date(timeIntervalSince1970: f) : nil
        ready = true
    }

    /// Re-reads from the server: only what changed when possible, everything when `full`.
    func refresh(full: Bool = false) async {
        let previous = refreshChain
        let task = Task { @MainActor in
            await previous?.value
            await self.runRefresh(full: full)
        }
        refreshChain = task
        await task.value
    }

    private var canDelta: Bool {
        guard cacheAllowed, syncedAt != nil, schema > 0, !orderById.isEmpty || !rawRest.isEmpty,
              let fullAt, Date().timeIntervalSince(fullAt) < Store.fullEvery, fullAt <= Date() else { return false }
        return true
    }

    private func runRefresh(full: Bool) async {
        syncing = true
        defer { syncing = false }
        let delta = !full && canDelta
        let key = api.storeCacheKey
        var path = "/ps/bootstrap"
        if delta, let since = syncedAt?.addingPercentEncoding(withAllowedCharacters: .alphanumerics) {
            path += "?since=\(since)"
        }
        do {
            let raw = try await api.get(path) as? JSON ?? [:]
            guard api.storeCacheKey == key else { return } // signed out / another account meanwhile
            if delta && jb(raw["delta"]) {
                // anything unexpected → load everything again
                guard ji(raw["schema"]) == schema, raw["orders"] is [Any], js(raw["server_time"]) != nil,
                      merge(raw) else {
                    await runRefresh(full: true)
                    return
                }
            } else {
                apply(raw)
                schema = ji(raw["schema"])
                fullAt = Date()
            }
            syncedAt = js(raw["server_time"])
            lastError = nil
            ready = true
            WidgetBridge.storeRefreshed()
            saveCache()
        } catch {
            lastError = error
            ready = true
        }
    }

    /// Merges an incremental answer into the orders in memory. false = the result does not
    /// match the server (then a full load follows).
    private func merge(_ raw: JSON) -> Bool {
        let changed = jlist(raw["orders"])
        let deleted = (raw["deleted_order_ids"] as? [Any] ?? []).compactMap { js($0) }
        if !changed.isEmpty || !deleted.isEmpty {
            var byId = orderById
            for id in deleted {
                byId[id] = nil
                rawOrders[id] = nil
            }
            for m in changed {
                let o = Order(m)
                guard !o.id.isEmpty else { return false }
                byId[o.id] = o
                rawOrders[o.id] = m
            }
            let old = Date(timeIntervalSince1970: 0)
            orders = byId.values.sorted {
                let a = $0.createdAt ?? old, b = $1.createdAt ?? old
                return a != b ? a > b : $0.orderNo > $1.orderNo
            }
            orderById = byId
        }
        applyRest(raw)
        if raw["order_count"] != nil && ji(raw["order_count"]) != orders.count { return false }
        return rawOrders.count == orders.count
    }

    /// Saves the current snapshot (serialised and written off the main thread).
    private func saveCache() {
        guard let url = cacheURL else { return }
        var data = rawRest
        data["orders"] = orders.compactMap { rawOrders[$0.id] }
        let file: JSON = [
            "cache": Store.cacheVersion, "schema": schema, "server_time": syncedAt ?? NSNull(),
            "full_at": fullAt?.timeIntervalSince1970 ?? 0, "data": data,
        ]
        let box = JSONBox(file)
        Store.io.async {
            guard let v = box.value, JSONSerialization.isValidJSONObject(v),
                  let d = try? JSONSerialization.data(withJSONObject: v) else { return }
            try? d.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
            var u = url
            var rv = URLResourceValues()
            rv.isExcludedFromBackup = true
            try? u.setResourceValues(rv)
        }
    }

    /// Deletes every saved snapshot on the phone (logout).
    func wipeCache() {
        refreshChain = nil
        syncedAt = nil; fullAt = nil; schema = 0
        Store.io.async {
            let dir = Store.cacheDir
            let files = (try? FileManager.default.contentsOfDirectory(atPath: dir.path)) ?? []
            for f in files where f.hasPrefix(Store.cachePrefix) {
                try? FileManager.default.removeItem(at: dir.appendingPathComponent(f))
            }
        }
    }

    /// Files from older app versions (gh_cache_v3_…): no longer read.
    private nonisolated static func removeOldCacheFiles() {
        let dir = cacheDir
        let files = (try? FileManager.default.contentsOfDirectory(atPath: dir.path)) ?? []
        for f in files where f.hasPrefix("gh_cache_v") && !f.hasPrefix("gh_cache_v\(cacheVersion)_") {
            try? FileManager.default.removeItem(at: dir.appendingPathComponent(f))
        }
    }

    /// A full answer: replaces everything.
    private func apply(_ raw: JSON) {
        let list = jlist(raw["orders"])
        orders = list.map(Order.init)
        orderById = Dictionary(orders.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        rawOrders = Dictionary(list.map { (jstr($0["id"]), $0) }, uniquingKeysWith: { a, _ in a })
        applyRest(raw)
    }

    /// Everything but the orders (sent in full in both kinds of answer).
    private func applyRest(_ raw: JSON) {
        customers = jlist(raw["customers"]).map(Customer.init)
        trips = jlist(raw["trips"]).map(Trip.init)
        expenses = jlist(raw["expenses"]).map(TripExpense.init)
        invoices = jlist(raw["invoices"]).map(PurchaseInvoice.init)
        drivers = jlist(raw["drivers"]).map(Driver.init)
        requests = jlist(raw["requests"]).map(PieceRequest.init)
        settings = (raw["settings"] as? JSON).map(BusinessSettings.init) ?? BusinessSettings()
        chatsUnread = ji(raw["chats_unread"])
        driverHandoversPending = ji(raw["driver_handovers_pending"])
        customerById = Dictionary(customers.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        tripById = Dictionary(trips.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        var rest = raw
        for k in ["orders", "deleted_order_ids", "delta"] { rest[k] = nil }
        rawRest = rest
    }

    /// Loads a bootstrap snapshot directly (demo / screenshots).
    func loadSnapshot(_ raw: JSON) {
        apply(raw)
        ready = true
    }

    func clear() {
        orders = []; customers = []; trips = []; expenses = []; invoices = []; drivers = []; requests = []
        settings = BusinessSettings()
        chatsUnread = 0
        driverHandoversPending = 0
        customerById = [:]; tripById = [:]; orderById = [:]
        rawOrders = [:]; rawRest = [:]
        syncedAt = nil; fullAt = nil; schema = 0
        refreshChain = nil
        signed.removeAll()
        ready = false
    }

    // MARK: lookups

    func customer(_ id: String?) -> Customer? { id.flatMap { customerById[$0] } }
    func trip(_ id: String?) -> Trip? { id.flatMap { tripById[$0] } }
    func order(_ id: String) -> Order? { orderById[id] }
    func driver(_ id: String?) -> Driver? { id.flatMap { i in drivers.first { $0.id == i } } }

    /// Orders handed to a driver and not yet delivered.
    var withDrivers: [Order] { orders.filter { $0.driverId != nil && $0.driverStatus != .delivered } }

    func customerName(_ o: Order) -> String { customer(o.customerId)?.name ?? "—" }
    func ordersOf(_ customerId: String) -> [Order] { orders.filter { $0.customerId == customerId } }
    func ordersOfTrip(_ tripId: String) -> [Order] { orders.filter { $0.tripId == tripId } }
    func expensesOf(_ tripId: String) -> [TripExpense] { expenses.filter { $0.tripId == tripId } }

    /// Every active item with its order.
    var allItems: [(order: Order, item: OrderItem)] {
        orders.flatMap { o in o.activeItems.map { (order: o, item: $0) } }
    }

    // MARK: writes

    /// Runs a write then refreshes everything.
    @discardableResult
    private func write<T>(_ action: () async throws -> T) async throws -> T {
        let r = try await action()
        await refresh()
        if let e = lastError {
            lastError = nil
            throw e
        }
        return r
    }

    // customers

    @discardableResult
    func saveCustomer(id: String? = nil, name: String, phone: String?, city: String?, address: String?,
                      notes: String?, isMale: Bool = false, english: Bool = false) async throws -> Customer {
        try await write {
            let data: JSON = ["name": name, "phone": nn(phone), "city": nn(city), "address": nn(address),
                              "notes": nn(notes), "gender": isMale ? "m" : "f", "lang": english ? "en" : "ar"]
            let res = id == nil ? try await api.post("/ps/customers", data) : try await api.put("/ps/customers/\(id!)", data)
            return Customer(((res as? JSON)?["customer"] as? JSON) ?? [:])
        }
    }

    /// The driver's delivery note on a customer ("الباب الخلفي"); empty clears it.
    func saveDeliveryNote(_ c: Customer, note: String?) async throws {
        let clean = note?.trimmingCharacters(in: .whitespacesAndNewlines)
        let value: String? = (clean?.isEmpty ?? true) ? nil : clean
        try await write {
            let data: JSON = ["name": c.name, "phone": nn(c.phone), "city": nn(c.city), "address": nn(c.address),
                              "notes": nn(c.notes), "gender": c.isMale ? "m" : "f", "lang": c.isEnglish ? "en" : "ar",
                              "delivery_note": nn(value)]
            _ = try await api.put("/ps/customers/\(c.id)", data)
        }
    }

    /// Makes a customer a partner (a personal shopper ordering for her clients), or not.
    @discardableResult
    func setPartner(_ id: String, on: Bool, discount: Double?) async throws -> Customer {
        try await write {
            let res = try await api.put("/ps/customers/\(id)/partner", ["is_partner": on, "discount": nn(discount)])
            return Customer(((res as? JSON)?["customer"] as? JSON) ?? [:])
        }
    }

    func deleteCustomer(_ id: String) async throws { try await write { try await api.delete("/ps/customers/\(id)") } }

    /// The customer's private page listing all of their orders and invoices.
    func customerPortalLink(_ id: String, reset: Bool = false) async throws -> String {
        let res = try await api.post("/ps/customers/\(id)/portal-link\(reset ? "?reset=1" : "")") as? JSON
        return jstr(res?["url"])
    }

    /// ذوق العميلة: saves her sizes, brands, colours, budget and notes (nil or empty clears it).
    /// Re-sends her other details like saveDeliveryNote (the server needs the name).
    func saveStyle(_ customerId: String, _ style: CustomerStyle?) async throws {
        guard let c = customer(customerId) else { throw ApiError(message: "العميل غير موجود") }
        let value: Any = (style?.isEmpty ?? true) ? NSNull() : style!.json
        try await write {
            let data: JSON = ["name": c.name, "phone": nn(c.phone), "city": nn(c.city), "address": nn(c.address),
                              "notes": nn(c.notes), "gender": c.isMale ? "m" : "f", "lang": c.isEnglish ? "en" : "ar",
                              "style": value]
            _ = try await api.put("/ps/customers/\(c.id)", data)
        }
    }

    /// Store pieces that suit her taste (GET /ps/customers/{id}/style-matches);
    /// without an id, every customer's matches (GET /ps/style-matches).
    func styleMatches(customerId: String? = nil) async throws -> [StyleMatch] {
        let path = customerId.map { "/ps/customers/\($0)/style-matches" } ?? "/ps/style-matches"
        let res = try await api.get(path) as? JSON
        return jlist(res?["matches"]).map(StyleMatch.init)
    }

    /// The order's payment link (card / Apple Pay with Amwal).
    func orderPayLink(_ id: String, reset: Bool = false) async throws -> String {
        let res = try await api.post("/ps/orders/\(id)/pay-link\(reset ? "?reset=1" : "")") as? JSON
        return jstr(res?["url"])
    }

    // piece requests

    /// Turns a customer's piece request into an order. Returns the new order's id and its payment link.
    func convertRequest(_ id: String, _ data: JSON) async throws -> (orderId: String, payUrl: String) {
        try await write {
            let res = try await api.post("/ps/requests/\(id)/convert", data) as? JSON ?? [:]
            return (jstr(res["order_id"]), jstr(res["pay_url"]))
        }
    }

    func setRequestStatus(_ id: String, _ status: String) async throws {
        try await write { try await api.put("/ps/requests/\(id)", ["status": status]) }
    }

    /// Sends the customer a price offer (عرض سعر) for a piece request.
    func sendQuote(_ id: String, _ data: JSON) async throws {
        try await write { try await api.post("/ps/requests/\(id)/quote", data) }
    }

    /// Withdraws the offer (the request goes back to «قيد البحث»).
    func withdrawQuote(_ id: String) async throws {
        try await write { try await api.delete("/ps/requests/\(id)/quote") }
    }

    // chats

    /// Re-reads the unread chats count only (cheaper than a full refresh).
    func refreshChatsUnread() async {
        guard let res = try? await api.get("/ps/chats/unread") as? JSON else { return }
        chatsUnread = ji(res["count"])
    }

    // orders

    func createOrder(customerId: String, tripId: String?, deliveryFee: Double = 0, deliveryMethod: String?,
                     notes: String?, items: [JSON], deposit: Double = 0, depositMethod: String?,
                     clientName: String? = nil) async throws -> String {
        try await write {
            let res = try await api.post("/ps/orders", [
                "customer_id": customerId, "trip_id": nn(tripId), "delivery_fee": deliveryFee,
                "delivery_method": nn(deliveryMethod), "notes": nn(notes), "items": items,
                "deposit": deposit, "deposit_method": nn(depositMethod), "client_name": nn(clientName),
            ]) as? JSON ?? [:]
            return jstr(res["id"])
        }
    }

    /// data may contain trip_id, delivery_fee and notes.
    func updateOrder(_ id: String, _ data: JSON) async throws {
        let o = order(id)
        var body: JSON = ["trip_id": nn(o?.tripId), "notes": nn(o?.notes)]
        data.forEach { body[$0] = $1 }
        try await write { try await api.put("/ps/orders/\(id)", body) }
    }

    /// "On its way to Oman": its own step on the customer's tracking page.
    func markShipped(_ orderId: String, from: String? = nil) async throws {
        try await write { try await api.post("/ps/orders/\(orderId)/shipped", from == nil ? [:] : ["note": from!]) }
    }

    /// Records that the shipping label was printed (first time only).
    func markLabelPrinted(_ orderId: String) async throws {
        if order(orderId)?.labelPrintedAt != nil { return }
        try await write { try await api.post("/ps/orders/\(orderId)/label") }
    }

    /// Finds an order from a scanned waybill QR (tracking link).
    func orderByToken(_ token: String) -> Order? { orders.first { $0.trackingToken == token } }

    func deleteOrder(_ id: String) async throws { try await write { try await api.delete("/ps/orders/\(id)") } }

    // items

    func saveItem(id: String? = nil, orderId: String, name: String, brand: String?, details: String?,
                  price: Double, pricing: JSON = [:]) async throws {
        try await write {
            var data: JSON = ["order_id": orderId, "name": name, "brand": nn(brand), "details": nn(details), "price": price]
            pricing.forEach { data[$0] = $1 }
            if let id { try await api.put("/ps/items/\(id)", data) } else { try await api.post("/ps/items", data) }
        }
    }

    func deleteItem(_ id: String) async throws { try await write { try await api.delete("/ps/items/\(id)") } }

    func setItemStatus(_ item: OrderItem, _ status: ItemStatus) async throws { try await setItemsStatus([item], status) }

    func setItemsStatus(_ items: [OrderItem], _ status: ItemStatus) async throws {
        try await write { try await api.post("/ps/items/status", ["ids": items.map(\.id), "status": status.key]) }
    }

    /// Records where an item was bought and for how much, and marks it bought.
    func recordPurchase(_ item: OrderItem, place: PurchasePlace, price: Double, currency: String, rate: Double) async throws {
        try await write {
            try await api.put("/ps/items/\(item.id)/purchase", [
                "place": place.key, "price": price, "currency": currency, "rate": rate, "tax_free_pct": place.taxFreePct,
            ])
        }
    }

    /// Where a piece will be bought and roughly for how much (before the trip).
    func savePlan(_ item: OrderItem, store: String?, place: PurchasePlace?, cost: Double?, currency: String?, rate: Double?) async throws {
        try await write {
            try await api.post("/ps/items/plan", ["items": [[
                "id": item.id, "store": store ?? "", "place": nn(place?.key), "cost": nn(cost),
                "currency": cost == nil ? NSNull() : nn(currency), "rate": cost == nil ? NSNull() : nn(rate),
            ] as JSON]])
        }
    }

    func setTaxFreeReceived(_ itemId: String, _ received: Bool) async throws {
        try await write { try await api.put("/ps/items/\(itemId)/tax-free", ["received": received]) }
    }

    /// Many items at once (a whole trip, or the ones picked).
    func setTaxFreeReceived(ids: [String], _ received: Bool) async throws {
        guard !ids.isEmpty else { return }
        try await write { try await api.post("/ps/items/tax-free", ["ids": ids, "received": received]) }
    }

    // photos

    private var signed: [String: String] = [:]

    /// Uploads a photo for an item. kind is "photo" or "receipt".
    func uploadItemPhoto(_ item: OrderItem, kind: String, data: Data) async throws {
        try await write {
            let res = try await api.upload("/ps/items/\(item.id)/photo", field: "file", data: data, fields: ["kind": kind]) as? JSON
            if let p = js(res?["path"]), let u = js(res?["url"]) { signed[p] = u }
        }
    }

    func removeItemPhoto(_ item: OrderItem, kind: String) async throws {
        try await write { try await api.delete("/ps/items/\(item.id)/photo", ["kind": kind]) }
    }

    /// A temporary link (24 h) to show a private photo.
    func photoUrl(_ path: String) async throws -> String {
        if let c = signed[path] { return c }
        let res = try await api.post("/ps/files/url", ["path": path]) as? JSON
        let url = jstr(res?["url"])
        signed[path] = url
        return url
    }

    // drivers

    func createDriver(name: String, phone: String, password: String) async throws {
        try await write { try await api.post("/ps/drivers", ["name": name, "phone": phone, "password": password]) }
    }

    func setDriverPassword(_ driverId: String, _ password: String) async throws {
        try await api.put("/ps/drivers/\(driverId)", ["password": password])
    }

    func deleteDriver(_ driverId: String) async throws { try await write { try await api.delete("/ps/drivers/\(driverId)") } }

    func saveDriver(_ id: String, name: String? = nil, active: Bool? = nil) async throws {
        var body: JSON = [:]
        if let name { body["name"] = name }
        if let active { body["active"] = active }
        try await write { try await api.put("/ps/drivers/\(id)", body) }
    }

    /// Hands an order to a driver (or takes it back when driverId is nil).
    func setDelivery(_ o: Order, driverId: String?, address: String? = nil, collect: Bool? = nil, note: String? = nil) async throws {
        try await write {
            try await api.put("/ps/orders/\(o.id)/delivery", [
                "driver_id": nn(driverId), "address": nn(address), "collect": nn(collect), "note": nn(note),
            ])
        }
    }

    // payments

    func addPayment(_ orderId: String, amount: Double, method: String?, paidOn: Date? = nil, note: String? = nil) async throws {
        try await write {
            try await api.post("/ps/payments", [
                "order_id": orderId, "amount": amount, "method": nn(method),
                "paid_on": dayString(paidOn ?? Date()), "note": nn(note),
            ])
        }
    }

    func deletePayment(_ id: String) async throws { try await write { try await api.delete("/ps/payments/\(id)") } }

    // trips

    @discardableResult
    func saveTrip(id: String? = nil, name: String, destination: String?, startsOn: Date?, endsOn: Date?, notes: String?) async throws -> String {
        try await write {
            let data: JSON = ["name": name, "destination": nn(destination),
                              "starts_on": nn(startsOn.map(dayString)), "ends_on": nn(endsOn.map(dayString)), "notes": nn(notes)]
            let res = id == nil ? try await api.post("/ps/trips", data) : try await api.put("/ps/trips/\(id!)", data)
            return jstr((res as? JSON)?["id"]) .isEmpty ? (id ?? "") : jstr((res as? JSON)?["id"])
        }
    }

    func deleteTrip(_ id: String) async throws { try await write { try await api.delete("/ps/trips/\(id)") } }

    func addExpense(tripId: String?, title: String, amount: Double, currency: String, rate: Double, spentOn: Date? = nil) async throws {
        try await write {
            try await api.post("/ps/expenses", [
                "trip_id": nn(tripId), "title": title, "amount": amount, "currency": currency,
                "exchange_rate": rate, "spent_on": dayString(spentOn ?? Date()),
            ])
        }
    }

    func deleteExpense(_ id: String) async throws { try await write { try await api.delete("/ps/expenses/\(id)") } }

    // purchase invoices

    @discardableResult
    func savePurchaseInvoice(id: String? = nil, store: String, invoiceNo: String?, purchasedOn: Date, country: String?,
                             currency: String, rate: Double, totalAmount: Double, notes: String?,
                             link: [(item: OrderItem, cost: Double)] = []) async throws -> String {
        try await write {
            let data: JSON = [
                "store": store, "invoice_no": nn(invoiceNo), "purchased_on": dayString(purchasedOn), "country": nn(country),
                "currency": currency, "exchange_rate": rate, "total_amount": totalAmount, "notes": nn(notes),
                "link": link.map { ["item_id": $0.item.id, "cost": $0.cost] as JSON },
            ]
            let res = id == nil ? try await api.post("/ps/purchase-invoices", data) : try await api.put("/ps/purchase-invoices/\(id!)", data)
            let rid = jstr((res as? JSON)?["id"])
            return rid.isEmpty ? (id ?? "") : rid
        }
    }

    func deletePurchaseInvoice(_ id: String) async throws { try await write { try await api.delete("/ps/purchase-invoices/\(id)") } }

    func unlinkItem(_ itemId: String) async throws { try await write { try await api.put("/ps/items/\(itemId)/unlink") } }

    // settings

    func saveSettings(_ data: JSON) async throws { try await write { try await api.put("/ps/settings", data) } }
}

/// Hands a parsed JSON value between the main actor and the disk queue (read-only once made).
private final class JSONBox: @unchecked Sendable {
    let value: Any?
    init(_ value: Any?) { self.value = value }
}
