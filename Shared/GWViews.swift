import SwiftUI

// The widget faces. Plain SwiftUI views with no WidgetKit types, so the app can
// draw them too (the "widgets" screenshot gallery). The extension wraps each in
// containerBackground + RTL.

/// What a widget shows: who is signed in and the latest numbers.
struct GWState {
    var session: GWSession?
    var summary: GWSummary?
    var driver: GWDriverSummary?

    static let signedOut = GWState()

    static var sampleStaff: GWState {
        GWState(session: GWSession(token: "demo", role: "admin", name: "غسان", api: ""), summary: GWSample.summary, driver: nil)
    }

    static var sampleDriver: GWState {
        GWState(session: GWSession(token: "demo", role: "driver", name: "خالد", api: ""), summary: nil, driver: GWSample.driver)
    }
}

// MARK: - placeholders

enum GWPlaceholderKind { case signedOut, staffOnly, driverOnly, noData }

/// A calm message when there is nothing to show.
struct GWPlaceholder: View {
    let kind: GWPlaceholderKind
    let onDark: Bool
    @Environment(\.colorScheme) var scheme

    private var title: String {
        switch kind {
        case .signedOut: return "سجّل دخول"
        case .staffOnly: return "للفريق فقط"
        case .driverOnly: return "للمناديب فقط"
        case .noData: return "افتح التطبيق"
        }
    }

    private var message: String {
        switch kind {
        case .signedOut: return "افتح GH Shopper وسجّل دخولك"
        case .staffOnly: return "هذي الأداة لحساب الفريق"
        case .driverOnly: return "هذي الأداة لحساب المندوب"
        case .noData: return "مرة وحدة عشان تطلع الأرقام هنا"
        }
    }

