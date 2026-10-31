import SwiftUI

// دليل البوتيكات: the boutiques we buy from on trips, with the sales associate who
// serves us (WhatsApp), the opening hours and the tax-free they give.
// Kept apart from the bootstrap: its own list (/ps/boutiques), cached on the phone.

/// One boutique in the directory.
struct Boutique: Identifiable, Equatable {
    let id: String
    var name: String
    var brand: String?
    var city: String?
    var country: String?
    var address: String?
    var mapsUrl: String?
    var contactName: String?
    var contactPhone: String?
    var contactInstagram: String?
    var openingHours: String?
    var taxFree: Bool
    var taxFreePct: Double?
    var taxFreeNote: String?
    var notes: String?
    var lastVisitAt: Date?

    init(_ m: JSON) {
        id = jstr(m["id"])
        name = jstr(m["name"])
        brand = js(m["brand"])
        city = js(m["city"])
        country = js(m["country"])
        address = js(m["address"])
        mapsUrl = js(m["maps_url"])
        contactName = js(m["contact_name"])
        contactPhone = js(m["contact_phone"])
        contactInstagram = js(m["contact_instagram"])
        openingHours = js(m["opening_hours"])
        taxFree = jb(m["tax_free"])
        taxFreePct = jdn(m["tax_free_pct"])
        taxFreeNote = js(m["tax_free_note"])
        notes = js(m["notes"])
        lastVisitAt = jdate(m["last_visit_at"])
    }

    /// «تاكس فري ١٢٪» label (nil when the boutique gives none).
    var taxFreeLabel: String? {
        guard taxFree else { return nil }
        if let p = taxFreePct, p > 0 { return "تاكس فري \(amountText(p))٪" }
        return "تاكس فري"
    }

    /// باريس · فرنسا
    var placeLine: String? {
        let p = [city, country].compactMap { $0 }.filter { !$0.isEmpty }
        return p.isEmpty ? nil : p.joined(separator: " · ")
    }

    /// The map link: the saved one, else a search for the name and address.
    var mapsLink: String? {
        if let u = mapsUrl, !u.isEmpty { return u.hasPrefix("http") ? u : "https://" + u }
        let q = [name, address, city, country].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: ", ")
        guard address != nil || city != nil else { return nil }
        let enc = q.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? ""
        return "https://maps.apple.com/?q=\(enc)"
    }

    var instagramLink: String? {
        guard let h = contactInstagram, !h.isEmpty else { return nil }
        return "https://instagram.com/\(h)"
    }
}

/// A store name already used on pieces but not in the directory yet.
struct BoutiqueSuggestion: Identifiable, Equatable {
    var id: String { Brands.norm(name) }
    let name: String
    let brand: String?
    let country: String?
    let pieces: Int
    let lastUsedAt: Date?

    init(_ m: JSON) {
        name = jstr(m["name"])
        brand = js(m["brand"])
        country = js(m["country"])
        pieces = ji(m["pieces"])
        lastUsedAt = jdate(m["last_used_at"])
    }
}

/// The directory: loaded once, cached on the phone, refreshed after every change.
@MainActor
final class BoutiqueBook: ObservableObject {
    static let shared = BoutiqueBook()
    private init() {}

    @Published private(set) var all: [Boutique] = []
    @Published private(set) var loaded = false
    @Published private(set) var suggestions: [BoutiqueSuggestion] = []

    private var fetchedAt: Date?
    private var cacheOwner: String?
    private var defaultsKey: String { "gh_boutiques_v1_\(Api.shared.cacheKey)" }

    // MARK: loading

    /// Shows the phone's copy at once, then asks the server (at most every 5 minutes).
    func loadIfNeeded() async {
        if cacheOwner != Api.shared.cacheKey { restoreCache() }
        if let f = fetchedAt, Date().timeIntervalSince(f) < 300 { return }
        try? await load()
    }

    func load() async throws {
        let res = try await Api.shared.get("/ps/boutiques") as? JSON ?? [:]
        let raw = jlist(res["boutiques"])
        all = raw.map(Boutique.init)
        loaded = true
        fetchedAt = Date()
        if let d = try? JSONSerialization.data(withJSONObject: raw) { UserDefaults.standard.set(d, forKey: defaultsKey) }
    }

    func loadSuggestions() async throws {
        let res = try await Api.shared.get("/ps/boutiques/suggest") as? JSON ?? [:]
        suggestions = jlist(res["suggestions"]).map(BoutiqueSuggestion.init)
    }

    private func restoreCache() {
        cacheOwner = Api.shared.cacheKey
        fetchedAt = nil
        suggestions = []
        if let d = UserDefaults.standard.data(forKey: defaultsKey),
           let raw = try? JSONSerialization.jsonObject(with: d) as? [Any] {
            all = jlist(raw).map(Boutique.init)
            loaded = true
        } else {
            all = []
            loaded = false
        }
    }

