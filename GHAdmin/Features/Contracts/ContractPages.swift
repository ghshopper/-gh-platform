import SwiftUI
import UIKit

// عقود الأقساط: make a contract on an order, send the customer her private link
// (she fills her details, picks the dates, uploads her civil ID and signs), then
// follow each payment. Backend: ContractController.

@MainActor
fileprivate func ctAmountText(_ v: Double) -> String {
    v > 0.0005 ? plainOmr(v).replacingOccurrences(of: ",", with: "") : ""
}

@MainActor
fileprivate func ctCustomer(_ orderId: String) -> Customer? {
    Store.shared.order(orderId).flatMap { Store.shared.customer($0.customerId) }
}

/// The WhatsApp message with the contract link.
@MainActor
func contractLinkMessage(_ c: Contract, order: Order?) -> String {
    let name = order.flatMap { Store.shared.customer($0.customerId)?.name }.map { $0.split(separator: " ").first.map(String.init) ?? $0 } ?? ""
    let ref = order?.invoiceNo ?? ""
    return """
    مرحبا \(name) 🤍
    هذا رابط عقد الأقساط لطلبك \(ref) من GH Shopper (\(omr(c.total)) على \(c.payments.count) دفعات).
    افتحه، عبّي بياناتك واختر مواعيد الدفعات، ارفع صورة البطاقة من الأمام والخلف ووقّع، ويوصلك العقد PDF على طول:
    \(c.url)
    """
}

@MainActor
func contractReminderMessage(_ c: Contract, order: Order?) -> String {
    let name = (c.signerName ?? order.flatMap { Store.shared.customer($0.customerId)?.name } ?? "").split(separator: " ").first.map(String.init) ?? ""
    let ref = order?.invoiceNo ?? ""
    guard let p = c.nextPayment else { return "مرحبا \(name)،" }
    let when = p.dueOn.map { dateStr($0) } ?? ""
    let lead = p.isLate ? "تذكير: الدفعة \(p.ordinal) من أقساط طلبك \(ref) كان موعدها \(when)" : "تذكير: الدفعة \(p.ordinal) من أقساط طلبك \(ref) موعدها \(when)"
    return """
    مرحبا \(name) 🤍
    \(lead)، والمبلغ \(omr(p.left)).
    التحويل على حساب GH SPC في بنك صحار الدولي
    IBAN: OM900300000011020055247
    أو على رقم 77246972
    وإذا حوّلت أرسل لنا الإيصال هنا، وشكرًا لك.
    """
}

@MainActor
fileprivate func ctOpenFile(_ path: String?) async {
    guard let path else { return }
    do {
        let url = try await Store.shared.photoUrl(path)
        if url.isEmpty { toast("الملف مب جاهز", error: true) } else { openURL(url) }
    } catch {
        toastError(error)
    }
}

fileprivate func ctStateColor(_ s: String) -> Color {
    switch s {
    case "paid": return GH.green
    case "late": return GH.red
    case "due": return GH.amber
    default: return GH.secondary
    }
}

// MARK: - New contract

@MainActor
struct ContractFormPage: View {
    let order: Order
    @State private var count: Int = 2
    @State private var total: String
    @State private var amounts: [String] = []
    /// nil = the customer picks the date.
    @State private var dates: [Date?] = []
    @State private var maxDays = 60
    @State private var afterAll = false
    @State private var note = ""
    @State private var saving = false
    @Environment(\.dismiss) private var dismiss

    init(order: Order) {
        self.order = order
        _total = State(initialValue: ctAmountText(order.total))
    }

    private var totalValue: Double { parseAmount(total) ?? 0 }
    private var sum: Double { amounts.reduce(0) { $0 + (parseAmount($1) ?? 0) } }
    private var balanced: Bool { abs(sum - totalValue) < 0.0015 }

