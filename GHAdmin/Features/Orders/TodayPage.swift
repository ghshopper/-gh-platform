import SwiftUI

/// An active item with its order.
fileprivate struct TodayItem: Identifiable {
    let order: Order
    let item: OrderItem
    var id: String { item.id }
}

/// A late order with the reason.
fileprivate struct TodayLate: Identifiable {
    let order: Order
    let text: String
    var id: String { order.id }
}

/// A driver on the road with what they carry.
fileprivate struct TodayDriver: Identifiable {
    let driverId: String
    let orders: [Order]
    var id: String { driverId }
}

/// Everything the page shows, worked out once per render.
fileprivate struct TodayData {
    var sales: Double = 0
    var owed: Double = 0
    var held: Double = 0
    var toBuy: [TodayItem] = []
    var toDeliver: [TodayItem] = []
    var outForDelivery: [TodayItem] = []
    var unpaid: [Order] = []
    var newRequests: [PieceRequest] = []
    var newOnline: [Order] = []
    var todayOrders = 0
    var todaySales: Double = 0
    var collectedToday: Double = 0
    var late: [TodayLate] = []
    var drivers: [TodayDriver] = []
    var taxFreeText = "—"
    var withDriversEmpty = true

    @MainActor
    init(_ store: Store) {
        let now = Date()
        let cal = Calendar.current
        let nowParts = cal.dateComponents([.year, .month], from: now)

        func isToday(_ d: Date?) -> Bool {
            guard let d else { return false }
            return cal.isDate(d, inSameDayAs: now)
        }

        func inThisMonth(_ d: Date?) -> Bool {
            guard let d else { return false }
            let p = cal.dateComponents([.year, .month], from: d)
            return p.year == nowParts.year && p.month == nowParts.month
        }

        let orders = store.orders
        sales = orders.filter { inThisMonth($0.createdAt) }.reduce(0) { $0 + $1.netSales }
        owed = orders.reduce(0) { $0 + ($1.remaining > 0 ? $1.remaining : 0) }
        held = orders.reduce(0) { $0 + ($1.customerBalance > 0 ? $1.customerBalance : 0) }

        let items = store.allItems.map { TodayItem(order: $0.order, item: $0.item) }
        toBuy = items.filter { $0.item.status == .requested }
        toDeliver = items.filter { $0.item.status == .arrived }
        outForDelivery = items.filter { $0.item.status == .outForDelivery }
        unpaid = orders.filter { $0.hasBalance }
        newRequests = store.requests.filter { $0.status == "pending" }
        // Online orders (app / website) not bought yet: new work to look at.
        newOnline = orders.filter { $0.fromStore && $0.overallStatus == .requested }

        // Today's numbers.
        let today = orders.filter { isToday($0.createdAt) }
        todayOrders = today.count
        todaySales = today.reduce(0) { $0 + $1.netSales }
        var collected: Double = 0
        for o in orders {
            for p in o.payments where isToday(p.paidOn) { collected += p.amount }
        }
        collectedToday = collected

        late = TodayData.lateOrders(orders, now: now)
        drivers = TodayData.byDriver(store.withDrivers)
        withDriversEmpty = store.withDrivers.isEmpty
        taxFreeText = TodayData.taxFree(orders)
    }

    private static func days(_ from: Date, _ to: Date) -> Int {
        Int(to.timeIntervalSince(from) / 86_400)
    }

    /// Late: open for more than two weeks, or arrived and waiting 3+ days.
    private static func lateOrders(_ orders: [Order], now: Date) -> [TodayLate] {
        var out: [TodayLate] = []
        for o in orders {
            let st = o.overallStatus
            if st == .delivered || o.activeItems.isEmpty { continue }
            let age = o.createdAt.map { days($0, now) } ?? 0
            if st == .arrived {
                var arrived: Date?
                for e in o.events where e.type == "arrived" && e.at != nil { arrived = e.at }
                let waited = arrived.map { days($0, now) } ?? 0
                if waited >= 3 { out.append(TodayLate(order: o, text: "وصلت من \(waited) أيام وما تسلّمت")) }
            } else if age >= 14 {
                out.append(TodayLate(order: o, text: "مفتوح من \(age) يوم · \(st.label)"))
            }
        }
        return out
    }

    /// Drivers on the road, in the order they first appear.
    private static func byDriver(_ orders: [Order]) -> [TodayDriver] {
        var keys: [String] = []
        var map: [String: [Order]] = [:]
        for o in orders {
            guard let d = o.driverId else { continue }
            if map[d] == nil { keys.append(d) }
            map[d, default: []].append(o)
        }
        return keys.map { TodayDriver(driverId: $0, orders: map[$0] ?? []) }
    }

    private static func taxFree(_ orders: [Order]) -> String {
        var keys: [String] = []
        var sums: [String: Double] = [:]
        for o in orders {
            let pending = o.taxFreePending
            for c in pending.keys.sorted() {
                if sums[c] == nil { keys.append(c) }
                sums[c, default: 0] += pending[c] ?? 0
            }
        }
        if keys.isEmpty { return "—" }
        return keys.map { money(sums[$0] ?? 0, $0) }.joined(separator: " + ")
    }

    var allClear: Bool {
        newRequests.isEmpty && newOnline.isEmpty && toBuy.isEmpty && toDeliver.isEmpty &&
            outForDelivery.isEmpty && unpaid.isEmpty && withDriversEmpty && late.isEmpty
    }
}

