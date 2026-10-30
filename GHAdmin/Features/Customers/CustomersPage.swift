import SwiftUI
import UIKit

// ───────────────────────── Shared helpers ─────────────────────────

fileprivate func customerMatches(_ c: Customer, _ query: String) -> Bool {
    let q = normalizeDigits(query).trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    if q.isEmpty { return true }
    return c.name.lowercased().contains(q) || normalizeDigits(c.phone ?? "").contains(q)
}

/// What the customer still owes over all of their orders.
fileprivate func owedOf(_ orders: [Order]) -> Double {
    orders.reduce(0) { $0 + $1.dueNow }
}

/// Newest first (orders without a date go last).
fileprivate func newestFirst(_ orders: [Order]) -> [Order] {
    orders.sorted { ($0.createdAt ?? Date.distantPast) > ($1.createdAt ?? Date.distantPast) }
}

/// Like Dart's Uri.encodeComponent.
fileprivate func encodeComponent(_ s: String) -> String {
    var allowed = CharacterSet.alphanumerics
    allowed.insert(charactersIn: "-_.!~*'()")
    // alphanumerics includes non-ASCII letters; keep only ASCII unescaped.
    var out = ""
    for scalar in s.unicodeScalars {
        if scalar.isASCII && allowed.contains(scalar) {
            out.unicodeScalars.append(scalar)
        } else {
            out += String(scalar).addingPercentEncoding(withAllowedCharacters: CharacterSet()) ?? ""
        }
    }
    return out
}

/// iOS search field (CupertinoSearchTextField).
fileprivate struct SearchBox: View {
    let placeholder: String
    @Binding var text: String
    let autofocus: Bool
    @FocusState private var focused: Bool

    init(placeholder: String, text: Binding<String>, autofocus: Bool = false) {
        self.placeholder = placeholder
        self._text = text
        self.autofocus = autofocus
    }

    var body: some View {
        HStack(spacing: 6) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 16))
                .foregroundStyle(GH.secondary)
            TextField("", text: $text, prompt: Text(placeholder).foregroundStyle(GH.tertiary))
                .font(.gh(16))
                .foregroundStyle(GH.label)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
                .focused($focused)
            if !text.isEmpty {
                Button {
                    text = ""
                } label: {
                    Image(systemName: "xmark.circle.fill").foregroundStyle(GH.tertiary)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, 10)
        .frame(height: 38)
        .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(GH.panel))
        .onAppear {
            if autofocus {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) { focused = true }
            }
        }
    }
}

// ───────────────────────── List ─────────────────────────

struct CustomersPage: View {
    @ObservedObject private var store = Store.shared
    @State private var query = ""

    init() {}

    private var list: [Customer] { store.customers.filter { customerMatches($0, query) } }

    var body: some View {
        GHPage("العملاء", onRefresh: { await Store.shared.refresh() }, trailing: {
            NavIcon("person.badge.plus") { presentForm(CustomerFormPage()) }
        }) {
            Pad(top: 4) {
                SearchBox(placeholder: "بحث بالاسم أو الرقم", text: $query)
            }
            if !store.ready {
                LoadingView()
            } else if store.customers.isEmpty {
                EmptyState(icon: "person.2", title: "ما في عملاء للحين")
            } else {
                listSection
            }
        }
    }

    private var listSection: some View {
        let rows = list
        return GHSection("\(rows.count) عميل") {
            ForEach(rows) { c in
                CustomerListRow(customer: c)
            }
        }
    }
}

fileprivate struct CustomerListRow: View {
    @ObservedObject private var store = Store.shared
    let customer: Customer

    init(customer: Customer) { self.customer = customer }

    private var subtitle: String {
        let orders = store.ordersOf(customer.id)
        var parts: [String] = []
        if let p = customer.phone { parts.append(p) }
        parts.append("\(orders.count) طلب")
        return parts.joined(separator: " · ")
    }

    var body: some View {
        let owed = owedOf(store.ordersOf(customer.id))
        let id = customer.id
        return Tile(customer.name,
                    subtitle: subtitle,
                    value: owed > 0.0005 ? omr(owed) : nil,
                    valueColor: GH.red,
                    valueFont: .gh(14),
                    action: { pushPage(CustomerDetailPage(customerId: id)) },
                    leading: { Avatar(customer.name) })
    }
}

// ───────────────────────── Detail ─────────────────────────

struct CustomerDetailPage: View {
    let customerId: String
    @ObservedObject private var store = Store.shared
    @Environment(\.dismiss) private var dismiss

    init(customerId: String) { self.customerId = customerId }

    var body: some View {
        if let c = store.customer(customerId) {
            page(c)
        } else {
            GHPage("العميل") {
                EmptyState(icon: "person", title: "غير موجود")
            }
        }
    }

