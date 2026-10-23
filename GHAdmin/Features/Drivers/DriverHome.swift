import SwiftUI
import UIKit
import PhotosUI

// Port of lib/pages/driver_home.dart

/// Loads the signed-in driver's orders (only theirs, without prices).
@MainActor
final class DriverData: ObservableObject {
    static let shared = DriverData()
    private init() {}

    @Published var orders: [DriverOrder] = []
    @Published var account: DriverAccount?
    @Published var ready = false
    @Published var error: Error?

    func refresh() async {
        // money and past deliveries (newer server); the list works without it
        Task {
            let raw = try? await Api.shared.get("/ps/driver/account")
            if let m = raw as? JSON {
                self.account = DriverAccount(m)
            }
        }
        do {
            let res = try await Api.shared.get("/ps/driver/orders")
            let m = res as? JSON
            orders = jlist(m?["orders"]).map { DriverOrder($0) }
            self.error = nil
        } catch {
            self.error = error
        }
        ready = true
    }

    func setStatus(_ o: DriverOrder, _ s: DriverStatus, photo: Data? = nil) async throws {
        if let photo {
            try await Api.shared.upload("/ps/driver/orders/\(o.id)", field: "photo", data: photo,
                                        fields: ["status": s.rawValue])
        } else {
            try await Api.shared.post("/ps/driver/orders/\(o.id)", ["status": s.rawValue])
        }
        await refresh()
    }

    func clear() {
        orders = []
        account = nil
        ready = false
    }
}

