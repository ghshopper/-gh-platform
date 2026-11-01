import SwiftUI

/// Why an order's balance might not be what you expect.
fileprivate enum BalanceFlag: Hashable {
    case cancelledWithMoney      // every piece cancelled, money still on it
    case overpaid                // paid more than the order's total
    case notBoughtYet(Int)       // pieces still «بانتظار الشراء» (bought but not recorded?)
    case deliveryPaid            // the delivery fee is part of what she paid

    var text: String {
        switch self {
        case .cancelledWithMoney: return "الطلب ملغي وفيه دفعات: رجّع لها الفلوس وسجّل الاسترجاع"
        case .overpaid: return "دافعة أكثر من قيمة الطلب"
        case .notBoughtYet(let n): return "\(n) قطعة لسا «بانتظار الشراء»: إذا اشتريتها سجّل الشراء"
        case .deliveryPaid: return "الرصيد فيه رسوم التوصيل اللي دفعتها مقدّم"
        }
    }
    var important: Bool {
        switch self {
        case .cancelledWithMoney, .overpaid: return true
        default: return false
        }
    }
}

fileprivate struct BalanceRow: Identifiable {
    let order: Order
    let balance: Double
    let flags: [BalanceFlag]
    var id: String { order.id }
}

/// «أرصدة العملاء عندك» opened up: every open order holding customer money,
/// how its balance is worked out, and what might make it look wrong.
struct BalancesPage: View {
    @ObservedObject private var store = Store.shared
    @State private var onlyFlagged = false

    private var rows: [BalanceRow] {
        store.orders.compactMap { o in
            guard !o.allDelivered else { return nil }
            let b = o.customerBalance
            guard abs(b) > 0.0005 else { return nil }
            var f: [BalanceFlag] = []
            if o.activeItems.isEmpty && o.paid > 0.0005 { f.append(.cancelledWithMoney) }
            if o.paid > o.total + 0.0005 && !o.activeItems.isEmpty { f.append(.overpaid) }
            let waiting = o.activeItems.filter { $0.status == .requested }.count
            if waiting > 0 && b > 0 { f.append(.notBoughtYet(waiting)) }
            if o.deliveryFee > 0 && b > 0.0005 && o.paid > o.itemsTotal - o.discount + 0.0005 { f.append(.deliveryPaid) }
            return BalanceRow(order: o, balance: b, flags: f)
        }
    }

    var body: some View {
        let all = rows
        let held = all.filter { $0.balance > 0 }
        let owing = all.filter { $0.balance < 0 }
        let flagged = held.filter { $0.flags.contains(where: { $0.important }) }
        GHPage("أرصدة العملاء") {
            Pad(top: 4) {
                HStack(spacing: 10) {
                    StatCard(label: "عندك من العملاء", value: omr(held.reduce(0) { $0 + $1.balance }),
                             icon: "creditcard.fill", hero: true)
                    StatCard(label: "تحتاج مراجعة", value: "\(flagged.count)", icon: "exclamationmark.triangle.fill",
                             color: flagged.isEmpty ? GH.green : GH.amber)
                }
            }
            GHSection(footer: "الرصيد = اللي دفعته العميلة − قيمة القطع اللي اشتريتها لها (بعد الخصم). القطعة أول ما تنسجل «تم الشراء» تطلع من الرصيد. الطلب المسلّم كامل ما يدخل.") {
                Segments(value: $onlyFlagged, options: [(false, "الكل · \(held.count)"), (true, "تحتاج مراجعة · \(flagged.count)")])
            }
            let shown = (onlyFlagged ? flagged : held).sorted { $0.balance > $1.balance }
            if shown.isEmpty {
                EmptyState(icon: "checkmark.seal", title: onlyFlagged ? "ما في شي يحتاج مراجعة" : "ما في أرصدة عندك")
            } else {
                GHSection("الطلبات اللي فيها رصيد") {
                    ForEach(shown) { r in row(r) }
                }
            }
            if !owing.isEmpty && !onlyFlagged {
                GHSection("اشتريت لهم أكثر من اللي دفعوه · \(owing.count)",
                          footer: "هذي ما تنقص من الرصيد فوق، وتطلع في «عند العملاء» لما يحين وقتها.") {
                    ForEach(owing.sorted { $0.balance < $1.balance }) { r in row(r) }
                }
            }
        }
    }

    private func row(_ r: BalanceRow) -> some View {
        let o = r.order
        return Pressable(action: { pushPage(OrderDetailPage(orderId: o.id)) }) {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(store.customerName(o)).font(TS.title).foregroundStyle(GH.label)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    Text(omr(r.balance)).font(TS.money)
                        .foregroundStyle(r.balance < 0 ? GH.red : GH.green)
                }
                Text("\(o.invoiceNo) · \(dateStr(o.createdAt))\(store.trip(o.tripId).map { " · \($0.name)" } ?? "")")
                    .font(TS.sub).foregroundStyle(GH.secondary)
                Text("دفعت \(omr(o.paid))  −  قطع مشتراة \(omr(o.boughtValue))  =  \(omr(r.balance))")
                    .font(.gh(13).monospacedDigit()).foregroundStyle(GH.secondary)
                ForEach(r.flags, id: \.self) { f in
                    HStack(alignment: .top, spacing: 6) {
                        Image(systemName: f.important ? "exclamationmark.triangle.fill" : "info.circle")
                            .font(.system(size: 12)).foregroundStyle(f.important ? GH.amber : GH.tertiary)
                            .padding(.top, 2)
                        Text(f.text).font(.gh(13)).foregroundStyle(f.important ? GH.label : GH.secondary)
                    }
                }
            }
            .padding(.horizontal, 16).padding(.vertical, 12)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}
