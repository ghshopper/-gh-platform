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

/// The customer chose English for her messages.
private func isEn(_ c: Customer?) -> Bool { c?.isEnglish ?? false }

private func hiEn(_ c: Customer?) -> String {
    let n = c?.firstName ?? ""
    return n.isEmpty ? "Hello 🤍" : "Hello \(n) 🤍"
}

private func hi(_ c: Customer?) -> String {
    let n = c?.firstName ?? ""
    return n.isEmpty ? "هلا 🤍" : "هلا \(n) 🤍"
}

/// Message with the order's payment link (made when sending).
func payLinkTemplate(_ url: String) -> MsgTemplate {
    MsgTemplate(title: "رابط الدفع") { o, c in
        if isEn(c) {
            return "\(hiEn(c))\nYour order from GH Shopper\nInvoice no.: \(o.invoiceNo)\n\n\(itemsText(o.activeItems))\n\n" +
                "Amount due: \(omrLatin(o.remaining))\nYou can pay by card or Apple Pay from this link:\n\(url)\n\nThis link is just for you 🤍"
        }
        return "\(hi(c))\n" +
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
        if isEn(c) { return "\(hiEn(c))\nYour order \(o.invoiceNo) has arrived safely in Oman ✨\nWe'll be in touch to arrange delivery." }
        return "\(hi(c))\n\(g(c, "طلبكِ", "طلبك")) \(o.invoiceNo) وصل عُمان بالسلامة ✨\n\(g(c, "بنتواصل معكِ", "بنتواصل معك")) لترتيب التوصيل."
    },
    QuickReply(label: "طلبك في الطريق") { o, c, _ in
        if isEn(c) {
            return "\(hiEn(c))\nYour order \(o.invoiceNo) is on its way to you 🚗" +
                (o.trackingToken == nil ? "" : "\nTrack it here:\n\(trackingLink(o))")
        }
        return "\(hi(c))\n\(g(c, "طلبكِ", "طلبك")) \(o.invoiceNo) في الطريق \(g(c, "لكِ", "لك")) 🚗" +
        (o.trackingToken == nil ? "" : "\nتتبّع\(g(c, "ي", "")) من هنا:\n\(trackingLink(o))")
    },
    QuickReply(label: "تم التسليم، نتمنى تعجبك") { o, c, _ in
        if isEn(c) { return "\(hiEn(c))\nYour order \(o.invoiceNo) has been delivered ✅\nWe hope you love it 🤍 Thank you for trusting GH Shopper" }
        return "\(hi(c))\nتم تسليم \(g(c, "طلبكِ", "طلبك")) \(o.invoiceNo) ✅\nنتمنى \(g(c, "تعجبكِ", "تعجبك")) 🤍 شكراً \(g(c, "لثقتكِ", "لثقتك")) في GH Shopper"
    },
    QuickReply(label: "رابط الدفع…", needsPayLink: true) { o, c, url in
        if isEn(c) { return "\(hiEn(c))\nPayment link for your order \(o.invoiceNo):\n\(url ?? "")\nAmount: \(omrLatin(o.remaining))" }
        return "\(hi(c))\nرابط الدفع \(g(c, "لطلبكِ", "لطلبك")) \(o.invoiceNo):\n\(url ?? "")\nالمبلغ: \(omr(o.remaining))"
    },
]

