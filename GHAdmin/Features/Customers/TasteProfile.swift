import SwiftUI

// ───────────────────────── ذوق العميلة: data ─────────────────────────

/// What a customer likes: her sizes (clothes / shoes / rings / any other), brands, colours,
/// budget and notes. Saved on the server as users.style_profile (JSON "style").
struct CustomerStyle: Hashable {
    var sizes: [String: String] = [:]
    var brands: [String] = []
    var colors: [String] = []
    var budget: String?
    var notes: String?

    /// The size fields the form always shows (other keys are free).
    static let sizeKeys: [(key: String, label: String)] = [("clothes", "ملابس"), ("shoes", "أحذية"), ("rings", "خواتم")]

    static func sizeLabel(_ key: String) -> String {
        sizeKeys.first { $0.key == key }?.label ?? key
    }

    init() {}

    /// nil when the server sent no profile.
    init?(_ raw: Any?) {
        guard let m = raw as? JSON else { return nil }
        var s: [String: String] = [:]
        if let sz = m["sizes"] as? JSON {
            for (k, v) in sz {
                let t = jstr(v).trimmingCharacters(in: .whitespacesAndNewlines)
                if !t.isEmpty { s[k] = t }
            }
        }
        sizes = s
        brands = ((m["brands"] as? [Any]) ?? []).map { jstr($0) }.filter { !$0.isEmpty }
        colors = ((m["colors"] as? [Any]) ?? []).map { jstr($0) }.filter { !$0.isEmpty }
        budget = js(m["budget"])
        notes = js(m["notes"])
    }

    var isEmpty: Bool {
        sizes.isEmpty && brands.isEmpty && colors.isEmpty
            && (budget ?? "").trimmingCharacters(in: .whitespaces).isEmpty
            && (notes ?? "").trimmingCharacters(in: .whitespaces).isEmpty
    }

    /// The fixed sizes first (ملابس، أحذية، خواتم), then the others by name.
    var orderedSizes: [TasteSize] {
        let fixed = CustomerStyle.sizeKeys.compactMap { k in sizes[k.key].map { TasteSize(key: k.key, value: $0) } }
        let fixedKeys = Set(CustomerStyle.sizeKeys.map { $0.key })
        let other = sizes.filter { !fixedKeys.contains($0.key) }.sorted { $0.key < $1.key }.map { TasteSize(key: $0.key, value: $0.value) }
        return fixed + other
    }

    var json: JSON {
        ["sizes": sizes, "brands": brands, "colors": colors, "budget": nn(budget), "notes": nn(notes)]
    }
}

/// One saved size ("shoes" = "38").
struct TasteSize: Hashable, Identifiable {
    let key: String
    let value: String
    var id: String { key }
}

/// A store piece that suits a customer's taste (GET /ps/style-matches).
struct StyleMatch: Identifiable, Hashable {
    var id: String { "\(customerId)-\(productId)" }
    let customerId: String
    let name: String
    let productId: Int
    let brand: String
    let productName: String
    let price: Double
    /// In stock in Oman now (else made to order).
    let instant: Bool
    let imageUrl: String?
    let productUrl: String?
    /// Her size when the piece comes in it.
    let size: String?

    init(_ m: JSON) {
        customerId = jstr(m["customer_id"])
        name = jstr(m["name"])
        productId = ji(m["product_id"])
        brand = jstr(m["brand"])
        productName = jstr(m["product_name"])
        price = jd(m["price"])
        instant = js(m["availability"]) == "instant"
        imageUrl = js(m["image_url"])
        productUrl = js(m["product_url"])
        size = js(m["size"])
    }

    var availabilityLabel: String { instant ? "متوفرة في عُمان" : "بالطلب" }
}

// ───────────────────────── message ─────────────────────────

/// A short WhatsApp message about the piece, in her language and gender.
func styleMatchMessage(_ m: StyleMatch, _ c: Customer?) -> String {
    let first = c?.firstName ?? ""
    let male = c?.isMale ?? false
    if c?.isEnglish ?? false {
        var t = first.isEmpty ? "Hello 🤍\n" : "Hello \(first) 🤍\n"
        t += "We have a \(m.brand) piece we think you'll love:\n\(m.productName)\n"
        t += "Price: \(omrLatin(m.price))\n"
        t += m.instant ? "Available now in Oman" : "Available to order"
        if let s = m.size { t += " (your size \(s))" }
        if let u = m.productUrl { t += "\n\(u)" }
        t += "\n\nShall we reserve it for you?"
        return t
    }
    var t = first.isEmpty ? "هلا 🤍\n" : "هلا \(first) 🤍\n"
    t += "عندنا قطعة من \(m.brand) حسّينا إنها على \(male ? "ذوقك" : "ذوقكِ"):\n\(m.productName)\n"
    t += "السعر: \(omr(m.price))\n"
    t += m.instant ? "متوفرة الحين في عُمان" : "متوفرة بالطلب"
    if let s = m.size { t += " (\(male ? "مقاسك" : "مقاسكِ") \(s))" }
    if let u = m.productUrl { t += "\n\(u)" }
    t += male ? "\n\nتبغى نحجزها لك؟" : "\n\nتبغين نحجزها لكِ؟"
    return t
}