/// One cell of today's strip.
fileprivate struct TodayCell: Identifiable {
    let id: Int
    let icon: String
    let color: Color
    let label: String
    let value: String
    let action: (() -> Void)?
}

/// Today's three numbers in one card.
fileprivate struct TodayStrip: View {
    let cells: [TodayCell]

    var body: some View {
        HStack(spacing: 0) {
            ForEach(cells) { c in
                if c.id > 0 {
                    Rectangle().fill(GH.separator).frame(width: 0.5, height: 44)
                }
                cell(c)
            }
        }
        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(GH.card))
        .ghShadow()
    }

    private func cell(_ c: TodayCell) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 4) {
                Image(systemName: c.icon)
                    .font(.system(size: 13))
                    .foregroundStyle(c.color)
                Text(c.label)
                    .font(TS.small)
                    .foregroundStyle(GH.secondary)
                    .lineLimit(1)
            }
            Text(c.value)
                .font(.gh(19, .bold).monospacedDigit())
                .foregroundStyle(GH.label)
                .lineLimit(1)
                .minimumScaleFactor(0.5)
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
        .onTapGesture { c.action?() }
    }
}

/// What needs doing today: buy, deliver, collect.
struct TodayPage: View {
    @ObservedObject private var store = Store.shared

    init() {}

    var body: some View {
        GHPage("اليوم",
               onRefresh: { await Store.shared.refresh() },
               trailing: { NavIcon("plus.circle.fill") { newOrder() } },
               leading: { NavIcon("qrcode.viewfinder") { scan() } }) {
            header
            launcher
            quickActions
            chatsBanner
            main
        }
    }

    /// Unread customer chats (المحادثات), only when there are some.
    @ViewBuilder private var chatsBanner: some View {
        let unread = store.chatsUnread
        if unread > 0 {
            GHSection {
                Tile("المحادثات", subtitle: unread == 1 ? "رسالة جديدة من عميل" : "\(unread) رسائل جديدة من العملاء",
                     titleFont: .gh(16, .semibold),
                     action: { pushPage(ChatsPage()) },
                     leading: { IconBox("bubble.left.and.bubble.right.fill", color: GH.purple) },
                     trailing: {
                         Text("\(unread)")
                             .font(.gh(12, .semibold)).foregroundStyle(.white)
                             .padding(.horizontal, 7).padding(.vertical, 2)
                             .background(Capsule().fill(GH.red))
                     })
            }
        }
    }

    // MARK: top

    private var greeting: String {
        let h = Calendar.current.component(.hour, from: Date())
        if h < 12 { return "صباح الخير" }
        if h < 18 { return "مساء الخير" }
        return "مساء النور"
    }