    private func page(_ c: Customer) -> some View {
        GHPage(c.name, trailing: {
            NavButton("تعديل") { presentForm(CustomerFormPage(customer: c)) }
        }, bottom: {
            PrimaryButton("طلب جديد له", icon: "plus") {
                // The order form opens the new order's page when it is saved.
                presentForm(OrderFormPage(customer: c))
            }
        }) {
            CustomerDetailContent(customer: c, onDelete: { delete(c) })
        }
    }

    private func delete(_ c: Customer) {
        let orders = store.ordersOf(c.id)
        let close = dismiss
        Task {
            if !orders.isEmpty {
                toast("عنده طلبات. احذف الطلبات أول.", error: true)
                return
            }
            if await confirm("حذف \(c.name)؟") {
                do {
                    try await Store.shared.deleteCustomer(c.id)
                    close()
                } catch {
                    toastError(error)
                }
            }
        }
    }
}

/// "ملاحظة التوصيل": what the driver saved for next time; staff can edit it.
fileprivate struct CustomerDeliveryNoteSection: View {
    let customer: Customer

    var body: some View {
        GHSection("ملاحظة التوصيل", footer: "تطلع للمندوب في كل طلب لهذا العميل.", trailing: {
            HeaderButton(customer.deliveryNote == nil ? "أضف" : "تعديل", icon: "square.and.pencil") { edit() }
        }) {
            if let note = customer.deliveryNote {
                Text(note)
                    .font(TS.body)
                    .foregroundStyle(GH.label)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(14)
                    .background(Color(hex: 0xFFFFD43B).opacity(0.18))
            } else {
                Tile("ما في ملاحظة", subtitle: "مثلاً: البيت الأبيض جنب المسجد، الباب الخلفي",
                     titleColor: GH.secondary, action: { edit() },
                     leading: { IconBox("note.text", color: GH.amber) })
            }
        }
    }

    private func edit() {
        let c = customer
        Task { @MainActor in
            guard let text = await promptText("ملاحظة التوصيل", message: "للمندوب: وين البيت، أي باب…",
                                              placeholder: "البيت الأبيض جنب المسجد، الباب الخلفي",
                                              initial: c.deliveryNote ?? "") else { return }
            if await attempt({ try await Store.shared.saveDeliveryNote(c, note: text) }) {
                toast("انحفظت ✓")
            }
        }
    }
}

fileprivate struct CustomerDetailContent: View {
    let customer: Customer
    let onDelete: () -> Void
    @ObservedObject private var store = Store.shared

    init(customer: Customer, onDelete: @escaping () -> Void) {
        self.customer = customer
        self.onDelete = onDelete
    }

    private var orders: [Order] { store.ordersOf(customer.id) }

    var body: some View {
        let all = orders
        Group {
            stats(all)
            if customer.loyaltyPoints > 0 || customer.loyaltyTier != nil {
                Pad(top: 12) {
                    TierCard(tier: customer.loyaltyTier, points: customer.loyaltyPoints)
                }
            }
            CustomerWalletSection(customerId: customer.id, name: customer.name,
                                  initialBalance: customer.walletBalance)
            if !all.isEmpty {
                recentSection(all)
            }
            CustomerInfoSection(customer: customer, balance: all.reduce(0) { $0 + $1.customerBalance })
            CustomerPartnerSection(customer: customer)
            CustomerPortalSection(customer: customer)
            CustomerDeliveryNoteSection(customer: customer)
            if let notes = customer.notes {
                GHSection("ملاحظات") {
                    Text(notes).font(TS.body).foregroundStyle(GH.label)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(16)
                }
            }
            if all.isEmpty {
                EmptyState(icon: "doc.text", title: "ما عنده طلبات")
            }
            deleteButton
        }
    }

    private func stats(_ all: [Order]) -> some View {
        let total = all.reduce(0) { $0 + $1.total }
        let owed = owedOf(all)
        return Pad(top: 4) {
            HStack(spacing: 10) {
                StatCard(label: "المشتريات", value: omr(total), icon: "bag.fill", hero: true)
                StatCard(label: "عليه", value: omr(owed), color: GH.red)
            }
        }
    }

    private func recentSection(_ all: [Order]) -> some View {
        let recent = Array(newestFirst(all).prefix(3))
        let id = customer.id
        let count = all.count
        return GHSection("آخر الطلبات", trailing: {
            if count > 3 {
                HeaderButton("الكل · \(count)") { pushPage(CustomerOrdersPage(customerId: id)) }
            }
        }) {
            ForEach(recent) { o in
                OrderRow(order: o, showCustomer: false, onTap: { pushPage(OrderDetailPage(orderId: o.id)) })
            }
        }
    }

    private var deleteButton: some View {
        Pad(top: 24) {
            Button {
                onDelete()
            } label: {
                Text("حذف العميل")
                    .font(.gh(17))
                    .foregroundStyle(GH.red)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
            }
            .buttonStyle(.plain)
        }
    }
}

