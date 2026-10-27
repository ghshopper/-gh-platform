import SwiftUI
import UIKit

// التسويق: أكواد الخصم (GET/POST/PUT/DELETE /ps/coupons …), بطاقات الهدايا
// (GET/POST /admin/gift-cards, POST /admin/gift-cards/{id}/{activate|resend|cancel})
// والعروض التلقائية (GET/POST/PUT/DELETE /admin/offers). Same data and rules
// as the dashboard pages.

// MARK: - Shared helpers

/// A JSON row with a stable id for ForEach.
fileprivate struct MktRow: Identifiable {
    let id: String
    let raw: JSON
}

fileprivate func mktRows(_ list: [JSON]) -> [MktRow] {
    var out: [MktRow] = []
    for (i, r) in list.enumerated() {
        out.append(MktRow(id: js(r["id"]) ?? "row\(i)", raw: r))
    }
    return out
}

/// Lists come as a bare array, {data: [...]} or a paginator {data: {data: [...]}}.
fileprivate func mktList(_ v: Any?) -> [JSON] {
    if let arr = v as? [Any] { return arr.compactMap { $0 as? JSON } }
    if let d = v as? JSON {
        if let inner = d["data"] as? [Any] { return inner.compactMap { $0 as? JSON } }
        if let page = d["data"] as? JSON { return jlist(page["data"]) }
    }
    return []
}

fileprivate func mktIds(_ v: Any?) -> Set<Int> {
    var out = Set<Int>()
    if let arr = v as? [Any] {
        for x in arr {
            let n = ji(x)
            if n > 0 { out.insert(n) }
        }
    }
    return out
}

fileprivate func mktIntText(_ v: Any?) -> String {
    guard let d = jdn(v) else { return "" }
    return String(Int(d))
}

fileprivate func mktPositiveInt(_ s: String) -> Int? {
    guard let n = Int(normalizeDigits(s)), n > 0 else { return nil }
    return n
}

fileprivate func mktLoadError(_ e: Error) -> String {
    if let a = e as? ApiError, a.status == 403 { return "ما عندك صلاحية على هالصفحة" }
    return errorText(e)
}

fileprivate let mktMuscat: TimeZone = TimeZone(identifier: "Asia/Muscat") ?? TimeZone.current

fileprivate let mktCalendar: Calendar = {
    var c = Calendar(identifier: .gregorian)
    c.timeZone = TimeZone(identifier: "Asia/Muscat") ?? TimeZone.current
    return c
}()

/// What the coupons API stores as is (the server runs on UTC).
fileprivate let mktUtcFmt: DateFormatter = {
    let f = DateFormatter()
    f.locale = Locale(identifier: "en_US_POSIX")
    f.timeZone = TimeZone(identifier: "UTC")
    f.dateFormat = "yyyy-MM-dd HH:mm:ss"
    return f
}()

/// Oman time sent to the offers API (it converts to UTC itself).
fileprivate let mktLocalFmt: DateFormatter = {
    let f = DateFormatter()
    f.locale = Locale(identifier: "en_US_POSIX")
    f.timeZone = TimeZone(identifier: "Asia/Muscat") ?? TimeZone.current
    f.dateFormat = "yyyy-MM-dd HH:mm"
    return f
}()

/// starts_local / ends_local from the offers API: 2026-10-30T18:00 (Oman time).
fileprivate let mktLocalTFmt: DateFormatter = {
    let f = DateFormatter()
    f.locale = Locale(identifier: "en_US_POSIX")
    f.timeZone = TimeZone(identifier: "Asia/Muscat") ?? TimeZone.current
    f.dateFormat = "yyyy-MM-dd'T'HH:mm"
    return f
}()

fileprivate let mktShowFmt: DateFormatter = {
    let f = DateFormatter()
    f.locale = Locale(identifier: "en_US_POSIX")
    f.timeZone = TimeZone(identifier: "Asia/Muscat") ?? TimeZone.current
    f.dateFormat = "d/M/yyyy  h:mm a"
    return f
}()

fileprivate func mktDayStart(_ d: Date) -> Date { mktCalendar.startOfDay(for: d) }
fileprivate func mktDayEnd(_ d: Date) -> Date { mktCalendar.startOfDay(for: d).addingTimeInterval(86399) }

fileprivate func mktDay(_ v: Any?) -> String { dateStr(jdate(v)) }

fileprivate func mktCode(_ s: String) -> some View {
    Text(s).font(.system(size: 16, weight: .bold, design: .monospaced))
        .foregroundStyle(GH.label).lineLimit(1)
        .environment(\.layoutDirection, .leftToRight)
}

/// The maroon square with the discount on it.
fileprivate struct MktValueBox: View {
    let big: String
    let small: String

    var body: some View {
        VStack(spacing: 0) {
            Text(big).font(.gh(17, .bold).monospacedDigit()).foregroundStyle(GH.goldLight)
                .lineLimit(1).minimumScaleFactor(0.5)
            Text(small).font(.gh(11, .medium)).foregroundStyle(GH.goldLight.opacity(0.85)).lineLimit(1)
        }
        .padding(.horizontal, 4)
        .frame(width: 60, height: 60)
        .background(RoundedRectangle(cornerRadius: 15, style: .continuous).fill(GH.brandGradient))
    }
}

fileprivate struct MktLoading: View {
    let error: String?
    let retry: () -> Void

    var body: some View {
        if let error {
            EmptyState(icon: "wifi.exclamationmark", title: "ما قدرنا نجيب البيانات", message: error) {
                SecondaryButton("حاول مرة ثانية", icon: "arrow.clockwise") { retry() }
            }
        } else {
            LoadingView()
        }
    }
}

// MARK: - Brand / category lists for the pickers

fileprivate struct MktOption: Identifiable {
    let id: Int
    let name: String
    var depth: Int = 0
}

@MainActor
fileprivate func mktLoadBrands() async -> [MktOption] {
    guard let res = try? await Api.shared.get("/admin/brands?per_page=500") else { return [] }
    var out: [MktOption] = []
    for b in mktList(res) {
        let id = ji(b["id"])
        if id == 0 { continue }
        let name = js(b["name_en"]) ?? js(b["name_ar"]) ?? "#\(id)"
        out.append(MktOption(id: id, name: name))
    }
    out.sort { $0.name.lowercased() < $1.name.lowercased() }
    return out
}

/// Categories as a tree (every level can be picked; a section includes what's under it).
@MainActor
fileprivate func mktLoadCategories() async -> [MktOption] {
    guard let res = try? await Api.shared.get("/admin/categories") else { return [] }
    let all = mktList(res)
    var kids: [Int: [JSON]] = [:]
    var roots: [JSON] = []
    for c in all {
        let p = ji(c["parent_id"])
        if p == 0 { roots.append(c) } else { kids[p, default: []].append(c) }
    }
    var out: [MktOption] = []
    var seen = Set<Int>()
    func walk(_ c: JSON, _ depth: Int) {
        let id = ji(c["id"])
        if id == 0 || seen.contains(id) { return }
        seen.insert(id)
        let name = js(c["name_ar"]) ?? js(c["name_en"]) ?? "#\(id)"
        out.append(MktOption(id: id, name: name, depth: depth))
        if depth < 3 {
            for k in kids[id] ?? [] { walk(k, depth + 1) }
        }
    }
    for r in roots { walk(r, 0) }
    for c in all {
        let id = ji(c["id"])
        if id != 0 && !seen.contains(id) { walk(c, 0) }
    }
    return out
}