    var body: some View {
        let p = GWPalette(scheme)
        VStack(spacing: 6) {
            Spacer(minLength: 0)
            GWCheetah(onDark: onDark || p.dark, height: 16, opacity: 0.9)
            Text(title)
                .font(GWFont.plex(14, .semibold))
                .foregroundStyle(onDark ? GWBrand.ivory : p.ink)
            Text(message)
                .font(GWFont.plex(10.5))
                .foregroundStyle(onDark ? GWBrand.ivory.opacity(0.6) : p.muted)
                .multilineTextAlignment(.center)
                .lineLimit(2)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// Staff widgets: the content, or a placeholder for drivers / signed out.
struct GWStaffGate<Content: View>: View {
    let state: GWState
    let onDark: Bool
    @ViewBuilder let content: (GWSummary) -> Content

    var body: some View {
        if state.session == nil {
            GWPlaceholder(kind: .signedOut, onDark: onDark)
        } else if state.session?.isDriver == true {
            GWPlaceholder(kind: .staffOnly, onDark: onDark)
        } else if let s = state.summary {
            content(s)
        } else {
            GWPlaceholder(kind: .noData, onDark: onDark)
        }
    }
}

/// Driver widgets: the content, or a placeholder for staff / signed out.
struct GWDriverGate<Content: View>: View {
    let state: GWState
    let onDark: Bool
    @ViewBuilder let content: (GWDriverSummary) -> Content

    var body: some View {
        if state.session == nil {
            GWPlaceholder(kind: .signedOut, onDark: onDark)
        } else if state.session?.isDriver != true {
            GWPlaceholder(kind: .driverOnly, onDark: onDark)
        } else if let d = state.driver {
            content(d)
        } else {
            GWPlaceholder(kind: .noData, onDark: onDark)
        }
    }
}

// MARK: - اليوم (small, medium) on maroon

struct GWTodaySmall: View {
    let state: GWState

    var body: some View {
        GWStaffGate(state: state, onDark: true) { s in
            GWTodayBlock(summary: s, showCollect: true)
        }
        .widgetURL(GWLink.today)
    }
}

struct GWTodayMedium: View {
    let state: GWState

    var body: some View {
        GWStaffGate(state: state, onDark: true) { s in
            HStack(spacing: 16) {
                GWTodayBlock(summary: s, showCollect: false)
                Rectangle().fill(GWBrand.gold.opacity(0.35)).frame(width: 0.5)
                GWTodaySide(summary: s)
            }
        }
        .widgetURL(GWLink.today)
    }
}

/// Today's orders and sales (ivory on maroon).
struct GWTodayBlock: View {
    let summary: GWSummary
    let showCollect: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header
            Spacer(minLength: 2)
            count
            Text(GWFmt.money(summary.todaySales))
                .font(GWFont.plex(15, .semibold))
                .foregroundStyle(GWBrand.ivory)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
            Spacer(minLength: 4)
            if showCollect { collect }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var header: some View {
        HStack(alignment: .center, spacing: 4) {
            Text("اليوم")
                .font(GWFont.plex(13, .semibold))
                .foregroundStyle(GWBrand.ivory.opacity(0.92))
            Spacer(minLength: 4)
            GWCheetah(onDark: true, height: 11)
        }
    }

    private var count: some View {
        HStack(alignment: .firstTextBaseline, spacing: 5) {
            Text(GWFmt.count(summary.todayOrders))
                .font(GWFont.number(34, .bold))
                .foregroundStyle(GWBrand.ivory)
            Text(summary.todayOrders == 1 ? "طلب" : "طلبات")
                .font(GWFont.plex(12, .medium))
                .foregroundStyle(GWBrand.ivory.opacity(0.65))
        }
    }

    private var collect: some View {
        VStack(spacing: 5) {
            Rectangle().fill(GWBrand.gold.opacity(0.4)).frame(height: 0.5)
            HStack(spacing: 4) {
                Text("للتحصيل")
                    .font(GWFont.plex(10.5))
                    .foregroundStyle(GWBrand.gold.opacity(0.85))
                Spacer(minLength: 2)
                Text(GWFmt.money(summary.toCollect))
                    .font(GWFont.plex(11.5, .semibold))
                    .foregroundStyle(GWBrand.gold)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
            }
        }
    }
}

/// The medium widget's other half: the month, collected today, to collect.
struct GWTodaySide: View {
    let summary: GWSummary

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            GWCaps("GH SHOPPER", color: GWBrand.gold.opacity(0.8))
            Spacer(minLength: 4)
            line("مبيعات الشهر", GWFmt.compactMoney(summary.monthSales), big: true)
            Spacer(minLength: 6)
            line("محصّل اليوم", GWFmt.money(summary.todayCollected), big: false)
            Spacer(minLength: 6)
            line("للتحصيل", GWFmt.money(summary.toCollect), big: false)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func line(_ label: String, _ value: String, big: Bool) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(label)
                .font(GWFont.plex(10))
                .foregroundStyle(GWBrand.ivory.opacity(0.6))
            Text(value)
                .font(GWFont.plex(big ? 17 : 13, .semibold))
                .foregroundStyle(big ? GWBrand.gold : GWBrand.ivory)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
        }
    }
}

// MARK: - يحتاج انتباهك (medium, large) on paper

struct GWAttentionItem {
    let icon: String
    let title: String
    let short: String
    let subtitle: String
    let count: Int
    let color: Color
    let url: URL

    static func all(_ s: GWSummary) -> [GWAttentionItem] {
        [
            GWAttentionItem(icon: "sparkles", title: "طلبات قطع جديدة", short: "طلبات قطع",
                            subtitle: "عملاء يدوّرون على قطعة", count: s.requestsNew, color: GWBrand.blue, url: GWLink.requests),
            GWAttentionItem(icon: "bubble.left.and.bubble.right.fill", title: "محادثات غير مقروءة", short: "محادثات",
                            subtitle: "رسائل من العملاء", count: s.chatsUnread, color: GWBrand.purple, url: GWLink.chats),
            GWAttentionItem(icon: "exclamationmark.triangle.fill", title: "ما تسلّمت", short: "ما تسلّمت",
                            subtitle: "المندوب ما قدر يسلّم", count: s.failedDeliveries, color: GWBrand.red, url: GWLink.today),
            GWAttentionItem(icon: "banknote.fill", title: "كاش ينتظر تأكيدك", short: "كاش المناديب",
                            subtitle: "تسليمات من المناديب", count: s.handoversPending, color: GWBrand.amber, url: GWLink.drivers),
            GWAttentionItem(icon: "creditcard.fill", title: "عليهم مبالغ", short: "عليهم مبالغ",
                            subtitle: GWFmt.money(s.toCollect) + " عند العملاء", count: s.unpaidOrders,
                            color: GWBrand.burgundy, url: GWLink.orders),
        ]
    }
}

/// Header of the paper widgets: Arabic title + Latin caps.
struct GWPaperHeader: View {
    let title: String
    let caps: String
    @Environment(\.colorScheme) var scheme

