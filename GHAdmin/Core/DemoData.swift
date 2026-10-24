import Foundation

/// Offline demo mode for screenshots (launch with "-demo"): the bundled
/// snapshot stands in for the server and writes do nothing.
enum DemoData {
    static var isOn: Bool { ProcessInfo.processInfo.arguments.contains("-demo") }

    /// "-screen orders" etc.: which page the screenshot run opens.
    static var screen: String? {
        let a = ProcessInfo.processInfo.arguments
        guard let i = a.firstIndex(of: "-screen"), i + 1 < a.count else { return nil }
        return a[i + 1]
    }

    static var role: String {
        let a = ProcessInfo.processInfo.arguments
        guard let i = a.firstIndex(of: "-role"), i + 1 < a.count else { return "admin" }
        return a[i + 1]
    }

    private static func file(_ name: String) -> Any? {
        guard let url = Bundle.main.url(forResource: name, withExtension: "json"),
              let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONSerialization.jsonObject(with: data)
    }

    static var bootstrap: JSON { withFeatures(file("demo_bootstrap") as? JSON ?? [:]) }
    static var extra: JSON { file("demo_extra") as? JSON ?? [:] }

    private static func dayAgo(_ days: Int) -> String {
        let d = Calendar.current.date(byAdding: .day, value: -days, to: Date()) ?? Date()
        return dayString(d)
    }

    private static func dItem(_ brand: String, _ name: String, _ details: String? = nil) -> JSON {
        ["brand": brand, "name": name, "details": nn(details)]
    }

    /// Orders as a driver sees them: a gift with coordinates, cash on delivery, a failed try,
    /// a delivery note, and a few delivered today / earlier.
    static var driverOrders: JSON {
        let base: JSON = ["delivery_fee": 2, "delivery_collect": false, "cod_amount": NSNull(), "gift": NSNull(),
                          "lat": NSNull(), "lng": NSNull(), "maps_url": NSNull(), "route_pos": NSNull(),
                          "customer_delivery_note": NSNull(), "driver_note": NSNull(), "customer_gender": "f",
                          "created_at": isoAgo(hours: 30)]
        var rows: [JSON] = [
            ["id": "d1", "order_no": 41, "ref_no": "241001", "waybill_no": "GH-000041",
             "customer_name": "مريم البلوشية", "customer_phone": "+968 9555 1234", "customer_city": "الخوير",
             "address": "الخوير ٣٣، شارع ١٨ نوفمبر، فيلا ١٢ https://maps.google.com/?q=23.5880,58.4059",
             "driver_status": "picked", "route_pos": 0, "lat": 23.5880, "lng": 58.4059,
             "maps_url": "https://maps.google.com/?q=23.5880,58.4059",
             "gift": ["to": "نورة السالمي", "phone": "+968 9123 4567", "message": "كل عام وأنتِ بخير 🤍"] as JSON,
             "items": [dItem("Dior", "Lady Dior Mini", "أسود"), dItem("Chanel", "Chance Eau Tendre", "100ml")]],
            ["id": "d2", "order_no": 42, "ref_no": "241002", "waybill_no": "GH-000042",
             "customer_name": "سارة الهنائية", "customer_phone": "+968 9222 4455", "customer_city": "العذيبة",
             "address": "العذيبة الجنوبية، سكة ٤٢٧، بيت ٩", "driver_status": "picked", "route_pos": 1,
             "cod_amount": 45.5, "lat": 23.5946, "lng": 58.3712,
             "customer_delivery_note": "البيت الأبيض جنب المسجد، الباب الخلفي",
             "items": [dItem("Gucci", "Ophidia Card Case")]],
            ["id": "d3", "order_no": 43, "ref_no": "241003", "waybill_no": "GH-000043",
             "customer_name": "عائشة الكندية", "customer_phone": "+968 9333 7788", "customer_city": "بوشر",
             "address": "بوشر، قرب مسجد الأمين", "driver_status": "failed", "route_pos": 2,
             "delivery_collect": true, "failed_reason": "no_answer", "failed_reason_label": "ما رد على الاتصال",
             "failed_note": "اتصلت مرتين", "failed_at": isoAgo(hours: 2), "retry_on": dayAgo(-1),
             "items": [dItem("YSL", "Rouge Pur Couture", "1966 Rouge Libre")]],
            ["id": "d4", "order_no": 44, "ref_no": "241004", "waybill_no": "GH-000044",
             "customer_name": "نورة الحارثية", "customer_phone": "+968 9444 1122", "customer_city": "السيب",
             "address": "المعبيلة الجنوبية، المرحلة السابعة", "driver_status": "assigned",
             "delivery_collect": true, "customer_gender": "m",
             "items": [dItem("On", "Cloud 6 Geo WP Sneakers", "42"), dItem("Nike", "Dunk Low", "43")]],
            ["id": "d5", "order_no": 39, "ref_no": "231009", "waybill_no": "GH-000039",
             "customer_name": "هند الرواحية", "customer_phone": "+968 9666 3344", "customer_city": "القرم",
             "address": "القرم، شارع الشاطئ", "driver_status": "delivered", "delivery_collect": true,
             "collected_by": "transfer", "driver_delivered_at": isoAgo(hours: 1),
             "items": [dItem("Prada", "Re-Edition 2005")]],
            ["id": "d6", "order_no": 37, "ref_no": "221004", "waybill_no": "GH-000037",
             "customer_name": "لمياء الزدجالية", "customer_phone": "+968 9777 5566", "customer_city": "الموالح",
             "address": "الموالح الشمالية", "driver_status": "delivered", "collected_by": "cash",
             "driver_delivered_at": isoAgo(hours: 50),
             "items": [dItem("Celine", "Triomphe Belt")]],
        ]
        for i in rows.indices { rows[i] = base.merging(rows[i]) { _, new in new } }
        return ["driver": ["id": "demo", "name": "خالد"], "orders": rows]
    }

