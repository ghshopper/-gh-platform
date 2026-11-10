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
    return n.isEmpty ? "Hello," : "Hello \(n),"
}

private func hi(_ c: Customer?) -> String {
    let n = c?.firstName ?? ""
    return n.isEmpty ? "مرحبًا،" : "مرحبًا \(n)،"
}

/// The same quiet sign-off on every message.
private let signAr = "\n\nمع التحية\nGH Shopper"
private let signEn = "\n\nWarm regards,\nGH Shopper"

/// The customer's private review page for this order (or the general one).
func reviewLink(_ o: Order?) -> String {
    "https://ghshopper.com/review/" + (o?.trackingToken.map { "?t=\($0)" } ?? "")
}

private let bankAr = "التحويل على حساب GH SPC، بنك صحار الدولي\nIBAN: OM900300000011020055247\nأو على الرقم 77246972"
private let bankEn = "Bank transfer to GH SPC, Sohar International Bank\nIBAN: OM900300000011020055247\nor to 77246972"

/// Message with the order's payment link (made when sending).
func payLinkTemplate(_ url: String) -> MsgTemplate {
    MsgTemplate(title: "رابط الدفع") { o, c in
        if isEn(c) {
            return "\(hiEn(c))\nYour GH Shopper invoice is ready.\n\nInvoice no.: \(o.invoiceNo)\n\(itemsText(o.activeItems))\n\n" +
                "Amount due: \(omrLatin(o.remaining))\nPay by card or Apple Pay:\n\(url)\n\nThis link is for you only." + signEn
        }
        return "\(hi(c))\nفاتورة \(g(c, "طلبكِ", "طلبك")) من GH Shopper جاهزة.\n\n" +
            "رقم الفاتورة: \(o.invoiceNo)\n\(itemsText(o.activeItems))\n\n" +
            "المبلغ المطلوب: \(omr(o.remaining))\nللدفع بالبطاقة أو Apple Pay:\n\(url)\n\n" +
            "الرابط خاص \(g(c, "بكِ", "بك"))." + signAr
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
        if isEn(c) { return "\(hiEn(c))\nYour order \(o.invoiceNo) has arrived safely in Oman.\nWe will be in touch to arrange a delivery time." + signEn }
        return "\(hi(c))\nوصل \(g(c, "طلبكِ", "طلبك")) \(o.invoiceNo) إلى عُمان بحمد الله.\nسنتواصل \(g(c, "معكِ", "معك")) لترتيب موعد التوصيل." + signAr
    },
    QuickReply(label: "طلبك في الطريق") { o, c, _ in
        if isEn(c) {
            return "\(hiEn(c))\nYour order \(o.invoiceNo) is on its way to you." +
                (o.trackingToken == nil ? "" : "\nFollow it here:\n\(trackingLink(o))") + signEn
        }
        return "\(hi(c))\n\(g(c, "طلبكِ", "طلبك")) \(o.invoiceNo) في الطريق \(g(c, "إليكِ", "إليك")) الآن." +
            (o.trackingToken == nil ? "" : "\nللمتابعة:\n\(trackingLink(o))") + signAr
    },
    QuickReply(label: "تم التسليم، ورابط التقييم") { o, c, _ in
        if isEn(c) {
            return "\(hiEn(c))\nYour order \(o.invoiceNo) has been delivered. We hope you love it.\n" +
                "We would value your feedback on your experience:\n\(reviewLink(o))\n\nThank you for your trust." + signEn
        }
        return "\(hi(c))\nتم تسليم \(g(c, "طلبكِ", "طلبك")) \(o.invoiceNo)، ونتمنى أن \(g(c, "ينال إعجابكِ", "ينال إعجابك")).\n" +
            "يسعدنا رأي\(g(c, "كِ", "ك")) في تجربت\(g(c, "كِ", "ك")) معنا:\n\(reviewLink(o))\n\nشكرًا لثقت\(g(c, "كِ", "ك"))." + signAr
    },
    QuickReply(label: "رابط الدفع…", needsPayLink: true) { o, c, url in
        if isEn(c) { return "\(hiEn(c))\nHere is the payment link for your order \(o.invoiceNo):\n\(url ?? "")\nAmount: \(omrLatin(o.remaining))" + signEn }
        return "\(hi(c))\nرابط الدفع \(g(c, "لطلبكِ", "لطلبك")) \(o.invoiceNo):\n\(url ?? "")\nالمبلغ: \(omr(o.remaining))" + signAr
    },
]

