import SwiftUI

/// A search bar look-alike that opens the global search.
struct SearchLauncher: View {
    let onTap: () -> Void

    init(onTap: @escaping () -> Void) { self.onTap = onTap }

    var body: some View {
        Button { onTap() } label: {
            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .font(.system(size: 17))
                    .foregroundStyle(GH.secondary)
                Text("ابحث في الطلبات والعملاء والمنتجات")
                    .font(.gh(15))
                    .foregroundStyle(GH.tertiary)
                    .lineLimit(1)
                    .truncationMode(.tail)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal, 12)
            .frame(height: 40)
            .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(GH.card))
            .ghShadow()
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

/// Characters left as-is in a query value (like Uri.encodeQueryComponent).
fileprivate let searchQueryAllowed = CharacterSet(charactersIn:
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~")

/// One search over orders (ref / number / name / phone / piece), customers
/// (name / phone) and store products (from the server).
struct SearchPage: View {
    /// Opened from «طلبات اليوم»: lists today's orders, search narrows them.
    let todayOnly: Bool
    let initialQuery: String
    /// Ready product results (screenshots); nothing is loaded then.
    let initialProducts: [AdminProduct]?

    @ObservedObject private var store = Store.shared
    @State private var q: String
    @State private var products: [AdminProduct]
    @State private var loadingProducts = false
    @State private var seq = 0
    @State private var debounce: Task<Void, Never>?
    @FocusState private var focused: Bool

    init(todayOnly: Bool = false, initialQuery: String = "", initialProducts: [AdminProduct]? = nil) {
        self.todayOnly = todayOnly
        self.initialQuery = initialQuery
        self.initialProducts = initialProducts
        _q = State(initialValue: initialQuery)
        _products = State(initialValue: initialProducts ?? [])
    }

    var body: some View {
        GHPage(todayOnly ? "طلبات اليوم" : "بحث") {
            searchBox
            introState
            noResultsState
            ordersSection
            customersSection
            loadingRow
            productsSection
        }
        .onChange(of: q) { _, v in changed(v) }
        .onAppear {
            if !todayOnly && initialQuery.isEmpty {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) { focused = true }
            }
        }
        .onDisappear { debounce?.cancel() }
    }

    // MARK: search

    private func norm(_ s: String) -> String {
        normalizeDigits(s).trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    private func onlyDigits(_ s: String) -> String {
        String(s.filter { $0.isASCII && $0.isNumber })
    }

    private var nq: String { norm(q) }

    private func isToday(_ d: Date?) -> Bool {
        guard let d else { return false }
        return Calendar.current.isDateInToday(d)
    }

    private func orderHit(_ o: Order, _ query: String, _ digits: String) -> Bool {
        if query.isEmpty { return todayOnly }
        let c = store.customer(o.customerId)
        var parts: [String] = [
            c?.name ?? "",
            o.invoiceNo,
            o.refNo ?? "",
            "\(o.orderNo)",
            o.waybillNo,
            o.storeOrderNumber ?? "",
        ]
        for i in o.items { parts.append("\(i.brand ?? "") \(i.name)") }
        let hay = parts.joined(separator: " ").lowercased()
        if hay.contains(query) { return true }
        // Phones: match the digits, with or without 968.
        let phone = onlyDigits(c?.phone ?? "")
        return digits.count >= 4 && phone.contains(digits)
    }

    private var orders: [Order] {
        let query = nq
        let digits = onlyDigits(query)
        return store.orders.filter { o in
            (!todayOnly || isToday(o.createdAt)) && orderHit(o, query, digits)
        }
    }

    private var customers: [Customer] {
        let query = nq
        if query.isEmpty || todayOnly { return [] }
        let digits = onlyDigits(query)
        return store.customers.filter { c in
            if c.name.lowercased().contains(query) { return true }
            let phone = onlyDigits(c.phone ?? "")
            return digits.count >= 4 && phone.contains(digits)
        }
    }

    private var shownProducts: [AdminProduct] { todayOnly ? [] : products }

    // MARK: parts

    private var searchBox: some View {
        HStack(spacing: 6) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 16))
                .foregroundStyle(GH.secondary)
            TextField("", text: $q, prompt: Text(todayOnly ? "بحث في طلبات اليوم" : "رقم الطلب، الاسم، الهاتف، المنتج…").foregroundStyle(GH.tertiary))
                .font(.gh(16))
                .foregroundStyle(GH.label)
                .autocorrectionDisabled()
                .submitLabel(.search)
                .focused($focused)
            if !q.isEmpty {
                Button { q = "" } label: {
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
        .padding(.horizontal, 16)
        .padding(.top, 4)
    }

    @ViewBuilder
    private var introState: some View {
        if nq.isEmpty && !todayOnly {
            EmptyState(icon: "magnifyingglass", title: "ابحث في كل شي",
                       message: "رقم الطلب أو الفاتورة، اسم العميل أو رقمه، أو اسم المنتج.")
        }
    }

    @ViewBuilder
    private var noResultsState: some View {
        let query = nq
        let foundOrders = orders
        let nothing = !query.isEmpty && foundOrders.isEmpty && customers.isEmpty && shownProducts.isEmpty && !loadingProducts
        if nothing || (todayOnly && foundOrders.isEmpty) {
            let todayEmpty = todayOnly && query.isEmpty
            EmptyState(icon: "magnifyingglass",
                       title: todayEmpty ? "ما في طلبات اليوم" : "ما لقينا شي",
                       message: todayEmpty ? "الطلبات الجديدة بتطلع هنا." : "جرّب كلمة ثانية أو رقم ثاني.")
        }
    }

    @ViewBuilder
    private var ordersSection: some View {
        let found = orders
        if !found.isEmpty {
            GHSection("الطلبات · \(found.count)") {
                ForEach(Array(found.prefix(30))) { o in
                    OrderRow(order: o, onTap: { pushPage(OrderDetailPage(orderId: o.id)) })
                }
            }
        }
    }

    @ViewBuilder
    private var customersSection: some View {
        let found = customers
        if !found.isEmpty {
            GHSection("العملاء · \(found.count)") {
                ForEach(Array(found.prefix(20))) { c in
                    customerTile(c)
                }
            }
        }
    }

    private func customerSubtitle(_ c: Customer) -> String {
        var parts: [String] = []
        if let p = c.phone { parts.append(p) }
        if let city = c.city { parts.append(city) }
        return parts.joined(separator: " · ")
    }

    @ViewBuilder
    private func customerTile(_ c: Customer) -> some View {
        let open: () -> Void = { pushPage(CustomerDetailPage(customerId: c.id)) }
        if let tier = c.loyaltyTier {
            Tile(c.name, subtitle: customerSubtitle(c), action: open,
                 leading: { Avatar(c.name, size: 32) },
                 trailing: { Badge(tierName(tier), color: tierColor(tier)) })
        } else {
            Tile(c.name, subtitle: customerSubtitle(c), action: open,
                 leading: { Avatar(c.name, size: 32) })
        }
    }

    @ViewBuilder
    private var loadingRow: some View {
        if loadingProducts && shownProducts.isEmpty && !todayOnly {
            ProgressView()
                .frame(maxWidth: .infinity)
                .padding(20)
        }
    }

    @ViewBuilder
    private var productsSection: some View {
        let list = shownProducts
        if !list.isEmpty {
            GHSection("المنتجات · \(list.count)") {
                ForEach(list) { p in
                    productTile(p)
                }
            }
        }
    }

    private func productSubtitle(_ p: AdminProduct) -> String {
        var parts: [String] = []
        if !p.brand.isEmpty { parts.append(p.brand) }
        if !p.active { parts.append("مخفي") }
        return parts.joined(separator: " · ")
    }

    private func productTile(_ p: AdminProduct) -> some View {
        Tile(p.name, subtitle: productSubtitle(p), value: omr(p.sellPrice),
             action: { pushPage(ProductEditPage(product: p)) },
             leading: { productThumb(p) })
    }

    private func productThumb(_ p: AdminProduct) -> some View {
        ZStack {
            GH.imageBg
            if let img = p.image {
                RemoteImage(url: img, contentMode: .fit)
            } else {
                Image(systemName: "photo")
                    .font(.system(size: 18))
                    .foregroundStyle(GH.tertiary)
            }
        }
        .frame(width: 38, height: 38)
        .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
    }

    // MARK: products from the server

    private func changed(_ v: String) {
        if initialProducts != nil { return }
        debounce?.cancel()
        let query = norm(v)
        if query.count < 2 {
            products = []
            loadingProducts = false
            return
        }
        debounce = Task { @MainActor in
            try? await Task.sleep(nanoseconds: 350_000_000)
            if Task.isCancelled { return }
            await loadProducts(query)
        }
    }

    private func loadProducts(_ query: String) async {
        seq += 1
        let mySeq = seq
        loadingProducts = true
        let enc = query.addingPercentEncoding(withAllowedCharacters: searchQueryAllowed) ?? query
        do {
            let res = try await Api.shared.get("/admin/products?per_page=12&page=1&search=\(enc)")
            let list: [JSON]
            if let m = res as? JSON { list = jlist(m["data"]) } else { list = jlist(res) }
            if mySeq != seq { return }
            products = list.map { AdminProduct($0) }
            loadingProducts = false
        } catch {
            if mySeq == seq { loadingProducts = false }
        }
    }
}
