import SwiftUI
import UIKit

// Port of lib/pages/order_detail_page.dart

/// An action that is nil (disabled) when `on` is false.
fileprivate func enabled(_ on: Bool, _ f: @escaping () -> Void) -> (() -> Void)? { on ? f : nil }

/// Opens WhatsApp with the text. Returns false when it could not be opened.
@MainActor
fileprivate func sendWhatsApp(phone: String?, text: String) async -> Bool {
    let enc = text.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? ""
    let s: String
    if let p = waPhone(phone) { s = "https://wa.me/\(p)?text=\(enc)" } else { s = "https://wa.me/?text=\(enc)" }
    guard let url = URL(string: s) else { return false }
    return await UIApplication.shared.open(url, options: [:])
}

/// Trip picker (same as pickTrip in trips_page.dart).
@MainActor
fileprivate func pickTripForOrder(current: String?) async -> String? {
    var actions: [SheetAction<String>] = Store.shared.trips.map { t in
        SheetAction(t.id == current ? "✓ \(t.name)" : t.name, t.id)
    }
    actions.append(SheetAction("بدون رحلة", ""))
    actions.append(SheetAction("＋ رحلة جديدة", "__new"))
    let v = await actionSheet(title: "الرحلة", actions: actions)
    if v == "__new" {
        // TripFormPage (contract) gives no result back: open it, the order keeps its trip.
        presentForm(TripFormPage())
        return nil
    }
    return v
}

/// Prints the shipping label for an order and records it on the server.
@MainActor
func printOrderWaybill(_ o: Order) async {
    let s = Store.shared
    do {
        try await printWaybill(o, customer: s.customer(o.customerId), biz: s.settings,
                               driverName: s.driver(o.driverId)?.name)
        try await s.markLabelPrinted(o.id)
    } catch {
        toastError(error)
    }
}

struct OrderDetailPage: View {
    let orderId: String
    @ObservedObject private var store = Store.shared
    @StateObject private var picker = OrderPhotoPicker()
    @State private var busy = false
    @Environment(\.dismiss) private var dismiss

    init(orderId: String) {
        self.orderId = orderId
    }

    var body: some View {
        content.orderPhotoPicker(picker)
    }

    @ViewBuilder private var content: some View {
        if let o = store.order(orderId) {
            page(o)
        } else {
            GHPage("الطلب") {
                EmptyState(icon: "doc.text", title: "الطلب غير موجود")
            }
        }
    }

    // MARK: - Page

    private func page(_ o: Order) -> some View {
        GHPage(o.invoiceNo, onRefresh: { await Store.shared.refresh() }, trailing: {
            if busy {
                ProgressView()
            } else {
                NavIcon("ellipsis.circle", action: { Task { await orderActions(o) } })
            }
        }, bottom: {
            bottomBar(o)
        }) {
            summaryCard(o)
            markAllBar(o)
            quickBar(o)
            itemsSection(o)
            shippedSection(o)
            deliverySection(o)
            eventsSection(o)
            paymentsSection(o)
            privateSection(o)
        }
    }

    private func bottomBar(_ o: Order) -> some View {
        HStack(spacing: 10) {
            SecondaryButton("الفاتورة", icon: "doc.richtext", action: enabled(!busy) { Task { await sharePdf(o) } })
            PrimaryButton("واتساب", icon: "bubble.left.fill", action: { Task { await pickMessage(o) } })
        }
    }

    // MARK: summary card