    var body: some View {
        let p = GWPalette(scheme)
        HStack(alignment: .center, spacing: 6) {
            Text(title)
                .font(GWFont.plex(13.5, .semibold))
                .foregroundStyle(p.accent)
                .lineLimit(1)
            Spacer(minLength: 6)
            GWCaps(caps, color: p.gold)
        }
    }
}

/// Nothing pending: a quiet "all good".
struct GWAllClear: View {
    let title: String
    let message: String
    @Environment(\.colorScheme) var scheme

    var body: some View {
        let p = GWPalette(scheme)
        VStack(spacing: 6) {
            Spacer(minLength: 0)
            GWCheetah(onDark: p.dark, height: 18, opacity: 0.85)
            Text(title)
                .font(GWFont.plex(14, .semibold))
                .foregroundStyle(p.ink)
            Text(message)
                .font(GWFont.plex(10.5))
                .foregroundStyle(p.muted)
                .multilineTextAlignment(.center)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct GWAttentionMedium: View {
    let state: GWState
    @Environment(\.colorScheme) var scheme

    var body: some View {
        GWStaffGate(state: state, onDark: false) { s in
            if s.attentionTotal == 0 {
                GWAllClear(title: "كل شي تمام", message: "ما في شي ينتظرك الحين")
            } else {
                content(s)
            }
        }
        .widgetURL(GWLink.today)
    }

    private func content(_ s: GWSummary) -> some View {
        let items = GWAttentionItem.all(s)
        return VStack(alignment: .leading, spacing: 8) {
            GWPaperHeader(title: "يحتاج انتباهك", caps: "GH SHOPPER")
            VStack(alignment: .leading, spacing: 7) {
                ForEach(0..<((items.count + 1) / 2), id: \.self) { r in
                    gridRow(items, r)
                }
            }
            Spacer(minLength: 0)
        }
    }

    private func gridRow(_ items: [GWAttentionItem], _ r: Int) -> some View {
        HStack(spacing: 12) {
            Link(destination: items[r * 2].url) { cell(items[r * 2]) }
                .frame(maxWidth: .infinity)
            if r * 2 + 1 < items.count {
                Link(destination: items[r * 2 + 1].url) { cell(items[r * 2 + 1]) }
                    .frame(maxWidth: .infinity)
            } else {
                Color.clear.frame(maxWidth: .infinity, maxHeight: 1)
            }
        }
    }

    private func cell(_ item: GWAttentionItem) -> some View {
        let p = GWPalette(scheme)
        let on = item.count > 0
        return HStack(spacing: 7) {
            ZStack {
                Circle().fill(item.color.opacity(on ? 0.14 : 0.06))
                Image(systemName: item.icon)
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(on ? item.color : p.faint)
            }
            .frame(width: 24, height: 24)
            Text(item.short)
                .font(GWFont.plex(11))
                .foregroundStyle(on ? p.ink : p.faint)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            Spacer(minLength: 2)
            Text(on ? GWFmt.count(item.count) : "—")
                .font(GWFont.number(14, .bold))
                .foregroundStyle(on ? p.accent : p.faint)
        }
    }
}

struct GWAttentionLarge: View {
    let state: GWState
    @Environment(\.colorScheme) var scheme

    var body: some View {
        GWStaffGate(state: state, onDark: false) { s in
            content(s)
        }
        .widgetURL(GWLink.today)
    }

    private func content(_ s: GWSummary) -> some View {
        let items = GWAttentionItem.all(s)
        let p = GWPalette(scheme)
        return VStack(alignment: .leading, spacing: 0) {
            GWPaperHeader(title: "يحتاج انتباهك", caps: "GH SHOPPER")
            Text(s.attentionTotal == 0 ? "كل شي تمام، ما في شي ينتظرك" : "\(GWFmt.count(s.attentionTotal)) أمور تنتظرك")
                .font(GWFont.plex(11))
                .foregroundStyle(p.muted)
                .padding(.top, 1)
            Spacer(minLength: 8)
            ForEach(0..<items.count, id: \.self) { i in
                if i > 0 {
                    Rectangle().fill(p.hairline).frame(height: 0.5).padding(.leading, 44)
                }
                Link(destination: items[i].url) { row(items[i]) }
            }
            Spacer(minLength: 8)
            footer(s)
        }
    }

    private func row(_ item: GWAttentionItem) -> some View {
        let p = GWPalette(scheme)
        let on = item.count > 0
        return HStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 9, style: .continuous).fill(item.color.opacity(on ? 0.13 : 0.05))
                Image(systemName: item.icon)
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(on ? item.color : p.faint)
            }
            .frame(width: 32, height: 32)
            VStack(alignment: .leading, spacing: 0) {
                Text(item.title)
                    .font(GWFont.plex(13.5, .semibold))
                    .foregroundStyle(on ? p.ink : p.faint)
                    .lineLimit(1)
                Text(item.subtitle)
                    .font(GWFont.plex(10.5))
                    .foregroundStyle(p.muted.opacity(on ? 1 : 0.6))
                    .lineLimit(1)
            }
            Spacer(minLength: 6)
            countBadge(item.count, color: item.color)
        }
        .padding(.vertical, 6)
    }

