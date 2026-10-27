import SwiftUI
import UIKit

// Port of lib/pages/products_page.dart: the product grid, the products page,
// editing one product and the quick price change.
// (AdminProduct itself lives in Core/Products.swift.)

// MARK: - Product grid state

/// The products grid's state (search, pages of 60). Owned by ProductBrowser,
/// or by ProductsPage when it needs to reload / replace from outside.
@MainActor
final class ProductBrowserModel: ObservableObject {
    @Published var items: [AdminProduct] = []
    @Published var loading = true
    @Published var more = false
    @Published var page = 1
    @Published var total = 0
    @Published var error: String?
    @Published var search = ""

    private var debounce: Task<Void, Never>?
    private var started = false

    /// Ready products (screenshots) are shown as they are; otherwise the first page is loaded.
    func start(initial: [AdminProduct]?) {
        guard !started else { return }
        started = true
        if let initial {
            items = initial
            total = initial.count
            loading = false
        } else {
            Task { await self.load() }
        }
    }

    func searchChanged() {
        debounce?.cancel()
        debounce = Task {
            try? await Task.sleep(nanoseconds: 450_000_000)
            if Task.isCancelled { return }
            await self.load()
        }
    }

    /// Replaces one product after it was edited.
    func replace(_ p: AdminProduct) {
        items = items.map { $0.id == p.id ? p : $0 }
    }

    func load(next: Bool = false) async {
        loading = true
        error = nil
        do {
            let q = productsQueryEncode(search.trimmingCharacters(in: .whitespacesAndNewlines))
            let pg = next ? page + 1 : 1
            let res = try await Api.shared.get("/admin/products?per_page=60&page=\(pg)\(q.isEmpty ? "" : "&search=\(q)")")
            let map = res as? JSON
            let rows: [JSON] = map != nil ? jlist(map?["data"]) : jlist(res)
            let list = rows.map { AdminProduct($0) }
            items = next ? items + list : list
            page = pg
            if let map {
                total = js(map["total"]).flatMap { Int($0) } ?? items.count
                let last = js(map["last_page"]).flatMap { Int($0) } ?? 1
                more = last > pg
            } else {
                total = items.count
                more = false
            }
        } catch {
            self.error = errorText(error)
        }
        loading = false
    }
}

/// Like Dart's Uri.encodeQueryComponent (spaces as %20).
fileprivate func productsQueryEncode(_ s: String) -> String {
    var allowed = CharacterSet.alphanumerics
    allowed.insert(charactersIn: "-._~")
    return s.addingPercentEncoding(withAllowedCharacters: allowed) ?? ""
}

// MARK: - Product grid

/// Search + grid of every store product, 60 at a time. Used by the products
/// page and the story picker.
struct ProductBrowser: View {
    let onTap: (AdminProduct) -> Void
    var isSelected: ((AdminProduct) -> Bool)?
    /// Change it to reload (after an edit).
    var reloadKey: Int = 0
    /// Ready products (screenshots); nothing is loaded then.
    var initial: [AdminProduct]?
    /// Quick price change (products page only): price button / long press.
    var onPrice: ((AdminProduct) -> Void)?
    fileprivate var model: ProductBrowserModel?

    init(onTap: @escaping (AdminProduct) -> Void, isSelected: ((AdminProduct) -> Bool)? = nil, reloadKey: Int = 0,
         initial: [AdminProduct]? = nil, onPrice: ((AdminProduct) -> Void)? = nil) {
        self.onTap = onTap
        self.isSelected = isSelected
        self.reloadKey = reloadKey
        self.initial = initial
        self.onPrice = onPrice
        self.model = nil
    }

    /// With a state owned by the page (so the page can reload / replace).
    fileprivate init(model: ProductBrowserModel, initial: [AdminProduct]?,
                     onTap: @escaping (AdminProduct) -> Void, onPrice: ((AdminProduct) -> Void)?) {
        self.onTap = onTap
        self.isSelected = nil
        self.reloadKey = 0
        self.initial = initial
        self.onPrice = onPrice
        self.model = model
    }

