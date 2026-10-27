import SwiftUI
import Charts
import UIKit

// Growth tools for the store (like Shopify's Analytics / Marketing):
//   InsightsPage        GET /admin/insights?from=&to=
//   AbandonedCartsPage  GET /admin/abandoned-carts?hours=, POST …/{id}/remind, …/{id}/whatsapp,
//                       POST /admin/abandoned-carts/remind-all, DELETE /admin/abandoned-carts/{id}
//   NotifyPage          GET /admin/notifications/audience?segment=, POST /admin/notifications/broadcast,
//                       GET /admin/notifications/sent, POST /admin/notifications/delete-multiple

// MARK: - Shared helpers

/// Query-string encoding that leaves only plain ASCII letters/digits unescaped.
fileprivate func gwEncode(_ s: String) -> String {
    let allowed = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~")
    return s.addingPercentEncoding(withAllowedCharacters: allowed) ?? ""
}

/// Rows from a response that is either a list or {data: [...]}.
fileprivate func gwRows(_ res: Any?) -> [JSON] {
    if let m = res as? JSON { return jlist(m["data"]) }
    return jlist(res)
}

fileprivate func gwTrim(_ s: String) -> String { s.trimmingCharacters(in: .whitespacesAndNewlines) }

/// «قبل 3 ساعة»
fileprivate func gwAgo(_ d: Date?) -> String {
    guard let d else { return "—" }
    let m = max(1, Int(Date().timeIntervalSince(d) / 60))
    if m < 60 { return "قبل \(m) دقيقة" }
    let h = Int((Double(m) / 60).rounded())
    if h < 48 { return "قبل \(h) ساعة" }
    return "قبل \(Int((Double(h) / 24).rounded())) يوم"
}

fileprivate let gwCal: Calendar = {
    var c = Calendar(identifier: .gregorian)
    c.timeZone = TimeZone.current
    return c
}()

/// Brand colours for charts (readable on cream and on the dark background).
fileprivate let gwPalette: [Color] = [
    GH.burgundy, GH.gold, GH.rose, Color(hex: 0xFF8C5A3C), Color(hex: 0xFF6F7556),
    Color(hex: 0xFF4F5B6B), Color(hex: 0xFF9B6B6B), Color(hex: 0xFF7D6A4F), Color(hex: 0xFFC9A66B), Color(hex: 0xFF5E7C7A),
]

/// Change against the previous period.
fileprivate struct GwDelta {
    let text: String
    let color: Color
    let up: Bool?
}

fileprivate func gwDelta(_ now: Double, _ prev: Double) -> GwDelta? {
    if prev == 0 {
        if now == 0 { return nil }
        return GwDelta(text: "جديد", color: GH.green, up: nil)
    }
    let pct = (now - prev) / abs(prev) * 100
    let txt = "\(Int(abs(pct).rounded()))%"
    return GwDelta(text: txt, color: pct >= 0 ? GH.green : GH.red, up: pct >= 0)
}

/// A number card (like StatCard) with an optional change pill and a note.
@MainActor
fileprivate struct GwKpiCard: View {
    let label: String
    let value: String
    let icon: String
    var color: Color = GH.burgundy
    var hero: Bool = false
    var delta: GwDelta? = nil
    var note: String? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: icon).font(.system(size: 13, weight: .medium))
                    .foregroundStyle(hero ? GH.goldLight : color)
                    .frame(width: 28, height: 28)
                    .background(RoundedRectangle(cornerRadius: 9).fill(hero ? Color.white.opacity(0.11) : color.opacity(0.09)))
                Text(label).font(.gh(13, .medium)).foregroundStyle(hero ? GH.goldLight : GH.secondary).lineLimit(1)
                Spacer(minLength: 0)
            }
            Text(value).font(.gh(21, .bold).monospacedDigit()).foregroundStyle(hero ? Color.white : GH.label)
                .lineLimit(1).minimumScaleFactor(0.5)
            footer
        }
        .padding(.horizontal, 14).padding(.vertical, 14)
        .frame(maxWidth: .infinity, minHeight: 112, alignment: .topLeading)
        .background {
            if hero {
                RoundedRectangle(cornerRadius: 20, style: .continuous).fill(GH.brandGradient)
            } else {
                RoundedRectangle(cornerRadius: 20, style: .continuous).fill(GH.card)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .shadow(color: hero ? GH.burgundyDeep.opacity(0.27) : GH.shadowColor, radius: hero ? 11 : 9, y: hero ? 10 : 6)
    }

    @ViewBuilder private var footer: some View {
        if delta != nil || note != nil {
            HStack(spacing: 6) {
                if let d = delta {
                    HStack(spacing: 2) {
                        if let up = d.up {
                            Image(systemName: up ? "arrow.up.right" : "arrow.down.right").font(.system(size: 10, weight: .bold))
                        }
                        Text(d.text).font(.gh(11.5, .semibold)).monospacedDigit()
                    }
                    .foregroundStyle(hero ? Color.white : d.color)
                    .padding(.horizontal, 7).padding(.vertical, 2)
                    .background(Capsule().fill(hero ? Color.white.opacity(0.16) : d.color.opacity(0.11)))
                }
                if let note {
                    Text(note).font(.gh(11)).foregroundStyle(hero ? GH.goldLight : GH.tertiary).lineLimit(2)
                }
            }
        }
    }
}

/// A white rounded card (not a section), for grids.
@MainActor
fileprivate struct GwCard<Content: View>: View {
    let content: () -> Content
    init(@ViewBuilder content: @escaping () -> Content) { self.content = content }
    var body: some View {
        VStack(alignment: .leading, spacing: 0) { content() }
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(GH.card)
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .ghShadow()
    }
}

/// One choice in a list picker.
fileprivate struct GwChoice: Identifiable, Hashable {
    let id: String
    let title: String
    var group: String = ""
}

/// A searchable list that gives back one choice (pushed with pushForResult).
@MainActor
fileprivate struct GwChoicePage: View {
    let title: String
    let choices: [GwChoice]
    let selected: String?
    let done: (GwChoice?) -> Void
    @State private var q = ""

    init(title: String, choices: [GwChoice], selected: String?, done: @escaping (GwChoice?) -> Void) {
        self.title = title
        self.choices = choices
        self.selected = selected
        self.done = done
    }

    private var filtered: [GwChoice] {
        let s = normalizeDigits(q).lowercased()
        if s.isEmpty { return choices }
        return choices.filter { $0.title.lowercased().contains(s) || $0.group.lowercased().contains(s) }
    }

    private var groups: [String] {
        var out: [String] = []
        for c in filtered where !out.contains(c.group) { out.append(c.group) }
        return out
    }

    var body: some View {
        GHPage(title, leading: {
            NavButton("إلغاء") { done(nil) }
        }) {
            if choices.count > 8 {
                ProductSearchField(placeholder: "ابحث", text: $q)
                    .padding(.horizontal, 16).padding(.top, 4)
            }
            if filtered.isEmpty {
                EmptyState(icon: "magnifyingglass", title: "ما في نتائج")
            } else {
                ForEach(groups, id: \.self) { g in
                    GHSection(g.isEmpty ? nil : g) {
                        ForEach(filtered.filter { $0.group == g }) { c in row(c) }
                    }
                }
            }
        }
    }

    private func row(_ c: GwChoice) -> some View {
        Tile(c.title, chevron: false, action: { done(c) }, trailing: {
            if c.id == selected {
                Image(systemName: "checkmark").font(.system(size: 17, weight: .semibold)).foregroundStyle(GH.burgundy)
            }
        })
    }
}

