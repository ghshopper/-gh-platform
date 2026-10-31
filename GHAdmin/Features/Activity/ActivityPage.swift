import SwiftUI

// سجل النشاط: who did what (GET /ps/activity, full admins only).
// ActivityPage() = everyone; ActivityPage(orderId:) = what was done on one order
// (opened from the bottom of OrderDetailPage).

/// One line of the log.
struct StaffActivityEntry: Identifiable, Hashable {
    let id: Int
    var userId: String?
    var userName: String?
    var action: String
    var subjectType: String?
    var subjectId: String?
    var orderId: String?
    var orderRef: String?
    var summary: String
    var at: Date?

    init(_ m: JSON) {
        id = ji(m["id"])
        userId = js(m["user_id"])
        userName = js(m["user_name"])
        action = jstr(m["action"])
        subjectType = js(m["subject_type"])
        subjectId = js(m["subject_id"])
        orderId = js(m["order_id"])
        orderRef = js(m["order_ref"])
        summary = jstr(m["summary"])
        at = jdate(m["created_at"])
    }

    /// SF Symbol for the kind of change.
    var icon: String {
        switch action {
        case "item_price", "discount", "delivery_fee": return "tag.fill"
        case "payment_added": return "dollarsign.circle.fill"
        case "payment_deleted": return "minus.circle.fill"
        case "refund", "item_returned", "item_exchanged": return "arrow.uturn.left.circle.fill"
        case "item_status", "item_purchase": return "checkmark.circle.fill"
        case "item_cancelled", "item_deleted", "order_deleted", "customer_deleted", "staff_deleted": return "trash.fill"
        case "order_created", "item_added": return "plus.circle.fill"
        case "wallet": return "wallet.pass.fill"
        case "partner", "coupon": return "person.2.fill"
        default: return "pencil.circle.fill"
        }
    }

    var color: Color {
        switch action {
        case "item_price", "discount", "delivery_fee": return GH.gold
        case "payment_added": return GH.green
        case "refund", "item_returned", "item_exchanged", "payment_deleted": return GH.amber
        case "item_cancelled", "item_deleted", "order_deleted", "customer_deleted", "staff_deleted": return GH.red
        case "order_created", "item_added": return GH.blue
        default: return GH.burgundy
        }
    }
}

struct StaffActivityPerson: Identifiable, Hashable {
    let id: String
    var name: String
    var count: Int
}

struct StaffActivityResult {
    var entries: [StaffActivityEntry]
    var nextBeforeId: Int?
    var staff: [StaffActivityPerson]
}

extension Store {
    /// One page (50) of سجل النشاط, newest first. beforeId: the page after.
    func staffActivity(userId: String? = nil, orderId: String? = nil, query: String? = nil, beforeId: Int? = nil) async throws -> StaffActivityResult {
        var q: [String] = []
        func add(_ k: String, _ v: String?) {
            guard let v, !v.isEmpty else { return }
            let allowed = CharacterSet(charactersIn: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~")
            q.append("\(k)=\(v.addingPercentEncoding(withAllowedCharacters: allowed) ?? "")")
        }
        add("user_id", userId)
        add("order_id", orderId)
        add("q", query)
        add("before_id", beforeId.map { String($0) })
        let res = try await Api.shared.get("/ps/activity" + (q.isEmpty ? "" : "?" + q.joined(separator: "&"))) as? JSON ?? [:]
        let next = jdn(res["next_before_id"]).map { Int($0) }
        let staff = jlist(res["staff"]).map { StaffActivityPerson(id: jstr($0["id"]), name: jstr($0["name"]), count: ji($0["count"])) }
        return StaffActivityResult(entries: jlist(res["data"]).map(StaffActivityEntry.init), nextBeforeId: next, staff: staff)
    }
}

/// «الحين» · «قبل 5 دقايق» · «قبل 3 ساعات» · «أمس» · then the date.
func activityAgo(_ d: Date?) -> String {
    guard let d else { return "—" }
    let s = Date().timeIntervalSince(d)
    if s < 60 { return "الحين" }
    let m = Int(s / 60)
    if m < 60 { return m == 1 ? "قبل دقيقة" : "قبل \(m) دقيقة" }
    let h = m / 60
    if h < 24 { return h == 1 ? "قبل ساعة" : "قبل \(h) ساعة" }
    let days = h / 24
    if days == 1 { return "أمس" }
    if days < 7 { return "قبل \(days) أيام" }
    return dateTimeStr(d)
}

struct ActivityPage: View {
    let orderId: String?
    @ObservedObject private var store = Store.shared
    @State private var entries: [StaffActivityEntry] = []
    @State private var staff: [StaffActivityPerson] = []
    @State private var userId: String?
    @State private var query = ""
    @State private var nextBeforeId: Int?
    @State private var loaded = false
    @State private var loadingMore = false
    @State private var failure: String?

    init(orderId: String? = nil) {
        self.orderId = orderId
    }

    private var title: String {
        if let id = orderId, let o = store.order(id) { return "سجل الطلب \(o.invoiceNo)" }
        return orderId == nil ? "سجل النشاط" : "سجل الطلب"
    }

