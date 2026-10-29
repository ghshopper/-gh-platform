import SwiftUI

/// One partner (a personal shopper who orders from us for her clients) and her account.
fileprivate struct PartnerRow: Identifiable {
    let id: String
    let name: String
    let phone: String?
    let discount: Double?
    let orders: Int
    let openPieces: Int
    let total: Double
    let paid: Double
    let remaining: Double
    let portalUrl: String?

    init(_ m: JSON) {
        id = jstr(m["customer_id"])
        name = jstr(m["name"])
        phone = js(m["phone"])
        discount = jdn(m["discount"])
        orders = ji(m["orders"])
        openPieces = ji(m["open_pieces"])
        total = jd(m["total"])
        paid = jd(m["paid"])
        remaining = jd(m["remaining"])
        portalUrl = js(m["portal_url"])
    }
}

/// «الشركاء»: the personal shoppers who order from us, what each owes, and their pieces still on the way.
struct PartnersPage: View {
    @State private var rows: [PartnerRow] = []
    @State private var loaded = false
    @State private var failure: String?

    var body: some View {
        GHPage("الشركاء", onRefresh: { await load() }) {
            content
        }
        .task { await load() }
    }

    @ViewBuilder private var content: some View {
        if !loaded {
            LoadingView()
        } else if let failure {
            EmptyState(icon: "wifi.exclamationmark", title: "ما قدرنا نجيب الشركاء", message: failure) {
                SecondaryButton("حاول مرة ثانية", icon: "arrow.clockwise") { Task { await load() } }
            }
        } else if rows.isEmpty {
            EmptyState(icon: "person.2", title: "ما عندك شركاء للحين",
                       message: "افتح صفحة العميل وفعّل «شريك» للبيرسونال شوبر اللي تطلب منك لعملائها.")
        } else {
            let owed = rows.reduce(0) { $0 + $1.remaining }
            let open = rows.reduce(0) { $0 + $1.openPieces }
            Pad(top: 4) {
                HStack(spacing: 10) {
                    StatCard(label: "عليهم", value: omr(owed), icon: "creditcard.fill", hero: true)
                    StatCard(label: "قطع في الطريق", value: "\(open)", icon: "shippingbox.fill", color: GH.blue)
                }
            }
            GHSection("\(rows.count) شريك") {
                ForEach(rows) { r in
                    Tile(r.name,
                         subtitle: subtitle(r),
                         value: r.remaining > 0.0005 ? omr(r.remaining) : "خالص",
                         valueColor: r.remaining > 0.0005 ? GH.red : GH.green,
                         action: { pushPage(CustomerDetailPage(customerId: r.id)) },
                         leading: { Avatar(r.name) })
                }
            }
        }
    }

    private func subtitle(_ r: PartnerRow) -> String {
        var p = ["\(r.orders) طلب"]
        if r.openPieces > 0 { p.append("\(r.openPieces) قطعة في الطريق") }
        if let d = r.discount, d > 0 { p.append("خصم \(Int(d))٪") }
        p.append("دفعت \(omr(r.paid))")
        return p.joined(separator: " · ")
    }

    private func load() async {
        do {
            let res = try await Api.shared.get("/ps/partners") as? JSON ?? [:]
            rows = jlist(res["partners"]).map(PartnerRow.init)
            failure = nil
        } catch {
            failure = error.localizedDescription
        }
        loaded = true
    }
}
