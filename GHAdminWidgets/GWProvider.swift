import Foundation
import WidgetKit

/// One moment of a widget's timeline.
struct GWEntry: TimelineEntry {
    let date: Date
    let state: GWState
}

/// Loads the numbers: fresh from the server with the shared token, else the
/// last snapshot the app saved. Every widget refreshes about every 15 minutes
/// (and right away when the app changes something).
struct GWProvider: TimelineProvider {
    func placeholder(in context: Context) -> GWEntry {
        GWEntry(date: Date(), state: GWState.sampleStaff)
    }

    func getSnapshot(in context: Context, completion: @escaping (GWEntry) -> Void) {
        if context.isPreview {
            completion(GWEntry(date: Date(), state: GWLoader.cachedOrSample()))
            return
        }
        Task {
            let state = await GWLoader.load()
            completion(GWEntry(date: Date(), state: state))
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<GWEntry>) -> Void) {
        Task {
            let state = await GWLoader.load()
            let now = Date()
            let next = now.addingTimeInterval(15 * 60)
            completion(Timeline(entries: [GWEntry(date: now, state: state)], policy: .after(next)))
        }
    }
}

enum GWLoader {
    /// A snapshot younger than this is used as is (the app just saved it).
    private static let fresh: TimeInterval = 90

    /// For the widget gallery: the real cached numbers, else the sample.
    static func cachedOrSample() -> GWState {
        guard let s = GWShared.loadSession(), !s.isDemo else {
            return GWState.sampleStaff
        }
        if s.isDriver {
            return GWState(session: s, summary: nil, driver: GWShared.loadDriver() ?? GWSample.driver)
        }
        return GWState(session: s, summary: GWShared.loadSummary() ?? GWSample.summary, driver: nil)
    }

    static func load() async -> GWState {
        guard let s = GWShared.loadSession() else { return GWState.signedOut }
        if s.isDemo {
            return s.isDriver ? GWState(session: s, summary: nil, driver: GWSample.driver)
                : GWState(session: s, summary: GWSample.summary, driver: nil)
        }
        if s.isDriver {
            let cached = GWShared.loadDriver()
            if let c = cached, Date().timeIntervalSince(c.updatedAt) < fresh {
                return GWState(session: s, summary: nil, driver: c)
            }
            let live = await fetchDriver(s)
            if let live { GWShared.saveDriver(live) }
            return GWState(session: s, summary: nil, driver: live ?? cached)
        }
        let cached = GWShared.loadSummary()
        if let c = cached, Date().timeIntervalSince(c.updatedAt) < fresh {
            return GWState(session: s, summary: c, driver: nil)
        }
        let live = await fetchStaff(s)
        if let live { GWShared.saveSummary(live) }
        return GWState(session: s, summary: live ?? cached, driver: nil)
    }

    private static func fetchStaff(_ s: GWSession) async -> GWSummary? {
        guard let m = await get(s, "/ps/widget") else { return nil }
        return GWSummary(server: m)
    }

    private static func fetchDriver(_ s: GWSession) async -> GWDriverSummary? {
        async let ordersRaw = get(s, "/ps/driver/orders")
        async let accountRaw = get(s, "/ps/driver/account")
        let orders = await ordersRaw
        let account = await accountRaw
        guard let orders else { return nil }
        let rows = ((orders["orders"] as? [Any]) ?? []).compactMap { $0 as? [String: Any] }
        return GWDriverSummary(orders: rows, account: account, name: s.name)
    }

    private static func get(_ s: GWSession, _ path: String) async -> [String: Any]? {
        guard let url = URL(string: s.api + path) else { return nil }
        var req = URLRequest(url: url)
        req.timeoutInterval = 10
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        req.setValue("Bearer \(s.token)", forHTTPHeaderField: "Authorization")
        guard let result = try? await URLSession.shared.data(for: req) else { return nil }
        let status = (result.1 as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else { return nil }
        return (try? JSONSerialization.jsonObject(with: result.0)) as? [String: Any]
    }
}