    @ViewBuilder
    private func countBadge(_ n: Int, color: Color) -> some View {
        let p = GWPalette(scheme)
        if n > 0 {
            Text(GWFmt.count(n))
                .font(GWFont.number(13, .bold))
                .foregroundStyle(p.accent)
                .padding(.horizontal, 9)
                .padding(.vertical, 2)
                .background(Capsule().fill(p.accent.opacity(0.09)))
        } else {
            Image(systemName: "checkmark")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(p.faint)
        }
    }

    private func footer(_ s: GWSummary) -> some View {
        let p = GWPalette(scheme)
        return HStack(spacing: 6) {
            GWCheetah(onDark: p.dark, height: 10, opacity: 0.8)
            Spacer(minLength: 4)
            (Text("آخر تحديث ") + Text(s.updatedAt, style: .time))
                .font(GWFont.plex(9.5))
                .foregroundStyle(p.faint)
        }
    }
}

// MARK: - الشهر (small) on paper

struct GWMonthSmall: View {
    let state: GWState
    @Environment(\.colorScheme) var scheme

    private static let monthName: String = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "MMMM"
        return f.string(from: Date())
    }()

    var body: some View {
        GWStaffGate(state: state, onDark: false) { s in
            content(s)
        }
        .widgetURL(GWLink.today)
    }

    private func content(_ s: GWSummary) -> some View {
        let p = GWPalette(scheme)
        return VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 4) {
                Text("الشهر")
                    .font(GWFont.plex(13, .semibold))
                    .foregroundStyle(p.accent)
                Spacer(minLength: 4)
                GWCaps(GWMonthSmall.monthName, color: p.gold, size: 8)
            }
            Spacer(minLength: 2)
            Text(GWFmt.amount(s.monthSales))
                .font(GWFont.number(28, .bold))
                .foregroundStyle(p.ink)
                .lineLimit(1)
                .minimumScaleFactor(0.5)
            Text("ر.ع مبيعات · \(GWFmt.count(s.monthOrders)) طلب")
                .font(GWFont.plex(10))
                .foregroundStyle(p.muted)
                .lineLimit(1)
            Spacer(minLength: 4)
            progress(s)
            profit(s)
        }
    }

    @ViewBuilder
    private func progress(_ s: GWSummary) -> some View {
        let p = GWPalette(scheme)
        if s.lastMonthSales > 0 {
            let ratio = s.monthSales / s.lastMonthSales
            VStack(alignment: .leading, spacing: 3) {
                GWProgressLine(value: ratio, track: p.track, fill: p.gold, height: 3)
                Text("\(GWFmt.percent(ratio)) من الشهر الماضي")
                    .font(GWFont.plex(9))
                    .foregroundStyle(p.faint)
                    .lineLimit(1)
            }
            .padding(.bottom, 6)
        }
    }

    private func profit(_ s: GWSummary) -> some View {
        let p = GWPalette(scheme)
        return HStack(spacing: 4) {
            Text("ربح تقريبي")
                .font(GWFont.plex(10))
                .foregroundStyle(p.muted)
            Spacer(minLength: 2)
            Text(GWFmt.money(s.monthProfit))
                .font(GWFont.plex(11.5, .semibold))
                .foregroundStyle(s.monthProfit < 0 ? GWBrand.red : p.gold)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
        }
    }
}

// MARK: - رحلة الشراء (medium, large) on paper

struct GWTripMedium: View {
    let state: GWState
    @Environment(\.colorScheme) var scheme

