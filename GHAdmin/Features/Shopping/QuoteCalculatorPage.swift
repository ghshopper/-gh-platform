import SwiftUI
import UIKit

// حاسبة عرض السعر: boutique price → cost in OMR, tax-free back, a nicely
// rounded selling price and your profit. Sends the offer on WhatsApp or turns
// it into an order.

// MARK: - Helpers

fileprivate func qcEnabled(_ on: Bool, _ f: @escaping () -> Void) -> (() -> Void)? { on ? f : nil }

fileprivate func qcClean(_ s: String) -> String? {
    let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
    return t.isEmpty ? nil : t
}

/// 25.04 → "25٪"
fileprivate func qcPct(_ v: Double) -> String { amountText((v * 10).rounded() / 10) + "٪" }

/// Whole prices without decimals in messages ("450 ر.ع"), others as usual.
fileprivate func qcPrice(_ v: Double, english: Bool) -> String {
    if abs(v - v.rounded()) < 0.0005 {
        return english ? "\(Int(v.rounded())) OMR" : "\(Int(v.rounded())) ر.ع"
    }
    return english ? omrLatin(v) : omr(v)
}

/// Feminine or masculine wording, like Core/Messages.swift.
fileprivate func qcG(_ c: Customer?, _ female: String, _ male: String) -> String { (c?.isMale ?? false) ? male : female }

/// The offer for WhatsApp (Arabic by the customer's gender, or English).
@MainActor
func quoteMessage(customer c: Customer?, brand: String?, name: String?, details: String?, price: Double) -> String {
    let en = c?.isEnglish ?? false
    let first = c?.firstName ?? ""
    let title = [brand, name].compactMap { $0 }.joined(separator: " · ")
    let detailPart = details.map { " (\($0))" } ?? ""
    if en {
        let piece = title.isEmpty ? "The piece you asked for" : title
        return "\(first.isEmpty ? "Hello 🤍" : "Hello \(first) 🤍")\n" +
            "Here's your price from GH Shopper:\n\n" +
            "• \(piece)\(detailPart)\n\n" +
            "Price: \(qcPrice(price, english: true))\n" +
            "The price includes buying and shipping ✈️\n" +
            "If it suits you, just reply here and we'll confirm your order 🐆"
    }
    let piece = title.isEmpty ? "القطعة اللي \(qcG(c, "طلبتيها", "طلبتها"))" : title
    return "\(first.isEmpty ? "هلا 🤍" : "هلا \(first) 🤍")\n" +
        "عرض السعر من GH Shopper:\n\n" +
        "• \(piece)\(detailPart)\n\n" +
        "السعر: \(qcPrice(price, english: false))\n" +
        "السعر شامل الشراء والشحن ✈️\n" +
        "إذا \(qcG(c, "يناسبكِ", "يناسبك")) \(qcG(c, "ردّي", "ردّ")) علينا هنا ونأكّد \(qcG(c, "طلبكِ", "طلبك")) 🐆"
}

/// Opens WhatsApp (every character escaped, so "Dolce & Gabbana" survives). False when it couldn't.
@MainActor
fileprivate func qcOpenWhatsApp(phone: String?, text: String) async -> Bool {
    let enc = text.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? ""
    let s: String
    if let p = waPhone(phone) { s = "https://wa.me/\(p)?text=\(enc)" } else { s = "https://wa.me/?text=\(enc)" }
    guard let url = URL(string: s) else { return false }
    return await UIApplication.shared.open(url, options: [:])
}

// MARK: - Remembered choices

fileprivate enum QCMarginMode: String, Hashable { case percent, fixed }

fileprivate enum QCPrefs {
    private static var d: UserDefaults { UserDefaults.standard }

    static var currency: String {
        get { d.string(forKey: "gh_qc_cur") ?? "EUR" }
        set { d.set(newValue, forKey: "gh_qc_cur") }
    }

    static var mode: QCMarginMode {
        get { QCMarginMode(rawValue: d.string(forKey: "gh_qc_mode") ?? "") ?? .percent }
        set { d.set(newValue.rawValue, forKey: "gh_qc_mode") }
    }

    /// Last margin per mode (the % starts from the last commission typed on an order).
    static func margin(_ m: QCMarginMode) -> Double {
        let k = "gh_qc_margin_\(m.rawValue)"
        if d.object(forKey: k) != nil { return d.double(forKey: k) }
        if m == .percent {
            let c = d.double(forKey: "gh_last_commission")
            return c > 0 ? c : 20
        }
        return 30
    }

    static func setMargin(_ v: Double, _ m: QCMarginMode) { d.set(v, forKey: "gh_qc_margin_\(m.rawValue)") }

    /// Expected tax-free per currency (12 for EUR, 4 for AED at first).
    static func taxFree(_ cur: String) -> Double {
        let k = "gh_qc_tf_\(cur)"
        if d.object(forKey: k) != nil { return d.double(forKey: k) }
        switch cur {
        case "EUR": return PurchasePlace.boutiqueEu.taxFreePct
        case "AED": return PurchasePlace.dubai.taxFreePct
        default: return 0
        }
    }

    static func setTaxFree(_ v: Double, _ cur: String) { d.set(v, forKey: "gh_qc_tf_\(cur)") }

    static var roundUp: Bool {
        get { d.object(forKey: "gh_qc_round") == nil ? true : d.bool(forKey: "gh_qc_round") }
        set { d.set(newValue, forKey: "gh_qc_round") }
    }
}

