import SwiftUI
import UIKit

// Port of lib/pages/drivers_pages.dart

fileprivate func driverRandomPassword() -> String {
    (0..<6).map { _ in String(Int.random(in: 0...9)) }.joined()
}

fileprivate func driverDisplayPhone(_ digits: String?) -> String {
    guard let digits else { return "" }
    if digits.hasPrefix("968") && digits.count == 11 { return String(digits.dropFirst(3)) }
    return digits
}

/// Like Dart's Uri.encodeComponent.
fileprivate func driversEncodeComponent(_ s: String) -> String {
    var ascii = CharacterSet()
    ascii.insert(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.!~*'()")
    return s.addingPercentEncoding(withAllowedCharacters: ascii) ?? s
}

fileprivate let whatsAppGreen = Color(hex: 0xFF25D366)

/// Offers to send the driver their login details on WhatsApp.
@MainActor
fileprivate func shareDriverLogin(name: String, phone: String, password: String) async {
    let shown = driverDisplayPhone(phone.count == 8 ? "968\(phone)" : phone)
    let msg = "هلا \(name) 👋\n"
        + "هذي بيانات دخولك لتطبيق GH Shopper للتوصيل:\n"
        + "الرقم: \(shown)\n"
        + "كلمة المرور: \(password)"
    let actions: [SheetAction<String>] = [
        SheetAction("إرسال واتساب", "wa"),
        SheetAction("نسخ", "copy"),
    ]
    let a = await pickAction(title: "تم إضافة \(name)", message: "أرسل له بيانات الدخول؟", actions: actions)
    if a == "wa" {
        let p = waPhone(phone) ?? ""
        openURL("https://wa.me/\(p)?text=\(driversEncodeComponent(msg))")
    } else if a == "copy" {
        UIPasteboard.general.string = msg
    }
}

// MARK: - Drivers list

struct DriversPage: View {
    @ObservedObject private var store = Store.shared

    var body: some View {
        GHPage("المناديب",
               trailing: { NavIcon("person.badge.plus") { presentForm(DriverFormPage()) } }) {
            if store.drivers.isEmpty {
                EmptyState(icon: "car.fill",
                           title: "ما في مناديب",
                           message: "أضف مندوب، وهو يدخل التطبيق برقمه وكلمة مرور. يشوف بس الطلبات اللي تسندها له.")
            } else {
                GHSection {
                    ForEach(store.drivers) { d in
                        driverTile(d)
                    }
                }
            }
        }
    }

    private func activeCount(_ d: Driver) -> Int {
        store.orders.filter { $0.driverId == d.id && $0.driverStatus != .delivered }.count
    }

    private func subtitle(_ d: Driver) -> String? {
        var parts = [driverDisplayPhone(d.phone)]
        if !d.active { parts.append("موقوف") }
        let s = parts.filter { !$0.isEmpty }.joined(separator: " · ")
        return s.isEmpty ? nil : s
    }

    private func driverTile(_ d: Driver) -> some View {
        let active = activeCount(d)
        let id = d.id
        return Tile(d.name,
                    subtitle: subtitle(d),
                    value: active > 0 ? "\(active) طلب" : nil,
                    valueColor: GH.blue,
                    valueFont: .gh(14),
                    action: { pushPage(DriverDetailPage(driverId: id)) },
                    leading: { Avatar(d.name) })
    }
}

// MARK: - Add driver

struct DriverFormPage: View {
    @State private var name = ""
    @State private var phone = ""
    @State private var password = driverRandomPassword()
    @State private var saving = false
    @Environment(\.dismiss) private var dismiss

    init() {}

    var body: some View {
        GHPage("مندوب جديد",
               trailing: { trailingButton },
               leading: { NavButton("إلغاء") { dismiss() } }) {
            GHSection(footer: "المندوب يحمّل نفس التطبيق ويدخل برقم جواله وكلمة المرور هذي.") {
                FieldRow("الاسم", text: $name, autofocus: true)
                FieldRow("الجوال", text: $phone, placeholder: "9XXXXXXX", keyboard: .phone, ltr: true)
                FieldRow("كلمة المرور", text: $password, keyboard: .number, ltr: true)
            }
        }
    }

    @ViewBuilder
    private var trailingButton: some View {
        if saving {
            ProgressView()
        } else {
            NavButton("إضافة", bold: true) { Task { await save() } }
        }
    }

    private func save() async {
        let digits = normalizeDigits(phone).filter { $0.isASCII && $0.isNumber }
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmedName.isEmpty || digits.count < 8 {
            toast("اكتب الاسم ورقم الجوال", error: true)
            return
        }
        if password.count < 6 {
            toast("كلمة المرور ٦ خانات على الأقل", error: true)
            return
        }
        saving = true
        do {
            try await Store.shared.createDriver(name: trimmedName, phone: digits, password: password)
            await shareDriverLogin(name: trimmedName, phone: digits, password: password)
            dismiss()
        } catch {
            saving = false
            toastError(error)
        }
    }
}

// MARK: - Driver detail

struct DriverDetailPage: View {
    let driverId: String
    @ObservedObject private var store = Store.shared
    @Environment(\.dismiss) private var dismiss

    init(driverId: String) { self.driverId = driverId }

    var body: some View {
        if let d = store.driver(driverId) {
            page(d)
        } else {
            GHPage("المندوب") {
                EmptyState(icon: "person", title: "غير موجود")
            }
        }
    }

    private func page(_ d: Driver) -> some View {
        let orders = store.orders.filter { $0.driverId == d.id }
        let open = orders.filter { $0.driverStatus != .delivered }
        let done = orders.filter { $0.driverStatus == .delivered }
        let collect = open.filter { $0.deliveryCollect }.reduce(0.0) { $0 + $1.deliveryFee }
        return GHPage(d.name) {
            stats(open: open.count, collect: collect)
            AdminDriverMoney(driverId: d.id, name: d.name)
            accountSection(d)
            openSection(open)
            doneSection(done)
            deleteButton(d)
        }
    }

    private func stats(open: Int, collect: Double) -> some View {
        HStack(spacing: 10) {
            StatCard(label: "طلبات معه", value: "\(open)", icon: "car.fill", hero: true)
            StatCard(label: "توصيل يحصّله", value: omr(collect), icon: "dollarsign.circle.fill", color: GH.amber)
        }
        .padding(.horizontal, 16)
        .padding(.top, 4)
    }

    private func accountSection(_ d: Driver) -> some View {
        let id = d.id
        let phone = d.phone
        let activeBinding = Binding<Bool>(
            get: { d.active },
            set: { v in Task { await attempt { try await Store.shared.saveDriver(id, active: v) } } })
        return GHSection {
            Tile("واتساب",
                 value: driverDisplayPhone(phone),
                 action: {
                     if let p = waPhone(phone) { openURL("https://wa.me/\(p)") }
                 },
                 leading: { IconBox("bubble.left.fill", color: whatsAppGreen) })
            SwitchRow("الحساب شغّال",
                      subtitle: d.active ? nil : "ما يقدر يشوف أي طلب",
                      isOn: activeBinding)
            Tile("كلمة مرور جديدة",
                 action: { Task { await resetPassword(d) } },
                 leading: { IconBox("lock.rotation", color: GH.purple) })
        }
    }

    @ViewBuilder
    private func openSection(_ open: [Order]) -> some View {
        if !open.isEmpty {
            GHSection("معه الحين") {
                ForEach(open) { o in
                    DriverDeliveryRow(order: o)
                }
            }
        }
    }

    @ViewBuilder
    private func doneSection(_ done: [Order]) -> some View {
        if !done.isEmpty {
            GHSection("سلّمها") {
                ForEach(Array(done.prefix(20))) { o in
                    DriverDeliveryRow(order: o)
                }
            }
        }
    }

    private func deleteButton(_ d: Driver) -> some View {
        Button {
            Task { await delete(d) }
        } label: {
            Text("حذف المندوب")
                .font(.gh(17))
                .foregroundStyle(GH.red)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 16)
        .padding(.top, 24)
    }

    // MARK: actions

    private func resetPassword(_ d: Driver) async {
        let pw = driverRandomPassword()
        do {
            try await Store.shared.setDriverPassword(d.id, pw)
            await shareDriverLogin(name: d.name, phone: d.phone ?? "", password: pw)
        } catch {
            toastError(error)
        }
    }

    private func delete(_ d: Driver) async {
        let ok = await confirm("حذف \(d.name)؟", message: "يتسكّر حسابه، والطلبات تبقى عندك.", ok: "حذف")
        if !ok { return }
        do {
            try await Store.shared.deleteDriver(d.id)
            dismiss()
        } catch {
            toastError(error)
        }
    }
}

fileprivate struct DriverDeliveryRow: View {
    let order: Order
    @ObservedObject private var store = Store.shared

    private var subtitle: String {
        var parts = [order.invoiceNo]
        if order.deliveryCollect && order.deliveryFee > 0 { parts.append("يحصّل \(omr(order.deliveryFee))") }
        return parts.joined(separator: " · ")
    }

    var body: some View {
        let name = store.customerName(order)
        let id = order.id
        let s = order.driverStatus
        Tile(name,
             subtitle: subtitle,
             action: { pushPage(OrderDetailPage(orderId: id)) },
             leading: { leadingView(name) },
             trailing: {
                 if let s { Badge(s.label, color: s.color) }
             })
    }

    @ViewBuilder
    private func leadingView(_ name: String) -> some View {
        if let path = order.deliveryPhotoPath {
            Thumb(path: path, size: 38)
        } else {
            Avatar(name, size: 34)
        }
    }
}

// MARK: - Delivery of one order

/// Choose the driver, address and who pays delivery for an order.
struct DeliveryPage: View {
    let order: Order

    @ObservedObject private var store = Store.shared
    @Environment(\.dismiss) private var dismiss

    @State private var driverId: String?
    @State private var address: String
    @State private var note: String
    @State private var collect: Bool
    @State private var method: DeliveryMethod
    @State private var fee: String
    @State private var tracking: String
    @State private var saving = false

    init(order: Order) {
        self.order = order
        _driverId = State(initialValue: order.driverId)
        let addr = order.deliveryAddress ?? Store.shared.customer(order.customerId)?.address
        _address = State(initialValue: addr ?? "")
        _note = State(initialValue: order.driverNote ?? "")
        let c = order.driverId == nil ? (order.deliveryFee > 0 && order.hasBalance) : order.deliveryCollect
        _collect = State(initialValue: c)
        _method = State(initialValue: order.deliveryMethod ?? .home)
        _fee = State(initialValue: DeliveryPage.plainFee(order.deliveryFee))
        _tracking = State(initialValue: order.carrierTracking ?? "")
    }

    static func plainFee(_ v: Double) -> String {
        if v == v.rounded() { return String(format: "%.0f", v) }
        return "\(v)"
    }

    /// The status shown only while the chosen driver is still the order's driver.
    private var shownStatus: DriverStatus? { order.driverId == driverId ? order.driverStatus : nil }

    var body: some View {
        GHPage("التوصيل",
               trailing: { trailingButton },
               leading: { NavButton("إلغاء") { dismiss() } }) {
            headerLine
            methodSection
            driverSection
            addressSection
            paymentSection
            noteSection
            photoSection
        }
    }

    @ViewBuilder
    private var trailingButton: some View {
        if saving {
            ProgressView()
        } else {
            NavButton("حفظ", bold: true) { Task { await save() } }
        }
    }

    private var headerLine: some View {
        Text("\(store.customerName(order)) · \(order.invoiceNo)")
            .font(TS.sub)
            .foregroundStyle(GH.secondary)
            .padding(.horizontal, 32)
    }

    private var methodSection: some View {
        GHSection("طريقة التوصيل") {
            DeliveryPicker(value: method, onChanged: { m in chooseMethod(m) })
            AmountRow("رسوم التوصيل", text: $fee)
            if method.isCourier {
                FieldRow("رابط التتبّع", text: $tracking,
                         placeholder: "الصق رسالة \(method.carrierName) أو الرابط", ltr: true)
            }
        }
    }

    @ViewBuilder
    private var driverSection: some View {
        if !method.isCourier {
            GHSection {
                PickerRow("المندوب", value: store.driver(driverId)?.name, placeholder: "اختر") {
                    Task { await pickDriver() }
                }
                if let s = shownStatus {
                    Tile("الحالة", chevron: false, trailing: { Badge(s.label, color: s.color) })
                }
            }
        }
    }

    private var addressSection: some View {
        GHSection("العنوان", footer: "يطلع للمندوب. تقدر تلصق رابط الموقع من خرائط قوقل.") {
            NotesRow(text: $address, placeholder: "الحي، السكة، رقم المنزل، أو رابط الموقع")
        }
    }

    @ViewBuilder
    private var paymentSection: some View {
        if !method.isCourier {
            GHSection("الدفع") {
                Segments(value: $collect, options: [(false, "مدفوعة مسبقاً"), (true, "يحصّلها المندوب")])
            }
        }
    }

    @ViewBuilder
    private var noteSection: some View {
        if !method.isCourier {
            GHSection("ملاحظة للمندوب") {
                NotesRow(text: $note, placeholder: "مثلاً: اتصل قبل لا توصل، بعد الساعة ٥")
            }
        }
    }

    @ViewBuilder
    private var photoSection: some View {
        if let path = order.deliveryPhotoPath {
            GHSection("صورة التسليم") {
                Tile("صورة من المندوب",
                     subtitle: order.driverDeliveredAt == nil ? nil : dateStr(order.driverDeliveredAt),
                     action: { pushPage(PhotoPage(path: path, title: "صورة التسليم")) },
                     leading: { Thumb(path: path, size: 52) })
            }
        }
    }

    // MARK: actions

    private func chooseMethod(_ m: DeliveryMethod) {
        let wasGulf = method.isGulf
        method = m
        // a Gulf order keeps the shipping the customer paid when only the company changes
        if !(wasGulf && m.isGulf) { fee = DeliveryPage.plainFee(store.settings.feeFor(m)) }
        if m.isCourier { driverId = nil }
    }

    private func pickDriver() async {
        let drivers = store.drivers.filter { $0.active }
        if drivers.isEmpty {
            toast("أضف مندوب أول من المزيد ← المناديب", error: true)
            return
        }
        var actions: [SheetAction<String>] = drivers.map { SheetAction($0.name, $0.id) }
        if driverId != nil { actions.append(SheetAction("بدون مندوب", "", destructive: true)) }
        if let id = await pickAction(title: "المندوب", actions: actions) {
            driverId = id.isEmpty ? nil : id
        }
    }

    private func save() async {
        saving = true
        let addr = address.trimmingCharacters(in: .whitespacesAndNewlines)
        // Accepts the courier's whole SMS: keeps just the link if there is one.
        let raw = tracking.trimmingCharacters(in: .whitespacesAndNewlines)
        var trk = raw
        if let r = raw.range(of: "https?://\\S+", options: .regularExpression) {
            trk = String(raw[r])
        }
        let trackingValue: Any = (method.isCourier && !trk.isEmpty) ? trk : NSNull()
        let trimmedNote = note.trimmingCharacters(in: .whitespacesAndNewlines)
        do {
            try await Store.shared.updateOrder(order.id, [
                "delivery_method": method.key,
                "delivery_fee": parseAmount(fee) ?? 0,
                "carrier_tracking": trackingValue,
            ])
            try await Store.shared.setDelivery(order,
                                               driverId: driverId,
                                               address: addr.isEmpty ? nil : addr,
                                               collect: collect,
                                               note: trimmedNote.isEmpty ? nil : trimmedNote)
            dismiss()
        } catch {
            saving = false
            toastError(error)
        }
    }
}
