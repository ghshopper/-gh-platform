import SwiftUI

// Port of lib/pages/purchases_pages.dart

fileprivate struct ItemRef: Identifiable {
    let order: Order
    let item: OrderItem
    var id: String { item.id }
}

@MainActor
fileprivate func allItemRefs() -> [ItemRef] {
    Store.shared.allItems.map { ItemRef(order: $0.order, item: $0.item) }
}

// MARK: - List

@MainActor
struct PurchaseInvoicesPage: View {
    @ObservedObject private var store = Store.shared

    init() {}

    var body: some View {
        let total = store.invoices.reduce(0) { $0 + $1.totalOmr }
        return GHPage("فواتير الشراء", trailing: {
            NavIcon("plus.circle.fill") { presentForm(PurchaseInvoiceFormPage()) }
        }) {
            if store.invoices.isEmpty {
                EmptyState(icon: "bag", title: "ما في فواتير شراء",
                           message: "سجّل فاتورة المحل إذا اشتريت أكثر من قطعة مرة وحدة، واربط فيها القطع.")
            } else {
                GHSection {
                    KV("مجموع المشتريات", omr(total), strong: true)
                }
                GHSection {
                    ForEach(store.invoices) { inv in
                        InvoiceRow(invoice: inv)
                    }
                }
            }
        }
    }
}

@MainActor
fileprivate struct InvoiceRow: View {
    let invoice: PurchaseInvoice

    var body: some View {
        let inv = invoice
        let count = Store.shared.allItems.filter { $0.item.purchaseInvoiceId == inv.id }.count
        var parts: [String] = [dateStr(inv.purchasedOn)]
        if let c = inv.country { parts.append(c) }
        parts.append("\(count) قطعة")
        return Tile(inv.store, subtitle: parts.joined(separator: " · "),
                    value: money(inv.totalAmount, inv.currency), valueColor: GH.secondary, valueFont: .gh(14),
                    action: { presentForm(PurchaseInvoiceFormPage(invoice: inv)) },
                    leading: { IconBox("bag.fill", color: GH.gold) })
    }
}

// MARK: - Form

@MainActor
struct PurchaseInvoiceFormPage: View {
    let invoice: PurchaseInvoice?

    @ObservedObject private var store = Store.shared
    @State private var storeName: String
    @State private var no: String
    @State private var country: String
    @State private var total: String
    @State private var currency: String
    @State private var rate: String
    @State private var date: Date
    @State private var costs: [String: String] = [:]
    @State private var picked: [OrderItem] = []
    @State private var saving = false
    @Environment(\.dismiss) private var dismiss

    init(invoice: PurchaseInvoice? = nil) {
        self.invoice = invoice
        let cur = invoice?.currency ?? "EUR"
        _storeName = State(initialValue: invoice?.store ?? "")
        _no = State(initialValue: invoice?.invoiceNo ?? "")
        _country = State(initialValue: invoice?.country ?? "")
        _total = State(initialValue: invoice.map { String(format: "%.2f", $0.totalAmount) } ?? "")
        _currency = State(initialValue: cur)
        _rate = State(initialValue: invoice.map { "\($0.rate)" } ?? Rates.shared.rateText(cur))
        _date = State(initialValue: invoice?.purchasedOn ?? Date())
    }

    private var linked: [ItemRef] {
        guard let inv = invoice else { return [] }
        return allItemRefs().filter { $0.item.purchaseInvoiceId == inv.id }
    }

    var body: some View {
        GHPage(invoice == nil ? "فاتورة شراء" : (invoice?.store ?? ""), trailing: {
            if saving {
                ProgressView()
            } else {
                NavButton("حفظ", bold: true) { Task { await save() } }
            }
        }, leading: {
            NavButton("إلغاء") { dismiss() }
        }) {
            infoSection
            moneySection
            linkedSection
            pickSection
            deleteButton
        }
    }

    private var infoSection: some View {
        GHSection {
            FieldRow("المحل", text: $storeName, placeholder: "Cartier Paris")
            FieldRow("رقم الفاتورة", text: $no, ltr: true)
            FieldRow("البلد", text: $country, placeholder: "فرنسا")
            PickerRow("التاريخ", value: dateStr(date)) {
                Task {
                    if let d = await pickDate(date) { date = d }
                }
            }
        }
    }

    private var moneySection: some View {
        GHSection {
            PickerRow("العملة", value: currency) { Task { await pickCurrency() } }
            AmountRow("سعر الصرف", text: $rate, suffix: "ر.ع / \(currency)")
            AmountRow("المجموع", text: $total, suffix: currency)
        }
    }

    @ViewBuilder private var linkedSection: some View {
        let l = linked
        if invoice != nil && !l.isEmpty {
            GHSection("القطع المربوطة") {
                ForEach(l) { e in
                    LinkedItemRow(ref: e, currency: currency)
                }
            }
        }
    }

    private var pickSection: some View {
        GHSection("ربط قطع بهذي الفاتورة",
                  footer: "القطع اللي بانتظار الشراء تتحول تلقائياً إلى «تم الشراء».",
                  trailing: {
                      HeaderButton("اختيار", icon: "link") { Task { await pickItems() } }
                  }) {
            ForEach(picked) { i in
                AmountRow(i.name, text: costBinding(i.id), suffix: currency)
            }
        }
    }

