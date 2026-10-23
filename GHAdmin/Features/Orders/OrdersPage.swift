import SwiftUI

fileprivate enum OrderFilter: CaseIterable, Hashable {
    case all, requested, purchased, arrived, outForDelivery, delivered, balance, website, gulf

    var label: String {
        switch self {
        case .all: return "الكل"
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
        return OrderFilter.allCases.filter { $0 != .gulf || hasGulf }
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
            GHSection("\(shown.count) طلب") {
                ForEach(shown) { o in
                    OrderRow(order: o, onTap: { pushPage(OrderDetailPage(orderId: o.id)) })
                }
            }
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
