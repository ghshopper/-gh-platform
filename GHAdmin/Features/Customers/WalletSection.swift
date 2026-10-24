import SwiftUI

// محفظة GH on the customer page: balance, ledger (GET /ps/wallets/{userId}),
// add / remove credit with a required note (POST /ps/wallets/{userId}).

struct WalletEntry: Identifiable, Hashable {
    let id: String
    var type: String
    var typeLabel: String?
    var amount: Double
    var balanceAfter: Double?
    var note: String?
    var orderNumber: String?
    var createdAt: Date?

    init(_ m: JSON) {
        id = jstr(m["id"])
        type = jstr(m["type"])
        typeLabel = js(m["type_label_ar"])
        amount = jd(m["amount"])
        balanceAfter = jdn(m["balance_after"])
        note = js(m["note"])
        orderNumber = js(m["order_number"])
        createdAt = jdate(m["created_at"])
    }

    var label: String {
        switch type {
        case "topup": return "شحن رصيد"
        case "points": return "تحويل نقاط"
        case "spend": return "دفع طلب"
        case "refund": return "استرجاع"
        case "credit": return "رصيد من GH"
        case "debit": return "خصم من الرصيد"
        case "gift_card": return "بطاقة هدية"
        default: return typeLabel ?? type
        }
    }

    var icon: String {
        switch type {
        case "topup": return "creditcard.fill"
        case "points": return "star.circle.fill"
        case "spend": return "bag.fill"
        case "refund": return "arrow.uturn.backward.circle.fill"
        case "gift_card": return "giftcard.fill"
        case "debit": return "minus.circle.fill"
        default: return "plus.circle.fill"
        }
    }
}

struct CustomerWalletSection: View {
    let customerId: String
    let name: String
    @State private var balance: Double
    @State private var entries: [WalletEntry] = []
    @State private var loaded = false
    @State private var hidden = false
    @State private var busy = false
    @State private var showAll = false

    init(customerId: String, name: String, initialBalance: Double = 0) {
        self.customerId = customerId
        self.name = name
        _balance = State(initialValue: initialBalance)
    }

    var body: some View {
        Group {
            if !hidden {
                section
            }
        }
        .task(id: customerId) { await load() }
    }

    private var shown: [WalletEntry] { showAll ? entries : Array(entries.prefix(5)) }

    private var section: some View {
        let count = entries.count
        return GHSection("محفظة GH", trailing: {
            if count > 5 {
                HeaderButton(showAll ? "أقل" : "الكل · \(count)") { showAll.toggle() }
            }
        }) {
            Tile("الرصيد", value: omr(balance), valueColor: balance > 0 ? GH.green : GH.secondary,
                 valueFont: TS.money, chevron: false,
                 leading: { IconBox("wallet.pass.fill", color: GH.green) },
                 trailing: { if busy { ProgressView() } })
            if !loaded {
                LoadingView()
            }
            ForEach(shown) { e in WalletEntryRow(entry: e) }
            Tile("أضف رصيد", titleColor: GH.burgundy, chevron: false,
                 action: act { Task { await change(add: true) } },
                 leading: { IconBox("plus", color: GH.green) })
            if balance > 0 {
                Tile("اخصم من الرصيد", titleColor: GH.red, chevron: false,
                     action: act { Task { await change(add: false) } },
                     leading: { IconBox("minus", color: GH.red) })
            }
        }
    }

    private func act(_ f: @escaping () -> Void) -> (() -> Void)? { busy ? nil : f }

    private func apply(_ res: JSON) {
        if res["balance"] != nil { balance = jd(res["balance"]) }
        if res["transactions"] != nil { entries = jlist(res["transactions"]).map(WalletEntry.init) }
    }

    private func load() async {
        do {
            let res = try await Api.shared.get("/ps/wallets/\(customerId)") as? JSON ?? [:]
            apply(res)
            hidden = false
        } catch {
            // 403: محفظة GH is switched off (or no access): the section stays hidden.
            if let e = error as? ApiError, e.status == 403 { hidden = true }
        }
        loaded = true
    }

    private func change(add: Bool) async {
        let title = add ? "أضف رصيد لـ \(name)" : "اخصم من رصيد \(name)"
        guard let t = await promptText(title, message: add ? nil : "الرصيد الحالي \(omr(balance))",
                                       placeholder: "0.000", keyboard: .decimalPad) else { return }
        guard let amount = parseAmount(t), amount > 0 else {
            toast("اكتب المبلغ", error: true)
            return
        }
        if !add && amount > balance + 0.0005 {
            toast("المبلغ أكثر من الرصيد", error: true)
            return
        }
        guard let n = await promptText("السبب", message: "يطلع للعميل في سجل المحفظة",
                                       placeholder: add ? "تعويض عن تأخير التوصيل" : "تصحيح رصيد") else { return }
        let note = n.trimmingCharacters(in: .whitespacesAndNewlines)
        if note.isEmpty {
            toast("اكتب السبب", error: true)
            return
        }
        busy = true
        let signed = add ? amount : -amount
        let ok = await attempt {
            let res = try await Api.shared.post("/ps/wallets/\(customerId)", ["amount": signed, "note": note]) as? JSON ?? [:]
            apply(res)
        }
        if ok {
            toast(add ? "انضاف \(omr(amount)) للمحفظة" : "انخصم \(omr(amount))")
            await load()
        }
        busy = false
    }
}

fileprivate struct WalletEntryRow: View {
    let entry: WalletEntry

    private var subtitle: String {
        var parts: [String] = []
        if let n = entry.note { parts.append(n) }
        if let o = entry.orderNumber { parts.append(o) }
        parts.append(dateStr(entry.createdAt))
        return parts.joined(separator: " · ")
    }

    private var signedText: String {
        let sign = entry.amount >= 0 ? "+" : "−"
        return "\(sign)\(omr(abs(entry.amount)))"
    }

    var body: some View {
        Tile(entry.label, subtitle: subtitle, value: signedText,
             valueColor: entry.amount >= 0 ? GH.green : GH.red, valueFont: .gh(15, .semibold), chevron: false,
             leading: { IconBox(entry.icon, color: entry.amount >= 0 ? GH.green : GH.secondary, size: 28) })
    }
}
