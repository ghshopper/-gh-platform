import SwiftUI

// The old app database (Supabase), reached over its REST API: sign-in through
// /auth/v1 and table reads through /rest/v1, like the Dart Supabase client.

fileprivate enum LegacyConfig {
    static let url = "https://pjrkwzmyhjmsukdcygik.supabase.co"
    static let key = "sb_publishable_SKNNfswdPLbwj0BymUf-yQ_UVwnzANY"
}

/// Sign-in to the old database failed (Dart AuthException).
fileprivate struct LegacyAuthError: Error {}

@MainActor
fileprivate final class LegacyDB {
    static let shared = LegacyDB()

    private let kAccess = "gh_legacy_access"
    private let kRefresh = "gh_legacy_refresh"
    private let kExpires = "gh_legacy_expires"

    private(set) var accessToken: String?
    private var refreshToken: String?
    private var expiresAt: Double = 0
    private var restored = false

    private init() {}

    /// The signed-in session of the old database (nil when signed out).
    var hasSession: Bool { accessToken != nil }

    /// Like Supabase.initialize: loads the saved session and refreshes it when it expired.
    func restore() async {
        if restored { return }
        restored = true
        accessToken = Keychain.get(kAccess)
        refreshToken = Keychain.get(kRefresh)
        expiresAt = Double(Keychain.get(kExpires) ?? "") ?? 0
        guard accessToken != nil else { return }
        if expiresAt > 0 && Date().timeIntervalSince1970 >= expiresAt - 30 {
            do {
                try await refresh()
            } catch {
                clear()
            }
        }
    }

    func signIn(email: String, password: String) async throws {
        do {
            let res = try await auth("password", ["email": email, "password": password])
            save(res)
        } catch {
            throw LegacyAuthError()
        }
        if accessToken == nil { throw LegacyAuthError() }
    }

    private func refresh() async throws {
        guard let rt = refreshToken else { throw LegacyAuthError() }
        let res = try await auth("refresh_token", ["refresh_token": rt])
        save(res)
        if accessToken == nil { throw LegacyAuthError() }
    }

    private func clear() {
        accessToken = nil
        refreshToken = nil
        expiresAt = 0
        Keychain.set(nil, for: kAccess)
        Keychain.set(nil, for: kRefresh)
        Keychain.set(nil, for: kExpires)
    }

    private func save(_ res: JSON) {
        accessToken = js(res["access_token"])
        refreshToken = js(res["refresh_token"]) ?? refreshToken
        if let at = jdn(res["expires_at"]) {
            expiresAt = at
        } else if let inSec = jdn(res["expires_in"]) {
            expiresAt = Date().timeIntervalSince1970 + inSec
        } else {
            expiresAt = 0
        }
        Keychain.set(accessToken, for: kAccess)
        Keychain.set(refreshToken, for: kRefresh)
        Keychain.set(String(expiresAt), for: kExpires)
    }

    private func auth(_ grant: String, _ body: [String: String]) async throws -> JSON {
        guard let url = URL(string: "\(LegacyConfig.url)/auth/v1/token?grant_type=\(grant)") else { throw LegacyAuthError() }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.timeoutInterval = 30
        req.setValue(LegacyConfig.key, forHTTPHeaderField: "apikey")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await URLSession.shared.data(for: req)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        guard (200..<300).contains(status) else { throw LegacyAuthError() }
        return (try? JSONSerialization.jsonObject(with: data)) as? JSON ?? [:]
    }

    /// db.from(table).select()
    func select(_ table: String) async throws -> [Any] {
        let raw = try await rest(table)
        return raw as? [Any] ?? []
    }

    /// db.from(table).select().maybeSingle(): the one row, or nil.
    func maybeSingle(_ table: String) async throws -> Any? {
        let rows = try await select(table)
        if rows.count > 1 {
            throw ApiError(message: "JSON object requested, multiple (or no) rows returned")
        }
        return rows.first
    }

    private func rest(_ table: String) async throws -> Any? {
        guard let url = URL(string: "\(LegacyConfig.url)/rest/v1/\(table)?select=*") else { return nil }
        var req = URLRequest(url: url)
        req.httpMethod = "GET"
        req.timeoutInterval = 60
        req.setValue(LegacyConfig.key, forHTTPHeaderField: "apikey")
        req.setValue("Bearer \(accessToken ?? LegacyConfig.key)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        let (data, response) = try await URLSession.shared.data(for: req)
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        let json = data.isEmpty ? nil : try? JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed])
        if (200..<300).contains(status) { return json }
        let msg = js((json as? JSON)?["message"])
        throw ApiError(message: msg ?? "صار خطأ (\(status))", status: status)
    }
}

/// Copies customers, orders, payments, trips, expenses, purchase invoices and
/// company details from the old app database to ghshopper.com. Safe to run
/// again: nothing is duplicated.
struct ImportPage: View {
    @State private var email = ""
    @State private var password = ""
    @State private var busy = false
    @State private var needsLogin = false
    @State private var result: String?

    init() {}

    var body: some View {
        GHPage("نقل البيانات القديمة") {
            loginSection
            Pad(top: 16) {
                PrimaryButton("انقل البيانات", icon: "arrow.down.doc.fill", busy: busy) { run() }
            }
            if let result {
                Text(result)
                    .font(.gh(16, .semibold))
                    .foregroundStyle(GH.green)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                    .padding(24)
            }
        }
        .task {
            await LegacyDB.shared.restore()
            needsLogin = !LegacyDB.shared.hasSession
        }
    }

    private var loginSection: some View {
        GHSection(footer: "ينسخ العملاء والطلبات والقطع والدفعات والرحلات والمصاريف وفواتير الشراء وبيانات الشركة من النظام القديم إلى ghshopper.com. تقدر تعيده بأمان، ما يتكرر شي.") {
            if needsLogin {
                FieldRow("الإيميل القديم", text: $email, keyboard: .email, ltr: true)
                FieldRow("كلمة المرور", text: $password, ltr: true)
            }
        }
    }

    private func count(_ c: JSON, _ k: String) -> String { js(c[k]) ?? "0" }

    private func run() {
        busy = true
        result = nil
        let mail = email.trimmingCharacters(in: .whitespacesAndNewlines)
        let pass = password
        Task {
            do {
                let db = LegacyDB.shared
                await db.restore()
                if !db.hasSession {
                    try await db.signIn(email: mail, password: pass)
                }
                let customers = try await db.select("gh_customers")
                let orders = try await db.select("gh_orders")
                let items = try await db.select("gh_order_items")
                let payments = try await db.select("gh_payments")
                let trips = try await db.select("gh_trips")
                let expenses = try await db.select("gh_trip_expenses")
                let invoices = try await db.select("gh_purchase_invoices")
                let settings = try await db.maybeSingle("gh_settings")
                let body: JSON = [
                    "customers": customers,
                    "orders": orders,
                    "items": items,
                    "payments": payments,
                    "trips": trips,
                    "expenses": expenses,
                    "invoices": invoices,
                    "settings": nn(settings),
                ]
                let res = try await Api.shared.post("/ps/import", body)
                let c = ((res as? JSON)?["counts"] as? JSON) ?? [:]
                await Store.shared.refresh()
                result = "تم ✓  \(count(c, "customers")) عميل · \(count(c, "orders")) طلب · \(count(c, "items")) قطعة · \(count(c, "payments")) دفعة · \(count(c, "trips")) رحلة"
            } catch is LegacyAuthError {
                toast("الإيميل أو كلمة المرور القديمة غلط", error: true)
            } catch {
                toastError(error)
            }
            busy = false
        }
    }
}