fileprivate func mktNames(_ options: [MktOption], _ ids: Set<Int>) -> String {
    let names = options.filter { ids.contains($0.id) }.map { $0.name }
    if names.isEmpty { return "\(ids.count) مختار" }
    if names.count <= 2 { return names.joined(separator: "، ") }
    return "\(names[0])، \(names[1]) +\(names.count - 2)"
}

/// A searchable list to pick one (or several) brands / categories.
@MainActor
fileprivate struct MktPickPage: View {
    let title: String
    let options: [MktOption]
    let multi: Bool
    let noneLabel: String
    let onChange: (Set<Int>) -> Void
    @State private var selected: Set<Int>
    @State private var q = ""

    init(title: String, options: [MktOption], selected: Set<Int>, multi: Bool, noneLabel: String,
         onChange: @escaping (Set<Int>) -> Void) {
        self.title = title
        self.options = options
        self.multi = multi
        self.noneLabel = noneLabel
        self.onChange = onChange
        _selected = State(initialValue: selected)
    }

    private var shown: [MktOption] {
        let t = q.trimmingCharacters(in: .whitespaces).lowercased()
        if t.isEmpty { return options }
        return options.filter { $0.name.lowercased().contains(t) }
    }

    var body: some View {
        GHPage(title, largeTitle: false, trailing: {
            NavButton("تم", bold: true) { popPage() }
        }) {
            ProductSearchField(placeholder: "ابحث", text: $q)
                .padding(.horizontal, 16).padding(.top, 4)
            if options.isEmpty {
                EmptyState(icon: "list.bullet", title: "القائمة فاضية", message: "ما قدرنا نجيب القائمة من السيرفر.")
            } else {
                GHSection(footer: multi ? "تقدر تختار أكثر من وحدة. بدون اختيار = الكل." : nil) {
                    Tile(noneLabel, titleColor: GH.burgundy, chevron: false, action: { pick(nil) },
                         trailing: { check(selected.isEmpty) })
                    ForEach(shown) { o in
                        Tile(o.name, titleFont: o.depth == 0 ? Font.gh(16, .semibold) : TS.body, chevron: false,
                             action: { pick(o.id) },
                             trailing: { check(selected.contains(o.id)) })
                            .padding(.leading, CGFloat(o.depth) * 16)
                    }
                }
            }
        }
    }

    @ViewBuilder private func check(_ on: Bool) -> some View {
        if on {
            Image(systemName: "checkmark").font(.system(size: 16, weight: .semibold)).foregroundStyle(GH.burgundy)
        }
    }

    private func pick(_ id: Int?) {
        if let id {
            if multi {
                if selected.contains(id) { selected.remove(id) } else { selected.insert(id) }
            } else {
                selected = [id]
            }
        } else {
            selected = []
        }
        onChange(selected)
        if !multi { popPage() }
    }
}

