import SwiftUI
import UIKit
import QuickLook
import UniformTypeIdentifiers

// Store management pages, same data and rules as the dashboard:
//  • الشارات (BadgesPage): the product labels and which products carry them
//    (GET/POST/PUT /admin/badges, POST /admin/badges/delete, POST /admin/products/bulk-update).
//  • الموظفين (StaffPage): staff accounts and their roles (/admin/users…).
//  • ملفات الشركة (CompanyDocumentsPage): the company's papers (/admin/documents…).

// MARK: - Shared

/// The shop's label on a product photo («حصرياً بسعر البوتيك»…): a small dark
/// strip like on the website, inverted in dark mode so it still reads.
struct MgBadgeTag: View {
    let text: String
    var big = false

    init(_ text: String, big: Bool = false) {
        self.text = text
        self.big = big
    }

    var body: some View {
        Text(text)
            .font(.gh(big ? 14 : 11, .medium))
            .foregroundStyle(GH.card)
            .lineLimit(1)
            .truncationMode(.tail)
            .padding(.horizontal, big ? 12 : 8)
            .padding(.vertical, big ? 6 : 3)
            .background(Rectangle().fill(GH.label))
    }
}

/// Query value encoding (ASCII letters and digits stay, everything else is %XX).
fileprivate func mgEncode(_ s: String) -> String {
    let allowed = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~")
    return s.addingPercentEncoding(withAllowedCharacters: allowed) ?? ""
}

fileprivate func mgTrim(_ s: String) -> String { s.trimmingCharacters(in: .whitespacesAndNewlines) }

fileprivate func mgLoadError(_ e: Error) -> String {
    if let a = e as? ApiError, a.status == 403 { return "هالصفحة ما تفتح بصلاحيتك" }
    return errorText(e)
}

/// Rows of a Laravel page ("data") or a plain list.
fileprivate func mgRows(_ res: Any?) -> [JSON] {
    if let map = res as? JSON { return jlist(map["data"]) }
    return jlist(res)
}

fileprivate func mgProducts(_ res: Any?) -> [AdminProduct] { mgRows(res).map { AdminProduct($0) } }

fileprivate func mgProductSub(_ p: AdminProduct) -> String {
    var parts: [String] = []
    if !p.brand.isEmpty { parts.append(p.brand) }
    parts.append(omr(p.sellPrice))
    return parts.joined(separator: " · ")
}

fileprivate func mgSize(_ bytes: Int) -> String {
    ByteCountFormatter.string(fromByteCount: Int64(bytes), countStyle: .file)
}

fileprivate struct MgThumb: View {
    let url: String?
    var size: CGFloat = 44

    var body: some View {
        RemoteImage(url: url, contentMode: .fit)
            .frame(width: size, height: size * 1.2)
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
    }
}

fileprivate struct MgCheck: View {
    let on: Bool

    var body: some View {
        Circle()
            .fill(on ? GH.burgundy : Color.clear)
            .overlay(Circle().stroke(on ? GH.burgundy : GH.tertiary, lineWidth: 1.5))
            .overlay {
                if on {
                    Image(systemName: "checkmark").font(.system(size: 12, weight: .bold)).foregroundStyle(.white)
                }
            }
            .frame(width: 24, height: 24)
    }
}

// MARK: - Badges

fileprivate struct MgBadge: Identifiable, Hashable {
    let ar: String
    let en: String
    let count: Int
    var id: String { ar }

    init(ar: String, en: String, count: Int) {
        self.ar = ar
        self.en = en
        self.count = count
    }

    init(_ j: JSON) {
        ar = jstr(j["ar"])
        en = jstr(j["en"])
        count = ji(j["count"])
    }
}

fileprivate func mgBadges(_ res: Any?) -> [MgBadge] {
    let map = res as? JSON ?? [:]
    return jlist(map["badges"]).map { MgBadge($0) }.filter { !$0.ar.isEmpty }
}

/// «الشارات»: the labels the shop puts on product photos, how many products carry each.
@MainActor
struct BadgesPage: View {
    @State private var badges: [MgBadge] = []
    @State private var loaded = false
    @State private var failure: String?

    init() {}

    var body: some View {
        GHPage("الشارات", onRefresh: { await load() }, trailing: {
            NavIcon("plus") { Task { await add() } }
        }) {
            Pad(top: 6) {
                Text("الشريط الأسود اللي يطلع على صورة المنتج في التطبيق والموقع. اختر شارة وحط عليها المنتجات.")
                    .font(TS.sub).foregroundStyle(GH.secondary)
            }
            content
        }
        .onAppear { Task { await load() } }
    }

    @ViewBuilder private var content: some View {
        if !loaded {
            LoadingView()
        } else if let failure, badges.isEmpty {
            EmptyState(icon: "wifi.exclamationmark", title: "ما قدرنا نجيب الشارات", message: failure) {
                SecondaryButton("حاول مرة ثانية", icon: "arrow.clockwise") { Task { await load() } }
            }
        } else if badges.isEmpty {
            EmptyState(icon: "tag", title: "ما فيه شارات", message: "اضغط + وأضف أول شارة.")
        } else {
            GHSection("\(badges.count) شارة", footer: "اضغط على الشارة عشان تشوف منتجاتها، تضيف لها، أو تعدّلها.") {
                ForEach(badges) { b in
                    MgBadgeRow(badge: b) { pushPage(MgBadgeDetailPage(badge: b)) }
                }
            }
        }
    }

    private func load() async {
        do {
            let res = try await Api.shared.get("/admin/badges")
            badges = mgBadges(res)
            failure = nil
        } catch {
            failure = mgLoadError(error)
            if !badges.isEmpty { toastError(error) }
        }
        loaded = true
    }

    private func add() async {
        let saved: String? = await Nav.shared.presentForResult { done in MgBadgeForm(from: nil, done: done) }
        if saved != nil { await load() }
    }
}

