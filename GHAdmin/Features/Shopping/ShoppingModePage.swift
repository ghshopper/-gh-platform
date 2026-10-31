import SwiftUI
import UIKit

// وضع التسوق: used standing in a boutique during a trip. Pieces still to buy,
// by planned store (else brand), big and clear, with one «اشتريتها» each.
// Purchases go through ShoppingQueue (works offline).

// MARK: - Helpers

fileprivate func smEnabled(_ on: Bool, _ f: @escaping () -> Void) -> (() -> Void)? { on ? f : nil }

fileprivate func smTidy(_ s: String) -> String {
    s.split(whereSeparator: { $0.isWhitespace }).joined(separator: " ")
}

fileprivate func smClean(_ s: String?) -> String? {
    let t = smTidy(s ?? "")
    return t.isEmpty ? nil : t
}

/// ٣ → Arabic-Indic digits.
fileprivate func smArabicDigits(_ n: Int) -> String {
    let digits = Array("٠١٢٣٤٥٦٧٨٩")
    return String(String(n).map { c -> Character in c.wholeNumberValue.map { digits[$0] } ?? c })
}

/// "قطعة وحدة" · "قطعتين" · "٣ قطع" · "١٢ قطعة"
fileprivate func smPieces(_ n: Int, arabic: Bool = false) -> String {
    let d = arabic ? smArabicDigits(n) : "\(n)"
    if n == 1 { return "قطعة وحدة" }
    if n == 2 { return "قطعتين" }
    if n >= 3 && n <= 10 { return "\(d) قطع" }
    return "\(d) قطعة"
}

/// The boutique price this piece probably costs, in the given currency.
fileprivate func smGuess(_ i: OrderItem, _ cur: String) -> Double? {
    if let c = i.costAmount, c > 0, i.costCurrency == cur { return c }
    if let e = i.estCost, e > 0, i.estCurrency == cur { return e }
    if let l = i.listPrice, l > 0, i.listCurrency == cur { return l }
    return nil
}

/// "" = orders without a trip.
@MainActor
fileprivate func smOrders(_ tripKey: String) -> [Order] {
    tripKey.isEmpty ? Store.shared.orders.filter { $0.tripId == nil } : Store.shared.ordersOfTrip(tripKey)
}

// MARK: - Remembered choices

fileprivate enum SMPrefs {
    private static var d: UserDefaults { UserDefaults.standard }

    static var lastPlace: PurchasePlace {
        get { PurchasePlace.from(d.string(forKey: "gh_sm_place")) ?? .boutiqueEu }
        set { d.set(newValue.key, forKey: "gh_sm_place") }
    }

    /// EUR in Europe, AED in Dubai, then whatever you used last at that place.
    static func currency(for p: PurchasePlace) -> String {
        d.string(forKey: "gh_sm_cur_\(p.key)") ?? p.currency
    }

    static func setCurrency(_ c: String, for p: PurchasePlace) { d.set(c, forKey: "gh_sm_cur_\(p.key)") }

    /// 12 in a European boutique, 4 in Dubai, then the last one you typed at that place.
    static func taxFree(for p: PurchasePlace) -> Double {
        let k = "gh_sm_tf_\(p.key)"
        return d.object(forKey: k) == nil ? p.taxFreePct : d.double(forKey: k)
    }

    static func setTaxFree(_ v: Double, for p: PurchasePlace) { d.set(v, forKey: "gh_sm_tf_\(p.key)") }
}

// MARK: - Entries and groups

fileprivate struct ShoppingEntry: Identifiable {
    let order: Order
    let item: OrderItem
    var id: String { item.id }
}

fileprivate enum SMPieceState { case open, pending, failed, done }

@MainActor
fileprivate func smState(_ e: ShoppingEntry) -> SMPieceState {
    let q = ShoppingQueue.shared
    if let p = q.entry(e.id) { return p.blocked ? .failed : .pending }
    if q.recorded[e.id] != nil || e.item.status != .requested { return .done }
    return .open
}

/// Pieces still to buy, plus the ones bought on this phone (so you see your progress).
@MainActor
fileprivate func smEntries(_ orders: [Order]) -> [ShoppingEntry] {
    let q = ShoppingQueue.shared
    var out: [ShoppingEntry] = []
    for o in orders {
        for i in o.activeItems where !i.instant && (i.status == .requested || q.isLocal(i.id)) {
            out.append(ShoppingEntry(order: o, item: i))
        }
    }
    return out
}

