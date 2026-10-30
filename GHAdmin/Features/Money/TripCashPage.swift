import SwiftUI

// سيولة الرحلة: how much the trip's shopping will cost, how much of the
// customers' money you already hold for it, and the cash to bring for the gap.

// MARK: - Numbers

/// A piece still to buy on the trip, with what it should cost.
struct TripCashPiece: Identifiable {
    let order: Order
    let item: OrderItem
    let estimate: ItemEstimate?
    /// The estimate in OMR (nil when the piece has no estimate).
    let omr: Double?
    var id: String { item.id }
}

struct TripCashPlace: Identifiable {
    let key: String
    let label: String
    var omr: Double = 0
    var count = 0
    var missing = 0
    var id: String { key }
}

struct TripCashCurrency: Identifiable {
    let currency: String
    var amount: Double = 0
    var omr: Double = 0
    var id: String { currency }
}

struct TripCashSummary {
    var pieces: [TripCashPiece] = []
    /// Estimated cost of the pieces with an estimate, in OMR.
    var piecesOmr = 0.0
    /// Pieces still to buy with no estimate (not in the total).
    var missing = 0
    /// Trip expenses dated after today (still to pay).
    var plannedExpenses: [TripExpense] = []
    var plannedOmr = 0.0
    /// Trip expenses already paid (for information).
    var spentOmr = 0.0
    /// Customers' money held for the trip's open orders (paid − bought value, positive only).
    var have = 0.0
    var holdingOrders = 0
    /// What the open orders still owe.
    var collectAfter = 0.0
    var collectOrders = 0
    /// Tax-free expected back on the pieces, from the plan's place (not taken off the need).
    var taxFree = 0.0
    var places: [TripCashPlace] = []
    var currencies: [TripCashCurrency] = []

    var need: Double { piecesOmr + plannedOmr }
    var gap: Double { need - have }
    var covered: Bool { gap <= 0.0005 }

    /// The 10 most expensive pieces still to buy.
    var top: [TripCashPiece] {
        Array(pieces.filter { $0.omr != nil }.sorted { ($0.omr ?? 0) > ($1.omr ?? 0) }.prefix(10))
    }

    /// Cash to bring for the gap, shared over the currencies by their part of the need.
    var bring: [TripCashCurrency] {
        guard gap > 0.0005, need > 0.0005 else { return [] }
        return currencies.compactMap { c in
            guard c.omr > 0.0005, c.amount > 0.0005 else { return nil }
            let part = gap * c.omr / need
            let rate = c.omr / c.amount
            return TripCashCurrency(currency: c.currency, amount: part / rate, omr: part)
        }
    }
}

extension Store {
    /// The trip to show by default: the one going on now, else the next one, else the newest.
    var moneyDefaultCashTripId: String? {
        let now = Date()
        let today = Calendar.current.startOfDay(for: now)
        let current = trips.filter { t in
            guard let s = t.startsOn else { return false }
            return s <= now && (t.endsOn ?? s) >= today
        }
        if let c = current.max(by: { ($0.startsOn ?? .distantPast) < ($1.startsOn ?? .distantPast) }) { return c.id }
        let upcoming = trips.filter { ($0.startsOn ?? .distantPast) > now }
        if let u = upcoming.min(by: { ($0.startsOn ?? .distantFuture) < ($1.startsOn ?? .distantFuture) }) { return u.id }
        if let t = trips.first(where: { t in
            ordersOfTrip(t.id).contains { o in o.activeItems.contains { $0.status == .requested && !$0.instant } }
        }) { return t.id }
        return trips.first?.id
    }

    /// The same estimate the shopping list uses: the plan's own rate, else today's rate.
    func moneyEstimateOmr(_ i: OrderItem) -> Double? {
        guard let e = i.estimate else { return nil }
        let r = (!e.fromList ? i.estRate : nil) ?? Rates.shared.rate(e.currency)
        return e.amount * r
    }

