import SwiftUI

// التقييمات: customers' product and service reviews wait for the owner's
// approval before they show (GET /ps/reviews?status=, PUT / DELETE /ps/reviews/{kind}/{id}).

struct ReviewItem: Identifiable, Hashable {
    let id: String
    /// product or service
    var kind: String
    var rating: Int
    var comment: String?
    var customerName: String
    var productName: String?
    var invoiceNo: String?
    /// pending, approved, rejected
    var status: String
    var createdAt: Date?

    init(_ m: JSON, kind fallback: String) {
        id = jstr(m["id"])
        kind = js(m["kind"]) ?? fallback
        rating = max(0, min(5, ji(m["rating"])))
        comment = js(m["comment"])
        customerName = js(m["customer_name"]) ?? "عميل"
        productName = js(m["product_name"])
        invoiceNo = js(m["invoice_no"])
        status = js(m["status"]) ?? "pending"
        createdAt = jdate(m["created_at"])
    }

    var statusLabel: String {
        switch status {
        case "pending": return "بانتظار الموافقة"
        case "approved": return "منشور"
        case "rejected": return "مرفوض"
        default: return status
        }
    }

    var statusColor: Color {
        switch status {
        case "pending": return GH.amber
        case "approved": return GH.green
        case "rejected": return GH.red
        default: return GH.secondary
        }
    }
}

struct ReviewsPage: View {
    @State private var kind = "product"
    @State private var status = "pending"
    @State private var product: [ReviewItem] = []
    @State private var service: [ReviewItem] = []
    @State private var loaded = false
    @State private var failure: String?
    @State private var featureOff = false
    @State private var busyId: String?

    init() {}

    private let statuses: [(String, String)] = [
        ("pending", "بانتظار الموافقة"), ("approved", "المنشورة"), ("rejected", "المرفوضة"), ("all", "الكل"),
    ]

    var body: some View {
        GHPage("التقييمات", onRefresh: { await load() }) {
            Pad(top: 4) {
                Segments(value: $kind, options: [("product", "القطع · \(product.count)"), ("service", "الخدمة · \(service.count)")])
            }
            filters
            content
        }
        .task(id: status) { await load() }
    }

    private var filters: some View {
        ChipBar {
            ForEach(statuses, id: \.0) { s in
                ChipButton(s.1, selected: status == s.0) { status = s.0 }
            }
        }
        .padding(.top, 4)
    }

    private var list: [ReviewItem] { kind == "product" ? product : service }

    @ViewBuilder private var content: some View {
        if !loaded {
            LoadingView()
        } else if featureOff {
            GHFeatureOffState(feature: "reviews")
        } else if let failure, product.isEmpty && service.isEmpty {
            EmptyState(icon: "wifi.exclamationmark", title: "ما قدرنا نجيب التقييمات", message: failure) {
                SecondaryButton("حاول مرة ثانية", icon: "arrow.clockwise") { Task { await load() } }
            }
        } else if list.isEmpty {
            EmptyState(icon: "star", title: status == "pending" ? "ما في تقييمات تنتظر" : "ما في تقييمات",
                       message: kind == "product" ? "تقييمات القطع من العملاء تطلع هنا." : "تقييم الخدمة بعد التوصيل يطلع هنا.")
        } else {
            GHSection(footer: status == "pending" ? "التقييم ما يطلع للعملاء إلا بعد ما توافق عليه." : nil) {
                ForEach(list) { r in
                    ReviewRow(review: r, busy: busyId == r.id, onTap: { Task { await actions(r) } })
                }
            }
        }
    }

    private func load() async {
        let q = status == "all" ? "" : "?status=\(status)"
        do {
            let res = try await Api.shared.get("/ps/reviews\(q)") as? JSON ?? [:]
            product = jlist(res["product"]).map { ReviewItem($0, kind: "product") }
            service = jlist(res["service"]).map { ReviewItem($0, kind: "service") }
            failure = nil
            featureOff = false
        } catch {
            if let e = error as? ApiError, e.status == 403 { featureOff = true }
            failure = errorText(error)
        }
        loaded = true
    }

    private func actions(_ r: ReviewItem) async {
        var list: [SheetAction<String>] = []
        if r.status != "approved" { list.append(SheetAction("وافق وانشر", "approved")) }
        if r.status != "rejected" { list.append(SheetAction("ارفض", "rejected")) }
        list.append(SheetAction("حذف", "delete", destructive: true))
        let title = "\(r.customerName) · \(String(repeating: "★", count: r.rating))"
        guard let a = await pickAction(title: title, message: r.comment, actions: list) else { return }
        if a == "delete" {
            guard await confirm("حذف التقييم؟") else { return }
        }
        busyId = r.id
        let ok = await attempt {
            if a == "delete" {
                try await Api.shared.delete("/ps/reviews/\(r.kind)/\(r.id)")
            } else {
                try await Api.shared.put("/ps/reviews/\(r.kind)/\(r.id)", ["status": a])
            }
        }
        busyId = nil
        if ok {
            toast(a == "delete" ? "انحذف" : (a == "approved" ? "انتشر التقييم ✓" : "انرفض"))
            await load()
        }
    }
}

fileprivate struct ReviewRow: View {
    let review: ReviewItem
    let busy: Bool
    let onTap: () -> Void

    private var subtitle: String {
        var parts: [String] = []
        if let p = review.productName { parts.append(p) }
        if let i = review.invoiceNo { parts.append(i) }
        parts.append(dateStr(review.createdAt))
        return parts.joined(separator: " · ")
    }

    var body: some View {
        Pressable(action: busy ? nil : onTap) {
            VStack(alignment: .leading, spacing: 6) {
                top
                if let c = review.comment {
                    Text(c).font(TS.body).foregroundStyle(GH.label)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                Text(subtitle).font(TS.small).foregroundStyle(GH.secondary)
            }
            .padding(.horizontal, 16).padding(.vertical, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }

    private var top: some View {
        HStack(spacing: 8) {
            Avatar(review.customerName, size: 28)
            Text(review.customerName).font(.gh(15, .semibold)).foregroundStyle(GH.label)
            ReviewStars(rating: review.rating)
            Spacer(minLength: 6)
            if busy {
                ProgressView()
            } else {
                Badge(review.statusLabel, color: review.statusColor)
            }
        }
    }
}

fileprivate struct ReviewStars: View {
    let rating: Int

    var body: some View {
        HStack(spacing: 1) {
            ForEach(1...5, id: \.self) { k in
                Image(systemName: k <= rating ? "star.fill" : "star")
                    .font(.system(size: 11))
                    .foregroundStyle(k <= rating ? GH.gold : GH.tertiary)
            }
        }
    }
}