    var body: some View {
        GWStaffGate(state: state, onDark: false) { s in
            if let t = s.trip {
                content(t).widgetURL(GWLink.trip(t.id))
            } else {
                GWAllClear(title: "ما في رحلة شراء", message: "كل القطع انشرت 👌").widgetURL(GWLink.trips)
            }
        }
    }

    private func content(_ t: GWTrip) -> some View {
        let p = GWPalette(scheme)
        return HStack(alignment: .top, spacing: 14) {
            GWTripSummaryBlock(trip: t)
                .frame(width: 128)
            Rectangle().fill(p.hairline).frame(width: 0.5)
            GWShopList(shops: t.shops, max: 4, rowSpacing: 5, fontSize: 12)
        }
    }
}

struct GWTripLarge: View {
    let state: GWState
    @Environment(\.colorScheme) var scheme

    var body: some View {
        GWStaffGate(state: state, onDark: false) { s in
            if let t = s.trip {
                content(t).widgetURL(GWLink.trip(t.id))
            } else {
                GWAllClear(title: "ما في رحلة شراء", message: "كل القطع انشرت 👌").widgetURL(GWLink.trips)
            }
        }
    }

    private func content(_ t: GWTrip) -> some View {
        let p = GWPalette(scheme)
        return VStack(alignment: .leading, spacing: 0) {
            GWTripSummaryBlock(trip: t)
                .frame(height: 118)
            Rectangle().fill(p.hairline).frame(height: 0.5).padding(.vertical, 10)
            Text("قائمة التسوّق")
                .font(GWFont.plex(11, .medium))
                .foregroundStyle(p.muted)
                .padding(.bottom, 6)
            GWShopList(shops: t.shops, max: 7, rowSpacing: 8, fontSize: 13.5)
            Spacer(minLength: 0)
        }
    }
}

/// Trip name, pieces left and the progress line.
struct GWTripSummaryBlock: View {
    let trip: GWTrip
    @Environment(\.colorScheme) var scheme

    var body: some View {
        let p = GWPalette(scheme)
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 5) {
                Image(systemName: "airplane")
                    .font(.system(size: 10, weight: .semibold))
                    .foregroundStyle(p.gold)
                GWCaps("SHOPPING TRIP", color: p.gold, size: 7.5)
            }
            Text(trip.name)
                .font(GWFont.plex(15, .semibold))
                .foregroundStyle(p.ink)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
                .padding(.top, 3)
            Spacer(minLength: 2)
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(GWFmt.count(trip.itemsLeft))
                    .font(GWFont.number(30, .bold))
                    .foregroundStyle(p.accent)
                Text(trip.itemsLeft == 1 ? "قطعة باقية" : "قطع باقية")
                    .font(GWFont.plex(11))
                    .foregroundStyle(p.muted)
            }
            GWProgressLine(value: trip.progress, track: p.track, fill: p.gold, height: 3)
                .padding(.top, 2)
            Text("\(GWFmt.count(trip.itemsTotal - trip.itemsLeft)) من \(GWFmt.count(trip.itemsTotal)) انشرت")
                .font(GWFont.plex(9.5))
                .foregroundStyle(p.faint)
                .padding(.top, 4)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// The shops still on the list, with how many pieces at each.
struct GWShopList: View {
    let shops: [GWShop]
    let max: Int
    let rowSpacing: CGFloat
    let fontSize: CGFloat
    @Environment(\.colorScheme) var scheme