    private var filterKey: String { "\(userId ?? "")|\(query)" }

    var body: some View {
        GHPage(title, onRefresh: { await load() }) {
            if !Api.shared.access.full {
                EmptyState(icon: "lock.fill", title: "سجل النشاط للمدير فقط")
            } else {
                filters
                content
            }
        }
        .task(id: filterKey) {
            // a short wait while typing, then the first page
            if loaded { try? await Task.sleep(nanoseconds: 350_000_000) }
            if Task.isCancelled { return }
            await load()
        }
    }

    // MARK: filters

    @ViewBuilder private var filters: some View {
        ActivitySearchBox(text: $query, placeholder: orderId == nil ? "بحث: اسم قطعة، رقم طلب، مبلغ" : "بحث في سجل الطلب")
            .padding(.horizontal, 16).padding(.top, 4)
        if staff.count > 1 || userId != nil {
            ChipBar {
                ChipButton("الكل", selected: userId == nil) { userId = nil }
                ForEach(staff) { p in
                    ChipButton(p.name, selected: userId == p.id) { userId = userId == p.id ? nil : p.id }
                }
            }
            .padding(.top, 10)
        }
    }

    // MARK: list

    @ViewBuilder private var content: some View {
        if !loaded {
            LoadingView()
        } else if let failure, entries.isEmpty {
            EmptyState(icon: "wifi.exclamationmark", title: "ما قدرنا نجيب السجل", message: failure) {
                SecondaryButton("حاول مرة ثانية", icon: "arrow.clockwise") { Task { await load() } }
            }
        } else if entries.isEmpty {
            EmptyState(icon: "clock.arrow.circlepath", title: query.isEmpty && userId == nil ? "ما في نشاط مسجّل للحين" : "ما في نتائج",
                       message: query.isEmpty && userId == nil ? "أي تعديل يسويه الفريق (أسعار، دفعات، حالات، حذف) بيطلع هنا." : nil)
        } else {
            GHSection(orderId == nil ? nil : "مين سوّى إيش", footer: "يبقى السجل 180 يوم.") {
                ForEach(entries) { e in row(e) }
                if nextBeforeId != nil {
                    Tile(loadingMore ? "يحمّل…" : "عرض المزيد", titleColor: GH.burgundy, chevron: false,
                         action: moreAction,
                         leading: { IconBox("arrow.down.circle", color: GH.burgundy, size: 28) })
                }
            }
        }
    }

    private var moreAction: (() -> Void)? {
        if loadingMore { return nil }
        return { Task { await loadMore() } }
    }

    private func canOpen(_ e: StaffActivityEntry) -> Bool {
        guard orderId == nil, let id = e.orderId else { return false }
        return store.order(id) != nil
    }

    private func row(_ e: StaffActivityEntry) -> some View {
        let open = canOpen(e)
        var tap: (() -> Void)? = nil
        if open, let id = e.orderId { tap = { pushPage(OrderDetailPage(orderId: id)) } }
        return Pressable(action: tap) {
            HStack(alignment: .top, spacing: 12) {
                ZStack(alignment: .bottomTrailing) {
                    Avatar(e.userName ?? "", size: 36)
                    Image(systemName: e.icon)
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Color.white)
                        .frame(width: 17, height: 17)
                        .background(Circle().fill(e.color))
                        .overlay(Circle().stroke(GH.card, lineWidth: 1.5))
                        .offset(x: 3, y: 3)
                }
                VStack(alignment: .leading, spacing: 3) {
                    Text(e.summary).font(TS.body).foregroundStyle(GH.label)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                    Text("\(e.userName ?? "—") · \(activityAgo(e.at))")
                        .font(TS.small).foregroundStyle(GH.secondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if open {
                    Image(systemName: "chevron.forward").font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(GH.tertiary).padding(.top, 10)
                }
            }
            .padding(.leading, 16).padding(.trailing, 14).padding(.vertical, 12)
        }
        .contextMenu {
            Button { copyText(e.summary, toastText: "نسخت") } label: { Label("نسخ", systemImage: "doc.on.doc") }
        }
    }

    // MARK: loading

    private func load() async {
        guard Api.shared.access.full else { loaded = true; return }
        do {
            let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
            let page = try await store.staffActivity(userId: userId, orderId: orderId, query: q.isEmpty ? nil : normalizeDigits(q))
            entries = page.entries
            nextBeforeId = page.nextBeforeId
            if !page.staff.isEmpty || staff.isEmpty { staff = page.staff }
            failure = nil
        } catch {
            if !(error is CancellationError) { failure = errorText(error) }
        }
        loaded = true
    }

    private func loadMore() async {
        guard let before = nextBeforeId, !loadingMore else { return }
        loadingMore = true
        do {
            let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
            let page = try await store.staffActivity(userId: userId, orderId: orderId, query: q.isEmpty ? nil : normalizeDigits(q), beforeId: before)
            let seen = Set(entries.map(\.id))
            entries += page.entries.filter { !seen.contains($0.id) }
            nextBeforeId = page.nextBeforeId
        } catch {
            toastError(error)
        }
        loadingMore = false
    }
}

fileprivate struct ActivitySearchBox: View {
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
