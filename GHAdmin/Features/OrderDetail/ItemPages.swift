import SwiftUI
import UIKit

// Port of lib/pages/item_pages.dart

/// Same list as `paymentMethods` in order_form_page.dart.
fileprivate let itemPaymentMethods = ["تحويل بنكي", "نقداً", "رابط دفع", "أخرى"]

fileprivate func ipTrimmed(_ s: String) -> String { s.trimmingCharacters(in: .whitespacesAndNewlines) }
fileprivate func ipClean(_ s: String) -> String? { ipTrimmed(s).isEmpty ? nil : ipTrimmed(s) }
fileprivate func ipEnabled(_ on: Bool, _ f: @escaping () -> Void) -> (() -> Void)? { on ? f : nil }
fileprivate func ipFixed(_ v: Double, _ digits: Int) -> String { String(format: "%.\(digits)f", v) }

@MainActor
fileprivate func ipOpenWhatsApp(phone: String?, text: String) async -> Bool {
    let enc = text.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? ""
    let s: String
    if let p = waPhone(phone) { s = "https://wa.me/\(p)?text=\(enc)" } else { s = "https://wa.me/?text=\(enc)" }
    guard let url = URL(string: s) else { return false }
    return await UIApplication.shared.open(url, options: [:])
}

/// Currency picker shared by the purchase and plan pages.
@MainActor
fileprivate func ipPickRateCurrency() async -> String? {
    let actions: [SheetAction<String>] = rateCurrencies.map { SheetAction($0, $0) }
    return await pickAction(title: "العملة", actions: actions)
}

// MARK: - Item add / edit

struct ItemFormPage: View {
    let orderId: String
    let item: OrderItem?
    @StateObject private var price: PriceDraft
    @State private var brand: String
    @State private var name: String
    @State private var details: String
    @State private var saving = false
    @Environment(\.dismiss) private var dismiss

    init(orderId: String, item: OrderItem? = nil) {
        self.orderId = orderId
        self.item = item
        _price = StateObject(wrappedValue: PriceDraft(item: item))
        _brand = State(initialValue: item?.brand ?? "")
        _name = State(initialValue: item?.name ?? "")
        _details = State(initialValue: item?.details ?? "")
    }

    var body: some View {
        GHPage(item == nil ? "قطعة جديدة" : "تعديل القطعة", trailing: {
            if saving {
                ProgressView()
            } else {
                NavButton("حفظ", bold: true, action: { Task { await save() } })
            }
        }, leading: {
            NavButton("إلغاء", action: { dismiss() })
        }) {
            GHSection {
                FieldRow("البراند", text: $brand, placeholder: "Dior")
                FieldRow("القطعة", text: $name, placeholder: "Lady Dior", autofocus: item == nil)
                FieldRow("التفاصيل", text: $details, placeholder: "اختياري")
            }
            GHSection("سعر البيع") {
                PriceRows(draft: price)
            }
            Pad(h: 32, top: 8) {
                Text("سعر البيع للعميل شامل العمولة. سعر الشراء تسجله لما تشتريها.")
                    .font(TS.small).foregroundStyle(GH.secondary)
            }
        }
    }

    private func save() async {
        let n = ipTrimmed(name)
        if n.isEmpty {
            toast("اكتب اسم القطعة", error: true)
            return
        }
        saving = true
        do {
            try await Store.shared.saveItem(id: item?.id, orderId: orderId, name: n, brand: ipClean(brand),
                                            details: ipClean(details), price: price.omrValue, pricing: price.fields)
            price.remember()
            dismiss()
        } catch {
            saving = false
            toastError(error)
        }
    }
}

// MARK: - Record purchase

@MainActor fileprivate var ipLastPurchasePlace: PurchasePlace = .boutiqueEu

@MainActor
fileprivate func ipInitialPurchasePlace(_ i: OrderItem) -> PurchasePlace {
    if let p = i.purchasePlace { return p }
    if let p = i.planPlace { return p }
    if i.listCurrency == "AED" { return .dubai }
    if i.listCurrency == "EUR" { return .boutiqueEu }
    return ipLastPurchasePlace
}

/// Where it was bought and for how much. Private: never on the invoice.
struct PurchasePage: View {
    let item: OrderItem
    let done: ((Bool?) -> Void)?
    @StateObject private var picker = OrderPhotoPicker()
    @State private var place: PurchasePlace
    @State private var currency: String
    @State private var priceText: String
    @State private var rateText: String
    @State private var saving = false
    @State private var scanning = false
    @State private var scanNote: String? = nil
    @Environment(\.dismiss) private var dismiss

