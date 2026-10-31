import SwiftUI

// الإرجاع والاستبدال of one piece (POST /ps/items/{id}/return).
// Opened from the piece's actions in OrderDetailPage. An exchange is a return
// first; then the add-item form opens on the same order for the new piece.

extension OrderItem {
    /// Came back from the customer (it stays on the order, cancelled, with the reason).
    var isReturned: Bool { returnedAt != nil }
    var isExchange: Bool { returnKind == "exchange" }

    /// «مرجّعة» / «استبدال» badge text.
    var returnBadge: String { isExchange ? "استبدال" : "مرجّعة" }

    var returnReasonLabel: String? { ReturnReason.label(returnReason) }

    /// «المقاس · تبي مقاس أكبر · رجعت للبوتيك»
    var returnLine: String? {
        guard isReturned else { return nil }
        var parts: [String] = []
        if let r = returnReasonLabel { parts.append(r) }
        if let n = returnNote?.trimmingCharacters(in: .whitespacesAndNewlines), !n.isEmpty { parts.append(n) }
        if returnedToBoutique { parts.append("رجعت للبوتيك") }
        if let at = returnedAt { parts.append(dateStr(at)) }
        return parts.joined(separator: " · ")
    }
}

/// Why it came back (the server keys).
enum ReturnReason {
    static let keys = ["size", "defect", "changed_mind", "other"]

    static func label(_ key: String?, male: Bool = false) -> String? {
        switch key {
        case "size": return "المقاس"
        case "defect": return "فيها عيب"
        case "changed_mind": return male ? "غيّر رأيه" : "غيّرت رأيها"
        case "other": return "سبب ثاني"
        default: return nil
        }
    }
}

extension Store {
    /// Returns (or exchanges) one piece; the order refreshes after. Gives back the server's answer
    /// (refunded, restocked, points_back, tax_free_lost_pct).
    @discardableResult
    func returnItem(_ item: OrderItem, kind: String, reason: String, note: String?, refund: String,
                    amount: Double, restock: Bool, backToBoutique: Bool) async throws -> JSON {
        let body: JSON = [
            "kind": kind,
            "reason": reason,
            "note": nn(note),
            "refund": refund,
            "refund_amount": refund == "none" ? 0 : amount,
            "restock": restock,
            "back_to_boutique": backToBoutique,
        ]
        let res = try await Api.shared.post("/ps/items/\(item.id)/return", body) as? JSON ?? [:]
        await refresh()
        return res
    }
}

struct ReturnItemPage: View {
    let order: Order
    let item: OrderItem
    @State private var kind = "return"
    @State private var reason = "size"
    @State private var note = ""
    @State private var refund: String
    @State private var amount: String
    @State private var restock: Bool
    @State private var backToBoutique = false
    @State private var saving = false
    @Environment(\.dismiss) private var dismiss

    init(order: Order, item: OrderItem) {
        self.order = order
        self.item = item
        let d = ReturnItemPage.defaultRefund(order, item)
        _amount = State(initialValue: d > 0.0005 ? amountText((d * 1000).rounded() / 1000) : "")
        _refund = State(initialValue: d > 0.0005 ? "transfer" : "none")
        _restock = State(initialValue: item.productId != nil && item.instant)
    }

    /// What the customer paid for this piece: its price after its share of the discount, never more than what was paid.
    static func defaultRefund(_ o: Order, _ i: OrderItem) -> Double {
        let share = o.itemsTotal > 0.0005 ? max(0, o.netSales) / o.itemsTotal : 1
        return max(0, min(o.paid, i.price * share))
    }

    /// The most the server accepts: what was paid, and not more than the piece's price.
    private var cap: Double { max(0, min(order.paid, item.price)) }

    private var customer: Customer? { Store.shared.customer(order.customerId) }

    private var refundOptions: [(String, String)] {
        var o: [(String, String)] = [("none", "بدون"), ("cash", "نقداً"), ("transfer", "تحويل")]
        if customer != nil { o.append(("wallet", "المحفظة")) }
        return o
    }

    var body: some View {
        GHPage(kind == "exchange" ? "استبدال قطعة" : "إرجاع قطعة", largeTitle: false, trailing: {
            if saving { ProgressView() }
        }, leading: {
            NavButton("إلغاء", action: { dismiss() })
        }, bottom: {
            PrimaryButton(kind == "exchange" ? "سجّل الإرجاع وأضف البديل" : "سجّل الإرجاع",
                          icon: "arrow.uturn.left", busy: saving, action: { Task { await save() } })
        }) {
            pieceSection
            kindSection
            reasonSection
            refundSection
            stockSection
        }
    }

    // MARK: sections

    private var pieceSection: some View {
        GHSection {
            Tile(item.title, subtitle: order.invoiceNo, value: omr(item.price), valueColor: GH.label, chevron: false,
                 leading: { IconBox("bag", color: GH.burgundy) },
                 trailing: { Badge(item.status.label, color: item.status.color) })
        }
    }

