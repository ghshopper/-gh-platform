import SwiftUI
import Combine

/// Payment methods offered for the deposit (Dart `paymentMethods`).
fileprivate let orderPaymentMethods = ["تحويل بنكي", "نقداً", "رابط دفع", "أخرى"]

/// One piece being typed in the new-order form.
@MainActor
fileprivate final class OrderItemDraft: ObservableObject, Identifiable {
    let id = UUID()
    @Published var brand = ""
    @Published var name = ""
    @Published var details = ""
    let price = PriceDraft()
}

/// The pieces of the form; re-renders when any piece's price changes (for the totals).
@MainActor
fileprivate final class OrderItemsDraft: ObservableObject {
    @Published var items: [OrderItemDraft] = []
    private var subs: [UUID: AnyCancellable] = [:]

    init() { add() }

    func add() {
        let d = OrderItemDraft()
        subs[d.id] = d.price.objectWillChange.sink { [weak self] _ in self?.objectWillChange.send() }
        items.append(d)
    }

    func remove(_ d: OrderItemDraft) {
        subs[d.id] = nil
        items.removeAll { $0.id == d.id }
    }

    var itemsTotal: Double { items.reduce(0) { $0 + $1.price.omrValue } }
}

/// Picks a trip (Dart `pickTrip` from trips_page.dart). Returns the trip id, "" for no trip, nil when cancelled.
@MainActor
fileprivate func orderFormPickTrip(current: String?) async -> String? {
    await pickTrip(current: current)
}

/// The fields of one piece (inside its GHSection).
fileprivate struct OrderItemRows: View {
    @ObservedObject var item: OrderItemDraft

    var body: some View {
        FieldRow("البراند", text: $item.brand, placeholder: "Cartier")
        FieldRow("القطعة", text: $item.name, placeholder: "Love Bracelet")
        FieldRow("التفاصيل", text: $item.details, placeholder: "المقاس، اللون…")
        PriceRows(draft: item.price)
    }
}

/// New order. Gives back the new order id.
struct OrderFormPage: View {
    var customer: Customer?
    var tripId: String?
    var done: ((String?) -> Void)?

    @Environment(\.dismiss) private var dismiss
    @ObservedObject private var store = Store.shared
    @StateObject private var draft = OrderItemsDraft()

    @State private var chosenCustomer: Customer?
    @State private var chosenTrip: String?
    @State private var delivery = ""
    @State private var deposit = ""
    @State private var notes = ""
    @State private var method = "تحويل بنكي"
    @State private var deliveryMethod: DeliveryMethod = .home
    @State private var saving = false
    @State private var started = false

    init(customer: Customer? = nil, tripId: String? = nil, done: ((String?) -> Void)? = nil) {
        self.customer = customer
        self.tripId = tripId
        self.done = done
        _chosenCustomer = State(initialValue: customer)
        _chosenTrip = State(initialValue: tripId)
    }

    var body: some View {
        GHPage("طلب جديد",
               trailing: { saveButton },
               leading: { NavButton("إلغاء") { cancel() } }) {
            pickersSection
            itemSections
            addItemButton
            deliverySection
            notesSection
            totalsSection
        }
        .onAppear { start() }
    }

    // MARK: parts

    @ViewBuilder
    private var saveButton: some View {
        if saving {
            ProgressView()
        } else {
            NavButton("حفظ", bold: true) { save() }
        }
    }

    private var pickersSection: some View {
        GHSection {
            PickerRow("العميل", value: chosenCustomer?.name, placeholder: "اختر") { pickCustomer() }
            PickerRow("الرحلة", value: store.trip(chosenTrip)?.name, placeholder: "بدون رحلة") { pickTrip() }
        }
    }

    private var itemSections: some View {
        ForEach(Array(draft.items.enumerated()), id: \.element.id) { k, d in
            itemSection(k, d)
        }
    }

    private func itemSection(_ k: Int, _ d: OrderItemDraft) -> some View {
        let canRemove = draft.items.count > 1
        return GHSection("القطعة \(k + 1)", trailing: {
            if canRemove {
                HeaderButton("حذف") { draft.remove(d) }
            }
        }) {
            OrderItemRows(item: d)
        }
    }

    private var addItemButton: some View {
        Pad(top: 12) {
            SecondaryButton("إضافة قطعة", icon: "plus") { draft.add() }
        }
    }