/// An optional date (and time) inside a section: "add" button, picker, clear button.
fileprivate struct MktDateRow: View {
    let label: String
    let hint: String
    let withTime: Bool
    @Binding var date: Date?
    let defaultDate: Date

    init(_ label: String, hint: String, withTime: Bool, date: Binding<Date?>, defaultDate: Date = Date()) {
        self.label = label
        self.hint = hint
        self.withTime = withTime
        self._date = date
        self.defaultDate = defaultDate
    }

    var body: some View {
        HStack(spacing: 8) {
            Text(label).font(.gh(16)).foregroundStyle(GH.label)
            Spacer(minLength: 4)
            if date != nil {
                picker
                Button { date = nil } label: {
                    Image(systemName: "xmark.circle.fill").font(.system(size: 18)).foregroundStyle(GH.tertiary)
                }
                .buttonStyle(.plain)
            } else {
                Button { date = defaultDate } label: {
                    HStack(spacing: 5) {
                        Text(hint).font(.gh(15)).foregroundStyle(GH.secondary)
                        Image(systemName: "plus.circle").font(.system(size: 16)).foregroundStyle(GH.burgundy)
                    }
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.leading, 16).padding(.trailing, 14).padding(.vertical, 8)
        .frame(minHeight: 54)
        .environment(\.timeZone, mktMuscat)
        .environment(\.calendar, mktCalendar)
    }

    @ViewBuilder private var picker: some View {
        let b = Binding<Date>(get: { date ?? defaultDate }, set: { date = $0 })
        if withTime {
            DatePicker("", selection: b, displayedComponents: [.date, .hourAndMinute]).labelsHidden().tint(GH.burgundy)
        } else {
            DatePicker("", selection: b, displayedComponents: .date).labelsHidden().tint(GH.burgundy)
        }
    }
}

// MARK: - Coupons

fileprivate struct MktState {
    let key: String
    let label: String
    let color: Color
}

fileprivate func mktCouponState(_ c: JSON) -> MktState {
    if !jb(c["is_active"]) { return MktState(key: "off", label: "موقّف", color: GH.secondary) }
    if let e = jdate(c["ends_at"]), e < Date() { return MktState(key: "expired", label: "منتهي", color: GH.red) }
    if let lim = jdn(c["usage_limit"]), Double(ji(c["used_count"])) >= lim {
        return MktState(key: "expired", label: "خلص العدد", color: GH.red)
    }
    if let s = jdate(c["starts_at"]), s > Date() {
        return MktState(key: "scheduled", label: "يبدأ \(dateStr(s))", color: GH.blue)
    }
    return MktState(key: "active", label: "شغّال", color: GH.green)
}

fileprivate func mktCouponValue(_ c: JSON) -> String {
    let v = jd(c["value"])
    if jstr(c["type"]) == "fixed" { return omr(v) }
    return "\(amountText(v))%"
}

fileprivate func mktUtcText(_ v: Any?) -> Any {
    guard let d = jdate(v) else { return NSNull() }
    return mktUtcFmt.string(from: d)
}

fileprivate func mktIdsOrNull(_ ids: Set<Int>) -> Any {
    if ids.isEmpty { return NSNull() }
    return Array(ids).sorted()
}

/// The full body PUT /ps/coupons/{id} needs (the server validates every field).
fileprivate func mktCouponPayload(_ c: JSON, active: Bool) -> JSON {
    var usage: Any = NSNull()
    if let u = jdn(c["usage_limit"]), u >= 1 { usage = Int(u) }
    var perCustomer: Any = NSNull()
    if let p = jdn(c["per_customer_limit"]), p >= 1 { perCustomer = Int(p) }
    let payload: JSON = [
        "code": jstr(c["code"]),
        "description": nn(js(c["description"])),
        "type": js(c["type"]) ?? "percent",
        "value": jd(c["value"]),
        "min_order": jd(c["min_order"]),
        "max_discount": nn(jdn(c["max_discount"])),
        "brand_ids": mktIdsOrNull(mktIds(c["brand_ids"])),
        "category_ids": mktIdsOrNull(mktIds(c["category_ids"])),
        "usage_limit": usage,
        "per_customer_limit": perCustomer,
        "starts_at": mktUtcText(c["starts_at"]),
        "ends_at": mktUtcText(c["ends_at"]),
        "is_active": active,
    ]
    return payload
}

/// أكواد الخصم: list, search, filter, create / edit, switch on / off, delete, who used it.
@MainActor
struct CouponsPage: View {
    @State private var coupons: [JSON]?
    @State private var loadError: String?
    @State private var query = ""
    @State private var filter = "all"
    @State private var busyId: String?

    init() {}

    private let filters: [(String, String)] = [
        ("all", "الكل"), ("active", "شغّالة"), ("expired", "منتهية"), ("off", "موقّفة"),
    ]

    private var shown: [JSON] {
        let all = coupons ?? []
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        return all.filter { c in
            let st = mktCouponState(c).key
            var okFilter = true
            switch filter {
            case "active": okFilter = st == "active" || st == "scheduled"
            case "expired": okFilter = st == "expired"
            case "off": okFilter = st == "off"
            default: okFilter = true
            }
            if !okFilter { return false }
            if q.isEmpty { return true }
            let hay = "\(jstr(c["code"])) \(jstr(c["description"]))".lowercased()
            return hay.contains(q)
        }
    }

    var body: some View {
        GHPage("أكواد الخصم", onRefresh: { await load() }, trailing: {
            NavIcon("plus") { Task { await edit(nil) } }
        }) {
            ProductSearchField(placeholder: "ابحث بالكود أو الوصف", text: $query)
                .padding(.horizontal, 16).padding(.top, 4)
            ChipBar {
                ForEach(filters, id: \.0) { f in
                    ChipButton(f.1, selected: filter == f.0) { filter = f.0 }
                }
            }
            .padding(.top, 8)
            content
        }
        .task { await load() }
    }

    @ViewBuilder private var content: some View {
        if coupons == nil {
            MktLoading(error: loadError, retry: { Task { await load() } })
        } else if (coupons ?? []).isEmpty {
            EmptyState(icon: "tag", title: "ما فيه أكواد للحين",
                       message: "سوّ كود خصم بنسبة أو بمبلغ، وحدد مدته وعدد مرات استخدامه.") {
                PrimaryButton("كود جديد", icon: "plus") { Task { await edit(nil) } }
            }
        } else {
            stats
            if shown.isEmpty {
                EmptyState(icon: "magnifyingglass", title: "ما فيه أكواد مطابقة")
            } else {
                GHSection(footer: "اضغط على الكود للتعديل أو المشاركة أو تشوف مين استخدمه.") {
                    ForEach(mktRows(shown)) { row in
                        MktCouponRow(coupon: row.raw, busy: busyId == row.id,
                                     onTap: { Task { await actions(row.raw) } },
                                     onToggle: { v in Task { await setActive(row.raw, v) } })
                    }
                }
            }
        }
    }

    private var stats: some View {
        let all = coupons ?? []
        let live = all.filter { mktCouponState($0).key == "active" }.count
        var given = 0.0
        for c in all { given += jd(c["discount_given"]) }
        return HStack(spacing: 10) {
            StatCard(label: "أكواد شغّالة", value: "\(live)", icon: "tag.fill", hero: true)
            StatCard(label: "خصم انعطى", value: omr(given), icon: "gift.fill", color: GH.gold)
        }
        .padding(.horizontal, 16).padding(.top, 12)
    }

    private func load() async {
        do {
            let res = try await Api.shared.get("/ps/coupons")
            coupons = mktList(res)
            loadError = nil
        } catch {
            loadError = mktLoadError(error)
            if coupons != nil { toastError(error) }
        }
    }

    private func edit(_ c: JSON?) async {
        let saved: Bool? = await Nav.shared.presentForResult { done in MktCouponForm(coupon: c, done: done) }
        if saved == true { await load() }
    }

    private func setActive(_ c: JSON, _ on: Bool) async {
        let id = jstr(c["id"])
        busyId = id
        let ok = await attempt { try await Api.shared.put("/ps/coupons/\(id)", mktCouponPayload(c, active: on)) }
        busyId = nil
        if ok { toast(on ? "الكود اشتغل" : "الكود توقّف") }
        await load()
    }

    private func shareText(_ c: JSON) -> String {
        let code = jstr(c["code"])
        var s = "كود خصم من GH Shopper: \(code)\nخصم \(mktCouponValue(c)) على طلبك"
        let minOrder = jd(c["min_order"])
        if minOrder > 0 { s += " (أقل طلب \(omr(minOrder)))" }
        if let e = jdate(c["ends_at"]) { s += "\nيشتغل لين \(dateStr(e))" }
        s += "\nاكتبه وقت الدفع في التطبيق أو ghshopper.com"
        return s
    }

    private func actions(_ c: JSON) async {
        let code = jstr(c["code"])
        let acts: [SheetAction<String>] = [
            SheetAction("تعديل", "edit"),
            SheetAction("مين استخدمه", "uses"),
            SheetAction("نسخ الكود", "copy"),
            SheetAction("مشاركة", "share"),
            SheetAction("حذف", "delete", destructive: true),
        ]
        let msg = "\(mktCouponValue(c)) · استُخدم \(ji(c["used_count"])) مرة"
        guard let choice: String = await pickAction(title: code, message: msg, actions: acts) else { return }
        switch choice {
        case "edit":
            await edit(c)
        case "uses":
            pushPage(MktCouponUsesPage(coupon: c))
        case "copy":
            copyText(code, toastText: "انسخ الكود \(code)")
        case "share":
            UIPasteboard.general.string = code
            share([shareText(c)])
        default:
            await remove(c)
        }
    }

    private func remove(_ c: JSON) async {
        let code = jstr(c["code"])
        let used = ji(c["used_count"]) > 0
        let ok = await confirm("نحذف الكود \(code)؟",
                               message: used ? "الكود انستخدم قبل، فبنوقّفه بس عشان يبقى سجل الاستخدام." : nil)
        if !ok { return }
        let id = jstr(c["id"])
        busyId = id
        var deactivated = false
        let done = await attempt {
            let res = try await Api.shared.delete("/ps/coupons/\(id)") as? JSON ?? [:]
            deactivated = jb(res["deactivated"])
        }
        busyId = nil
        if done {
            toast(deactivated ? "الكود انستخدم قبل، فوقّفناه بدل الحذف" : "انحذف")
            await load()
        }
    }
}

fileprivate struct MktCouponRow: View {
    let coupon: JSON
    let busy: Bool
    let onTap: () -> Void
    let onToggle: (Bool) -> Void

    private var details: String {
        var parts: [String] = []
        let used = ji(coupon["used_count"])
        if let lim = jdn(coupon["usage_limit"]) {
            parts.append("استُخدم \(used) من \(Int(lim))")
        } else {
            parts.append("استُخدم \(used) مرة")
        }
        if let e = jdate(coupon["ends_at"]) {
            parts.append((e < Date() ? "انتهى " : "ينتهي ") + dateStr(e))
        } else {
            parts.append("بدون نهاية")
        }
        let minOrder = jd(coupon["min_order"])
        if minOrder > 0 { parts.append("أقل طلب \(plainOmr(minOrder))") }
        let given = jd(coupon["discount_given"])
        if given > 0 { parts.append("خصم \(omr(given))") }
        return parts.joined(separator: " · ")
    }

    var body: some View {
        let st = mktCouponState(coupon)
        let on = jb(coupon["is_active"])
        let fixed = jstr(coupon["type"]) == "fixed"
        let v = jd(coupon["value"])
        return HStack(spacing: 0) {
            Pressable(action: busy ? nil : onTap) {
                HStack(spacing: 12) {
                    MktValueBox(big: fixed ? amountText(v) : "\(amountText(v))%", small: fixed ? "ر.ع" : "خصم")
                    VStack(alignment: .leading, spacing: 4) {
                        HStack(spacing: 8) {
                            mktCode(jstr(coupon["code"]))
                            Badge(st.label, color: st.color)
                        }
                        if let d = js(coupon["description"]) {
                            Text(d).font(TS.sub).foregroundStyle(GH.secondary).lineLimit(2)
                                .multilineTextAlignment(.leading)
                        }
                        Text(details).font(TS.small).foregroundStyle(GH.secondary)
                            .multilineTextAlignment(.leading)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(.leading, 16).padding(.trailing, 8).padding(.vertical, 12)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            Group {
                if busy {
                    ProgressView()
                } else {
                    Toggle("", isOn: Binding<Bool>(get: { on }, set: { nv in onToggle(nv) }))
                        .labelsHidden().tint(GH.burgundy)
                }
            }
            .padding(.trailing, 14)
        }
    }
}

@MainActor
fileprivate struct MktCouponForm: View {
    let coupon: JSON?
    var done: ((Bool?) -> Void)? = nil
    @State private var code = ""
    @State private var desc = ""
    @State private var type = "percent"
    @State private var value = ""
    @State private var minOrder = ""
    @State private var maxDiscount = ""
    @State private var usageLimit = ""
    @State private var perCustomer = ""
    @State private var startsAt: Date?
    @State private var endsAt: Date?
    @State private var active = true
    @State private var brandIds: Set<Int> = []
    @State private var categoryIds: Set<Int> = []
    @State private var brands: [MktOption] = []
    @State private var cats: [MktOption] = []
    @State private var saving = false
    @Environment(\.dismiss) private var dismiss

    init(coupon: JSON?, done: ((Bool?) -> Void)? = nil) {
        self.coupon = coupon
        self.done = done
        if let c = coupon {
            _code = State(initialValue: jstr(c["code"]))
            _desc = State(initialValue: jstr(c["description"]))
            _type = State(initialValue: jstr(c["type"]) == "fixed" ? "fixed" : "percent")
            _value = State(initialValue: amountText(jdn(c["value"])))
            let mo = jd(c["min_order"])
            _minOrder = State(initialValue: mo > 0 ? amountText(mo) : "")
            _maxDiscount = State(initialValue: amountText(jdn(c["max_discount"])))
            _usageLimit = State(initialValue: mktIntText(c["usage_limit"]))
            _perCustomer = State(initialValue: mktIntText(c["per_customer_limit"]))
            _startsAt = State(initialValue: jdate(c["starts_at"]))
            _endsAt = State(initialValue: jdate(c["ends_at"]))
            _active = State(initialValue: jb(c["is_active"]))
            _brandIds = State(initialValue: mktIds(c["brand_ids"]))
            _categoryIds = State(initialValue: mktIds(c["category_ids"]))
        }
    }

    private var isEdit: Bool { coupon != nil }

    var body: some View {
        GHPage(isEdit ? "تعديل الكود" : "كود جديد", largeTitle: false, trailing: {
            if saving { ProgressView() } else { NavButton("حفظ", bold: true) { Task { await save() } } }
        }, leading: {
            NavButton("إلغاء") { close(nil) }
        }) {
            GHSection("الكود", footer: "حروف إنجليزية وأرقام بس (و - أو _). العميل يكتبه وقت الدفع.",
                      trailing: { HeaderButton("كود عشوائي", icon: "dice") { code = randomCode() } }) {
                FieldRow("الكود", text: $code, placeholder: "مثلاً EID15", ltr: true, autofocus: !isEdit)
                FieldRow("الوصف", text: $desc, placeholder: "لك بس، مثلاً: عرض العيد")
            }
            GHSection("الخصم", footer: type == "percent" ? "أقصى خصم فاضي = بدون حد." : "المبلغ ينخصم من مجموع القطع اللي يشملها الكود.") {
                Segments(value: $type, options: [("percent", "نسبة %"), ("fixed", "مبلغ ثابت")])
                if type == "percent" {
                    FieldRow("النسبة", text: $value, placeholder: "10", keyboard: .decimal, suffix: "%", ltr: true)
                    AmountRow("أقصى خصم", text: $maxDiscount)
                } else {
                    AmountRow("المبلغ", text: $value)
                }
                AmountRow("أقل طلب", text: $minOrder)
            }
            GHSection("الاستخدام", footer: "فاضي = بدون حد.") {
                FieldRow("لكل العملاء", text: $usageLimit, placeholder: "بدون حد", keyboard: .number, suffix: "مرة", ltr: true)
                FieldRow("لكل عميل", text: $perCustomer, placeholder: "بدون حد", keyboard: .number, suffix: "مرة", ltr: true)
            }
            GHSection("المدة", footer: "بتوقيت مسقط. الكود يشتغل من أول يوم البداية لين آخر يوم النهاية.") {
                MktDateRow("يبدأ", hint: "من الحين", withTime: false, date: $startsAt)
                MktDateRow("ينتهي", hint: "بدون نهاية", withTime: false, date: $endsAt,
                           defaultDate: Date().addingTimeInterval(7 * 86400))
            }
            GHSection("يشمل", footer: "بدون اختيار = كل البراندات وكل التصنيفات.") {
                PickerRow("البراندات", value: brandIds.isEmpty ? nil : mktNames(brands, brandIds), placeholder: "الكل") {
                    pushPage(MktPickPage(title: "البراندات", options: brands, selected: brandIds, multi: true,
                                         noneLabel: "كل البراندات", onChange: { ids in brandIds = ids }))
                }
                PickerRow("التصنيفات", value: categoryIds.isEmpty ? nil : mktNames(cats, categoryIds), placeholder: "الكل") {
                    pushPage(MktPickPage(title: "التصنيفات", options: cats, selected: categoryIds, multi: true,
                                         noneLabel: "كل التصنيفات", onChange: { ids in categoryIds = ids }))
                }
            }
            GHSection {
                SwitchRow("الكود شغّال", subtitle: "لو توقفه ما يقدر أحد يستخدمه", isOn: $active)
            }
        }
        .task {
            if brands.isEmpty { brands = await mktLoadBrands() }
            if cats.isEmpty { cats = await mktLoadCategories() }
        }
    }

    private func randomCode() -> String {
        let chars = Array("ABCDEFGHJKLMNPQRSTUVWXYZ23456789")
        var s = "GH"
        for _ in 0..<6 {
            if let ch = chars.randomElement() { s.append(ch) }
        }
        return s
    }

    private func close(_ v: Bool?) { if let done { done(v) } else { dismiss() } }

    private func save() async {
        let c = normalizeDigits(code).uppercased().replacingOccurrences(of: " ", with: "")
        guard !c.isEmpty, c.count <= 40, c.range(of: "^[A-Z0-9_-]+$", options: .regularExpression) != nil else {
            toast("اكتب الكود بحروف إنجليزية وأرقام", error: true); return
        }
        guard let v = parseAmount(value), v > 0 else { toast("اكتب قيمة الخصم", error: true); return }
        if type == "percent" && v > 100 { toast("النسبة لازم تكون ١٠٠ أو أقل", error: true); return }
        if let s = startsAt, let e = endsAt, mktDayEnd(e) < mktDayStart(s) {
            toast("تاريخ النهاية لازم يكون بعد البداية", error: true); return
        }
        var maxD: Any = NSNull()
        if type == "percent", let m = parseAmount(maxDiscount), m > 0 { maxD = m }
        var starts: Any = NSNull()
        if let s = startsAt { starts = mktUtcFmt.string(from: mktDayStart(s)) }
        var ends: Any = NSNull()
        if let e = endsAt { ends = mktUtcFmt.string(from: mktDayEnd(e)) }
        let d = desc.trimmingCharacters(in: .whitespacesAndNewlines)
        let payload: JSON = [
            "code": c,
            "description": d.isEmpty ? NSNull() : d,
            "type": type,
            "value": v,
            "min_order": parseAmount(minOrder) ?? 0,
            "max_discount": maxD,
            "usage_limit": nn(mktPositiveInt(usageLimit)),
            "per_customer_limit": nn(mktPositiveInt(perCustomer)),
            "starts_at": starts,
            "ends_at": ends,
            "brand_ids": mktIdsOrNull(brandIds),
            "category_ids": mktIdsOrNull(categoryIds),
            "is_active": active,
        ]
        saving = true
        let id = js(coupon?["id"])
        let ok = await attempt {
            if let id {
                _ = try await Api.shared.put("/ps/coupons/\(id)", payload)
            } else {
                _ = try await Api.shared.post("/ps/coupons", payload)
            }
        }
        saving = false
        if ok { toast(isEdit ? "انحفظ الكود" : "انضاف الكود \(c)"); close(true) }
    }
}

/// Who used a code: customer, order, discount, date.
@MainActor
fileprivate struct MktCouponUsesPage: View {
    let coupon: JSON
    @State private var rows: [JSON]?
    @State private var loadError: String?

    init(coupon: JSON) { self.coupon = coupon }

    private var total: Double {
        var t = 0.0
        for r in rows ?? [] { t += jd(r["amount"]) }
        return t
    }

    var body: some View {
        GHPage(jstr(coupon["code"]), onRefresh: { await load() }, largeTitle: false, trailing: {
            NavIcon("doc.on.doc") { copyText(jstr(coupon["code"]), toastText: "انسخ الكود") }
        }) {
            if let list = rows {
                GHSection("الاستخدام") {
                    KV("عدد المرات", "\(list.count)", strong: true)
                    KV("مجموع الخصم", omr(total))
                    KV("قيمة الكود", mktCouponValue(coupon))
                }
                if list.isEmpty {
                    EmptyState(icon: "person.crop.circle.badge.questionmark", title: "ما أحد استخدمه للحين")
                } else {
                    GHSection("مين استخدمه") {
                        ForEach(mktRows(list)) { row in
                            useTile(row.raw)
                        }
                    }
                }
            } else {
                MktLoading(error: loadError, retry: { Task { await load() } })
            }
        }
        .task { await load() }
    }

    private func useTile(_ r: JSON) -> some View {
        let name = js(r["customer"]) ?? js(r["phone"]) ?? "عميل"
        var parts: [String] = []
        if let o = js(r["order_number"]) { parts.append("طلب #\(o)") }
        if let t = jdn(r["order_total"]) { parts.append("الطلب \(plainOmr(t))") }
        if js(r["customer"]) != nil, let p = js(r["phone"]) { parts.append(p) }
        if let d = jdate(r["created_at"]) { parts.append(dateTimeStr(d)) }
        return Tile(name, subtitle: parts.joined(separator: " · "), value: "− \(omr(jd(r["amount"])))",
                    valueColor: GH.burgundy, valueFont: .gh(15, .semibold), chevron: false,
                    leading: { Avatar(name, size: 34) })
    }

    private func load() async {
        do {
            let res = try await Api.shared.get("/ps/coupons/\(jstr(coupon["id"]))/redemptions")
            rows = mktList(res)
            loadError = nil
        } catch {
            loadError = mktLoadError(error)
            if rows != nil { toastError(error) }
        }
    }
}

// MARK: - Gift cards

fileprivate func mktGiftState(_ g: JSON) -> MktState {
    switch jstr(g["status"]) {
    case "active":
        if let e = jdate(g["expires_at"]), e < Date() { return MktState(key: "active", label: "منتهية", color: GH.red) }
        if jd(g["balance"]) <= 0.0005 { return MktState(key: "active", label: "انصرفت كلها", color: GH.secondary) }
        return MktState(key: "active", label: "فعّالة", color: GH.green)
    case "cancelled": return MktState(key: "cancelled", label: "ملغية", color: GH.secondary)
    default: return MktState(key: "pending", label: "تنتظر الدفع", color: GH.amber)
    }
}

/// The card as a WhatsApp message to the recipient (same text as the dashboard).
fileprivate func mktGiftWhatsApp(_ g: JSON, from: String? = nil, message: String? = nil) -> String {
    var lines: [String] = []
    lines.append("مرحبا \(jstr(g["recipient_name"])) 🎁")
    let sender = from ?? js(g["buyer_name"]) ?? "GH Shopper"
    lines.append("وصلتك بطاقة هدية من \(sender) بقيمة \(plainOmr(jd(g["amount"]))) ر.ع")
    if let m = message ?? js(g["message"]), !m.isEmpty { lines.append("\n«\(m)»\n") }
    lines.append("الكود: \(jstr(g["code"]))")
    lines.append("استخدمه وقت الدفع في تطبيق GH Shopper أو ghshopper.com (خانة «استخدم بطاقة هدية»).")
    return lines.joined(separator: "\n")
}

/// بطاقات الهدايا: sold on the website or issued here; used at checkout like a code.
@MainActor
struct GiftCardsPage: View {
    @State private var cards: [JSON]?
    @State private var totals: JSON = [:]
    @State private var loadError: String?
    @State private var query = ""
    @State private var status = ""

    init() {}

    private var shown: [JSON] {
        let all = cards ?? []
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        return all.filter { g in
            if !status.isEmpty && jstr(g["status"]) != status { return false }
            if q.isEmpty { return true }
            let fields = [g["code"], g["recipient_name"], g["recipient_phone"], g["recipient_email"], g["buyer_name"], g["buyer_phone"]]
            let hay = fields.map { jstr($0) }.joined(separator: " ").lowercased()
            return hay.contains(q)
        }
    }

    var body: some View {
        GHPage("بطاقات الهدايا", onRefresh: { await load() }, trailing: {
            NavIcon("plus") { Task { await issue() } }
        }) {
            ProductSearchField(placeholder: "ابحث بالكود أو الاسم أو الرقم", text: $query)
                .padding(.horizontal, 16).padding(.top, 4)
            ChipBar {
                ChipButton("الكل", selected: status.isEmpty) { status = "" }
                ChipButton("فعّالة", selected: status == "active") { status = "active" }
                ChipButton("تنتظر الدفع", selected: status == "pending") { status = "pending" }
                ChipButton("ملغية", selected: status == "cancelled") { status = "cancelled" }
            }
            .padding(.top, 8)
            content
        }
        .task { await load() }
    }

    @ViewBuilder private var content: some View {
        if cards == nil {
            MktLoading(error: loadError, retry: { Task { await load() } })
        } else {
            stats
            if (cards ?? []).isEmpty {
                EmptyState(icon: "giftcard", title: "ما فيه بطاقات للحين",
                           message: "العميل يشتريها من الموقع، أو تصدرها أنت (هدية، تعويض، أو مدفوعة كاش).") {
                    PrimaryButton("إصدار بطاقة", icon: "plus") { Task { await issue() } }
                }
            } else if shown.isEmpty {
                EmptyState(icon: "magnifyingglass", title: "ما فيه بطاقات مطابقة")
            } else {
                GHSection {
                    ForEach(mktRows(shown)) { row in
                        giftTile(row.raw)
                    }
                }
            }
        }
    }

    private var stats: some View {
        VStack(spacing: 10) {
            HStack(spacing: 10) {
                StatCard(label: "المبيعات", value: omr(jd(totals["sold"])), icon: "giftcard.fill", hero: true)
                StatCard(label: "رصيد ما انستخدم", value: omr(jd(totals["outstanding"])), icon: "creditcard.fill", color: GH.gold)
            }
            if ji(totals["pending"]) > 0 {
                StatCard(label: "تنتظر الدفع", value: "\(ji(totals["pending"]))", icon: "clock.fill", color: GH.amber,
                         action: { status = "pending" })
            }
        }
        .padding(.horizontal, 16).padding(.top, 12)
    }

    private func giftTile(_ g: JSON) -> some View {
        let st = mktGiftState(g)
        let name = js(g["recipient_name"]) ?? "بدون اسم"
        var parts: [String] = [jstr(g["code"])]
        if let p = js(g["recipient_phone"]) ?? js(g["recipient_email"]) { parts.append(p) }
        let used = jd(g["amount"]) - jd(g["balance"])
        if used > 0.0005 { parts.append("استُخدم \(plainOmr(used)) من \(plainOmr(jd(g["amount"])))") }
        parts.append(mktDay(g["created_at"]))
        let id = jstr(g["id"])
        return Tile(name, subtitle: parts.joined(separator: " · "), value: plainOmr(jd(g["balance"])),
                    valueColor: st.key == "active" ? GH.label : GH.secondary, valueFont: TS.money,
                    action: { pushPage(MktGiftDetailPage(cardId: id, initial: g)) },
                    trailing: { Badge(st.label, color: st.color) })
    }

    private func load() async {
        do {
            let res = try await Api.shared.get("/admin/gift-cards")
            cards = mktList(res)
            totals = (res as? JSON)?["totals"] as? JSON ?? [:]
            loadError = nil
        } catch {
            loadError = mktLoadError(error)
            if cards != nil { toastError(error) }
        }
    }

    private func issue() async {
        let saved: Bool? = await Nav.shared.presentForResult { done in MktGiftIssueForm(done: done) }
        if saved == true { await load() }
    }
}

@MainActor
fileprivate struct MktGiftDetailPage: View {
    let cardId: String
    @State private var card: JSON
    @State private var busy = false

    init(cardId: String, initial: JSON) {
        self.cardId = cardId
        _card = State(initialValue: initial)
    }

    private var status: String { jstr(card["status"]) }
    private var code: String { jstr(card["code"]) }

    var body: some View {
        let st = mktGiftState(card)
        let used = jd(card["amount"]) - jd(card["balance"])
        return GHPage(code, onRefresh: { await load() }, largeTitle: false, trailing: {
            if busy { ProgressView() } else { NavIcon("doc.on.doc") { copyText(code, toastText: "انسخ الكود") } }
        }) {
            GHSection(trailing: { Badge(st.label, color: st.color) }) {
                KV("الرصيد", omr(jd(card["balance"])), strong: true)
                KV("القيمة", omr(jd(card["amount"])))
                if used > 0.0005 { KV("استُخدم", omr(used), color: GH.burgundy) }
            }
            GHSection("المستلم") {
                Tile(js(card["recipient_name"]) ?? "—", subtitle: js(card["recipient_email"]),
                     value: js(card["recipient_phone"]), chevron: false,
                     leading: { Avatar(jstr(card["recipient_name"]), size: 34) })
                if let m = js(card["message"]) {
                    Text("«\(m)»").font(TS.body).foregroundStyle(GH.label)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 16).padding(.vertical, 12)
                }
            }
            GHSection("التفاصيل") {
                KV("من", jstr(card["buyer_name"]).isEmpty ? "—" : jstr(card["buyer_name"]))
                if let p = js(card["buyer_phone"]) { KV("جوال المرسل", p) }
                KV("تاريخ الإصدار", mktDay(card["created_at"]))
                if js(card["activated_at"]) != nil { KV("تفعّلت", mktDay(card["activated_at"])) }
                if js(card["sent_at"]) != nil { KV("انرسلت بالإيميل", mktDay(card["sent_at"])) }
                KV("تنتهي", mktDay(card["expires_at"]))
            }
            usesSection
            actionsSection
        }
    }

    @ViewBuilder private var usesSection: some View {
        let uses = jlist(card["uses"])
        GHSection("الاستخدام") {
            if uses.isEmpty {
                Text("ما انستخدمت للحين").font(TS.sub).foregroundStyle(GH.secondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 16).padding(.vertical, 14)
            } else {
                ForEach(mktRows(uses)) { row in
                    useTile(row.raw)
                }
            }
        }
    }

    private func useTile(_ u: JSON) -> some View {
        let title: String
        if let o = js(u["order_id"]) { title = "طلب #\(o)" } else { title = "انتقلت لمحفظة GH" }
        return Tile(title, subtitle: mktDay(u["created_at"]), value: "− \(omr(jd(u["amount"])))",
                    valueColor: js(u["order_id"]) == nil ? GH.green : GH.burgundy, valueFont: .gh(15, .semibold),
                    chevron: false)
    }

    @ViewBuilder private var actionsSection: some View {
        let phone = js(card["recipient_phone"])
        let email = js(card["recipient_email"])
        GHSection(footer: status == "active" && phone == nil ? "ما فيه رقم للمستلم. انسخ الكود وأرسله له بنفسك." : nil) {
            Tile("نسخ الكود", action: { copyText(code, toastText: "انسخ الكود") },
                 leading: { IconBox("doc.on.doc.fill", color: GH.gold) })
            if status == "pending" {
                Tile("مدفوعة: فعّلها", subtitle: "لو انصرفت كاش أو تحويل وما تأكدت تلقائياً",
                     action: { if !busy { Task { await activate() } } },
                     leading: { IconBox("checkmark.seal.fill", color: GH.green) })
            }
            if status == "active" && phone != nil {
                Tile("أرسلها بالواتساب", subtitle: phone,
                     action: { openWhatsApp(phone: phone, text: mktGiftWhatsApp(card)) },
                     leading: { IconBox("message.fill", color: GH.green) })
            }
            if status == "active" && email != nil {
                Tile("أرسل الإيميل مرة ثانية", subtitle: email,
                     action: { if !busy { Task { await run("resend", ok: "انرسل الإيميل") } } },
                     leading: { IconBox("envelope.fill", color: GH.blue) })
            }
            if status != "cancelled" {
                Tile("إلغاء البطاقة", titleColor: GH.red, chevron: false,
                     action: { if !busy { Task { await cancel() } } },
                     leading: { IconBox("xmark.octagon.fill", color: GH.red) })
            }
        }
    }

    private func activate() async {
        let ok = await confirm("تأكدت إن البطاقة مدفوعة؟", message: "بتتفعّل، وبعدها أرسلها للمستلم بالواتساب.",
                               ok: "مدفوعة", destructive: false)
        if !ok { return }
        await run("activate", ok: "تفعّلت · أرسلها بالواتساب")
    }

    private func cancel() async {
        let ok = await confirm("تلغي البطاقة \(code)؟", message: "الرصيد الباقي ما يقدر ينستخدم.", ok: "إلغاء البطاقة")
        if !ok { return }
        await run("cancel", ok: "انلغت")
    }

    private func run(_ action: String, ok: String) async {
        busy = true
        let done = await attempt { try await Api.shared.post("/admin/gift-cards/\(cardId)/\(action)") }
        busy = false
        if done {
            toast(ok)
            await load()
        }
    }

    private func load() async {
        do {
            let res = try await Api.shared.get("/admin/gift-cards")
            if let g = mktList(res).first(where: { jstr($0["id"]) == cardId }) { card = g }
        } catch {
            toastError(error)
        }
    }
}

@MainActor
fileprivate struct MktGiftIssueForm: View {
    var done: ((Bool?) -> Void)? = nil
    @State private var amount = ""
    @State private var name = ""
    @State private var phone = ""
    @State private var email = ""
    @State private var fromName = "GH Shopper"
    @State private var message = ""
    @State private var sendWhatsApp = true
    @State private var sendEmail = true
    @State private var saving = false
    @Environment(\.dismiss) private var dismiss

    init(done: ((Bool?) -> Void)? = nil) { self.done = done }

    private let quick: [Int] = [10, 25, 50, 100, 200]

    var body: some View {
        GHPage("إصدار بطاقة هدية", largeTitle: false, trailing: {
            if saving { ProgressView() } else { NavButton("إصدار", bold: true) { Task { await save() } } }
        }, leading: {
            NavButton("إلغاء") { close(nil) }
        }) {
            GHSection("القيمة", footer: "هدية لعميل، تعويض، أو بطاقة مدفوعة كاش. تتفعّل على طول وتنتهي بعد سنة.") {
                ChipBar {
                    ForEach(quick, id: \.self) { a in
                        ChipButton("\(a)", selected: parseAmount(amount) == Double(a)) { amount = "\(a)" }
                    }
                }
                .padding(.vertical, 6)
                AmountRow("المبلغ", text: $amount)
            }
            GHSection("المستلم") {
                FieldRow("الاسم", text: $name)
                FieldRow("الجوال", text: $phone, placeholder: "9XXXXXXX", keyboard: .phone, ltr: true)
                FieldRow("الإيميل", text: $email, placeholder: "اختياري", keyboard: .email, ltr: true)
            }
            GHSection("الرسالة") {
                FieldRow("من", text: $fromName)
                NotesRow(text: $message, placeholder: "تطلع في رسالة الواتساب والإيميل")
            }
            GHSection(footer: "إصدار البطاقات للإدارة والمالية بس.") {
                SwitchRow("افتح الواتساب وأرسلها", subtitle: "لو كتبت جوال المستلم", isOn: $sendWhatsApp)
                if !email.trimmingCharacters(in: .whitespaces).isEmpty {
                    SwitchRow("أرسلها بالإيميل", isOn: $sendEmail)
                }
            }
        }
    }

    private func close(_ v: Bool?) { if let done { done(v) } else { dismiss() } }

    private func save() async {
        guard let a = parseAmount(amount), a >= 1, a <= 5000 else { toast("اكتب القيمة (من ١ لين ٥٠٠٠ ر.ع)", error: true); return }
        let n = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !n.isEmpty else { toast("اكتب اسم المستلم", error: true); return }
        let p = normalizeDigits(phone)
        let e = email.trimmingCharacters(in: .whitespaces)
        let m = message.trimmingCharacters(in: .whitespacesAndNewlines)
        let f = fromName.trimmingCharacters(in: .whitespaces)
        let payload: JSON = [
            "amount": a,
            "recipient_name": n,
            "recipient_phone": p.isEmpty ? NSNull() : p,
            "recipient_email": e.isEmpty ? NSNull() : e,
            "message": m.isEmpty ? NSNull() : m,
            "from_name": f.isEmpty ? NSNull() : f,
            "send": !e.isEmpty && sendEmail,
        ]
        saving = true
        var card: JSON = [:]
        let ok = await attempt {
            let res = try await Api.shared.post("/admin/gift-cards", payload) as? JSON ?? [:]
            card = res["data"] as? JSON ?? [:]
        }
        saving = false
        if !ok { return }
        let code = jstr(card["code"])
        if !code.isEmpty {
            UIPasteboard.general.string = code
            toast("تم إصدار \(code) · انسخ الكود")
        } else {
            toast("تم الإصدار")
        }
        let wa = sendWhatsApp && !p.isEmpty && !code.isEmpty
        let text = mktGiftWhatsApp(card, from: f.isEmpty ? nil : f, message: m.isEmpty ? nil : m)
        close(true)
        if wa { openWhatsApp(phone: p, text: text) }
    }
}

// MARK: - Automatic offers

fileprivate func mktOfferState(_ o: JSON) -> MktState {
    let state = jstr(o["state"])
    if !jb(o["is_active"]) && state != "ended" { return MktState(key: "off", label: "موقّف", color: GH.secondary) }
    switch state {
    case "live": return MktState(key: "live", label: "شغّال الحين", color: GH.green)
    case "ended": return MktState(key: "ended", label: "انتهى", color: GH.secondary)
    default: return MktState(key: "waiting", label: "ينتظر موعده", color: GH.amber)
    }
}

fileprivate func mktLocalShow(_ v: Any?) -> String? {
    guard let s = js(v), let d = mktLocalTFmt.date(from: String(s.prefix(16))) else { return nil }
    return mktShowFmt.string(from: d)
}

/// العروض التلقائية: a % off a brand or a category between two dates. Prices
/// change by themselves when it starts and go back when it ends. No code needed.
@MainActor
struct OffersPage: View {
    @State private var offers: [JSON]?
    @State private var loadError: String?
    @State private var busyId: String?

    init() {}

    var body: some View {
        GHPage("العروض التلقائية", onRefresh: { await load() }, trailing: {
            NavIcon("plus") { Task { await edit(nil) } }
        }) {
            if let list = offers {
                if list.isEmpty {
                    EmptyState(icon: "percent", title: "ما فيه عروض للحين",
                               message: "مثلاً: 15% على كل Cartier من الخميس للأحد، أو 10% على الشنط طول الأسبوع.") {
                        PrimaryButton("أضف أول عرض", icon: "plus") { Task { await edit(nil) } }
                    }
                } else {
                    GHSection(footer: "خصم على براند أو تصنيف بين تاريخين. الأسعار تتغيّر وحدها وترجع لما يخلص العرض، والسعر القديم يطلع مشطوب في التطبيق والموقع.") {
                        ForEach(mktRows(list)) { row in
                            MktOfferRow(offer: row.raw, busy: busyId == row.id,
                                        onTap: { Task { await actions(row.raw) } },
                                        onToggle: { v in Task { await setActive(row.raw, v) } })
                        }
                    }
                }
            } else {
                MktLoading(error: loadError, retry: { Task { await load() } })
            }
        }
        .task { await load() }
    }

    private func load() async {
        do {
            let res = try await Api.shared.get("/admin/offers")
            offers = mktList(res)
            loadError = nil
        } catch {
            loadError = mktLoadError(error)
            if offers != nil { toastError(error) }
        }
    }

    private func edit(_ o: JSON?) async {
        let saved: Bool? = await Nav.shared.presentForResult { done in MktOfferForm(offer: o, done: done) }
        if saved == true { await load() }
    }

    private func setActive(_ o: JSON, _ on: Bool) async {
        let id = jstr(o["id"])
        let payload: JSON = [
            "name": jstr(o["name"]),
            "percent": jd(o["percent"]),
            "brand_id": ji(o["brand_id"]) > 0 ? ji(o["brand_id"]) : NSNull(),
            "category_id": ji(o["category_id"]) > 0 ? ji(o["category_id"]) : NSNull(),
            "starts_at": nn(js(o["starts_local"])),
            "ends_at": nn(js(o["ends_local"])),
            "is_active": on,
        ]
        busyId = id
        let ok = await attempt { try await Api.shared.put("/admin/offers/\(id)", payload) }
        busyId = nil
        if ok { toast(on ? "العرض رجع" : "وقّفنا العرض ورجعت الأسعار") }
        await load()
    }

    private func actions(_ o: JSON) async {
        let st = mktOfferState(o)
        var acts: [SheetAction<String>] = [SheetAction("تعديل", "edit")]
        if st.key != "ended" {
            acts.append(SheetAction(jb(o["is_active"]) ? "وقّف العرض" : "شغّل العرض", "toggle"))
        }
        acts.append(SheetAction("حذف", "delete", destructive: true))
        let msg = "\(amountText(jd(o["percent"])))% · \(ji(o["products"])) منتج"
        guard let choice: String = await pickAction(title: jstr(o["name"]), message: msg, actions: acts) else { return }
        if choice == "edit" {
            await edit(o)
        } else if choice == "toggle" {
            await setActive(o, !jb(o["is_active"]))
        } else {
            let live = jstr(o["state"]) == "live"
            let ok = await confirm("نحذف العرض؟", message: live ? "العرض شغّال: بنرجّع الأسعار القديمة ونحذفه." : nil)
            if !ok { return }
            let id = jstr(o["id"])
            busyId = id
            let done = await attempt { try await Api.shared.delete("/admin/offers/\(id)") }
            busyId = nil
            if done { toast("انحذف"); await load() }
        }
    }
}

fileprivate struct MktOfferRow: View {
    let offer: JSON
    let busy: Bool
    let onTap: () -> Void
    let onToggle: (Bool) -> Void

    private var target: String {
        var parts: [String] = []
        if let b = js(offer["brand_name"]) { parts.append(b) }
        if let c = js(offer["category_name"]) { parts.append(c) }
        if parts.isEmpty { parts.append("—") }
        parts.append("\(ji(offer["products"])) منتج")
        return parts.joined(separator: " · ")
    }

    private var when: String {
        var s = ""
        if let a = mktLocalShow(offer["starts_local"]) { s = "من \(a)" } else { s = "يبدأ فوراً" }
        if let b = mktLocalShow(offer["ends_local"]) { s += " إلى \(b)" } else { s += " · بدون نهاية" }
        return s
    }

    var body: some View {
        let st = mktOfferState(offer)
        let on = jb(offer["is_active"])
        return HStack(spacing: 0) {
            Pressable(action: busy ? nil : onTap) {
                HStack(spacing: 12) {
                    MktValueBox(big: "\(amountText(jd(offer["percent"])))%", small: "خصم")
                    VStack(alignment: .leading, spacing: 4) {
                        HStack(spacing: 8) {
                            Text(jstr(offer["name"])).font(.gh(16, .semibold)).foregroundStyle(GH.label)
                                .lineLimit(2).multilineTextAlignment(.leading)
                            Badge(st.label, color: st.color)
                        }
                        Text(target).font(TS.sub).foregroundStyle(GH.secondary).multilineTextAlignment(.leading)
                        Text(when).font(TS.small).foregroundStyle(GH.secondary).multilineTextAlignment(.leading)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(.leading, 16).padding(.trailing, 8).padding(.vertical, 12)
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            Group {
                if busy {
                    ProgressView()
                } else if st.key != "ended" {
                    Toggle("", isOn: Binding<Bool>(get: { on }, set: { nv in onToggle(nv) }))
                        .labelsHidden().tint(GH.burgundy)
                }
            }
            .padding(.trailing, 14)
        }
    }
}

@MainActor
fileprivate struct MktOfferForm: View {
    let offer: JSON?
    var done: ((Bool?) -> Void)? = nil
    @State private var name = ""
    @State private var percent = "10"
    @State private var brandId: Int?
    @State private var categoryId: Int?
    @State private var startsAt: Date?
    @State private var endsAt: Date?
    @State private var active = true
    @State private var brands: [MktOption] = []
    @State private var cats: [MktOption] = []
    @State private var saving = false
    @Environment(\.dismiss) private var dismiss

    init(offer: JSON?, done: ((Bool?) -> Void)? = nil) {
        self.offer = offer
        self.done = done
        if let o = offer {
            _name = State(initialValue: jstr(o["name"]))
            _percent = State(initialValue: amountText(jdn(o["percent"])))
            let b = ji(o["brand_id"])
            _brandId = State(initialValue: b > 0 ? b : nil)
            let c = ji(o["category_id"])
            _categoryId = State(initialValue: c > 0 ? c : nil)
            var s: Date? = nil
            if let t = js(o["starts_local"]) { s = mktLocalTFmt.date(from: String(t.prefix(16))) }
            _startsAt = State(initialValue: s)
            var e: Date? = nil
            if let t = js(o["ends_local"]) { e = mktLocalTFmt.date(from: String(t.prefix(16))) }
            _endsAt = State(initialValue: e)
            _active = State(initialValue: jb(o["is_active"]))
        }
    }

    private var isEdit: Bool { offer != nil }

    private func label(_ id: Int?, _ options: [MktOption], _ fallback: Any?) -> String? {
        guard let id else { return nil }
        if let o = options.first(where: { $0.id == id }) { return o.name }
        return js(fallback) ?? "#\(id)"
    }

    var body: some View {
        GHPage(isEdit ? "تعديل العرض" : "عرض جديد", largeTitle: false, trailing: {
            if saving { ProgressView() } else { NavButton("حفظ", bold: true) { Task { await save() } } }
        }, leading: {
            NavButton("إلغاء") { close(nil) }
        }) {
            GHSection {
                FieldRow("اسم العرض", text: $name, placeholder: "مثلاً: عرض اليوم الوطني", autofocus: !isEdit)
                FieldRow("نسبة الخصم", text: $percent, placeholder: "10", keyboard: .decimal, suffix: "%", ltr: true)
            }
            GHSection("على", footer: "اختر براند أو تصنيف (أو الاثنين: براند داخل تصنيف).") {
                PickerRow("البراند", value: label(brandId, brands, offer?["brand_name"]), placeholder: "كل البراندات") {
                    var sel = Set<Int>()
                    if let b = brandId { sel.insert(b) }
                    pushPage(MktPickPage(title: "البراند", options: brands, selected: sel, multi: false,
                                         noneLabel: "كل البراندات", onChange: { ids in brandId = ids.first }))
                }
                PickerRow("التصنيف", value: label(categoryId, cats, offer?["category_name"]), placeholder: "كل التصنيفات") {
                    var sel = Set<Int>()
                    if let c = categoryId { sel.insert(c) }
                    pushPage(MktPickPage(title: "التصنيف", options: cats, selected: sel, multi: false,
                                         noneLabel: "كل التصنيفات", onChange: { ids in categoryId = ids.first }))
                }
            }
            GHSection("الموعد", footer: "بتوقيت مسقط. المنتجات اللي عليها عرض ثاني شغّال ما تدخل. لما يخلص العرض يرجع كل سعر لحاله (إلا إذا غيّرت السعر بيدك أثناء العرض).") {
                MktDateRow("يبدأ", hint: "فوراً", withTime: true, date: $startsAt)
                MktDateRow("ينتهي", hint: "لين توقفه", withTime: true, date: $endsAt,
                           defaultDate: Date().addingTimeInterval(3 * 86400))
            }
            GHSection {
                SwitchRow("العرض شغّال", subtitle: "لو توقفه ترجع الأسعار القديمة", isOn: $active)
            }
        }
        .task {
            if brands.isEmpty { brands = await mktLoadBrands() }
            if cats.isEmpty { cats = await mktLoadCategories() }
        }
    }

    private func close(_ v: Bool?) { if let done { done(v) } else { dismiss() } }

    private func save() async {
        let n = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !n.isEmpty else { toast("اكتب اسم العرض", error: true); return }
        guard let p = parseAmount(percent), p >= 1, p <= 90 else { toast("النسبة من ١ لين ٩٠", error: true); return }
        if brandId == nil && categoryId == nil { toast("اختر براند أو تصنيف", error: true); return }
        if let s = startsAt, let e = endsAt, e <= s { toast("تاريخ النهاية لازم يكون بعد البداية", error: true); return }
        var starts: Any = NSNull()
        if let s = startsAt { starts = mktLocalFmt.string(from: s) }
        var ends: Any = NSNull()
        if let e = endsAt { ends = mktLocalFmt.string(from: e) }
        let payload: JSON = [
            "name": n,
            "percent": p,
            "brand_id": nn(brandId),
            "category_id": nn(categoryId),
            "starts_at": starts,
            "ends_at": ends,
            "is_active": active,
        ]
        saving = true
        let id = js(offer?["id"])
        let ok = await attempt {
            if let id {
                _ = try await Api.shared.put("/admin/offers/\(id)", payload)
            } else {
                _ = try await Api.shared.post("/admin/offers", payload)
            }
        }
        saving = false
        if ok { toast("انحفظ العرض"); close(true) }
    }
}