    private var kindSection: some View {
        GHSection("نوع العملية", footer: kind == "exchange"
                  ? "نسجّل إرجاع هذي القطعة، وبعدها تنفتح صفحة إضافة القطعة البديلة في نفس الطلب."
                  : "القطعة تطلع من مجموع الطلب وتبقى ظاهرة فيه كمرجّعة.") {
            Segments(value: $kind, options: [("return", "إرجاع"), ("exchange", "استبدال")])
        }
    }

    private var reasonSection: some View {
        GHSection("السبب") {
            ChipBar {
                ForEach(ReturnReason.keys, id: \.self) { k in
                    ChipButton(ReturnReason.label(k, male: customer?.isMale ?? false) ?? k, selected: reason == k) { reason = k }
                }
            }
            .padding(.vertical, 8)
            NotesRow(text: $note, placeholder: "ملاحظة (اختياري): مثلاً تبي مقاس أكبر")
        }
    }

    private var refundFooter: String {
        var s = "المدفوع على الطلب \(omr(order.paid)). أكثر شي ترجّعه \(omr(cap))."
        if refund == "wallet", let c = customer { s += " رصيد محفظة \(c.firstName) الحين \(omr(c.walletBalance))." }
        if refund == "none" { s = "ما بترجع فلوس. المدفوع يبقى على الطلب (رصيد للعميل)." }
        return s
    }

    private var refundSection: some View {
        GHSection("المبلغ المسترجع", footer: refundFooter) {
            Segments(value: $refund, options: refundOptions)
            if refund != "none" {
                AmountRow("المبلغ", text: $amount)
            }
        }
    }

    @ViewBuilder private var stockSection: some View {
        let canRestock = item.productId != nil && !backToBoutique
        let canBoutique = !item.instant
        if canRestock || canBoutique {
            GHSection("وين راحت القطعة", footer: stockFooter) {
                if canBoutique {
                    SwitchRow("رجعت للبوتيك", subtitle: "رجّعناها للمحل اللي اشتريناها منه", isOn: $backToBoutique)
                }
                if canRestock {
                    SwitchRow("رجّعها للمخزون", subtitle: "تنعرض في المتجر تسليم فوري", isOn: $restock)
                }
            }
        }
    }

    private var stockFooter: String? {
        guard backToBoutique, item.hasTaxFree else { return nil }
        let tf = money(item.taxFreeAmount, item.costCurrency ?? "EUR")
        if item.taxFreeReceived {
            return "تنبيه: استلمت التاكس فري (\(tf)) لهذي القطعة، والبوتيك غالباً بيخصمه لما ترجّعها."
        }
        return "تنبيه: التاكس فري (\(tf)) بينلغى لأن القطعة رجعت للبوتيك، وما بيطلع في «باقي تستلمه»."
    }

    // MARK: save

    private func save() async {
        guard !saving else { return }
        var value = 0.0
        if refund != "none" {
            guard let v = parseAmount(amount), v > 0 else {
                toast("اكتب المبلغ المسترجع، أو اختر «بدون»", error: true)
                return
            }
            if v > cap + 0.0005 {
                toast("أكثر شي ترجّعه \(omr(cap))", error: true)
                return
            }
            value = v
        }
        var lines: [String] = []
        lines.append(value > 0 ? "نرجّع \(omr(value)) (\(refundOptions.first { $0.0 == refund }?.1 ?? ""))" : "بدون استرجاع فلوس")
        if restock && item.productId != nil && !backToBoutique { lines.append("القطعة ترجع للمخزون") }
        if backToBoutique && item.hasTaxFree && !item.taxFreeReceived { lines.append("التاكس فري بينلغى") }
        let ok = await confirm(kind == "exchange" ? "استبدال \(item.name)؟" : "إرجاع \(item.name)؟",
                               message: lines.joined(separator: "\n"), ok: "تأكيد", destructive: false)
        guard ok else { return }

        saving = true
        do {
            let clean = note.trimmingCharacters(in: .whitespacesAndNewlines)
            let res = try await Store.shared.returnItem(item, kind: kind, reason: reason,
                                                       note: clean.isEmpty ? nil : clean, refund: refund, amount: value,
                                                       restock: restock && item.productId != nil && !backToBoutique,
                                                       backToBoutique: backToBoutique)
            var msg = kind == "exchange" ? "تم تسجيل الإرجاع، أضف القطعة البديلة" : "تم تسجيل الإرجاع"
            if jb(res["restocked"]) { msg += " · رجعت للمخزون" }
            let pts = ji(res["points_back"])
            if pts > 0 { msg += " · رجّعنا \(pts) نقطة" }
            toast(msg)
            let exchange = kind == "exchange"
            let orderId = order.id
            dismiss()
            if exchange {
                try? await Task.sleep(nanoseconds: 450_000_000)
                presentForm(ItemFormPage(orderId: orderId))
            }
        } catch {
            saving = false
            toastError(error)
        }
    }
}