    private var deliveryFooter: String {
        if deliveryMethod.isCourier {
            return "رابط تتبّع \(deliveryMethod.carrierName) تضيفه من الطلب بعدين. الأسعار تتغيّر من بيانات الشركة."
        }
        return "مندوبنا يوصل لباب البيت. الأسعار تتغيّر من بيانات الشركة."
    }

    private var deliverySection: some View {
        GHSection("التوصيل والعربون", footer: deliveryFooter) {
            DeliveryPicker(value: deliveryMethod, onChanged: { m in chooseDelivery(m) })
            AmountRow("رسوم التوصيل", text: $delivery)
            AmountRow("العربون", text: $deposit)
            PickerRow("طريقة الدفع", value: method) { pickMethod() }
        }
    }

    private var notesSection: some View {
        GHSection("ملاحظات") {
            NotesRow(text: $notes, placeholder: "اختياري")
        }
    }

    private var deliveryValue: Double { parseAmount(delivery) ?? 0 }

    private var totalsSection: some View {
        let itemsTotal = draft.itemsTotal
        let fee = deliveryValue
        return GHSection {
            KV("مجموع القطع", omr(itemsTotal))
            KV("التوصيل", omr(fee))
            KV("الإجمالي", omr(itemsTotal + fee), strong: true, color: GH.burgundy)
        }
    }

    // MARK: logic

    private func start() {
        guard !started else { return }
        started = true
        delivery = feeText(store.settings.deliveryHomeFee)
        if tripId == nil { chosenTrip = store.trips.first?.id }
    }

    private func feeText(_ v: Double) -> String {
        v == v.rounded() ? String(format: "%.0f", v) : "\(v)"
    }

    private func chooseDelivery(_ m: DeliveryMethod) {
        deliveryMethod = m
        delivery = feeText(store.settings.feeFor(m))
    }

    private func pickCustomer() {
        Task { @MainActor in
            let c: Customer? = await Nav.shared.pushForResult { done in CustomerPickerPage(done: done) }
            if let c { chosenCustomer = c }
        }
    }

    private func pickTrip() {
        let current = chosenTrip
        Task { @MainActor in
            if let id = await orderFormPickTrip(current: current) {
                chosenTrip = id.isEmpty ? nil : id
            }
        }
    }

    private func pickMethod() {
        Task { @MainActor in
            let actions = orderPaymentMethods.map { SheetAction($0, $0) }
            let m: String? = await actionSheet(title: "طريقة الدفع", actions: actions)
            if let m { method = m }
        }
    }

    private func cancel() {
        if let done { done(nil) } else { dismiss() }
    }

    private func trimmed(_ s: String) -> String { s.trimmingCharacters(in: .whitespacesAndNewlines) }

    private func itemsJSON() -> [JSON] {
        var out: [JSON] = []
        for d in draft.items {
            let name = trimmed(d.name)
            if name.isEmpty { continue }
            let brand = trimmed(d.brand)
            let details = trimmed(d.details)
            var m: JSON = [
                "name": name,
                "brand": nn(brand.isEmpty ? nil : brand),
                "details": nn(details.isEmpty ? nil : details),
            ]
            for (k, v) in d.price.fields { m[k] = v }
            out.append(m)
        }
        return out
    }

    private func save() {
        guard let c = chosenCustomer else {
            toast("اختر العميل أول", error: true)
            return
        }
        let items = itemsJSON()
        if items.isEmpty {
            toast("أضف قطعة وحدة على الأقل", error: true)
            return
        }
        saving = true
        let trip = chosenTrip
        let fee = parseAmount(delivery) ?? 0
        let methodKey = deliveryMethod.key
        let n = trimmed(notes)
        let dep = parseAmount(deposit) ?? 0
        let depMethod = method
        let drafts = draft.items
        Task { @MainActor in
            do {
                let id = try await Store.shared.createOrder(
                    customerId: c.id, tripId: trip, deliveryFee: fee, deliveryMethod: methodKey,
                    notes: n.isEmpty ? nil : n, items: items, deposit: dep, depositMethod: depMethod)
                for d in drafts { d.price.remember() }
                if let done {
                    done(id)
                } else {
                    dismiss()
                    pushPage(OrderDetailPage(orderId: id))
                }
            } catch {
                saving = false
                toastError(error)
            }
        }
    }
}