    var body: some View {
        if let model {
            ProductBrowserContent(model: model, onTap: onTap, isSelected: isSelected, reloadKey: reloadKey,
                                  initial: initial, onPrice: onPrice)
        } else {
            ProductBrowserOwned(onTap: onTap, isSelected: isSelected, reloadKey: reloadKey,
                                initial: initial, onPrice: onPrice)
        }
    }
}

fileprivate struct ProductBrowserOwned: View {
    let onTap: (AdminProduct) -> Void
    let isSelected: ((AdminProduct) -> Bool)?
    let reloadKey: Int
    let initial: [AdminProduct]?
    let onPrice: ((AdminProduct) -> Void)?
    @StateObject private var model = ProductBrowserModel()

    var body: some View {
        ProductBrowserContent(model: model, onTap: onTap, isSelected: isSelected, reloadKey: reloadKey,
                              initial: initial, onPrice: onPrice)
    }
}

fileprivate struct ProductBrowserContent: View {
    @ObservedObject var model: ProductBrowserModel
    let onTap: (AdminProduct) -> Void
    let isSelected: ((AdminProduct) -> Bool)?
    let reloadKey: Int
    let initial: [AdminProduct]?
    let onPrice: ((AdminProduct) -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ProductSearchField(placeholder: "ابحث باسم المنتج أو البراند", text: $model.search)
                .onChange(of: model.search) { model.searchChanged() }
                .padding(.horizontal, 16).padding(.top, 4)
            content
        }
        .onAppear { model.start(initial: initial) }
        .onChange(of: reloadKey) { Task { await model.load() } }
    }

    @ViewBuilder private var content: some View {
        if model.loading && model.items.isEmpty {
            LoadingView()
        } else if let e = model.error, model.items.isEmpty {
            EmptyState(icon: "wifi.exclamationmark", title: "ما قدرنا نجيب المنتجات", message: e) {
                SecondaryButton("حاول مرة ثانية") { Task { await model.load() } }
            }
        } else if model.items.isEmpty {
            EmptyState(icon: "magnifyingglass", title: "ما في منتجات بهذا الاسم")
        } else {
            list
        }
    }

    private var columns: [GridItem] {
        [GridItem(.flexible(), spacing: 12), GridItem(.flexible(), spacing: 12)]
    }

    private var list: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("\(model.total) منتج")
                .font(TS.header).foregroundStyle(GH.secondary)
                .padding(.horizontal, 22).padding(.top, 16).padding(.bottom, 8)
            LazyVGrid(columns: columns, spacing: 12) {
                ForEach(model.items) { p in card(p) }
            }
            .padding(.horizontal, 16)
            if model.more {
                SecondaryButton(model.loading ? "يحمّل…" : "عرض المزيد", action: moreAction)
                    .padding(.horizontal, 16).padding(.top, 16)
            }
        }
    }

    private var moreAction: (() -> Void)? {
        if model.loading { return nil }
        let m = model
        return { Task { await m.load(next: true) } }
    }

    private func card(_ p: AdminProduct) -> some View {
        let price: (() -> Void)? = onPrice == nil ? nil : { onPrice?(p) }
        return ProductCard(p, selected: isSelected?(p), onTap: { onTap(p) }, onPrice: price)
    }
}

/// The rounded search box (CupertinoSearchTextField).
struct ProductSearchField: View {
    let placeholder: String
    @Binding var text: String

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: "magnifyingglass").font(.system(size: 16)).foregroundStyle(GH.secondary)
            TextField("", text: $text, prompt: Text(placeholder).foregroundStyle(GH.tertiary))
                .font(.gh(16)).foregroundStyle(GH.label)
                .autocorrectionDisabled()
                .submitLabel(.search)
            if !text.isEmpty {
                Button { text = "" } label: {
                    Image(systemName: "xmark.circle.fill").font(.system(size: 16)).foregroundStyle(GH.tertiary)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 10).padding(.vertical, 8)
        .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(GH.card))
    }
}