/// The store's products to pick one (for a notification link).
@MainActor
fileprivate struct GwProductPickPage: View {
    let done: (AdminProduct?) -> Void

    var body: some View {
        GHPage("اختر المنتج", leading: {
            NavButton("إلغاء") { done(nil) }
        }) {
            ProductBrowser(onTap: { p in done(p) })
        }
    }
}

// MARK: - Insights (sales analytics)

fileprivate enum GwPeriod: String, CaseIterable {
    case today, week, month, quarter, thisMonth, year, custom

    var label: String {
        switch self {
        case .today: return "اليوم"
        case .week: return "7 أيام"
        case .month: return "30 يوم"
        case .quarter: return "3 شهور"
        case .thisMonth: return "هذا الشهر"
        case .year: return "هذي السنة"
        case .custom: return "تاريخ محدد"
        }
    }
}

fileprivate func gwRange(_ p: GwPeriod, customFrom: Date, customTo: Date) -> (from: Date, to: Date) {
    let today = gwCal.startOfDay(for: Date())
    switch p {
    case .today:
        return (today, today)
    case .week:
        return (gwCal.date(byAdding: .day, value: -6, to: today) ?? today, today)
    case .month:
        return (gwCal.date(byAdding: .day, value: -29, to: today) ?? today, today)
    case .quarter:
        return (gwCal.date(byAdding: .day, value: -89, to: today) ?? today, today)
    case .thisMonth:
        let c = gwCal.dateComponents([.year, .month], from: today)
        return (gwCal.date(from: c) ?? today, today)
    case .year:
        let c = gwCal.dateComponents([.year], from: today)
        return (gwCal.date(from: c) ?? today, today)
    case .custom:
        return (min(customFrom, customTo), max(customFrom, customTo))
    }
}

fileprivate struct GwSummary {
    var sales: Double = 0
    var orders: Int = 0
    var average: Double = 0
    var customers: Int = 0
    var collected: Double = 0
    var profit: Double? = nil
    var profitPieces: Int = 0

    init() {}

    init(_ m: JSON) {
        sales = jd(m["sales"])
        orders = ji(m["orders"])
        average = jd(m["average"])
        customers = ji(m["customers"])
        collected = jd(m["collected"])
        profit = jdn(m["profit"])
        profitPieces = ji(m["profit_pieces"])
    }
}

fileprivate struct GwRank: Identifiable {
    let id: String
    let name: String
    let sales: Double
    let pieces: Int
}

fileprivate struct GwTopCustomer: Identifiable {
    let id: String
    let name: String
    let phone: String?
    let orders: Int
    let spent: Double
}

fileprivate struct GwPoint: Identifiable {
    let date: Date
    let sales: Double
    var id: Date { date }
}

fileprivate struct GwInsights {
    let from: Date?
    let to: Date?
    let now: GwSummary
    let prev: GwSummary
    let brands: [GwRank]
    let categories: [GwRank]
    let customers: [GwTopCustomer]
    /// "yyyy-MM-dd" → sales
    let daily: [String: Double]

    init(_ m: JSON) {
        from = jdate(m["from"])
        to = jdate(m["to"])
        now = (m["now"] as? JSON).map { GwSummary($0) } ?? GwSummary()
        prev = (m["prev"] as? JSON).map { GwSummary($0) } ?? GwSummary()
        var b: [GwRank] = []
        for (i, r) in jlist(m["by_brand"]).enumerated() {
            b.append(GwRank(id: "b\(i)", name: js(r["name"]) ?? "—", sales: jd(r["sales"]), pieces: ji(r["pieces"])))
        }
        brands = b
        var c: [GwRank] = []
        for (i, r) in jlist(m["by_category"]).enumerated() {
            c.append(GwRank(id: "c\(i)", name: js(r["name"]) ?? "أخرى", sales: jd(r["sales"]), pieces: ji(r["pieces"])))
        }
        categories = c
        customers = jlist(m["top_customers"]).map { r in
            GwTopCustomer(id: jstr(r["id"]), name: js(r["name"]) ?? "—", phone: js(r["phone"]),
                          orders: ji(r["orders"]), spent: jd(r["spent"]))
        }
        var d: [String: Double] = [:]
        for r in jlist(m["daily"]) {
            if let k = js(r["date"]) { d[k] = jd(r["sales"]) }
        }
        daily = d
    }

    /// Every day of the period (empty days included); months when the period is long.
    func series() -> (points: [GwPoint], monthly: Bool) {
        guard let from, let to else { return ([], false) }
        var days: [GwPoint] = []
        var cur = gwCal.startOfDay(for: from)
        let end = gwCal.startOfDay(for: to)
        var n = 0
        while cur <= end && n < 400 {
            days.append(GwPoint(date: cur, sales: daily[dayString(cur)] ?? 0))
            guard let next = gwCal.date(byAdding: .day, value: 1, to: cur) else { break }
            cur = next
            n += 1
        }
        if days.count <= 92 { return (days, false) }
        var order: [Date] = []
        var sums: [Date: Double] = [:]
        for p in days {
            let comps = gwCal.dateComponents([.year, .month], from: p.date)
            guard let mDate = gwCal.date(from: comps) else { continue }
            if sums[mDate] == nil { order.append(mDate); sums[mDate] = 0 }
            sums[mDate] = (sums[mDate] ?? 0) + p.sales
        }
        return (order.map { GwPoint(date: $0, sales: sums[$0] ?? 0) }, true)
    }
}

@MainActor
struct InsightsPage: View {
    @State private var period: GwPeriod = .month
    @State private var customFrom: Date = gwCal.date(byAdding: .day, value: -29, to: Date()) ?? Date()
    @State private var customTo: Date = Date()
    @State private var data: GwInsights?
    @State private var loaded = false
    @State private var loading = false
    @State private var failure: String?

    init() {}

    private var range: (from: Date, to: Date) { gwRange(period, customFrom: customFrom, customTo: customTo) }
    private var rangeKey: String { "\(period.rawValue)|\(dayString(range.from))|\(dayString(range.to))" }

    var body: some View {
        GHPage("التحليلات", onRefresh: { await load() }, trailing: {
            if loading { ProgressView() }
        }) {
            periodChips
            Text(rangeText).font(TS.small).foregroundStyle(GH.secondary)
                .padding(.horizontal, 22).padding(.top, 6)
            content
        }
        .task(id: rangeKey) { await load() }
    }

    private var rangeText: String {
        let r = range
        let span = dayString(r.from) == dayString(r.to) ? dateStr(r.from) : "\(dateStr(r.from)) — \(dateStr(r.to))"
        return "\(span) · مقارنة بالفترة اللي قبلها"
    }

    private var periodChips: some View {
        ChipBar {
            ForEach(GwPeriod.allCases, id: \.self) { p in
                ChipButton(p.label, selected: period == p, icon: p == .custom ? "calendar" : nil) {
                    if p == .custom { Task { await pickCustom() } } else { period = p }
                }
            }
        }
        .padding(.top, 4)
    }

    @ViewBuilder private var content: some View {
        if !loaded {
            LoadingView()
        } else if let d = data {
            kpis(d)
            if d.now.orders == 0 {
                EmptyState(icon: "chart.bar.xaxis", title: "ما في طلبات في هذي الفترة", message: "اختر فترة أطول من فوق.")
            } else {
                salesSection(d)
                if !d.brands.isEmpty { brandsSection(d) }
                if !d.categories.isEmpty { categoriesSection(d) }
                if !d.customers.isEmpty { customersSection(d) }
            }
        } else {
            EmptyState(icon: "wifi.exclamationmark", title: "ما قدرنا نجيب التحليلات", message: failure) {
                SecondaryButton("حاول مرة ثانية", icon: "arrow.clockwise") { Task { await load() } }
            }
        }
    }