/// Opens WhatsApp to her with the message ready (it can be edited before sending).
@MainActor
func sendStyleMatch(_ m: StyleMatch, to c: Customer?) {
    guard let c, waPhone(c.phone) != nil else {
        toast("ما عندها رقم جوال", error: true)
        return
    }
    // openWhatsApp keeps "&" unescaped, which would cut the text: write it out
    let text = styleMatchMessage(m, c).replacingOccurrences(of: "&", with: "and")
    openWhatsApp(phone: c.phone, text: text)
}

// ───────────────────────── small views ─────────────────────────

/// Chips that wrap onto the next line.
struct TasteFlow: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxW = proposal.width ?? .infinity
        var x: CGFloat = 0, y: CGFloat = 0, rowH: CGFloat = 0, widest: CGFloat = 0
        for v in subviews {
            let s = fit(v, maxW)
            if x > 0 && x + s.width > maxW {
                y += rowH + spacing
                x = 0
                rowH = 0
            }
            x += s.width + spacing
            rowH = max(rowH, s.height)
            widest = max(widest, x - spacing)
        }
        return CGSize(width: proposal.width ?? widest, height: y + rowH)
    }

    /// Its natural size, but never wider than the row.
    private func fit(_ v: LayoutSubview, _ maxW: CGFloat) -> CGSize {
        let s = v.sizeThatFits(.unspecified)
        guard maxW.isFinite, s.width > maxW else { return s }
        return v.sizeThatFits(ProposedViewSize(width: maxW, height: nil))
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX, y = bounds.minY, rowH: CGFloat = 0
        for v in subviews {
            let s = fit(v, bounds.width)
            if x > bounds.minX && x + s.width > bounds.maxX {
                y += rowH + spacing
                x = bounds.minX
                rowH = 0
            }
            v.place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(s))
            x += s.width + spacing
            rowH = max(rowH, s.height)
        }
    }
}

/// One taste chip; with onRemove it gets a small x.
struct TasteChip: View {
    let label: String
    var color: Color = GH.burgundy
    var onRemove: (() -> Void)?

    init(_ label: String, color: Color = GH.burgundy, onRemove: (() -> Void)? = nil) {
        self.label = label; self.color = color; self.onRemove = onRemove
    }

    var body: some View {
        HStack(spacing: 6) {
            Text(label).font(.gh(14, .medium)).foregroundStyle(GH.label).lineLimit(1)
            if let onRemove {
                Button {
                    Haptic.select()
                    onRemove()
                } label: {
                    Image(systemName: "xmark.circle.fill").font(.system(size: 15)).foregroundStyle(GH.tertiary)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 12).padding(.vertical, 7)
        .background(Capsule().fill(color.opacity(0.10)))
        .overlay(Capsule().stroke(color.opacity(0.25), lineWidth: 1))
    }
}

/// One matching piece: photo, name, brand · price · availability, and «أرسل لها».
struct StyleMatchRow: View {
    let match: StyleMatch
    var showCustomer = false

    var body: some View {
        let m = match
        let c = Store.shared.customer(m.customerId)
        var parts = [m.brand, omr(m.price), m.availabilityLabel]
        if let s = m.size { parts.append("مقاس \(s)") }
        if showCustomer { parts.insert(m.name, at: 0) }
        var open: (() -> Void)? = nil
        if let u = m.productUrl { open = { openURL(u) } }
        return Tile(m.productName, subtitle: parts.filter { !$0.isEmpty }.joined(separator: " · "), chevron: false,
                    action: open,
                    leading: {
                        RemoteImage(url: m.imageUrl, contentMode: .fit)
                            .frame(width: 48, height: 48)
                            .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                    },
                    trailing: {
                        Button {
                            Haptic.select()
                            sendStyleMatch(m, to: c)
                        } label: {
                            Text((c?.isMale ?? false) ? "أرسل له" : "أرسل لها")
                                .font(.gh(14, .medium)).foregroundStyle(Color.white)
                                .padding(.horizontal, 12).padding(.vertical, 7)
                                .background(Capsule().fill(Color(hex: 0xFF25D366)))
                        }
                        .buttonStyle(.plain)
                    })
    }
}

// ───────────────────────── on the customer page ─────────────────────────

/// «ذوقها» on the customer page (brands, sizes, colours, budget) and «قطع تناسبها» under it.
struct CustomerTasteSection: View {
    let customer: Customer
    @State private var matches: [StyleMatch]?
    @State private var failed = false

    init(customer: Customer) { self.customer = customer }

    private var she: Bool { !customer.isMale }

    var body: some View {
        let style = customer.style
        Group {
            GHSection(she ? "ذوقها" : "ذوقه",
                      footer: style == nil ? "البراندات \(she ? "اللي تحبها" : "اللي يحبها")، المقاسات، الألوان والميزانية: نطلع \(she ? "لها" : "له") القطع اللي تناسب." : nil,
                      trailing: {
                          HeaderButton(style == nil ? "أضف" : "تعديل", icon: "square.and.pencil") { edit() }
                      }) {
                if let style, !style.isEmpty {
                    details(style)
                } else {
                    Tile("ما في ذوق محفوظ", subtitle: "مثلاً: Chanel، Dior · مقاس M · حذاء 38",
                         titleColor: GH.secondary, action: { edit() },
                         leading: { IconBox("sparkles", color: GH.gold) })
                }
            }
            if let style, !style.brands.isEmpty {
                matchesSection
            }
        }
        .task(id: style) { await load() }
    }

    @ViewBuilder
    private func details(_ s: CustomerStyle) -> some View {
        if !s.brands.isEmpty {
            row("البراندات") { ForEach(s.brands, id: \.self) { TasteChip($0) } }
        }
        if !s.sizes.isEmpty {
            row("المقاسات") {
                ForEach(s.orderedSizes) { e in
                    TasteChip("\(CustomerStyle.sizeLabel(e.key)): \(e.value)", color: GH.blue)
                }
            }
        }
        if !s.colors.isEmpty {
            row("الألوان") { ForEach(s.colors, id: \.self) { TasteChip($0, color: GH.gold) } }
        }
        if let b = s.budget {
            Tile("الميزانية", value: b, chevron: false)
        }
        if let n = s.notes {
            Text(n).font(TS.body).foregroundStyle(GH.label)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(16)
        }
    }

    private func row<C: View>(_ title: String, @ViewBuilder _ chips: () -> C) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(TS.sub).foregroundStyle(GH.secondary)
            TasteFlow(spacing: 8).callAsFunction { chips() }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 16).padding(.vertical, 12)
    }