    init(item: OrderItem, done: ((Bool?) -> Void)? = nil) {
        self.item = item
        self.done = done
        // the plan made before the trip fills the form: confirm and save
        let p = ipInitialPurchasePlace(item)
        let cur = item.costCurrency ?? item.estCurrency ?? p.currency
        var guess: Double? = item.costAmount
        if guess == nil && item.estCurrency == cur { guess = item.estCost }
        if guess == nil && item.listCurrency == cur { guess = item.listPrice }
        _place = State(initialValue: p)
        _currency = State(initialValue: cur)
        _priceText = State(initialValue: guess.map { ipFixed($0, 2) } ?? "")
        _rateText = State(initialValue: item.costRate.map { "\($0)" } ?? Rates.shared.rateText(cur))
    }

    private var priceValue: Double { parseAmount(priceText) ?? 0 }
    private var rateValue: Double { parseAmount(rateText) ?? 0 }
    private var pct: Double { place.taxFreePct }

    var body: some View {
        GHPage("تسجيل الشراء", trailing: {
            if saving {
                ProgressView()
            } else {
                NavButton("دفعت", bold: true, action: { Task { await save() } })
            }
        }, leading: {
            NavButton("إلغاء", action: { close(nil) })
        }) {
            Pad(h: 32) {
                Text(item.title).font(TS.sub).foregroundStyle(GH.secondary)
            }
            planHint
            scanSection
            placeSection
            amountSection
            summarySection
        }
        .orderPhotoPicker(picker)
    }

    @ViewBuilder private var planHint: some View {
        if item.costAmount == nil, let e = item.estimate {
            Pad(h: 32, top: 6) {
                Text(planHintText(e)).font(TS.small).foregroundStyle(GH.blue)
            }
        }
    }

    private func planHintText(_ e: ItemEstimate) -> String {
        var parts: [String] = []
        if let s = item.planStore { parts.append(s) }
        parts.append("\(e.fromList ? "سعر البوتيك" : "تقريباً") \(money(e.amount, e.currency))")
        return "خطتك: \(parts.joined(separator: " · ")) — أكّد السعر الفعلي"
    }

    private var scanSection: some View {
        GHSection(footer: scanNote ?? "صوّر الإيصال ونعبي السعر والعملة عنك، وتنحفظ الصورة مع القطعة.") {
            Tile(scanning ? "نقرأ الإيصال…" : "اقرأ السعر من الإيصال",
                 action: ipEnabled(!scanning) { Task { await scanReceipt() } },
                 leading: { IconBox("doc.text.viewfinder", color: GH.burgundy) },
                 trailing: {
                     if scanning { ProgressView() }
                 })
        }
    }

    private var placeSection: some View {
        GHSection("وين اشتريتها؟") {
            Segments(value: Binding<PurchasePlace>(get: { place }, set: { choosePlace($0) }),
                     options: PurchasePlace.allCases.map { ($0, $0.label) })
        }
    }

    private var amountSection: some View {
        GHSection(footer: Rates.shared.isLive ? "سعر الصرف من السوق اليوم، وتقدر تعدّله." : "سعر صرف تقريبي، عدّله إذا تبي.") {
            if place == .other || currency != place.currency {
                PickerRow("العملة", value: currency, action: { Task { await pickCurrency() } })
            }
            AmountRow("سعر الشراء", text: $priceText, suffix: currency, autofocus: item.costAmount == nil)
            AmountRow("سعر الصرف", text: $rateText, suffix: "ر.ع / \(currency)")
        }
    }

    private var taxFreeLabel: String {
        pct > 0 ? "تاكس فري المفروض (\(ipFixed(pct, 0))٪)" : "تاكس فري"
    }

    private var summarySection: some View {
        GHSection(footer: "هذي البيانات لك بس، وما تطلع في الفاتورة. المبلغ ينخصم من رصيد العميل.") {
            KV("بالريال", omr(priceValue * rateValue))
            KV(taxFreeLabel, pct > 0 ? money(priceValue * pct / 100, currency) : "ما في",
               strong: pct > 0, color: pct > 0 ? GH.green : GH.secondary)
            KV("سعر البيع للعميل", omr(item.price), color: GH.secondary)
            if priceValue > 0 && rateValue > 0 {
                KV("ربحك التقديري", omr(item.price - priceValue * rateValue), color: GH.burgundy)
            }
        }
    }

    // MARK: actions

    private func close(_ v: Bool?) {
        if let done { done(v) } else { dismiss() }
    }

    private func choosePlace(_ p: PurchasePlace) {
        place = p
        if p != .other {
            currency = p.currency
            rateText = Rates.shared.rateText(currency)
        }
    }