/// A store photo (contain), or the photo icon.
fileprivate struct ProductPhotoView: View {
    let url: String?
    let iconSize: CGFloat

    var body: some View {
        if let url, let u = URL(string: url) {
            AsyncImage(url: u) { phase in
                switch phase {
                case .success(let img): img.resizable().scaledToFit()
                case .failure: icon
                default: Color.clear
                }
            }
        } else {
            icon
        }
    }

    private var icon: some View {
        Image(systemName: "photo").font(.system(size: iconSize)).foregroundStyle(GH.tertiary)
    }
}

// MARK: - Product card

struct ProductCard: View {
    let p: AdminProduct
    /// nil = not choosing; true/false = chosen or not.
    var selected: Bool?
    let onTap: () -> Void
    var onPrice: (() -> Void)?
    /// Kept apart so the card redraws when only the label changed
    /// (AdminProduct's == does not look at it).
    private let badgeText: String?

    init(_ p: AdminProduct, selected: Bool? = nil, onTap: @escaping () -> Void, onPrice: (() -> Void)? = nil) {
        self.p = p
        self.selected = selected
        self.onTap = onTap
        self.onPrice = onPrice
        self.badgeText = p.badge
    }

    private var on: Bool { selected == true }

    var body: some View {
        VStack(spacing: 0) {
            imageArea
            info
        }
        .frame(maxWidth: .infinity)
        .aspectRatio(0.64, contentMode: .fit)
        .background(GH.card)
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous)
            .stroke(on ? GH.burgundy : Color.clear, lineWidth: 2))
        .ghShadow()
        .animation(.easeOut(duration: 0.15), value: on)
        .contentShape(Rectangle())
        .onTapGesture { onTap() }
        .modifier(ProductLongPress(action: onPrice))
    }

    private var imageArea: some View {
        ProductPhotoView(url: p.image, iconSize: 30)
            .padding(12)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(GH.imageBg)
            .overlay(alignment: .topLeading) { pills.padding(8) }
            .overlay(alignment: .bottomLeading) { badgeTag }
            .overlay(alignment: .bottomTrailing) { priceButton }
            .overlay(alignment: .topTrailing) { selection }
            .clipped()
    }

    private var pills: some View {
        HStack(spacing: 4) {
            if !p.active { ProductPill(label: "مخفي", color: GH.secondary) }
            if p.onSale { ProductPill(label: "خصم", color: GH.burgundy) }
        }
    }

    /// The shop's label, at the photo's bottom corner like on the website.
    @ViewBuilder private var badgeTag: some View {
        if let b = badgeText {
            MgBadgeTag(b)
                .padding(.trailing, onPrice == nil ? 8 : 44)
        }
    }

    @ViewBuilder private var priceButton: some View {
        if let onPrice {
            Button(action: onPrice) {
                Image(systemName: "tag.fill").font(.system(size: 15)).foregroundStyle(GH.burgundy)
                    .frame(width: 32, height: 32)
                    .background(Circle().fill(GH.card))
                    .ghShadow()
            }
            .buttonStyle(.plain)
            .padding(6)
        }
    }

    @ViewBuilder private var selection: some View {
        if selected != nil {
            Circle()
                .fill(on ? GH.burgundy : Color.white.opacity(0.9))
                .overlay(Circle().stroke(on ? GH.burgundy : GH.tertiary, lineWidth: 1.5))
                .overlay {
                    if on {
                        Image(systemName: "checkmark").font(.system(size: 13, weight: .bold)).foregroundStyle(.white)
                    }
                }
                .frame(width: 26, height: 26)
                .padding(8)
        }
    }

    private var info: some View {
        VStack(alignment: .leading, spacing: 0) {
            if !p.brand.isEmpty {
                Text(p.brand.uppercased())
                    .font(.gh(10.5, .semibold)).tracking(1.2).foregroundStyle(GH.gold)
                    .lineLimit(1)
            }
            Color.clear.frame(width: 1, height: 2)
            Text(p.name)
                .font(.gh(13)).foregroundStyle(GH.label)
                .lineLimit(2).multilineTextAlignment(.leading)
            Color.clear.frame(width: 1, height: 6)
            priceRow
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .fixedSize(horizontal: false, vertical: true)
        .padding(.horizontal, 12).padding(.top, 10).padding(.bottom, 12)
    }

    private var priceRow: some View {
        HStack(spacing: 6) {
            Text(omr(p.sellPrice)).font(.gh(14, .bold)).foregroundStyle(GH.burgundy).lineLimit(1)
            if p.onSale {
                Text(omr(p.price).replacingOccurrences(of: " ر.ع", with: ""))
                    .font(.gh(11.5)).foregroundStyle(GH.tertiary)
                    .strikethrough()
                    .lineLimit(1)
            }
        }
    }
}

