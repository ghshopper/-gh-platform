import SwiftUI

// Customers' "find me this piece" requests (app and website). A found piece
// becomes a real order for the customer with one form.

/// Same list as the order form's payment methods.
fileprivate let requestPaymentMethods = ["تحويل بنكي", "نقداً", "رابط دفع", "أخرى"]

struct RequestsPage: View {
    @ObservedObject private var store = Store.shared

    init() {}

    var body: some View {
        let all = store.requests
        let open = all.filter { $0.isOpen }
        let done = all.filter { !$0.isOpen }
        return GHPage("طلبات القطع", onRefresh: { await Store.shared.refresh() }) {
            if all.isEmpty {
                EmptyState(icon: "sparkles", title: "ما في طلبات",
                           message: "لما عميل يطلب قطعة من التطبيق أو الموقع تطلع هنا.")
            }
            if !open.isEmpty {
                GHSection("تنتظرك · \(open.count)") {
                    ForEach(open) { r in RequestTile(r) }
                }
            }
            if !done.isEmpty {
                GHSection("آخر ٣٠ يوم") {
                    ForEach(done) { r in RequestTile(r) }
                }
            }
        }
    }
}

struct RequestTile: View {
    let r: PieceRequest

    init(_ r: PieceRequest) { self.r = r }

    var body: some View {
        let id = r.id
        return Tile(r.name,
                    subtitle: [r.customerName, dateStr(r.createdAt)].joined(separator: " · "),
                    action: { pushPage(RequestDetailPage(id: id)) },
                    leading: { RequestPhoto(url: r.imageUrl, size: 44) },
                    trailing: { Badge(r.statusLabel, color: r.statusColor) })
    }
}

fileprivate struct RequestPhoto: View {
    let url: String?
    let size: CGFloat

    init(url: String?, size: CGFloat = 44) {
        self.url = url
        self.size = size
    }

    private var placeholder: some View {
        Image(systemName: "photo")
            .font(.system(size: size * 0.45))
            .foregroundStyle(GH.gold)
    }

    var body: some View {
        ZStack {
            GH.sand
            if let url, let u = URL(string: url) {
                AsyncImage(url: u) { phase in
                    switch phase {
                    case .success(let img): img.resizable().scaledToFill()
                    case .failure: placeholder
                    default: EmptyView()
                    }
                }
            } else {
                placeholder
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: size * 0.2, style: .continuous))
    }
}

// ───────────────────────── Detail ─────────────────────────

struct RequestDetailPage: View {
    let id: String
    @ObservedObject private var store = Store.shared

    init(id: String) { self.id = id }

    var body: some View {
        if let r = store.requests.last(where: { $0.id == id }) {
            page(r)
        } else {
            GHPage("الطلب") {
                EmptyState(icon: "doc.text", title: "الطلب غير موجود")
            }
        }
    }

    @ViewBuilder
    private func page(_ req: PieceRequest) -> some View {
        if req.status == "ordered", let orderId = req.orderId {
            GHPage("طلب قطعة", bottom: {
                PrimaryButton("فتح الطلب", icon: "doc.text") { pushPage(OrderDetailPage(orderId: orderId)) }
            }) {
                RequestDetailContent(req: req)
            }
        } else if req.isOpen {
            GHPage("طلب قطعة", bottom: {
                PrimaryButton("تحويل لطلب للعميل", icon: "arrow.left.arrow.right") { convert(req) }
            }) {
                RequestDetailContent(req: req)
            }
        } else {
            GHPage("طلب قطعة") {
                RequestDetailContent(req: req)
            }
        }
    }

    private func convert(_ r: PieceRequest) {
        Task {
            let res: (orderId: String, payUrl: String)? = await Nav.shared.presentForResult { d in
                ConvertRequestPage(request: r, done: d)
            }
            guard let res else { return }
            pushPage(OrderDetailPage(orderId: res.orderId))
            if let o = Store.shared.order(res.orderId) {
                let send = await confirm("تم إنشاء الطلب \(o.invoiceNo)", message: "ترسل للعميل رابط الدفع على واتساب؟")
                if send {
                    presentForm(MessagePage(order: o, template: payLinkTemplate(res.payUrl)))
                }
            }
        }
    }
}

