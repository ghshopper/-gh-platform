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

    static var bootstrap: JSON { file("demo_bootstrap") as? JSON ?? [:] }
    static var extra: JSON { file("demo_extra") as? JSON ?? [:] }

    /// Orders as a driver sees them (made from the snapshot).
    static var driverOrders: JSON {
        let b = bootstrap
        let customers = Dictionary(jlist(b["customers"]).map { (jstr($0["id"]), $0) }, uniquingKeysWith: { a, _ in a })
        let orders = jlist(b["orders"]).prefix(6).enumerated().map { (n, o) -> JSON in
            let c = customers[jstr(o["customer_id"])] ?? [:]
            return [
                "id": o["id"] ?? "", "order_no": o["order_no"] ?? 0, "ref_no": o["ref_no"] ?? NSNull(),
                "created_at": o["created_at"] ?? NSNull(),
                "customer_name": c["name"] ?? "", "customer_phone": c["phone"] ?? NSNull(), "customer_city": c["city"] ?? "مسقط",
                "customer_gender": c["gender"] ?? "f",
                "address": c["address"] ?? "الخوير، شارع ١٨ نوفمبر، فيلا ١٢",
                "delivery_fee": 2, "delivery_collect": n % 2 == 0, "cod_amount": n == 1 ? 45.5 : NSNull(),
                "driver_status": ["assigned", "picked", "assigned", "delivered", "assigned", "delivered"][n],
                "waybill_no": o["waybill_no"] ?? "GH-000001",
                "items": jlist(o["items"]).map { ["brand": $0["brand"] ?? NSNull(), "name": $0["name"] ?? "", "details": $0["details"] ?? NSNull()] },
            ]
        }
        return ["driver": ["id": "demo", "name": "خالد"], "orders": Array(orders)]
    }

    /// Answers a request the way the server would (reads), or with an empty success (writes).
    static func respond(_ method: String, _ path: String, _ body: JSON?) -> Any? {
        let p = path.components(separatedBy: "?").first ?? path
        if method == "GET" {
            if p == "/ps/bootstrap" { return bootstrap }
            if p == "/ps/me" { return ["role": role, "name": "غسان"] }
            if p == "/ps/driver/orders" { return driverOrders }
            if p == "/ps/driver/account" || (p.hasPrefix("/ps/drivers/") && p.hasSuffix("/account")) {
                return extra.first { $0.key.contains("/account") }?.value ?? [:]
            }
            if p.hasPrefix("/admin/products") { return extra.first { $0.key.hasPrefix("/api/admin/products") }?.value ?? ["data": []] }
            if p.hasPrefix("/admin/categories") { return extra["/api/admin/categories"] ?? [] }
            if p.hasPrefix("/admin/gcc-shipping") { return extra["/api/admin/gcc-shipping"] ?? ["data": [:]] }
            return [:]
        }
        if p.hasSuffix("/pay-link") || p.hasSuffix("/portal-link") { return ["url": "https://ghshopper.com/pay/demo"] }
        if p == "/ps/files/url" { return ["url": ""] }
        return ["ok": true, "id": "demo"]
    }
}
