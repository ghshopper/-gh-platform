import SwiftUI

fileprivate enum OrderFilter: CaseIterable, Hashable {
    case all, airport, europe, dubai, requested, purchased, arrived, outForDelivery, delivered, balance, website, gulf

    var label: String {
        switch self {
        case .all: return "الكل"
        case .airport: return "المطار"
        case .europe: return "أوروبا"
        case .dubai: return "دبي"
        case .requested: return "بانتظار الشراء"
        case .purchased: return "تم الشراء"
        case .arrived: return "وصلت"
        case .outForDelivery: return "خرجت للتوصيل"
        case .delivered: return "تم التسليم"
        case .balance: return "عليها مبلغ"
        case .website: return "من الموقع"
        case .gulf: return "شحن خليجي"
        }
    }

    func matches(_ o: Order) -> Bool {
        switch self {
        case .all: return true
        case .airport: return Self.has(o, .airport)
        case .europe: return Self.has(o, .boutiqueEu)
        case .dubai: return Self.has(o, .dubai)
        case .requested: return o.overallStatus == .requested
        case .purchased: return o.overallStatus == .purchased
        case .arrived: return o.overallStatus == .arrived
        case .outForDelivery: return o.overallStatus == .outForDelivery
        case .delivered: return o.overallStatus == .delivered
        case .balance: return o.hasBalance
        case .website: return o.fromStore
        case .gulf:
            let gulf = o.deliveryMethod?.isGulf == true
            let st = o.overallStatus
            return gulf && st != .delivered && st != .cancelled
        }
    }

    var place: PurchasePlace? {
        switch self {
        case .airport: return .airport
        case .europe: return .boutiqueEu
        case .dubai: return .dubai
        default: return nil
        }
    }

    /// A live piece bought there (or planned to be bought there).
    static func has(_ o: Order, _ p: PurchasePlace) -> Bool {
        o.activeItems.contains { ($0.purchasePlace ?? $0.planPlace) == p }
    }
}

/// A search field like CupertinoSearchTextField.
fileprivate struct OrdersSearchBox: View {
    @Binding var text: String
    let placeholder: String

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 16))
                .foregroundStyle(GH.secondary)
            TextField("", text: $text, prompt: Text(placeholder).foregroundStyle(GH.tertiary))
                .font(.gh(16))
                .foregroundStyle(GH.label)
                .autocorrectionDisabled()
                .submitLabel(.search)
            if !text.isEmpty {
                Button { text = "" } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 16))
                        .foregroundStyle(GH.tertiary)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 10)
        .frame(height: 38)
        .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Color(uiColor: .tertiarySystemFill)))
    }
}

struct OrdersPage: View {
    @ObservedObject private var store = Store.shared
    @State private var filter: OrderFilter = .all
    @State private var query = ""

    var body: some View {
        GHPage("الطلبات",
               onRefresh: { await Store.shared.refresh() },
               trailing: { NavIcon("plus.circle.fill") { newOrder() } },
               leading: { NavIcon("qrcode.viewfinder") { scan() } }) {
            searchBox
            filterBar
            content
        }
    }

    // MARK: parts

    private var searchBox: some View {
        OrdersSearchBox(text: $query, placeholder: "بحث بالاسم أو الرقم أو القطعة أو الفاتورة")
            .padding(.horizontal, 16)
            .padding(.top, 4)
    }

    private var visibleFilters: [OrderFilter] {
        let hasGulf = store.orders.contains { $0.deliveryMethod?.isGulf == true }
        let hasDubai = store.orders.contains { OrderFilter.has($0, .dubai) }
        return OrderFilter.allCases.filter { ($0 != .gulf || hasGulf) && ($0 != .dubai || hasDubai) }
    }

    private var filterBar: some View {
        ChipBar {
            ForEach(visibleFilters, id: \.self) { f in
                ChipButton(f.label, selected: filter == f) { filter = f }
            }
        }
        .padding(.top, 6)
        .padding(.bottom, 2)
    }

    private var list: [Order] {
        store.orders.filter { filter.matches($0) && search($0) }
    }

    @ViewBuilder
    private var content: some View {
        if !store.ready {
            LoadingView()
        } else if store.orders.isEmpty {
            EmptyState(icon: "doc.text", title: "ما في طلبات للحين", message: "أضف أول طلب وابدأ.") {
                PrimaryButton("طلب جديد", icon: "plus") { newOrder() }
                    .frame(width: 200)
            }
        } else {
            results
        }
    }

    @ViewBuilder
    private var results: some View {
        let shown = list
        if shown.isEmpty {
            EmptyState(icon: "magnifyingglass", title: "ما في نتائج")
        } else {
            if let place = filter.place {
                placeTotals(shown, place)
            }
            GHSection("\(shown.count) طلب · \(omr(shown.reduce(0) { $0 + $1.total }))") {
                ForEach(shown) { o in
                    OrderRow(order: o, onTap: { pushPage(OrderDetailPage(orderId: o.id)) })
                }
            }
        }
    }