fileprivate struct RequestDetailContent: View {
    let req: PieceRequest

    init(req: PieceRequest) { self.req = req }

    private var subtitle: String {
        var parts: [String] = []
        if let b = req.brand { parts.append(b) }
        if let c = req.category { parts.append(c) }
        return parts.joined(separator: " · ")
    }

    var body: some View {
        Group {
            if let img = req.imageUrl {
                Pad(top: 8) { bigPhoto(img) }
            }
            pieceSection
            customerSection
            if req.isOpen {
                statusSection
            }
            Pad(h: 32, top: 10) {
                Text("وصل \(dateStr(req.createdAt))").font(TS.small).foregroundStyle(GH.secondary)
            }
        }
    }

    private func bigPhoto(_ url: String) -> some View {
        Color.clear
            .aspectRatio(1, contentMode: .fit)
            .overlay {
                ZStack {
                    GH.sand
                    if let u = URL(string: url) {
                        AsyncImage(url: u) { phase in
                            switch phase {
                            case .success(let img): img.resizable().scaledToFill()
                            default: EmptyView()
                            }
                        }
                    }
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    private var pieceSection: some View {
        GHSection {
            Tile(req.name, subtitle: subtitle, chevron: false,
                 trailing: { Badge(req.statusLabel, color: req.statusColor) })
            if let d = req.description {
                Text(d).font(TS.body).foregroundStyle(GH.label)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 16).padding(.top, 4).padding(.bottom, 12)
            }
            if let link = req.url {
                Tile("رابط القطعة", subtitle: link, action: { openURL(link) },
                     leading: { IconBox("link", color: GH.blue) })
            }
        }
    }

    private var customerSection: some View {
        let phone = waPhone(req.customerPhone)
        return GHSection("العميل") {
            Tile(req.customerName, subtitle: req.customerPhone, chevron: false,
                 leading: { Avatar(req.customerName, size: 32) })
            if let phone {
                Tile("واتساب", action: { openURL("https://wa.me/\(phone)") },
                     leading: { IconBox("bubble.left.fill", color: Color(hex: 0xFF25D366)) })
            }
        }
    }

    private var statusSection: some View {
        let r = req
        return GHSection("الحالة") {
            if r.status == "pending" {
                Tile("أبحث عنها", action: { setStatus(r, "reviewing") },
                     leading: { IconBox("magnifyingglass", color: GH.amber) })
            }
            Tile("غير متوفرة", action: { setStatus(r, "not_found") },
                 leading: { IconBox("xmark", color: GH.red) })
        }
    }

    private func setStatus(_ r: PieceRequest, _ s: String) {
        Task {
            await attempt { try await Store.shared.setRequestStatus(r.id, s) }
        }
    }
}

// ───────────────────────── Convert ─────────────────────────

/// Price and delivery for the found piece; creates the customer's order.
/// Gives back the new order's id and its payment link.
struct ConvertRequestPage: View {
    let request: PieceRequest
    var done: (((orderId: String, payUrl: String)?) -> Void)?
    @Environment(\.dismiss) private var dismiss

    @State private var brand: String
    @State private var name: String
    @State private var details = ""
    @State private var price = ""
    @State private var delivery = ""
    @State private var deposit = ""
    @State private var method: DeliveryMethod = .home
    @State private var depositMethod: String = requestPaymentMethods[0]
    @State private var notify = true
    @State private var saving = false
    @State private var didInit = false

    init(request: PieceRequest, done: (((orderId: String, payUrl: String)?) -> Void)? = nil) {
        self.request = request
        self.done = done
        _brand = State(initialValue: request.brand ?? "")
        _name = State(initialValue: request.name)
    }

    private func feeText(_ m: DeliveryMethod) -> String {
        plainOmr(Store.shared.settings.feeFor(m)).replacingOccurrences(of: ",", with: "")
    }

    private func close(_ res: (orderId: String, payUrl: String)?) {
        if let done { done(res) } else { dismiss() }
    }

    private func optional(_ s: String) -> String? {
        let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
        return t.isEmpty ? nil : t
    }

    private func save() {
        let p = parseAmount(price) ?? 0
        let n = name.trimmingCharacters(in: .whitespacesAndNewlines)
        if n.isEmpty || p <= 0 {
            toast("اكتب اسم القطعة وسعرها", error: true)
            return
        }
        saving = true
        let data: JSON = [
            "brand": nn(optional(brand)),
            "name": n,
            "details": nn(optional(details)),
            "price": p,
            "delivery_fee": parseAmount(delivery) ?? 0,
            "delivery_method": method.key,
            "deposit": parseAmount(deposit) ?? 0,
            "deposit_method": depositMethod,
            "notify": notify,
        ]
        let rid = request.id
        Task {
            do {
                let res = try await Store.shared.convertRequest(rid, data)
                close(res)
            } catch {
                saving = false
                toastError(error)
            }
        }
    }

    var body: some View {
        GHPage("تحويل لطلب", trailing: {
            if saving {
                ProgressView()
            } else {
                NavButton("إنشاء", bold: true) { save() }
            }
        }, leading: {
            NavButton("إلغاء") { close(nil) }
        }) {
            pieceSection
            deliverySection
            notifySection
            totalsSection
        }
        .onAppear {
            if !didInit {
                didInit = true
                delivery = feeText(method)
            }
        }
    }

    private var pieceSection: some View {
        GHSection("القطعة · لـ \(request.customerName)") {
            FieldRow("البراند", text: $brand, placeholder: "Chanel")
            FieldRow("القطعة", text: $name)
            FieldRow("التفاصيل", text: $details, placeholder: "المقاس، اللون…")
            AmountRow("السعر للعميل", text: $price)
        }
    }

    private var deliverySection: some View {
        GHSection("التوصيل والعربون") {
            DeliveryPicker(value: method, onChanged: { m in
                method = m
                delivery = feeText(m)
            })
            AmountRow("رسوم التوصيل", text: $delivery)
            AmountRow("العربون المستلم", text: $deposit)
            PickerRow("طريقة العربون", value: depositMethod) { pickDepositMethod() }
        }
    }

    private var notifySection: some View {
        GHSection(footer: "الطلب يدخل الطلبات هنا، ويطلع للعميل في «طلباتي» في التطبيق والموقع مع زر الدفع.") {
            SwitchRow("إشعار للعميل في التطبيق", isOn: $notify)
        }
    }

    private var totalsSection: some View {
        let p = parseAmount(price) ?? 0
        let d = parseAmount(delivery) ?? 0
        return GHSection {
            KV("القطعة", omr(p))
            KV("التوصيل", omr(d))
            KV("الإجمالي", omr(p + d), strong: true, color: GH.burgundy)
        }
    }

    private func pickDepositMethod() {
        Task {
            let actions = requestPaymentMethods.map { SheetAction($0, $0) }
            if let m = await pickAction(title: "طريقة الدفع", actions: actions) {
                depositMethod = m
            }
        }
    }
}