fileprivate struct CustomerInfoSection: View {
    let customer: Customer
    let balance: Double

    init(customer: Customer, balance: Double) {
        self.customer = customer
        self.balance = balance
    }

    var body: some View {
        GHSection {
            if let phone = customer.phone {
                Tile("واتساب", value: phone, action: {
                    if let p = waPhone(phone) { openURL("https://wa.me/\(p)") }
                }, leading: { IconBox("bubble.left.fill", color: Color(hex: 0xFF25D366)) })
                Tile("اتصال", action: { callPhone(phone) },
                     leading: { IconBox("phone.fill", color: GH.green) })
            }
            Tile("محادثة في التطبيق", action: { Task { await openCustomerChat(customer) } },
                 leading: { IconBox("bubble.left.and.bubble.right.fill", color: GH.purple) })
            Tile("النوع", value: customer.isMale ? "عميل" : "عميلة", chevron: false)
            if let city = customer.city {
                Tile("المنطقة", value: city, chevron: false)
            }
            if let address = customer.address {
                Tile("العنوان", subtitle: address, chevron: false)
            }
            Tile("رصيده عندك", value: omr(balance),
                 valueColor: balance < -0.0005 ? GH.red : GH.green,
                 valueFont: .gh(16), chevron: false)
        }
    }
}

/// A personal shopper who orders from us for her clients: her own page with her account,
/// her orders' journey and the products at her price.
fileprivate struct CustomerPartnerSection: View {
    let customer: Customer

    init(customer: Customer) { self.customer = customer }

    var body: some View {
        let c = customer
        return GHSection("شريك (بيرسونال شوبر)",
                         footer: c.isPartner
                            ? "صفحتها الخاصة فيها حسابها، وين وصلت قطع عملائها، والمنتجات بسعر الشريك وتطلب منها مباشرة. الرابط من «صفحة العميل» تحت."
                            : "للبيرسونال شوبر اللي تطلب منك لعملائها: صفحة خاصة فيها حسابها وطلباتها والمنتجات بسعرها.") {
            Tile("شريك", value: c.isPartner ? "نعم" : "لا", chevron: false,
                 action: { Task { await toggle(c) } },
                 leading: { IconBox("person.2.badge.gearshape.fill", color: GH.burgundy) })
            if c.isPartner {
                Tile("خصم الشريك", value: c.partnerDiscount.map { "\(Int($0))٪ من سعر المتجر" } ?? "بدون خصم",
                     action: { Task { await setDiscount(c) } },
                     leading: { IconBox("percent", color: GH.green) })
            }
        }
    }

    private func toggle(_ c: Customer) async {
        if c.isPartner {
            guard await confirm("إلغاء الشراكة مع \(c.name)؟", message: "رابط صفحة الشريك يرجع صفحة عميل عادية.", ok: "إلغاء الشراكة") else { return }
        }
        do {
            try await Store.shared.setPartner(c.id, on: !c.isPartner, discount: c.partnerDiscount)
            await Store.shared.refresh()
            toast(c.isPartner ? "صار عميل عادي" : "صار شريك، حدد خصمه")
        } catch { toastError(error) }
    }

    private func setDiscount(_ c: Customer) async {
        let initial = c.partnerDiscount.map { String(Int($0)) } ?? ""
        guard let t = await promptText("خصم الشريك ٪", message: "كم بالمية أقل من سعر المتجر يشوف الأسعار؟",
                                       placeholder: "مثلاً 10", initial: initial, ok: "حفظ", keyboard: .numberPad) else { return }
        let v = parseAmount(t)
        if let v, v < 0 || v > 90 { toast("من 0 إلى 90", error: true); return }
        do {
            try await Store.shared.setPartner(c.id, on: true, discount: v)
            await Store.shared.refresh()
            toast("تم")
        } catch { toastError(error) }
    }
}

fileprivate struct CustomerPortalSection: View {
    let customer: Customer

    init(customer: Customer) { self.customer = customer }

    var body: some View {
        let c = customer
        return GHSection("صفحة العميل",
                         footer: "رابط خاص فيه كل طلباته (من التطبيق أو الواتساب أو الموقع) مع الفواتير وإيصالات الشراء.") {
            if c.phone != nil {
                Tile("أرسل له رابط طلباته", action: { Task { await sendPortal(c) } },
                     leading: { IconBox("paperplane.fill", color: Color(hex: 0xFF25D366)) })
            }
            Tile("نسخ الرابط", action: { Task { await copyPortal(c) } },
                 leading: { IconBox("doc.on.doc.fill", color: GH.blue) })
            Tile("تغيير الرابط", subtitle: "الرابط القديم يتوقف",
                 action: { Task { await copyPortal(c, reset: true) } },
                 leading: { IconBox("arrow.2.circlepath", color: GH.red) })
        }
    }
}