    private static let demoHandovers: [Any] = [
        ["id": "h1", "amount": 30, "note": "سلّمتها لغسان في المكتب", "status": "pending", "created_at": isoAgo(hours: 3)] as JSON,
    ]

    /// The driver's money: the snapshot's account plus a pending handover.
    private static var driverAccount: JSON {
        var acc = extra.first { $0.key.contains("/account") }?.value as? JSON ?? [:]
        acc["pending_handovers"] = demoHandovers
        return acc
    }

    // MARK: the 10 customer features (chat, quotes, wallet, gifts, reviews…)

    /// Adds what the newer server sends: unread chats, a gift order, a quote, wallet balances.
    private static func withFeatures(_ raw: JSON) -> JSON {
        var b = raw
        if b["chats_unread"] == nil { b["chats_unread"] = 3 }
        var orders = jlist(b["orders"])
        if let i = orders.firstIndex(where: { o in
            jlist(o["items"]).filter { jstr($0["status"]) != "cancelled" }.count > 1
        }), orders[i]["gift"] == nil {
            orders[i]["gift"] = ["to": "نورة السالمي", "phone": "+968 9123 4567",
                                 "message": "كل عام وأنتِ بخير يا أحلى أخت 🤍", "wrap": true, "hide_prices": true] as JSON
            b["orders"] = orders
        }
        var requests = jlist(b["requests"])
        if let i = requests.firstIndex(where: { ["pending", "reviewing", "found"].contains(jstr($0["status"])) }),
           requests[i]["quote_status"] == nil {
            requests[i]["status"] = "found"
            requests[i]["quote_price"] = 385
            requests[i]["quote_deposit"] = 100
            requests[i]["quote_delivery_fee"] = 2
            requests[i]["quote_delivery_method"] = "home"
            requests[i]["quote_note"] = "أصلية مع الكرتون والفاتورة"
            requests[i]["quote_status"] = "sent"
            requests[i]["quoted_at"] = isoAgo(hours: 5)
            requests[i]["quote_expires_at"] = isoAgo(hours: -67)
            b["requests"] = requests
        }
        var customers = jlist(b["customers"])
        for i in customers.indices where i % 3 == 0 { customers[i]["wallet_balance"] = 12.5 }
        // Driver upgrade: a failed delivery, a delivery note, a pending cash handover.
        let driverId = jstr(jlist(b["drivers"]).first?["id"])
        var orders2 = jlist(b["orders"])
        if !driverId.isEmpty, let i = orders2.firstIndex(where: { o in
            let free = o["driver_id"] == nil || o["driver_id"] is NSNull
            let noGift = o["gift"] == nil || o["gift"] is NSNull
            return free && noGift && !jlist(o["items"]).isEmpty
        }) {
            orders2[i]["driver_id"] = driverId
            orders2[i]["driver_status"] = "failed"
            orders2[i]["failed_reason"] = "no_answer"
            orders2[i]["failed_reason_label"] = "ما رد على الاتصال"
            orders2[i]["failed_note"] = "اتصل مرتين وما رد"
            orders2[i]["failed_at"] = isoAgo(hours: 2)
            orders2[i]["retry_on"] = dayAgo(-1)
            let cid = jstr(orders2[i]["customer_id"])
            if let ci = customers.firstIndex(where: { jstr($0["id"]) == cid }) {
                customers[ci]["delivery_note"] = "البيت الأبيض جنب المسجد، الباب الخلفي"
            }
            b["orders"] = orders2
        }
        if b["driver_handovers_pending"] == nil { b["driver_handovers_pending"] = 1 }
        b["customers"] = customers
        return b
    }

