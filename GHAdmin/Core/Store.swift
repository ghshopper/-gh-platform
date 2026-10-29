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

    private static let cacheName = "gh_cache_v3"

    // MARK: loading

    private var cacheURL: URL {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        let safe = api.cacheKey.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? "x"
        return dir.appendingPathComponent("\(Store.cacheName)_\(safe).json")
    }

    /// Shows the cached snapshot immediately, then refreshes from the server.
    func start() async {
        if !ready, let data = try? Data(contentsOf: cacheURL),
           let raw = try? JSONSerialization.jsonObject(with: data) as? JSON {
            apply(raw)
            ready = true
        }
        await refresh()
    }

    func refresh() async {
        syncing = true
        defer { syncing = false }
        do {
            let raw = try await api.get("/ps/bootstrap") as? JSON ?? [:]
            apply(raw)
            lastError = nil
            ready = true
            WidgetBridge.storeRefreshed()
            if let data = try? JSONSerialization.data(withJSONObject: raw) {
                let url = cacheURL
                Task.detached { try? data.write(to: url, options: .atomic) }
            }
        } catch {
            lastError = error
            ready = true
        }
    }

    private func apply(_ raw: JSON) {
        orders = jlist(raw["orders"]).map(Order.init)
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
        orderById = Dictionary(orders.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
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
