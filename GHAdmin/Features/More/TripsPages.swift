import SwiftUI

// Port of lib/pages/trips_page.dart

// MARK: - pickTrip

/// Lets the user choose a trip. Returns the trip id, "" for "no trip", or
/// nil when cancelled.
@MainActor
func pickTrip(current: String? = nil) async -> String? {
    let trips = Store.shared.trips
    var actions: [SheetAction<String>] = trips.map { t in
        SheetAction(t.id == current ? "✓ \(t.name)" : t.name, t.id)
    }
    actions.append(SheetAction("بدون رحلة", ""))
    actions.append(SheetAction("＋ رحلة جديدة", "__new"))
    let v: String? = await pickAction(title: "الرحلة", actions: actions)
    if v == "__new" {
        let id: String? = await Nav.shared.presentForResult { (done: @escaping (String?) -> Void) in
            TripFormPage(done: done)
        }
        return id
    }
    return v
}

// MARK: - Stats

fileprivate struct TripStats {
    let orders: [Order]
    let expenses: [TripExpense]
    let sales: Double
    let cost: Double
    let spent: Double
    let toBuy: Int

    var profit: Double { sales - cost - spent }

    @MainActor
    init(_ t: Trip) {
        let store = Store.shared
        let os = store.ordersOfTrip(t.id)
        let ex = store.expensesOf(t.id)
        orders = os
        expenses = ex
        sales = os.reduce(0) { $0 + $1.netSales }
        cost = os.reduce(0) { $0 + $1.costOmr }
        spent = ex.reduce(0) { $0 + $1.omr }
        var n = 0
        for o in os {
            for i in o.activeItems where i.status == .requested { n += 1 }
        }
        toBuy = n
    }
}

// MARK: - Trips list

@MainActor
struct TripsPage: View {
    @ObservedObject private var store = Store.shared

    init() {}

    var body: some View {
        GHPage("الرحلات", onRefresh: { await store.refresh() }, trailing: {
            NavIcon("plus.circle.fill") { presentForm(TripFormPage()) }
        }) {
            if !store.ready {
                LoadingView()
            } else if store.trips.isEmpty {
                emptyView
            } else {
                GHSection {
                    ForEach(store.trips) { t in
                        TripListRow(trip: t)
                    }
                }
            }
        }
    }

    private var emptyView: some View {
        EmptyState(icon: "airplane", title: "ما في رحلات",
                   message: "سوّ رحلة (مثلاً «ميلان أكتوبر») واربط فيها الطلبات، وبتطلع لك قائمة تسوّق مرتبة حسب البراند وحساب ربح الرحلة.") {
            PrimaryButton("رحلة جديدة", icon: "plus") { presentForm(TripFormPage()) }
                .frame(width: 200)
        }
    }
}

@MainActor
fileprivate struct TripListRow: View {
    let trip: Trip

    var body: some View {
        let s = TripStats(trip)
        var parts: [String] = []
        if trip.startsOn != nil { parts.append(dateStr(trip.startsOn)) }
        parts.append("\(s.orders.count) طلب")
        if s.toBuy > 0 { parts.append("\(s.toBuy) قطعة للشراء") }
        let id = trip.id
        return Tile(trip.name, subtitle: parts.joined(separator: " · "),
                    action: { pushPage(TripDetailPage(tripId: id)) },
                    leading: { IconBox("airplane", color: GH.gold) })
    }
}

// MARK: - Trip detail

fileprivate enum TripView: Hashable { case shopping, orders, expenses }

@MainActor
struct TripDetailPage: View {
    let tripId: String
    @ObservedObject private var store = Store.shared
    @State private var tab: TripView = .shopping
    @Environment(\.dismiss) private var dismiss

    init(tripId: String) { self.tripId = tripId }

    var body: some View {
        if let t = store.trip(tripId) {
            page(t)
        } else {
            GHPage("الرحلة") {
                EmptyState(icon: "airplane", title: "غير موجودة")
            }
        }
    }

    private func page(_ t: Trip) -> some View {
        let s = TripStats(t)
        return GHPage(t.name, trailing: {
            NavIcon("ellipsis.circle") { Task { await menu(t) } }
        }, bottom: {
            PrimaryButton("طلب جديد في الرحلة", icon: "plus") {
                presentForm(OrderFormPage(tripId: t.id))
            }
        }) {
            TripStatGrid(stats: s)
            Pad(h: 6, top: 6) {
                Segments(value: $tab, options: [
                    (TripView.shopping, "قائمة التسوّق"),
                    (TripView.orders, "الطلبات"),
                    (TripView.expenses, "المصاريف"),
                ])
            }
            switch tab {
            case .shopping: TripShoppingList(stats: s)
            case .orders: TripOrdersList(stats: s)
            case .expenses: TripExpensesList(trip: t, stats: s)
            }
        }
    }

