import SwiftUI

// MARK: - The directory

/// «دليل البوتيكات»: every boutique by city, with its sales associate and tax-free.
@MainActor
struct BoutiquesPage: View {
    @ObservedObject private var book = BoutiqueBook.shared
    @State private var query = ""
    @State private var country = ""
    @State private var city = ""
    @State private var failure: String?
    @State private var adding: Set<String> = []

    private static let noCity = "بدون مدينة"

    var body: some View {
        GHPage("دليل البوتيكات", onRefresh: { await reload() }, trailing: {
            NavIcon("plus") { presentForm(BoutiqueFormPage()) }
        }) {
            content
        }
        .task {
            await book.loadIfNeeded()
            if !book.loaded { await reload() }
            try? await book.loadSuggestions()
        }
    }

    // MARK: filters

    private func clean(_ s: String?) -> String {
        (s ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var countries: [String] {
        var seen: [String: String] = [:]
        for b in book.all {
            let c = clean(b.country)
            if !c.isEmpty, seen[Brands.norm(c)] == nil { seen[Brands.norm(c)] = c }
        }
        return seen.values.sorted()
    }

    private var cities: [String] {
        var seen: [String: String] = [:]
        for b in book.all where country.isEmpty || Brands.norm(clean(b.country)) == Brands.norm(country) {
            let c = clean(b.city)
            if !c.isEmpty, seen[Brands.norm(c)] == nil { seen[Brands.norm(c)] = c }
        }
        return seen.values.sorted()
    }

    private var filtered: [Boutique] {
        let q = Brands.norm(query)
        return book.all.filter { b in
            if !country.isEmpty && Brands.norm(clean(b.country)) != Brands.norm(country) { return false }
            if !city.isEmpty && Brands.norm(clean(b.city)) != Brands.norm(city) { return false }
            if q.isEmpty { return true }
            let fields = [b.name, b.brand, b.contactName, b.city, b.country, b.address, b.notes]
            return fields.contains { f in f.map { Brands.norm($0).contains(q) } ?? false }
        }
    }

    /// Cities in the server's order (city, then name); boutiques without a city last.
    private func grouped(_ list: [Boutique]) -> [(String, [Boutique])] {
        var order: [String] = []
        var map: [String: (String, [Boutique])] = [:]
        for b in list {
            let label = clean(b.city).isEmpty ? Self.noCity : clean(b.city)
            let key = label == Self.noCity ? "~" : Brands.norm(label)
            if map[key] == nil { order.append(key); map[key] = (label, []) }
            map[key]?.1.append(b)
        }
        let keys = order.filter { $0 != "~" } + (order.contains("~") ? ["~"] : [])
        return keys.compactMap { map[$0] }
    }

    // MARK: content

    @ViewBuilder private var content: some View {
        if !book.loaded {
            if let failure {
                EmptyState(icon: "wifi.exclamationmark", title: "ما قدرنا نجيب الدليل", message: failure) {
                    SecondaryButton("حاول مرة ثانية", icon: "arrow.clockwise") { Task { await reload() } }
                }
            } else {
                LoadingView()
            }
        } else if book.all.isEmpty {
            EmptyState(icon: "building.2", title: "الدليل فاضي",
                       message: "سجّل البوتيكات اللي تشتري منها: اسم الموظف ورقمه، الدوام، والتاكس فري.") {
                PrimaryButton("أضف بوتيك", icon: "plus") { presentForm(BoutiqueFormPage()) }
            }
            suggestionsSection
        } else {
            Pad(top: 4) {
                ProductSearchField(placeholder: "ابحث: بوتيك، براند، موظف، مدينة", text: $query)
            }
            filtersBar
            let list = filtered
            if list.isEmpty {
                EmptyState(icon: "magnifyingglass", title: "ما لقيت شي", message: "جرّب اسم ثاني أو شيل الفلتر.")
            } else {
                ForEach(grouped(list), id: \.0) { g in
                    GHSection("\(g.0) · \(g.1.count)") {
                        ForEach(g.1) { b in row(b) }
                    }
                }
            }
            suggestionsSection
        }
    }

    @ViewBuilder private var filtersBar: some View {
        let cs = countries
        let ci = cities
        if cs.count > 1 {
            ChipBar {
                ChipButton("كل الدول", selected: country.isEmpty) { country = ""; city = "" }
                ForEach(cs, id: \.self) { c in
                    ChipButton(c, selected: country == c) { country = country == c ? "" : c; city = "" }
                }
            }
            .padding(.top, 10)
        }
        if ci.count > 1 {
            ChipBar {
                ChipButton("كل المدن", selected: city.isEmpty) { city = "" }
                ForEach(ci, id: \.self) { c in
                    ChipButton(c, selected: city == c, icon: "mappin") { city = city == c ? "" : c }
                }
            }
            .padding(.top, cs.count > 1 ? 4 : 10)
        }
    }

    private func row(_ b: Boutique) -> some View {
        var sub: [String] = []
        if let br = b.brand, Brands.norm(br) != Brands.norm(b.name) { sub.append(br) }
        if let c = b.contactName { sub.append(c) }
        if b.city == nil, let co = b.country { sub.append(co) }
        let id = b.id
        return Tile(b.name, subtitle: sub.isEmpty ? nil : sub.joined(separator: " · "),
                    action: { pushPage(BoutiqueDetailPage(id: id)) },
                    leading: { Avatar(b.brand ?? b.name) },
                    trailing: {
                        if let t = b.taxFreeLabel { Badge(t, color: GH.green) }
                    })
    }

    // MARK: suggestions

    @ViewBuilder private var suggestionsSection: some View {
        let s = book.suggestions
        if !s.isEmpty {
            GHSection("أضف من البوتيكات اللي اشتريت منها",
                      footer: "محلات مكتوبة على القطع وما هي في الدليل. اضغط وحدة تنضاف على طول، وبعدين كمّل رقم الموظف والتاكس فري.") {
                ForEach(s.prefix(5)) { x in suggestionRow(x) }
                if s.count > 5 {
                    Tile("عرض الكل (\(s.count))", titleColor: GH.burgundy, action: { pushPage(BoutiqueSuggestPage()) })
                }
            }
        }
    }

    private func suggestionRow(_ s: BoutiqueSuggestion) -> some View {
        boutiqueSuggestionTile(s, busy: adding.contains(s.id)) {
            adding.insert(s.id)
            Task {
                await quickAdd(s)
                adding.remove(s.id)
            }
        }
    }

    private func reload() async {
        do {
            try await book.load()
            failure = nil
        } catch {
            failure = errorText(error)
            if book.loaded { toastError(error) }
        }
        try? await book.loadSuggestions()
    }
}

/// One store from the pieces, with an «أضف» on the side.
@MainActor
func boutiqueSuggestionTile(_ s: BoutiqueSuggestion, busy: Bool, add: @escaping () -> Void) -> some View {
    var sub: [String] = []
    if let b = s.brand, Brands.norm(b) != Brands.norm(s.name) { sub.append(b) }
    if let c = s.country { sub.append(c) }
    sub.append(s.pieces == 1 ? "قطعة وحدة" : (s.pieces == 2 ? "قطعتين" : "\(s.pieces) قطع"))
    return Tile(s.name, subtitle: sub.joined(separator: " · "), chevron: false,
                action: busy ? nil : add,
                leading: { IconBox("bag", color: GH.gold) },
                trailing: {
                    if busy { ProgressView() } else { HeaderButton("أضف", icon: "plus.circle.fill", action: add) }
                })
}

/// Adds a suggested store, then offers to open it.
@MainActor
func quickAdd(_ s: BoutiqueSuggestion) async {
    do {
        let b = try await BoutiqueBook.shared.add(s)
        Haptic.success()
        let id = b.id
        toast("انضاف \(b.name) للدليل، اضغط تكمّل بياناته", onTap: { pushPage(BoutiqueDetailPage(id: id)) })
    } catch {
        toastError(error)
    }
}

/// Every suggested store (when there are more than a few).
@MainActor
struct BoutiqueSuggestPage: View {
    @ObservedObject private var book = BoutiqueBook.shared
    @State private var adding: Set<String> = []

    var body: some View {
        GHPage("من البوتيكات اللي اشتريت منها", onRefresh: { try? await book.loadSuggestions() }, largeTitle: false) {
            if book.suggestions.isEmpty {
                EmptyState(icon: "checkmark.seal", title: "كلها في الدليل", message: "كل المحلات اللي على القطع موجودة في الدليل.")
            } else {
                GHSection("\(book.suggestions.count) محل") {
                    ForEach(book.suggestions) { s in
                        boutiqueSuggestionTile(s, busy: adding.contains(s.id)) {
                            adding.insert(s.id)
                            Task {
                                await quickAdd(s)
                                adding.remove(s.id)
                            }
                        }
                    }
                }
            }
        }
        .task { try? await book.loadSuggestions() }
    }
}

// MARK: - Link from وضع التسوق

/// «البوتيك» row on a store's page in وضع التسوق: opens its directory entry, or offers «أضفه للدليل» prefilled.
@MainActor
struct BoutiqueLinkRow: View {
    let storeName: String
    var brand: String?
    @ObservedObject private var book = BoutiqueBook.shared

    init(storeName: String, brand: String? = nil) {
        self.storeName = storeName
        self.brand = brand
    }

    var body: some View {
        Group {
            if book.loaded {
                GHSection {
                    if let b = book.match(storeName) {
                        let id = b.id
                        Tile("البوتيك", subtitle: subtitle(b), value: b.taxFreeLabel, valueColor: GH.green,
                             valueFont: .gh(13.5, .medium),
                             action: { pushPage(BoutiqueDetailPage(id: id)) },
                             leading: { IconBox("building.2.fill") })
                    } else {
                        Tile("أضفه للدليل", subtitle: "احفظ رقم الموظف والدوام والتاكس فري لهالمحل",
                             titleColor: GH.burgundy,
                             action: { presentForm(BoutiqueFormPage(name: storeName, brand: brand)) },
                             leading: { IconBox("plus", color: GH.gold) })
                    }
                }
            }
        }
        .task { await book.loadIfNeeded() }
    }

    private func subtitle(_ b: Boutique) -> String {
        var p: [String] = []
        if let c = b.contactName { p.append(c) }
        if let h = b.openingHours?.split(separator: "\n").first { p.append(String(h)) }
        if p.isEmpty { p.append(b.name) }
        return p.joined(separator: " · ")
    }
}