/// Opens (or starts) the customer's chat thread (POST /ps/chats/start/{userId}).
@MainActor
fileprivate func openCustomerChat(_ c: Customer) async {
    do {
        let res = try await Api.shared.post("/ps/chats/start/\(c.id)") as? JSON ?? [:]
        let t = (res["thread"] as? JSON) ?? res
        let id = jstr(t["id"])
        if id.isEmpty { return }
        pushPage(ChatThreadPage(threadId: id, title: c.name))
    } catch {
        toastError(error)
    }
}

// ───────────────────────── Customer page link ─────────────────────────

@MainActor
fileprivate func portalLink(_ c: Customer, reset: Bool = false) async -> String? {
    do {
        return try await Store.shared.customerPortalLink(c.id, reset: reset)
    } catch {
        toastError(error)
        return nil
    }
}

@MainActor
fileprivate func sendPortal(_ c: Customer) async {
    guard let p = waPhone(c.phone) else { return }
    guard let url = await portalLink(c) else { return }
    let parts = c.name.trimmingCharacters(in: .whitespacesAndNewlines)
        .components(separatedBy: .whitespacesAndNewlines)
        .filter { !$0.isEmpty }
    let first = parts.first ?? ""
    let msg = c.isEnglish
        ? "Hello \(first) 🤍\nThis is your private GH Shopper page, with all your orders, invoices and purchase receipts:\n\(url)\nThis link is just for you, please don't share it."
        : "مرحبا \(first) 🤍\n"
        + "هذي صفحتك الخاصة في GH Shopper، فيها كل طلباتك والفواتير وإيصالات الشراء:\n"
        + "\(url)\n"
        + "الرابط خاص فيك، لا تشاركه مع أحد."
    openURL("https://wa.me/\(p)?text=\(encodeComponent(msg))")
}

@MainActor
fileprivate func copyPortal(_ c: Customer, reset: Bool = false) async {
    if reset {
        let ok = await confirm("تغيير رابط \(c.name)؟ الرابط القديم بيتوقف.")
        if !ok { return }
    }
    guard let url = await portalLink(c, reset: reset) else { return }
    UIPasteboard.general.string = url
    toast(reset ? "تغيّر الرابط ونسخته" : "نسخت الرابط")
}

// ───────────────────────── Every order of one customer ─────────────────────────

/// Every order of one customer, newest first.
fileprivate struct CustomerOrdersPage: View {
    let customerId: String
    @ObservedObject private var store = Store.shared

    init(customerId: String) { self.customerId = customerId }

    var body: some View {
        let orders = newestFirst(store.ordersOf(customerId))
        return GHPage("الطلبات") {
            GHSection {
                ForEach(orders) { o in
                    OrderRow(order: o, showCustomer: false, onTap: { pushPage(OrderDetailPage(orderId: o.id)) })
                }
            }
        }
    }
}

// ───────────────────────── Picker ─────────────────────────

/// Choose a customer (or add a new one). Gives back the chosen customer.
struct CustomerPickerPage: View {
    var done: ((Customer?) -> Void)?
    @ObservedObject private var store = Store.shared
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""

    init(done: ((Customer?) -> Void)? = nil) { self.done = done }

    private var list: [Customer] { store.customers.filter { customerMatches($0, query) } }

    var body: some View {
        GHPage("اختر العميل") {
            Pad(top: 4) {
                SearchBox(placeholder: "بحث", text: $query, autofocus: true)
            }
            GHSection {
                Tile("عميل جديد", titleFont: .gh(16), titleColor: GH.burgundy,
                     action: { addNew() },
                     leading: { IconBox("person.badge.plus") })
            }
            if !list.isEmpty {
                listSection
            }
        }
    }

    private var listSection: some View {
        let rows = list
        return GHSection {
            ForEach(rows) { c in
                Tile(c.name, subtitle: c.phone, action: { finish(c) },
                     leading: { Avatar(c.name, size: 32) })
            }
        }
    }

    private func addNew() {
        Task {
            let c: Customer? = await Nav.shared.presentForResult { d in CustomerFormPage(done: d) }
            if let c { finish(c) }
        }
    }

    private func finish(_ c: Customer) {
        if let done { done(c) } else { dismiss() }
    }
}