    private func kpis(_ d: GwInsights) -> some View {
        let n = d.now
        let p = d.prev
        let cols = [GridItem(.adaptive(minimum: 150), spacing: 10)]
        var profitDelta: GwDelta? = nil
        if let a = n.profit, let b = p.profit { profitDelta = gwDelta(a, b) }
        let profitNote: String = n.profit == nil ? "سجّل سعر الشراء في القطع ليطلع الربح" : "من \(n.profitPieces) قطعة"
        return LazyVGrid(columns: cols, spacing: 10) {
            GwKpiCard(label: "المبيعات", value: omr(n.sales), icon: "chart.line.uptrend.xyaxis", hero: true,
                      delta: gwDelta(n.sales, p.sales))
            GwKpiCard(label: "الطلبات", value: "\(n.orders)", icon: "bag.fill", color: GH.blue,
                      delta: gwDelta(Double(n.orders), Double(p.orders)))
            GwKpiCard(label: "متوسط الطلب", value: omr(n.average), icon: "divide.circle.fill", color: GH.gold,
                      delta: gwDelta(n.average, p.average))
            GwKpiCard(label: "عملاء اشتروا", value: "\(n.customers)", icon: "person.2.fill", color: GH.purple,
                      delta: gwDelta(Double(n.customers), Double(p.customers)))
            GwKpiCard(label: "المحصّل", value: omr(n.collected), icon: "dollarsign.circle.fill", color: GH.green,
                      delta: gwDelta(n.collected, p.collected))
            GwKpiCard(label: "الربح", value: n.profit.map { omr($0) } ?? "—", icon: "sparkles", color: GH.burgundy,
                      delta: profitDelta, note: profitNote)
        }
        .padding(.horizontal, 16).padding(.top, 14)
    }

    private func salesSection(_ d: GwInsights) -> some View {
        let s = d.series()
        return GHSection(s.monthly ? "المبيعات الشهرية" : "المبيعات اليومية",
                         footer: "قيمة القطع بدون التوصيل، والطلبات الملغية ما تنحسب.") {
            if s.points.count < 2 {
                KV("مبيعات اليوم", omr(d.now.sales), strong: true)
            } else {
                GwSalesChart(points: s.points, monthly: s.monthly)
            }
        }
    }

    private func brandsSection(_ d: GwInsights) -> some View {
        let rows = Array(d.brands.prefix(8))
        return GHSection("أكثر البراندات مبيعاً") {
            GwRankBars(rows: rows, color: GH.burgundy)
            ForEach(rows) { r in
                KV(r.name, "\(omr(r.sales)) · \(r.pieces) قطعة")
            }
        }
    }

    private func categoriesSection(_ d: GwInsights) -> some View {
        GHSection("حسب التصنيف", footer: "من طلبات المتجر فقط.") {
            GwDonut(rows: Array(d.categories.prefix(8)))
        }
    }

    private func customersSection(_ d: GwInsights) -> some View {
        GHSection("أفضل العملاء") {
            ForEach(Array(d.customers.enumerated()), id: \.offset) { pair in
                customerRow(pair.element, rank: pair.offset + 1)
            }
        }
    }

    private func customerRow(_ c: GwTopCustomer, rank: Int) -> some View {
        let open: (() -> Void)? = Store.shared.customer(c.id) == nil ? nil : { pushPage(CustomerDetailPage(customerId: c.id)) }
        var sub = "\(c.orders) طلب"
        if let ph = c.phone { sub += " · \(ph)" }
        return Tile(c.name, subtitle: sub, value: omr(c.spent), valueColor: GH.label, valueFont: TS.money,
                    action: open, leading: {
            ZStack(alignment: .bottomTrailing) {
                Avatar(c.name, size: 34)
                Text("\(rank)").font(.gh(10, .bold)).foregroundStyle(Color.white)
                    .frame(width: 16, height: 16)
                    .background(Circle().fill(rank <= 3 ? GH.gold : GH.grey))
            }
        })
    }

    private func pickCustom() async {
        guard let f = await pickDate(customFrom) else { return }
        try? await Task.sleep(nanoseconds: 450_000_000)
        guard let t = await pickDate(max(f, customTo)) else { return }
        customFrom = min(f, t)
        customTo = max(f, t)
        period = .custom
    }

    private func load() async {
        let r = range
        loading = true
        do {
            let res = try await Api.shared.get("/admin/insights?from=\(dayString(r.from))&to=\(dayString(r.to))") as? JSON ?? [:]
            data = GwInsights(res)
            failure = nil
        } catch {
            if !(error is CancellationError) { failure = errorText(error) }
        }
        loading = false
        loaded = true
    }
}

/// Bars of sales per day (or month); tap/drag to read one bar.
@MainActor
fileprivate struct GwSalesChart: View {
    let points: [GwPoint]
    let monthly: Bool
    @State private var picked: Date?

    init(points: [GwPoint], monthly: Bool) {
        self.points = points
        self.monthly = monthly
    }

    private var total: Double { points.reduce(0) { $0 + $1.sales } }
    private var average: Double { points.isEmpty ? 0 : total / Double(points.count) }

    private func isPicked(_ p: GwPoint) -> Bool {
        guard let picked else { return false }
        return gwCal.isDate(p.date, equalTo: picked, toGranularity: monthly ? .month : .day)
    }

    private var pickedPoint: GwPoint? { points.first { isPicked($0) } }

    private func label(_ d: Date) -> String {
        if monthly {
            let c = gwCal.dateComponents([.year, .month], from: d)
            return "\(c.month ?? 0)/\(c.year ?? 0)"
        }
        return dateStr(d)
    }

    var body: some View {
        let unit: Calendar.Component = monthly ? .month : .day
        let pp = pickedPoint
        return VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(pp.map { label($0.date) } ?? "المجموع").font(TS.small).foregroundStyle(GH.secondary)
                    Text(omr(pp?.sales ?? total)).font(.gh(20, .bold).monospacedDigit()).foregroundStyle(GH.label)
                }
                Spacer()
                HStack(spacing: 5) {
                    Rectangle().fill(GH.gold).frame(width: 14, height: 2)
                    Text("المتوسط \(plainOmr(average))").font(TS.small).foregroundStyle(GH.secondary)
                }
            }
            Chart {
                ForEach(points) { p in
                    BarMark(x: .value("التاريخ", p.date, unit: unit),
                            y: .value("المبيعات", p.sales))
                        .foregroundStyle(isPicked(p) ? GH.gold.gradient : GH.burgundy.gradient)
                        .cornerRadius(3)
                }
                RuleMark(y: .value("المتوسط", average))
                    .foregroundStyle(GH.gold)
                    .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 3]))
            }
            .chartXSelection(value: $picked)
            .frame(height: 210)
        }
        .padding(16)
    }
}

/// Horizontal bars for a ranking (brands).
@MainActor
fileprivate struct GwRankBars: View {
    let rows: [GwRank]
    let color: Color

    var body: some View {
        Chart(rows) { r in
            BarMark(x: .value("المبيعات", r.sales), y: .value("الاسم", r.name))
                .foregroundStyle(color.gradient)
                .cornerRadius(4)
                .annotation(position: .trailing, alignment: .leading, spacing: 4) {
                    Text(plainOmr(r.sales)).font(.gh(10.5)).foregroundStyle(GH.secondary)
                }
        }
        .chartXAxis(.hidden)
        .chartYAxis {
            AxisMarks { _ in
                AxisValueLabel()
            }
        }
        .frame(height: CGFloat(rows.count) * 34 + 12)
        .padding(16)
    }
}