// MARK: - Page

@MainActor
struct QuoteCalculatorPage: View {
    @ObservedObject private var rates = Rates.shared
    @State private var customer: Customer?
    @State private var brand = ""
    @State private var name = ""
    @State private var details = ""
    @State private var currency: String
    @State private var priceText = ""
    @State private var rateText: String
    @State private var rateEdited = false
    @State private var mode: QCMarginMode
    @State private var marginText: String
    @State private var taxFreeText: String
    @State private var roundUp: Bool
    @State private var saving = false

    init(customer: Customer? = nil) {
        let cur = QCPrefs.currency
        let m = QCPrefs.mode
        _customer = State(initialValue: customer)
        _currency = State(initialValue: cur)
        _rateText = State(initialValue: Rates.shared.rateText(cur))
        _mode = State(initialValue: m)
        _marginText = State(initialValue: amountText(QCPrefs.margin(m)))
        _taxFreeText = State(initialValue: amountText(QCPrefs.taxFree(cur)))
        _roundUp = State(initialValue: QCPrefs.roundUp)
    }

    // MARK: numbers

    private var price: Double { max(0, parseAmount(priceText) ?? 0) }
    private var rate: Double { max(0, parseAmount(rateText) ?? 0) }
    private var margin: Double { parseAmount(marginText) ?? 0 }
    private var taxFreePct: Double { min(max(parseAmount(taxFreeText) ?? 0, 0), 100) }
    private var cost: Double { price * rate }
    private var taxBack: Double { cost * taxFreePct / 100 }
    private var rawSell: Double { mode == .percent ? cost * (1 + margin / 100) : cost + margin }
    /// Rounded up to the next 5 rials (or to the baisa when rounding is off).
    private var sell: Double {
        let r = rawSell
        guard r > 0.0005 else { return 0 }
        if roundUp { return (max(0, r - 0.0005) / 5).rounded(.up) * 5 }
        return (r * 1000).rounded() / 1000
    }
    private var profit: Double { sell - cost }
    private var profitPct: Double { cost > 0 ? profit / cost * 100 : 0 }
    private var profitWithTaxFree: Double { profit + taxBack }
    private var ready: Bool { sell > 0 && cost > 0 }

    // MARK: body

    var body: some View {
        GHPage("حاسبة عرض السعر", trailing: {
            if saving { ProgressView() }
        }, bottom: {
            HStack(spacing: 10) {
                SecondaryButton("حوّله طلب", icon: "doc.badge.plus", action: qcEnabled(ready && !saving) { Task { await convert() } })
                PrimaryButton("أرسل العرض", icon: "paperplane.fill", action: qcEnabled(ready) { Task { await sendQuote() } })
            }
        }) {
            boutiqueSection
            QCResultCard(sell: sell, cost: cost, profit: profit, profitWithTaxFree: profitWithTaxFree)
            marginSection
            detailsSection
            pieceSection
        }
        .task { await Rates.shared.load() }
        .onChange(of: rates.rates) { _, _ in
            if !rateEdited { rateText = Rates.shared.rateText(currency) }
        }
        .onChange(of: mode) { old, new in
            QCPrefs.setMargin(margin, old)
            QCPrefs.mode = new
            marginText = amountText(QCPrefs.margin(new))
        }
        .onChange(of: marginText) { _, _ in
            if let v = parseAmount(marginText) { QCPrefs.setMargin(v, mode) }
        }
        .onChange(of: taxFreeText) { _, _ in
            if let v = parseAmount(taxFreeText) { QCPrefs.setTaxFree(min(max(v, 0), 100), currency) }
        }
        .onChange(of: roundUp) { _, v in QCPrefs.roundUp = v }
    }