    @ViewBuilder private var deleteButton: some View {
        if let inv = invoice {
            Pad(top: 24) {
                Button {
                    Task { await delete(inv) }
                } label: {
                    Text("حذف الفاتورة").font(.gh(17)).foregroundStyle(GH.red)
                        .frame(maxWidth: .infinity).padding(.vertical, 12)
                }
                .buttonStyle(.plain)
            }
        }
    }

    private func costBinding(_ id: String) -> Binding<String> {
        Binding(get: { costs[id] ?? "" }, set: { costs[id] = $0 })
    }

    private func pickCurrency() async {
        let c: String? = await actionSheet(actions: rateCurrencies.map { SheetAction($0, $0) })
        if let c {
            currency = c
            rate = Rates.shared.rateText(c)
        }
    }

    private func pickItems() async {
        let pickedIds = Set(picked.map(\.id))
        let options = allItemRefs().filter { $0.item.purchaseInvoiceId == nil && !pickedIds.contains($0.item.id) }
        if options.isEmpty {
            toast("كل القطع مربوطة بفواتير")
            return
        }
        let chosen: [OrderItem]? = await Nav.shared.pushForResult { (done: @escaping ([OrderItem]?) -> Void) in
            ItemPickerPage(options: options, done: done)
        }
        guard let chosen else { return }
        for i in chosen {
            if !picked.contains(where: { $0.id == i.id }) { picked.append(i) }
            costs[i.id] = i.costAmount.map { String(format: "%.2f", $0) } ?? ""
        }
    }

    private func clean(_ s: String) -> String? {
        let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
        return t.isEmpty ? nil : t
    }

    private func save() async {
        let r = parseAmount(rate) ?? 0
        let name = storeName.trimmingCharacters(in: .whitespacesAndNewlines)
        if name.isEmpty || r <= 0 {
            toast("اكتب اسم المحل وسعر الصرف", error: true)
            return
        }
        let link: [(item: OrderItem, cost: Double)] = picked.map { i in
            (item: i, cost: parseAmount(costs[i.id] ?? "") ?? 0)
        }
        var t = parseAmount(total) ?? 0
        if t == 0 { t = link.reduce(0) { $0 + $1.cost } }
        saving = true
        do {
            try await Store.shared.savePurchaseInvoice(id: invoice?.id, store: name, invoiceNo: clean(no), purchasedOn: date,
                                                       country: clean(country), currency: currency, rate: r,
                                                       totalAmount: t, notes: nil, link: link)
            dismiss()
        } catch {
            saving = false
            toastError(error)
        }
    }

    private func delete(_ inv: PurchaseInvoice) async {
        if await confirm("حذف الفاتورة؟", message: "القطع تبقى في طلباتها.") {
            let ok = await attempt { try await Store.shared.deletePurchaseInvoice(inv.id) }
            if ok { dismiss() }
        }
    }
}

@MainActor
fileprivate struct LinkedItemRow: View {
    let ref: ItemRef
    let currency: String

    var body: some View {
        let i = ref.item
        let value: String? = i.costAmount.map { money($0, i.costCurrency ?? currency) }
        return Tile(i.title, subtitle: Store.shared.customerName(ref.order), value: value, chevron: false,
                    action: {
                        Task {
                            if await confirm("فك ربط \(i.name)؟", ok: "فك الربط") {
                                await attempt { try await Store.shared.unlinkItem(i.id) }
                            }
                        }
                    })
    }
}

// MARK: - Item picker

@MainActor
fileprivate struct ItemPickerPage: View {
    let options: [ItemRef]
    var done: (([OrderItem]?) -> Void)?
    @State private var sel: Set<String> = []
    @Environment(\.dismiss) private var dismiss

    init(options: [ItemRef], done: (([OrderItem]?) -> Void)? = nil) {
        self.options = options
        self.done = done
    }

    var body: some View {
        GHPage("اختر القطع", trailing: {
            NavButton("إضافة (\(sel.count))", bold: true, action: sel.isEmpty ? nil : { finish() })
        }) {
            GHSection {
                ForEach(options) { e in
                    pickRow(e)
                }
            }
        }
    }

    private func pickRow(_ e: ItemRef) -> some View {
        let i = e.item
        let on = sel.contains(i.id)
        return Tile(i.title, subtitle: "\(Store.shared.customerName(e.order)) · \(i.status.label)",
                    value: omr(i.price), chevron: false,
                    action: {
                        if on { sel.remove(i.id) } else { sel.insert(i.id) }
                    },
                    leading: {
                        Image(systemName: on ? "checkmark.circle.fill" : "circle")
                            .font(.system(size: 22))
                            .foregroundStyle(on ? GH.burgundy : GH.tertiary)
                    })
    }

    private func finish() {
        let items = options.filter { sel.contains($0.item.id) }.map(\.item)
        if let done { done(items) } else { dismiss() }
    }
}