/// Share of sales per category, with a legend list.
@MainActor
fileprivate struct GwDonut: View {
    let rows: [GwRank]

    private var total: Double { rows.reduce(0) { $0 + $1.sales } }

    private func color(_ i: Int) -> Color { gwPalette[i % gwPalette.count] }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Chart {
                ForEach(Array(rows.enumerated()), id: \.offset) { pair in
                    SectorMark(angle: .value("المبيعات", pair.element.sales),
                               innerRadius: .ratio(0.62), angularInset: 1.5)
                        .foregroundStyle(color(pair.offset))
                        .cornerRadius(3)
                }
            }
            .chartLegend(.hidden)
            .frame(height: 190)
            .overlay {
                VStack(spacing: 2) {
                    Text("المجموع").font(TS.small).foregroundStyle(GH.secondary)
                    Text(plainOmr(total)).font(.gh(15, .bold).monospacedDigit()).foregroundStyle(GH.label)
                }
            }
            .padding(16)
            ForEach(Array(rows.enumerated()), id: \.offset) { pair in
                legendRow(pair.element, color: color(pair.offset))
            }
        }
    }

    private func legendRow(_ r: GwRank, color: Color) -> some View {
        let pct = total > 0 ? Int((r.sales / total * 100).rounded()) : 0
        return HStack(spacing: 10) {
            Circle().fill(color).frame(width: 10, height: 10)
            Text(r.name).font(.gh(15)).foregroundStyle(GH.label).lineLimit(1)
            Spacer(minLength: 8)
            Text("\(pct)%").font(TS.small).foregroundStyle(GH.secondary)
            Text(omr(r.sales)).font(.gh(14.5, .medium).monospacedDigit()).foregroundStyle(GH.label)
        }
        .padding(.horizontal, 16).padding(.vertical, 9)
    }
}

// MARK: - Abandoned carts

fileprivate struct GwCartItem {
    let name: String
    let brand: String
    let image: String?
    let price: Double
    let quantity: Int
    let options: String

    init(_ m: JSON) {
        name = jstr(m["name"])
        brand = jstr(m["brand"])
        image = js(m["image"]).map { storyImageUrl($0) }
        price = jd(m["price"])
        quantity = max(1, ji(m["quantity"]))
        options = jlist(m["options"]).map { "\(jstr($0["label"])): \(jstr($0["value"]))" }.joined(separator: " · ")
    }
}

fileprivate struct GwCart: Identifiable {
    let id: String
    let userId: String
    let name: String
    let email: String?
    let phone: String?
    let total: Double
    let itemCount: Int
    let source: String?
    let updatedAt: Date?
    var remindedAt: Date?
    var whatsappedAt: Date?
    let items: [GwCartItem]

    init(_ m: JSON) {
        id = jstr(m["id"])
        userId = jstr(m["user_id"])
        name = js(m["name"]) ?? "عميل"
        email = js(m["email"])
        phone = js(m["phone"])
        total = jd(m["total"])
        itemCount = ji(m["item_count"])
        source = js(m["source"])
        updatedAt = jdate(m["updated_at"])
        remindedAt = jdate(m["reminded_at"])
        whatsappedAt = jdate(m["whatsapped_at"])
        items = jlist(m["items"]).map { GwCartItem($0) }
    }

    var sourceLabel: String? {
        switch source {
        case "app": return "التطبيق"
        case "web": return "الموقع"
        default: return nil
        }
    }
}

fileprivate struct GwCartStats {
    let reminded: Int
    let recovered: Int
    let rate: Int
    let value: Double
}

@MainActor
struct AbandonedCartsPage: View {
    @State private var hours = 2
    @State private var rows: [GwCart] = []
    @State private var totalValue: Double = 0
    @State private var stats: GwCartStats?
    @State private var loaded = false
    @State private var failure: String?
    @State private var busyId: String?
    @State private var sendingAll = false

    init() {}

    private let hourOptions: [(Int, String)] = [(1, "من ساعة"), (2, "من ساعتين"), (24, "من يوم"), (72, "من 3 أيام")]

    private var pending: Int { rows.filter { $0.remindedAt == nil }.count }

    var body: some View {
        GHPage("السلات المتروكة", onRefresh: { await load() }, bottom: {
            PrimaryButton(pending > 0 ? "ذكّر الكل · \(pending)" : "كل السلات انرسل لها تذكير", icon: "bell.badge.fill",
                          busy: sendingAll, action: remindAllAction)
        }) {
            ChipBar {
                ForEach(hourOptions, id: \.0) { o in
                    ChipButton(o.1, selected: hours == o.0) { hours = o.0 }
                }
            }
            .padding(.top, 4)
            content
        }
        .task(id: hours) { await load() }
    }

    private var remindAllAction: (() -> Void)? {
        if pending == 0 || sendingAll { return nil }
        return { Task { await remindAll() } }
    }