fileprivate struct MgBadgeRow: View {
    let badge: MgBadge
    let onTap: () -> Void

    var body: some View {
        Pressable(action: onTap) {
            HStack(spacing: 10) {
                VStack(alignment: .leading, spacing: 6) {
                    MgBadgeTag(badge.ar)
                    if !badge.en.isEmpty {
                        Text(badge.en).font(TS.small).foregroundStyle(GH.secondary).lineLimit(1)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                Text(badge.count > 0 ? "\(badge.count) منتج" : "ما عليها منتجات")
                    .font(TS.sub).foregroundStyle(badge.count > 0 ? GH.label : GH.tertiary)
                Image(systemName: "chevron.forward").font(.system(size: 14, weight: .semibold))
                    .foregroundStyle(GH.tertiary)
            }
            .padding(.horizontal, 16).padding(.vertical, 12)
            .frame(minHeight: 54)
        }
    }
}

/// Add a label, or rename one (the rename reaches every product carrying it).
/// Gives back the saved Arabic text.
@MainActor
fileprivate struct MgBadgeForm: View {
    let from: MgBadge?
    var done: ((String?) -> Void)?
    @State private var ar: String
    @State private var en: String
    @State private var saving = false
    @Environment(\.dismiss) private var dismiss

    init(from: MgBadge?, done: ((String?) -> Void)? = nil) {
        self.from = from
        self.done = done
        _ar = State(initialValue: from?.ar ?? "")
        _en = State(initialValue: from?.en ?? "")
    }

    private var clean: String { mgTrim(ar) }

    var body: some View {
        GHPage(from == nil ? "شارة جديدة" : "تعديل الشارة", trailing: {
            if saving { ProgressView() } else { NavButton("حفظ", bold: true) { Task { await save() } } }
        }, leading: {
            NavButton("إلغاء") { close(nil) }
        }) {
            GHSection(footer: from == nil
                      ? "الإنجليزي اختياري: لو تركته فاضي تطلع بالعربي في النسخة الإنجليزية."
                      : "التعديل يتغيّر على كل المنتجات اللي عليها الشارة.") {
                FieldRow("بالعربي", text: $ar, placeholder: "مثلاً: حصرياً بسعر البوتيك", autofocus: from == nil)
                FieldRow("بالإنجليزي", text: $en, placeholder: "Boutique price, exclusively", ltr: true)
            }
            if !clean.isEmpty {
                GHSection("كذا بتطلع") {
                    HStack(spacing: 0) {
                        MgBadgeTag(clean, big: true)
                        Spacer(minLength: 0)
                    }
                    .padding(16)
                }
            }
        }
    }

    private func close(_ v: String?) { if let done { done(v) } else { dismiss() } }

    private func save() async {
        let a = clean
        guard !a.isEmpty else { toast("اكتب الشارة", error: true); return }
        guard a.count <= 40 else { toast("الشارة طويلة، خلها ٤٠ حرف أو أقل", error: true); return }
        let e = mgTrim(en)
        let original = from
        saving = true
        let ok = await attempt {
            if let original {
                _ = try await Api.shared.put("/admin/badges", ["from": original.ar, "ar": a, "en": e])
            } else {
                _ = try await Api.shared.post("/admin/badges", ["ar": a, "en": e])
            }
        }
        saving = false
        if ok {
            toast("انحفظت ✓")
            close(a)
        }
    }
}

/// One label: the products carrying it (remove), add more, rename, delete.
@MainActor
fileprivate struct MgBadgeDetailPage: View {
    @State private var badge: MgBadge
    @State private var items: [AdminProduct] = []
    @State private var loading = true
    @State private var failure: String?
    @State private var busy = false

    init(badge: MgBadge) {
        _badge = State(initialValue: badge)
    }

    var body: some View {
        GHPage("الشارة", onRefresh: { await load() }, largeTitle: false, trailing: {
            if busy { ProgressView() } else { NavIcon("ellipsis.circle") { Task { await more() } } }
        }) {
            header
            addSection
            productsSection
        }
        .onAppear { Task { await load() } }
    }

    private var header: some View {
        GHSection {
            VStack(alignment: .leading, spacing: 8) {
                MgBadgeTag(badge.ar, big: true)
                Text(badge.en.isEmpty ? "بدون إنجليزي (تطلع بالعربي في النسخة الإنجليزية)" : badge.en)
                    .font(TS.sub).foregroundStyle(GH.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(16)
        }
    }

    private var addSection: some View {
        let current = badge
        let ids = Set(items.map { $0.id })
        return GHSection {
            Tile("أضف منتجات", subtitle: "دوّر على منتج أو براند واختر أكثر من واحد",
                 action: { pushPage(MgBadgeAddPage(badge: current, onIds: ids)) },
                 leading: { IconBox("plus.circle.fill", color: GH.burgundy) })
        }
    }

    @ViewBuilder private var productsSection: some View {
        if loading && items.isEmpty {
            LoadingView()
        } else if let failure, items.isEmpty {
            EmptyState(icon: "wifi.exclamationmark", title: "ما قدرنا نجيب المنتجات", message: failure) {
                SecondaryButton("حاول مرة ثانية", icon: "arrow.clockwise") { Task { await load() } }
            }
        } else if items.isEmpty {
            EmptyState(icon: "tag", title: "ما فيه منتجات للحين", message: "اضغط «أضف منتجات» واختر اللي تبي.")
        } else {
            GHSection("عليها \(items.count) منتج", trailing: {
                if items.count > 1 {
                    HeaderButton("شيلها من الكل") { Task { await removeAll() } }
                }
            }) {
                ForEach(items) { p in row(p) }
            }
        }
    }

    private func row(_ p: AdminProduct) -> some View {
        Tile(p.name, subtitle: mgProductSub(p), chevron: false, leading: {
            MgThumb(url: p.image)
        }, trailing: {
            Button { Task { await remove([p.id]) } } label: {
                Image(systemName: "xmark.circle.fill").font(.system(size: 22)).foregroundStyle(GH.tertiary)
            }
            .buttonStyle(.plain)
            .disabled(busy)
        })
    }

    private func load() async {
        loading = true
        do {
            let res = try await Api.shared.get("/admin/products?badge=\(mgEncode(badge.ar))&per_page=500")
            items = mgProducts(res)
            failure = nil
        } catch {
            failure = errorText(error)
            if !items.isEmpty { toastError(error) }
        }
        loading = false
    }

    private func remove(_ ids: [Int]) async {
        guard !ids.isEmpty else { return }
        busy = true
        let ok = await attempt {
            _ = try await Api.shared.post("/admin/products/bulk-update", ["ids": ids, "badge": "", "badge_en": ""])
        }
        busy = false
        if ok {
            let gone = Set(ids)
            items = items.filter { !gone.contains($0.id) }
            toast(ids.count == 1 ? "انشالت الشارة" : "انشالت من \(ids.count) منتج")
        }
    }

    private func removeAll() async {
        let n = items.count
        guard await confirm("تشيل الشارة من كل المنتجات؟", message: "بتنشال من \(n) منتج.", ok: "شيلها") else { return }
        await remove(items.map { $0.id })
    }

    private func more() async {
        let actions: [SheetAction<String>] = [
            SheetAction("تعديل الشارة", "edit"),
            SheetAction("حذف الشارة", "delete", destructive: true),
        ]
        guard let a = await pickAction(title: badge.ar, actions: actions) else { return }
        if a == "edit" {
            let current = badge
            let saved: String? = await Nav.shared.presentForResult { done in MgBadgeForm(from: current, done: done) }
            guard let saved else { return }
            let res: Any? = try? await Api.shared.get("/admin/badges")
            let fresh = mgBadges(res).first { $0.ar == saved }
            badge = fresh ?? MgBadge(ar: saved, en: current.en, count: current.count)
            await load()
        } else {
            let n = items.count
            guard await confirm("تحذف شارة «\(badge.ar)»؟", message: n > 0 ? "بتنشال من \(n) منتج." : nil) else { return }
            let name = badge.ar
            busy = true
            let ok = await attempt { _ = try await Api.shared.post("/admin/badges/delete", ["ar": name]) }
            busy = false
            if ok {
                toast("انحذفت")
                popPage()
            }
        }
    }
}

/// Search the shop and put the label on several products at once.
@MainActor
fileprivate struct MgBadgeAddPage: View {
    let badge: MgBadge
    let onIds: Set<Int>
    @State private var query = ""
    @State private var found: [AdminProduct] = []
    @State private var searching = false
    @State private var picked: Set<Int> = []
    @State private var saving = false

    init(badge: MgBadge, onIds: Set<Int>) {
        self.badge = badge
        self.onIds = onIds
    }

    var body: some View {
        GHPage("أضف للشارة", largeTitle: false, trailing: {
            NavButton("اختر الكل", action: selectAllAction)
        }, bottom: {
            PrimaryButton(picked.isEmpty ? "اختر المنتجات" : "حط الشارة على \(picked.count)", icon: "tag.fill",
                          busy: saving, action: saveAction)
        }) {
            HStack(spacing: 0) {
                MgBadgeTag(badge.ar, big: true)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 16).padding(.top, 4)
            ProductSearchField(placeholder: "دوّر على منتج أو براند", text: $query)
                .padding(.horizontal, 16).padding(.top, 12)
            results
        }
        .task(id: query) { await search() }
    }

    private func has(_ p: AdminProduct) -> Bool { onIds.contains(p.id) || p.badge == badge.ar }

    private var selectable: [Int] { found.filter { !has($0) }.map { $0.id } }

    private var selectAllAction: (() -> Void)? {
        let ids = selectable
        if ids.isEmpty { return nil }
        return { picked = Set(ids) }
    }

    private var saveAction: (() -> Void)? {
        if picked.isEmpty { return nil }
        return { Task { await save() } }
    }

    @ViewBuilder private var results: some View {
        if searching && found.isEmpty {
            LoadingView()
        } else if found.isEmpty {
            EmptyState(icon: "magnifyingglass", title: "ما في منتجات بهذا الاسم")
        } else {
            GHSection(mgTrim(query).isEmpty ? "أحدث المنتجات" : "\(found.count) نتيجة",
                      footer: "المنتج اللي عليه شارة ثانية بتتبدل شارته بهذي.") {
                ForEach(found) { p in pickRow(p) }
            }
        }
    }

    private func pickRow(_ p: AdminProduct) -> some View {
        let already = has(p)
        let on = picked.contains(p.id)
        let id = p.id
        let action: (() -> Void)? = already ? nil : { toggle(id) }
        return Pressable(action: action) {
            HStack(spacing: 12) {
                MgCheck(on: on || already)
                MgThumb(url: p.image)
                VStack(alignment: .leading, spacing: 2) {
                    Text(p.name).font(.gh(15)).foregroundStyle(GH.label)
                        .lineLimit(2).multilineTextAlignment(.leading)
                    Text(mgProductSub(p)).font(TS.small).foregroundStyle(GH.secondary).lineLimit(1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if already {
                    Text("عليها").font(.gh(12, .medium)).foregroundStyle(GH.green)
                } else if let other = p.badge {
                    MgBadgeTag(other).opacity(0.5)
                }
            }
            .padding(.horizontal, 16).padding(.vertical, 10)
            .opacity(already ? 0.6 : 1)
        }
    }

    private func toggle(_ id: Int) {
        if picked.contains(id) { picked.remove(id) } else { picked.insert(id) }
    }

    private func search() async {
        let q = mgTrim(query)
        if !q.isEmpty {
            try? await Task.sleep(nanoseconds: 350_000_000)
            if Task.isCancelled { return }
        }
        searching = true
        let path = "/admin/products?status=active&per_page=60" + (q.isEmpty ? "" : "&search=\(mgEncode(q))")
        do {
            let res = try await Api.shared.get(path)
            if Task.isCancelled { return }
            found = mgProducts(res)
        } catch {
            if !Task.isCancelled { toastError(error) }
        }
        searching = false
    }

    private func save() async {
        let ids = Array(picked)
        guard !ids.isEmpty else { return }
        let b = badge
        saving = true
        let ok = await attempt {
            _ = try await Api.shared.post("/admin/products/bulk-update", ["ids": ids, "badge": b.ar, "badge_en": b.en])
        }
        saving = false
        if ok {
            toast("انحطت الشارة على \(ids.count) منتج ✓")
            popPage()
        }
    }
}

// MARK: - Staff

fileprivate struct MgRole: Identifiable, Hashable {
    let key: String
    let label: String
    let description: String
    let areas: [String]
    var id: String { key }

    init(_ j: JSON) {
        key = js(j["key"]) ?? jstr(j["id"])
        label = js(j["label"]) ?? js(j["name_ar"]) ?? key
        description = jstr(j["description"])
        let raw: [Any] = (j["areas"] as? [Any]) ?? []
        areas = raw.compactMap { js($0) }
    }
}

fileprivate struct MgStaff: Identifiable {
    let raw: JSON
    var id: Int { ji(raw["id"]) }
    var name: String { js(raw["name"]) ?? "بدون اسم" }
    var email: String { jstr(raw["email"]) }
    var phone: String? { js(raw["phone"]) }
    var role: String { jstr(raw["role"]) }
    var status: String { js(raw["status"]) ?? "active" }
    var active: Bool { status == "active" }
    var twoFactor: Bool { js(raw["two_factor_enabled_at"]) != nil }
    var lastLogin: Date? { jdate(raw["last_login_at"]) }
}

fileprivate func mgStatus(_ s: String) -> (String, Color) {
    switch s {
    case "inactive": return ("موقوف", GH.secondary)
    case "banned": return ("محظور", GH.red)
    default: return ("نشط", GH.green)
    }
}

/// «الموظفين والصلاحيات»: the team's accounts, each with a role that decides
/// which parts of the app and dashboard they may open (full admins only).
@MainActor
struct StaffPage: View {
    @State private var roles: [MgRole] = []
    @State private var areaNames: [String: String] = [:]
    @State private var staff: [MgStaff] = []
    @State private var myRole: String?
    @State private var loaded = false
    @State private var failure: String?
    @State private var search = ""
    @State private var busyId: Int?

    init() {}

    private var isSuper: Bool { myRole == "super_admin" }

    var body: some View {
        GHPage("الموظفين", onRefresh: { await load() }, trailing: {
            if !roles.isEmpty {
                NavIcon("person.badge.plus") { Task { await openForm(nil) } }
            }
        }) {
            content
        }
        .task { if !loaded { await load() } }
    }

    @ViewBuilder private var content: some View {
        if !loaded {
            LoadingView()
        } else if let failure, staff.isEmpty {
            EmptyState(icon: "lock", title: "ما قدرنا نفتح الموظفين", message: failure) {
                SecondaryButton("حاول مرة ثانية", icon: "arrow.clockwise") { Task { await load() } }
            }
        } else {
            ProductSearchField(placeholder: "ابحث بالاسم أو الإيميل أو الجوال", text: $search)
                .padding(.horizontal, 16).padding(.top, 4)
            if filtered.isEmpty {
                EmptyState(icon: "person.2", title: search.isEmpty ? "ما فيه موظفين" : "ما لقينا أحد بهذا الاسم",
                           message: search.isEmpty ? "اضغط + وأضف أول حساب للفريق." : nil)
            }
            ForEach(roles) { r in roleSection(r) }
            Text(isSuper
                 ? "اضغط على الموظف عشان تعدّله، توقفه، أو تشيل الرمز الثاني لو ضاع جواله."
                 : "اضغط على الموظف عشان تعدّله أو توقفه. حسابات المدير العام يعدّلها المدير العام بس.")
                .font(TS.small).foregroundStyle(GH.secondary)
                .padding(.horizontal, 24).padding(.top, 12)
        }
    }

    private var filtered: [MgStaff] {
        let q = mgTrim(search).lowercased()
        if q.isEmpty { return staff }
        let digits = normalizeDigits(q)
        return staff.filter { s in
            s.name.lowercased().contains(q) || s.email.lowercased().contains(q) || (s.phone ?? "").contains(digits)
        }
    }

    @ViewBuilder private func roleSection(_ r: MgRole) -> some View {
        let list = filtered.filter { $0.role == r.key }
        if !list.isEmpty {
            GHSection("\(r.label) · \(list.count)") {
                ForEach(list) { s in row(s) }
            }
        }
    }

    private func subtitle(_ s: MgStaff) -> String {
        var parts: [String] = []
        if !s.email.isEmpty { parts.append(s.email) }
        if let p = s.phone { parts.append(p) }
        if let d = s.lastLogin { parts.append("آخر دخول \(dateStr(d))") }
        return parts.joined(separator: " · ")
    }

    private func row(_ s: MgStaff) -> some View {
        let locked = s.role == "super_admin" && !isSuper
        let st = mgStatus(s.status)
        let action: (() -> Void)? = locked ? nil : { Task { await actions(s) } }
        return Tile(s.name, subtitle: subtitle(s), titleColor: s.active ? GH.label : GH.secondary, chevron: !locked,
                    action: action, leading: {
                        Avatar(s.name, size: 36)
                    }, trailing: {
                        HStack(spacing: 6) {
                            if s.twoFactor {
                                Image(systemName: "lock.shield.fill").font(.system(size: 15)).foregroundStyle(GH.green)
                            }
                            if busyId == s.id {
                                ProgressView()
                            } else {
                                Badge(st.0, color: st.1)
                            }
                        }
                    })
    }

    private func roleLabel(_ key: String) -> String { roles.first { $0.key == key }?.label ?? key }

    private func load() async {
        do {
            let rr = try await Api.shared.get("/admin/users/roles") as? JSON ?? [:]
            var rl: [MgRole] = jlist(rr["roles"]).map { MgRole($0) }
            if rl.isEmpty { rl = jlist(rr["data"]).map { MgRole($0) } }
            rl = rl.filter { !$0.key.isEmpty }
            var names: [String: String] = [:]
            for a in jlist(rr["areas"]) { names[jstr(a["key"])] = jstr(a["label"]) }
            // /admin/users lists every account (customers too): ask role by role.
            var all: [MgStaff] = []
            for r in rl {
                let res = try await Api.shared.get("/admin/users?role=\(mgEncode(r.key))&per_page=100")
                all.append(contentsOf: mgRows(res).map { MgStaff(raw: $0) })
            }
            if let me = try? await Api.shared.get("/ps/me") as? JSON { myRole = js(me["staff_role"]) }
            roles = rl
            areaNames = names
            staff = all
            failure = nil
        } catch {
            failure = mgLoadError(error)
            if !staff.isEmpty { toastError(error) }
        }
        loaded = true
    }

    private func openForm(_ s: MgStaff?) async {
        let rl = isSuper ? roles : roles.filter { $0.key != "super_admin" }
        let names = areaNames
        let saved: Bool? = await Nav.shared.presentForResult { done in
            MgStaffForm(staff: s, roles: rl, areaNames: names, done: done)
        }
        if saved == true { await load() }
    }

    private func actions(_ s: MgStaff) async {
        var list: [SheetAction<String>] = [SheetAction("تعديل البيانات والصلاحية", "edit")]
        list.append(SheetAction(s.active ? "إيقاف الحساب" : "تفعيل الحساب", "toggle"))
        if s.twoFactor { list.append(SheetAction("شيل الرمز الثاني (ضاع جواله)", "2fa")) }
        list.append(SheetAction("حذف الحساب", "delete", destructive: true))
        guard let a = await pickAction(title: s.name, message: roleLabel(s.role), actions: list) else { return }
        switch a {
        case "edit":
            await openForm(s)
        case "toggle":
            if s.active {
                guard await confirm("توقف حساب \(s.name)؟", message: "ما بيقدر يدخل لين ترجع تفعّله.", ok: "إيقاف") else { return }
            }
            await run(s, "/admin/users/\(s.id)/toggle-status", done: s.active ? "انوقف الحساب" : "انفعّل الحساب")
        case "2fa":
            guard await confirm("نشيل الرمز الثاني عن \(s.name)؟",
                                message: "يقدر يدخل بكلمة المرور بس، لين يفعّل الرمز من جديد.", ok: "شيله") else { return }
            await run(s, "/admin/users/\(s.id)/two-factor-reset", done: "انشال الرمز الثاني")
        case "delete":
            guard await confirm("تحذف حساب \(s.name)؟", message: "الحذف نهائي وما يرجع.") else { return }
            busyId = s.id
            let ok = await attempt { _ = try await Api.shared.delete("/admin/users/\(s.id)") }
            busyId = nil
            if ok {
                toast("انحذف الحساب")
                await load()
            }
        default:
            return
        }
    }

    private func run(_ s: MgStaff, _ path: String, done: String) async {
        busyId = s.id
        let ok = await attempt { _ = try await Api.shared.post(path) }
        busyId = nil
        if ok {
            toast(done)
            await load()
        }
    }
}

/// New staff account, or edit one (name, e-mail, phone, password, role).
@MainActor
fileprivate struct MgStaffForm: View {
    let staff: MgStaff?
    let roles: [MgRole]
    let areaNames: [String: String]
    var done: ((Bool?) -> Void)?
    @State private var name: String
    @State private var email: String
    @State private var phone: String
    @State private var password = ""
    @State private var role: String
    @State private var saving = false
    @Environment(\.dismiss) private var dismiss

    init(staff: MgStaff?, roles: [MgRole], areaNames: [String: String], done: ((Bool?) -> Void)? = nil) {
        self.staff = staff
        self.roles = roles
        self.areaNames = areaNames
        self.done = done
        _name = State(initialValue: staff?.name ?? "")
        _email = State(initialValue: staff?.email ?? "")
        _phone = State(initialValue: staff?.phone ?? "")
        let fallback: String = roles.first { $0.key == "manager" }?.key ?? roles.first?.key ?? "manager"
        _role = State(initialValue: staff?.role ?? fallback)
    }

    var body: some View {
        GHPage(staff == nil ? "موظف جديد" : "تعديل الموظف", trailing: {
            if saving { ProgressView() } else { NavButton("حفظ", bold: true) { Task { await save() } } }
        }, leading: {
            NavButton("إلغاء") { close(nil) }
        }) {
            GHSection("البيانات") {
                FieldRow("الاسم", text: $name, placeholder: "الاسم الكامل", autofocus: staff == nil)
                FieldRow("الإيميل", text: $email, placeholder: "name@ghshopper.com", keyboard: .email, ltr: true)
                FieldRow("الجوال", text: $phone, placeholder: "اختياري", keyboard: .phone, ltr: true)
            }
            GHSection("كلمة المرور", footer: staff == nil
                      ? "٦ حروف أو أكثر. أرسلها له بطريقة آمنة، ويقدر يغيّرها بعدين."
                      : "اتركها فاضية إذا ما تبي تغيّرها.") {
                FieldRow("كلمة المرور", text: $password, placeholder: staff == nil ? "٦ حروف أو أكثر" : "بدون تغيير",
                         ltr: true, secure: true)
            }
            GHSection("الصلاحية", footer: "كل موظف يشوف الأقسام اللي تسمح فيها صلاحيته بس، في التطبيق ولوحة التحكم.") {
                ForEach(roles) { r in roleRow(r) }
            }
        }
    }

    private func roleRow(_ r: MgRole) -> some View {
        let on = role == r.key
        let areas = r.areas.map { areaNames[$0] ?? $0 }.joined(separator: "، ")
        let key = r.key
        return Pressable(action: { role = key }) {
            HStack(alignment: .top, spacing: 12) {
                Image(systemName: on ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 22)).foregroundStyle(on ? GH.burgundy : GH.tertiary)
                VStack(alignment: .leading, spacing: 3) {
                    Text(r.label).font(.gh(16, .semibold)).foregroundStyle(GH.label)
                    if !r.description.isEmpty {
                        Text(r.description).font(TS.sub).foregroundStyle(GH.secondary)
                            .multilineTextAlignment(.leading)
                    }
                    if !areas.isEmpty {
                        Text("يفتح: \(areas)").font(TS.small).foregroundStyle(GH.gold)
                            .multilineTextAlignment(.leading)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.horizontal, 16).padding(.vertical, 12)
        }
    }

    private func close(_ v: Bool?) { if let done { done(v) } else { dismiss() } }

    private func save() async {
        let n = mgTrim(name)
        let e = mgTrim(email)
        let p = normalizeDigits(phone)
        guard !n.isEmpty else { toast("اكتب الاسم", error: true); return }
        guard e.contains("@"), e.contains(".") else { toast("اكتب إيميل صحيح", error: true); return }
        if staff == nil || !password.isEmpty {
            guard password.count >= 6 else { toast("كلمة المرور ٦ حروف أو أكثر", error: true); return }
        }
        var body: JSON = ["name": n, "email": e, "phone": nn(p.isEmpty ? nil : p), "role": role]
        if !password.isEmpty { body["password"] = password }
        if staff == nil { body["status"] = "active" }
        let payload = body
        let current = staff
        saving = true
        let ok = await attempt {
            if let current {
                _ = try await Api.shared.put("/admin/users/\(current.id)", payload)
            } else {
                _ = try await Api.shared.post("/admin/users", payload)
            }
        }
        saving = false
        if ok {
            toast(current == nil ? "انضاف الحساب ✓" : "انحفظ ✓")
            close(true)
        }
    }
}

// MARK: - Company documents

fileprivate struct MgDocCategory: Identifiable, Hashable {
    let key: String
    let label: String
    var id: String { key }
}

fileprivate struct MgDoc: Identifiable, Hashable {
    let id: Int
    let category: String
    let title: String
    let number: String?
    let issuedOn: Date?
    let expiresOn: Date?
    let daysLeft: Int?
    let notes: String?
    let fileName: String
    let size: Int

    init(_ j: JSON) {
        id = ji(j["id"])
        category = jstr(j["category"])
        title = js(j["title"]) ?? "ملف"
        number = js(j["number"])
        issuedOn = jdate(j["issued_on"])
        expiresOn = jdate(j["expires_on"])
        let d: Double? = jdn(j["days_left"])
        daysLeft = d.map { Int($0) }
        notes = js(j["notes"])
        fileName = jstr(j["file_name"])
        size = ji(j["size"])
    }

    var ext: String { (fileName as NSString).pathExtension.lowercased() }
    var isExpired: Bool { (daysLeft ?? 0) < 0 }
    var expiresSoon: Bool {
        guard let n = daysLeft else { return false }
        return n >= 0 && n <= 30
    }
}

fileprivate struct MgDocGroup: Identifiable {
    let key: String
    let label: String
    let docs: [MgDoc]
    var id: String { key }
}

fileprivate func mgDocIcon(_ d: MgDoc) -> (String, Color) {
    switch d.ext {
    case "pdf": return ("doc.richtext.fill", GH.red)
    case "jpg", "jpeg", "png", "webp", "heic", "heif": return ("photo.fill", GH.blue)
    case "doc", "docx": return ("doc.text.fill", GH.blue)
    case "xls", "xlsx": return ("tablecells.fill", GH.green)
    default: return ("doc.fill", GH.secondary)
    }
}

/// Red when expired, amber within 30 days.
fileprivate func mgExpiry(_ d: MgDoc) -> (String, Color)? {
    guard let n = d.daysLeft else { return nil }
    if n < 0 { return ("منتهي", GH.red) }
    if n == 0 { return ("ينتهي اليوم", GH.amber) }
    if n <= 30 { return ("باقي \(n) يوم", GH.amber) }
    return ("ساري", GH.green)
}

fileprivate func mgDocSub(_ d: MgDoc) -> String {
    var parts: [String] = []
    if let n = d.number { parts.append("رقم \(n)") }
    if let e = d.expiresOn { parts.append((d.isExpired ? "انتهى " : "ينتهي ") + dateStr(e)) }
    if d.size > 0 { parts.append(mgSize(d.size)) }
    return parts.joined(separator: " · ")
}

/// Downloads a document's file (the request carries the sign-in token) to a
/// temporary file and gives back its place on the phone.
@MainActor
fileprivate func mgDownloadDoc(_ d: MgDoc) async throws -> URL {
    guard let token = Api.shared.session?.token, token != "demo" else {
        throw ApiError(message: "الملفات ما تفتح في وضع العرض")
    }
    guard let url = URL(string: Api.shared.base + "/admin/documents/\(d.id)/file") else {
        throw ApiError(message: "رابط الملف غلط")
    }
    var req = URLRequest(url: url)
    req.httpMethod = "GET"
    req.timeoutInterval = 120
    req.setValue("application/json", forHTTPHeaderField: "Accept")
    req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    let data: Data
    let response: URLResponse
    do {
        (data, response) = try await URLSession.shared.data(for: req)
    } catch {
        throw ApiError(message: "ما في اتصال بالإنترنت أو السيرفر ما رد")
    }
    let status = (response as? HTTPURLResponse)?.statusCode ?? 0
    guard (200..<300).contains(status) else {
        switch status {
        case 401: throw ApiError(message: "انتهت الجلسة، سجّل دخول مرة ثانية", status: status)
        case 403: throw ApiError(message: "ما عندك صلاحية على ملفات الشركة", status: status)
        case 404: throw ApiError(message: "الملف مب موجود على السيرفر", status: status)
        default: throw ApiError(message: "ما قدرنا ننزّل الملف (\(status))", status: status)
        }
    }
    var name = d.fileName.replacingOccurrences(of: "/", with: "-").replacingOccurrences(of: ":", with: "-")
    if name.isEmpty { name = "document-\(d.id)" }
    let dir = FileManager.default.temporaryDirectory
        .appendingPathComponent("gh-docs", isDirectory: true)
        .appendingPathComponent("\(d.id)", isDirectory: true)
    try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    let file = dir.appendingPathComponent(name)
    try? FileManager.default.removeItem(at: file)
    try data.write(to: file, options: .atomic)
    return file
}

fileprivate final class MgPreviewSource: NSObject, QLPreviewControllerDataSource {
    let url: URL

    init(url: URL) {
        self.url = url
        super.init()
    }

    func numberOfPreviewItems(in controller: QLPreviewController) -> Int { 1 }

    func previewController(_ controller: QLPreviewController, previewItemAt index: Int) -> QLPreviewItem {
        url as NSURL
    }
}

/// QuickLook over everything (with its own Done and share buttons).
@MainActor
fileprivate enum MgPreview {
    /// QLPreviewController keeps its data source weakly.
    static var source: MgPreviewSource?

    static func open(_ url: URL) {
        guard let top = topViewController() else { return }
        let s = MgPreviewSource(url: url)
        source = s
        let ql = QLPreviewController()
        ql.dataSource = s
        top.present(ql, animated: true)
    }
}

/// «ملفات الشركة»: the commercial registration, licences, tax card… grouped,
/// with their expiry. Tap opens the file; long press shares or deletes it.
@MainActor
struct CompanyDocumentsPage: View {
    @State private var categories: [MgDocCategory] = []
    @State private var docs: [MgDoc] = []
    @State private var loaded = false
    @State private var failure: String?
    @State private var search = ""
    @State private var openingId: Int?

    init() {}

    var body: some View {
        GHPage("ملفات الشركة", onRefresh: { await load() }, trailing: {
            if !categories.isEmpty {
                NavIcon("plus") { Task { await upload() } }
            }
        }) {
            content
        }
        .task { if !loaded { await load() } }
    }

    @ViewBuilder private var content: some View {
        if !loaded {
            LoadingView()
        } else if let failure, docs.isEmpty && categories.isEmpty {
            EmptyState(icon: "lock", title: "ما قدرنا نفتح الملفات", message: failure) {
                SecondaryButton("حاول مرة ثانية", icon: "arrow.clockwise") { Task { await load() } }
            }
        } else {
            ProductSearchField(placeholder: "ابحث بالاسم أو الرقم", text: $search)
                .padding(.horizontal, 16).padding(.top, 4)
            alertsSection
            if docs.isEmpty {
                EmptyState(icon: "folder", title: "ما فيه ملفات للحين",
                           message: "اضغط + وارفع السجل التجاري أو أي ورقة ثانية.")
            } else if groups.isEmpty {
                EmptyState(icon: "magnifyingglass", title: "ما لقينا ملف بهذا الاسم")
            } else {
                ForEach(groups) { g in
                    GHSection("\(g.label) · \(g.docs.count)") {
                        ForEach(g.docs) { d in row(d) }
                    }
                }
                Text("اضغط على الملف عشان تفتحه، واضغط مطوّل عشان تشاركه أو تحذفه.")
                    .font(TS.small).foregroundStyle(GH.secondary)
                    .padding(.horizontal, 24).padding(.top, 12)
            }
        }
    }

    private var filtered: [MgDoc] {
        let q = mgTrim(search).lowercased()
        if q.isEmpty { return docs }
        return docs.filter { d in
            let hay = [d.title, d.number ?? "", d.notes ?? "", d.fileName].joined(separator: " ").lowercased()
            return hay.contains(q)
        }
    }

    private var groups: [MgDocGroup] {
        let list = filtered
        var out: [MgDocGroup] = []
        var known = Set<String>()
        for c in categories {
            known.insert(c.key)
            let ds = list.filter { $0.category == c.key }
            if !ds.isEmpty { out.append(MgDocGroup(key: c.key, label: c.label, docs: ds)) }
        }
        let rest = list.filter { !known.contains($0.category) }
        if !rest.isEmpty { out.append(MgDocGroup(key: "_rest", label: "بدون تصنيف", docs: rest)) }
        return out
    }

    @ViewBuilder private var alertsSection: some View {
        let expired = docs.filter { $0.isExpired }.count
        let soon = docs.filter { $0.expiresSoon }.count
        if mgTrim(search).isEmpty && (expired > 0 || soon > 0) {
            GHSection {
                HStack(spacing: 12) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.system(size: 22)).foregroundStyle(expired > 0 ? GH.red : GH.amber)
                    VStack(alignment: .leading, spacing: 2) {
                        if expired > 0 {
                            Text("\(expired) ملف منتهي").font(.gh(15, .semibold)).foregroundStyle(GH.red)
                        }
                        if soon > 0 {
                            Text("\(soon) ملف ينتهي خلال ٣٠ يوم").font(.gh(15, .semibold)).foregroundStyle(GH.amber)
                        }
                        Text("جدّدها وارفع النسخة الجديدة.").font(TS.small).foregroundStyle(GH.secondary)
                    }
                    Spacer(minLength: 0)
                }
                .padding(16)
            }
        }
    }

    private func row(_ d: MgDoc) -> some View {
        let icon = mgDocIcon(d)
        let exp = mgExpiry(d)
        let sub = mgDocSub(d)
        return Tile(d.title, subtitle: sub.isEmpty ? nil : sub, chevron: false,
                    action: { Task { await open(d) } },
                    onLongPress: { Task { await more(d) } },
                    leading: { IconBox(icon.0, color: icon.1) },
                    trailing: {
                        if openingId == d.id {
                            ProgressView()
                        } else if let exp {
                            Badge(exp.0, color: exp.1)
                        }
                    })
    }

    private func load() async {
        do {
            let res = try await Api.shared.get("/admin/documents") as? JSON ?? [:]
            categories = jlist(res["categories"]).map { MgDocCategory(key: jstr($0["key"]), label: jstr($0["label"])) }
                .filter { !$0.key.isEmpty }
            docs = jlist(res["documents"]).map { MgDoc($0) }
            failure = nil
        } catch {
            failure = mgLoadError(error)
            if !docs.isEmpty { toastError(error) }
        }
        loaded = true
    }

    private func open(_ d: MgDoc) async {
        guard openingId == nil else { return }
        openingId = d.id
        do {
            let url = try await mgDownloadDoc(d)
            openingId = nil
            MgPreview.open(url)
        } catch {
            openingId = nil
            toastError(error)
        }
    }

    private func more(_ d: MgDoc) async {
        let list: [SheetAction<String>] = [
            SheetAction("فتح", "open"),
            SheetAction("مشاركة", "share"),
            SheetAction("حذف", "delete", destructive: true),
        ]
        guard let a = await pickAction(title: d.title, message: d.notes, actions: list) else { return }
        if a == "open" {
            await open(d)
        } else if a == "share" {
            guard openingId == nil else { return }
            openingId = d.id
            do {
                let url = try await mgDownloadDoc(d)
                openingId = nil
                share([url])
            } catch {
                openingId = nil
                toastError(error)
            }
        } else {
            guard await confirm("تحذف «\(d.title)»؟", message: "الملف بينحذف من السيرفر نهائياً.") else { return }
            let id = d.id
            let ok = await attempt { _ = try await Api.shared.delete("/admin/documents/\(id)") }
            if ok {
                toast("انحذف")
                docs = docs.filter { $0.id != id }
            }
        }
    }

    private func upload() async {
        let cats = categories
        let saved: Bool? = await Nav.shared.presentForResult { done in MgDocForm(categories: cats, done: done) }
        if saved == true { await load() }
    }
}

/// Upload a new paper (POST /admin/documents, multipart).
@MainActor
fileprivate struct MgDocForm: View {
    let categories: [MgDocCategory]
    var done: ((Bool?) -> Void)?
    @State private var category: String
    @State private var title = ""
    @State private var number = ""
    @State private var issued: Date?
    @State private var expires: Date?
    @State private var notes = ""
    @State private var fileData: Data?
    @State private var fileName: String?
    @State private var picking = false
    @State private var saving = false
    @Environment(\.dismiss) private var dismiss

    init(categories: [MgDocCategory], done: ((Bool?) -> Void)? = nil) {
        self.categories = categories
        self.done = done
        _category = State(initialValue: categories.first?.key ?? "other")
    }

    private var categoryLabel: String? { categories.first { $0.key == category }?.label }

    var body: some View {
        GHPage("ملف جديد", trailing: {
            if saving { ProgressView() } else { NavButton("رفع", bold: true) { Task { await save() } } }
        }, leading: {
            NavButton("إلغاء") { close(nil) }
        }) {
            GHSection("الملف", footer: "PDF أو صورة أو Word أو Excel، لين ٢٥ ميجا.") {
                Tile(fileName ?? "اختر الملف", subtitle: fileData.map { mgSize($0.count) },
                     titleColor: fileName == nil ? GH.burgundy : GH.label,
                     action: { picking = true },
                     leading: { IconBox("paperclip", color: GH.burgundy) })
            }
            GHSection("البيانات") {
                PickerRow("التصنيف", value: categoryLabel) { Task { await pickCategory() } }
                FieldRow("الاسم", text: $title, placeholder: "مثلاً: السجل التجاري")
                FieldRow("الرقم", text: $number, placeholder: "اختياري", ltr: true)
                PickerRow("تاريخ الإصدار", value: issued.map { dateStr($0) }, placeholder: "اختياري") {
                    Task { await pickDay(expiry: false) }
                }
                PickerRow("تاريخ الانتهاء", value: expires.map { dateStr($0) }, placeholder: "اختياري") {
                    Task { await pickDay(expiry: true) }
                }
            }
            GHSection("ملاحظات", footer: "لو حطيت تاريخ الانتهاء، يطلع لك تنبيه قبلها بشهر.") {
                NotesRow(text: $notes, placeholder: "اختياري")
            }
        }
        .fileImporter(isPresented: $picking, allowedContentTypes: [UTType.pdf, UTType.image, UTType.data]) { result in
            picked(result)
        }
    }

    private func close(_ v: Bool?) { if let done { done(v) } else { dismiss() } }

    private func picked(_ result: Result<URL, Error>) {
        switch result {
        case .failure(let e):
            toastError(e)
        case .success(let url):
            let scoped = url.startAccessingSecurityScopedResource()
            defer { if scoped { url.stopAccessingSecurityScopedResource() } }
            do {
                let d = try Data(contentsOf: url)
                guard d.count <= 25 * 1024 * 1024 else { toast("الملف أكبر من ٢٥ ميجا", error: true); return }
                fileData = d
                fileName = url.lastPathComponent
                if mgTrim(title).isEmpty { title = url.deletingPathExtension().lastPathComponent }
            } catch {
                toast("ما قدرنا نقرأ الملف", error: true)
            }
        }
    }

    private func pickCategory() async {
        let list: [SheetAction<String>] = categories.map { SheetAction($0.label, $0.key) }
        if let k = await pickAction(title: "التصنيف", actions: list) { category = k }
    }

    private func pickDay(expiry: Bool) async {
        let current: Date? = expiry ? expires : issued
        if current != nil {
            let list: [SheetAction<String>] = [
                SheetAction("غيّر التاريخ", "change"),
                SheetAction("شيل التاريخ", "clear", destructive: true),
            ]
            guard let a = await pickAction(actions: list) else { return }
            if a == "clear" {
                if expiry { expires = nil } else { issued = nil }
                return
            }
        }
        guard let d = await pickDate(current ?? Date()) else { return }
        if expiry { expires = d } else { issued = d }
    }

    private func save() async {
        guard let data = fileData, let rawName = fileName else { toast("اختر الملف أول", error: true); return }
        let t = mgTrim(title)
        guard !t.isEmpty else { toast("اكتب اسم الملف", error: true); return }
        var fields: [String: String] = ["category": category, "title": t]
        let num = mgTrim(number)
        if !num.isEmpty { fields["number"] = num }
        if let d = issued { fields["issued_on"] = dayString(d) }
        if let d = expires { fields["expires_on"] = dayString(d) }
        let n = mgTrim(notes)
        if !n.isEmpty { fields["notes"] = n }
        let name = rawName.replacingOccurrences(of: "\"", with: "")
        let ext = (name as NSString).pathExtension
        let mime: String = UTType(filenameExtension: ext)?.preferredMIMEType ?? "application/octet-stream"
        let payload = fields
        saving = true
        let ok = await attempt {
            _ = try await Api.shared.upload("/admin/documents", field: "file", data: data, filename: name, mime: mime,
                                            fields: payload)
        }
        saving = false
        if ok {
            toast("انرفع الملف ✓")
            close(true)
        }
    }
}
