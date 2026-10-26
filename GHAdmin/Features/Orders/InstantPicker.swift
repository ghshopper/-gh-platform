import SwiftUI

/// A piece here now (تسليم فوري), from /admin/products?availability=instant.
struct InstantPiece: Identifiable, Hashable {
    let id: Int
    let name: String
    let brand: String
    let price: Double
    let stock: Int
    let image: String?

    init(_ j: JSON) {
        let p = StoryProduct(j)          // same name / brand / sale-price rules as the story
        id = p.id
        name = p.name
        brand = p.brand
        price = p.price
        image = p.image
        stock = ji(j["stock_quantity"])
    }
}

/// Pick pieces for a new order from what is here now. `taken` = pieces already in the form (per product).
struct InstantPickerSheet: View {
    let taken: [Int: Int]
    let onPick: (InstantPiece) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var search = ""
    @State private var pieces: [InstantPiece] = []
    @State private var loading = true
    @State private var failed = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                ProductSearchField(placeholder: "ابحث باسم القطعة أو البراند", text: $search)
                    .padding(.horizontal, 16).padding(.vertical, 8)
                list
            }
            .background(GH.bg)
            .navigationTitle("من التسليم الفوري")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar { ToolbarItem(placement: .topBarLeading) { Button("إغلاق") { dismiss() } } }
        }
        .environment(\.layoutDirection, .rightToLeft)
        .task(id: search) { await load() }
    }

    @ViewBuilder private var list: some View {
        if loading && pieces.isEmpty {
            LoadingView()
        } else if failed && pieces.isEmpty {
            EmptyState(icon: "wifi.exclamationmark", title: "ما قدرنا نجيب القطع", message: "تأكد من الاتصال وحاول مرة ثانية")
        } else if pieces.isEmpty {
            EmptyState(icon: "bolt", title: search.isEmpty ? "ما في قطع تسليم فوري الحين" : "ما لقينا شي",
                       message: "القطع اللي لها كمية في المنتجات تطلع هنا")
        } else {
            ScrollView {
                LazyVStack(spacing: 0) {
                    ForEach(pieces) { p in row(p) }
                }
                .background(GH.card)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .padding(.horizontal, 16).padding(.bottom, 24)
            }
        }
    }

    private func row(_ p: InstantPiece) -> some View {
        let left = p.stock - (taken[p.id] ?? 0)
        return Button {
            guard left > 0 else { return }
            onPick(p)
            dismiss()
        } label: {
            HStack(spacing: 12) {
                AsyncImage(url: p.image.flatMap(URL.init(string:))) { img in
                    img.resizable().scaledToFit()
                } placeholder: {
                    Image(systemName: "photo").foregroundStyle(GH.tertiary)
                }
                .frame(width: 52, height: 52)
                .background(GH.imageBg)
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                VStack(alignment: .leading, spacing: 2) {
                    if !p.brand.isEmpty {
                        Text(p.brand.uppercased()).font(.gh(11, .semibold)).tracking(0.8).foregroundStyle(GH.gold)
                    }
                    Text(p.name).font(.gh(15)).foregroundStyle(GH.label).lineLimit(2).multilineTextAlignment(.leading)
                    Text(left > 0 ? "متوفر \(left)" : "أخذت كل الموجود").font(.gh(12)).foregroundStyle(left > 0 ? GH.green : GH.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Text(omr(p.price)).font(TS.money).foregroundStyle(GH.label)
            }
            .padding(.horizontal, 14).padding(.vertical, 10)
            .opacity(left > 0 ? 1 : 0.45)
        }
        .buttonStyle(.plain)
        .overlay(alignment: .bottom) { Rectangle().fill(GH.separator).frame(height: 0.5).padding(.leading, 78) }
    }

    private func load() async {
        if !search.isEmpty { try? await Task.sleep(nanoseconds: 300_000_000) }
        if Task.isCancelled { return }
        loading = true
        defer { loading = false }
        let q = search.trimmingCharacters(in: .whitespaces).addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        do {
            let res = try await Api.shared.get("/admin/products?availability=instant&per_page=200\(q.isEmpty ? "" : "&search=\(q)")")
            let rows = ((res as? JSON)?["data"] as? [JSON]) ?? []
            if Task.isCancelled { return }
            pieces = rows.map(InstantPiece.init)
            failed = false
        } catch {
            if !Task.isCancelled { failed = true }
        }
    }
}