    private func pickCurrency() async {
        guard let c = await ipPickRateCurrency() else { return }
        currency = c
        rateText = Rates.shared.rateText(c)
    }

    /// Photo of the boutique receipt: saved on the piece, and its total and
    /// currency filled in here (checked by you before saving).
    private func scanReceipt() async {
        let source = await pickAction(title: "صورة الإيصال", actions: [
            SheetAction("الكاميرا", true),
            SheetAction("من الصور", false),
        ])
        guard let camera = source else { return }
        guard let img = await picker.pick(camera: camera) else { return }
        guard let bytes = OrderPhotoPicker.jpeg(img, maxSide: 1800, quality: 0.85) else { return }
        scanning = true
        scanNote = nil
        let it = item
        Task { try? await Store.shared.uploadItemPhoto(it, kind: "receipt", data: bytes) }
        do {
            let res = (try await Api.shared.upload("/ps/receipt-scan", field: "file", data: bytes) as? JSON) ?? [:]
            applyScan(res)
        } catch {
            scanning = false
            toastError(error)
        }
    }

    private func applyScan(_ res: JSON) {
        scanning = false
        let total = jdn(res["total"])
        let cur = js(res["currency"])?.uppercased()
        if let total { priceText = ipFixed(total, 2) }
        if let cur, defaultRates[cur] != nil, cur != currency {
            let match = PurchasePlace.allCases.filter { $0 != .other && $0.currency == cur }
            place = (!match.isEmpty && match[0] == place) ? place : .other
            currency = cur
            rateText = Rates.shared.rateText(cur)
        }
        let storeName = js(res["store"])
        let storePart = storeName.map { " (\($0))" } ?? ""
        let totalPart = total.map { ipFixed($0, 2) } ?? "—"
        scanNote = "من الإيصال\(storePart): \(totalPart) \(cur ?? "") · راجعه قبل الحفظ"
    }

    private func save() async {
        let price = priceValue
        let rate = rateValue
        if price <= 0 {
            toast("اكتب سعر الشراء", error: true)
            return
        }
        if rate <= 0 {
            toast("سعر الصرف غير صحيح", error: true)
            return
        }
        saving = true
        do {
            try await Store.shared.recordPurchase(item, place: place, price: price, currency: currency, rate: rate)
            ipLastPurchasePlace = place
            close(true)
        } catch {
            saving = false
            toastError(error)
        }
    }
}

// MARK: - Buying plan

fileprivate func ipInitialPlanPlace(_ i: OrderItem) -> PurchasePlace? {
    if let p = i.planPlace { return p }
    if i.listCurrency == "AED" { return .dubai }
    if i.listCurrency == "EUR" { return .boutiqueEu }
    return nil
}

/// Before the trip: where the piece will be bought and roughly for how much,
/// so the total to pay (and the tax-free back) is known in advance. The real
/// price is confirmed at purchase. Private: never on the invoice.
struct PlanPage: View {
    let item: OrderItem
    let done: ((Bool?) -> Void)?
    @State private var storeText: String
    @State private var place: PurchasePlace?
    @State private var currency: String
    @State private var costText: String
    @State private var saving = false
    @Environment(\.dismiss) private var dismiss

    init(item: OrderItem, done: ((Bool?) -> Void)? = nil) {
        self.item = item
        self.done = done
        let p = ipInitialPlanPlace(item)
        let cur = item.estCurrency ?? item.listCurrency ?? p?.currency ?? "EUR"
        var c: Double? = item.estCost
        if c == nil && item.listCurrency == cur { c = item.listPrice }
        _storeText = State(initialValue: item.planStore ?? "")
        _place = State(initialValue: p)
        _currency = State(initialValue: cur)
        _costText = State(initialValue: c.map { ipFixed($0, 2) } ?? "")
    }

    private var knownStores: [String] {
        var out = Set<String>()
        for o in Store.shared.orders {
            for it in o.items {
                if let s = it.planStore { out.insert(s) }
            }
        }
        return out.sorted()
    }

    private var cost: Double { parseAmount(costText) ?? 0 }
    private var rate: Double { Rates.shared.rate(currency) }
    private var pct: Double { place?.taxFreePct ?? 0 }
    private var omrCost: Double { cost * rate }
    private var taxFree: Double { omrCost * pct / 100 }

    var body: some View {
        GHPage("وين وبكم", trailing: {
            if saving {
                ProgressView()
            } else {
                NavButton("حفظ", bold: true, action: { Task { await save() } })
            }
        }, leading: {
            NavButton("إلغاء", action: { close(nil) })
        }) {
            Pad(h: 32) {
                Text(item.title).font(TS.sub).foregroundStyle(GH.secondary)
            }
            whereSection
            costSection
            estimateSection
            clearSection
        }
    }

