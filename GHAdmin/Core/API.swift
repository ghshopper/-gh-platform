import Foundation
import Security

enum AppConfig {
    /// The GH Shopper server (Laravel on ghshopper.com).
    static let apiBaseUrl = "https://ghshopper.com/api"
    /// Public order-tracking page; the order's secret token is appended.
    static let trackingBaseUrl = "https://ghshopper.com/track/?t="
}

/// A failed request, with a message that can be shown to the user.
struct ApiError: LocalizedError {
    let message: String
    var status: Int?
    var errorDescription: String? { message }
}

/// The account asks for the authenticator code before signing in.
struct TwoFactorRequired: Error { let challenge: String }

/// The signed-in account: the owner (admin) or a delivery driver.
struct Session: Equatable {
    let token: String
    let role: String // admin / driver
    let name: String
    var isDriver: Bool { role == "driver" }
}

/// iPhone keychain (the login token never sits in plain storage).
enum Keychain {
    private static let service = "app.ghshopper.admin"

    static func set(_ value: String?, for key: String) {
        let base: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
                                   kSecAttrService as String: service,
                                   kSecAttrAccount as String: key]
        SecItemDelete(base as CFDictionary)
        guard let value, let data = value.data(using: .utf8) else { return }
        var add = base
        add[kSecValueData as String] = data
        add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(add as CFDictionary, nil)
    }

    static func get(_ key: String) -> String? {
        let q: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
                                kSecAttrService as String: service,
                                kSecAttrAccount as String: key,
                                kSecReturnData as String: true,
                                kSecMatchLimit as String: kSecMatchLimitOne]
        var out: AnyObject?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let d = out as? Data else { return nil }
        return String(data: d, encoding: .utf8)
    }
}

/// Talks to the GH Shopper server (ghshopper.com).
@MainActor
final class Api: ObservableObject {
    static let shared = Api()
    private init() {}

    @Published private(set) var session: Session?
    @Published private(set) var restored = false

    var base: String { AppConfig.apiBaseUrl }
    /// A stable key for the on-phone cache of the current account.
    var cacheKey: String { "\(session?.role ?? ""):\(session?.name ?? "")" }

    private let kToken = "gh_api_token", kRole = "gh_api_role", kName = "gh_api_name"

    // MARK: session

    func restore() {
        if let t = Keychain.get(kToken), let r = Keychain.get(kRole) {
            session = Session(token: t, role: r, name: Keychain.get(kName) ?? "")
        }
        restored = true
        WidgetBridge.sessionChanged(session)
        LiveActivities.endStale(session)
    }

    /// Demo mode (screenshots): a fake signed-in owner, no network.
    func useDemoSession(role: String = "admin") {
        session = Session(token: "demo", role: role, name: "غسان")
        restored = true
        WidgetBridge.sessionChanged(session)
    }

    /// Drivers type their phone; it maps to their private sign-in e-mail.
    static func loginEmail(_ input: String) -> String {
        let t = input.trimmingCharacters(in: .whitespaces)
        if t.contains("@") { return t }
        var d = normalizeDigits(t).filter { $0.isNumber && $0.isASCII }
        if d.count == 8 { d = "968" + d }
        return "d\(d)@drivers.ghshopper.com"
    }

    func login(_ emailOrPhone: String, _ password: String) async throws {
        let res = try await send("POST", "/auth/login",
                                 body: ["email": Api.loginEmail(emailOrPhone), "password": password, "device": "gh-iphone"],
                                 auth: false) as? JSON ?? [:]
        if jb(res["two_factor_required"]) { throw TwoFactorRequired(challenge: jstr(res["challenge"])) }
        guard let token = js(res["token"]) else { throw ApiError(message: "ما قدرنا نسجّل دخول") }
        try await finishLogin(token)
    }

    /// Second step: the 6-digit code from the authenticator app.
    func loginTwoFactor(_ challenge: String, _ code: String) async throws {
        let res = try await send("POST", "/auth/two-factor", body: ["challenge": challenge, "code": normalizeDigits(code)], auth: false) as? JSON ?? [:]
        guard let token = js(res["token"]) else { throw ApiError(message: "الرمز غير صحيح") }
        try await finishLogin(token)
    }

    private func finishLogin(_ token: String) async throws {
        let me = try await send("GET", "/ps/me", token: token) as? JSON ?? [:]
        let role = js(me["role"]) ?? "none"
        if role != "admin" && role != "driver" {
            Task { _ = try? await self.send("POST", "/auth/logout", token: token) }
            throw ApiError(message: "هذا الحساب ما له صلاحية على التطبيق")
        }
        let s = Session(token: token, role: role, name: jstr(me["name"]))
        Keychain.set(token, for: kToken)
        Keychain.set(role, for: kRole)
        Keychain.set(s.name, for: kName)
        session = s
        WidgetBridge.sessionChanged(s)
    }