    private var header: some View {
        HStack(spacing: 8) {
            VStack(alignment: .leading, spacing: 0) {
                Text(greeting)
                    .font(.gh(18, .semibold))
                    .foregroundStyle(GH.label)
                Text(dateStr(Date()) + (store.syncing ? " · يحدّث…" : ""))
                    .font(TS.sub)
                    .foregroundStyle(GH.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            logo
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 2)
    }

    @ViewBuilder
    private var logo: some View {
        if let img = GHImage.named("story_logo") {
            Image(uiImage: img)
                .resizable()
                .scaledToFit()
                .frame(height: 44)
        }
    }

    private var launcher: some View {
        SearchLauncher(onTap: { pushPage(SearchPage()) })
            .padding(.horizontal, 16)
            .padding(.top, 12)
    }

    private var quickActions: some View {
        HStack(spacing: 0) {
            QuickAction(icon: "plus", label: "طلب جديد", action: { newOrder() })
            QuickAction(icon: "camera.on.rectangle", label: "ستوري", color: GH.pink, action: { pushPage(StoryPickPage()) })
            QuickAction(icon: "bag", label: "المنتجات", color: GH.gold, action: { pushPage(ProductsPage()) })
            QuickAction(icon: "sparkles", label: "طلبات القطع", color: GH.blue, action: { pushPage(RequestsPage()) })
            QuickAction(icon: "chart.pie", label: "الأرباح", color: GH.green, action: { pushPage(SummaryPage()) })
        }
        .padding(.horizontal, 12)
        .padding(.top, 10)
        .padding(.bottom, 2)
    }

    @ViewBuilder
    private var main: some View {
        if !store.ready {
            LoadingView()
        } else {
            TodayContent(data: TodayData(store), openOrder: { id in pushPage(OrderDetailPage(orderId: id)) })
        }
    }

    // MARK: actions

    private func newOrder() {
        Task { @MainActor in
            let id: String? = await Nav.shared.presentForResult { done in OrderFormPage(done: done) }
            if let id { pushPage(OrderDetailPage(orderId: id)) }
        }
    }

    private func scan() {
        Task { @MainActor in await scanAndOpen() }
    }
}

/// The numbers and the to-do sections, once the data is loaded.
fileprivate struct TodayContent: View {
    let data: TodayData
    let openOrder: (String) -> Void
    @ObservedObject private var store = Store.shared

    init(data: TodayData, openOrder: @escaping (String) -> Void) {
        self.data = data
        self.openOrder = openOrder
    }

    var body: some View {
        strip
        stats
        allClearState
        requestsSection
        lateSection
        driversSection
        onlineSection
        itemSections
        unpaidSection
    }

    // MARK: numbers

    private var cells: [TodayCell] {
        [
            TodayCell(id: 0, icon: "doc.text.fill", color: GH.blue, label: "طلبات اليوم", value: "\(data.todayOrders)",
                      action: { pushPage(SearchPage(todayOnly: true)) }),
            TodayCell(id: 1, icon: "bag.fill", color: GH.burgundy, label: "مبيعات اليوم", value: plainOmr(data.todaySales), action: nil),
            TodayCell(id: 2, icon: "dollarsign.circle.fill", color: GH.green, label: "محصّل اليوم", value: plainOmr(data.collectedToday), action: nil),
        ]
    }

    private var strip: some View {
        TodayStrip(cells: cells)
            .padding(.horizontal, 16)
            .padding(.top, 14)
            .padding(.bottom, 10)
    }

    private var stats: some View {
        VStack(spacing: 10) {
            HStack(spacing: 10) {
                StatCard(label: "مبيعات الشهر", value: omr(data.sales), icon: "chart.bar.fill", hero: true)
                StatCard(label: "عند العملاء", value: omr(data.owed), icon: "exclamationmark.circle.fill", color: GH.red)
            }
            HStack(spacing: 10) {
                StatCard(label: "أرصدة العملاء عندك", value: omr(data.held), icon: "creditcard.fill", color: GH.green)
                StatCard(label: "تاكس فري باقي", value: data.taxFreeText, icon: "arrow.2.circlepath", color: GH.purple)
            }
        }
        .padding(.horizontal, 16)
    }

    @ViewBuilder
    private var allClearState: some View {
        if data.allClear {
            EmptyState(icon: "checkmark.seal", title: "كل شي تمام", message: "ما في شي يحتاج منك شغل اليوم.")
        }
    }

    // MARK: sections

    @ViewBuilder
    private var requestsSection: some View {
        if !data.newRequests.isEmpty {
            GHSection("طلبات قطع جديدة · \(data.newRequests.count)",
                      trailing: { HeaderButton("الكل") { pushPage(RequestsPage()) } }) {
                ForEach(Array(data.newRequests.prefix(5))) { r in
                    RequestTile(r)
                }
            }
        }
    }

    @ViewBuilder
    private var lateSection: some View {
        if !data.late.isEmpty {
            GHSection("متأخرة · \(data.late.count)") {
                ForEach(Array(data.late.prefix(6))) { e in
                    lateTile(e)
                }
            }
        }
    }

    private func lateTile(_ e: TodayLate) -> some View {
        let id = e.order.id
        return Tile("\(store.customerName(e.order)) · \(e.order.invoiceNo)", subtitle: e.text,
                    action: { openOrder(id) },
                    leading: { IconBox("clock.fill", color: GH.red) })
    }

    @ViewBuilder
    private var driversSection: some View {
        if !data.drivers.isEmpty {
            GHSection("المناديب في التوصيل · \(data.drivers.count)") {
                ForEach(data.drivers) { e in
                    driverTile(e)
                }
            }
        }
    }

    private func driverTile(_ e: TodayDriver) -> some View {
        let name = store.driver(e.driverId)?.name ?? "مندوب"
        let onRoad = e.orders.filter { $0.driverStatus == .picked }.count
        let collect = e.orders.reduce(0.0) { $0 + ($1.toCollect > 0 ? $1.toCollect : 0) }
        var parts: [String] = ["\(e.orders.count) طلب"]
        if onRoad > 0 { parts.append("في الطريق \(onRoad)") }
        if collect > 0 { parts.append("يحصّل \(omr(collect))") }
        let driverId = e.driverId
        return Tile(name, subtitle: parts.joined(separator: " · "),
                    action: { pushPage(DriverDetailPage(driverId: driverId)) },
                    leading: { Avatar(name, size: 32) },
                    trailing: { Badge(onRoad > 0 ? "في الطريق" : "عنده", color: onRoad > 0 ? GH.amber : GH.blue) })
    }

    @ViewBuilder
    private var onlineSection: some View {
        if !data.newOnline.isEmpty {
            GHSection("طلبات أونلاين جديدة · \(data.newOnline.count)") {
                ForEach(Array(data.newOnline.prefix(8))) { o in
                    onlineTile(o)
                }
            }
        }
    }

    @ViewBuilder
    private func onlineTile(_ o: Order) -> some View {
        let name = store.customerName(o)
        let sub = [o.sourceLabel, o.invoiceNo, "\(o.activeItems.count) قطعة"].joined(separator: " · ")
        let id = o.id
        if o.paidOnline {
            Tile(name, subtitle: sub, value: omr(o.total), action: { openOrder(id) },
                 leading: { Avatar(name, size: 32) },
                 trailing: { Badge("مدفوع", color: GH.green) })
        } else {
            Tile(name, subtitle: sub, value: omr(o.total), action: { openOrder(id) },
                 leading: { Avatar(name, size: 32) })
        }
    }

    @ViewBuilder
    private var itemSections: some View {
        if !data.outForDelivery.isEmpty {
            GHSection("خرجت للتوصيل · \(data.outForDelivery.count)") {
                ForEach(Array(data.outForDelivery.prefix(8))) { e in
                    itemTile(e, onTap: nil)
                }
            }
        }
        if !data.toDeliver.isEmpty {
            GHSection("وصلت وتنتظر التسليم · \(data.toDeliver.count)") {
                ForEach(Array(data.toDeliver.prefix(8))) { e in
                    itemTile(e, onTap: nil)
                }
            }
        }
        if !data.toBuy.isEmpty {
            GHSection("تنتظر الشراء · \(data.toBuy.count)", footer: toBuyFooter) {
                ForEach(Array(data.toBuy.prefix(8))) { e in
                    itemTile(e, onTap: { presentForm(PurchasePage(item: e.item)) })
                }
            }
        }
    }

    private var toBuyFooter: String? {
        data.toBuy.count > 8 ? "تلقى القائمة كاملة مرتبة حسب البراند في الرحلات." : nil
    }

    @ViewBuilder
    private func itemTile(_ e: TodayItem, onTap: (() -> Void)?) -> some View {
        let id = e.order.id
        let open = openOrder
        let action: () -> Void = onTap ?? { open(id) }
        let sub = "\(store.customerName(e.order)) · \(e.order.invoiceNo)"
        if let path = e.item.photoPath {
            Tile(e.item.title, subtitle: sub, value: omr(e.item.price), action: action,
                 leading: { Thumb(path: path, size: 38) })
        } else {
            Tile(e.item.title, subtitle: sub, value: omr(e.item.price), action: action)
        }
    }

    @ViewBuilder
    private var unpaidSection: some View {
        if !data.unpaid.isEmpty {
            GHSection("عليهم مبالغ · \(data.unpaid.count)") {
                ForEach(Array(data.unpaid.prefix(8))) { o in
                    unpaidTile(o)
                }
            }
        }
    }

    private func unpaidTile(_ o: Order) -> some View {
        let name = store.customerName(o)
        let id = o.id
        return Tile(name, subtitle: o.invoiceNo, value: omr(o.remaining), valueColor: GH.red, valueFont: .gh(15),
                    action: { openOrder(id) },
                    leading: { Avatar(name, size: 32) })
    }
}
