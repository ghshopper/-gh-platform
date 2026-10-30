import Foundation
import SwiftUI
import WidgetKit

/// Keeps the home / lock screen widgets in step with the app: the signed-in
/// account and the latest numbers go to the shared keychain (GWShared), then
/// the widgets reload.
@MainActor
enum WidgetBridge {
    /// After sign-in, restore and sign-out.
    static func sessionChanged(_ s: Session?) {
        if let s {
            let old = GWShared.loadSession()
            GWShared.saveSession(GWSession(token: s.token, role: s.role, name: s.name, api: AppConfig.apiBaseUrl))
            if old?.token != s.token {
                // another account: drop the other one's numbers
                GWShared.saveSummary(nil)
                GWShared.saveDriver(nil)
            }
        } else {
            GWShared.saveSession(nil)
            GWShared.saveSummary(nil)
            GWShared.saveDriver(nil)
        }
        reload()
    }

    /// After every staff refresh (/ps/bootstrap).
    static func storeRefreshed() {
        guard !DemoData.isOn, let s = Api.shared.session, !s.isDriver else { return }
        GWShared.saveSummary(summary(Store.shared))
        reload()
        LiveActivities.syncTrips()
    }

    /// After the driver's list or money reloads.
    static func driverRefreshed() {
        guard !DemoData.isOn, let s = Api.shared.session, s.isDriver else { return }
        GWShared.saveDriver(driverSummary())
        reload()
    }

    static func reload() {
        WidgetCenter.shared.reloadAllTimelines()
    }

    // MARK: staff numbers (the same sums as اليوم and الأرباح)

    static func summary(_ store: Store) -> GWSummary {
        let cal = Calendar.current
        let now = Date()
        let lastMonthDate = cal.date(byAdding: .month, value: -1, to: now) ?? now
        func sameMonth(_ d: Date?, _ ref: Date) -> Bool {
            guard let d else { return false }
            return cal.isDate(d, equalTo: ref, toGranularity: .month)
        }
        func isToday(_ d: Date?) -> Bool {
            guard let d else { return false }
            return cal.isDate(d, inSameDayAs: now)
        }

        var s = GWSummary()
        let orders = store.orders
        var costedSales = 0.0, cost = 0.0, discounts = 0.0, delivery = 0.0
        for o in orders {
            if isToday(o.createdAt) {
                s.todayOrders += 1
                s.todaySales += o.netSales
            }
            if sameMonth(o.createdAt, now) {
                s.monthOrders += 1
                s.monthSales += o.netSales
                for i in o.activeItems {
                    if let c = i.costOmr {
                        cost += c
                        costedSales += i.price
                    }
                }
                discounts += o.discount
                delivery += o.deliveryFee
            } else if sameMonth(o.createdAt, lastMonthDate) {
                s.lastMonthSales += o.netSales
            }
            for p in o.payments where isToday(p.paidOn) { s.todayCollected += p.amount }
            s.toCollect += o.dueNow
            if o.customerBalance > 0 { s.heldBalance += o.customerBalance }
            if o.owesNow { s.unpaidOrders += 1 }
            if o.driverStatus == .failed { s.failedDeliveries += 1 }
        }
        let spent = store.expenses.filter { sameMonth($0.spentOn, now) }.reduce(0.0) { $0 + $1.omr }
        s.monthProfit = costedSales - cost - discounts + delivery - spent
        s.requestsNew = store.requests.filter { $0.status == "pending" }.count
        s.chatsUnread = store.chatsUnread
        s.handoversPending = store.driverHandoversPending
        s.trip = currentTrip(store)
        let latest = orders.sorted { ($0.createdAt ?? .distantPast) > ($1.createdAt ?? .distantPast) }.prefix(5)
        s.latest = latest.map { o in
            let st = o.overallStatus
            return GWOrderLine(id: o.id, invoiceNo: o.invoiceNo, customer: store.customerName(o), total: o.total,
                               status: st.key, statusLabel: st.label)
        }
        s.updatedAt = Date()
        return s
    }

