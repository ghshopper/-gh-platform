import Foundation

/// Builds a monthly Excel-compatible report (CSV with UTF-8 BOM so Arabic
/// opens correctly in Excel and Numbers) and opens the share sheet.
enum Report {
    private static func cell(_ v: Any?) -> String {
        let s = "\(v ?? "")".replacingOccurrences(of: "\"", with: "\"\"")
        return "\"\(s)\""
    }

    private static func num(_ v: Double) -> String { String(format: "%.3f", v) }

    @MainActor
    static func shareMonth(year: Int, month: Int) {
        let store = Store.shared
        let cal = Calendar(identifier: .gregorian)
        func inMonth(_ d: Date?) -> Bool {
            guard let d else { return false }
            let c = cal.dateComponents([.year, .month], from: d)
            return c.year == year && c.month == month
        }
        let orders = store.orders.filter { inMonth($0.createdAt) }.sorted { $0.orderNo < $1.orderNo }

        var rows: [[Any?]] = [[
            "رقم الفاتورة", "التاريخ", "العميل", "الرحلة", "عدد القطع", "مبيعات القطع", "الخصم", "الضريبة",
            "التوصيل", "الإجمالي", "المدفوع", "المتبقي", "تكلفة الشراء (ر.ع)", "الربح التقديري",
        ]]
        var sales = 0.0, delivery = 0.0, paid = 0.0, cost = 0.0, discount = 0.0, tax = 0.0, total = 0.0
        for o in orders {
            let trip = store.trip(o.tripId)?.name ?? o.trip ?? ""
            rows.append([o.invoiceNo, dateStr(o.createdAt), store.customerName(o), trip, o.activeItems.count,
                         num(o.itemsTotal), num(o.discount), num(o.tax), num(o.deliveryFee), num(o.total),
                         num(o.paid), num(o.remaining), num(o.costOmr), num(o.itemProfit)])
            sales += o.itemsTotal; discount += o.discount; tax += o.tax; total += o.total
            delivery += o.deliveryFee; paid += o.paid; cost += o.costOmr
        }
        rows.append([])
        rows.append(["المجموع", "", "", "", "", num(sales), num(discount), num(tax), num(delivery), num(total),
                     num(paid), num(total - paid), num(cost), num(sales - discount - cost)])
        rows.append([])
        rows.append(["القطع"])
        rows.append(["رقم الفاتورة", "العميل", "البراند", "القطعة", "الحالة", "سعر البيع", "مكان الشراء",
                     "سعر الشراء", "العملة", "بالريال", "تاكس فري", "استُلم"])
        for o in orders {
            for i in o.activeItems {
                rows.append([o.invoiceNo, store.customerName(o), i.brand ?? "", i.name, i.status.label, num(i.price),
                             i.purchasePlace?.label ?? "", i.costAmount.map { String(format: "%.2f", $0) } ?? "",
                             i.costCurrency ?? "", i.costOmr.map(num) ?? "",
                             i.hasTaxFree ? String(format: "%.2f", i.taxFreeAmount) : "",
                             i.hasTaxFree ? (i.taxFreeReceived ? "نعم" : "لا") : ""])
            }
        }
        let csv = rows.map { $0.map(cell).joined(separator: ",") }.joined(separator: "\r\n")
        var data = Data([0xEF, 0xBB, 0xBF])
        data.append(csv.data(using: .utf8)!)
        let name = String(format: "GH-Shopper-%04d-%02d.csv", year, month)
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(name)
        try? data.write(to: url, options: .atomic)
        share([url])
    }
}