/// Like Dart's Uri.encodeComponent.
fileprivate func driverHomeEncode(_ s: String) -> String {
    var allowed = CharacterSet()
    allowed.insert(charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_.!~*'()")
    return s.addingPercentEncoding(withAllowedCharacters: allowed) ?? s
}

fileprivate let driverWhatsAppGreen = Color(hex: 0xFF25D366)

fileprivate func stripLinks(_ s: String) -> String {
    s.replacingOccurrences(of: "https?://\\S+", with: "", options: .regularExpression)
        .trimmingCharacters(in: .whitespacesAndNewlines)
}

// MARK: - Home

struct DriverHome: View {
    let name: String
    @State private var tab: Int // 0 now · 1 previous · 2 my money
    @ObservedObject private var data = DriverData.shared

    init(name: String, initialTab: Int = 0) {
        self.name = name
        _tab = State(initialValue: initialTab)
    }

    private var openOrders: [DriverOrder] { data.orders.filter { !$0.isDone } }
    private var doneOrders: [DriverOrder] { data.orders.filter { $0.isDone } }
    private var collectTotal: Double { openOrders.reduce(0.0) { $0 + $1.toCollect } }

    var body: some View {
        GHPage("توصيلاتي",
               onRefresh: { await DriverData.shared.refresh() },
               trailing: { NavButton("خروج") { Task { await logout() } } },
               bottom: {
                   PrimaryButton("امسح بوليصة واستلم الطلب", icon: "qrcode.viewfinder") { Task { await scan() } }
               }) {
            header
            stats
            accountBanner
            tabs
            tabContent
        }
        .task {
            if !DriverData.shared.ready { await DriverData.shared.refresh() }
        }
    }

    // MARK: top

    private var greeting: String {
        let h = Calendar.current.component(.hour, from: Date())
        if h < 12 { return "صباح الخير" }
        if h < 18 { return "مساء الخير" }
        return "مساء النور"
    }

    private var header: some View {
        HStack(spacing: 8) {
            VStack(alignment: .leading, spacing: 0) {
                Text("\(greeting) \(name)").font(.gh(18, .semibold)).foregroundStyle(GH.label)
                Text(dateStr(Date())).font(TS.sub).foregroundStyle(GH.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            logo
        }
        .padding(.horizontal, 20)
        .padding(.bottom, 2)
    }

    @ViewBuilder
    private var logo: some View {
        if let img = GHImage.named("story_logo") {
            Image(uiImage: img).resizable().scaledToFit().frame(height: 44)
        }
    }

    private var stats: some View {
        HStack(spacing: 10) {
            StatCard(label: "للتوصيل الحين", value: "\(openOrders.count)", icon: "car.fill", hero: true)
            StatCard(label: "تحصّل اليوم", value: omr(collectTotal), icon: "dollarsign.circle.fill", color: GH.amber)
        }
        .padding(.horizontal, 16)
        .padding(.top, 12)
    }

    @ViewBuilder
    private var accountBanner: some View {
        if let acc = data.account {
            Button { tab = 2 } label: {
                AccountBannerRow(net: acc.net)
            }
            .buttonStyle(.plain)
            .padding(.horizontal, 16)
            .padding(.top, 10)
        }
    }

    private var tabs: some View {
        Segments(value: $tab, options: [(0, "الحالية (\(openOrders.count))"), (1, "السابقة"), (2, "حسابي")])
            .padding(.horizontal, 6)
            .padding(.top, 6)
    }

    // MARK: tabs

    @ViewBuilder
    private var tabContent: some View {
        if !data.ready {
            LoadingView()
        } else if let err = data.error, data.orders.isEmpty, tab == 0 {
            EmptyState(icon: "wifi.exclamationmark", title: "ما قدرنا نحمّل الطلبات", message: errorText(err))
        } else if tab == 0 {
            nowTab
        } else if tab == 1 {
            pastTab
        } else {
            moneyTab
        }
    }

    @ViewBuilder
    private var nowTab: some View {
        let open = openOrders
        if open.isEmpty {
            EmptyState(icon: "shippingbox",
                       title: "ما عندك توصيلات الحين",
                       message: "امسح بوليصة الطلب عشان تستلمه، أو اسحب لتحت عشان تحدّث.")
        } else {
            ForEach(open) { o in
                DriverDeliveryCard(o: o)
            }
        }
    }

    @ViewBuilder
    private var pastTab: some View {
        let acc = data.account
        let past = acc?.recent ?? []
        let done = doneOrders
        if acc == nil && !done.isEmpty {
            // older server: the deliveries of the last 30 days
            GHSection("المسلّمة · \(done.count)") {
                ForEach(done) { o in
                    doneTile(o)
                }
            }
        } else if past.isEmpty {
            EmptyState(icon: "checkmark.seal", title: "ما سلّمت شي للحين")
        } else {
            GHSection("سلّمتها · \(acc?.deliveries ?? 0)") {
                ForEach(Array(past.enumerated()), id: \.offset) { _, d in
                    pastTile(d)
                }
            }
        }
    }

    private func doneTile(_ o: DriverOrder) -> some View {
        let id = o.id
        let sub = [dateStr(o.deliveredAt), o.customerCity ?? o.invoiceNo].joined(separator: " · ")
        return Tile(o.customerName,
                    subtitle: sub,
                    action: { pushPage(DriverOrderPage(orderId: id)) },
                    leading: { Avatar(o.customerName, size: 34) })
    }

    private func pastTile(_ d: PastDelivery) -> some View {
        let id = d.id
        let known = data.orders.contains { $0.id == id }
        let tap: (() -> Void)? = known ? { pushPage(DriverOrderPage(orderId: id)) } : nil
        return PastDeliveryTile(d, onTap: tap)
    }

    @ViewBuilder
    private var moneyTab: some View {
        if let acc = data.account {
            DriverBalanceCard(acc)
            GHSection("هالشهر") {
                KV("توصيلاتك", "\(acc.monthDeliveries)")
                KV("أجرتك", omr(acc.monthEarned))
                if acc.rate > 0 { KV("لكل توصيلة", omr(acc.rate)) }
            }
            GHSection("من البداية") {
                KV("حصّلت من العملاء", omr(acc.collected))
                KV("سلّمت لنا", omr(acc.handed))
                KV("أجرتك كلها", omr(acc.earned))
                KV("حوّلنا لك", omr(acc.paid))
            }
            entriesSection(acc)
        } else {
            EmptyState(icon: "dollarsign.circle", title: "الحساب يتحمّل…")
        }
    }

    @ViewBuilder
    private func entriesSection(_ acc: DriverAccount) -> some View {
        let list = acc.entries
        if !list.isEmpty {
            GHSection("التسليم والتحويلات") {
                ForEach(Array(list.enumerated()), id: \.offset) { _, e in
                    DriverEntryTile(e)
                }
            }
        }
    }

    // MARK: actions

    /// Pick-up: scanning the label hands the parcel to this driver.
    private func scan() async {
        guard let code = await scanCode() else { return }
        do {
            let res = try await Api.shared.post("/ps/driver/scan", ["code": code])
            await DriverData.shared.refresh()
            let m = res as? JSON ?? [:]
            let id = jstr(m["id"])
            toast(js(m["status"]) == "delivered" ? "الطلب متسلّم من قبل" : "استلمت الطلب ✓")
            pushPage(DriverOrderPage(orderId: id))
        } catch {
            toastError(error)
        }
    }

    private func logout() async {
        let ok = await confirm("تسجيل خروج؟", ok: "خروج", destructive: true)
        if ok {
            DriverData.shared.clear()
            Api.shared.logout()
        }
    }
}

fileprivate struct AccountBannerRow: View {
    let net: Double

    private var text: String {
        if abs(net) < 0.0005 { return "حسابك معنا صافي ✓" }
        if net > 0 { return "عندك لنا \(omr(net))" }
        return "لك عندنا \(omr(-net))"
    }

    var body: some View {
        HStack(spacing: 0) {
            IconBox(net >= 0 ? "arrow.up.circle.fill" : "arrow.down.circle.fill",
                    color: net >= 0 ? GH.amber : GH.green)
            Text(text)
                .font(.gh(15, .semibold))
                .foregroundStyle(GH.label)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.leading, 10)
            Text("حسابي").font(.gh(14)).foregroundStyle(GH.burgundy)
            Image(systemName: "chevron.forward")
                .font(.system(size: 16))
                .foregroundStyle(GH.tertiary)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(GH.card))
        .ghShadow()
        .contentShape(Rectangle())
    }
}

/// One delivery waiting: customer, where, what to collect, step.
fileprivate struct DriverDeliveryCard: View {
    let o: DriverOrder

    private var picked: Bool { o.status == .picked }
    private var hasCollect: Bool { o.toCollect > 0 }

    private var subLine: String {
        [o.customerCity ?? "", "\(o.items.count) قطعة", o.waybillNo ?? o.invoiceNo]
            .filter { !$0.isEmpty }
            .joined(separator: " · ")
    }

    var body: some View {
        let id = o.id
        Button { pushPage(DriverOrderPage(orderId: id)) } label: {
            card
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 16)
        .padding(.top, 12)
    }

    private var card: some View {
        VStack(alignment: .leading, spacing: 0) {
            topRow
            addressRow
            collectPill.padding(.top, 10)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(GH.card))
        .ghShadow()
        .contentShape(Rectangle())
    }

    private var topRow: some View {
        HStack(spacing: 10) {
            Avatar(o.customerName, size: 40)
            VStack(alignment: .leading, spacing: 0) {
                Text(o.customerName).font(TS.title).foregroundStyle(GH.label)
                Text(subLine).font(TS.sub).foregroundStyle(GH.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Badge(picked ? "معك" : "جديد", color: picked ? GH.amber : GH.blue)
        }
    }

    @ViewBuilder
    private var addressRow: some View {
        if let a = o.address {
            HStack(alignment: .top, spacing: 6) {
                Image(systemName: "location.fill").font(.system(size: 15)).foregroundStyle(GH.secondary)
                Text(stripLinks(a))
                    .font(TS.sub)
                    .foregroundStyle(GH.secondary)
                    .lineLimit(2)
                    .truncationMode(.tail)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.top, 10)
        }
    }

    private var collectPill: some View {
        let tint = hasCollect ? GH.amber : GH.green
        let textColor = hasCollect ? Color(hex: 0xFFB36200) : GH.green
        return HStack(spacing: 8) {
            Image(systemName: hasCollect ? "dollarsign.circle.fill" : "checkmark.seal.fill")
                .font(.system(size: 18))
                .foregroundStyle(tint)
            Text(hasCollect ? "حصّل \(omr(o.toCollect))" : "مدفوع، لا تحصّل شي")
                .font(.gh(14, .semibold))
                .foregroundStyle(textColor)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 8)
        .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(tint.opacity(24.0 / 255.0)))
    }
}

// MARK: - One delivery

struct DriverOrderPage: View {
    let orderId: String
    @ObservedObject private var data = DriverData.shared
    @Environment(\.dismiss) private var dismiss
    @State private var busy = false

    init(orderId: String) { self.orderId = orderId }

    private var order: DriverOrder? { data.orders.last { $0.id == orderId } }

    var body: some View {
        if let o = order {
            if o.isDone {
                GHPage(o.customerName) { content(o) }
            } else {
                GHPage(o.customerName, bottom: { bottomButton(o) }) { content(o) }
            }
        } else {
            GHPage("الطلب") {
                EmptyState(icon: "shippingbox", title: "الطلب مب موجود")
            }
        }
    }

    @ViewBuilder
    private func bottomButton(_ o: DriverOrder) -> some View {
        if o.status == .picked {
            PrimaryButton("تم التسليم", icon: "camera.fill", busy: busy) { Task { await delivered(o) } }
        } else {
            PrimaryButton("استلمت الطلب، طالع أوصله", icon: "car.fill", busy: busy) { Task { await picked(o) } }
        }
    }

    @ViewBuilder
    private func content(_ o: DriverOrder) -> some View {
        topLine(o)
        collectBanner(o)
        contactSection(o)
        noteSection(o)
        itemsSection(o)
        photoSection(o)
    }

    private func topLine(_ o: DriverOrder) -> some View {
        HStack {
            Text(o.waybillNo ?? o.invoiceNo).font(TS.sub).foregroundStyle(GH.secondary)
            Spacer()
            if let s = o.status { Badge(s.label, color: s.color) }
        }
        .padding(.horizontal, 20)
    }

    private func collectBanner(_ o: DriverOrder) -> some View {
        let collect = o.toCollect > 0
        let colors: [Color] = collect
            ? [Color(hex: 0xFFF08C00), Color(hex: 0xFFD9480F)]
            : [Color(hex: 0xFF1FA35B), Color(hex: 0xFF13795B)]
        let text = collect
            ? "حصّل \(omr(o.toCollect)) عند التسليم\(o.isCod ? " (قيمة الطلب)" : "")"
            : "التوصيل مدفوع، لا تحصّل شي"
        return HStack(spacing: 12) {
            Image(systemName: collect ? "dollarsign.circle.fill" : "checkmark.seal.fill")
                .font(.system(size: 30))
                .foregroundStyle(Color.white)
            Text(text)
                .font(.gh(17, .bold))
                .foregroundStyle(Color.white)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(LinearGradient(colors: colors, startPoint: .leading, endPoint: .trailing)))
        .padding(.horizontal, 16)
        .padding(.top, 12)
    }

    private func contactSection(_ o: DriverOrder) -> some View {
        let phone = waPhone(o.customerPhone)
        return GHSection {
            if let phone {
                Tile("اتصال",
                     value: o.customerPhone,
                     action: { openURL("tel:+\(phone)") },
                     leading: { IconBox("phone.fill", color: GH.green) })
            }
            if let phone {
                Tile("رسائل جاهزة للعميل",
                     subtitle: "في الطريق، وصلت، ما رديت…",
                     action: { Task { await sendTemplate(o, phone: phone) } },
                     leading: { IconBox("text.bubble.fill", color: driverWhatsAppGreen) })
            }
            if let phone {
                Tile("واتساب",
                     action: { openURL("https://wa.me/\(phone)") },
                     leading: { IconBox("bubble.left.fill", color: driverWhatsAppGreen) })
            }
            addressTile(o)
        }
    }

    private func addressTile(_ o: DriverOrder) -> some View {
        let target: String? = o.address ?? o.customerCity
        var action: (() -> Void)? = nil
        if let target { action = { openMaps(target) } }
        return Tile(o.address ?? o.customerCity ?? "ما في عنوان",
                    subtitle: o.address != nil ? o.customerCity : nil,
                    action: action,
                    leading: { IconBox("location.fill", color: GH.blue) })
    }

    @ViewBuilder
    private func noteSection(_ o: DriverOrder) -> some View {
        if let note = o.note {
            GHSection("ملاحظة") {
                Text(note)
                    .font(TS.body)
                    .foregroundStyle(GH.label)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(16)
            }
        }
    }

    private func itemsSection(_ o: DriverOrder) -> some View {
        GHSection("القطع · \(o.items.count)") {
            ForEach(Array(o.items.enumerated()), id: \.offset) { _, i in
                Tile(i.brand == nil ? i.name : "\(i.brand ?? "") · \(i.name)",
                     subtitle: i.details,
                     chevron: false,
                     leading: { IconBox("bag.fill", color: GH.gold) })
            }
        }
    }

    @ViewBuilder
    private func photoSection(_ o: DriverOrder) -> some View {
        if let url = o.photoUrl {
            GHSection("صورة التسليم") {
                DeliveryPhotoView(url: url)
                Tile("تم التسليم", value: dateStr(o.deliveredAt), chevron: false)
            }
        }
    }

    // MARK: actions

    private func picked(_ o: DriverOrder) async {
        busy = true
        do {
            try await DriverData.shared.setStatus(o, .picked)
            toast("بالتوفيق 🚗")
        } catch {
            toastError(error)
        }
        busy = false
    }

    private func delivered(_ o: DriverOrder) async {
        let actions: [SheetAction<Bool>] = [
            SheetAction("الكاميرا", true),
            SheetAction("من الصور", false),
        ]
        guard let camera = await pickAction(title: "صورة التسليم",
                                             message: "صوّر الطلب مع الزبون أو عند الباب",
                                             actions: actions) else { return }
        guard let image = await DeliveryPhotoGrabber.pick(camera: camera) else { return }
        if o.toCollect > 0 {
            let ok = await confirm("حصّلت \(omr(o.toCollect))؟", message: "رسوم التوصيل من الزبون.",
                                   ok: "إي حصّلتها", destructive: false)
            if !ok { return }
        }
        busy = true
        guard let bytes = deliveryJpeg(image) else {
            busy = false
            return
        }
        do {
            try await DriverData.shared.setStatus(o, .delivered, photo: bytes)
            toast("تم التسليم ✓")
            dismiss()
        } catch {
            busy = false
            toastError(error)
        }
    }

    /// Ready-made WhatsApp messages from the driver to the customer.
    private func sendTemplate(_ o: DriverOrder, phone: String) async {
        let male = o.customerIsMale
        func g(_ f: String, _ m: String) -> String { male ? m : f }
        let trimmed = o.customerName.trimmingCharacters(in: .whitespaces)
        let first = String(trimmed.split(separator: " ", omittingEmptySubsequences: false).first ?? "")
        let me = Api.shared.session?.name ?? "المندوب"
        let pay = o.toCollect > 0 ? "\nالمبلغ \(omr(o.toCollect)) يندفع عند الاستلام." : ""
        let templates: [(String, String)] = [
            ("أنا في الطريق 🚗",
             "هلا \(first) 👋\nمعك \(me) مندوب GH Shopper.\n\(g("طلبكِ", "طلبك")) في الطريق \(g("إليكِ", "إليك"))، بوصل خلال حوالي ٢٠ دقيقة إن شاء الله.\(pay)"),
            ("وصلت عند الموقع 📍",
             "هلا \(first)، وصلت عند موقع\(g("كِ", "ك")) 📍\nأنا تحت مع \(g("طلبكِ", "طلبك")) من GH Shopper.\(pay)"),
            ("ما رد على الاتصال 📞",
             "هلا \(first)، حاولت أتصل \(g("فيكِ", "فيك")) بخصوص توصيل \(g("طلبكِ", "طلبك")) من GH Shopper.\nمتى يناسب\(g("كِ", "ك")) أوصله؟"),
            ("أبي الموقع على الخريطة 🗺️",
             "هلا \(first)، معك \(me) مندوب GH Shopper.\nممكن \(g("ترسلين", "ترسل")) لي موقع\(g("كِ", "ك")) على الخريطة عشان أوصل \(g("طلبكِ", "طلبك"))؟"),
            ("نأجل التوصيل ⏰",
             "هلا \(first)، معك \(me) من GH Shopper.\nبنأجل توصيل \(g("طلبكِ", "طلبك")) لوقت ثاني، \(g("تبين", "تبي")) اليوم ولا بكرة؟"),
            ("تم التسليم ✨",
             "شكراً \(first) 🤍\nتم تسليم \(g("طلبكِ", "طلبك")) من GH Shopper، إن شاء الله \(g("يعجبكِ", "يعجبك")).")
        ]
        let actions: [SheetAction<String>] = templates.map { SheetAction($0.0, $0.1) }
        guard let text = await pickAction(title: "رسالة للعميل",
                                           message: "تنفتح في واتساب، وتقدر تعدّلها قبل الإرسال",
                                           actions: actions) else { return }
        openURL("https://wa.me/\(phone)?text=\(driverHomeEncode(text))")
    }

    private func openMaps(_ address: String) {
        if let r = address.range(of: "https?://\\S+", options: .regularExpression) {
            openURL(String(address[r]))
        } else {
            openURL("https://maps.apple.com/?q=\(driverHomeEncode(address))")
        }
    }
}

/// The delivery photo at its natural shape, with rounded corners.
fileprivate struct DeliveryPhotoView: View {
    let url: String

    var body: some View {
        AsyncImage(url: URL(string: url)) { phase in
            if let img = phase.image {
                img.resizable().scaledToFit()
            } else if phase.error != nil {
                Image(systemName: "photo")
                    .foregroundStyle(GH.tertiary)
                    .frame(maxWidth: .infinity)
                    .frame(height: 200)
            } else {
                ProgressView()
                    .frame(maxWidth: .infinity)
                    .frame(height: 200)
            }
        }
        .frame(maxWidth: .infinity)
        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        .padding(12)
    }
}

// MARK: - Delivery photo (camera / library)

/// JPEG like the old image_picker call: max 1600 px wide, quality 75.
fileprivate func deliveryJpeg(_ image: UIImage) -> Data? {
    let maxWidth: CGFloat = 1600
    let size = image.size
    var target = size
    if size.width > maxWidth && size.width > 0 {
        target = CGSize(width: maxWidth, height: (size.height * maxWidth / size.width).rounded())
    }
    let format = UIGraphicsImageRendererFormat.default()
    format.scale = 1
    let renderer = UIGraphicsImageRenderer(size: target, format: format)
    let resized = renderer.image { _ in image.draw(in: CGRect(origin: .zero, size: target)) }
    return resized.jpegData(compressionQuality: 0.75)
}

/// Presents the camera (UIImagePickerController) or the photo library
/// (PHPicker) above everything and returns the chosen photo.
@MainActor
fileprivate final class DeliveryPhotoGrabber: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate,
    PHPickerViewControllerDelegate {
    private static var active: DeliveryPhotoGrabber?
    private var cont: CheckedContinuation<UIImage?, Never>?

    static func pick(camera: Bool) async -> UIImage? {
        guard let top = topViewController() else { return nil }
        if camera && !UIImagePickerController.isSourceTypeAvailable(.camera) { return nil }
        let g = DeliveryPhotoGrabber()
        active = g
        return await withCheckedContinuation { (c: CheckedContinuation<UIImage?, Never>) in
            g.cont = c
            if camera {
                let p = UIImagePickerController()
                p.sourceType = .camera
                p.delegate = g
                top.present(p, animated: true)
            } else {
                var config = PHPickerConfiguration()
                config.filter = .images
                config.selectionLimit = 1
                let p = PHPickerViewController(configuration: config)
                p.delegate = g
                top.present(p, animated: true)
            }
        }
    }

    private func finish(_ image: UIImage?) {
        cont?.resume(returning: image)
        cont = nil
        DeliveryPhotoGrabber.active = nil
    }

    nonisolated func imagePickerController(_ picker: UIImagePickerController,
                                           didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
        let image = info[.originalImage] as? UIImage
        Task { @MainActor in
            picker.dismiss(animated: true)
            DeliveryPhotoGrabber.active?.finish(image)
        }
    }

    nonisolated func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
        Task { @MainActor in
            picker.dismiss(animated: true)
            DeliveryPhotoGrabber.active?.finish(nil)
        }
    }

    nonisolated func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        let provider = results.first?.itemProvider
        Task { @MainActor in
            picker.dismiss(animated: true)
            guard let provider, provider.canLoadObject(ofClass: UIImage.self) else {
                DeliveryPhotoGrabber.active?.finish(nil)
                return
            }
            provider.loadObject(ofClass: UIImage.self) { obj, _ in
                let image = obj as? UIImage
                Task { @MainActor in
                    DeliveryPhotoGrabber.active?.finish(image)
                }
            }
        }
    }
}