fileprivate struct SMGroup: Identifiable {
    let id: String
    var label: String
    var isStore: Bool
    var entries: [ShoppingEntry]
}

/// One stop per planned store; pieces without a store stay by brand ("LV" and "Louis Vuitton" together).
@MainActor
fileprivate func smGroups(_ entries: [ShoppingEntry]) -> [SMGroup] {
    func caps(_ s: String) -> Int { s.filter { $0.isUppercase }.count }
    var order: [String] = []
    var map: [String: SMGroup] = [:]
    for e in entries {
        let i = e.item
        let store = smTidy(i.planStore ?? "")
        let rawBrand = smTidy(i.brand ?? "")
        let brand = rawBrand.isEmpty ? "" : (Brands.canonical(rawBrand) ?? rawBrand)
        let id: String
        let label: String
        if !store.isEmpty {
            id = "s:" + Brands.norm(store)
            label = store
        } else if !brand.isEmpty {
            id = "b:" + Brands.norm(brand)
            label = brand
        } else {
            id = "n:"
            label = "بدون براند"
        }
        if var g = map[id] {
            if caps(label) > caps(g.label) { g.label = label }
            g.entries.append(e)
            map[id] = g
        } else {
            order.append(id)
            map[id] = SMGroup(id: id, label: label, isStore: !store.isEmpty, entries: [e])
        }
    }
    let groups = order.compactMap { map[$0] }
    func left(_ g: SMGroup) -> Int { g.entries.filter { smState($0) == .open }.count }
    return groups.sorted { a, b in
        let la = left(a) > 0, lb = left(b) > 0
        if la != lb { return la }
        if a.isStore != b.isStore { return a.isStore }
        return a.label.lowercased() < b.label.lowercased()
    }
}

fileprivate enum SMPlaceFilter: Hashable {
    case all, unplanned
    case place(PurchasePlace)
}

fileprivate func smMatchesPlace(_ e: ShoppingEntry, _ f: SMPlaceFilter) -> Bool {
    switch f {
    case .all: return true
    case .unplanned: return e.item.planPlace == nil
    case .place(let p): return e.item.planPlace == p
    }
}

/// The brand a search stands for, even misspelt ("Luis Vitton" → Louis Vuitton).
@MainActor
fileprivate func smBrandHit(_ query: String) -> String? {
    let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
    if Brands.norm(q).count < 2 { return nil }
    return Brands.canonical(q) ?? Brands.correction(for: q)
}

@MainActor
fileprivate func smMatches(_ e: ShoppingEntry, _ query: String, _ brandHit: String?) -> Bool {
    let n = Brands.norm(query)
    if n.isEmpty { return true }
    let i = e.item
    let fields: [String] = [i.brand, i.name, i.details, i.planStore, Store.shared.customer(e.order.customerId)?.name, e.order.clientName]
        .compactMap { $0 }
    if fields.contains(where: { Brands.norm($0).contains(n) }) { return true }
    if let b = brandHit {
        if let raw = i.brand, (Brands.canonical(raw) ?? raw) == b { return true }
        let nb = Brands.norm(b)
        if let s = i.planStore, !nb.isEmpty, Brands.norm(s).contains(nb) { return true }
    }
    return false
}

// MARK: - Today's totals

fileprivate struct SMToday {
    var count = 0
    var byCurrency: [String: Double] = [:]
    var omr = 0.0
    var left = 0
}

@MainActor
fileprivate func smToday(_ orders: [Order]) -> SMToday {
    let q = ShoppingQueue.shared
    let cal = Calendar.current
    let ids = Set(orders.map(\.id))
    var bought: [String: (amount: Double, currency: String, rate: Double)] = [:]
    var left = 0
    for o in orders {
        for i in o.activeItems where !i.instant {
            if i.status == .requested {
                if !q.isLocal(i.id) { left += 1 }
            } else if let d = i.purchasedAt, cal.isDateInToday(d), let a = i.costAmount {
                let c = i.costCurrency ?? "EUR"
                bought[i.id] = (a, c, i.costRate ?? Rates.shared.rate(c))
            }
        }
    }
    // bought on this phone and maybe not on the server yet: counted once (by item id)
    for p in q.pending + Array(q.recorded.values) where ids.contains(p.orderId) && cal.isDateInToday(p.createdAt) {
        bought[p.id] = (p.price, p.currency, p.rate)
    }
    var t = SMToday()
    t.count = bought.count
    t.left = left
    for v in bought.values {
        t.byCurrency[v.currency, default: 0] += v.amount
        t.omr += v.amount * v.rate
    }
    return t
}