    private func menu(_ t: Trip) async {
        let a: String? = await pickAction(actions: [
            SheetAction("تعديل الرحلة", "edit"),
            SheetAction("حذف الرحلة", "delete", destructive: true),
        ])
        if a == "edit" {
            presentForm(TripFormPage(trip: t))
        } else if a == "delete" {
            if await confirm("حذف \(t.name)؟", message: "الطلبات تبقى، بس تنفك من الرحلة.") {
                let ok = await attempt { try await Store.shared.deleteTrip(t.id) }
                if ok { dismiss() }
            }
        }
    }
}

fileprivate struct TripStatGrid: View {
    let stats: TripStats

    var body: some View {
        VStack(spacing: 10) {
            HStack(spacing: 10) {
                StatCard(label: "المبيعات", value: omr(stats.sales), icon: "chart.bar.fill", hero: true)
                StatCard(label: "المشتريات", value: omr(stats.cost), icon: "bag.fill", color: GH.amber)
            }
            HStack(spacing: 10) {
                StatCard(label: "مصاريف الرحلة", value: omr(stats.spent), icon: "airplane", color: GH.blue)
                StatCard(label: "صافي الربح", value: omr(stats.profit), color: stats.profit < 0 ? GH.red : GH.green)
            }
        }
        .padding(.horizontal, 16).padding(.top, 4)
    }
}

// MARK: Shopping list

fileprivate struct ShopEntry: Identifiable {
    let order: Order
    let item: OrderItem
    var id: String { item.id }
}

fileprivate struct ShopGroup: Identifiable {
    let key: String
    var entries: [ShopEntry]
    var id: String { key }
}

@MainActor
fileprivate func estOmr(_ i: OrderItem) -> Double {
    guard let e = i.estimate else { return 0 }
    let r = (!e.fromList ? i.estRate : nil) ?? Rates.shared.rate(e.currency)
    return e.amount * r
}

@MainActor
fileprivate func tfOmr(_ i: OrderItem) -> Double {
    estOmr(i) * (i.planPlace?.taxFreePct ?? 0) / 100
}

fileprivate let noShopSuffix = "بدون محل"