    var body: some View {
        GHPage("عقد أقساط", trailing: {
            if saving { ProgressView() } else { NavButton("أرسل", bold: true, action: { Task { await save() } }) }
        }, leading: {
            NavButton("إلغاء", action: { dismiss() })
        }) {
            GHSection(footer: "المبلغ الكامل في العقد. الافتراضي إجمالي الطلب \(omr(order.total)) (المدفوع لين الحين \(omr(order.paid))).") {
                AmountRow("المبلغ", text: $total)
            }
            GHSection("كم دفعة") {
                Segments(value: $count, options: [(2, "دفعتين"), (3, "٣ دفعات"), (4, "٤ دفعات")])
            }
            GHSection("الدفعات", footer: balanced ? "الدفعة الأولى تندفع عند التوقيع. الباقي العميل يختار مواعيده إلا إذا حددتها أنت."
                                                  : "المجموع \(omr(sum)) لازم يساوي المبلغ \(omr(totalValue)).") {
                ForEach(0..<amounts.count, id: \.self) { i in
                    AmountRow(i == 0 ? "الأولى (المقدّمة)" : "الدفعة \(ordinal(i))", text: binding(i))
                    if i > 0 {
                        PickerRow("موعدها", value: dates[i].map { dateStr($0) } ?? "العميل يختار",
                                  action: { Task { await pickDue(i) } })
                    }
                }
                Tile("وزّع بالتساوي", chevron: false, action: { split() }, leading: { IconBox("equal", color: GH.blue, size: 28) })
            }
            GHSection("الشروط") {
                PickerRow("آخر موعد ممكن", value: "خلال \(maxDays) يوم", action: { Task { await pickMax() } })
                SwitchRow("التسليم بعد آخر دفعة", subtitle: afterAll ? "ما تنسلم القطعة لين يخلص كل المبلغ" : "تنسلم بعد الدفعة المقدّمة", isOn: $afterAll)
                FieldRow("شروط إضافية", text: $note, placeholder: "اختياري")
            }
        }
        .onAppear { if amounts.isEmpty { split() } }
        .onChange(of: count) { _, _ in split() }
        .onChange(of: total) { _, _ in split() }
    }

    private func ordinal(_ i: Int) -> String { ["الأولى", "الثانية", "الثالثة", "الرابعة"][min(i, 3)] }

    private func binding(_ i: Int) -> Binding<String> {
        Binding(get: { i < amounts.count ? amounts[i] : "" }, set: { if i < amounts.count { amounts[i] = $0 } })
    }

    /// Even payments in whole rials; what's left over goes on the first one.
    private func split() {
        let t = totalValue
        let each = (t / Double(count)).rounded(.down)
        var list = Array(repeating: each, count: count)
        list[0] = t - each * Double(count - 1)
        amounts = list.map(ctAmountText)
        dates = Array(repeating: nil, count: count)
    }

    private func pickDue(_ i: Int) async {
        let actions: [SheetAction<String>] = [SheetAction("العميل يختار الموعد", "client"), SheetAction("أحدد التاريخ أنا", "fixed")]
        guard let a = await pickAction(title: "موعد الدفعة \(ordinal(i))", actions: actions) else { return }
        if a == "client" { dates[i] = nil; return }
        if let d = await pickDate(dates[i] ?? Calendar.current.date(byAdding: .day, value: 30 * i, to: Date()) ?? Date()) { dates[i] = d }
    }

    private func pickMax() async {
        let actions: [SheetAction<Int>] = [30, 45, 60, 90, 120, 180].map { SheetAction("خلال \($0) يوم", $0) }
        if let v = await pickAction(title: "آخر موعد يقدر العميل يختاره", actions: actions) { maxDays = v }
    }

    private func save() async {
        let values = amounts.map { parseAmount($0) ?? 0 }
        if totalValue <= 0 || values.contains(where: { $0 <= 0 }) { toast("اكتب مبالغ الدفعات", error: true); return }
        if !balanced { toast("مجموع الدفعات لازم يساوي المبلغ", error: true); return }
        saving = true
        do {
            let c = try await Store.shared.createContract(
                order.id,
                payments: values.enumerated().map { (amount: $0.element, dueOn: $0.offset == 0 ? nil : dates[$0.offset]) },
                total: totalValue, maxDays: maxDays, afterAll: afterAll,
                note: note.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : note.trimmingCharacters(in: .whitespacesAndNewlines))
            dismiss()
            await sendLink(c, order: order)
        } catch {
            saving = false
            toastError(error)
        }
    }
}

/// WhatsApp the link to the customer (or copy it).
@MainActor
func sendContractLink(_ c: Contract, order: Order?) async {
    await sendLink(c, order: order)
}