    @ViewBuilder private var content: some View {
        if !loaded {
            LoadingView()
        } else if let failure, rows.isEmpty {
            EmptyState(icon: "wifi.exclamationmark", title: "ما قدرنا نجيب السلات", message: failure) {
                SecondaryButton("حاول مرة ثانية", icon: "arrow.clockwise") { Task { await load() } }
            }
        } else {
            summary
            if rows.isEmpty {
                EmptyState(icon: "bag", title: "ما في سلات متروكة الحين",
                           message: "أول ما يحط عميل قطع في السلة ويطلع بدون ما يطلب، بتطلع هنا وتقدر تذكّره.")
            } else {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 280), spacing: 14)], spacing: 14) {
                    ForEach(rows) { c in
                        GwCartCard(cart: c, busy: busyId == c.id,
                                   onRemind: { Task { await remind(c) } },
                                   onWhatsApp: { Task { await whatsapp(c) } },
                                   onDelete: { Task { await remove(c) } })
                    }
                }
                .padding(.horizontal, 16).padding(.top, 18)
            }
        }
    }

    private var summary: some View {
        let cols = [GridItem(.adaptive(minimum: 150), spacing: 10)]
        return LazyVGrid(columns: cols, spacing: 10) {
            GwKpiCard(label: "سلات متروكة", value: "\(rows.count)", icon: "bag.fill", hero: true,
                      note: "قيمتها \(omr(totalValue))")
            if let s = stats {
                GwKpiCard(label: "تذكيرات · 30 يوم", value: "\(s.reminded)", icon: "bell.fill", color: GH.gold)
                GwKpiCard(label: "رجعت طلبات", value: "\(s.recovered)", icon: "arrow.uturn.backward.circle.fill", color: GH.green,
                          note: "نسبة الاسترجاع \(s.rate)%")
                GwKpiCard(label: "مبيعات رجعت", value: omr(s.value), icon: "dollarsign.circle.fill", color: GH.burgundy)
            }
        }
        .padding(.horizontal, 16).padding(.top, 12)
    }

    private func load() async {
        do {
            let res = try await Api.shared.get("/admin/abandoned-carts?hours=\(hours)") as? JSON ?? [:]
            rows = jlist(res["data"]).map { GwCart($0) }
            totalValue = jd(res["total_value"])
            if let s = res["stats"] as? JSON {
                stats = GwCartStats(reminded: ji(s["reminded"]), recovered: ji(s["recovered"]), rate: ji(s["rate"]), value: jd(s["value"]))
            } else {
                stats = nil
            }
            failure = nil
        } catch {
            if !(error is CancellationError) { failure = errorText(error) }
        }
        loaded = true
    }

    private func remind(_ c: GwCart) async {
        busyId = c.id
        let ok = await attempt { try await Api.shared.post("/admin/abandoned-carts/\(c.id)/remind") }
        busyId = nil
        if ok {
            rows = rows.map { r in
                var x = r
                if x.id == c.id { x.remindedAt = Date() }
                return x
            }
            toast("انرسل التذكير (التطبيق والإيميل)")
        }
    }

    private func whatsapp(_ c: GwCart) async {
        guard let phone = waPhone(c.phone), phone.count >= 10 else {
            toast("ما عنده رقم", error: true)
            return
        }
        let first = c.name.split(separator: " ").first.map { String($0) } ?? ""
        var lines: [String] = []
        for i in c.items.prefix(3) {
            let brand: String = i.brand.isEmpty ? "" : "\(i.brand) "
            lines.append("• \(brand)\(i.name)")
        }
        let list = lines.joined(separator: "\n")
        let msg = "هلا \(first) 🤍\nشفنا قطعك في السلة بانتظارك:\n\(list)\n\nإذا عندك أي سؤال عن المقاس أو التوصيل احنا هنا، وتقدر تكمل طلبك من هنا: https://ghshopper.com/checkout"
        openURL("https://wa.me/\(phone)?text=\(gwEncode(msg))")
        rows = rows.map { r in
            var x = r
            if x.id == c.id { x.whatsappedAt = Date() }
            return x
        }
        _ = try? await Api.shared.post("/admin/abandoned-carts/\(c.id)/whatsapp")
    }

    private func remove(_ c: GwCart) async {
        guard await confirm("تشيل هذي السلة من القائمة؟", message: "السلة تنحذف من القائمة بس، ما يتغير شي عند العميل.", ok: "شيل") else { return }
        busyId = c.id
        let ok = await attempt { try await Api.shared.delete("/admin/abandoned-carts/\(c.id)") }
        busyId = nil
        if ok {
            rows = rows.filter { $0.id != c.id }
            totalValue = rows.reduce(0) { $0 + $1.total }
            toast("انشالت")
        }
    }

    private func remindAll() async {
        let n = pending
        guard n > 0 else { toast("كل السلات انرسل لها تذكير"); return }
        guard await confirm("نرسل تذكير لـ \(n) سلة ما انرسل لها قبل؟",
                            message: "يوصلهم إشعار في التطبيق وإيميل.", ok: "أرسل", destructive: false) else { return }
        sendingAll = true
        var sent = 0
        let ok = await attempt {
            let res = try await Api.shared.post("/admin/abandoned-carts/remind-all") as? JSON ?? [:]
            sent = ji(res["sent"])
        }
        sendingAll = false
        if ok {
            toast("انرسل \(sent) تذكير ✓")
            await load()
        }
    }
}