    private func summaryCard(_ o: Order) -> some View {
        let customer = store.customer(o.customerId)
        return VStack(alignment: .leading, spacing: 0) {
            summaryHeader(o, customer)
            summaryMoney(o).padding(.top, 14)
            if let n = o.notes {
                Text(n).font(TS.sub).foregroundStyle(GH.secondary).padding(.top, 10)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(GH.card))
        .padding(.horizontal, 16)
        .padding(.top, 4)
    }

    private func summaryHeader(_ o: Order, _ customer: Customer?) -> some View {
        let st = o.overallStatus
        return HStack(spacing: 10) {
            Avatar(customer?.name ?? "")
            VStack(alignment: .leading, spacing: 2) {
                Text(customer?.name ?? "—").font(TS.title).foregroundStyle(GH.label)
                Text(summaryLine(o)).font(TS.sub).foregroundStyle(GH.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Badge(st.label, color: st.color)
        }
        .contentShape(Rectangle())
        .onTapGesture {
            if let c = customer { pushPage(CustomerDetailPage(customerId: c.id)) }
        }
    }

    private func summaryLine(_ o: Order) -> String {
        var parts: [String] = [dateStr(o.createdAt)]
        if o.fromStore { parts.append(o.sourceLabel) }
        if o.paidOnline { parts.append("مدفوع أونلاين") }
        if let t = store.trip(o.tripId) {
            parts.append(t.name)
        } else if let t = o.trip {
            parts.append(t)
        }
        return parts.joined(separator: " · ")
    }

    private func summaryMoney(_ o: Order) -> some View {
        HStack(alignment: .bottom, spacing: 8) {
            VStack(alignment: .leading, spacing: 2) {
                Text("الإجمالي").font(TS.sub).foregroundStyle(GH.secondary)
                Text(omr(o.total)).font(TS.big).foregroundStyle(GH.label)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            VStack(alignment: .trailing, spacing: 2) {
                Text("المتبقي").font(TS.sub).foregroundStyle(GH.secondary)
                Text(omr(o.remaining))
                    .font(.gh(18, .semibold).monospacedDigit())
                    .foregroundStyle(o.hasBalance ? GH.red : GH.green)
            }
        }
    }

    // MARK: chips

    private func markSteps(_ o: Order) -> [ItemStatus] {
        let all: [ItemStatus] = [.purchased, .arrived, .outForDelivery, .delivered]
        return all.filter { s in o.activeItems.contains { $0.status.index < s.index } }
    }

    @ViewBuilder private func markAllBar(_ o: Order) -> some View {
        if o.activeItems.contains(where: { $0.status.index < ItemStatus.delivered.index }) {
            ChipBar {
                ForEach(markSteps(o), id: \.self) { s in
                    ChipButton("الكل: \(s.actionLabel)", icon: "checkmark",
                               action: enabled(!busy) { Task { await markAll(o, s) } })
                }
            }
            .padding(.top, 8)
        }
    }

    /// One-tap WhatsApp replies with the order ref.
    private func quickBar(_ o: Order) -> some View {
        ChipBar {
            ForEach(quickReplies.indices, id: \.self) { k in
                if !quickReplies[k].needsPayLink || o.hasBalance {
                    ChipButton(quickReplies[k].label,
                               icon: quickReplies[k].needsPayLink ? "creditcard" : "text.bubble",
                               action: enabled(!busy) { Task { await quickReply(o, quickReplies[k]) } })
                }
            }
        }
        .padding(.top, 8)
    }

    // MARK: items

    private func itemsSection(_ o: Order) -> some View {
        GHSection("القطع", trailing: {
            HeaderButton("إضافة", icon: "plus", action: { presentForm(ItemFormPage(orderId: o.id)) })
        }) {
            if o.items.isEmpty {
                Tile("ما في قطع")
            } else {
                ForEach(o.items) { i in itemRow(o, i) }
            }
        }
    }

    private func itemRow(_ o: Order, _ i: OrderItem) -> some View {
        ODItemRow(item: i, busy: busy,
                  onTap: { Task { await itemActions(o, i) } },
                  onAdvance: { s in Task { await advance(i, s) } },
                  onTaxFree: { toggleTaxFree(i) })
    }

    @ViewBuilder private func shippedSection(_ o: Order) -> some View {
        if o.items.contains(where: { $0.status == .purchased }) {
            GHSection(footer: "يطلع للعميل في صفحة التتبّع كخطوة «في الطريق لعُمان».") {
                if o.events.contains(where: { $0.type == "shipped" }) {
                    Tile("في الطريق لعُمان ✓", chevron: false,
                         leading: { IconBox("paperplane.fill", color: GH.teal) })
                } else {
                    Tile("شحنّا القطع لعُمان", subtitle: "اضغط لما تطلع القطع من البوتيك أو المدينة",
                         action: { Task { await shipItems(o) } },
                         leading: { IconBox("paperplane.fill", color: GH.teal) })
                }
            }
        }
    }

    // MARK: delivery

    private func deliverySection(_ o: Order) -> some View {
        GHSection("التوصيل", trailing: {
            HeaderButton("البوليصة", icon: "barcode", action: { Task { await printOrderWaybill(o) } })
        }) {
            Tile(deliveryTitle(o), subtitle: deliverySubtitle(o),
                 titleColor: deliveryNeedsDriver(o) ? GH.burgundy : nil,
                 action: { presentForm(DeliveryPage(order: o)) },
                 leading: { IconBox("car", color: o.driverStatus?.color ?? GH.tertiary) },
                 trailing: {
                     if let ds = o.driverStatus { Badge(ds.label, color: ds.color) }
                 })
        }
    }

    private func deliveryTitle(_ o: Order) -> String {
        if let m = o.deliveryMethod, m.isCourier {
            return "شحن مع \(m.carrierName)\(m.toBranch ? " · من الفرع" : " · للبيت")"
        }
        if let d = store.driver(o.driverId) { return d.name }
        return "\(o.deliveryMethod?.label ?? "التوصيل") · أسند لمندوب"
    }

    private func deliveryNeedsDriver(_ o: Order) -> Bool {
        o.driverId == nil && o.deliveryMethod?.isCourier != true
    }

    private func deliverySubtitle(_ o: Order) -> String? {
        if o.deliveryMethod?.isCourier == true {
            guard let t = o.carrierTracking else { return "أضف رابط التتبّع" }
            return o.carrierIsLink ? "رابط التتبّع محفوظ ✓" : "رقم الشحنة \(t)"
        }
        if o.driverId == nil { return nil }
        var parts: [String] = []
        if o.deliveryFee > 0 {
            parts.append(o.deliveryCollect ? "يحصّل التوصيل \(omr(o.deliveryFee))" : "التوصيل مدفوع")
        }
        if let a = o.deliveryAddress { parts.append(a) }
        return parts.joined(separator: " · ")
    }

    // MARK: history

    private func recentEvents(_ o: Order) -> [OrderEvent] {
        Array(o.events.reversed().prefix(12))
    }

    @ViewBuilder private func eventsSection(_ o: Order) -> some View {
        if !o.events.isEmpty {
            GHSection("سجل الطلب") {
                ForEach(Array(recentEvents(o).enumerated()), id: \.offset) { pair in
                    eventTile(pair.element)
                }
            }
        }
    }

    private func eventTile(_ e: OrderEvent) -> some View {
        Tile(e.label, subtitle: e.note, value: e.at.map { dateTimeStr($0) },
             valueColor: GH.secondary, valueFont: .gh(12.5), chevron: false,
             leading: { IconBox(e.icon, color: e.color, size: 28) })
    }

    // MARK: payments

    private func paymentsSection(_ o: Order) -> some View {
        GHSection("الدفعات", trailing: {
            HeaderButton("دفعة", icon: "plus", action: { presentForm(PaymentFormPage(order: o)) })
        }) {
            ForEach(o.payments) { p in paymentTile(p) }
            KV("مجموع القطع", omr(o.itemsTotal))
            KV("التوصيل", omr(o.deliveryFee))
            if o.tax > 0 { KV("الضريبة", omr(o.tax)) }
            if o.discount > 0 {
                KV(o.discountLabel ?? "خصم", "- \(omr(o.discount))", color: GH.green)
            }
            KV("الإجمالي", omr(o.total), strong: true)
            KV("المدفوع", omr(o.paid), color: GH.green)
            KV("المتبقي", omr(o.remaining), strong: true, color: o.hasBalance ? GH.red : GH.green)
        }
    }

    private func paymentTile(_ p: Payment) -> some View {
        let refund = p.amount < 0
        var parts: [String] = [dateStr(p.paidOn)]
        if let m = p.method { parts.append(m) }
        if let n = p.note { parts.append(n) }
        return Tile(refund ? "استرجاع \(omr(-p.amount))" : omr(p.amount),
                    subtitle: parts.joined(separator: " · "),
                    chevron: false,
                    action: { Task { await deletePayment(p) } },
                    leading: { IconBox(refund ? "arrow.uturn.left" : "dollarsign", color: refund ? GH.amber : GH.green) })
    }

    private func privateSection(_ o: Order) -> some View {
        GHSection("خاص بك (ما يطلع في الفاتورة)") {
            KV("حوّل لك العميل", omr(o.paid))
            KV("دفعت عن قطعه", omr(o.costOmr))
            KV("رصيده الحالي عندك", omr(o.customerBalance), strong: true,
               color: o.customerBalance < -0.0005 ? GH.red : GH.green)
            if o.costOmr > 0 {
                KV("ربحك التقديري", omr(o.itemProfit), color: GH.burgundy)
            }
            ForEach(o.taxFreePending.keys.sorted(), id: \.self) { k in
                KV("تاكس فري باقي تستلمه", money(o.taxFreePending[k] ?? 0, k), color: GH.amber)
            }
        }
    }

    // MARK: - Actions

    private func run(done: String? = nil, _ action: () async throws -> Void) async {
        busy = true
        do {
            try await action()
            if let done { toast(done) }
        } catch {
            toastError(error)
        }
        busy = false
    }

    private func advance(_ item: OrderItem, _ status: ItemStatus) async {
        if status == .purchased && item.costAmount == nil {
            presentForm(PurchasePage(item: item))
            return
        }
        await run(done: status.label) { try await Store.shared.setItemStatus(item, status) }
    }

    private func toggleTaxFree(_ i: OrderItem) {
        guard !busy else { return }
        Haptic.select()
        let msg = i.taxFreeReceived ? "رجّعته: ما استلمته" : "استلمت التاكس فري ✓"
        Task {
            await run(done: msg) { try await Store.shared.setTaxFreeReceived(i.id, !i.taxFreeReceived) }
        }
    }

    private func pickPhoto(_ item: OrderItem, _ kind: String) async {
        let source = await actionSheet(title: kind == "photo" ? "صورة القطعة" : "صورة الإيصال", actions: [
            SheetAction("الكاميرا", true),
            SheetAction("من الصور", false),
        ])
        guard let camera = source else { return }
        guard let img = await picker.pick(camera: camera) else { return }
        guard let bytes = OrderPhotoPicker.jpeg(img, maxSide: 1600, quality: 0.8) else { return }
        await run(done: "تم حفظ الصورة") {
            try await Store.shared.uploadItemPhoto(item, kind: kind, data: bytes)
        }
    }

    private func itemSheetActions(_ item: OrderItem) -> [SheetAction<String>] {
        var actions: [SheetAction<String>] = []
        if let next = item.status.next { actions.append(SheetAction(next.actionLabel, "next")) }
        if item.status == .requested {
            actions.append(SheetAction(item.hasPlan ? "تعديل الخطة (وين وبكم تقريباً)" : "وين بشتريها وبكم تقريباً", "plan"))
        }
        actions.append(SheetAction(item.costAmount == nil ? "تسجيل الشراء (السعر والمكان)" : "تعديل بيانات الشراء", "purchase"))
        if item.hasTaxFree {
            actions.append(SheetAction(item.taxFreeReceived ? "التاكس فري ما استلمته" : "استلمت التاكس فري", "taxfree"))
        }
        actions.append(SheetAction(item.photoPath == nil ? "إضافة صورة للقطعة" : "عرض صورة القطعة", "photo"))
        actions.append(SheetAction(item.receiptPath == nil ? "إضافة صورة الإيصال" : "عرض صورة الإيصال", "receipt"))
        actions.append(SheetAction("تعديل القطعة", "edit"))
        actions.append(SheetAction("تغيير الحالة…", "status"))
        actions.append(SheetAction("حذف القطعة", "delete", destructive: true))
        return actions
    }

    private func itemActions(_ o: Order, _ item: OrderItem) async {
        let picked = await actionSheet(title: item.title, message: item.status.label, actions: itemSheetActions(item))
        guard let a = picked else { return }
        switch a {
        case "next":
            if let next = item.status.next { await advance(item, next) }
        case "purchase":
            presentForm(PurchasePage(item: item))
        case "plan":
            presentForm(PlanPage(item: item))
        case "taxfree":
            await run { try await Store.shared.setTaxFreeReceived(item.id, !item.taxFreeReceived) }
        case "photo", "receipt":
            await photoActions(item, a)
        case "edit":
            presentForm(ItemFormPage(orderId: o.id, item: item))
        case "status":
            let choices: [SheetAction<ItemStatus>] = ItemStatus.allCases
                .filter { $0 != item.status }
                .map { SheetAction($0.label, $0, destructive: $0 == .cancelled) }
            if let s = await actionSheet(title: "الحالة", actions: choices) { await advance(item, s) }
        case "delete":
            if await confirm("حذف \(item.name)؟") {
                await run { try await Store.shared.deleteItem(item.id) }
            }
        default:
            break
        }
    }

    private func photoActions(_ item: OrderItem, _ kind: String) async {
        let current = kind == "photo" ? item.photoPath : item.receiptPath
        guard let path = current else {
            await pickPhoto(item, kind)
            return
        }
        let v = await actionSheet(actions: [
            SheetAction("عرض", "view"),
            SheetAction("تغيير", "change"),
            SheetAction("حذف الصورة", "remove", destructive: true),
        ])
        if v == "view" {
            pushPage(PhotoPage(path: path, title: kind == "photo" ? item.name : "الإيصال"))
        } else if v == "change" {
            await pickPhoto(item, kind)
        } else if v == "remove" {
            await run { try await Store.shared.removeItemPhoto(item, kind: kind) }
        }
    }

    private func markAll(_ o: Order, _ status: ItemStatus) async {
        let targets = o.activeItems.filter { $0.status.index < status.index }
        if targets.isEmpty { return }
        if status == .purchased {
            for i in targets {
                if i.costAmount != nil {
                    do {
                        try await Store.shared.setItemStatus(i, status)
                    } catch {
                        toastError(error)
                        return
                    }
                    continue
                }
                let ok: Bool? = await Nav.shared.presentForResult { done in PurchasePage(item: i, done: done) }
                if ok != true { break }
            }
            return
        }
        await run(done: "تم: \(status.label)") { try await Store.shared.setItemsStatus(targets, status) }
        let question: (String, String)?
        switch status {
        case .arrived: question = ("ترسل رسالة إن الطلب وصل؟", "وصل الطلب")
        case .outForDelivery: question = ("ترسل رسالة إن الطلب خرج للتوصيل؟", "خرج للتوصيل")
        default: question = nil
        }
        guard let ask = question else { return }
        let send = await confirm(ask.0, ok: "أرسل", destructive: false)
        if send {
            let updated = Store.shared.order(o.id) ?? o
            if let t = messageTemplates.first(where: { $0.title == ask.1 }) {
                presentForm(MessagePage(order: updated, template: t))
            }
        }
    }

    // MARK: order

    private func orderSheetActions(_ o: Order) -> [SheetAction<String>] {
        var actions: [SheetAction<String>] = [
            SheetAction("طباعة البوليصة", "waybill"),
            SheetAction("الرحلة", "trip"),
            SheetAction("رسوم التوصيل", "delivery"),
            SheetAction("ملاحظات الطلب", "notes"),
        ]
        if o.hasBalance { actions.append(SheetAction("إرسال رابط الدفع (أموال)", "paylink")) }
        if o.hasBalance { actions.append(SheetAction("نسخ رابط الدفع", "paylink-copy")) }
        if o.trackingToken != nil { actions.append(SheetAction("نسخ رابط التتبّع", "track")) }
        if !o.activeItems.isEmpty { actions.append(SheetAction("إرجاع قطع…", "return")) }
        actions.append(SheetAction("حذف الطلب", "delete", destructive: true))
        return actions
    }

    private func orderActions(_ o: Order) async {
        let picked = await actionSheet(title: o.invoiceNo, actions: orderSheetActions(o))
        guard let a = picked else { return }
        switch a {
        case "waybill":
            await printOrderWaybill(o)
        case "return":
            presentForm(ReturnPage(order: o))
        case "trip":
            if let id = await pickTripForOrder(current: o.tripId) {
                let value: Any = nn(id.isEmpty ? nil : id)
                await run { try await Store.shared.updateOrder(o.id, ["trip_id": value]) }
            }
        case "delivery":
            if let v = await askAmount("رسوم التوصيل", o.deliveryFee) {
                await run { try await Store.shared.updateOrder(o.id, ["delivery_fee": v]) }
            }
        case "notes":
            if let t = await promptText("ملاحظات الطلب", initial: o.notes ?? "", ok: "حفظ") {
                let trimmed = t.trimmingCharacters(in: .whitespacesAndNewlines)
                let value: Any = nn(trimmed.isEmpty ? nil : trimmed)
                await run { try await Store.shared.updateOrder(o.id, ["notes": value]) }
            }
        case "paylink", "paylink-copy":
            await payLink(o, copy: a == "paylink-copy")
        case "track":
            copyText(trackingLink(o), toastText: "نسخت رابط التتبّع")
        case "delete":
            await deleteOrder(o)
        default:
            break
        }
    }

    private func payLink(_ o: Order, copy: Bool) async {
        let url: String
        do {
            url = try await Store.shared.orderPayLink(o.id)
        } catch {
            toastError(error)
            return
        }
        if copy {
            copyText(url, toastText: "نسخت رابط الدفع")
        } else {
            presentForm(MessagePage(order: o, template: payLinkTemplate(url)))
        }
    }

    private func deleteOrder(_ o: Order) async {
        let ok = await confirm("حذف الطلب \(o.invoiceNo)؟", message: "بينحذف الطلب مع قطعه ودفعاته.")
        guard ok else { return }
        do {
            try await Store.shared.deleteOrder(o.id)
            dismiss()
        } catch {
            toastError(error)
        }
    }

    private func askAmount(_ title: String, _ current: Double) async -> Double? {
        let initial = current == 0 ? "" : plainOmr(current).replacingOccurrences(of: ",", with: "")
        guard let t = await promptText(title, placeholder: "ر.ع", initial: initial, ok: "حفظ", keyboard: .decimalPad) else {
            return nil
        }
        let v = parseAmount(t) ?? 0
        return v < 0 ? 0 : v
    }

    private func sharePdf(_ o: Order) async {
        let s = Store.shared
        await run { try await shareInvoice(o, customer: s.customer(o.customerId), biz: s.settings) }
    }

    private func pickMessage(_ o: Order) async {
        let list = messageTemplates.filter { o.trackingToken != nil || !$0.title.contains("تتبّع") }
        let actions: [SheetAction<MsgTemplate>] = list.map { SheetAction($0.title, $0) }
        if let t = await actionSheet(title: "رسالة واتساب", actions: actions) {
            presentForm(MessagePage(order: o, template: t))
        }
    }

    private func quickReply(_ o: Order, _ r: QuickReply) async {
        let c = Store.shared.customer(o.customerId)
        var url: String? = nil
        if r.needsPayLink {
            busy = true
            do {
                url = try await Store.shared.orderPayLink(o.id)
            } catch {
                busy = false
                toastError(error)
                return
            }
            busy = false
        }
        let text = r.build(o, c, url)
        let ok = await sendWhatsApp(phone: c?.phone, text: text)
        if !ok {
            copyText(text, toastText: "ما قدرت أفتح واتساب، نسخت الرسالة")
        }
    }

    private func shipItems(_ o: Order) async {
        let picked = await actionSheet(title: "من وين شحنتها؟", actions: [
            SheetAction("من أوروبا", "أوروبا"),
            SheetAction("من دبي", "دبي"),
            SheetAction("من مكان ثاني", ""),
        ])
        guard let from = picked else { return }
        do {
            try await Store.shared.markShipped(o.id, from: from.isEmpty ? nil : "من \(from)")
            toast("تم، والعميل يشوفها في التتبّع")
        } catch {
            toastError(error)
        }
    }

    private func deletePayment(_ p: Payment) async {
        if await confirm("حذف دفعة \(omr(p.amount))؟") {
            await run { try await Store.shared.deletePayment(p.id) }
        }
    }
}

// MARK: - Item row

fileprivate struct ODItemRow: View {
    let item: OrderItem
    let busy: Bool
    let onTap: () -> Void
    let onAdvance: (ItemStatus) -> Void
    let onTaxFree: () -> Void

    private var cancelled: Bool { item.status == .cancelled }

    var body: some View {
        Pressable(action: onTap, onLongPress: nil) {
            HStack(alignment: .top, spacing: 12) {
                if let p = item.photoPath { Thumb(path: p) }
                details.frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.leading, 16)
            .padding(.trailing, 12)
            .padding(.vertical, 12)
        }
    }

    private var details: some View {
        VStack(alignment: .leading, spacing: 0) {
            if let b = item.brand {
                Text(b.uppercased()).font(.gh(11.5, .semibold)).tracking(0.8).foregroundStyle(GH.gold)
            }
            nameRow
            if let d = item.details {
                Text(d).font(TS.sub).foregroundStyle(GH.secondary)
            }
            if let t = listText {
                Text(t).font(TS.small).foregroundStyle(GH.blue).padding(.top, 2)
            }
            if let t = planText {
                Text(t).font(TS.small).foregroundStyle(GH.burgundy).padding(.top, 2)
            }
            if let t = costText {
                Text(t).font(TS.small).foregroundStyle(GH.secondary).padding(.top, 2)
            }
            if item.hasTaxFree {
                ODTaxFreeChip(amount: money(item.taxFreeAmount, item.costCurrency ?? ""),
                              received: item.taxFreeReceived,
                              onTap: busy ? nil : onTaxFree)
                    .padding(.top, 6)
            }
            statusRow.padding(.top, 8)
        }
    }

    private var nameRow: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text(item.name)
                .strikethrough(cancelled)
                .font(TS.title)
                .foregroundStyle(cancelled ? GH.tertiary : GH.label)
                .frame(maxWidth: .infinity, alignment: .leading)
            Text(omr(item.price)).font(TS.money).foregroundStyle(GH.label)
        }
    }

    private var listText: String? {
        guard let lp = item.listPrice, let lc = item.listCurrency else { return nil }
        var s = "السعر \(money(lp, lc))"
        let pct = item.commissionPct ?? 0
        if pct > 0 {
            let whole = pct.truncatingRemainder(dividingBy: 1) == 0
            s += " + عمولة \(String(format: whole ? "%.0f" : "%.1f", pct))٪"
        }
        return s
    }

    private var planText: String? {
        guard item.costAmount == nil && item.hasPlan else { return nil }
        var parts: [String] = ["الخطة"]
        if let s = item.planStore { parts.append(s) }
        if let p = item.planPlace { parts.append(p.label) }
        if let c = item.estCost, let cur = item.estCurrency { parts.append("تقريباً \(money(c, cur))") }
        return parts.joined(separator: " · ")
    }

    private var costText: String? {
        guard let cost = item.costAmount else { return nil }
        var parts: [String] = ["شراء \(money(cost, item.costCurrency ?? ""))"]
        if let c = item.costOmr { parts.append("≈ \(omr(c))") }
        if let p = item.purchasePlace { parts.append(p.label) }
        return parts.joined(separator: " · ")
    }

    private var statusRow: some View {
        HStack(spacing: 0) {
            Badge(item.status.label, color: item.status.color)
            if !cancelled {
                StepDots(item.status.index).padding(.leading, 10)
            }
            if item.receiptPath != nil {
                Image(systemName: "doc.text.viewfinder")
                    .font(.system(size: 16))
                    .foregroundStyle(GH.secondary)
                    .padding(.leading, 8)
            }
            Spacer(minLength: 8)
            if let n = item.status.next {
                nextButton(n)
            }
        }
    }

    private func nextButton(_ n: ItemStatus) -> some View {
        Button {
            onAdvance(n)
        } label: {
            Text(n.actionLabel)
                .font(.gh(13.5, .semibold))
                .foregroundStyle(GH.burgundy)
                .padding(.horizontal, 10)
                .frame(minHeight: 30)
                .background(RoundedRectangle(cornerRadius: 8, style: .continuous).fill(GH.panel))
        }
        .buttonStyle(.plain)
        .disabled(busy)
        .opacity(busy ? 0.5 : 1)
    }
}

/// One tap marks the item's tax-free refund as received (tap again to undo).
fileprivate struct ODTaxFreeChip: View {
    let amount: String
    let received: Bool
    let onTap: (() -> Void)?

    var body: some View {
        let color = received ? GH.green : GH.amber
        Button {
            onTap?()
        } label: {
            HStack(spacing: 7) {
                Image(systemName: received ? "checkmark.circle.fill" : "circle")
                    .font(.system(size: 18))
                    .foregroundStyle(color)
                Text(received ? "تاكس فري \(amount) · استلمته" : "تاكس فري \(amount) · اضغط إذا استلمته")
                    .font(.gh(12, .semibold))
                    .foregroundStyle(color)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
            .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(color.opacity(0.12)))
            .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).stroke(color.opacity(0.45), lineWidth: 1))
            .frame(minHeight: 36)
        }
        .buttonStyle(.plain)
        .disabled(onTap == nil)
    }
}