    func moneyTripCash(_ tripId: String) -> TripCashSummary {
        var s = TripCashSummary()
        let os = ordersOfTrip(tripId)
        let placeOrder = ["europe", "dubai", "airport", "other", "unset"]
        let placeLabel = ["europe": "أوروبا (البوتيكات)", "dubai": "دبي", "airport": "المطار",
                          "other": "مكان ثاني", "unset": "ما تحدد المكان"]
        var places: [String: TripCashPlace] = [:]
        var curs: [String: TripCashCurrency] = [:]

        for o in os {
            for i in o.activeItems where i.status == .requested && !i.instant {
                let e = i.estimate
                let v = moneyEstimateOmr(i)
                s.pieces.append(TripCashPiece(order: o, item: i, estimate: e, omr: v))
                let key = TripCashPage.placeKey(i)
                var p = places[key] ?? TripCashPlace(key: key, label: placeLabel[key] ?? key)
                p.count += 1
                if let v, let e {
                    s.piecesOmr += v
                    p.omr += v
                    s.taxFree += v * (i.planPlace?.taxFreePct ?? 0) / 100
                    var c = curs[e.currency] ?? TripCashCurrency(currency: e.currency)
                    c.amount += e.amount
                    c.omr += v
                    curs[e.currency] = c
                } else {
                    s.missing += 1
                    p.missing += 1
                }
                places[key] = p
            }
        }

        // expenses dated after today are still to pay; the rest are paid already
        let cal = Calendar.current
        let tomorrow = cal.date(byAdding: .day, value: 1, to: cal.startOfDay(for: Date())) ?? Date()
        for e in expensesOf(tripId) {
            if let d = e.spentOn, d >= tomorrow {
                s.plannedExpenses.append(e)
                s.plannedOmr += e.omr
                var c = curs[e.currency] ?? TripCashCurrency(currency: e.currency)
                c.amount += e.amount
                c.omr += e.omr
                curs[e.currency] = c
            } else {
                s.spentOmr += e.omr
            }
        }

        for o in os where !o.allDelivered {
            let held = o.customerBalance
            if held > 0.0005 { s.have += held; s.holdingOrders += 1 }
            if o.remaining > 0.0005 { s.collectAfter += o.remaining; s.collectOrders += 1 }
        }

        s.places = placeOrder.compactMap { places[$0] }
        s.currencies = curs.values.sorted { $0.omr > $1.omr }
        return s
    }
}

// MARK: - Page

@MainActor
struct TripCashPage: View {
    @ObservedObject private var store = Store.shared
    @ObservedObject private var rates = Rates.shared
    @State private var tripId: String?

    init(tripId: String? = nil) { _tripId = State(initialValue: tripId) }

    /// europe / dubai / airport / other / unset: the plan's place, else guessed from the currency.
    static func placeKey(_ i: OrderItem) -> String {
        switch i.planPlace {
        case .boutiqueEu: return "europe"
        case .dubai: return "dubai"
        case .airport: return "airport"
        case .other: return "other"
        case nil:
            switch (i.estimate?.currency ?? "").uppercased() {
            case "AED": return "dubai"
            case "EUR", "GBP", "CHF": return "europe"
            default: return "unset"
            }
        }
    }

    private var shownId: String? {
        if let tripId, store.trip(tripId) != nil { return tripId }
        return store.moneyDefaultCashTripId
    }

    var body: some View {
        GHPage("سيولة الرحلة", onRefresh: { await store.refresh() }) {
            if !store.ready {
                LoadingView()
            } else if store.trips.isEmpty {
                EmptyState(icon: "airplane", title: "ما في رحلات",
                           message: "سوّ رحلة واربط فيها الطلبات، وبتشوف هنا كم تحتاج كاش للتسوّق.")
            } else if let id = shownId, let t = store.trip(id) {
                content(t)
            } else {
                EmptyState(icon: "airplane", title: "اختر رحلة")
            }
        }
    }

    // MARK: sections