// MARK: - Page

/// وضع التسوق. tripId nil: the newest open trip.
@MainActor
struct ShoppingModePage: View {
    let tripId: String?
    @ObservedObject private var store = Store.shared
    @ObservedObject private var queue = ShoppingQueue.shared
    @State private var chosenTrip: String? = nil
    @State private var query = ""
    @State private var placeFilter: SMPlaceFilter = .all

    init(tripId: String? = nil) { self.tripId = tripId }

    /// "" = orders without a trip.
    private var tripKey: String { chosenTrip ?? tripId ?? store.shopDefaultTripId ?? "" }

    private func tripName(_ key: String) -> String {
        key.isEmpty ? "طلبات بدون رحلة" : (store.trip(key)?.name ?? "الرحلة")
    }

    var body: some View {
        let key = tripKey
        GHPage("وضع التسوّق", onRefresh: { await refreshAll() }) {
            if !store.ready {
                LoadingView()
            } else {
                SMQueueBanner()
                GHSection {
                    Tile(tripName(key), subtitle: "اضغط تغيّر الرحلة",
                         action: { Task { await chooseTrip(key) } },
                         leading: { IconBox("airplane", color: GH.gold) })
                }
                SMTotalsView(today: smToday(smOrders(key)))
                storesSection(key)
            }
        }
        .task { await ShoppingQueue.shared.flush() }
    }

    @ViewBuilder
    private func storesSection(_ key: String) -> some View {
        let all = smEntries(smOrders(key))
        if all.isEmpty {
            EmptyState(icon: "checkmark.seal", title: "ما في شي باقي تشتريه",
                       message: "كل قطع هذي الرحلة انشرت. غيّر الرحلة من فوق إذا تبي.")
        } else {
            let places = Set(all.map { e -> SMPlaceFilter in e.item.planPlace.map { SMPlaceFilter.place($0) } ?? SMPlaceFilter.unplanned })
            let hit = smBrandHit(query)
            let filtered = all.filter { smMatchesPlace($0, placeFilter) && smMatches($0, query, hit) }
            let groups = smGroups(filtered)
            Pad(top: 18) { SMSearchField(text: $query) }
            if let hit, Brands.canonical(query) == nil, Brands.norm(hit) != Brands.norm(query) {
                Pad(h: 22, top: 6) {
                    Text("نبحث عن \(hit)").font(TS.small).foregroundStyle(GH.secondary)
                }
            }
            if places.count > 1 {
                ChipBar {
                    ChipButton("الكل", selected: placeFilter == .all) { placeFilter = .all }
                    ForEach(PurchasePlace.allCases.filter { places.contains(.place($0)) }, id: \.self) { p in
                        ChipButton(p.label, selected: placeFilter == .place(p)) { placeFilter = .place(p) }
                    }
                    if places.contains(.unplanned) {
                        ChipButton("بدون خطة", selected: placeFilter == .unplanned) { placeFilter = .unplanned }
                    }
                }
                .padding(.top, 8)
            }
            if groups.isEmpty {
                EmptyState(icon: "magnifyingglass", title: "ما لقيت شي", message: "جرّب اسم البراند أو القطعة أو العميل.")
            } else {
                GHSection("المحلات · \(groups.count)") {
                    ForEach(groups) { g in
                        storeRow(g, key)
                    }
                }
            }
        }
    }

    private func storeRow(_ g: SMGroup, _ key: String) -> some View {
        let open = g.entries.filter { smState($0) == .open }
        var parts: [String] = []
        let placeLabels = Array(Set(g.entries.compactMap { $0.item.planPlace?.label })).sorted()
        if !placeLabels.isEmpty { parts.append(placeLabels.joined(separator: "، ")) }
        if g.isStore {
            let brands = Array(Set(g.entries.compactMap { smClean($0.item.brand) })).sorted()
            if !brands.isEmpty { parts.append(brands.prefix(3).joined(separator: "، ")) }
        }
        var est: [String: Double] = [:]
        for e in open { if let x = e.item.estimate { est[x.currency, default: 0] += x.amount } }
        if !est.isEmpty { parts.append("≈ " + est.keys.sorted().map { money(est[$0] ?? 0, $0) }.joined(separator: " + ")) }
        if open.isEmpty { parts.append("خلصت") }
        let id = g.id
        let label = g.label
        return Tile(label, subtitle: parts.isEmpty ? nil : parts.joined(separator: " · "),
                    value: open.isEmpty ? "تم" : "\(open.count)",
                    valueColor: open.isEmpty ? GH.green : GH.burgundy,
                    valueFont: .gh(18, .bold),
                    action: { pushPage(SMStorePage(groupId: id, tripKey: key, title: label)) },
                    leading: { IconBox(g.isStore ? "bag.fill" : "tag.fill", color: open.isEmpty ? GH.green : GH.burgundy) })
    }