    /// The trip on now (else the next, else the newest) that still has pieces to buy.
    static func currentTrip(_ store: Store) -> GWTrip? {
        var left: [String: Int] = [:]
        for o in store.orders {
            guard let tid = o.tripId else { continue }
            for i in o.activeItems where i.status == .requested { left[tid, default: 0] += 1 }
        }
        let trips = store.trips.filter { (left[$0.id] ?? 0) > 0 }
        if trips.isEmpty { return nil }
        let cal = Calendar.current
        let today = cal.startOfDay(for: Date())
        let on = trips.filter { t in
            guard let s = t.startsOn, cal.startOfDay(for: s) <= today else { return false }
            guard let e = t.endsOn else { return true }
            return cal.startOfDay(for: e) >= today
        }.sorted { ($0.startsOn ?? .distantPast) > ($1.startsOn ?? .distantPast) }
        let next = trips.filter { t in
            guard let s = t.startsOn else { return false }
            return cal.startOfDay(for: s) > today
        }.sorted { ($0.startsOn ?? .distantFuture) < ($1.startsOn ?? .distantFuture) }
        guard let t = on.first ?? next.first ?? trips.first else { return nil }
        let st = tripState(t.id)
        return GWTrip(id: t.id, name: t.name, itemsLeft: st.itemsLeft, itemsTotal: st.itemsTotal, shops: shops(tripItems(t.id)))
    }

    static func tripItems(_ tripId: String) -> [OrderItem] {
        Store.shared.ordersOfTrip(tripId).flatMap { $0.activeItems }
    }

    /// The Live Activity's numbers for a trip.
    static func tripState(_ tripId: String) -> GHTripAttributes.ContentState {
        let items = tripItems(tripId)
        let list = shops(items)
        let left = items.filter { $0.status == .requested }.count
        return GHTripAttributes.ContentState(itemsLeft: left, itemsTotal: items.count,
                                             currentShop: list.first?.name, currentCount: list.first?.count ?? 0,
                                             nextShop: list.count > 1 ? list[1].name : nil, shopsLeft: list.count)
    }

    /// Same stops as the trip's shopping list: one per planned shop, the rest by brand.
    static func shops(_ items: [OrderItem]) -> [GWShop] {
        func tidy(_ s: String) -> String { s.split(whereSeparator: { $0.isWhitespace }).joined(separator: " ") }
        func fold(_ s: String) -> String {
            tidy(s).folding(options: [.caseInsensitive, .diacriticInsensitive, .widthInsensitive], locale: nil)
        }
        func caps(_ s: String) -> Int { s.filter { $0.isUppercase }.count }
        var order: [String] = []
        var label: [String: String] = [:]
        var counts: [String: Int] = [:]
        for i in items where i.status == .requested {
            let store = tidy(i.planStore ?? "")
            let rawBrand = tidy(i.brand ?? "")
            let brand = rawBrand.isEmpty ? "بدون براند" : rawBrand
            let shown = store.isEmpty ? "\(brand) · بدون محل" : store
            let id = store.isEmpty ? "b:" + fold(brand) : "s:" + fold(store)
            if counts[id] == nil { order.append(id) }
            counts[id, default: 0] += 1
            if let cur = label[id] {
                if caps(shown) > caps(cur) { label[id] = shown }
            } else {
                label[id] = shown
            }
        }
        let ids = order.sorted { a, b in
            let na = a.hasPrefix("b:")
            let nb = b.hasPrefix("b:")
            if na != nb { return !na }
            return (label[a] ?? "").lowercased() < (label[b] ?? "").lowercased()
        }
        return ids.map { GWShop(name: label[$0] ?? $0, count: counts[$0] ?? 0) }
    }

    // MARK: driver numbers