    // MARK: lookups

    func boutique(_ id: String) -> Boutique? { all.first { $0.id == id } }

    /// The directory entry for a store name (as typed on the pieces): same name once
    /// normalised ("LV Champs-Elysées" = "lv champs elysees"), else the one entry whose
    /// name contains it or is contained in it.
    func match(_ name: String) -> Boutique? {
        let n = Brands.norm(name)
        guard !n.isEmpty else { return nil }
        if let b = all.first(where: { Brands.norm($0.name) == n }) { return b }
        guard n.count >= 4 else { return nil }
        let near = all.filter {
            let m = Brands.norm($0.name)
            return m.count >= 4 && (m.contains(n) || n.contains(m))
        }
        return near.count == 1 ? near[0] : nil
    }

    // MARK: changes

    /// Adds (id nil) or changes a boutique. Gives back the saved one.
    @discardableResult
    func save(id: String?, _ body: JSON) async throws -> Boutique {
        let res: Any?
        if let id { res = try await Api.shared.put("/ps/boutiques/\(id)", body) }
        else { res = try await Api.shared.post("/ps/boutiques", body) }
        var b: Boutique
        if let m = (res as? JSON)?["boutique"] as? JSON {
            b = Boutique(m)
        } else {
            // demo mode: the server is not asked
            var m = body
            m["id"] = id ?? "demo-\(UUID().uuidString.prefix(8))"
            if jb(body["visited"]) { m["last_visit_at"] = ISO8601DateFormatter().string(from: Date()) }
            b = Boutique(m)
            if let id, let old = boutique(id) { b = merged(old, body, into: b) }
        }
        if let k = all.firstIndex(where: { $0.id == b.id }) { all[k] = b } else { all.append(b) }
        loaded = true
        let key = Brands.norm(b.name)
        suggestions.removeAll { $0.id == key }
        Task { try? await self.load() }
        return b
    }

    /// «زرته اليوم»
    @discardableResult
    func markVisited(_ id: String) async throws -> Boutique {
        try await save(id: id, ["visited": true])
    }

    func delete(_ id: String) async throws {
        try await Api.shared.delete("/ps/boutiques/\(id)")
        all.removeAll { $0.id == id }
        Task {
            try? await self.load()
            try? await self.loadSuggestions()
        }
    }

    /// Adds a store from the suggestions in one tap (name, brand, country as found on the pieces).
    @discardableResult
    func add(_ s: BoutiqueSuggestion) async throws -> Boutique {
        try await save(id: nil, ["name": s.name, "brand": nn(s.brand), "country": nn(s.country)])
    }

    /// Demo mode only: keep the fields that a partial update did not send.
    private func merged(_ old: Boutique, _ body: JSON, into new: Boutique) -> Boutique {
        var b = old
        if body["name"] != nil { b.name = new.name }
        if body["brand"] != nil { b.brand = new.brand }
        if body["city"] != nil { b.city = new.city }
        if body["country"] != nil { b.country = new.country }
        if body["address"] != nil { b.address = new.address }
        if body["maps_url"] != nil { b.mapsUrl = new.mapsUrl }
        if body["contact_name"] != nil { b.contactName = new.contactName }
        if body["contact_phone"] != nil { b.contactPhone = new.contactPhone }
        if body["contact_instagram"] != nil { b.contactInstagram = new.contactInstagram }
        if body["opening_hours"] != nil { b.openingHours = new.openingHours }
        if body["tax_free"] != nil { b.taxFree = new.taxFree }
        if body["tax_free_pct"] != nil { b.taxFreePct = new.taxFreePct }
        if body["tax_free_note"] != nil { b.taxFreeNote = new.taxFreeNote }
        if body["notes"] != nil { b.notes = new.notes }
        if body["visited"] != nil { b.lastVisitAt = new.lastVisitAt }
        return b
    }
}

extension Store {
    /// The دليل البوتيكات entry for a store name typed on the pieces (nil when it is not in the directory,
    /// or the directory has not loaded yet: call `await BoutiqueBook.shared.loadIfNeeded()` first).
    static func boutiqueFor(name: String) -> Boutique? { BoutiqueBook.shared.match(name) }
}

/// «اليوم», «أمس», «قبل ٥ أيام», else the date.
func boutiqueVisitText(_ d: Date?) -> String {
    guard let d else { return "ما زرته للحين" }
    let cal = Calendar(identifier: .gregorian)
    let days = cal.dateComponents([.day], from: cal.startOfDay(for: d), to: cal.startOfDay(for: Date())).day ?? 0
    switch days {
    case ..<1: return "اليوم"
    case 1: return "أمس"
    case 2: return "قبل يومين"
    case 3...10: return "قبل \(days) أيام"
    case 11...30: return "قبل \(days) يوم"
    default: return dateStr(d)
    }
}