fileprivate struct ProductPill: View {
    let label: String
    let color: Color
    var body: some View {
        Text(label).font(.gh(11, .semibold)).foregroundStyle(.white)
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(Capsule().fill(color))
    }
}

fileprivate struct ProductLongPress: ViewModifier {
    let action: (() -> Void)?
    func body(content: Content) -> some View {
        if let action {
            content.onLongPressGesture(minimumDuration: 0.5) { action() }
        } else {
            content
        }
    }
}

// MARK: - Products page

struct ProductsPage: View {
    var initial: [AdminProduct]?
    @StateObject private var browser = ProductBrowserModel()

    init(initial: [AdminProduct]? = nil) {
        self.initial = initial
    }

    var body: some View {
        GHPage("المنتجات", onRefresh: { await browser.load() }, trailing: {
            NavIcon("camera.on.rectangle") { pushPage(StoryPickPage()) }
        }) {
            ProductBrowser(model: browser, initial: initial,
                           onTap: { p in openEdit(p) },
                           onPrice: { p in openPrice(p) })
        }
    }

    private func openEdit(_ p: AdminProduct) {
        let b = browser
        Task {
            let changed: AdminProduct? = await Nav.shared.pushForResult { done in
                ProductEditPage(product: p, done: done)
            }
            if let changed { b.replace(changed) }
        }
    }

    private func openPrice(_ p: AdminProduct) {
        let b = browser
        Task {
            let changed: AdminProduct? = await Nav.shared.presentForResult { done in
                QuickPricePage(product: p, done: done)
            }
            if let changed { b.replace(changed) }
        }
    }
}

// MARK: - Edit one product

/// One of the shop's ready labels (from /admin/badges).
fileprivate struct ProductBadgeChoice: Identifiable, Hashable {
    let ar: String
    let en: String
    var id: String { ar }
}

struct ProductEditPage: View {
    let product: AdminProduct
    var done: ((AdminProduct?) -> Void)?
    @Environment(\.dismiss) private var dismiss

    @State private var nameAr: String
    @State private var nameEn: String
    @State private var priceText: String
    @State private var saleText: String
    @State private var stockText: String
    @State private var onOrder: Bool
    @State private var active: Bool
    @State private var featured: Bool
    @State private var gender: String
    @State private var origin: String
    @State private var categoryId: Int?
    @State private var categoryPath: String?
    @State private var badgeText: String
    @State private var readyBadges: [ProductBadgeChoice] = []
    @State private var busy = false