    private func chooseTrip(_ current: String) async {
        if let id = await pickTrip(current: current) { chosenTrip = id }
    }

    private func refreshAll() async {
        await ShoppingQueue.shared.flush()
        await Store.shared.refresh()
    }
}

// MARK: - Totals card

fileprivate struct SMTotalsView: View {
    let today: SMToday

    var body: some View {
        let others = today.byCurrency.keys.filter { $0 != "EUR" }.sorted()
        VStack(spacing: 10) {
            HStack(spacing: 10) {
                StatCard(label: "اشتريت اليوم", value: "\(today.count)", icon: "bag.fill", hero: true)
                StatCard(label: "باقي تشتريه", value: "\(today.left)", icon: "list.bullet", color: GH.amber)
            }
            VStack(spacing: 0) {
                KV("اليوم باليورو", money(today.byCurrency["EUR"] ?? 0, "EUR"))
                ForEach(others, id: \.self) { c in
                    KV("اليوم بـ \(c)", money(today.byCurrency[c] ?? 0, c))
                }
                KV("اليوم بالريال", omr(today.omr), strong: true)
            }
            .padding(.vertical, 4)
            .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(GH.card))
        }
        .padding(.horizontal, 16).padding(.top, 14)
    }
}

// MARK: - Search field

fileprivate struct SMSearchField: View {
    @Binding var text: String

    var body: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass").font(.system(size: 16)).foregroundStyle(GH.tertiary)
            TextField("", text: $text, prompt: Text("ابحث: براند، قطعة، عميل").foregroundStyle(GH.tertiary))
                .font(.gh(16)).foregroundStyle(GH.label)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
            if !text.isEmpty {
                Button { text = "" } label: {
                    Image(systemName: "xmark.circle.fill").font(.system(size: 16)).foregroundStyle(GH.tertiary)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 12).frame(height: 44)
        .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(GH.card))
        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).stroke(GH.border, lineWidth: 1))
    }
}

// MARK: - Waiting-upload banner