    private static func isoAgo(hours: Double) -> String {
        let f = ISO8601DateFormatter()
        return f.string(from: Date().addingTimeInterval(-hours * 3600))
    }

    private static let demoThreads: [JSON] = [
        ["id": 1, "user_id": "2", "customer_name": "مريم البلوشية", "phone": "+968 9555 1234",
         "last_preview": "متى توصل الشنطة؟", "last_from": "customer", "last_message_at": isoAgo(hours: 0.2), "unread_staff": 2],
        ["id": 2, "user_id": "33", "customer_name": "سارة الهنائية", "phone": "+968 9222 4455",
         "last_preview": "صورة", "last_from": "customer", "last_message_at": isoAgo(hours: 1.5), "unread_staff": 1],
        ["id": 3, "user_id": "35", "customer_name": "نورة الحارثية", "phone": "+968 9333 7788",
         "last_preview": "تمام، شكراً لكم 🤍", "last_from": "staff", "last_message_at": isoAgo(hours: 26), "unread_staff": 0],
        ["id": 4, "user_id": "12", "customer_name": "عائشة الكندية", "phone": NSNull(),
         "last_preview": "عندكم ديور لاكي؟", "last_from": "customer", "last_message_at": isoAgo(hours: 70), "unread_staff": 0],
    ]

    private static var demoThread: JSON {
        let messages: [JSON] = [
            ["id": 101, "from": "customer", "body": "السلام عليكم، طلبت شنطة شانيل الأسبوع الماضي", "created_at": isoAgo(hours: 3)],
            ["id": 102, "from": "staff", "body": "وعليكم السلام مريم 🤍 أي نعم، اشتريناها من باريس أمس", "staff_name": "غسان",
             "ps_order": ["id": "x", "invoice_no": "GH-10-19-001"] as JSON, "created_at": isoAgo(hours: 2.8)],
            ["id": 103, "from": "staff", "body": "توصل عُمان خلال ٥ أيام عمل إن شاء الله", "staff_name": "غسان", "created_at": isoAgo(hours: 2.7)],
            ["id": 104, "from": "customer", "body": "تمام، ممكن تغلفونها هدية؟", "created_at": isoAgo(hours: 0.4)],
            ["id": 105, "from": "customer", "body": "متى توصل الشنطة؟", "created_at": isoAgo(hours: 0.2)],
        ]
        return ["thread": ["id": 1, "unread_staff": 2] as JSON,
                "customer": ["id": "2", "name": "مريم البلوشية", "phone": "+968 9555 1234", "tier": "ذهبي"] as JSON,
                "messages": messages]
    }

    private static var demoFeatures: JSON {
        [
            "wishlist_alerts": ["on": true] as JSON,
            "quotes": ["on": true, "expires_days": 3] as JSON,
            "smart_push": ["on": true] as JSON,
            "wallet": ["on": true, "points_convert": true, "topup": true, "topup_min": 5, "topup_max": 1000] as JSON,
            "gifts": ["on": true, "wrap": true, "wrap_fee": 2.0] as JSON,
            "vip_progress": ["on": true] as JSON,
            "purchase_photos": ["on": true] as JSON,
            "reviews": ["on": true, "service": true] as JSON,
            "chat": ["on": true, "welcome_ar": "هلا فيك في GH Shopper 🤍 كيف نقدر نساعدك؟", "welcome_en": "Welcome to GH Shopper!",
                     "hours_ar": "نرد من ٩ الصبح لين ١١ الليل", "hours_en": "We reply 9am – 11pm"] as JSON,
            "weekly_new": ["on": false, "days": 7, "max": 20, "title_ar": "جديدنا هذا الأسبوع", "title_en": "New this week",
                           "product_ids": [] as [Any]] as JSON,
        ]
    }

    private static var demoReviews: JSON {
        [
            "product": [
                ["id": 1, "kind": "product", "rating": 5, "comment": "الشنطة أصلية ووصلت بسرعة، شكراً GH 🤍",
                 "customer_name": "مريم البلوشية", "product_name": "Chanel Classic Flap", "status": "pending", "created_at": isoAgo(hours: 4)] as JSON,
                ["id": 2, "kind": "product", "rating": 4, "comment": "حلوة بس المقاس صغير شوي",
                 "customer_name": "سارة الهنائية", "product_name": "Dior Book Tote", "status": "pending", "created_at": isoAgo(hours: 30)] as JSON,
            ],
            "service": [
                ["id": 7, "kind": "service", "rating": 5, "comment": "تعامل راقي وتوصيل سريع",
                 "customer_name": "نورة الحارثية", "invoice_no": "GH-10-18-004", "status": "pending", "created_at": isoAgo(hours: 9)] as JSON,
            ],
        ]
    }