    init(product: AdminProduct, done: ((AdminProduct?) -> Void)? = nil) {
        self.product = product
        self.done = done
        _nameAr = State(initialValue: product.nameAr)
        _nameEn = State(initialValue: product.nameEn)
        _priceText = State(initialValue: String(format: "%.3f", product.price))
        _saleText = State(initialValue: product.onSale ? String(format: "%.3f", product.comparePrice ?? 0) : "")
        _stockText = State(initialValue: product.stock > 0 ? "\(product.stock)" : "")
        _badgeText = State(initialValue: product.badge ?? "")
        _onOrder = State(initialValue: product.onOrder)
        _active = State(initialValue: product.active)
        _featured = State(initialValue: product.featured)
        _gender = State(initialValue: product.gender ?? "")
        _origin = State(initialValue: product.origin ?? "")
        _categoryId = State(initialValue: product.categoryId)
        _categoryPath = State(initialValue: product.categoryName)
    }

    var body: some View {
        GHPage("تعديل المنتج", bottom: {
            PrimaryButton("حفظ", icon: "checkmark", busy: busy) { save() }
        }) {
            photoBlock
            brandLine
            nameSection
            priceSection
            availabilitySection
            badgeSection
            categorySection
            genderSection
            originSection
            storySection
        }
        .task { await loadBadges() }
    }