    private var placeBinding: Binding<PurchasePlace> {
        Binding<PurchasePlace>(get: { place ?? .other }, set: { p in
            place = p
            if p != .other { currency = p.currency }
        })
    }

    private var whereSection: some View {
        GHSection("وين بتشتريها؟") {
            FieldRow("المحل", text: $storeText, placeholder: "مثلاً: Dior Champs-Élysées")
            if !knownStores.isEmpty {
                Tile("اختر من محلات خطتك", action: { Task { await pickStore() } })
            }
            Segments(value: placeBinding, options: PurchasePlace.allCases.map { ($0, $0.label) })
        }
    }

    private var listFooter: String? {
        guard let lp = item.listPrice, let lc = item.listCurrency else { return nil }
        return "سعر البوتيك في الطلب: \(money(lp, lc))"
    }

    private var costSection: some View {
        GHSection("بكم تقريباً؟", footer: listFooter) {
            PickerRow("العملة", value: currency, action: { Task { await pickCurrency() } })
            AmountRow("السعر", text: $costText, suffix: currency)
        }
    }

    private var taxFreeLabel: String {
        pct > 0 ? "تاكس فري متوقع (\(ipFixed(pct, 0))٪)" : "تاكس فري"
    }

    @ViewBuilder private var estimateSection: some View {
        if cost > 0 {
            GHSection(footer: "تقريبي بسعر صرف اليوم. السعر الفعلي تأكده وقت الشراء.") {
                KV("تقريباً بالريال", omr(omrCost))
                KV(taxFreeLabel, pct > 0 ? "− \(omr(taxFree))" : "ما في", color: pct > 0 ? GH.green : GH.secondary)
                KV("الصافي", omr(omrCost - taxFree), strong: true)
                KV("سعر البيع للعميل", omr(item.price), color: GH.secondary)
                KV("ربح تقريبي", omr(item.price - (omrCost - taxFree)), color: GH.burgundy)
            }
        }
    }

    @ViewBuilder private var clearSection: some View {
        if item.hasPlan {
            GHSection {
                Tile("مسح الخطة", chevron: false, action: ipEnabled(!saving) { Task { await save(clear: true) } })
            }
        }
    }

    // MARK: actions

    private func close(_ v: Bool?) {
        if let done { done(v) } else { dismiss() }
    }

    private func pickStore() async {
        let actions: [SheetAction<String>] = knownStores.map { SheetAction($0, $0) }
        if let s = await pickAction(title: "محلات في خطتك", actions: actions) { storeText = s }
    }

    private func pickCurrency() async {
        if let c = await ipPickRateCurrency() { currency = c }
    }

    private func save(clear: Bool = false) async {
        let parsed = parseAmount(costText)
        var c: Double? = nil
        if !clear, let v = parsed, v > 0 { c = v }
        saving = true
        do {
            try await Store.shared.savePlan(item,
                                            store: clear ? "" : ipTrimmed(storeText),
                                            place: clear ? nil : place,
                                            cost: c,
                                            currency: currency,
                                            rate: Rates.shared.rate(currency))
            close(true)
        } catch {
            saving = false
            toastError(error)
        }
    }
}

// MARK: - Payment

struct PaymentFormPage: View {
    let order: Order
    @State private var amount: String
    @State private var note = ""
    @State private var method: String = itemPaymentMethods[0]
    @State private var date = Date()
    @State private var saving = false
    @Environment(\.dismiss) private var dismiss

    init(order: Order) {
        self.order = order
        _amount = State(initialValue: order.hasBalance ? plainOmr(order.remaining).replacingOccurrences(of: ",", with: "") : "")
    }

    var body: some View {
        GHPage("تسجيل دفعة", trailing: {
            if saving {
                ProgressView()
            } else {
                NavButton("حفظ", bold: true, action: { Task { await save() } })
            }
        }, leading: {
            NavButton("إلغاء", action: { dismiss() })
        }) {
            GHSection {
                AmountRow("المبلغ", text: $amount, autofocus: true)
                PickerRow("الطريقة", value: method, action: { Task { await pickMethod() } })
                PickerRow("التاريخ", value: dateStr(date), action: { Task { await chooseDate() } })
                FieldRow("ملاحظة", text: $note, placeholder: "اختياري")
            }
            Pad(h: 32, top: 8) {
                Text("المتبقي حالياً: \(omr(order.remaining))").font(TS.small).foregroundStyle(GH.secondary)
            }
        }
    }