    var body: some View {
        let p = GWPalette(scheme)
        let shown = Array(shops.prefix(max))
        let more = shops.count - shown.count
        VStack(alignment: .leading, spacing: rowSpacing) {
            ForEach(0..<shown.count, id: \.self) { i in
                row(shown[i], first: i == 0)
            }
            if more > 0 {
                Text("+ \(GWFmt.count(more)) \(more == 1 ? "محل" : "محلات") بعد")
                    .font(GWFont.plex(fontSize - 2))
                    .foregroundStyle(p.faint)
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func row(_ shop: GWShop, first: Bool) -> some View {
        let p = GWPalette(scheme)
        return HStack(spacing: 7) {
            Circle()
                .fill(first ? p.gold : p.hairline)
                .frame(width: 5, height: 5)
            Text(shop.name)
                .font(GWFont.plex(fontSize, first ? .semibold : .regular))
                .foregroundStyle(p.ink)
                .lineLimit(1)
            Spacer(minLength: 4)
            Text(GWFmt.count(shop.count))
                .font(GWFont.number(fontSize - 1, .semibold))
                .foregroundStyle(first ? p.accent : p.muted)
                .padding(.horizontal, 7)
                .padding(.vertical, 1)
                .background(Capsule().fill(first ? p.accent.opacity(0.09) : p.track))
        }
    }
}

// MARK: - آخر الطلبات (large) on paper

struct GWLatestLarge: View {
    let state: GWState
    @Environment(\.colorScheme) var scheme

    var body: some View {
        GWStaffGate(state: state, onDark: false) { s in
            content(s)
        }
        .widgetURL(GWLink.orders)
    }

    private func content(_ s: GWSummary) -> some View {
        let p = GWPalette(scheme)
        let rows = Array(s.latest.prefix(5))
        return VStack(alignment: .leading, spacing: 0) {
            GWPaperHeader(title: "آخر الطلبات", caps: "LATEST ORDERS")
            Text("اليوم \(GWFmt.orders(s.todayOrders)) · \(GWFmt.money(s.todaySales))")
                .font(GWFont.plex(11))
                .foregroundStyle(p.muted)
                .padding(.top, 1)
            Spacer(minLength: 8)
            if rows.isEmpty {
                GWAllClear(title: "ما في طلبات بعد", message: "أول طلب بيطلع هنا")
            } else {
                ForEach(0..<rows.count, id: \.self) { i in
                    if i > 0 {
                        Rectangle().fill(p.hairline).frame(height: 0.5).padding(.leading, 42)
                    }
                    Link(destination: GWLink.order(rows[i].id)) { row(rows[i]) }
                }
            }
            Spacer(minLength: 0)
        }
    }

    private func row(_ o: GWOrderLine) -> some View {
        let p = GWPalette(scheme)
        let color = GWBrand.status(o.status)
        let initial = String(o.customer.trimmingCharacters(in: .whitespaces).prefix(1))
        return HStack(spacing: 10) {
            ZStack {
                Circle().fill(p.accent.opacity(0.08))
                Text(initial)
                    .font(GWFont.plex(13, .semibold))
                    .foregroundStyle(p.accent)
            }
            .frame(width: 32, height: 32)
            VStack(alignment: .leading, spacing: 0) {
                Text(o.customer)
                    .font(GWFont.plex(13, .semibold))
                    .foregroundStyle(p.ink)
                    .lineLimit(1)
                HStack(spacing: 4) {
                    Circle().fill(color).frame(width: 5, height: 5)
                    Text(o.statusLabel)
                        .font(GWFont.plex(10))
                        .foregroundStyle(p.muted)
                        .lineLimit(1)
                    Text(verbatim: "· \(o.invoiceNo)")
                        .font(GWFont.plex(10))
                        .foregroundStyle(p.faint)
                        .lineLimit(1)
                }
            }
            Spacer(minLength: 6)
            Text(GWFmt.money(o.total))
                .font(GWFont.number(13, .semibold))
                .foregroundStyle(p.ink)
                .lineLimit(1)
        }
        .padding(.vertical, 6)
    }
}

// MARK: - lock screen (staff)

/// Circle: unread chats (or new piece requests) with a ring.
struct GWLockCircular: View {
    let state: GWState

    var body: some View {
        if let s = state.summary, state.session != nil, state.session?.isDriver != true {
            ring(s)
        } else {
            Image(systemName: "bag")
                .font(.system(size: 18, weight: .medium))
        }
    }

    private func ring(_ s: GWSummary) -> some View {
        let chats = s.chatsUnread > 0 || s.requestsNew == 0
        let n = chats ? s.chatsUnread : s.requestsNew
        return Gauge(value: Double(min(n, 10)), in: 0...10) {
            Image(systemName: chats ? "bubble.left.fill" : "sparkles")
        } currentValueLabel: {
            VStack(spacing: -2) {
                Image(systemName: chats ? "bubble.left.fill" : "sparkles")
                    .font(.system(size: 9, weight: .semibold))
                Text(GWFmt.count(n))
                    .font(GWFont.number(15, .bold))
            }
        }
        .gaugeStyle(.accessoryCircular)
        .widgetURL(chats ? GWLink.chats : GWLink.requests)
    }
}

/// Rectangle: today's orders and sales.
struct GWLockRect: View {
    let state: GWState

    var body: some View {
        if let s = state.summary, state.session != nil, state.session?.isDriver != true {
            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 4) {
                    Image(systemName: "sun.max.fill").font(.system(size: 10, weight: .semibold))
                    Text("اليوم").font(GWFont.plex(11.5, .semibold))
                    Spacer(minLength: 0)
                }
                .opacity(0.8)
                Text(GWFmt.orders(s.todayOrders))
                    .font(GWFont.plex(16, .bold))
                    .lineLimit(1)
                Text("\(GWFmt.money(s.todaySales)) مبيعات")
                    .font(GWFont.plex(11.5))
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .widgetURL(GWLink.today)
        } else {
            GWLockMessage(state: state, staff: true)
        }
    }
}

/// Inline (above the clock): "٣ طلبات · ١٬٢٤٠ ر.ع".
struct GWLockInline: View {
    let state: GWState

    var body: some View {
        if let s = state.summary, state.session != nil, state.session?.isDriver != true {
            Text(s.todayOrders == 0 ? "ما في طلبات اليوم" : "\(GWFmt.orders(s.todayOrders)) · \(GWFmt.money(s.todaySales))")
                .widgetURL(GWLink.today)
        } else if state.session == nil {
            Text("GH Shopper · سجّل دخول")
        } else {
            Text("GH Shopper")
        }
    }
}

/// Lock screen text when the widget does not fit the account.
struct GWLockMessage: View {
    let state: GWState
    let staff: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text("GH Shopper").font(GWFont.plex(12, .semibold)).opacity(0.8)
            Text(text).font(GWFont.plex(13, .medium)).lineLimit(2)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var text: String {
        if state.session == nil { return "سجّل دخول" }
        if staff { return state.session?.isDriver == true ? "للفريق فقط" : "افتح التطبيق" }
        return state.session?.isDriver == true ? "افتح التطبيق" : "للمناديب فقط"
    }
}

// MARK: - توصيلاتي (driver: small, medium, lock screen) on night

struct GWDriverSmall: View {
    let state: GWState

    var body: some View {
        GWDriverGate(state: state, onDark: true) { d in
            content(d)
        }
        .widgetURL(GWLink.driver)
    }

    private func content(_ d: GWDriverSummary) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            GWDriverHeader()
            Spacer(minLength: 2)
            GWDriverCount(driver: d)
            if let n = d.next {
                Text("التالي: \(n.name)")
                    .font(GWFont.plex(11, .medium))
                    .foregroundStyle(GWBrand.ivory)
                    .lineLimit(1)
                Text(n.area)
                    .font(GWFont.plex(10))
                    .foregroundStyle(GWBrand.ivory.opacity(0.55))
                    .lineLimit(1)
            }
            Spacer(minLength: 4)
            GWDriverCashRow(cash: d.cash)
        }
    }
}

