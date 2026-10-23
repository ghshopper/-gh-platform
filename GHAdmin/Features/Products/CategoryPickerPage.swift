import SwiftUI

// Port of the category picker in lib/pages/products_page.dart.

/// The picked category.
struct CategoryChoice: Hashable {
    let id: Int
    /// «القسم › الفئة › الفرعية»
    let path: String
    init(_ id: Int, _ path: String) { self.id = id; self.path = path }
}

fileprivate struct CategoryNode {
    let id: Int
    let parentId: Int?
    let name: String
    let count: Int
    var children: [Int] = []
}

/// Sections → categories → sub-categories (flat rows with parent_id), in server order.
fileprivate struct CategoryTree {
    var byId: [Int: CategoryNode] = [:]
    var order: [Int] = []
    var roots: [Int] = []

    init(rows: [JSON]) {
        for r in rows {
            guard let id = js(r["id"]).flatMap({ Int($0) }) else { continue }
            let ar = jstr(r["name_ar"]).trimmingCharacters(in: .whitespacesAndNewlines)
            let name = ar.isEmpty ? jstr(r["name_en"]) : jstr(r["name_ar"])
            let parent = js(r["parent_id"]).flatMap { Int($0) }
            let count = js(r["products_count"]).flatMap { Int($0) } ?? 0
            if byId[id] == nil { order.append(id) }
            byId[id] = CategoryNode(id: id, parentId: parent, name: name, count: count)
        }
        for id in order {
            guard let c = byId[id] else { continue }
            if let pid = c.parentId, byId[pid] != nil {
                byId[pid]?.children.append(id)
            } else {
                roots.append(id)
            }
        }
    }

    func name(_ id: Int) -> String { byId[id]?.name ?? "" }

    func path(_ id: Int) -> String {
        guard let c = byId[id] else { return "" }
        var parts = [c.name]
        var p = c.parentId.flatMap { byId[$0] }
        var guardCount = 0
        while let cur = p, guardCount < 6 {
            guardCount += 1
            parts.insert(cur.name, at: 0)
            p = cur.parentId.flatMap { byId[$0] }
        }
        return parts.joined(separator: " › ")
    }
}

fileprivate struct CategoryRowRef: Identifiable {
    let cat: Int
    let depth: Int
    var id: String { "\(depth)-\(cat)" }
}

/// Rows loaded once per app run (the Dart static cache).
fileprivate var categoryRowsCache: [JSON]?

/// Sections → categories → sub-categories, from GET /admin/categories. Returns the picked one.
struct CategoryPickerPage: View {
    let selected: Int?
    /// Ready rows (screenshots); nothing is loaded then.
    let initialRows: [JSON]?
    var done: ((CategoryChoice?) -> Void)?
    @Environment(\.dismiss) private var dismiss

    @State private var tree: CategoryTree
    @State private var loading: Bool
    @State private var error: String?
    @State private var q = ""
    @State private var started = false
    private let hadRows: Bool

    init(selected: Int? = nil, initialRows: [JSON]? = nil, done: ((CategoryChoice?) -> Void)? = nil) {
        self.selected = selected
        self.initialRows = initialRows
        self.done = done
        let rows = initialRows ?? categoryRowsCache
        hadRows = rows != nil
        _tree = State(initialValue: CategoryTree(rows: rows ?? []))
        _loading = State(initialValue: rows == nil)
    }

    var body: some View {
        GHPage("التصنيف", leading: {
            NavButton("إلغاء") { finish(nil) }
        }) {
            ProductSearchField(placeholder: "ابحث عن تصنيف", text: $q)
                .padding(.horizontal, 16).padding(.top, 4)
            results
        }
        .task {
            guard !started else { return }
            started = true
            if initialRows == nil { await load(quiet: hadRows) }
        }
    }

    private var query: String { normalizeDigits(q).lowercased() }

    @ViewBuilder private var results: some View {
        if loading {
            LoadingView()
        } else if let error {
            EmptyState(icon: "wifi.exclamationmark", title: "ما قدرنا نجيب التصنيفات", message: error) {
                SecondaryButton("حاول مرة ثانية") { Task { await load() } }
            }
        } else if !query.isEmpty {
            searchResults
        } else {
            ForEach(tree.roots, id: \.self) { rid in rootSection(rid) }
        }
    }

    private var hits: [Int] {
        let qq = query
        return tree.order.filter { tree.path($0).lowercased().contains(qq) }
    }

    @ViewBuilder private var searchResults: some View {
        let list = hits
        if list.isEmpty {
            EmptyState(icon: "magnifyingglass", title: "ما في تصنيف بهذا الاسم")
        } else {
            GHSection {
                ForEach(list, id: \.self) { id in hitTile(id) }
            }
        }
    }

    private func hitTile(_ id: Int) -> some View {
        Tile(tree.name(id), subtitle: tree.path(id), chevron: false, action: { pick(id) }, trailing: {
            if id == selected {
                Image(systemName: "checkmark").font(.system(size: 18, weight: .semibold)).foregroundStyle(GH.burgundy)
            }
        })
    }

    private func rows(for root: Int) -> [CategoryRowRef] {
        var out = [CategoryRowRef(cat: root, depth: 0)]
        for c in tree.byId[root]?.children ?? [] {
            out.append(CategoryRowRef(cat: c, depth: 1))
            for sub in tree.byId[c]?.children ?? [] {
                out.append(CategoryRowRef(cat: sub, depth: 2))
            }
        }
        return out
    }

    private func rootSection(_ root: Int) -> some View {
        GHSection {
            ForEach(rows(for: root)) { r in catTile(r.cat, depth: r.depth) }
        }
    }

    private func catTile(_ id: Int, depth: Int) -> some View {
        let count = tree.byId[id]?.count ?? 0
        let on = id == selected
        let icon = on ? "checkmark.circle.fill" : (depth == 0 ? "folder.fill" : "circle")
        let color: Color = on ? GH.burgundy : (depth == 0 ? GH.gold : GH.tertiary)
        let titleFont: Font? = depth == 0 ? .gh(16, .semibold) : nil
        return Tile(tree.name(id), value: count > 0 ? "\(count)" : nil, titleFont: titleFont, chevron: false,
                    action: { pick(id) }, leading: {
            Image(systemName: icon)
                .font(.system(size: depth == 0 ? 20 : 16))
                .foregroundStyle(color)
                .padding(.leading, CGFloat(depth) * 18)
        })
    }

    private func pick(_ id: Int) {
        finish(CategoryChoice(id, tree.path(id)))
    }

    private func finish(_ value: CategoryChoice?) {
        if let done { done(value) } else { dismiss() }
    }

    private func load(quiet: Bool = false) async {
        if !quiet {
            loading = true
            error = nil
        }
        do {
            let res = try await Api.shared.get("/admin/categories")
            let rows: [JSON] = (res as? JSON).map { jlist($0["data"]) } ?? jlist(res)
            categoryRowsCache = rows
            tree = CategoryTree(rows: rows)
            loading = false
        } catch {
            if !quiet {
                loading = false
                self.error = errorText(error)
            }
        }
    }
}