    private func pickMethod() async {
        let actions: [SheetAction<String>] = itemPaymentMethods.map { SheetAction($0, $0) }
        if let m = await pickAction(actions: actions) { method = m }
    }

    private func chooseDate() async {
        if let d = await pickDate(date) { date = d }
    }

    private func save() async {
        let v = parseAmount(amount) ?? 0
        if v <= 0 {
            toast("اكتب المبلغ", error: true)
            return
        }
        saving = true
        do {
            try await Store.shared.addPayment(order.id, amount: v, method: method, paidOn: date, note: ipClean(note))
            dismiss()
        } catch {
            saving = false
            toastError(error)
        }
    }
}

// MARK: - WhatsApp message

struct MessagePage: View {
    let order: Order
    let template: MsgTemplate
    @State private var text: String
    @Environment(\.dismiss) private var dismiss

    init(order: Order, template: MsgTemplate) {
        self.order = order
        self.template = template
        _text = State(initialValue: template.build(order, Store.shared.customer(order.customerId)))
    }

    var body: some View {
        GHPage(template.title, leading: {
            NavButton("إلغاء", action: { dismiss() })
        }, bottom: {
            buttons
        }) {
            GHSection(footer: "تقدر تعدّل الرسالة قبل الإرسال.") {
                TextField("", text: $text, axis: .vertical)
                    .lineLimit(8...20)
                    .font(.gh(16))
                    .foregroundStyle(GH.label)
                    .lineSpacing(5)
                    .padding(16)
            }
        }
    }

    private var buttons: some View {
        GeometryReader { g in
            HStack(spacing: 10) {
                SecondaryButton("نسخ", icon: "doc.on.doc", action: { copyText(text, toastText: "تم النسخ") })
                    .frame(width: max(0, (g.size.width - 10) / 3))
                PrimaryButton("إرسال واتساب", icon: "paperplane.fill", action: { Task { await send() } })
            }
        }
        .frame(height: 52)
    }

    private func send() async {
        let c = Store.shared.customer(order.customerId)
        let ok = await ipOpenWhatsApp(phone: c?.phone, text: text)
        if ok {
            dismiss()
        } else {
            copyText(text, toastText: "ما قدرت أفتح واتساب، نسخت الرسالة")
        }
    }
}

// MARK: - Photo viewer

struct PhotoPage: View {
    let path: String
    let title: String
    @State private var url: URL? = nil
    @State private var scale: CGFloat = 1
    @State private var lastScale: CGFloat = 1
    @State private var offset: CGSize = .zero
    @State private var lastOffset: CGSize = .zero

    init(path: String, title: String) {
        self.path = path
        self.title = title
    }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            if let url {
                photo(url)
            } else {
                ProgressView().tint(.white)
            }
        }
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Color.black.opacity(0.8), for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .task(id: path) {
            if let s = try? await Store.shared.photoUrl(path) { url = URL(string: s) }
        }
    }

    private func photo(_ url: URL) -> some View {
        AsyncImage(url: url) { phase in
            switch phase {
            case .success(let img):
                img.resizable().scaledToFit()
            case .failure:
                Image(systemName: "photo").font(.system(size: 40)).foregroundStyle(.white)
            default:
                ProgressView().tint(.white)
            }
        }
        .scaleEffect(scale)
        .offset(offset)
        .gesture(zoom)
        .simultaneousGesture(pan)
        .onTapGesture(count: 2) {
            withAnimation(.easeOut(duration: 0.2)) { reset() }
        }
        .environment(\.layoutDirection, .leftToRight)
    }

    private func reset() {
        scale = 1
        lastScale = 1
        offset = .zero
        lastOffset = .zero
    }

    private var zoom: some Gesture {
        MagnifyGesture()
            .onChanged { v in
                scale = min(max(lastScale * v.magnification, 1), 5)
            }
            .onEnded { _ in
                lastScale = scale
                if scale <= 1 {
                    offset = .zero
                    lastOffset = .zero
                }
            }
    }

    private var pan: some Gesture {
        DragGesture()
            .onChanged { v in
                if scale > 1 {
                    offset = CGSize(width: lastOffset.width + v.translation.width,
                                    height: lastOffset.height + v.translation.height)
                }
            }
            .onEnded { _ in lastOffset = offset }
    }
}

/// Small rounded thumbnail of a stored photo.
struct Thumb: View {
    let path: String
    var size: CGFloat = 44

    var body: some View {
        RemoteImage(path: path)
            .frame(width: size, height: size)
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
    }
}