    @ViewBuilder
    private func content(_ t: Trip) -> some View {
        let s = store.moneyTripCash(t.id)
        tripPicker(t)
        TripCashTopCards(summary: s)
        TripCashGapCard(summary: s)
        needSection(s)
        if !s.places.isEmpty { placesSection(s) }
        if !s.currencies.isEmpty { currencySection(s) }
        haveSection(s)
        topSection(s)
    }

    private func tripPicker(_ t: Trip) -> some View {
        var sub: [String] = []
        if t.startsOn != nil { sub.append(dateStr(t.startsOn)) }
        if let d = t.destination { sub.append(d) }
        return GHSection {
            Tile(t.name, subtitle: sub.isEmpty ? nil : sub.joined(separator: " · "), value: "غيّر",
                 valueColor: GH.burgundy, action: { Task { await chooseTrip(t.id) } },
                 leading: { IconBox("airplane", color: GH.gold) })
        }
    }

    private func needSection(_ s: TripCashSummary) -> some View {
        var footer = "تقريبي بسعر صرف اليوم، والسعر الفعلي يتأكد وقت الشراء."
        if s.missing > 0 { footer = "\(s.missing) قطعة بدون تقدير، ما دخلت في المجموع. حط لها وين وبكم من قائمة التسوّق. " + footer }
        return GHSection("تحتاج تدفع", footer: footer) {
            KV("القطع (\(s.pieces.count - s.missing))", omr(s.piecesOmr))
            if s.missing > 0 {
                KV("\(s.missing) قطعة بدون تقدير", "—", color: GH.amber)
            }
            if !s.plannedExpenses.isEmpty {
                KV("مصاريف الرحلة الجاية (\(s.plannedExpenses.count))", omr(s.plannedOmr))
            }
            KV("المجموع", omr(s.need), strong: true)
            if s.spentOmr > 0.0005 {
                KV("مصاريف دفعتها قبل", omr(s.spentOmr), color: GH.secondary)
            }
        }
    }

    private func placesSection(_ s: TripCashSummary) -> some View {
        GHSection("حسب المكان") {
            ForEach(s.places) { p in
                let extra = p.missing > 0 ? " · \(p.missing) بدون تقدير" : ""
                KV("\(p.label) · \(p.count) قطعة\(extra)", omr(p.omr))
            }
        }
    }

    private func currencySection(_ s: TripCashSummary) -> some View {
        GHSection("حسب العملة", footer: s.bring.isEmpty ? nil : "الكاش اللي تجيبه موزّع على العملات حسب نصيب كل عملة من المصروف.") {
            ForEach(s.currencies) { c in
                KV(c.currency, c.currency == "OMR" ? omr(c.amount) : "\(money(c.amount, c.currency)) · \(omr(c.omr))")
            }
            if !s.bring.isEmpty {
                ForEach(s.bring) { c in
                    KV("جيب كاش \(c.currency)", c.currency == "OMR" ? omr(c.amount) : money(c.amount, c.currency),
                       color: GH.red)
                }
            }
            ForEach(s.currencies.filter { $0.currency != "OMR" }) { c in
                KV("سعر \(c.currency)", "\(rates.rateText(c.currency)) ر.ع", color: GH.secondary)
            }
        }
    }

    private func haveSection(_ s: TripCashSummary) -> some View {
        GHSection("فلوس العملاء", footer: "العرابين اللي دفعوها لقطع ما انشرت للحين. وبعد ما توصل القطع تحصّل الباقي.") {
            KV("عندك من العملاء (\(s.holdingOrders) طلب)", omr(s.have), color: GH.green)
            KV("تتوقع تحصّل بعد الرحلة (\(s.collectOrders) طلب)", omr(s.collectAfter))
            if s.taxFree > 0.0005 {
                KV("تاكس فري يرجع لك تقريباً", omr(s.taxFree), color: GH.purple)
            }
        }
    }

