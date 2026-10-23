import Foundation

/// Ready-made WhatsApp messages. Wording follows the customer's gender and
/// every message can be edited before sending.
struct MsgTemplate {
    let title: String
    let build: (Order, Customer?) -> String
}

func trackingLink(_ o: Order) -> String {
    o.trackingToken.map { AppConfig.trackingBaseUrl + $0 } ?? ""
}

private func itemsText(_ items: [OrderItem]) -> String {
    items.map { "• \($0.title)\($0.details == nil ? "" : " (\($0.details!))")" }.joined(separator: "\n")
}

/// Picks the feminine or masculine form.
private func g(_ c: Customer?, _ female: String, _ male: String) -> String { (c?.isMale ?? false) ? male : female }

private func hi(_ c: Customer?) -> String {
    let n = c?.firstName ?? ""
    return n.isEmpty ? "هلا 🤍" : "هلا \(n) 🤍"
}

/// Message with the order's payment link (made when sending).
func payLinkTemplate(_ url: String) -> MsgTemplate {
    MsgTemplate(title: "رابط الدفع") { o, c in
        "\(hi(c))\n" +
        "\(g(c, "طلبكِ", "طلبك")) من GH Shopper\n" +
        "رقم الفاتورة: \(o.invoiceNo)\n\n" +
        "\(itemsText(o.activeItems))\n\n" +
        "المبلغ المطلوب: \(omr(o.remaining))\n" +
        "\(g(c, "تقدرين تدفعين", "تقدر تدفع")) بالبطاقة أو Apple Pay من هذا الرابط:\n" +
        "\(url)\n\n" +
        "الرابط خاص \(g(c, "فيكِ", "فيك")) 🤍"
    }
}

/// Short one-tap replies on the order page (WhatsApp opens with the text
/// ready; the pay-link one fetches the link first).
struct QuickReply {
    let label: String
    var needsPayLink = false
    let build: (Order, Customer?, String?) -> String
}

let quickReplies: [QuickReply] = [
    QuickReply(label: "طلبك وصل عُمان") { o, c, _ in
        "\(hi(c))\n\(g(c, "طلبكِ", "طلبك")) \(o.invoiceNo) وصل عُمان بالسلامة ✨\n\(g(c, "بنتواصل معكِ", "بنتواصل معك")) لترتيب التوصيل."
    },
    QuickReply(label: "طلبك في الطريق") { o, c, _ in
        "\(hi(c))\n\(g(c, "طلبكِ", "طلبك")) \(o.invoiceNo) في الطريق \(g(c, "لكِ", "لك")) 🚗" +
        (o.trackingToken == nil ? "" : "\nتتبّع\(g(c, "ي", "")) من هنا:\n\(trackingLink(o))")
    },
    QuickReply(label: "تم التسليم، نتمنى تعجبك") { o, c, _ in
        "\(hi(c))\nتم تسليم \(g(c, "طلبكِ", "طلبك")) \(o.invoiceNo) ✅\nنتمنى \(g(c, "تعجبكِ", "تعجبك")) 🤍 شكراً \(g(c, "لثقتكِ", "لثقتك")) في GH Shopper"
    },
    QuickReply(label: "رابط الدفع…", needsPayLink: true) { o, c, url in
        "\(hi(c))\nرابط الدفع \(g(c, "لطلبكِ", "لطلبك")) \(o.invoiceNo):\n\(url ?? "")\nالمبلغ: \(omr(o.remaining))"
    },
]