@MainActor
fileprivate struct TripShoppingList: View {
    let stats: TripStats

    /// one stop per shop from the plan; pieces without a shop stay by brand
    private var groups: [ShopGroup] {
        var order: [String] = []
        var map: [String: [ShopEntry]] = [:]
        for o in stats.orders {
            for i in o.activeItems {
                if i.status != .requested { continue }
                let store = (i.planStore ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                let brand = (i.brand ?? "بدون براند").trimmingCharacters(in: .whitespacesAndNewlines)
                let key = store.isEmpty ? "\(brand) · \(noShopSuffix)" : store
                if map[key] == nil { order.append(key); map[key] = [] }
                map[key]?.append(ShopEntry(order: o, item: i))
            }
        }
        let keys = order.sorted { a, b in
            let na = a.hasSuffix(noShopSuffix)
            let nb = b.hasSuffix(noShopSuffix)
            if na != nb { return !na }
            return a < b
        }
        return keys.map { ShopGroup(key: $0, entries: map[$0] ?? []) }
    }

    var body: some View {
        let gs = groups
        if gs.isEmpty {
            EmptyState(icon: "checkmark.seal", title: "ما في شي باقي تشتريه",
                       message: "كل القطع في هذي الرحلة انشرت 👌")
        } else {
            ShoppingTotals(items: gs.flatMap { $0.entries.map(\.item) })
            ForEach(gs) { g in
                ShopGroupSection(group: g)
            }
        }
    }
}

@MainActor
fileprivate struct ShoppingTotals: View {
    let items: [OrderItem]

    var body: some View {
        let priced = items.filter { $0.estimate != nil }
        var curOrder: [String] = []
        var byCur: [String: Double] = [:]
        for i in priced {
            guard let e = i.estimate else { continue }
            if byCur[e.currency] == nil { curOrder.append(e.currency) }
            byCur[e.currency, default: 0] += e.amount
        }
        let total = priced.reduce(0) { $0 + estOmr($1) }
        let tf = priced.reduce(0) { $0 + tfOmr($1) }
        let sales = priced.reduce(0) { $0 + $1.price }
        let missing = items.count - priced.count
        let showCur = curOrder.count > 1 || (!curOrder.isEmpty && curOrder[0] != "OMR")
        let curText = curOrder.map { money(byCur[$0] ?? 0, $0) }.joined(separator: " + ")
        let footer = missing > 0
            ? "\(missing) قطعة بدون سعر تقريبي (ما داخلة في المجموع). اضغط عليها وحط وين وبكم."
            : "تقريبي بسعر صرف اليوم. السعر الفعلي يتأكد وقت الشراء."
        return GHSection("تقريباً بتدفع", footer: footer) {
            KV("المجموع", omr(total), strong: true)
            if showCur {
                KV("بالعملات", curText, color: GH.secondary)
            }
            KV("تاكس فري متوقع", "− \(omr(tf))", color: GH.green)
            KV("الصافي", omr(total - tf), strong: true)
            KV("بيعها للعملاء", omr(sales), color: GH.secondary)
            KV("ربح تقريبي", omr(sales - (total - tf)), color: GH.burgundy)
        }
    }
}

@MainActor
fileprivate struct ShopGroupSection: View {
    let group: ShopGroup

    var body: some View {
        let sub = group.entries.reduce(0) { $0 + estOmr($1.item) }
        let extra = sub > 0 ? " · ≈ \(omr(sub))" : ""
        return GHSection("\(group.key) · \(group.entries.count)\(extra)") {
            ForEach(group.entries) { e in
                ShopItemRow(entry: e)
            }
        }
    }
}

@MainActor
fileprivate struct ShopItemRow: View {
    let entry: ShopEntry

    private var subtitle: String {
        var parts: [String] = [Store.shared.customerName(entry.order)]
        if let d = entry.item.details { parts.append(d) }
        parts.append("للعميل \(omr(entry.item.price))")
        return parts.joined(separator: " · ")
    }

    var body: some View {
        let i = entry.item
        let title = i.planStore == nil ? i.name : i.title
        let value: String
        if let est = i.estimate { value = money(est.amount, est.currency) } else { value = "بدون سعر" }
        return Group {
            if let p = i.photoPath {
                Tile(title, subtitle: subtitle, value: value,
                     action: { Task { await tap(i) } },
                     leading: { Thumb(path: p, size: 40) })
            } else {
                Tile(title, subtitle: subtitle, value: value,
                     action: { Task { await tap(i) } })
            }
        }
    }

    private func tap(_ i: OrderItem) async {
        let a: String? = await pickAction(title: i.title, actions: [
            SheetAction("اشتريتها (أكّد السعر)", "buy"),
            SheetAction(i.hasPlan ? "تعديل وين وبكم" : "وين وبكم تقريباً", "plan"),
        ])
        guard let a else { return }
        if a == "buy" {
            presentForm(PurchasePage(item: i))
        } else {
            presentForm(PlanPage(item: i))
        }
    }
}

// MARK: Orders tab

@MainActor
fileprivate struct TripOrdersList: View {
    let stats: TripStats

    var body: some View {
        if stats.orders.isEmpty {
            EmptyState(icon: "doc.text", title: "ما في طلبات في الرحلة")
        } else {
            GHSection {
                ForEach(stats.orders) { o in
                    OrderRow(order: o, onTap: { pushPage(OrderDetailPage(orderId: o.id)) })
                }
            }
        }
    }
}

// MARK: Expenses tab

@MainActor
fileprivate struct TripExpensesList: View {
    let trip: Trip
    let stats: TripStats

    var body: some View {
        let tid = trip.id
        return GHSection(trailing: {
            HeaderButton("إضافة مصروف", icon: "plus") { presentForm(ExpenseFormPage(tripId: tid)) }
        }) {
            if stats.expenses.isEmpty {
                Tile("ما في مصاريف", subtitle: "الطيران، الفندق، المواصلات…")
            } else {
                ForEach(stats.expenses) { e in
                    TripExpenseRow(expense: e)
                }
            }
        }
    }
}

@MainActor
fileprivate struct TripExpenseRow: View {
    let expense: TripExpense

    var body: some View {
        let e = expense
        var parts: [String] = [dateStr(e.spentOn)]
        if e.currency != "OMR" { parts.append(money(e.amount, e.currency)) }
        return Tile(e.title, subtitle: parts.joined(separator: " · "), value: omr(e.omr), chevron: false,
                    action: {
                        Task {
                            if await confirm("حذف \(e.title)؟") {
                                await attempt { try await Store.shared.deleteExpense(e.id) }
                            }
                        }
                    })
    }
}

// MARK: - Trip form

/// Add or edit a trip. Returns the trip id.
@MainActor
struct TripFormPage: View {
    let trip: Trip?
    var done: ((String?) -> Void)?

    @State private var name: String
    @State private var dest: String
    @State private var notes: String
    @State private var start: Date?
    @State private var end: Date?
    @State private var saving = false
    @Environment(\.dismiss) private var dismiss

    init(trip: Trip? = nil, done: ((String?) -> Void)? = nil) {
        self.trip = trip
        self.done = done
        _name = State(initialValue: trip?.name ?? "")
        _dest = State(initialValue: trip?.destination ?? "")
        _notes = State(initialValue: trip?.notes ?? "")
        _start = State(initialValue: trip?.startsOn)
        _end = State(initialValue: trip?.endsOn)
    }

    var body: some View {
        GHPage(trip == nil ? "رحلة جديدة" : "تعديل الرحلة", trailing: {
            if saving {
                ProgressView()
            } else {
                NavButton("حفظ", bold: true) { Task { await save() } }
            }
        }, leading: {
            NavButton("إلغاء") { close(nil) }
        }) {
            GHSection {
                FieldRow("الاسم", text: $name, placeholder: "ميلان أكتوبر", autofocus: trip == nil)
                FieldRow("الوجهة", text: $dest, placeholder: "ميلان، باريس…")
                PickerRow("من", value: start == nil ? nil : dateStr(start)) {
                    Task {
                        if let d = await pickDate(start ?? Date()) { start = d }
                    }
                }
                PickerRow("إلى", value: end == nil ? nil : dateStr(end)) {
                    Task {
                        if let d = await pickDate(end ?? start ?? Date()) { end = d }
                    }
                }
            }
            GHSection("ملاحظات") {
                NotesRow(text: $notes, placeholder: "اختياري")
            }
        }
    }

    private func close(_ id: String?) {
        if let done { done(id) } else { dismiss() }
    }

    private func clean(_ s: String) -> String? {
        let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
        return t.isEmpty ? nil : t
    }

    private func save() async {
        let n = name.trimmingCharacters(in: .whitespacesAndNewlines)
        if n.isEmpty {
            toast("اكتب اسم الرحلة", error: true)
            return
        }
        saving = true
        do {
            let id = try await Store.shared.saveTrip(id: trip?.id, name: n, destination: clean(dest),
                                                     startsOn: start, endsOn: end, notes: clean(notes))
            close(id)
        } catch {
            saving = false
            toastError(error)
        }
    }
}

// MARK: - Expense form

@MainActor
struct ExpenseFormPage: View {
    /// nil: a general business expense.
    let tripId: String?

    @State private var title = ""
    @State private var amount = ""
    @State private var rate = "1"
    @State private var currency = "OMR"
    @State private var date = Date()
    @State private var saving = false
    @Environment(\.dismiss) private var dismiss

    private static let tripQuick = ["طيران", "فندق", "مواصلات", "أكل", "شحن"]
    private static let generalQuick = ["إعلانات", "تغليف", "شحن", "تصوير", "اشتراكات", "رواتب"]
    private var quick: [String] { tripId == nil ? ExpenseFormPage.generalQuick : ExpenseFormPage.tripQuick }

    init(tripId: String? = nil) { self.tripId = tripId }

    var body: some View {
        GHPage("مصروف جديد", trailing: {
            if saving {
                ProgressView()
            } else {
                NavButton("حفظ", bold: true) { Task { await save() } }
            }
        }, leading: {
            NavButton("إلغاء") { dismiss() }
        }) {
            ChipBar {
                ForEach(quick, id: \.self) { q in
                    ChipButton(q, selected: title == q) { title = q }
                }
            }
            .padding(.top, 8)
            fields
        }
    }

    private var fields: some View {
        GHSection {
            FieldRow("البند", text: $title, placeholder: tripId == nil ? "إعلانات" : "طيران")
            PickerRow("العملة", value: currency) { Task { await pickCurrency() } }
            AmountRow("المبلغ", text: $amount, suffix: currency)
            if currency != "OMR" {
                AmountRow("سعر الصرف", text: $rate, suffix: "ر.ع / \(currency)")
            }
            PickerRow("التاريخ", value: dateStr(date)) {
                Task {
                    if let d = await pickDate(date) { date = d }
                }
            }
        }
    }

    private func pickCurrency() async {
        let c: String? = await pickAction(actions: rateCurrencies.map { SheetAction($0, $0) })
        if let c {
            currency = c
            rate = c == "OMR" ? "1" : Rates.shared.rateText(c)
        }
    }

    private func save() async {
        let a = parseAmount(amount) ?? 0
        let r = parseAmount(rate) ?? 0
        let t = title.trimmingCharacters(in: .whitespacesAndNewlines)
        if t.isEmpty || a <= 0 || r <= 0 {
            toast("اكتب البند والمبلغ", error: true)
            return
        }
        saving = true
        do {
            try await Store.shared.addExpense(tripId: tripId, title: t, amount: a, currency: currency, rate: r, spentOn: date)
            dismiss()
        } catch {
            saving = false
            toastError(error)
        }
    }
}