    @ViewBuilder
    private func topSection(_ s: TripCashSummary) -> some View {
        let top = s.top
        if s.pieces.isEmpty {
            EmptyState(icon: "checkmark.seal", title: "ما في شي باقي تشتريه", message: "كل القطع في هذي الرحلة انشرت.")
        } else if !top.isEmpty {
            GHSection("أكبر القطع اللي باقي تشتريها", footer: "ابدأ باللي عربونها يغطيها، وخلّ اللي بدون عربون للأخير.") {
                ForEach(top) { p in
                    TripCashPieceRow(piece: p)
                }
            }
        }
    }

    private func chooseTrip(_ current: String) async {
        let acts = store.trips.map { t in
            SheetAction(t.id == current ? "\(t.name) (الحالية)" : t.name, t.id)
        }
        let v: String? = await pickAction(title: "الرحلة", actions: acts)
        if let v { tripId = v }
    }
}

// MARK: - Pieces

@MainActor
fileprivate struct TripCashPieceRow: View {
    let piece: TripCashPiece
    @ObservedObject private var store = Store.shared

    var body: some View {
        let o = piece.order
        let i = piece.item
        let held = max(0, o.customerBalance)
        let cost = piece.omr ?? 0
        let badge: (String, Color)
        if held + 0.0005 >= cost {
            badge = ("العربون يغطيها", GH.green)
        } else if o.paid > 0.0005 {
            badge = ("عربون جزئي", GH.amber)
        } else {
            badge = ("بدون عربون", GH.red)
        }
        let sub = "\(store.customerName(o)) · دفعت \(omr(o.paid)) من \(omr(o.total)) · ≈ \(omr(cost))"
        let value = piece.estimate.map { money($0.amount, $0.currency) } ?? omr(cost)
        let oid = o.id
        return Tile(i.title, subtitle: sub, value: value, valueColor: GH.label, valueFont: TS.money,
                    action: { pushPage(OrderDetailPage(orderId: oid)) },
                    leading: {
                        if let p = i.photoPath {
                            Thumb(path: p, size: 40)
                        } else {
                            IconBox("bag.fill", color: GH.gold, size: 40)
                        }
                    },
                    trailing: { Badge(badge.0, color: badge.1) })
    }
}

// MARK: - Cards

fileprivate struct TripCashTopCards: View {
    let summary: TripCashSummary

    var body: some View {
        HStack(spacing: 10) {
            StatCard(label: "تحتاج تدفع", value: omr(summary.need), icon: "bag.fill", hero: true)
            StatCard(label: "عندك من العملاء", value: omr(summary.have), icon: "banknote.fill", color: GH.green)
        }
        .padding(.horizontal, 16).padding(.top, 4)
    }
}

fileprivate struct TripCashGapCard: View {
    let summary: TripCashSummary

    var body: some View {
        let s = summary
        let color = s.covered ? GH.green : GH.red
        let title = s.covered ? "فلوس العملاء تغطي" : "تحتاج تجيب كاش"
        let bring = s.bring.map { $0.currency == "OMR" ? omr($0.amount) : money($0.amount, $0.currency) }
        let message: String
        if s.covered {
            message = s.need <= 0.0005
                ? "ما في شي محسوب تدفعه في هذي الرحلة."
                : "بيزيد عندك \(omr(-s.gap)) من العرابين بعد ما تشتري كل شي."
        } else if bring.isEmpty {
            message = "العرابين ما تكفي، الفرق \(omr(s.gap))."
        } else {
            message = "العرابين ما تكفي. جيب تقريباً: " + bring.joined(separator: " + ")
        }
        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 10) {
                Image(systemName: s.covered ? "checkmark.seal.fill" : "exclamationmark.triangle.fill")
                    .font(.system(size: 20)).foregroundStyle(color)
                Text(title).font(TS.title).foregroundStyle(GH.label)
                Spacer(minLength: 8)
                Text(omr(abs(s.gap))).font(.gh(20, .bold).monospacedDigit()).foregroundStyle(color)
                    .lineLimit(1).minimumScaleFactor(0.6)
            }
            Text(message).font(TS.sub).foregroundStyle(GH.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(color.opacity(0.1)))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(color.opacity(0.35), lineWidth: 1))
        .padding(.horizontal, 16).padding(.top, 12)
    }
}
