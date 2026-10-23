import Foundation
import LocalAuthentication
import UIKit

// MARK: - Exchange rates

/// Live exchange rates (OMR per one unit of a currency), refreshed at most
/// every 6 hours and cached on the phone. Falls back to defaultRates.
@MainActor
final class Rates: ObservableObject {
    static let shared = Rates()
    private init() {}

    private let key = "gh_rates_v1"
    @Published private(set) var rates: [String: Double] = [:]
    private(set) var updatedAt: Date?

    func rate(_ currency: String) -> Double { rates[currency] ?? defaultRates[currency] ?? 1 }
    var isLive: Bool { !rates.isEmpty }

    func load() async {
        if let raw = UserDefaults.standard.data(forKey: key),
           let m = try? JSONSerialization.jsonObject(with: raw) as? JSON {
            rates = (m["rates"] as? [String: Any])?.mapValues { jd($0) } ?? [:]
            updatedAt = jdate(m["at"])
        }
        if let u = updatedAt, Date().timeIntervalSince(u) < 6 * 3600 { return }
        await fetch()
    }

    private func fetch() async {
        guard let url = URL(string: "https://open.er-api.com/v6/latest/OMR") else { return }
        var req = URLRequest(url: url)
        req.timeoutInterval = 8
        guard let (data, resp) = try? await URLSession.shared.data(for: req),
              (resp as? HTTPURLResponse)?.statusCode == 200,
              let body = try? JSONSerialization.jsonObject(with: data) as? JSON,
              let perOmr = body["rates"] as? JSON else { return }
        var out: [String: Double] = [:]
        for c in defaultRates.keys {
            let v = jd(perOmr[c])
            if v > 0 { out[c] = 1 / v }
        }
        if out.isEmpty { return }
        rates = out
        updatedAt = Date()
        let iso = ISO8601DateFormatter().string(from: Date())
        if let d = try? JSONSerialization.data(withJSONObject: ["rates": out, "at": iso]) {
            UserDefaults.standard.set(d, forKey: key)
        }
        // the dashboard's estimates use the same live rates
        if let s = Api.shared.session, s.role != "driver" {
            _ = try? await Api.shared.put("/ps/fx-rates", ["rates": out])
        }
    }

    /// Rounded for display in input fields.
    func rateText(_ currency: String) -> String {
        let r = rate(currency)
        return r >= 1 ? String(format: "%.3f", r) : String(format: "%.4f", r)
    }
}

// MARK: - Face ID lock

/// Optional Face ID / passcode lock when opening the app.
enum AppLock {
    private static let key = "gh_face_id"

    static var isEnabled: Bool {
        get { UserDefaults.standard.bool(forKey: key) }
        set { UserDefaults.standard.set(newValue, forKey: key) }
    }

    static var isAvailable: Bool {
        LAContext().canEvaluatePolicy(.deviceOwnerAuthentication, error: nil)
    }

    static func unlock() async -> Bool {
        let ctx = LAContext()
        return (try? await ctx.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: "افتح GH Shopper")) ?? false
    }
}