let messageTemplates: [MsgTemplate] = [
    MsgTemplate(title: "تأكيد الطلب") { o, c in
        var s = "\(hi(c))\nتم تأكيد \(g(c, "طلبكِ", "طلبك")) من GH Shopper\nرقم الفاتورة: \(o.invoiceNo)\n\n"
        s += "\(itemsText(o.activeItems))\n\nالمجموع: \(omr(o.itemsTotal))"
        if o.deliveryFee > 0 { s += "\nالتوصيل: \(omr(o.deliveryFee))" }
        if o.discount > 0 { s += "\n\(o.discountLabel ?? "خصم"): -\(omr(o.discount))" }
        s += "\nالمدفوع: \(omr(o.paid))\nالمتبقي: \(omr(o.remaining))\n\n"
        if o.trackingToken != nil {
            s += "تقدر\(g(c, "ين", "")) تتابع\(g(c, "ين", "")) \(g(c, "طلبكِ", "طلبك")) من هنا:\n\(trackingLink(o))\n\n"
        }
        s += "شكراً \(g(c, "لثقتكِ", "لثقتك")) 🐆"
        return s
    },
    MsgTemplate(title: "تم الشراء") { o, c in
        let bought = o.activeItems.filter { $0.status >= .purchased }
        return "\(hi(c))\nبشارة! اشترينا \(g(c, "لكِ", "لك")):\n\(itemsText(bought.isEmpty ? o.activeItems : bought))\n\nأول ما يوصل مسقط \(g(c, "نبلغكِ", "نبلغك")) ✨"
    },
    MsgTemplate(title: "وصل الطلب") { o, c in
        let arrived = o.activeItems.filter { $0.status == .arrived }
        return "\(hi(c))\n\(g(c, "طلبكِ", "طلبك")) وصل مسقط بالسلامة 🎉\n\(itemsText(arrived.isEmpty ? o.activeItems : arrived))\n\n" +
            "المتبقي: \(omr(o.remaining))" + (o.deliveryFee > 0 ? " (شامل التوصيل \(omr(o.deliveryFee)))" : "") +
            "\nمتى \(g(c, "يناسبكِ", "يناسبك")) نوصّله \(g(c, "لكِ", "لك"))؟"
    },
    MsgTemplate(title: "خرج للتوصيل") { o, c in
        "\(hi(c))\n\(g(c, "طلبكِ", "طلبك")) \(o.invoiceNo) طلع للتوصيل 🚗\nبنتواصل \(g(c, "معكِ", "معك")) قبل لا نوصل.\n" +
        "تتبّع\(g(c, "ي", "")) \(g(c, "طلبكِ", "طلبك")) من هنا:\n\(trackingLink(o))"
    },
    MsgTemplate(title: "تم الشحن (نول / جيناكم)") { o, c in
        let company = o.deliveryMethod?.carrierName ?? "شركة الشحن"
        let branch = o.deliveryMethod?.toBranch == true
        var s = "\(hi(c))\nتم شحن \(g(c, "طلبكِ", "طلبك")) \(o.invoiceNo) مع \(company) 📦\n"
        if branch { s += "تقدر\(g(c, "ين", "")) \(g(c, "تستلمينه", "تستلمه")) من فرع \(company) أول ما يوصل.\n" }
        if let t = o.carrierTracking {
            s += o.carrierIsLink ? "تتبّع الشحنة مع \(company):\n\(t)\n\n" : "رقم الشحنة: \(t)\n"
        }
        s += "تتبّع\(g(c, "ي", "")) \(g(c, "طلبكِ", "طلبك")) من هنا:\n\(trackingLink(o))"
        return s
    },
    MsgTemplate(title: "تذكير بالمبلغ المتبقي") { o, c in
        "\(hi(c))\nتذكير لطيف بالمبلغ المتبقي على \(g(c, "طلبكِ", "طلبك")) \(o.invoiceNo):\n\(omr(o.remaining))\n\nشكراً \(g(c, "لكِ", "لك")) 🐆"
    },
    MsgTemplate(title: "رابط تتبّع الطلب") { o, c in
        "\(hi(c))\nتقدر\(g(c, "ين", "")) تتابع\(g(c, "ين", "")) حالة \(g(c, "طلبكِ", "طلبك")) \(o.invoiceNo) من هنا:\n\(trackingLink(o))"
    },
    MsgTemplate(title: "تم التسليم") { o, c in
        "\(hi(c))\nإن شاء الله \(g(c, "عجبكِ", "عجبك")) \(g(c, "طلبكِ", "طلبك")) ✨\nشكراً \(g(c, "لأنكِ وثقتِ", "لأنك وثقت")) فينا، \(g(c, "ونشوفكِ", "ونشوفك")) في الرحلة الجاية 🐆\nGH Shopper"
    },
]