    private var photoBlock: some View {
        ProductPhotoView(url: product.image, iconSize: 40)
            .padding(16)
            .frame(maxWidth: .infinity)
            .frame(height: 220)
            .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(GH.imageBg))
            .padding(.horizontal, 16).padding(.top, 4)
    }

    @ViewBuilder private var brandLine: some View {
        if !product.brand.isEmpty {
            // Latin, start-aligned for its own (left-to-right) direction.
            Text(product.brand.uppercased())
                .font(.gh(12, .semibold)).tracking(1.6).foregroundStyle(GH.gold)
                .frame(maxWidth: .infinity, alignment: .trailing)
                .padding(.horizontal, 22).padding(.top, 12)
        }
    }

    private var nameSection: some View {
        GHSection("الاسم") {
            FieldRow("عربي", text: $nameAr)
            FieldRow("إنجليزي", text: $nameEn, ltr: true)
        }
    }

    private var priceSection: some View {
        GHSection("السعر", footer: "اترك سعر الخصم فاضي إذا ما عليه خصم.") {
            AmountRow("السعر", text: $priceText)
            AmountRow("بعد الخصم", text: $saleText)
        }
    }

    private var availabilityOptions: [(Bool, String)] { [(false, "تسليم فوري"), (true, "بالطلب")] }

    private var availabilitySection: some View {
        GHSection("التوفر", footer: "الكمية تخص التسليم الفوري: أي كمية أكثر من صفر تخلي المنتج «تسليم فوري»، وصفر يرجّعه «بالطلب».") {
            Segments(value: $onOrder, options: availabilityOptions)
            if !onOrder {
                FieldRow("الكمية", text: $stockText, placeholder: "كم قطعة عندك", keyboard: .number, ltr: true)
            }
            SwitchRow("ظاهر في المتجر", subtitle: active ? "العملاء يشوفونه" : "مخفي عن العملاء", isOn: $active)
            SwitchRow("منتج مميز", subtitle: "يطلع في «منتجات مميزة»", isOn: $featured)
        }
    }

    private var badgeClean: String { badgeText.trimmingCharacters(in: .whitespacesAndNewlines) }

    private var badgeSection: some View {
        GHSection("الشارة", footer: "الشريط الأسود اللي يطلع على صورة المنتج. اختر وحدة جاهزة أو اكتب شارة من عندك، وخلّها فاضية عشان تنشال.") {
            FieldRow("الشارة", text: $badgeText, placeholder: "بدون شارة")
            if !readyBadges.isEmpty {
                ChipBar {
                    ChipButton("بدون", selected: badgeClean.isEmpty) { badgeText = "" }
                    ForEach(readyBadges) { b in
                        ChipButton(b.ar, selected: badgeClean == b.ar) { badgeText = b.ar }
                    }
                }
                .padding(.vertical, 6)
            }
            if !badgeClean.isEmpty {
                HStack(spacing: 8) {
                    Text("كذا بتطلع:").font(TS.sub).foregroundStyle(GH.secondary)
                    MgBadgeTag(badgeClean)
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, 16).padding(.vertical, 12)
            }
        }
    }

    /// The shop's ready labels (GET /admin/badges), as chips.
    private func loadBadges() async {
        guard readyBadges.isEmpty else { return }
        guard let res = try? await Api.shared.get("/admin/badges") as? JSON else { return }
        readyBadges = jlist(res["badges"])
            .map { ProductBadgeChoice(ar: jstr($0["ar"]), en: jstr($0["en"])) }
            .filter { !$0.ar.isEmpty }
    }

    private var categorySection: some View {
        GHSection("التصنيف") {
            Tile(categoryPath ?? "بدون تصنيف", subtitle: "القسم › الفئة › الفرعية", action: { pickCategory() }, leading: {
                IconBox("square.stack.3d.up.fill", color: GH.gold)
            })
        }
    }

    private var genderOptions: [(String, String)] {
        [("women", "نسائي"), ("men", "رجالي"), ("unisex", "للجنسين"), ("", "بدون")]
    }

    private var genderSection: some View {
        GHSection("لمن") {
            Segments(value: $gender, options: genderOptions)
        }
    }

    private var originOptions: [(String, String)] {
        [("oman", "عُمان"), ("dubai", "دبي"), ("europe", "أوروبا"), ("", "تلقائي")]
    }

    private var originSection: some View {
        GHSection("يُشحن من") {
            Segments(value: $origin, options: originOptions)
        }
    }

    private var storySection: some View {
        GHSection {
            Tile("اعمل له ستوري", action: { pushPage(StoryComposePage(products: [product.toStory])) }, leading: {
                IconBox("camera.on.rectangle.fill", color: GH.pink)
            })
        }
    }

    private func pickCategory() {
        let current = categoryId
        Task {
            let picked: CategoryChoice? = await Nav.shared.presentForResult { done in
                CategoryPickerPage(selected: current, done: done)
            }
            if let picked {
                categoryId = picked.id
                categoryPath = picked.path
            }
        }
    }

    private func save() {
        guard let price = parseAmount(priceText), price > 0 else {
            toast("اكتب السعر", error: true)
            return
        }
        let saleT = saleText.trimmingCharacters(in: .whitespacesAndNewlines)
        let saleValue: Double? = saleT.isEmpty ? 0 : parseAmount(saleT)
        guard let sale = saleValue, !(sale > 0 && sale >= price) else {
            toast("سعر الخصم لازم يكون أقل من السعر", error: true)
            return
        }
        // a quantity makes it «تسليم فوري», none makes it «بالطلب» (the server applies the same rule)
        let typedStock = Int(normalizeDigits(stockText)) ?? 0
        if !onOrder && typedStock <= 0 {
            toast("اكتب الكمية اللي عندك، أو اختر «بالطلب»", error: true)
            return
        }
        let badgeNew = badgeClean
        if badgeNew.count > 40 {
            toast("الشارة طويلة، خلها ٤٠ حرف أو أقل", error: true)
            return
        }
        busy = true
        let p = product
        let ar = nameAr.trimmingCharacters(in: .whitespacesAndNewlines)
        let stock = onOrder ? 0 : typedStock
        let badgeOld = p.badge ?? ""
        let badgeEn: String = readyBadges.first { $0.ar == badgeNew }?.en ?? ""
        let body: JSON = [
            "name_ar": ar.isEmpty ? p.name : ar,
            "name_en": nameEn.trimmingCharacters(in: .whitespacesAndNewlines),
            "price": price,
            "compare_price": sale,
            "stock_quantity": stock,
            "availability": onOrder ? "on_order" : "instant",
            "status": active ? "active" : "draft",
            "gender": nn(gender.isEmpty ? nil : gender),
            "origin": nn(origin.isEmpty ? nil : origin),
            "is_featured": featured,
        ]
        let newCategory = categoryId
        let path = categoryPath
        Task {
            do {
                let res = try await Api.shared.post("/admin/products/\(p.id)/quick", body)
                var data: JSON? = (res as? JSON)?["data"] as? JSON
                if newCategory != p.categoryId, let cid = newCategory {
                    let r = try await Api.shared.patch("/admin/products/\(p.id)/quick", ["category_id": cid])
                    let back = (r as? JSON)?["product"] as? JSON ?? [:]
                    var merged = data ?? [:]
                    for (k, v) in back { merged[k] = v }
                    merged["category_id"] = cid
                    merged["category_name"] = nn(path?.components(separatedBy: " › ").last)
                    data = merged
                }
                // the quick endpoint does not take the label: bulk-update with this one id
                if badgeNew != badgeOld {
                    let badgeBody: JSON = ["ids": [p.id], "badge": badgeNew, "badge_en": badgeEn]
                    _ = try await Api.shared.post("/admin/products/bulk-update", badgeBody)
                    var merged: JSON = data ?? p.raw
                    merged["badge"] = nn(badgeNew.isEmpty ? nil : badgeNew)
                    merged["badge_en"] = nn(badgeEn.isEmpty ? nil : badgeEn)
                    data = merged
                }
                toast("انحفظ ✓")
                let result: AdminProduct? = data.map { AdminProduct($0) }
                if let done { done(result) } else { dismiss() }
            } catch {
                busy = false
                toastError(error)
            }
        }
    }
}