struct GWDriverMedium: View {
    let state: GWState

    var body: some View {
        GWDriverGate(state: state, onDark: true) { d in
            content(d)
        }
        .widgetURL(GWLink.driver)
    }

    private func content(_ d: GWDriverSummary) -> some View {
        HStack(alignment: .top, spacing: 14) {
            VStack(alignment: .leading, spacing: 0) {
                GWDriverHeader()
                Spacer(minLength: 2)
                GWDriverCount(driver: d)
                Text("في الطريق \(GWFmt.count(d.onTheWay)) · سلّمت اليوم \(GWFmt.count(d.deliveredToday))")
                    .font(GWFont.plex(9.5))
                    .foregroundStyle(GWBrand.ivory.opacity(0.6))
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
                Spacer(minLength: 4)
                GWDriverCashRow(cash: d.cash)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            nextCard(d)
                .frame(maxWidth: .infinity)
        }
    }

    @ViewBuilder
    private func nextCard(_ d: GWDriverSummary) -> some View {
        if let n = d.next {
            Link(destination: GWLink.driverOrder(n.id)) { GWDriverNextCard(stop: n) }
        } else {
            VStack(spacing: 6) {
                Spacer(minLength: 0)
                Image(systemName: "checkmark.seal.fill")
                    .font(.system(size: 20))
                    .foregroundStyle(GWBrand.gold)
                Text("خلّصت توصيلات اليوم")
                    .font(GWFont.plex(11.5, .medium))
                    .foregroundStyle(GWBrand.ivory)
                    .multilineTextAlignment(.center)
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}

struct GWDriverHeader: View {
    var body: some View {
        HStack(spacing: 4) {
            Text("توصيلاتي")
                .font(GWFont.plex(13, .semibold))
                .foregroundStyle(GWBrand.ivory.opacity(0.92))
            Spacer(minLength: 4)
            Image(systemName: "car.fill")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(GWBrand.gold)
        }
    }
}

struct GWDriverCount: View {
    let driver: GWDriverSummary

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 5) {
            Text(GWFmt.count(driver.left))
                .font(GWFont.number(32, .bold))
                .foregroundStyle(GWBrand.ivory)
            Text(driver.left == 0 ? "ما في باقي" : "باقية")
                .font(GWFont.plex(12, .medium))
                .foregroundStyle(GWBrand.ivory.opacity(0.65))
        }
    }
}

struct GWDriverCashRow: View {
    let cash: Double

    var body: some View {
        VStack(spacing: 5) {
            Rectangle().fill(GWBrand.gold.opacity(0.35)).frame(height: 0.5)
            HStack(spacing: 4) {
                Text("كاش معك")
                    .font(GWFont.plex(10.5))
                    .foregroundStyle(GWBrand.gold.opacity(0.85))
                Spacer(minLength: 2)
                Text(GWFmt.money(cash))
                    .font(GWFont.plex(11.5, .semibold))
                    .foregroundStyle(GWBrand.gold)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
            }
        }
    }
}

/// The next delivery, as a soft card.
struct GWDriverNextCard: View {
    let stop: GWDriverStop

    private var statusText: String {
        switch stop.status {
        case "picked": return "في الطريق"
        case "failed": return "محاولة ثانية"
        default: return "جديد"
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack(spacing: 4) {
                GWCaps("NEXT", color: GWBrand.gold.opacity(0.85), size: 7.5)
                Spacer(minLength: 2)
                Text(statusText)
                    .font(GWFont.plex(9.5, .medium))
                    .foregroundStyle(GWBrand.ivory.opacity(0.7))
            }
            Text(stop.name)
                .font(GWFont.plex(14, .semibold))
                .foregroundStyle(GWBrand.ivory)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            HStack(spacing: 3) {
                Image(systemName: "mappin")
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundStyle(GWBrand.gold)
                Text(stop.area)
                    .font(GWFont.plex(10.5))
                    .foregroundStyle(GWBrand.ivory.opacity(0.65))
                    .lineLimit(1)
            }
            Spacer(minLength: 2)
            GWAmountTag(amount: stop.collect, size: 12)
        }
        .padding(10)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(GWBrand.ivory.opacity(0.07)))
        .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(GWBrand.gold.opacity(0.25), lineWidth: 0.5))
    }
}