    func logout() {
        let token = session?.token
        session = nil
        Keychain.set(nil, for: kToken)
        Keychain.set(nil, for: kRole)
        Keychain.set(nil, for: kName)
        WidgetBridge.sessionChanged(nil)
        LiveActivities.endAll()
        if let token, token != "demo" {
            Task { _ = try? await self.send("POST", "/auth/logout", token: token) }
        }
    }

    // MARK: requests

    @discardableResult func get(_ path: String) async throws -> Any? { try await send("GET", path) }
    @discardableResult func post(_ path: String, _ body: JSON = [:]) async throws -> Any? { try await send("POST", path, body: body) }
    @discardableResult func put(_ path: String, _ body: JSON = [:]) async throws -> Any? { try await send("PUT", path, body: body) }
    @discardableResult func patch(_ path: String, _ body: JSON = [:]) async throws -> Any? { try await send("PATCH", path, body: body) }
    @discardableResult func delete(_ path: String, _ body: JSON? = nil) async throws -> Any? { try await send("DELETE", path, body: body) }

    /// Sends a photo (JPEG) with optional form fields.
    @discardableResult
    func upload(_ path: String, field: String, data: Data, filename: String = "photo.jpg", mime: String = "image/jpeg",
                fields: [String: String] = [:]) async throws -> Any? {
        if session?.token == "demo" { return nil }
        var req = URLRequest(url: URL(string: base + path)!)
        req.httpMethod = "POST"
        req.timeoutInterval = 60
        headers(session?.token).forEach { req.setValue($1, forHTTPHeaderField: $0) }
        let boundary = "gh-\(UUID().uuidString)"
        req.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        var body = Data()
        func add(_ s: String) { body.append(s.data(using: .utf8)!) }
        for (k, v) in fields {
            add("--\(boundary)\r\nContent-Disposition: form-data; name=\"\(k)\"\r\n\r\n\(v)\r\n")
        }
        add("--\(boundary)\r\nContent-Disposition: form-data; name=\"\(field)\"; filename=\"\(filename)\"\r\nContent-Type: \(mime)\r\n\r\n")
        body.append(data)
        add("\r\n--\(boundary)--\r\n")
        req.httpBody = body
        return try await perform(req)
    }

    private func headers(_ token: String?) -> [String: String] {
        var h = ["Accept": "application/json"]
        if let token { h["Authorization"] = "Bearer \(token)" }
        return h
    }

    func send(_ method: String, _ path: String, body: JSON? = nil, auth: Bool = true, token: String? = nil) async throws -> Any? {
        let t = token ?? (auth ? session?.token : nil)
        if t == "demo" { return DemoData.respond(method, path, body) }
        var req = URLRequest(url: URL(string: base + path)!)
        req.httpMethod = method
        req.timeoutInterval = 30
        headers(t).forEach { req.setValue($1, forHTTPHeaderField: $0) }
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONSerialization.data(withJSONObject: jsonSafe(body))
        }
        return try await perform(req)
    }

    private func perform(_ req: URLRequest) async throws -> Any? {
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: req)
        } catch {
            throw ApiError(message: "ما في اتصال بالإنترنت أو السيرفر ما رد")
        }
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        let json = data.isEmpty ? nil : try? JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed])
        if (200..<300).contains(status) { return json }

        let expired = status == 401 && session != nil
        if expired { logout() }
        var msg: String?
        if let m = json as? JSON {
            msg = js(m["message"])
            if let errors = m["errors"] as? JSON, let first = errors.values.first {
                if let arr = first as? [Any], let f = arr.first { msg = "\(f)" }
            }
        }
        if expired { msg = "انتهت الجلسة، سجّل دخول مرة ثانية" }
        if status == 403 && msg == nil { msg = "ما عندك صلاحية" }
        if status >= 500 { msg = "صار خطأ في السيرفر، حاول بعد شوي" }
        throw ApiError(message: msg ?? "صار خطأ (\(status))", status: status)
    }
}

/// Turns any error into a short Arabic message.
func errorText(_ e: Error) -> String {
    if let a = e as? ApiError { return a.message }
    if (e as NSError).domain == NSURLErrorDomain { return "ما في اتصال بالإنترنت" }
    return "صار خطأ: \(e.localizedDescription)"
}

/// JSON bodies may hold optionals: nil becomes JSON null.
func nn(_ v: Any?) -> Any { v ?? NSNull() }

/// Makes a body JSON-safe: optionals unwrapped (nil → null), Dates → yyyy-MM-dd.
func jsonSafe(_ v: Any) -> Any {
    let mirror = Mirror(reflecting: v)
    if mirror.displayStyle == .optional {
        guard let child = mirror.children.first else { return NSNull() }
        return jsonSafe(child.value)
    }
    if let d = v as? [String: Any] { return d.mapValues { jsonSafe($0) } }
    if let a = v as? [Any] { return a.map { jsonSafe($0) } }
    if let date = v as? Date { return dayString(date) }
    return v
}