    private var rateBinding: Binding<String> {
        Binding(get: { rateText }, set: { rateText = $0; rateEdited = true })
    }

    private var rateFooter: String {
        let live = "1 \(currency) = \(Rates.shared.rateText(currency)) ر.ع"
        if rateEdited { return "عدّلت سعر الصرف. سعر السوق اليوم: \(live)" }
        return Rates.shared.isLive ? "سعر الصرف من السوق اليوم (\(live))، وتقدر تعدّله." : "سعر صرف تقريبي (\(live))، عدّله إذا تبي."
    }

    private var boutiqueSection: some View {
        GHSection("سعر البوتيك", footer: rateFooter, trailing: {
            if rateEdited {
                HeaderButton("سعر اليوم", icon: "arrow.counterclockwise") {
                    rateText = Rates.shared.rateText(currency)
                    rateEdited = false
                }
            }
        }) {
            PickerRow("العملة", value: currency) { Task { await pickCurrency() } }
            AmountRow("السعر", text: $priceText, suffix: currency, autofocus: true)
            AmountRow("سعر الصرف", text: rateBinding, suffix: "ر.ع / \(currency)")
        }
    }

    private var marginSection: some View {
        GHSection("ربحك", footer: "التاكس فري ما ينحسب في سعر البيع، هو ربح زيادة لك.") {
            Segments(value: $mode, options: [(QCMarginMode.percent, "نسبة ٪"), (QCMarginMode.fixed, "مبلغ ثابت")])
            AmountRow(mode == .percent ? "النسبة" : "المبلغ", text: $marginText, suffix: mode == .percent ? "٪" : "ر.ع")
            AmountRow("تاكس فري متوقع", text: $taxFreeText, suffix: "٪")
            SwitchRow("قرّب لفوق لأقرب ٥ ر.ع", isOn: $roundUp)
        }
    }

    private var detailsSection: some View {
        GHSection("الحساب") {
            KV("التكلفة بالريال", omr(cost))
            KV(taxFreePct > 0 ? "تاكس فري يرجع لك (\(amountText(taxFreePct))٪)" : "تاكس فري",
               taxFreePct > 0 ? omr(taxBack) : "ما في", color: taxFreePct > 0 ? GH.green : GH.secondary)
            if roundUp && sell > 0 && abs(sell - rawSell) > 0.0005 {
                KV("قبل التقريب", omr(rawSell), color: GH.secondary)
            }
            KV("سعر البيع المقترح", omr(sell), strong: true, color: GH.burgundy)
            KV("ربحك", ready ? "\(omr(profit)) · \(qcPct(profitPct))" : "—", color: profit < 0 ? GH.red : GH.label)
            KV("ربحك مع التاكس فري", ready ? omr(profitWithTaxFree) : "—", strong: true,
               color: profitWithTaxFree < 0 ? GH.red : GH.green)
        }
    }

    private var pieceSection: some View {
        GHSection("القطعة والعميل", footer: "اختياري. يطلع في رسالة العرض وفي الطلب.") {
            BrandField(text: $brand, placeholder: "Cartier")
            FieldRow("القطعة", text: $name, placeholder: "Love Bracelet")
            FieldRow("المقاس", text: $details, placeholder: "المقاس، اللون…")
            PickerRow("العميل", value: customer?.name, placeholder: "اختياري") { Task { _ = await pickCustomer() } }
        }
    }

    // MARK: actions

    private func pickCurrency() async {
        let actions: [SheetAction<String>] = rateCurrencies.map { SheetAction($0, $0) }
        guard let c = await pickAction(title: "العملة", actions: actions) else { return }
        currency = c
        QCPrefs.currency = c
        rateText = Rates.shared.rateText(c)
        rateEdited = false
        taxFreeText = amountText(QCPrefs.taxFree(c))
    }

    private func pickCustomer() async -> Customer? {
        let c: Customer? = await Nav.shared.pushForResult { done in CustomerPickerPage(done: done) }
        if let c { customer = c }
        return c
    }

    private func sendQuote() async {
        var c = customer
        if c == nil {
            let a: Int? = await pickAction(title: "لمين العرض؟", actions: [
                SheetAction("اختر العميل", 1),
                SheetAction("بدون عميل (أختار في واتساب)", 2),
            ])
            guard let a else { return }
            if a == 1 {
                guard let picked = await pickCustomer() else { return }
                c = picked
            }
        }
        let text = quoteMessage(customer: c, brand: qcClean(brand), name: qcClean(name), details: qcClean(details), price: sell)
        presentForm(QuoteMessagePage(customer: c, text: text))
    }