@MainActor
fileprivate struct SMQueueBanner: View {
    @ObservedObject private var queue = ShoppingQueue.shared

    var body: some View {
        let waiting = queue.pending.filter { !$0.blocked }
        let blocked = queue.pending.filter { $0.blocked }
        if !waiting.isEmpty || !blocked.isEmpty {
            VStack(alignment: .leading, spacing: 10) {
                if !waiting.isEmpty {
                    HStack(spacing: 10) {
                        Image(systemName: "icloud.and.arrow.up").font(.system(size: 18)).foregroundStyle(GH.amber)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("\(smPieces(waiting.count, arabic: true)) بانتظار الرفع")
                                .font(.gh(15, .semibold)).foregroundStyle(GH.label)
                            Text("محفوظة على الجهاز وما بتضيع").font(TS.small).foregroundStyle(GH.secondary)
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        if queue.uploading {
                            ProgressView()
                        } else {
                            Button { Task { await queue.flush() } } label: {
                                Text("ارفع الحين").font(.gh(14, .semibold)).foregroundStyle(.white)
                                    .padding(.horizontal, 14).padding(.vertical, 8)
                                    .background(Capsule().fill(GH.burgundy))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
                ForEach(blocked) { p in
                    Button { Task { await blockedMenu(p) } } label: {
                        HStack(alignment: .top, spacing: 10) {
                            Image(systemName: "exclamationmark.triangle.fill").font(.system(size: 16)).foregroundStyle(GH.red)
                            Text("\(p.title): \(p.lastError ?? "ما انرفعت")")
                                .font(TS.sub).foregroundStyle(GH.label)
                                .multilineTextAlignment(.leading)
                                .frame(maxWidth: .infinity, alignment: .leading)
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(14)
            .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(GH.amber.opacity(0.12)))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(GH.amber.opacity(0.35), lineWidth: 1))
            .padding(.horizontal, 16).padding(.top, 12)
        }
    }

    private func blockedMenu(_ p: ShoppingPendingPurchase) async {
        let a: String? = await pickAction(title: p.title, message: p.lastError, actions: [
            SheetAction("حاول مرة ثانية", "retry"),
            SheetAction("احذفها (ما بتنسجل)", "remove", destructive: true),
        ])
        if a == "retry" {
            await ShoppingQueue.shared.retry(p.id)
        } else if a == "remove" {
            if await confirm("نحذف الشراء؟", message: "\(p.title) بترجع بانتظار الشراء.") {
                ShoppingQueue.shared.remove(p.id)
            }
        }
    }
}

// MARK: - One store

fileprivate struct SMBuyRequest: Identifiable {
    let id = UUID()
    let entries: [ShoppingEntry]
}

@MainActor
fileprivate struct SMStorePage: View {
    let groupId: String
    let tripKey: String
    let title: String
    @ObservedObject private var store = Store.shared
    @ObservedObject private var queue = ShoppingQueue.shared
    @State private var selecting = false
    @State private var selected: Set<String> = []
    @State private var buying: SMBuyRequest? = nil

    private var entries: [ShoppingEntry] {
        let list = smGroups(smEntries(smOrders(tripKey))).first { $0.id == groupId }?.entries ?? []
        func rank(_ s: SMPieceState) -> Int {
            switch s {
            case .open: return 0
            case .failed: return 1
            case .pending: return 2
            case .done: return 3
            }
        }
        return list.enumerated().sorted { a, b in
            let ra = rank(smState(a.element)), rb = rank(smState(b.element))
            return ra != rb ? ra < rb : a.offset < b.offset
        }.map(\.element)
    }

    var body: some View {
        let list = entries
        let open = list.filter { smState($0) == .open }
        Group {
            if open.count > 1 {
                GHPage(title, largeTitle: false, trailing: {
                    NavButton(selecting ? "إلغاء" : "تحديد") { selecting.toggle(); selected = [] }
                }, bottom: {
                    bottomBar(open)
                }) {
                    content(list)
                }
            } else {
                GHPage(title, largeTitle: false) {
                    content(list)
                }
            }
        }
        .sheet(item: $buying) { r in
            SMBuySheet(entries: r.entries, onSaved: { selecting = false; selected = [] })
                .environment(\.layoutDirection, .rightToLeft)
        }
    }

    @ViewBuilder
    private func bottomBar(_ open: [ShoppingEntry]) -> some View {
        if selecting {
            PrimaryButton(selected.isEmpty ? "اختر القطع اللي في الفاتورة" : "اشتريت هذول كلهم بفاتورة وحدة (\(selected.count))",
                          icon: "doc.text.fill",
                          action: smEnabled(!selected.isEmpty) { buySelected(open) })
        } else {
            SecondaryButton("اشتريت أكثر من قطعة بفاتورة وحدة", icon: "checklist") {
                selected = []
                selecting = true
            }
        }
    }

    @ViewBuilder
    private func content(_ list: [ShoppingEntry]) -> some View {
        SMQueueBanner()
        // دليل البوتيكات: this store's associate, hours and tax-free (or add it)
        if !groupId.hasPrefix("n:") {
            BoutiqueLinkRow(storeName: title,
                            brand: groupId.hasPrefix("b:") ? title : list.compactMap { smClean($0.item.brand) }.first)
        }
        if list.isEmpty {
            EmptyState(icon: "checkmark.seal", title: "خلصت هذا المحل", message: "ما في قطع باقية هنا.")
        } else {
            let left = list.filter { smState($0) == .open }.count
            Pad(h: 22, top: 8) {
                Text(left == 0 ? "اشتريت كل قطع هذا المحل" : "باقي \(smPieces(left))")
                    .font(TS.sub).foregroundStyle(GH.secondary)
            }
            if selecting {
                Pad(h: 22, top: 4) {
                    Text("اضغط على القطع اللي اشتريتها بنفس الفاتورة").font(TS.small).foregroundStyle(GH.burgundy)
                }
            }
            ForEach(list) { e in
                SMPieceCard(entry: e, state: smState(e), note: note(e), selecting: selecting,
                            selected: selected.contains(e.id),
                            onBuy: { buying = SMBuyRequest(entries: [e]) },
                            onToggle: { toggle(e.id) })
            }
        }
    }

    private func note(_ e: ShoppingEntry) -> String? {
        if let p = queue.entry(e.id) ?? queue.recorded[e.id] { return money(p.price, p.currency) }
        if let a = e.item.costAmount { return money(a, e.item.costCurrency ?? "EUR") }
        return nil
    }

    private func toggle(_ id: String) {
        Haptic.select()
        if selected.contains(id) { selected.remove(id) } else { selected.insert(id) }
    }

    private func buySelected(_ open: [ShoppingEntry]) {
        let list = open.filter { selected.contains($0.id) }
        if list.isEmpty { return }
        buying = SMBuyRequest(entries: list)
    }
}

// MARK: - Piece card

@MainActor
fileprivate struct SMPieceCard: View {
    let entry: ShoppingEntry
    let state: SMPieceState
    let note: String?
    let selecting: Bool
    let selected: Bool
    let onBuy: () -> Void
    let onToggle: () -> Void

    private var customerLine: String {
        let first = Store.shared.customer(entry.order.customerId)?.firstName ?? ""
        var s = first.isEmpty ? "—" : first
        if let client = smClean(entry.order.clientName) { s += " · لعميلتها \(client)" }
        return s
    }

    var body: some View {
        let i = entry.item
        let canPick = selecting && state == .open
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .top, spacing: 14) {
                if let p = i.photoPath {
                    Button { pushPage(PhotoPage(path: p, title: i.title)) } label: {
                        RemoteImage(path: p)
                            .frame(width: 96, height: 96)
                            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                    }
                    .buttonStyle(.plain)
                }
                VStack(alignment: .leading, spacing: 4) {
                    if let b = smClean(i.brand) {
                        Text(b.uppercased()).font(.gh(13, .semibold)).tracking(0.6).foregroundStyle(GH.gold)
                    }
                    Text(i.name).font(.gh(21, .bold)).foregroundStyle(GH.label)
                        .fixedSize(horizontal: false, vertical: true)
                    if let d = smClean(i.details) {
                        Text(d).font(.gh(17, .medium)).foregroundStyle(GH.label)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    HStack(spacing: 6) {
                        Image(systemName: "person.fill").font(.system(size: 12))
                        Text(customerLine).font(.gh(15))
                    }
                    .foregroundStyle(GH.secondary)
                    .padding(.top, 2)
                    if state == .open, let e = i.estimate {
                        Text("\(e.fromList ? "سعر البوتيك" : "خطتك") ≈ \(money(e.amount, e.currency))")
                            .font(.gh(15, .medium)).foregroundStyle(GH.blue)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if canPick {
                    Image(systemName: selected ? "checkmark.circle.fill" : "circle")
                        .font(.system(size: 28)).foregroundStyle(selected ? GH.burgundy : GH.tertiary)
                }
            }
            stateRow(canPick: canPick)
        }
        .padding(16)
        .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(GH.card))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous)
            .stroke(selected && canPick ? GH.burgundy : Color.clear, lineWidth: 2))
        .ghShadow()
        .opacity(state == .done ? 0.7 : 1)
        .contentShape(Rectangle())
        .onTapGesture { if canPick { onToggle() } }
        .padding(.horizontal, 16).padding(.top, 14)
    }

    @ViewBuilder
    private func stateRow(canPick: Bool) -> some View {
        switch state {
        case .open:
            if !selecting { PrimaryButton("اشتريتها", icon: "bag.fill", action: onBuy) }
        case .pending:
            HStack {
                Badge("انحفظت، بانتظار الرفع", color: GH.amber)
                Spacer()
                if let note { Text(note).font(TS.money).foregroundStyle(GH.label) }
            }
        case .failed:
            Badge("ما انرفعت، شوف فوق", color: GH.red)
        case .done:
            HStack {
                Badge("اشتريتها", color: GH.green)
                Spacer()
                if let note { Text(note).font(TS.money).foregroundStyle(GH.label) }
            }
        }
    }
}

// MARK: - «اشتريتها» sheet

@MainActor
fileprivate struct SMBuySheet: View {
    let entries: [ShoppingEntry]
    let onSaved: () -> Void
    @Environment(\.dismiss) private var dismiss
    @StateObject private var picker = OrderPhotoPicker()
    @State private var place: PurchasePlace
    @State private var currency: String
    @State private var rateText: String
    @State private var taxFreeText: String
    @State private var prices: [String: String]
    @State private var receipt: UIImage? = nil
    @State private var photo: UIImage? = nil

    init(entries: [ShoppingEntry], onSaved: @escaping () -> Void) {
        self.entries = entries
        self.onSaved = onSaved
        let planned = Set(entries.compactMap { $0.item.planPlace })
        let p = planned.count == 1 ? planned.first! : SMPrefs.lastPlace
        let cur = SMPrefs.currency(for: p)
        var pr: [String: String] = [:]
        for e in entries {
            if let g = smGuess(e.item, cur) { pr[e.id] = amountText(g) }
        }
        _place = State(initialValue: p)
        _currency = State(initialValue: cur)
        _rateText = State(initialValue: Rates.shared.rateText(cur))
        _taxFreeText = State(initialValue: amountText(SMPrefs.taxFree(for: p)))
        _prices = State(initialValue: pr)
    }

    private var single: Bool { entries.count == 1 }
    private var rate: Double { parseAmount(rateText) ?? 0 }
    private var taxFree: Double { min(max(parseAmount(taxFreeText) ?? 0, 0), 100) }
    private func price(_ id: String) -> Double { parseAmount(prices[id] ?? "") ?? 0 }
    private var total: Double { entries.reduce(0) { $0 + price($1.id) } }

    var body: some View {
        NavigationStack {
            GHPage(single ? "اشتريتها" : "بفاتورة وحدة", largeTitle: false, leading: {
                NavButton("إلغاء") { dismiss() }
            }, bottom: {
                PrimaryButton("حفظ الشراء", icon: "checkmark") { save() }
            }) {
                headerText
                pricesSection
                placeSection
                photosSection
                summarySection
            }
        }
        .orderPhotoPicker(picker)
        .presentationDetents([.fraction(0.85), .large])
        .presentationDragIndicator(.visible)
    }

    @ViewBuilder private var headerText: some View {
        if single, let e = entries.first {
            let first = Store.shared.customer(e.order.customerId)?.firstName ?? ""
            Pad(h: 22, top: 6) {
                Text(first.isEmpty ? e.item.title : "\(e.item.title) · \(first)")
                    .font(TS.sub).foregroundStyle(GH.secondary)
            }
        } else {
            Pad(h: 22, top: 6) {
                Text("\(smPieces(entries.count)) بفاتورة وحدة، وصورة الفاتورة تنحفظ مع كل وحدة")
                    .font(TS.sub).foregroundStyle(GH.secondary)
            }
        }
    }

    private func priceBinding(_ id: String) -> Binding<String> {
        Binding(get: { prices[id] ?? "" }, set: { prices[id] = $0 })
    }

    private func shortLabel(_ e: ShoppingEntry) -> String {
        let s = smClean(e.item.name) ?? smClean(e.item.brand) ?? "القطعة"
        return s.count > 14 ? String(s.prefix(13)) + "…" : s
    }

    private var pricesSection: some View {
        GHSection(single ? "بكم؟" : "سعر كل قطعة",
                  footer: Rates.shared.isLive ? "سعر الصرف من السوق اليوم، وتقدر تعدّله." : "سعر صرف تقريبي، عدّله إذا تبي.") {
            ForEach(entries) { e in
                AmountRow(single ? "السعر" : shortLabel(e), text: priceBinding(e.id), suffix: currency,
                          autofocus: e.id == entries.first?.id)
            }
            PickerRow("العملة", value: currency) { Task { await pickCurrency() } }
            AmountRow("سعر الصرف", text: $rateText, suffix: "ر.ع / \(currency)")
        }
    }

    private var placeBinding: Binding<PurchasePlace> {
        Binding(get: { place }, set: { choosePlace($0) })
    }

    private var placeSection: some View {
        GHSection("وين؟") {
            Segments(value: placeBinding, options: PurchasePlace.allCases.map { ($0, $0.label) })
            AmountRow("تاكس فري", text: $taxFreeText, suffix: "٪")
        }
    }

    private var photosSection: some View {
        GHSection("الصور", footer: single ? "اختياري. الصور تنحفظ على الجهاز لين ترتفع." : "صورة الفاتورة وحدة تنحفظ مع كل القطع المختارة.") {
            photoTile(isReceipt: true)
            if single { photoTile(isReceipt: false) }
        }
    }

    private func photoTile(isReceipt: Bool) -> some View {
        let img = isReceipt ? receipt : photo
        return Tile(isReceipt ? (img == nil ? "صوّر الفاتورة" : "صورة الفاتورة") : (img == nil ? "صوّر القطعة" : "صورة القطعة"),
                    chevron: false,
                    action: { Task { await takePhoto(isReceipt: isReceipt) } },
                    leading: { IconBox(isReceipt ? "doc.text.viewfinder" : "camera.fill", color: GH.burgundy) },
                    trailing: {
                        if let img {
                            Image(uiImage: img).resizable().scaledToFill()
                                .frame(width: 44, height: 44)
                                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                        }
                    })
    }

    private var summarySection: some View {
        let t = total
        return GHSection {
            KV(single ? "السعر" : "مجموع الفاتورة", money(t, currency))
            KV("بالريال", omr(t * rate), strong: true)
            KV(taxFree > 0 ? "تاكس فري يرجع (\(amountText(taxFree))٪)" : "تاكس فري",
               taxFree > 0 ? money(t * taxFree / 100, currency) : "ما في",
               color: taxFree > 0 ? GH.green : GH.secondary)
            if single, let e = entries.first, t > 0, rate > 0 {
                KV("سعر البيع للعميل", omr(e.item.price), color: GH.secondary)
                KV("ربحك التقديري", omr(e.item.price - t * rate), color: GH.burgundy)
            }
        }
    }

    // MARK: actions

    private func choosePlace(_ p: PurchasePlace) {
        place = p
        let c = SMPrefs.currency(for: p)
        if c != currency { setCurrency(c) }
        taxFreeText = amountText(SMPrefs.taxFree(for: p))
    }

    private func setCurrency(_ c: String) {
        currency = c
        rateText = Rates.shared.rateText(c)
        for e in entries where (prices[e.id] ?? "").isEmpty {
            if let g = smGuess(e.item, c) { prices[e.id] = amountText(g) }
        }
    }

    private func pickCurrency() async {
        let actions: [SheetAction<String>] = rateCurrencies.map { SheetAction($0, $0) }
        if let c = await pickAction(title: "العملة", actions: actions) { setCurrency(c) }
    }

    private func takePhoto(isReceipt: Bool) async {
        var acts: [SheetAction<Int>] = [SheetAction("الكاميرا", 1), SheetAction("من الصور", 2)]
        if (isReceipt ? receipt : photo) != nil { acts.append(SheetAction("شيل الصورة", 0, destructive: true)) }
        guard let a = await pickAction(title: isReceipt ? "صورة الفاتورة" : "صورة القطعة", actions: acts) else { return }
        if a == 0 {
            if isReceipt { receipt = nil } else { photo = nil }
            return
        }
        guard let img = await picker.pick(camera: a == 1) else { return }
        if isReceipt { receipt = img } else { photo = img }
    }

    private func save() {
        let r = rate
        if r <= 0 {
            toast("سعر الصرف غير صحيح", error: true)
            return
        }
        let tf = taxFree
        var list: [ShoppingPendingPurchase] = []
        for e in entries {
            let v = price(e.id)
            if v <= 0 {
                toast(single ? "اكتب السعر" : "اكتب سعر كل قطعة", error: true)
                return
            }
            list.append(ShoppingPendingPurchase(id: e.id, orderId: e.order.id, title: e.item.title, place: place,
                                                price: v, currency: currency, rate: r, taxFreePct: tf))
        }
        let receiptData = receipt.flatMap { OrderPhotoPicker.jpeg($0, maxSide: 1800, quality: 0.85) }
        let photoData = single ? photo.flatMap { OrderPhotoPicker.jpeg($0, maxSide: 1600, quality: 0.82) } : nil
        SMPrefs.lastPlace = place
        SMPrefs.setCurrency(currency, for: place)
        SMPrefs.setTaxFree(tf, for: place)
        // on the phone first: never lost, even with no signal
        ShoppingQueue.shared.add(list, receipt: receiptData, photo: photoData)
        Haptic.success()
        let ids = list.map(\.id)
        onSaved()
        dismiss()
        Task { @MainActor in
            let q = ShoppingQueue.shared
            await q.flush()
            let left = ids.compactMap { q.entry($0) }
            if left.isEmpty {
                toast(ids.count > 1 ? "انسجل الشراء (\(smPieces(ids.count)))" : "انسجل الشراء")
            } else if let bad = left.first(where: { $0.blocked }) {
                toast("ما انسجل: \(bad.lastError ?? "")", error: true)
            } else {
                toast("انحفظ على الجهاز، بنرفعه أول ما يرجع النت", icon: "icloud.slash")
            }
        }
    }
}
