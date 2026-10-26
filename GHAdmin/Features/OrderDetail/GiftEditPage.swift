import SwiftUI

/// Turn an order into a gift (or edit / remove its gift details): recipient,
/// their phone, the card message, wrapping and hidden prices.
struct GiftEditPage: View {
    let orderId: String
    @Environment(\.dismiss) private var dismiss
    @State private var isGift: Bool
    @State private var to: String
    @State private var phone: String
    @State private var message: String
    @State private var wrap: Bool
    @State private var hidePrices: Bool
    @State private var busy = false

    init(order: Order) {
        self.orderId = order.id
        let g = order.gift
        _isGift = State(initialValue: true)
        _to = State(initialValue: g?.to ?? "")
        _phone = State(initialValue: g?.phone ?? "")
        _message = State(initialValue: g?.message ?? "")
        _wrap = State(initialValue: g?.wrap ?? false)
        _hidePrices = State(initialValue: g?.hidePrices ?? true)
    }

    var body: some View {
        GHPage("هدية",
               largeTitle: false,
               trailing: { NavButton("حفظ", bold: true) { Task { await save() } } },
               leading: { NavButton("إلغاء") { dismiss() } }) {
            GHSection(footer: "الهدية تطلع للمندوب باسم المستلم ورقمه، والبوليصة باسمه.") {
                SwitchRow("هذا الطلب هدية", isOn: $isGift)
            }
            if isGift {
                giftFields
            }
        }
    }

    @ViewBuilder private var giftFields: some View {
        GHSection("المستلم") {
            FieldRow("الاسم", text: $to, placeholder: "نورة")
            FieldRow("الرقم", text: $phone, placeholder: "9xxxxxxx", keyboard: .phone, ltr: true)
        }
        GHSection("رسالة الإهداء", footer: "تنطبع على كرت الإهداء.") {
            NotesRow(text: $message, placeholder: "كل عام وأنتِ بخير…")
        }
        GHSection {
            SwitchRow("تغليف هدية", isOn: $wrap)
            SwitchRow("إخفاء الأسعار", subtitle: "الفاتورة تطلع بدون أسعار", isOn: $hidePrices)
        }
    }

    private func clean(_ s: String) -> Any {
        let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
        return t.isEmpty ? NSNull() : t
    }

    private func save() async {
        if isGift && to.trimmingCharacters(in: .whitespaces).isEmpty {
            toast("اكتب اسم المستلم", error: true)
            return
        }
        busy = true
        let gift: Any = isGift
            ? ["to": clean(to), "phone": clean(normalizeDigits(phone)), "message": clean(message), "wrap": wrap, "hide_prices": hidePrices] as JSON
            : NSNull()
        let ok = await attempt { try await Store.shared.updateOrder(orderId, ["gift": gift]) }
        busy = false
        if ok {
            Haptic.success()
            toast(isGift ? "صار الطلب هدية 🎁" : "شلنا الهدية")
            dismiss()
        }
    }
}

/// WhatsApp to the person who SENT the gift (the customer who ordered): the
/// tracking link so they can follow their gift until it reaches the recipient.
@MainActor
func sendGiftTrackingToSender(_ o: Order) {
    let link = trackingLink(o)
    if link.isEmpty {
        toast("ما في رابط تتبّع لهالطلب", error: true)
        return
    }
    let c = Store.shared.customer(o.customerId)
    let male = c?.isMale ?? false
    func g(_ f: String, _ m: String) -> String { male ? m : f }
    let first = (c?.name ?? "").split(separator: " ").first.map(String.init) ?? ""
    let to = o.gift?.to.map { " لـ \($0)" } ?? ""
    let text = "هلا \(first) 🤍\n\(g("هديتكِ", "هديتك"))\(to) بين أيدينا، \(g("وتقدرين", "وتقدر")) \(g("تتابعينها", "تتابعها")) خطوة بخطوة من هنا:\n\(link)\n\nوبنبلغ\(g("كِ", "ك")) أول ما توصل 🎁\nGH Shopper"
    openWhatsApp(phone: c?.phone, text: text)
}