    /// A new order with this piece (OrderFormPage can't be prefilled with a piece, so it's made directly).
    private func convert() async {
        var chosen = customer
        if chosen == nil { chosen = await pickCustomer() }
        guard let c = chosen else { return }
        let n = qcClean(name) ?? "قطعة"
        let b = qcClean(brand)
        let title = b == nil ? n : "\(b!) · \(n)"
        guard await confirm("نسوّي طلب لـ \(c.name)؟", message: "\(title) بـ \(omr(sell))", ok: "سوّ الطلب", destructive: false) else { return }
        guard let trip = await pickTrip(current: Store.shared.shopDefaultTripId) else { return }
        var item: JSON = ["name": n, "brand": nn(b), "details": nn(qcClean(details)), "price": sell]
        if currency != "OMR" && price > 0 {
            item["list_price"] = price
            item["list_currency"] = currency
            if cost > 0 {
                item["commission_pct"] = ((sell / cost - 1) * 10000).rounded() / 100
            }
        }
        saving = true
        do {
            let id = try await Store.shared.createOrder(
                customerId: c.id, tripId: trip.isEmpty ? nil : trip,
                deliveryFee: Store.shared.settings.deliveryHomeFee, deliveryMethod: DeliveryMethod.home.key,
                notes: nil, items: [item], deposit: 0, depositMethod: nil)
            saving = false
            toast("انسوّى الطلب")
            if !id.isEmpty { pushPage(OrderDetailPage(orderId: id)) }
        } catch {
            saving = false
            toastError(error)
        }
    }
}

// MARK: - Result card

fileprivate struct QCResultCard: View {
    let sell: Double
    let cost: Double
    let profit: Double
    let profitWithTaxFree: Double

    var body: some View {
        ZStack(alignment: .bottomLeading) {
            if let img = GHImage.named("story_cheetah_light") {
                Image(uiImage: img).resizable().scaledToFit().frame(width: 130).opacity(0.18)
                    .offset(x: -18, y: -4)
            }
            VStack(alignment: .leading, spacing: 6) {
                Text("سعر البيع المقترح").font(.gh(14, .medium)).foregroundStyle(GH.goldLight)
                Text(sell > 0 ? omr(sell) : "—")
                    .font(.gh(34, .bold).monospacedDigit()).foregroundStyle(.white)
                    .lineLimit(1).minimumScaleFactor(0.5)
                if sell > 0 && cost > 0 {
                    Text("التكلفة \(omr(cost)) · ربحك \(omr(profit))")
                        .font(.gh(13.5)).foregroundStyle(GH.goldLight)
                    Text("مع التاكس فري \(omr(profitWithTaxFree))")
                        .font(.gh(13.5, .semibold)).foregroundStyle(.white)
                } else {
                    Text("اكتب سعر البوتيك").font(.gh(13.5)).foregroundStyle(GH.goldLight)
                }
            }
            .padding(18)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 22, style: .continuous).fill(GH.brandGradient))
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .shadow(color: GH.burgundyDeep.opacity(0.27), radius: 11, y: 10)
        .padding(.horizontal, 16).padding(.top, 18)
    }
}

// MARK: - Message before sending

/// The offer, editable before WhatsApp opens (same pattern as MessagePage, without an order).
@MainActor
struct QuoteMessagePage: View {
    let customer: Customer?
    @State private var text: String

    init(customer: Customer?, text: String) {
        self.customer = customer
        _text = State(initialValue: text)
    }

    var body: some View {
        GHPage("عرض السعر", leading: {
            NavButton("إلغاء") { dismissForm() }
        }, bottom: {
            HStack(spacing: 10) {
                SecondaryButton("نسخ", icon: "doc.on.doc") { copyText(text, toastText: "تم النسخ") }
                    .frame(width: 120)
                PrimaryButton("إرسال واتساب", icon: "paperplane.fill") { Task { await send() } }
            }
        }) {
            if let c = customer {
                Pad(h: 22, top: 6) {
                    Text(c.phone.map { "إلى \(c.name) · \($0)" } ?? "إلى \(c.name)")
                        .font(TS.sub).foregroundStyle(GH.secondary)
                }
            }
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

    private func send() async {
        if await qcOpenWhatsApp(phone: customer?.phone, text: text) {
            dismissForm()
        } else {
            copyText(text, toastText: "ما قدرت أفتح واتساب، نسخت الرسالة")
        }
    }
}