@MainActor
fileprivate struct GwCartCard: View {
    let cart: GwCart
    let busy: Bool
    let onRemind: () -> Void
    let onWhatsApp: () -> Void
    let onDelete: () -> Void

    private var openCustomer: (() -> Void)? {
        let id = cart.userId
        if Store.shared.customer(id) == nil { return nil }
        return { pushPage(CustomerDetailPage(customerId: id)) }
    }

    var body: some View {
        GwCard {
            header
            Rectangle().fill(GH.separator).frame(height: 0.5).padding(.leading, 16)
            VStack(alignment: .leading, spacing: 10) {
                ForEach(Array(cart.items.enumerated()), id: \.offset) { pair in
                    GwCartItemRow(item: pair.element)
                }
            }
            .padding(.horizontal, 16).padding(.vertical, 12)
            Rectangle().fill(GH.separator).frame(height: 0.5).padding(.leading, 16)
            actions
        }
    }

    private var contact: String {
        var parts: [String] = []
        if let p = cart.phone { parts.append(p) }
        if let e = cart.email { parts.append(e) }
        return parts.isEmpty ? "—" : parts.joined(separator: " · ")
    }

    private var header: some View {
        Pressable(action: openCustomer) {
            VStack(alignment: .leading, spacing: 8) {
                HStack(alignment: .top, spacing: 10) {
                    Avatar(cart.name, size: 38)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(cart.name).font(.gh(16, .semibold)).foregroundStyle(GH.label).lineLimit(1)
                        Text(contact).font(TS.small).foregroundStyle(GH.secondary).lineLimit(1)
                    }
                    Spacer(minLength: 6)
                    VStack(alignment: .trailing, spacing: 2) {
                        Text(omr(cart.total)).font(TS.money).foregroundStyle(GH.burgundy)
                        Text(ageText).font(TS.small).foregroundStyle(GH.secondary).lineLimit(1)
                    }
                }
                if cart.remindedAt != nil || cart.whatsappedAt != nil {
                    HStack(spacing: 6) {
                        if let r = cart.remindedAt { Badge("تذكير \(gwAgo(r))", color: GH.green) }
                        if let w = cart.whatsappedAt { Badge("واتساب \(gwAgo(w))", color: GH.teal) }
                    }
                }
            }
            .padding(.horizontal, 16).padding(.vertical, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var ageText: String {
        var s = gwAgo(cart.updatedAt)
        if let src = cart.sourceLabel { s += " · \(src)" }
        return s
    }

    private var actions: some View {
        HStack(spacing: 8) {
            if busy {
                ProgressView().frame(maxWidth: .infinity)
            } else {
                GwSmallButton(label: cart.remindedAt == nil ? "ذكّره" : "تم التذكير",
                              icon: cart.remindedAt == nil ? "bell.fill" : "checkmark",
                              color: GH.burgundy, filled: cart.remindedAt == nil,
                              action: cart.remindedAt == nil ? onRemind : nil)
                GwSmallButton(label: cart.whatsappedAt == nil ? "واتساب" : "واتساب مرة ثانية",
                              icon: "message.fill", color: GH.green, filled: false, action: onWhatsApp)
                Spacer(minLength: 0)
                Button(action: onDelete) {
                    Image(systemName: "trash").font(.system(size: 16)).foregroundStyle(GH.red)
                        .frame(width: 36, height: 36)
                        .background(Circle().fill(GH.red.opacity(0.09)))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 12).padding(.vertical, 10)
        .frame(minHeight: 56)
    }
}

@MainActor
fileprivate struct GwCartItemRow: View {
    let item: GwCartItem

    var body: some View {
        HStack(spacing: 10) {
            RemoteImage(url: item.image)
                .frame(width: 42, height: 52)
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            VStack(alignment: .leading, spacing: 1) {
                if !item.brand.isEmpty {
                    Text(item.brand.uppercased()).font(.gh(10.5, .semibold)).foregroundStyle(GH.secondary).lineLimit(1)
                }
                Text(item.name).font(.gh(14)).foregroundStyle(GH.label).lineLimit(2)
                if !item.options.isEmpty {
                    Text(item.options).font(.gh(11.5)).foregroundStyle(GH.secondary).lineLimit(1)
                }
            }
            Spacer(minLength: 6)
            Text(item.quantity > 1 ? "\(item.quantity) × \(plainOmr(item.price))" : plainOmr(item.price))
                .font(.gh(13, .semibold).monospacedDigit()).foregroundStyle(GH.label)
        }
    }
}

@MainActor
fileprivate struct GwSmallButton: View {
    let label: String
    let icon: String
    let color: Color
    let filled: Bool
    let action: (() -> Void)?

    var body: some View {
        Button { Haptic.select(); action?() } label: {
            HStack(spacing: 5) {
                Image(systemName: icon).font(.system(size: 13))
                Text(label).font(.gh(14, .medium)).lineLimit(1)
            }
            .foregroundStyle(filled ? Color.white : color)
            .padding(.horizontal, 12).padding(.vertical, 8)
            .background {
                if filled {
                    Capsule().fill(color)
                } else {
                    Capsule().fill(color.opacity(0.1))
                }
            }
        }
        .buttonStyle(.plain)
        .disabled(action == nil)
        .opacity(action == nil ? 0.6 : 1)
    }
}

// MARK: - Push notifications to customers

fileprivate struct GwAudience {
    let customers: Int
    let withPhone: Int
}

fileprivate struct GwDevices {
    let total: Int
    let customers: Int
    let guests: Int
}

/// One sent notification. A group send is stored as one row per customer; rows
/// with the same text in the same minute are shown as one.
fileprivate struct GwBroadcast: Identifiable {
    var ids: [Int]
    let titleAr: String
    let bodyAr: String
    let titleEn: String?
    let bodyEn: String?
    let createdAt: Date?
    var names: [String]
    var everyone: Bool
    let image: String?
    let link: String?

    var id: String { "\(ids.first ?? 0)" }

    var target: String {
        if everyone { return "كل العملاء" }
        if ids.count == 1 { return names.first ?? "عميل" }
        return "\(ids.count) عميل"
    }
}

fileprivate func gwBroadcasts(_ rows: [JSON]) -> [GwBroadcast] {
    var out: [GwBroadcast] = []
    var index: [String: Int] = [:]
    for r in rows {
        let t = jstr(r["title_ar"])
        let b = jstr(r["body_ar"])
        let stamp = String(jstr(r["created_at"]).prefix(16))
        let key = t + "|" + b + "|" + stamp
        let isAll = js(r["user_id"]) == nil
        let user = r["user"] as? JSON
        let name: String? = user.flatMap { js($0["name"]) }
        if let k = index[key] {
            out[k].ids.append(ji(r["id"]))
            if let name { out[k].names.append(name) }
            if isAll { out[k].everyone = true }
        } else {
            let data = r["data"] as? JSON ?? [:]
            var link: String? = nil
            if let p = js(data["product_id"]) { link = "منتج #\(p)" }
            else if let br = js(data["brand_id"]) { link = "براند #\(br)" }
            else if let c = js(data["category_id"]) { link = "تصنيف #\(c)" }
            else if let u = js(data["url"]) { link = u }
            index[key] = out.count
            out.append(GwBroadcast(ids: [ji(r["id"])], titleAr: t, bodyAr: b, titleEn: js(r["title_en"]), bodyEn: js(r["body_en"]),
                                   createdAt: jdate(r["created_at"]), names: name.map { [$0] } ?? [], everyone: isAll,
                                   image: js(data["image"]), link: link))
        }
    }
    return out
}

fileprivate let gwLinkTypes: [(String, String)] = [
    ("none", "صفحة الإشعارات"), ("product", "منتج"), ("brand", "براند"), ("category", "تصنيف"), ("url", "رابط"),
]

fileprivate let gwFallbackTiers: [GwChoice] = [
    GwChoice(id: "tier:Beige", title: "مستوى بيج", group: "مستوى الولاء"),
    GwChoice(id: "tier:Burgundy", title: "مستوى عنابي", group: "مستوى الولاء"),
    GwChoice(id: "tier:Black", title: "مستوى أسود", group: "مستوى الولاء"),
]

@MainActor
struct NotifyPage: View {
    @State private var tab = "compose"
    // audience
    @State private var audience = "all"
    @State private var segment = ""
    @State private var segmentLabel: String?
    @State private var customer: Customer?
    @State private var count: GwAudience?
    @State private var counting = false
    // message
    @State private var titleAr = ""
    @State private var bodyAr = ""
    @State private var titleEn = ""
    @State private var bodyEn = ""
    @State private var image: UIImage?
    @State private var linkType = "none"
    @State private var linkValue = ""
    @State private var linkLabel: String?
    @State private var sending = false
    // lists
    @State private var tiers: [GwChoice] = []
    @State private var brands: [GwChoice] = []
    @State private var devices: GwDevices?
    @State private var history: [GwBroadcast] = []
    @State private var historyLoaded = false
    @State private var historyError: String?
    @State private var busyId: String?
    @StateObject private var photos = OrderPhotoPicker()

    init() {}

    private var audienceKey: String { "\(audience)|\(segment)" }

    var body: some View {
        GHPage("إشعارات العملاء", onRefresh: { await refresh() }, bottom: { bottomBar }) {
            Pad(top: 4) {
                Segments(value: $tab, options: [("compose", "إشعار جديد"), ("history", "المرسلة · \(history.count)")])
            }
            if tab == "compose" {
                compose
            } else {
                historyView
            }
        }
        .orderPhotoPicker(photos)
        .task { await refresh() }
        .task(id: audienceKey) { await loadCount() }
    }

    @ViewBuilder private var bottomBar: some View {
        if tab == "compose" {
            PrimaryButton("أرسل الإشعار", icon: "paperplane.fill", busy: sending, action: sendAction)
        } else {
            SecondaryButton("إشعار جديد", icon: "square.and.pencil") { tab = "compose" }
        }
    }

    // MARK: compose

    @ViewBuilder private var compose: some View {
        audienceSection
        GHSection("الرسالة بالعربي") {
            FieldRow("العنوان", text: $titleAr, placeholder: "مثال: عرض خاص لك!")
            NotesRow(text: $bodyAr, placeholder: "نص الرسالة اللي توصل للعميل…")
        }
        GHSection("بالإنجليزي (اختياري)", footer: "إذا تركته فاضي، اللي تطبيقه إنجليزي يوصله النص العربي.") {
            FieldRow("Title", text: $titleEn, placeholder: "Special offer for you!", ltr: true)
            NotesRow(text: $bodyEn, placeholder: "The message the customer receives…")
                .environment(\.layoutDirection, .leftToRight)
        }
        imageSection
        linkSection
        previewSection
    }

    private var audienceSection: some View {
        GHSection("لمين يوصل", footer: audienceFooter) {
            Segments(value: $audience, options: [("all", "كل العملاء"), ("segment", "فئة"), ("specific", "عميل واحد")])
            if audience == "segment" {
                PickerRow("الفئة", value: segmentLabel, placeholder: "اختر الفئة") { Task { await pickSegment() } }
                Tile("يوصل لـ", value: countText, chevron: false, leading: {
                    IconBox("person.2.fill", color: GH.gold)
                }, trailing: {
                    if counting { ProgressView() }
                })
            }
            if audience == "specific" {
                PickerRow("العميل", value: customer?.name, placeholder: "اختر العميل") { Task { await pickCustomer() } }
            }
        }
    }

    private var audienceFooter: String? {
        switch audience {
        case "all":
            if let d = devices { return "يوصل لكل الأجهزة المسجلة: \(d.total) (\(d.customers) عميل مسجّل · \(d.guests) زائر)، كل واحد بلغة تطبيقه." }
            return "يوصل لكل اللي عندهم التطبيق، كل واحد بلغة تطبيقه."
        case "specific":
            return "يوصله على جواله وفي صفحة الإشعارات داخل التطبيق."
        default:
            return "كل عميل في الفئة يوصله في التطبيق، واللي عنده التطبيق على جواله يطلع له إشعار."
        }
    }

    private var countText: String {
        if segment.isEmpty { return "—" }
        guard let c = count else { return counting ? "نحسب…" : "—" }
        return "\(c.customers) عميل · \(c.withPhone) على الجوال"
    }

    private var imageSection: some View {
        GHSection("الصورة (اختياري)", footer: "صورة عرضية 2:1 أفضل. تطلع مع الإشعار وفي صفحة الإشعارات داخل التطبيق.") {
            if let img = image {
                ZStack(alignment: .topLeading) {
                    Image(uiImage: img).resizable().scaledToFill()
                        .frame(maxWidth: .infinity).frame(height: 170)
                        .clipped()
                    Button { image = nil } label: {
                        Image(systemName: "xmark").font(.system(size: 13, weight: .bold)).foregroundStyle(Color.white)
                            .frame(width: 30, height: 30)
                            .background(Circle().fill(Color.black.opacity(0.55)))
                    }
                    .buttonStyle(.plain)
                    .padding(10)
                }
                Tile("غيّر الصورة", chevron: false, action: { Task { await pickImage() } }, leading: {
                    IconBox("photo.on.rectangle", color: GH.gold)
                })
            } else {
                Tile("اختر صورة", chevron: false, action: { Task { await pickImage() } }, leading: {
                    IconBox("photo.badge.plus", color: GH.gold)
                })
            }
        }
    }

    private var linkTypeLabel: String { gwLinkTypes.first(where: { $0.0 == linkType })?.1 ?? "صفحة الإشعارات" }

    private var linkSection: some View {
        GHSection("لما يضغط على الإشعار يفتح") {
            PickerRow("يفتح", value: linkTypeLabel) { Task { await pickLinkType() } }
            if linkType == "product" {
                PickerRow("المنتج", value: linkLabel, placeholder: "اختر المنتج") { Task { await pickLinkTarget() } }
            } else if linkType == "brand" {
                PickerRow("البراند", value: linkLabel, placeholder: "اختر البراند") { Task { await pickLinkTarget() } }
            } else if linkType == "category" {
                PickerRow("التصنيف", value: linkLabel, placeholder: "اختر التصنيف") { Task { await pickLinkTarget() } }
            } else if linkType == "url" {
                FieldRow("الرابط", text: $linkValue, placeholder: "https://", keyboard: .url, ltr: true)
            }
        }
    }

    private var previewSection: some View {
        GHSection("معاينة") {
            HStack(alignment: .top, spacing: 10) {
                Text("GH").font(.gh(12, .bold)).foregroundStyle(GH.goldLight)
                    .frame(width: 34, height: 34)
                    .background(RoundedRectangle(cornerRadius: 9, style: .continuous).fill(GH.brandGradient))
                VStack(alignment: .leading, spacing: 2) {
                    HStack {
                        Text("GH Shopper").font(.gh(12.5, .semibold)).foregroundStyle(GH.secondary)
                        Spacer(minLength: 4)
                        Text("الحين").font(TS.small).foregroundStyle(GH.tertiary)
                    }
                    Text(gwTrim(titleAr).isEmpty ? "عنوان الإشعار يطلع هنا" : titleAr)
                        .font(.gh(15, .semibold)).foregroundStyle(GH.label).lineLimit(2)
                    Text(gwTrim(bodyAr).isEmpty ? "نص الرسالة يطلع هنا…" : bodyAr)
                        .font(TS.sub).foregroundStyle(GH.secondary).lineLimit(4)
                }
                if let img = image {
                    Image(uiImage: img).resizable().scaledToFill()
                        .frame(width: 44, height: 44)
                        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                }
            }
            .padding(14)
            .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(GH.card))
            .shadow(color: GH.shadowColor, radius: 8, y: 4)
            .padding(14)
            .background(GH.panel)
        }
    }

    // MARK: history

    @ViewBuilder private var historyView: some View {
        if !historyLoaded {
            LoadingView()
        } else if let historyError, history.isEmpty {
            EmptyState(icon: "wifi.exclamationmark", title: "ما قدرنا نجيب الإشعارات", message: historyError) {
                SecondaryButton("حاول مرة ثانية", icon: "arrow.clockwise") { Task { await loadHistory() } }
            }
        } else if history.isEmpty {
            EmptyState(icon: "bell.slash", title: "ما أرسلت إشعارات للحين", message: "الإشعارات اللي ترسلها للعملاء تطلع هنا.")
        } else {
            GHSection("آخر الإشعارات", footer: "اضغط على إشعار عشان تعيد إرساله أو تحذفه من صفحة إشعارات العملاء.") {
                ForEach(history) { b in
                    GwBroadcastRow(item: b, busy: busyId == b.id) { Task { await historyActions(b) } }
                }
            }
        }
    }

    // MARK: actions

    private var canSend: Bool {
        if sending { return false }
        if gwTrim(titleAr).isEmpty || gwTrim(bodyAr).isEmpty { return false }
        if audience == "segment" {
            if segment.isEmpty { return false }
            if let c = count, c.customers == 0 { return false }
        }
        if audience == "specific" && customer == nil { return false }
        if linkType != "none" && gwTrim(linkValue).isEmpty { return false }
        return true
    }

    private var sendAction: (() -> Void)? {
        if !canSend { return nil }
        return { Task { await send() } }
    }

    private var audienceSummary: String {
        switch audience {
        case "segment":
            let n = count.map { " · \($0.customers) عميل" } ?? ""
            return "\(segmentLabel ?? "فئة")\(n)"
        case "specific":
            return customer?.name ?? "عميل"
        default:
            if let d = devices { return "كل العملاء · \(d.total) جهاز" }
            return "كل العملاء"
        }
    }

    private func refresh() async {
        await loadLists()
        await loadHistory()
    }

    private func loadLists() async {
        if tiers.isEmpty {
            if let res = try? await Api.shared.get("/admin/loyalty-tiers") {
                let rows = gwRows(res).sorted { ji($0["min_points"]) < ji($1["min_points"]) }
                tiers = rows.compactMap { (r: JSON) -> GwChoice? in
                    guard let n = js(r["name"]) else { return nil }
                    return GwChoice(id: "tier:\(n)", title: "مستوى \(js(r["name_ar"]) ?? n)", group: "مستوى الولاء")
                }
            }
            if tiers.isEmpty { tiers = gwFallbackTiers }
        }
        if brands.isEmpty {
            if let res = try? await Api.shared.get("/admin/brands") {
                let list: [GwChoice] = gwRows(res).compactMap { (r: JSON) -> GwChoice? in
                    guard let id = js(r["id"]) else { return nil }
                    let en = gwTrim(jstr(r["name_en"]))
                    let title = en.isEmpty ? jstr(r["name_ar"]) : en
                    if gwTrim(title).isEmpty { return nil }
                    return GwChoice(id: id, title: title, group: "البراندات")
                }
                brands = list.sorted { $0.title.lowercased() < $1.title.lowercased() }
            }
        }
    }

    private func loadHistory() async {
        do {
            let res = try await Api.shared.get("/admin/notifications/sent") as? JSON ?? [:]
            history = gwBroadcasts(jlist(res["data"]))
            if let d = res["devices"] as? JSON {
                devices = GwDevices(total: ji(d["total"]), customers: ji(d["customers"]), guests: ji(d["guests"]))
            }
            historyError = nil
        } catch {
            if !(error is CancellationError) { historyError = errorText(error) }
        }
        historyLoaded = true
    }

    private func loadCount() async {
        count = nil
        guard audience == "segment", !segment.isEmpty else { counting = false; return }
        counting = true
        do {
            let res = try await Api.shared.get("/admin/notifications/audience?segment=\(gwEncode(segment))") as? JSON ?? [:]
            count = GwAudience(customers: ji(res["customers"]), withPhone: ji(res["with_phone"]))
        } catch {
            count = nil
        }
        counting = false
    }

    private func pickSegment() async {
        if tiers.isEmpty || brands.isEmpty { await loadLists() }
        var choices: [GwChoice] = tiers
        choices.append(GwChoice(id: "inactive:60", title: "ما طلبوا من 60 يوم", group: "حسب الطلبات"))
        choices.append(GwChoice(id: "inactive:120", title: "ما طلبوا من 4 شهور", group: "حسب الطلبات"))
        choices.append(GwChoice(id: "never", title: "سجّلوا وما طلبوا أبداً", group: "حسب الطلبات"))
        choices.append(GwChoice(id: "cart", title: "عندهم سلة ما كمّلوها", group: "حسب الطلبات"))
        for b in brands {
            choices.append(GwChoice(id: "brand:\(b.id)", title: "يحبون \(b.title)", group: "يحبون براند (اشتروا منه أو في مفضلتهم)"))
        }
        let current = segment
        let all = choices
        let picked: GwChoice? = await Nav.shared.pushForResult { d in
            GwChoicePage(title: "الفئة", choices: all, selected: current, done: d)
        }
        if let picked {
            segment = picked.id
            segmentLabel = picked.title
        }
    }

    private func pickCustomer() async {
        let c: Customer? = await Nav.shared.pushForResult { d in CustomerPickerPage(done: d) }
        if let c { customer = c }
    }

    private func pickImage() async {
        let src: String? = await pickAction(actions: [SheetAction("من الصور", "library"), SheetAction("الكاميرا", "camera")])
        guard let src else { return }
        if let img = await photos.pick(camera: src == "camera") { image = img }
    }

    private func pickLinkType() async {
        let acts: [SheetAction<String>] = gwLinkTypes.map { SheetAction($0.1, $0.0) }
        guard let t = await pickAction(title: "لما يضغط على الإشعار يفتح", actions: acts) else { return }
        if t != linkType {
            linkType = t
            linkValue = ""
            linkLabel = nil
        }
        if t == "product" || t == "brand" || t == "category" {
            try? await Task.sleep(nanoseconds: 350_000_000)
            await pickLinkTarget()
        }
    }

    private func pickLinkTarget() async {
        if linkType == "product" {
            let p: AdminProduct? = await Nav.shared.pushForResult { d in GwProductPickPage(done: d) }
            if let p {
                linkValue = String(p.id)
                linkLabel = p.name
            }
        } else if linkType == "brand" {
            if brands.isEmpty { await loadLists() }
            let list = brands
            let current = linkValue
            let picked: GwChoice? = await Nav.shared.pushForResult { d in
                GwChoicePage(title: "البراند", choices: list, selected: current, done: d)
            }
            if let picked {
                linkValue = picked.id
                linkLabel = picked.title
            }
        } else if linkType == "category" {
            let current = Int(linkValue)
            let c: CategoryChoice? = await Nav.shared.pushForResult { d in CategoryPickerPage(selected: current, done: d) }
            if let c {
                linkValue = String(c.id)
                linkLabel = c.path
            }
        }
    }

    private func send() async {
        let tAr = String(gwTrim(titleAr).prefix(150))
        let bAr = String(gwTrim(bodyAr).prefix(500))
        let tEn = String(gwTrim(titleEn).prefix(150))
        let bEn = String(gwTrim(bodyEn).prefix(500))
        guard await confirm("نرسل الإشعار؟", message: "\(audienceSummary)\n\n\(tAr)", ok: "أرسل", destructive: false) else { return }

        var fields: [String: String] = ["title_ar": tAr, "body_ar": bAr, "audience": audience, "link_type": linkType]
        if !tEn.isEmpty { fields["title_en"] = tEn }
        if !bEn.isEmpty { fields["body_en"] = bEn }
        if audience == "segment" { fields["segment"] = segment }
        if audience == "specific", let c = customer { fields["user_id"] = c.id }
        if linkType != "none" { fields["link_value"] = gwTrim(linkValue) }

        sending = true
        var sentCount: Int? = nil
        let img = image
        let ok = await attempt {
            let res: Any?
            if let img, let data = OrderPhotoPicker.jpeg(img, maxSide: 1600, quality: 0.85) {
                res = try await Api.shared.upload("/admin/notifications/broadcast", field: "image", data: data,
                                                  filename: "notification.jpg", fields: fields)
            } else {
                var body: JSON = [:]
                for (k, v) in fields { body[k] = v }
                res = try await Api.shared.post("/admin/notifications/broadcast", body)
            }
            if let m = res as? JSON, let n = jdn(m["sent"]) { sentCount = Int(n) }
        }
        sending = false
        guard ok else { return }
        Haptic.success()
        if let n = sentCount { toast("انرسل لـ \(n) عميل ✓") } else { toast("انرسل الإشعار ✓") }
        titleAr = ""
        bodyAr = ""
        titleEn = ""
        bodyEn = ""
        image = nil
        linkType = "none"
        linkValue = ""
        linkLabel = nil
        await loadHistory()
    }

    private func historyActions(_ b: GwBroadcast) async {
        let acts: [SheetAction<String>] = [
            SheetAction("استخدمه لإشعار جديد", "reuse"),
            SheetAction("احذفه من صفحة الإشعارات", "delete", destructive: true),
        ]
        guard let a = await pickAction(title: b.titleAr, message: b.target, actions: acts) else { return }
        if a == "reuse" {
            titleAr = b.titleAr
            bodyAr = b.bodyAr
            titleEn = b.titleEn ?? ""
            bodyEn = b.bodyEn ?? ""
            tab = "compose"
            return
        }
        let msg = b.ids.count > 1 ? "ينحذف عند \(b.ids.count) عميل. الإشعار اللي طلع على الجوال ما ينسحب." : "الإشعار اللي طلع على الجوال ما ينسحب."
        guard await confirm("حذف الإشعار؟", message: msg) else { return }
        busyId = b.id
        let ids = b.ids
        let ok = await attempt { try await Api.shared.post("/admin/notifications/delete-multiple", ["ids": ids]) }
        busyId = nil
        if ok {
            history = history.filter { $0.id != b.id }
            toast("انحذف")
        }
    }
}

@MainActor
fileprivate struct GwBroadcastRow: View {
    let item: GwBroadcast
    let busy: Bool
    let onTap: () -> Void

    var body: some View {
        Pressable(action: busy ? nil : onTap) {
            HStack(alignment: .top, spacing: 12) {
                if let img = item.image {
                    RemoteImage(url: img)
                        .frame(width: 46, height: 46)
                        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
                } else {
                    IconBox(item.everyone ? "megaphone.fill" : "bell.fill", color: item.everyone ? GH.burgundy : GH.gold, size: 36)
                }
                VStack(alignment: .leading, spacing: 4) {
                    Text(item.titleAr).font(.gh(15.5, .semibold)).foregroundStyle(GH.label)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Text(item.bodyAr).font(TS.sub).foregroundStyle(GH.secondary).lineLimit(3)
                    HStack(spacing: 6) {
                        Badge(item.target, color: item.everyone ? GH.burgundy : GH.gold)
                        if let l = item.link {
                            Text(l).font(TS.small).foregroundStyle(GH.tertiary).lineLimit(1)
                        }
                        Spacer(minLength: 4)
                        if busy {
                            ProgressView()
                        } else {
                            Text(item.createdAt.map { dateTimeStr($0) } ?? "—").font(TS.small).foregroundStyle(GH.tertiary)
                        }
                    }
                }
            }
            .padding(.horizontal, 16).padding(.vertical, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}