    private var matchesSection: some View {
        GHSection(she ? "قطع تناسبها" : "قطع تناسبه",
                  footer: "من منتجات المتجر: المتوفر في عُمان أول، وبعده الجديد.",
                  trailing: {
                      HeaderButton("الكل") { pushPage(StyleMatchesPage()) }
                  }) {
            if let matches {
                if matches.isEmpty {
                    Tile(failed ? "ما قدرنا نجيب القطع" : "ما لقينا قطع من براندات\(she ? "ها" : "ه") في المتجر الحين",
                         titleColor: GH.secondary, chevron: false, action: retry)
                } else {
                    ForEach(matches) { m in StyleMatchRow(match: m) }
                }
            } else {
                LoadingView()
            }
        }
    }

    private var retry: (() -> Void)? {
        guard failed else { return nil }
        return { Task { await load() } }
    }

    @MainActor
    private func load() async {
        guard let s = customer.style, !s.brands.isEmpty else { matches = nil; return }
        do {
            matches = try await Store.shared.styleMatches(customerId: customer.id)
            failed = false
        } catch {
            matches = []
            failed = true
        }
    }

    @MainActor
    private func edit() {
        presentForm(TasteProfilePage(customerId: customer.id))
    }
}

// ───────────────────────── every customer ─────────────────────────

/// «قطع تناسب عميلاتك»: the store pieces that suit each customer's saved taste,
/// grouped by customer (up to 3 each). Open from More.
struct StyleMatchesPage: View {
    @State private var matches: [StyleMatch]?
    @State private var failed = false

    init() {}

    private struct MatchGroup: Identifiable {
        let id: String
        let name: String
        let items: [StyleMatch]
    }

    private var groups: [MatchGroup] {
        var order: [String] = []
        var map: [String: [StyleMatch]] = [:]
        for m in matches ?? [] {
            if map[m.customerId] == nil { order.append(m.customerId) }
            map[m.customerId, default: []].append(m)
        }
        return order.map { id in MatchGroup(id: id, name: map[id]?.first?.name ?? "", items: map[id] ?? []) }
    }

    var body: some View {
        GHPage("قطع تناسب عميلاتك", onRefresh: { await load() }) {
            if let matches {
                if matches.isEmpty {
                    EmptyState(icon: "sparkles",
                               title: failed ? "ما قدرنا نجيب القطع" : "ما في قطع تناسب للحين",
                               message: failed ? "اسحب للتحديث" : "احفظ ذوق العميلة (البراندات والمقاسات) من صفحتها، ونطلع لك القطع اللي تناسبها من المتجر.")
                } else {
                    ForEach(groups) { g in
                        GHSection(g.name, trailing: {
                            HeaderButton("صفحتها") { pushPage(CustomerDetailPage(customerId: g.id)) }
                        }) {
                            ForEach(g.items) { m in StyleMatchRow(match: m) }
                        }
                    }
                }
            } else {
                LoadingView()
            }
        }
        .task { if matches == nil { await load() } }
    }

    @MainActor
    private func load() async {
        do {
            matches = try await Store.shared.styleMatches()
            failed = false
        } catch {
            if matches == nil { matches = [] }
            failed = true
            toastError(error)
        }
    }
}
