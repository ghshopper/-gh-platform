import SwiftUI

// Port of lib/pages/return_page.dart

/// Pieces that came back: they leave the order's total, the money given back
/// is recorded (a negative payment) and the points earned on them come back.
struct ReturnPage: View {
    let order: Order
    let done: ((Bool?) -> Void)?
    @State private var ids: Set<String> = []
    @State private var refund = ""
    @State private var reason = ""
    @State private var method = "أموال"
    @State private var saving = false
    @Environment(\.dismiss) private var dismiss

    init(order: Order, done: ((Bool?) -> Void)? = nil) {
        self.order = order
        self.done = done
    }

    private static let methods: [(String, String)] = [
        ("أموال", "البطاقة"),
        ("تحويل بنكي", "تحويل"),
        ("نقداً", "نقداً"),
        ("رصيد", "رصيد"),
    ]

    var body: some View {
        GHPage("إرجاع قطع", trailing: {
            if saving {
                ProgressView()
            } else {
                NavButton("تسجيل", bold: true, action: { Task { await save() } })
            }
        }, leading: {
            NavButton("إلغاء", action: { close(nil) })
        }) {
            itemsSection
            refundSection
            reasonSection
        }
    }

    private var itemsSection: some View {
        GHSection("القطع المرتجعة") {
            ForEach(order.activeItems) { i in
                SwitchRow(i.title, subtitle: omr(i.price), isOn: binding(for: i))
            }
        }
    }

    private var refundSection: some View {
        GHSection("المبلغ المسترجع", footer: "المدفوع على الطلب: \(omr(order.paid)). اكتب 0 إذا ما رجّعت فلوس.") {
            AmountRow("المبلغ", text: $refund)
            Segments(value: $method, options: ReturnPage.methods)
        }
    }

    private var reasonSection: some View {
        GHSection("السبب") {
            FieldRow("السبب", text: $reason, placeholder: "مثلاً: المقاس ما ناسب")
        }
    }

    private func binding(for i: OrderItem) -> Binding<Bool> {
        Binding<Bool>(get: { ids.contains(i.id) }, set: { on in toggle(i, on) })
    }

    private func toggle(_ i: OrderItem, _ on: Bool) {
        var next = ids
        if on { next.insert(i.id) } else { next.remove(i.id) }
        ids = next
        let sum = order.activeItems.filter { next.contains($0.id) }.reduce(0.0) { $0 + $1.price }
        let paid = order.paid
        let v: Double = sum < paid ? sum : (paid > 0 ? paid : 0)
        refund = String(format: "%.3f", v)
    }

    private func close(_ v: Bool?) {
        if let done { done(v) } else { dismiss() }
    }

    private func save() async {
        if ids.isEmpty {
            toast("اختر القطع المرتجعة", error: true)
            return
        }
        saving = true
        do {
            let why = reason.trimmingCharacters(in: .whitespacesAndNewlines)
            let payload: JSON = [
                "item_ids": Array(ids),
                "refund": parseAmount(refund) ?? 0,
                "reason": nn(why.isEmpty ? nil : why),
                "method": method,
            ]
            let res = try await Api.shared.post("/ps/orders/\(order.id)/return", payload)
            await Store.shared.refresh()
            let pts = jdn((res as? JSON)?["points_back"])
            var msg = "تم تسجيل المرتجع"
            if let pts, pts > 0 { msg += " · رجّعنا \(Int(pts)) نقطة" }
            toast(msg)
            close(true)
        } catch {
            saving = false
            toastError(error)
        }
    }
}