let messageTemplates: [MsgTemplate] = [
    MsgTemplate(title: "تأكيد الطلب") { o, c in
        if isEn(c) {
            var e = "\(hiEn(c))\nYour GH Shopper order is confirmed.\n\nInvoice no.: \(o.invoiceNo)\n"
            e += "\(itemsText(o.activeItems))\n\nSubtotal: \(omrLatin(o.itemsTotal))"
            if o.deliveryFee > 0 { e += "\nDelivery: \(omrLatin(o.deliveryFee))" }
            if o.discount > 0 { e += "\nDiscount: -\(omrLatin(o.discount))" }
            e += "\nPaid: \(omrLatin(o.paid))\nRemaining: \(omrLatin(o.remaining))"
            if o.trackingToken != nil { e += "\n\nFollow your order step by step:\n\(trackingLink(o))" }
            return e + "\n\nThank you for choosing GH Shopper." + signEn
        }
        var s = "\(hi(c))\nتم تأكيد \(g(c, "طلبكِ", "طلبك")) من GH Shopper.\n\nرقم الفاتورة: \(o.invoiceNo)\n"
        s += "\(itemsText(o.activeItems))\n\nالمجموع: \(omr(o.itemsTotal))"
        if o.deliveryFee > 0 { s += "\nالتوصيل: \(omr(o.deliveryFee))" }
        if o.discount > 0 { s += "\n\(o.discountLabel ?? "الخصم"): -\(omr(o.discount))" }
        s += "\nالمدفوع: \(omr(o.paid))\nالمتبقي: \(omr(o.remaining))"
        if o.trackingToken != nil { s += "\n\nلمتابعة \(g(c, "طلبكِ", "طلبك")) خطوة بخطوة:\n\(trackingLink(o))" }
        return s + "\n\nشكرًا \(g(c, "لاختياركِ", "لاختيارك")) GH Shopper." + signAr
    },
    MsgTemplate(title: "تم الشراء") { o, c in
        let b = o.activeItems.filter { $0.status >= .purchased }
        if isEn(c) {
            return "\(hiEn(c))\nWe are pleased to let you know we have bought for you:\n\(itemsText(b.isEmpty ? o.activeItems : b))\n\n" +
                "We will let you know as soon as it reaches Muscat." + signEn
        }
        return "\(hi(c))\nيسعدنا \(g(c, "إبلاغكِ", "إبلاغك")) بأننا اشترينا \(g(c, "لكِ", "لك")):\n\(itemsText(b.isEmpty ? o.activeItems : b))\n\n" +
            "\(g(c, "سنبلغكِ", "سنبلغك")) فور وصولها إلى مسقط." + signAr
    },
    MsgTemplate(title: "وصل الطلب") { o, c in
        let a = o.activeItems.filter { $0.status == .arrived }
        if isEn(c) {
            return "\(hiEn(c))\nYour order has arrived in Muscat:\n\(itemsText(a.isEmpty ? o.activeItems : a))\n\n" +
                "Remaining: \(omrLatin(o.remaining))" + (o.deliveryFee > 0 ? " (including delivery, \(omrLatin(o.deliveryFee)))" : "") +
                "\nWhen would suit you for delivery?" + signEn
        }
        return "\(hi(c))\nوصل \(g(c, "طلبكِ", "طلبك")) إلى مسقط:\n\(itemsText(a.isEmpty ? o.activeItems : a))\n\n" +
            "المتبقي: \(omr(o.remaining))" + (o.deliveryFee > 0 ? " (شامل التوصيل \(omr(o.deliveryFee)))" : "") +
            "\nمتى \(g(c, "يناسبكِ", "يناسبك")) موعد التوصيل؟" + signAr
    },
    MsgTemplate(title: "خرج للتوصيل") { o, c in
        if isEn(c) {
            return "\(hiEn(c))\nYour order \(o.invoiceNo) is out for delivery today. Our driver will call you before arriving.\n" +
                "Follow it here:\n\(trackingLink(o))" + signEn
        }
        return "\(hi(c))\n\(g(c, "طلبكِ", "طلبك")) \(o.invoiceNo) خرج للتوصيل اليوم، وسيتصل \(g(c, "بكِ", "بك")) المندوب قبل الوصول.\n" +
            "للمتابعة:\n\(trackingLink(o))" + signAr
    },
    MsgTemplate(title: "تم الشحن (نول / جيناكم)") { o, c in
        if isEn(c) {
            let company = o.deliveryMethod?.carrierName ?? "the courier"
            var e = "\(hiEn(c))\nYour order \(o.invoiceNo) has been shipped with \(company).\n"
            if o.deliveryMethod?.toBranch == true { e += "You can collect it from the \(company) branch once it arrives.\n" }
            if let t = o.carrierTracking { e += o.carrierIsLink ? "Track the shipment:\n\(t)\n" : "Shipment no.: \(t)\n" }
            return e + "\nFollow your order:\n\(trackingLink(o))" + signEn
        }
        let company = o.deliveryMethod?.carrierName ?? "شركة الشحن"
        var s = "\(hi(c))\nتم شحن \(g(c, "طلبكِ", "طلبك")) \(o.invoiceNo) مع \(company).\n"
        if o.deliveryMethod?.toBranch == true { s += "\(g(c, "يمكنكِ", "يمكنك")) استلامه من فرع \(company) فور وصوله.\n" }
        if let t = o.carrierTracking { s += o.carrierIsLink ? "تتبّع الشحنة:\n\(t)\n" : "رقم الشحنة: \(t)\n" }
        return s + "\nلمتابعة \(g(c, "طلبكِ", "طلبك")):\n\(trackingLink(o))" + signAr
    },
    MsgTemplate(title: "تذكير بالمبلغ المتبقي") { o, c in
        if isEn(c) {
            return "\(hiEn(c))\nA kind reminder of the remaining amount on your order \(o.invoiceNo): \(omrLatin(o.remaining)).\n\n\(bankEn)\n\n" +
                "Please send us the receipt here once you transfer. Thank you." + signEn
        }
        return "\(hi(c))\nنودّ \(g(c, "تذكيركِ", "تذكيرك")) بالمبلغ المتبقي على \(g(c, "طلبكِ", "طلبك")) \(o.invoiceNo): \(omr(o.remaining)).\n\n\(bankAr)\n\n" +
            "\(g(c, "نرجو منكِ", "نرجو منك")) إرسال الإيصال هنا بعد التحويل، وشكرًا \(g(c, "لكِ", "لك"))." + signAr
    },
    MsgTemplate(title: "رابط تتبّع الطلب") { o, c in
        if isEn(c) { return "\(hiEn(c))\nYou can follow your order \(o.invoiceNo) here:\n\(trackingLink(o))" + signEn }
        return "\(hi(c))\n\(g(c, "يمكنكِ", "يمكنك")) متابعة \(g(c, "طلبكِ", "طلبك")) \(o.invoiceNo) من هنا:\n\(trackingLink(o))" + signAr
    },
    MsgTemplate(title: "تم التسليم ورابط التقييم") { o, c in
        if isEn(c) {
            return "\(hiEn(c))\nWe hope your order is everything you hoped for.\nYour opinion matters to us. Tell us about your experience:\n\(reviewLink(o))\n\n" +
                "Thank you for your trust. We look forward to serving you again." + signEn
        }
        return "\(hi(c))\nنتمنى أن يكون \(g(c, "طلبكِ", "طلبك")) قد \(g(c, "نال إعجابكِ", "نال إعجابك")).\n" +
            "رأي\(g(c, "كِ", "ك")) يهمنا، ويسعدنا \(g(c, "تقييمكِ", "تقييمك")) لتجربت\(g(c, "كِ", "ك")) معنا:\n\(reviewLink(o))\n\n" +
            "شكرًا لثقت\(g(c, "كِ", "ك"))، ونتطلع \(g(c, "لخدمتكِ", "لخدمتك")) مجددًا." + signAr
    },
]