    /// The pieces from that place in the shown orders: how many, what they sell for, what they cost.
    private func placeTotals(_ orders: [Order], _ place: PurchasePlace) -> some View {
        let items = orders.flatMap { $0.activeItems.filter { ($0.purchasePlace ?? $0.planPlace) == place } }
        let sales = items.reduce(0) { $0 + $1.price }
        let bought = items.filter { $0.status >= .purchased }
        let cost = items.reduce(0) { $0 + ($1.costOmr ?? 0) }
        let waiting = items.filter { $0.status == .requested }
        return GHSection("مجموع \(filter.label)") {
            KV("عدد القطع", "\(items.count)")
            KV("قيمتها (سعر البيع)", omr(sales), strong: true)
            if !bought.isEmpty { KV("اشتريت منها", "\(bought.count) · \(omr(bought.reduce(0) { $0 + $1.price }))") }
            if !waiting.isEmpty { KV("باقي تشتريها", "\(waiting.count) · \(omr(waiting.reduce(0) { $0 + $1.price }))") }
            if cost > 0 && Api.shared.access.can("finance") { KV("دفعت في شرائها", omr(cost)) }
        }
    }

    // MARK: logic

    private func search(_ o: Order) -> Bool {
        let q = normalizeDigits(query).trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if q.isEmpty { return true }
        var parts: [String] = [
            store.customerName(o),
            store.customer(o.customerId)?.phone ?? "",
            o.invoiceNo,
            "\(o.orderNo)",
            o.storeOrderNumber ?? "",
        ]
        for i in o.items { parts.append("\(i.brand ?? "") \(i.name)") }
        let hay = parts.joined(separator: " ").lowercased()
        return hay.contains(q)
    }

    private func newOrder() {
        Task { @MainActor in
            let id: String? = await Nav.shared.presentForResult { done in OrderFormPage(done: done) }
            if let id { pushPage(OrderDetailPage(orderId: id)) }
        }
    }

    /// Opens an order by scanning its waybill.
    private func scan() {
        Task { @MainActor in await scanAndOpen() }
    }
}

/// One order in a list: customer, number, items, status and amounts.
struct OrderRow: View {
    let order: Order
    var showCustomer: Bool = true
    var onTap: (() -> Void)?

    @ObservedObject private var store = Store.shared

    init(order: Order, showCustomer: Bool = true, onTap: (() -> Void)? = nil) {
        self.order = order
        self.showCustomer = showCustomer
        self.onTap = onTap
    }

    var body: some View {
        Pressable(action: onTap) {
            HStack(spacing: 0) {
                VStack(alignment: .leading, spacing: 0) {
                    topLine
                    Text(metaLine)
                        .font(TS.sub)
                        .foregroundStyle(GH.secondary)
                        .padding(.top, 3)
                    itemsLine
                    badges.padding(.top, 8)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Image(systemName: "chevron.forward")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(GH.tertiary)
                    .padding(.leading, 6)
            }
            .padding(.leading, 16)
            .padding(.trailing, 12)
            .padding(.vertical, 12)
        }
    }

    private var title: String { showCustomer ? store.customerName(order) : order.invoiceNo }

    private var topLine: some View {
        HStack(spacing: 8) {
            Text(title)
                .font(TS.title)
                .foregroundStyle(GH.label)
                .lineLimit(1)
                .truncationMode(.tail)
                .frame(maxWidth: .infinity, alignment: .leading)
            Text(omr(order.total))
                .font(TS.money)
                .foregroundStyle(GH.label)
        }
    }

    private var metaLine: String {
        var parts: [String] = []
        if order.fromStore { parts.append(order.sourceLabel) }
        if showCustomer { parts.append(order.invoiceNo) }
        parts.append(dateStr(order.createdAt))
        parts.append("\(order.activeItems.count) قطعة")
        return parts.joined(separator: " · ")
    }

    @ViewBuilder
    private var itemsLine: some View {
        let active = order.activeItems
        if !active.isEmpty {
            Text(active.map { $0.title }.joined(separator: "، "))
                .font(TS.sub)
                .foregroundStyle(GH.label)
                .lineLimit(1)
                .truncationMode(.tail)
                .padding(.top, 3)
        }
    }

    private var badges: some View {
        let st = order.overallStatus
        return HStack(spacing: 0) {
            Badge(st.label, color: st.color)
            Spacer(minLength: 8)
            balanceBadge
        }
    }

    @ViewBuilder
    private var balanceBadge: some View {
        if order.hasBalance {
            Badge("متبقي \(omr(order.remaining))", color: GH.red)
        } else if order.total > 0 {
            Badge("مدفوع", color: GH.green)
        }
    }
}