/// "حصّل ٤٥٫٥ ر.ع" in gold, or a "مدفوع" pill.
struct GWAmountTag: View {
    let amount: Double
    var size: CGFloat = 12

    var body: some View {
        if amount > 0 {
            HStack(spacing: 3) {
                Text("حصّل")
                    .font(GWFont.plex(size - 2))
                    .foregroundStyle(GWBrand.gold.opacity(0.8))
                Text(GWFmt.money(amount))
                    .font(GWFont.plex(size, .bold))
                    .foregroundStyle(GWBrand.gold)
                    .lineLimit(1)
                    .minimumScaleFactor(0.7)
            }
        } else {
            Text("مدفوع")
                .font(GWFont.plex(size - 1.5, .semibold))
                .foregroundStyle(GWBrand.maroon)
                .padding(.horizontal, 8)
                .padding(.vertical, 1)
                .background(Capsule().fill(GWBrand.gold))
        }
    }
}

/// Lock screen rectangle for drivers.
struct GWDriverLockRect: View {
    let state: GWState

    var body: some View {
        if let d = state.driver, state.session?.isDriver == true {
            VStack(alignment: .leading, spacing: 0) {
                HStack(spacing: 4) {
                    Image(systemName: "car.fill").font(.system(size: 10, weight: .semibold))
                    Text(d.left == 0 ? "خلّصت اليوم" : "\(GWFmt.count(d.left)) توصيلات باقية")
                        .font(GWFont.plex(13, .bold))
                        .lineLimit(1)
                }
                Text("كاش معك \(GWFmt.money(d.cash))")
                    .font(GWFont.plex(11.5))
                    .lineLimit(1)
                if let n = d.next {
                    Text("التالي: \(n.name) · \(n.area)")
                        .font(GWFont.plex(11))
                        .lineLimit(1)
                        .opacity(0.8)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .widgetURL(GWLink.driver)
        } else {
            GWLockMessage(state: state, staff: false)
        }
    }
}