// MARK: - Quick price

/// Change only the price / sale price, from the products grid.
struct QuickPricePage: View {
    let product: AdminProduct
    var done: ((AdminProduct?) -> Void)?
    @Environment(\.dismiss) private var dismiss
    @State private var priceText: String
    @State private var saleText: String
    @State private var busy = false

    init(product: AdminProduct, done: ((AdminProduct?) -> Void)? = nil) {
        self.product = product
        self.done = done
        _priceText = State(initialValue: String(format: "%.3f", product.price))
        _saleText = State(initialValue: product.onSale ? String(format: "%.3f", product.comparePrice ?? 0) : "")
    }

    var body: some View {
        GHPage("تغيير السعر", leading: {
            NavButton("إلغاء") { close(nil) }
        }, bottom: {
            PrimaryButton("حفظ", icon: "checkmark", busy: busy) { save() }
        }) {
            headerSection
            priceSection
        }
    }

    private var headerSection: some View {
        GHSection {
            Tile(product.name, subtitle: product.brand, chevron: false, leading: {
                ProductPhotoView(url: product.image, iconSize: 20)
                    .frame(width: 44, height: 44)
                    .background(GH.imageBg)
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
            })
        }
    }

    private var priceSection: some View {
        GHSection("السعر", footer: "اترك سعر الخصم فاضي إذا ما عليه خصم.") {
            AmountRow("السعر", text: $priceText, autofocus: true)
            AmountRow("بعد الخصم", text: $saleText)
        }
    }

    private func close(_ value: AdminProduct?) {
        if let done { done(value) } else { dismiss() }
    }

    private func save() {
        guard let price = parseAmount(priceText), price > 0 else {
            toast("اكتب السعر", error: true)
            return
        }
        let saleT = saleText.trimmingCharacters(in: .whitespacesAndNewlines)
        let saleValue: Double? = saleT.isEmpty ? 0 : parseAmount(saleT)
        guard let sale = saleValue, !(sale > 0 && sale >= price) else {
            toast("سعر الخصم لازم يكون أقل من السعر", error: true)
            return
        }
        busy = true
        let p = product
        Task {
            do {
                let res = try await Api.shared.patch("/admin/products/\(p.id)/quick", ["price": price, "compare_price": sale])
                let back = (res as? JSON)?["product"] as? JSON ?? [:]
                var changes: JSON = ["price": price, "compare_price": sale]
                for (k, v) in back { changes[k] = v }
                toast("تغيّر السعر ✓")
                close(p.merged(changes))
            } catch {
                busy = false
                toastError(error)
            }
        }
    }
}