    static func driverSummary() -> GWDriverSummary {
        let data = DriverData.shared
        let cal = Calendar.current
        var d = GWDriverSummary()
        d.name = Api.shared.session?.name ?? ""
        let open = data.orders.filter { !$0.isDone }
        d.left = open.count
        d.onTheWay = open.filter { $0.status == .picked }.count
        d.toCollect = open.reduce(0.0) { $0 + $1.toCollect }
        d.deliveredToday = data.orders.filter { o in
            guard o.isDone, let at = o.deliveredAt else { return false }
            return cal.isDateInToday(at)
        }.count
        d.cash = data.account?.cash ?? GWShared.loadDriver()?.cash ?? 0
        if let o = open.first(where: { $0.status == .picked }) ?? open.first {
            d.next = GWDriverStop(id: o.id, name: o.recipientName, area: area(o), collect: o.toCollect,
                                  status: o.status?.rawValue ?? "assigned")
        }
        d.updatedAt = Date()
        return d
    }

    /// "الخوير": the city, else the first part of the address.
    static func area(_ o: DriverOrder) -> String {
        if let c = o.customerCity?.trimmingCharacters(in: .whitespaces), !c.isEmpty { return c }
        return gwAreaFromAddress(o.address ?? "")
    }
}

// MARK: - deep links (ghadmin://…)

/// Opens what a widget (or a Live Activity) was tapped for:
/// ghadmin://today · requests · chats · orders · drivers · trips · order/{id} · trip/{id} · driver · driver/order/{id}
@MainActor
final class DeepLinks: ObservableObject {
    static let shared = DeepLinks()
    private init() {}

    /// The staff tab bar listens to this (0 اليوم · 1 الطلبات · 3 الرحلات).
    @Published var tab: Int?

    func open(_ url: URL) {
        guard url.scheme?.lowercased() == "ghadmin" else { return }
        Task { await route(url) }
    }

    private func route(_ url: URL) async {
        // cold start: wait for the account and the first screen
        var waited = 0
        while (!Api.shared.restored || Api.shared.session == nil) && waited < 60 {
            try? await Task.sleep(nanoseconds: 100_000_000)
            waited += 1
        }
        guard let session = Api.shared.session else { return }
        try? await Task.sleep(nanoseconds: 350_000_000)
        let host = (url.host ?? "").lowercased()
        let parts = url.pathComponents.filter { $0 != "/" && !$0.isEmpty }
        if session.isDriver {
            await routeDriver(host, parts)
        } else {
            await routeStaff(host, parts)
        }
    }

    private func routeStaff(_ host: String, _ parts: [String]) async {
        Nav.shared.popToRoot()
        switch host {
        case "today", "driver":
            tab = 0
        case "orders":
            tab = 1
        case "trips":
            tab = 3
        case "requests":
            tab = 0
            pushPage(RequestsPage())
        case "chats":
            pushPage(ChatsPage())
        case "drivers":
            pushPage(DriversPage())
        case "order":
            guard let id = parts.first else { tab = 1; return }
            if Store.shared.order(id) == nil { await Store.shared.refresh() }
            if Store.shared.order(id) != nil { pushPage(OrderDetailPage(orderId: id)) } else { tab = 1 }
        case "trip":
            tab = 3
            guard let id = parts.first else { return }
            if Store.shared.trip(id) == nil { await Store.shared.refresh() }
            if Store.shared.trip(id) != nil { pushPage(TripDetailPage(tripId: id)) }
        default:
            break
        }
    }

    private func routeDriver(_ host: String, _ parts: [String]) async {
        Nav.shared.popToRoot()
        DriverData.shared.wantTab = 0
        guard host == "driver", parts.count >= 2, parts[0] == "order" else { return }
        let id = parts[1]
        if !DriverData.shared.orders.contains(where: { $0.id == id }) { await DriverData.shared.refresh() }
        if DriverData.shared.orders.contains(where: { $0.id == id }) { pushPage(DriverOrderPage(orderId: id)) }
    }
}