let messageTemplates: [MsgTemplate] = [
    MsgTemplate(title: "تأكيد الطلب") { o, c in
        if isEn(c) {
            var e = "\(hiEn(c))\nYour GH Shopper order is confirmed\nInvoice no.: \(o.invoiceNo)\n\n"
            e += "\(itemsText(o.activeItems))\n\nSubtotal: \(omrLatin(o.itemsTotal))"
            if o.deliveryFee > 0 { e += "\nDelivery: \(omrLatin(o.deliveryFee))" }
            if o.discount > 0 { e += "\nDiscount: -\(omrLatin(o.discount))" }
            e += "\nPaid: \(omrLatin(o.paid))\nRemaining: \(omrLatin(o.remaining))\n\n"
            if o.trackingToken != nil { e += "You can follow your order here:\n\(trackingLink(o))\n\n" }
            e += "Thank you for your trust 🐆"
            return e
        }
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
        if isEn(c) {
            let b = o.activeItems.filter { $0.status >= .purchased }
            return "\(hiEn(c))\nGood news! We bought for you:\n\(itemsText(b.isEmpty ? o.activeItems : b))\n\nWe'll let you know as soon as it reaches Muscat ✨"
        }
        let bought = o.activeItems.filter { $0.status >= .purchased }
        return "\(hi(c))\nبشارة! اشترينا \(g(c, "لكِ", "لك")):\n\(itemsText(bought.isEmpty ? o.activeItems : bought))\n\nأول ما يوصل مسقط \(g(c, "نبلغكِ", "نبلغك")) ✨"
    },
    MsgTemplate(title: "وصل الطلب") { o, c in
        if isEn(c) {
            let a = o.activeItems.filter { $0.status == .arrived }
            return "\(hiEn(c))\nYour order has arrived safely in Muscat 🎉\n\(itemsText(a.isEmpty ? o.activeItems : a))\n\n" +
                "Remaining: \(omrLatin(o.remaining))" + (o.deliveryFee > 0 ? " (including delivery \(omrLatin(o.deliveryFee)))" : "") +
                "\nWhen would suit you for delivery?"
        }
        let arrived = o.activeItems.filter { $0.status == .arrived }
        return "\(hi(c))\n\(g(c, "طلبكِ", "طلبك")) وصل مسقط بالسلامة 🎉\n\(itemsText(arrived.isEmpty ? o.activeItems : arrived))\n\n" +
            "المتبقي: \(omr(o.remaining))" + (o.deliveryFee > 0 ? " (شامل التوصيل \(omr(o.deliveryFee)))" : "") +
            "\nمتى \(g(c, "يناسبكِ", "يناسبك")) نوصّله \(g(c, "لكِ", "لك"))؟"
    },
    MsgTemplate(title: "خرج للتوصيل") { o, c in
        if isEn(c) {
            return "\(hiEn(c))\nYour order \(o.invoiceNo) is out for delivery 🚗\nWe'll call you before we arrive.\nTrack your order here:\n\(trackingLink(o))"
        }
        return "\(hi(c))\n\(g(c, "طلبكِ", "طلبك")) \(o.invoiceNo) طلع للتوصيل 🚗\nبنتواصل \(g(c, "معكِ", "معك")) قبل لا نوصل.\n" +
        "تتبّع\(g(c, "ي", "")) \(g(c, "طلبكِ", "طلبك")) من هنا:\n\(trackingLink(o))"
    },
    MsgTemplate(title: "تم الشحن (نول / جيناكم)") { o, c in
        if isEn(c) {
            let company = o.deliveryMethod?.carrierName ?? "the courier"
            var e = "\(hiEn(c))\nYour order \(o.invoiceNo) has been shipped with \(company) 📦\n"
            if o.deliveryMethod?.toBranch == true { e += "You can collect it from the \(company) branch as soon as it arrives.\n" }
            if let t = o.carrierTracking {
                e += o.carrierIsLink ? "Track the shipment with \(company):\n\(t)\n\n" : "Shipment no.: \(t)\n"
            }
            e += "Track your order here:\n\(trackingLink(o))"
            return e
        }
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
        if isEn(c) { return "\(hiEn(c))\nA gentle reminder of the remaining amount on your order \(o.invoiceNo):\n\(omrLatin(o.remaining))\n\nThank you 🐆" }
        return "\(hi(c))\nتذكير لطيف بالمبلغ المتبقي على \(g(c, "طلبكِ", "طلبك")) \(o.invoiceNo):\n\(omr(o.remaining))\n\nشكراً \(g(c, "لكِ", "لك")) 🐆"
    },
    MsgTemplate(title: "رابط تتبّع الطلب") { o, c in
        if isEn(c) { return "\(hiEn(c))\nYou can follow your order \(o.invoiceNo) here:\n\(trackingLink(o))" }
        return "\(hi(c))\nتقدر\(g(c, "ين", "")) تتابع\(g(c, "ين", "")) حالة \(g(c, "طلبكِ", "طلبك")) \(o.invoiceNo) من هنا:\n\(trackingLink(o))"
    },
    MsgTemplate(title: "تم التسليم") { o, c in
        if isEn(c) { return "\(hiEn(c))\nWe hope you love your order ✨\nThank you for trusting us, see you on the next trip 🐆\nGH Shopper" }
        return "\(hi(c))\nإن شاء الله \(g(c, "عجبكِ", "عجبك")) \(g(c, "طلبكِ", "طلبك")) ✨\nشكراً \(g(c, "لأنكِ وثقتِ", "لأنك وثقت")) فينا، \(g(c, "ونشوفكِ", "ونشوفك")) في الرحلة الجاية 🐆\nGH Shopper"
    },
]