@MainActor
fileprivate func sendLink(_ c: Contract, order: Order?) async {
    guard !c.url.isEmpty else { return }
    let actions: [SheetAction<String>] = [SheetAction("أرسل للعميل واتساب", "wa"), SheetAction("نسخ الرابط", "copy"), SheetAction("مشاركة", "share")]
    switch await pickAction(title: "رابط العقد جاهز", message: "العميل يعبّي بياناته ويختار المواعيد ويرفع البطاقة ويوقّع.", actions: actions) {
    case "wa": openWhatsApp(phone: order.flatMap { Store.shared.customer($0.customerId)?.phone }, text: contractLinkMessage(c, order: order))
    case "copy": copyText(c.url, toastText: "نسخت رابط العقد")
    case "share": share([contractLinkMessage(c, order: order)])
    default: break
    }
}

// MARK: - One contract

@MainActor
struct ContractPage: View {
    let contractId: String
    let orderId: String
    @ObservedObject private var store = Store.shared
    @State private var busy = false

    init(contractId: String, orderId: String) { self.contractId = contractId; self.orderId = orderId }

    private var order: Order? { store.order(orderId) }
    private var contract: Contract? { order?.contracts.first { $0.id == contractId } }

    var body: some View {
        if let c = contract {
            page(c)
        } else {
            GHPage("عقد الأقساط") { EmptyState(icon: "doc.text", title: "العقد انلغى أو مب موجود") }
        }
    }

    private func page(_ c: Contract) -> some View {
        GHPage("عقد الأقساط", onRefresh: { await store.refresh() }, trailing: {
            if busy { ProgressView() }
        }) {
            GHSection {
                Tile(c.statusLabel, subtitle: c.isSigned ? "وقّع \(c.signerName ?? "") · \(c.signedAt.map { dateTimeStr($0) } ?? "")"
                                                         : "أُرسل \(c.createdAt.map { dateStr($0) } ?? "") · العميل ما وقّع للحين",
                     value: omr(c.total), valueColor: GH.label, valueFont: .gh(16, .semibold), chevron: false,
                     leading: { IconBox(c.isSigned ? (c.latePayments.isEmpty ? "checkmark.seal.fill" : "exclamationmark.triangle.fill") : "hourglass",
                                        color: c.isSigned ? (c.latePayments.isEmpty ? GH.green : GH.red) : GH.amber) })
                if let o = order {
                    Tile("الطلب \(o.invoiceNo)", subtitle: store.customer(o.customerId)?.name,
                         action: { pushPage(OrderDetailPage(orderId: o.id)) },
                         leading: { IconBox("doc.text", color: GH.burgundy, size: 28) })
                }
            }
            GHSection("الدفعات", footer: c.isSigned ? "تنحسب مدفوعة من دفعات الطلب بالترتيب: الأولى ثم الثانية…" : "المواعيد الي ما حددتها يختارها العميل لما يوقّع.") {
                ForEach(c.payments) { p in
                    Tile("الدفعة \(p.ordinal)",
                         subtitle: [p.dueOn.map { dateStr($0) } ?? (p.index == 0 ? "عند التوقيع" : "العميل يختار"),
                                    p.state == "paid" || p.paid < 0.0005 ? nil : "دفع \(omr(p.paid)) · باقي \(omr(p.left))"]
                            .compactMap { $0 }.joined(separator: " · "),
                         value: omr(p.amount), valueColor: ctStateColor(p.state), valueFont: .gh(15, .semibold), chevron: false,
                         leading: { IconBox(p.state == "paid" ? "checkmark" : (p.isLate ? "exclamationmark" : "calendar"), color: ctStateColor(p.state), size: 28) },
                         trailing: { Badge(p.stateLabel, color: ctStateColor(p.state)) })
                }
            }
            if c.isSigned {
                GHSection("العميل") {
                    KV("الاسم", c.signerName ?? "—")
                    KV("الرقم المدني", c.signerCivilId ?? "—")
                    KV("الهاتف", c.signerPhone ?? "—")
                    if let a = c.signerAddress { KV("العنوان", a) }
                }
                GHSection("الملفات") {
                    Tile("العقد PDF", action: { Task { await ctOpenFile(c.pdfPath) } }, leading: { IconBox("doc.richtext.fill", color: GH.burgundy, size: 28) })
                    Tile("البطاقة من الأمام", action: { Task { await ctOpenFile(c.idFrontPath) } }, leading: { IconBox("person.text.rectangle", color: GH.blue, size: 28) })
                    Tile("البطاقة من الخلف", action: { Task { await ctOpenFile(c.idBackPath) } }, leading: { IconBox("person.text.rectangle", color: GH.blue, size: 28) })
                    Tile("التوقيع", action: { Task { await ctOpenFile(c.signaturePath) } }, leading: { IconBox("signature", color: GH.label, size: 28) })
                }
                if c.nextPayment != nil {
                    GHSection {
                        Tile("ذكّر العميل بالدفعة الجاية", subtitle: "رسالة واتساب جاهزة فيها المبلغ والحساب",
                             action: { openWhatsApp(phone: c.signerPhone ?? ctCustomer(orderId)?.phone, text: contractReminderMessage(c, order: order)) },
                             leading: { IconBox("bell.fill", color: GH.amber, size: 28) })
                        Tile("سجّل دفعة", action: { if let o = order { presentForm(PaymentFormPage(order: o)) } },
                             leading: { IconBox("plus", color: GH.green, size: 28) })
                    }
                }
            } else {
                GHSection {
                    Tile("أرسل الرابط مرة ثانية", action: { Task { await sendLink(c, order: order) } },
                         leading: { IconBox("paperplane.fill", color: GH.green, size: 28) })
                    Tile("نسخ الرابط", action: { copyText(c.url, toastText: "نسخت رابط العقد") },
                         leading: { IconBox("link", color: GH.blue, size: 28) })
                    Tile("إلغاء الرابط", titleColor: GH.red, action: { Task { await cancel(c) } },
                         leading: { IconBox("xmark", color: GH.red, size: 28) })
                }
            }
        }
    }