    private static var demoWallet: JSON {
        [
            "balance": 12.5,
            "transactions": [
                ["id": 5, "type": "credit", "amount": 5, "balance_after": 12.5, "note": "تعويض عن تأخير التوصيل", "created_at": isoAgo(hours: 20)] as JSON,
                ["id": 4, "type": "spend", "amount": -10, "balance_after": 7.5, "order_number": "GH-10-12-002", "created_at": isoAgo(hours: 120)] as JSON,
                ["id": 3, "type": "gift_card", "amount": 10, "balance_after": 17.5, "note": "بطاقة هدية من صديقة", "created_at": isoAgo(hours: 200)] as JSON,
                ["id": 2, "type": "points", "amount": 2.5, "balance_after": 7.5, "note": "تحويل ٥٠٠ نقطة", "created_at": isoAgo(hours: 300)] as JSON,
                ["id": 1, "type": "topup", "amount": 5, "balance_after": 5, "created_at": isoAgo(hours: 400)] as JSON,
            ],
        ]
    }

    /// الردود الجاهزة for the chat composer ({name}, {order} are filled when picked).
    private static var demoChatReplies: JSON {
        let rows: [Any] = [
            ["title": "ترحيب", "text": "هلا {name} 🤍 كيف نقدر نساعدك؟"] as JSON,
            ["title": "نتابع الطلب", "text": "تمام {name}، نتابع لك طلبك رقم {order} ونرد عليك بأقرب وقت."] as JSON,
            ["title": "وصل عُمان", "text": "بشارة {name}! طلبك {order} وصل عُمان بالسلامة ✨ بنتواصل معك لترتيب التوصيل."] as JSON,
            ["title": "خرج للتوصيل", "text": "طلبك {order} طلع للتوصيل 🚗\nالمندوب بيتواصل معك قبل لا يوصل."] as JSON,
            ["title": "تغليف هدية", "text": "أكيد نقدر نغلفها هدية 🎁 التغليف عليه ٢ ر.ع."] as JSON,
            ["title": "شكر", "text": "شكراً لك {name} 🤍 نتشرف بخدمتك دايماً."] as JSON,
        ]
        return ["data": rows]
    }

    /// Reads for the features above (nil: not one of them).
    private static func featureGet(_ path: String, _ p: String) -> Any? {
        if p == "/ps/chat-replies" { return demoChatReplies }
        if p == "/ps/chats" { return demoThreads }
        if p == "/ps/chats/unread" { return ["count": 3] }
        if p.hasPrefix("/ps/chats/") {
            if path.contains("after_id=") { return ["messages": [] as [Any]] }
            return demoThread
        }
        if p == "/ps/features" { return demoFeatures }
        if p == "/ps/reviews" { return demoReviews }
        if p.hasPrefix("/ps/wallets/") { return demoWallet }
        return nil
    }

    /// Answers a request the way the server would (reads), or with an empty success (writes).
    static func respond(_ method: String, _ path: String, _ body: JSON?) -> Any? {
        let p = path.components(separatedBy: "?").first ?? path
        if method == "GET", let f = featureGet(path, p) { return f }
        if method == "GET" {
            if p == "/ps/bootstrap" { return bootstrap }
            if p == "/ps/me" { return ["role": role, "name": "غسان"] }
            if p == "/ps/driver/orders" { return driverOrders }
            if p == "/ps/driver/account" || (p.hasPrefix("/ps/drivers/") && p.hasSuffix("/account")) {
                return driverAccount
            }
            if p.hasPrefix("/ps/drivers/") && p.hasSuffix("/handovers") { return ["handovers": demoHandovers] }
            if p.hasPrefix("/admin/products") { return extra.first { $0.key.hasPrefix("/api/admin/products") }?.value ?? ["data": []] }
            if p.hasPrefix("/admin/categories") { return extra["/api/admin/categories"] ?? [] }
            if p.hasPrefix("/admin/gcc-shipping") { return extra["/api/admin/gcc-shipping"] ?? ["data": [:]] }
            return [:]
        }
        if method == "PUT", p == "/ps/chat-replies" {
            let saved: Any = body?["replies"] ?? ([] as [Any])
            return ["data": saved]
        }
        if p.hasSuffix("/pay-link") || p.hasSuffix("/portal-link") { return ["url": "https://ghshopper.com/pay/demo"] }
        if p == "/ps/files/url" { return ["url": ""] }
        return ["ok": true, "id": "demo"]
    }
}