    private func cancel(_ c: Contract) async {
        guard await confirm("إلغاء رابط العقد؟", message: "الرابط يوقف، وتقدر تسوي عقد جديد بعدين.", ok: "إلغاء الرابط") else { return }
        busy = true
        defer { busy = false }
        do { try await store.cancelContract(c.id) } catch { toastError(error) }
    }
}

// MARK: - All contracts

@MainActor
struct ContractsPage: View {
    @ObservedObject private var store = Store.shared

    init() {}

    var body: some View {
        let all = store.contracts
        let late = all.filter { !$0.latePayments.isEmpty }
        let waiting = all.filter { !$0.isSigned }
        let running = all.filter { $0.isSigned && $0.latePayments.isEmpty && !$0.allPaid }
        let finished = all.filter { $0.isSigned && $0.allPaid }
        let owed = all.filter(\.isSigned).reduce(0.0) { $0 + $1.payments.reduce(0) { $0 + $1.left } }
        GHPage("عقود الأقساط", onRefresh: { await store.refresh() }) {
            if all.isEmpty {
                EmptyState(icon: "signature", title: "ما في عقود للحين",
                           message: "من أي طلب: الزر … ثم «عقد أقساط». يوصل العميل رابط يعبّي فيه بياناته ويوقّع.")
            } else {
                HStack(spacing: 10) {
                    StatCard(label: "باقي على العملاء", value: omr(owed), icon: "banknote.fill", hero: true)
                    StatCard(label: "متأخرة", value: "\(late.count)", icon: "exclamationmark.triangle.fill", color: late.isEmpty ? GH.green : GH.red)
                }
                .padding(.horizontal, 16).padding(.top, 14)
                section("متأخرة", late)
                section("بانتظار التوقيع", waiting)
                section("جارية", running)
                section("خلصت", finished)
            }
        }
    }

    @ViewBuilder private func section(_ title: String, _ list: [Contract]) -> some View {
        if !list.isEmpty {
            GHSection("\(title) · \(list.count)") {
                ForEach(list) { c in row(c) }
            }
        }
    }

    private func row(_ c: Contract) -> some View {
        let o = store.order(c.orderId)
        let name = c.signerName ?? o.flatMap { store.customer($0.customerId)?.name } ?? "—"
        var parts: [String] = [o?.invoiceNo ?? ""]
        if let p = c.nextPayment, c.isSigned {
            parts.append("الجاية \(omr(p.left))" + (p.dueOn.map { " · \(dateStr($0))" } ?? ""))
        } else if !c.isSigned {
            parts.append("\(c.payments.count) دفعات")
        }
        let late = c.lateAmount
        return Tile(name, subtitle: parts.filter { !$0.isEmpty }.joined(separator: " · "),
                    value: late > 0 ? omr(late) : omr(c.total), valueColor: late > 0 ? GH.red : GH.secondary,
                    action: { pushPage(ContractPage(contractId: c.id, orderId: c.orderId)) },
                    leading: { IconBox(c.isSigned ? "signature" : "hourglass", color: late > 0 ? GH.red : (c.isSigned ? GH.green : GH.amber)) })
    }
}
