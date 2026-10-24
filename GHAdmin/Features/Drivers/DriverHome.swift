import SwiftUI
import UIKit
import PhotosUI

// Port of lib/pages/driver_home.dart, plus the driver upgrade (DRIVER.md):
// gifts, couldn't-deliver, cash or transfer, maps, today's route, cash handover,
// "وصلت" in one tap and delivery notes per customer.

/// Loads the signed-in driver's orders (only theirs, without prices).
@MainActor
final class DriverData: ObservableObject {
    static let shared = DriverData()
    private init() {}

    @Published var orders: [DriverOrder] = []
    @Published var account: DriverAccount?
    @Published var ready = false
    @Published var error: Error?
    /// A notification asks the home page to show this tab (2 = حسابي).
    @Published var wantTab: Int?

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
            orders = DriverData.sorted(jlist(m?["orders"]).map { DriverOrder($0) })
            self.error = nil
        } catch {
            self.error = error
        }
        ready = true
    }

    /// The route order (route_pos, nulls last), else the server's order.
    static func sorted(_ list: [DriverOrder]) -> [DriverOrder] {
        let indexed = Array(list.enumerated())
        let out = indexed.sorted { a, b in
            let pa = a.element.routePos ?? Int.max
            let pb = b.element.routePos ?? Int.max
            if pa != pb { return pa < pb }
            return a.offset < b.offset
        }
        return out.map { $0.element }
    }

    func setStatus(_ o: DriverOrder, _ s: DriverStatus, photo: Data? = nil, collectedBy: String? = nil) async throws {
        var fields: [String: String] = ["status": s.rawValue]
        if let collectedBy { fields["collected_by"] = collectedBy }
        if let photo {
            try await Api.shared.upload("/ps/driver/orders/\(o.id)", field: "photo", data: photo, fields: fields)
        } else {
            var body: JSON = [:]
            for (k, v) in fields { body[k] = v }
            try await Api.shared.post("/ps/driver/orders/\(o.id)", body)
        }
        await refresh()
    }

    /// Couldn't deliver: the order stays with the driver for another try.
    func markFailed(_ o: DriverOrder, reason: DriverFailReason, note: String?, retryOn: Date?) async throws {
        var body: JSON = ["reason": reason.rawValue]
        if let note, !note.isEmpty { body["note"] = note }
        if let retryOn { body["retry_on"] = dayString(retryOn) }
        try await Api.shared.post("/ps/driver/orders/\(o.id)/failed", body)
        await refresh()
    }

    /// "وصلت عند الباب": the customer gets an in-app notification.
    /// true when the customer got the notification now (not "already" in the last 10 minutes).
    func arrived(_ o: DriverOrder) async throws -> Bool {
        let res = try await Api.shared.post("/ps/driver/orders/\(o.id)/arrived") as? JSON
        if jb(res?["already"]) { return false }
        return res?["notified"] == nil ? true : jb(res?["notified"])
    }

    /// Saves the driver's own order of today's deliveries.
    func saveRoute(_ ids: [String]) async throws {
        var pos: [String: Int] = [:]
        for (i, id) in ids.enumerated() { pos[id] = i }
        let updated: [DriverOrder] = orders.map { o in
            var x = o
            if let p = pos[o.id] { x.routePos = p }
            return x
        }
        orders = DriverData.sorted(updated)
        try await Api.shared.put("/ps/driver/route", ["ids": ids])
        if !DemoData.isOn { await refresh() }
    }

    /// The note on the customer for next time; empty clears it.
    func saveCustomerNote(_ o: DriverOrder, note: String) async throws {
        let clean = note.trimmingCharacters(in: .whitespacesAndNewlines)
        let value: String? = clean.isEmpty ? nil : clean
        try await Api.shared.put("/ps/driver/orders/\(o.id)/customer-note", ["note": nn(value)])
        await refresh()
    }

    /// Cash handed to the office: pending until staff confirm it.
    func handOver(amount: Double, note: String?) async throws {
        var body: JSON = ["amount": amount]
        if let note, !note.isEmpty { body["note"] = note }
        try await Api.shared.post("/ps/driver/handover", body)
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
/// Darker amber for text on a light amber fill.
fileprivate let driverAmberText = Color(hex: 0xFFB36200)
fileprivate let driverGoldDeep = Color(hex: 0xFF8C6A2F)

fileprivate func stripLinks(_ s: String) -> String {
    s.replacingOccurrences(of: "https?://\\S+", with: "", options: .regularExpression)
        .trimmingCharacters(in: .whitespacesAndNewlines)
}

fileprivate func dhFirstLink(_ s: String?) -> String? {
    guard let s, let r = s.range(of: "https?://\\S+", options: .regularExpression) else { return nil }
    return String(s[r])
}

/// An action that is nil (disabled) when `on` is false.
fileprivate func dhEnabled(_ on: Bool, _ f: @escaping () -> Void) -> (() -> Void)? { on ? f : nil }

fileprivate func dhIsToday(_ d: Date?) -> Bool {
    guard let d else { return false }
    return Calendar.current.isDateInToday(d)
}

fileprivate func dhFirstName(_ name: String) -> String {
    let trimmed = name.trimmingCharacters(in: .whitespaces)
    return String(trimmed.split(separator: " ", omittingEmptySubsequences: false).first ?? "")
}

/// The app link when the app is installed, else the web link.
@MainActor
fileprivate func dhAppOrWeb(_ app: String, _ web: String) -> String {
    if let u = URL(string: app), UIApplication.shared.canOpenURL(u) { return app }
    return web
}

/// "خالد · مسقط" area text for grouping the route.
fileprivate func dhArea(_ o: DriverOrder) -> String {
    if let c = o.customerCity?.trimmingCharacters(in: .whitespaces), !c.isEmpty { return c }
    let a = stripLinks(o.address ?? "")
    let first = a.split(whereSeparator: { $0 == "،" || $0 == "," }).first.map(String.init) ?? a
    return first.trimmingCharacters(in: .whitespaces)
}

// MARK: - WhatsApp templates (to the person at the door)

/// Ready-made messages: index 1 is "وصلت", 2 is "ما رد", 3 asks for the location.
@MainActor
fileprivate func driverTemplates(_ o: DriverOrder) -> [(String, String)] {
    // A gift's recipient: gender unknown, the plain (masculine) wording.
    let male = o.gift != nil ? true : o.customerIsMale
    func g(_ f: String, _ m: String) -> String { male ? m : f }
    let first = dhFirstName(o.recipientName)
    let me = Api.shared.session?.name ?? "المندوب"
    let pay = o.toCollect > 0 ? "\nالمبلغ \(omr(o.toCollect)) يندفع عند الاستلام." : ""
    let order = o.gift != nil ? "هديت\(g("كِ", "ك"))" : g("طلبكِ", "طلبك")
    return [
        ("أنا في الطريق 🚗",
         "هلا \(first) 👋\nمعك \(me) مندوب GH Shopper.\n\(order) في الطريق \(g("إليكِ", "إليك"))، بوصل خلال حوالي ٢٠ دقيقة إن شاء الله.\(pay)"),
        ("وصلت عند الموقع 📍",
         "هلا \(first)، وصلت عند موقع\(g("كِ", "ك")) 📍\nأنا تحت مع \(order) من GH Shopper.\(pay)"),
        ("ما رد على الاتصال 📞",
         "هلا \(first)، حاولت أتصل \(g("فيكِ", "فيك")) بخصوص توصيل \(order) من GH Shopper.\nمتى يناسب\(g("كِ", "ك")) أوصله؟"),
        ("أبي الموقع على الخريطة 🗺️",
         "هلا \(first)، معك \(me) مندوب GH Shopper.\nممكن \(g("ترسلين", "ترسل")) لي موقع\(g("كِ", "ك")) على الخريطة عشان أوصل \(order)؟"),
        ("نأجل التوصيل ⏰",
         "هلا \(first)، معك \(me) من GH Shopper.\nبنأجل توصيل \(order) لوقت ثاني، \(g("تبين", "تبي")) اليوم ولا بكرة؟"),
        ("تم التسليم ✨",
         "شكراً \(first) 🤍\nتم تسليم \(order) من GH Shopper، إن شاء الله \(g("يعجبكِ", "يعجبك"))."),
    ]
}

@MainActor
fileprivate func driverSendText(_ o: DriverOrder, _ text: String) {
    guard let phone = waPhone(o.recipientPhone) else {
        toast("ما في رقم", error: true)
        return
    }
    openURL("https://wa.me/\(phone)?text=\(driverHomeEncode(text))")
}

@MainActor
fileprivate func driverPickTemplate(_ o: DriverOrder) async {
    guard waPhone(o.recipientPhone) != nil else {
        toast("ما في رقم", error: true)
        return
    }
    let actions: [SheetAction<String>] = driverTemplates(o).map { SheetAction($0.0, $0.1) }
    let to = o.gift != nil ? "رسالة لـ \(o.recipientName)" : "رسالة للعميل"
    guard let text = await pickAction(title: to,
                                       message: "تنفتح في واتساب، وتقدر تعدّلها قبل الإرسال",
                                       actions: actions) else { return }
    driverSendText(o, text)
}

/// Google Maps / Waze / Apple Maps, with the coordinates when known.
@MainActor
fileprivate func driverOpenMaps(_ o: DriverOrder) async {
    let text = stripLinks(o.address ?? "")
    let query = text.isEmpty ? (o.customerCity ?? "") : text
    var actions: [SheetAction<String>] = []
    if let lat = o.lat, let lng = o.lng {
        let ll = String(format: "%.6f,%.6f", lat, lng)
        actions.append(SheetAction("Google Maps", dhAppOrWeb("comgooglemaps://?daddr=\(ll)&directionsmode=driving",
                                                             "https://www.google.com/maps/dir/?api=1&destination=\(ll)")))
        actions.append(SheetAction("Waze", dhAppOrWeb("waze://?ll=\(ll)&navigate=yes",
                                                      "https://waze.com/ul?ll=\(ll)&navigate=yes")))
        actions.append(SheetAction("خرائط Apple", "maps://?daddr=\(ll)"))
    } else {
        if let link = o.mapsUrl ?? dhFirstLink(o.address) {
            actions.append(SheetAction("افتح رابط الموقع", link))
        }
        if !query.isEmpty {
            let q = driverHomeEncode(query)
            actions.append(SheetAction("Google Maps", dhAppOrWeb("comgooglemaps://?daddr=\(q)&directionsmode=driving",
                                                                 "https://www.google.com/maps/dir/?api=1&destination=\(q)")))
            actions.append(SheetAction("Waze", dhAppOrWeb("waze://?q=\(q)&navigate=yes",
                                                          "https://waze.com/ul?q=\(q)&navigate=yes")))
            actions.append(SheetAction("خرائط Apple", "maps://?daddr=\(q)"))
        }
        if waPhone(o.recipientPhone) != nil {
            actions.append(SheetAction("اطلب الموقع بالواتساب", "ask:"))
        }
    }
    if actions.isEmpty {
        toast("ما في عنوان ولا رقم", error: true)
        return
    }
    let title = o.hasCoordinates ? "الموقع على الخريطة" : "الموقع"
    guard let choice = await pickAction(title: title, message: query.isEmpty ? nil : query, actions: actions) else { return }
    if choice == "ask:" {
        let t = driverTemplates(o)
        if t.count > 3 { driverSendText(o, t[3].1) }
    } else {
        openURL(choice)
    }
}

// MARK: - Home

struct DriverHome: View {
    let name: String
    @State private var tab: Int // 0 now · 1 previous · 2 my money
    @State private var started = false
    @ObservedObject private var data = DriverData.shared

    init(name: String, initialTab: Int = 0) {
        self.name = name
        _tab = State(initialValue: initialTab)
    }

    private var openOrders: [DriverOrder] { data.orders.filter { !$0.isDone } }
    private var doneOrders: [DriverOrder] { data.orders.filter { $0.isDone } }
    private var collectTotal: Double { openOrders.reduce(0.0) { $0 + $1.toCollect } }
    private var deliveredToday: Int { doneOrders.filter { dhIsToday($0.deliveredAt) }.count }

    var body: some View {
        GHPage("توصيلاتي",
               onRefresh: { await DriverData.shared.refresh() },
               trailing: { NavButton("خروج") { Task { await logout() } } },
               bottom: { bottomBar }) {
            header
            stats
            cashCard
            tabs
            tabContent
        }
        .task { await start() }
        .onChange(of: data.wantTab) { _, t in
            if let t {
                tab = t
                DriverData.shared.wantTab = nil
            }
        }
    }

    private func start() async {
        if started { return }
        started = true
        if !DriverData.shared.ready { await DriverData.shared.refresh() }
        if DemoData.isOn {
            DemoScreens.openDriverIfAsked(tab: $tab)
        } else {
            await Push.shared.start()
        }
    }

    /// The main action: scan on the delivery tabs, hand over cash on حسابي.
    @ViewBuilder
    private var bottomBar: some View {
        if tab == 2 && data.account != nil {
            PrimaryButton("سلّمت الكاش", icon: "banknote.fill") { Task { await driverHandOverCash() } }
        } else {
            PrimaryButton("امسح بوليصة واستلم الطلب", icon: "qrcode.viewfinder") { Task { await scan() } }
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
            StatCard(label: "للتوصيل الحين", value: "\(openOrders.count)", icon: "car.fill", hero: true,
                     action: { tab = 0 })
            StatCard(label: "سلّمت اليوم", value: "\(deliveredToday)", icon: "checkmark.seal.fill", color: GH.green,
                     action: { tab = 1 })
        }
        .padding(.horizontal, 16)
        .padding(.top, 12)
    }

    @ViewBuilder
    private var cashCard: some View {
        if let acc = data.account {
            DriverCashCard(account: acc, toCollect: collectTotal,
                           onOpen: { tab = 2 },
                           onHandOver: { Task { await driverHandOverCash() } })
                .padding(.horizontal, 16)
                .padding(.top, 10)
        } else if collectTotal > 0 {
            DriverCollectRow(amount: collectTotal)
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
            routeHeader(open.count)
            ForEach(Array(open.enumerated()), id: \.element.id) { pair in
                DriverDeliveryCard(o: pair.element, number: pair.offset + 1)
            }
        }
    }

    private func routeHeader(_ count: Int) -> some View {
        HStack(spacing: 8) {
            Text("مشوار اليوم · \(count)")
                .font(TS.header)
                .foregroundStyle(GH.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
            if count > 1 {
                ChipButton("رتّب المشوار", icon: "arrow.up.arrow.down") { pushPage(DriverRoutePage()) }
            }
        }
        .padding(.horizontal, 20)
        .padding(.top, 8)
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
        return Tile(o.recipientName,
                    subtitle: sub,
                    action: { pushPage(DriverOrderPage(orderId: id)) },
                    leading: { Avatar(o.recipientName, size: 34) })
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
            DriverPendingHandovers(list: acc.pendingHandovers)
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

/// "الكاش اللي معك": cash collected and not handed over yet, with the handover button.
fileprivate struct DriverCashCard: View {
    let account: DriverAccount
    let toCollect: Double
    let onOpen: () -> Void
    let onHandOver: () -> Void

    private var pending: Double { account.pendingTotal }

    private var netText: String {
        let net = account.net
        if abs(net) < 0.0005 { return "حسابك معنا صافي ✓" }
        if net > 0 { return "عندك لنا \(omr(net))" }
        return "لك عندنا \(omr(-net))"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button(action: onOpen) { topRow }
                .buttonStyle(.plain)
            infoLines.padding(.top, 8)
            if account.cash > 0.0005 {
                handOverButton.padding(.top, 12)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(GH.card))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(GH.amber.opacity(0.35), lineWidth: 1))
        .ghShadow()
    }

    private var topRow: some View {
        HStack(spacing: 10) {
            IconBox("banknote.fill", color: GH.amber, size: 40)
            VStack(alignment: .leading, spacing: 0) {
                Text("الكاش اللي معك").font(.gh(13.5, .medium)).foregroundStyle(GH.secondary)
                Text(omr(account.cash))
                    .font(.gh(24, .bold).monospacedDigit())
                    .foregroundStyle(GH.label)
                    .lineLimit(1)
                    .minimumScaleFactor(0.6)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            Text("حسابي").font(.gh(14)).foregroundStyle(GH.burgundy)
            Image(systemName: "chevron.forward")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(GH.tertiary)
        }
        .contentShape(Rectangle())
    }

    private var infoLines: some View {
        VStack(alignment: .leading, spacing: 3) {
            if pending > 0.0005 {
                Label("بانتظار تأكيد المكتب \(omr(pending))", systemImage: "clock.fill")
                    .font(.gh(13.5, .medium))
                    .foregroundStyle(driverAmberText)
            }
            if toCollect > 0.0005 {
                Label("باقي تحصّل اليوم \(omr(toCollect))", systemImage: "dollarsign.circle")
                    .font(.gh(13.5))
                    .foregroundStyle(GH.secondary)
            }
            Text(netText).font(.gh(13.5)).foregroundStyle(GH.secondary)
        }
    }

    private var handOverButton: some View {
        Button(action: onHandOver) {
            HStack(spacing: 8) {
                Image(systemName: "hand.raised.fill").font(.system(size: 17))
                Text("سلّمت الكاش").font(.gh(16, .semibold))
            }
            .foregroundStyle(driverAmberText)
            .frame(maxWidth: .infinity)
            .frame(height: 48)
            .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(GH.amber.opacity(0.14)))
        }
        .buttonStyle(.plain)
    }
}

/// Older server (no account): only what to collect today.
fileprivate struct DriverCollectRow: View {
    let amount: Double

    var body: some View {
        HStack(spacing: 10) {
            IconBox("dollarsign.circle.fill", color: GH.amber)
            Text("تحصّل اليوم \(omr(amount))")
                .font(.gh(15, .semibold))
                .foregroundStyle(GH.label)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 12)
        .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(GH.card))
        .ghShadow()
    }
}

/// One delivery waiting: number on the route, who, where, what to collect, step.
fileprivate struct DriverDeliveryCard: View {
    let o: DriverOrder
    let number: Int

    private var picked: Bool { o.status == .picked }
    private var hasCollect: Bool { o.toCollect > 0 }

    private var subLine: String {
        [o.customerCity ?? "", "\(o.items.count) قطعة", o.waybillNo ?? o.invoiceNo]
            .filter { !$0.isEmpty }
            .joined(separator: " · ")
    }

    private var badgeText: String {
        if o.isFailed { return "ما تسلّم" }
        return picked ? "معك" : "جديد"
    }

    private var badgeColor: Color {
        if o.isFailed { return GH.red }
        return picked ? GH.amber : GH.blue
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
            giftRow
            failedRow
            addressRow
            noteRow
            collectPill.padding(.top, 10)
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(GH.card))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous)
            .stroke(o.isFailed ? GH.red.opacity(0.45) : Color.clear, lineWidth: 1.5))
        .ghShadow()
        .contentShape(Rectangle())
    }

    private var numberCircle: some View {
        Text("\(number)")
            .font(.gh(17, .bold).monospacedDigit())
            .foregroundStyle(Color.white)
            .frame(width: 40, height: 40)
            .background(Circle().fill(o.isFailed ? GH.red : GH.burgundy))
    }

    private var topRow: some View {
        HStack(spacing: 10) {
            numberCircle
            VStack(alignment: .leading, spacing: 0) {
                Text(o.recipientName).font(TS.title).foregroundStyle(GH.label)
                Text(subLine).font(TS.sub).foregroundStyle(GH.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            VStack(alignment: .trailing, spacing: 4) {
                Badge(badgeText, color: badgeColor)
                if o.gift != nil { Badge("🎁 هدية", color: GH.gold) }
            }
        }
    }

    @ViewBuilder
    private var giftRow: some View {
        if o.gift != nil {
            Text("هدية من \(o.customerName)")
                .font(.gh(13.5, .medium))
                .foregroundStyle(driverGoldDeep)
                .padding(.top, 8)
        }
    }

    @ViewBuilder
    private var failedRow: some View {
        if o.isFailed {
            HStack(alignment: .top, spacing: 6) {
                Image(systemName: "exclamationmark.triangle.fill").font(.system(size: 14)).foregroundStyle(GH.red)
                Text(driverFailedLine(reason: o.failedReasonLabel ?? o.failedReason, note: o.failedNote, retryOn: o.retryOn))
                    .font(.gh(13.5, .medium))
                    .foregroundStyle(GH.red)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(10)
            .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(GH.red.opacity(0.09)))
            .padding(.top, 10)
        }
    }

    @ViewBuilder
    private var addressRow: some View {
        if let a = o.address {
            HStack(alignment: .top, spacing: 6) {
                Image(systemName: o.hasCoordinates ? "mappin.circle.fill" : "location.fill")
                    .font(.system(size: 15))
                    .foregroundStyle(o.hasCoordinates ? GH.blue : GH.secondary)
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

    @ViewBuilder
    private var noteRow: some View {
        if let n = o.customerDeliveryNote {
            HStack(alignment: .top, spacing: 6) {
                Image(systemName: "note.text").font(.system(size: 14)).foregroundStyle(driverAmberText)
                Text(n)
                    .font(.gh(13.5))
                    .foregroundStyle(GH.label)
                    .lineLimit(2)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(.top, 8)
        }
    }

    private var collectPill: some View {
        let tint = hasCollect ? GH.amber : GH.green
        let textColor = hasCollect ? driverAmberText : GH.green
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

// MARK: - Today's route

/// "رتّب المشوار": drag (or up / down) the open deliveries into the order you drive them.
struct DriverRoutePage: View {
    @ObservedObject private var data = DriverData.shared
    @Environment(\.dismiss) private var dismiss
    @State private var ids: [String] = []
    @State private var loaded = false
    @State private var busy = false

    init() {}

    private func order(_ id: String) -> DriverOrder? { data.orders.first { $0.id == id } }

    var body: some View {
        List {
            Section {
                Button { byArea() } label: {
                    Label("رتّب حسب المنطقة", systemImage: "map")
                        .font(.gh(16, .medium))
                        .foregroundStyle(GH.burgundy)
                        .frame(minHeight: 40)
                }
                .buttonStyle(.borderless)
            } footer: {
                Text("اسحب الطلب من الخطوط عشان تغيّر مكانه، أو استخدم الأسهم.")
                    .font(TS.small)
            }
            Section {
                ForEach(Array(ids.enumerated()), id: \.element) { pair in
                    row(pair.offset, pair.element)
                }
                .onMove(perform: move)
            }
        }
        .environment(\.editMode, .constant(.active))
        .scrollContentBackground(.hidden)
        .background(GH.bg.ignoresSafeArea())
        .navigationTitle("رتّب المشوار")
        .navigationBarTitleDisplayMode(.inline)
        .safeAreaInset(edge: .bottom, spacing: 0) { saveBar }
        .onAppear {
            if !loaded {
                ids = data.orders.filter { !$0.isDone }.map { $0.id }
                loaded = true
            }
        }
    }

    @ViewBuilder
    private func row(_ index: Int, _ id: String) -> some View {
        if let o = order(id) {
            HStack(spacing: 10) {
                Text("\(index + 1)")
                    .font(.gh(15, .bold).monospacedDigit())
                    .foregroundStyle(Color.white)
                    .frame(width: 30, height: 30)
                    .background(Circle().fill(o.isFailed ? GH.red : GH.burgundy))
                VStack(alignment: .leading, spacing: 1) {
                    Text(o.recipientName).font(TS.title).foregroundStyle(GH.label)
                    Text(dhArea(o).isEmpty ? (o.waybillNo ?? o.invoiceNo) : dhArea(o))
                        .font(TS.sub)
                        .foregroundStyle(GH.secondary)
                        .lineLimit(1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                arrow("chevron.up", enabled: index > 0) { step(index, -1) }
                arrow("chevron.down", enabled: index < ids.count - 1) { step(index, 1) }
            }
            .padding(.vertical, 4)
            .listRowBackground(GH.card)
        }
    }

    private func arrow(_ symbol: String, enabled: Bool, _ action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(enabled ? GH.burgundy : GH.tertiary)
                .frame(width: 40, height: 40)
                .background(Circle().fill(GH.panel))
        }
        .buttonStyle(.borderless)
        .disabled(!enabled)
    }

    private var saveBar: some View {
        PrimaryButton("احفظ الترتيب", icon: "checkmark", busy: busy) { Task { await save() } }
            .padding(.horizontal, 16).padding(.top, 10).padding(.bottom, 8)
            .frame(maxWidth: .infinity)
            .background(
                UnevenRoundedRectangle(topLeadingRadius: 22, topTrailingRadius: 22)
                    .fill(GH.tabBar)
                    .shadow(color: GH.barShadow, radius: 10, y: -4)
                    .ignoresSafeArea(edges: .bottom))
    }

    private func move(from source: IndexSet, to destination: Int) {
        ids.move(fromOffsets: source, toOffset: destination)
        Haptic.select()
    }

    private func step(_ index: Int, _ delta: Int) {
        let target = index + delta
        guard target >= 0, target < ids.count else { return }
        withAnimation { ids.swapAt(index, target) }
        Haptic.select()
    }

    /// Groups the stops by city / area, alphabetically (the current order inside a group).
    private func byArea() {
        let current = Array(ids.enumerated())
        let sorted = current.sorted { a, b in
            let ka = order(a.element).map(dhArea) ?? ""
            let kb = order(b.element).map(dhArea) ?? ""
            if ka != kb {
                if ka.isEmpty { return false }
                if kb.isEmpty { return true }
                return ka.localizedCompare(kb) == .orderedAscending
            }
            return a.offset < b.offset
        }
        withAnimation { ids = sorted.map { $0.element } }
        Haptic.light()
    }

    private func save() async {
        busy = true
        do {
            try await DriverData.shared.saveRoute(ids)
            Haptic.success()
            toast("انحفظ الترتيب ✓")
            busy = false
            dismiss()
        } catch {
            busy = false
            toastError(error)
        }
    }
}

// MARK: - One delivery

struct DriverOrderPage: View {
    let orderId: String
    @ObservedObject private var data = DriverData.shared
    @Environment(\.dismiss) private var dismiss
    @State private var busy = false
    @State private var arriving = false

    init(orderId: String) { self.orderId = orderId }

    private var order: DriverOrder? { data.orders.last { $0.id == orderId } }

    var body: some View {
        if let o = order {
            if o.isDone {
                GHPage(o.recipientName) { content(o) }
            } else {
                GHPage(o.recipientName,
                       onRefresh: { await DriverData.shared.refresh() },
                       bottom: { bottomBar(o) }) { content(o) }
            }
        } else {
            GHPage("الطلب") {
                EmptyState(icon: "shippingbox", title: "الطلب مب موجود")
            }
        }
    }

    // MARK: bottom bar (the main action, always here)

    @ViewBuilder
    private func bottomBar(_ o: DriverOrder) -> some View {
        if o.status == .picked {
            HStack(spacing: 10) {
                DriverFailButton(disabled: busy) { Task { await failed(o) } }
                    .frame(width: 118)
                PrimaryButton("تم التسليم", icon: "camera.fill", busy: busy) { Task { await delivered(o) } }
            }
        } else if o.status == .failed {
            HStack(spacing: 10) {
                SecondaryButton("تم التسليم", icon: "camera.fill", action: dhEnabled(!busy) { Task { await delivered(o) } })
                    .frame(width: 150)
                PrimaryButton("استلمت، طالع أوصله", icon: "car.fill", busy: busy) { Task { await picked(o) } }
            }
        } else {
            PrimaryButton("استلمت الطلب، طالع أوصله", icon: "car.fill", busy: busy) { Task { await picked(o) } }
        }
    }

    // MARK: content

    @ViewBuilder
    private func content(_ o: DriverOrder) -> some View {
        topLine(o)
        if o.isFailed { DriverFailedBanner(o: o) }
        if let g = o.gift { DriverGiftBanner(o: o, gift: g) }
        collectBanner(o)
        if !o.isDone { quickRow(o) }
        if o.status == .picked || o.status == .failed {
            DriverArrivedButton(busy: arriving) { Task { await arrived(o) } }
        }
        DriverNoteBox(note: o.customerDeliveryNote) { Task { await editNote(o) } }
        contactSection(o)
        addressSection(o)
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

    /// Big buttons: location, and (when not a gift) call + WhatsApp.
    private func quickRow(_ o: DriverOrder) -> some View {
        let phone = waPhone(o.customerPhone)
        let isGift = o.gift != nil
        return HStack(spacing: 10) {
            DriverQuickButton(icon: "map.fill", label: "الموقع", color: GH.blue) {
                Task { await driverOpenMaps(o) }
            }
            if !isGift, let phone {
                DriverQuickButton(icon: "phone.fill", label: "اتصال", color: GH.green) {
                    openURL("tel:+\(phone)")
                }
                DriverQuickButton(icon: "bubble.left.fill", label: "واتساب", color: driverWhatsAppGreen) {
                    Task { await driverPickTemplate(o) }
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 12)
    }

    /// The customer (for a gift: the buyer, titled "المشتري").
    @ViewBuilder
    private func contactSection(_ o: DriverOrder) -> some View {
        let phone = waPhone(o.customerPhone)
        let isGift = o.gift != nil
        if let phone {
            GHSection(isGift ? "المشتري" : nil) {
                if isGift {
                    Tile(o.customerName, subtitle: "طلب الهدية", chevron: false,
                         leading: { Avatar(o.customerName, size: 30) })
                }
                Tile("اتصال",
                     value: o.customerPhone,
                     action: { openURL("tel:+\(phone)") },
                     leading: { IconBox("phone.fill", color: GH.green) })
                if !isGift {
                    Tile("رسائل جاهزة للعميل",
                         subtitle: "في الطريق، وصلت، ما رديت…",
                         action: { Task { await driverPickTemplate(o) } },
                         leading: { IconBox("text.bubble.fill", color: driverWhatsAppGreen) })
                }
                Tile("واتساب",
                     action: { openURL("https://wa.me/\(phone)") },
                     leading: { IconBox("bubble.left.fill", color: driverWhatsAppGreen) })
            }
        }
    }

    private func addressSection(_ o: DriverOrder) -> some View {
        let hasTarget = o.address != nil || o.customerCity != nil || o.hasCoordinates
        var action: (() -> Void)? = nil
        if hasTarget { action = { Task { await driverOpenMaps(o) } } }
        let title = o.address.map { stripLinks($0) } ?? o.customerCity ?? "ما في عنوان"
        var sub: [String] = []
        if o.address != nil, let c = o.customerCity { sub.append(c) }
        if o.hasCoordinates { sub.append("الموقع على الخريطة ✓") }
        return GHSection("العنوان") {
            Tile(title.isEmpty ? "الموقع على الخريطة" : title,
                 subtitle: sub.isEmpty ? nil : sub.joined(separator: " · "),
                 action: action,
                 leading: { IconBox("location.fill", color: GH.blue) })
        }
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
                collectedTile(o)
            }
        } else if o.isDone {
            GHSection {
                Tile("تم التسليم", value: dateStr(o.deliveredAt), chevron: false)
                collectedTile(o)
            }
        }
    }

    @ViewBuilder
    private func collectedTile(_ o: DriverOrder) -> some View {
        if o.toCollect > 0, let by = o.collectedBy {
            Tile(by == "transfer" ? "العميل حوّل (تحويل بنكي)" : "حصّلته كاش",
                 value: omr(o.toCollect), chevron: false,
                 leading: { IconBox(by == "transfer" ? "building.columns.fill" : "banknote.fill",
                                    color: by == "transfer" ? GH.blue : GH.amber) })
        }
    }

    // MARK: actions

    private func picked(_ o: DriverOrder) async {
        busy = true
        do {
            try await DriverData.shared.setStatus(o, .picked)
            Haptic.success()
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
        var collectedBy: String? = nil
        if o.toCollect > 0 {
            let how: [SheetAction<String>] = [
                SheetAction("كاش 💵", "cash"),
                SheetAction("حوّل لكم (تحويل بنكي)", "transfer"),
            ]
            let message = o.isCod ? "قيمة الطلب كاملة من الزبون" : "رسوم التوصيل من الزبون"
            guard let chosen = await pickAction(title: "حصّلت \(omr(o.toCollect))؟", message: message,
                                                actions: how) else { return }
            collectedBy = chosen
        }
        busy = true
        guard let bytes = deliveryJpeg(image) else {
            busy = false
            return
        }
        do {
            try await DriverData.shared.setStatus(o, .delivered, photo: bytes, collectedBy: collectedBy)
            Haptic.success()
            toast(collectedBy == "transfer" ? "تم التسليم ✓ · التحويل يتأكد عندنا" : "تم التسليم ✓")
            dismiss()
        } catch {
            busy = false
            toastError(error)
        }
    }

    /// "ما قدرت أسلّم": why, then (for a delay) when.
    private func failed(_ o: DriverOrder) async {
        let reasons: [SheetAction<DriverFailReason>] = DriverFailReason.allCases.map { SheetAction($0.label, $0) }
        guard let reason = await pickAction(title: "ليش ما قدرت تسلّم؟",
                                             message: "الطلب يبقى معك وتقدر تحاول مرة ثانية",
                                             actions: reasons) else { return }
        var note: String? = nil
        var retry: Date? = nil
        if reason == .other || reason == .wrongAddress {
            let title = reason == .other ? "وش السبب؟" : "وش الغلط في العنوان؟"
            guard let t = await promptText(title, placeholder: reason == .other ? "اكتب السبب" : "اختياري",
                                           ok: "تم") else { return }
            let clean = t.trimmingCharacters(in: .whitespacesAndNewlines)
            if reason == .other && clean.isEmpty {
                toast("اكتب السبب", error: true)
                return
            }
            note = clean.isEmpty ? nil : clean
        }
        if reason == .postponed {
            guard let day = await askRetryDay() else { return }
            retry = day.date
        }
        busy = true
        do {
            try await DriverData.shared.markFailed(o, reason: reason, note: note, retryOn: retry)
            Haptic.success()
            toast("انحفظ: \(reason.label)")
        } catch {
            busy = false
            toastError(error)
            return
        }
        busy = false
        if reason == .noAnswer && waPhone(o.recipientPhone) != nil {
            let send = await confirm("ترسل له واتساب؟", message: "إنك حاولت تتصل، ومتى يناسبه التوصيل",
                                     ok: "أرسل", destructive: false)
            let t = driverTemplates(o)
            if send && t.count > 2 { driverSendText(o, t[2].1) }
        }
    }

    /// nil: cancelled · .date nil: no date.
    private func askRetryDay() async -> DriverRetryChoice? {
        let options: [SheetAction<Int>] = [
            SheetAction("بكرة", 1),
            SheetAction("بعد بكرة", 2),
            SheetAction("اختار يوم…", -1),
            SheetAction("بدون موعد", 0),
        ]
        guard let n = await pickAction(title: "متى يبي التوصيل؟", actions: options) else { return nil }
        if n == 0 { return DriverRetryChoice(date: nil) }
        if n > 0 { return DriverRetryChoice(date: Calendar.current.date(byAdding: .day, value: n, to: Date())) }
        let start = Calendar.current.date(byAdding: .day, value: 1, to: Date()) ?? Date()
        guard let d = await pickDate(start) else { return nil }
        return DriverRetryChoice(date: d)
    }

    /// One tap at the door: in-app notification to the customer + the WhatsApp "وصلت".
    private func arrived(_ o: DriverOrder) async {
        arriving = true
        var sent = false
        do {
            sent = try await DriverData.shared.arrived(o)
            Haptic.success()
        } catch {
            toastError(error)
        }
        arriving = false
        let t = driverTemplates(o)
        if waPhone(o.recipientPhone) != nil && t.count > 1 {
            driverSendText(o, t[1].1)
        } else if sent {
            toast("وصّلنا للعميل إنك عند الباب ✓")
        }
    }

    private func editNote(_ o: DriverOrder) async {
        guard let text = await promptText("ملاحظة التوصيل",
                                          message: "تنحفظ على العميل وتطلع لك المرة الجاية",
                                          placeholder: "البيت الأبيض جنب المسجد، الباب الخلفي",
                                          initial: o.customerDeliveryNote ?? "",
                                          ok: "حفظ") else { return }
        do {
            try await DriverData.shared.saveCustomerNote(o, note: text)
            toast("انحفظت الملاحظة ✓")
        } catch {
            toastError(error)
        }
    }
}

fileprivate struct DriverRetryChoice {
    let date: Date?
}

// MARK: - Order page pieces

/// Big square-ish button for one-handed use in the car.
fileprivate struct DriverQuickButton: View {
    let icon: String
    let label: String
    let color: Color
    let action: () -> Void

    var body: some View {
        Button {
            Haptic.light()
            action()
        } label: {
            VStack(spacing: 6) {
                Image(systemName: icon).font(.system(size: 24, weight: .medium)).foregroundStyle(color)
                Text(label).font(.gh(14.5, .semibold)).foregroundStyle(GH.label).lineLimit(1)
            }
            .frame(maxWidth: .infinity)
            .frame(height: 78)
            .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(GH.card))
            .ghShadow()
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}

/// "وصلت عند الباب 📍" full width, amber.
fileprivate struct DriverArrivedButton: View {
    let busy: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            ZStack {
                if busy {
                    ProgressView().tint(driverAmberText)
                } else {
                    HStack(spacing: 8) {
                        Image(systemName: "mappin.and.ellipse").font(.system(size: 20, weight: .semibold))
                        Text("وصلت عند الباب 📍").font(.gh(17, .bold))
                    }
                    .foregroundStyle(driverAmberText)
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 58)
            .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(GH.amber.opacity(0.16)))
            .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(GH.amber.opacity(0.5), lineWidth: 1.5))
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(busy)
        .padding(.horizontal, 16)
        .padding(.top, 12)
    }
}

/// "ما قدرت" (couldn't deliver): red outline, next to "تم التسليم".
fileprivate struct DriverFailButton: View {
    let disabled: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: "xmark.circle").font(.system(size: 18))
                Text("ما قدرت").font(.gh(16, .semibold))
            }
            .foregroundStyle(GH.red)
            .frame(maxWidth: .infinity)
            .frame(height: 52)
            .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(GH.card))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(GH.red.opacity(0.55), lineWidth: 1.5))
        }
        .buttonStyle(.plain)
        .disabled(disabled)
        .opacity(disabled ? 0.5 : 1)
    }
}

/// Red: the last try failed (reason, note, next try).
fileprivate struct DriverFailedBanner: View {
    let o: DriverOrder

    private var reason: String { o.failedReasonLabel ?? DriverFailReason.label(o.failedReason) ?? "ما قدرت تسلّم" }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 26))
                .foregroundStyle(GH.red)
            VStack(alignment: .leading, spacing: 3) {
                Text("ما تسلّم · \(reason)").font(.gh(16.5, .bold)).foregroundStyle(GH.red)
                if let n = o.failedNote { Text(n).font(.gh(14.5)).foregroundStyle(GH.label) }
                if let d = o.retryOn {
                    Text("المحاولة الجاية \(dateStr(d))").font(.gh(14.5, .semibold)).foregroundStyle(GH.label)
                }
                if let at = o.failedAt {
                    Text(dateTimeStr(at)).font(TS.small).foregroundStyle(GH.secondary)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(GH.red.opacity(0.1)))
        .overlay(RoundedRectangle(cornerRadius: 18, style: .continuous).stroke(GH.red.opacity(0.4), lineWidth: 1))
        .padding(.horizontal, 16)
        .padding(.top, 12)
    }
}

/// Gold: a gift, hand it to the recipient (call / WhatsApp on their phone).
fileprivate struct DriverGiftBanner: View {
    let o: DriverOrder
    let gift: OrderGift

    private var to: String { o.recipientName }
    private var phone: String? { waPhone(gift.phone) }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 12) {
                Image(systemName: "gift.fill").font(.system(size: 28)).foregroundStyle(Color.white)
                VStack(alignment: .leading, spacing: 1) {
                    Text("هدية · سلّمها لـ \(to)").font(.gh(17, .bold)).foregroundStyle(Color.white)
                    Text(gift.phone ?? "ما في رقم للمستلم، كلّم المشتري")
                        .font(.gh(14))
                        .foregroundStyle(Color.white.opacity(0.85))
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            if let phone {
                buttons(phone).padding(.top, 12)
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(LinearGradient(colors: [GH.gold, driverGoldDeep], startPoint: .leading, endPoint: .trailing)))
        .padding(.horizontal, 16)
        .padding(.top, 12)
    }

    private func buttons(_ phone: String) -> some View {
        HStack(spacing: 10) {
            giftButton("phone.fill", "اتصال") { openURL("tel:+\(phone)") }
            giftButton("bubble.left.fill", "واتساب") { Task { await driverPickTemplate(o) } }
        }
    }

    private func giftButton(_ icon: String, _ label: String, _ action: @escaping () -> Void) -> some View {
        Button {
            Haptic.light()
            action()
        } label: {
            HStack(spacing: 6) {
                Image(systemName: icon).font(.system(size: 17))
                Text(label).font(.gh(16, .semibold))
            }
            .foregroundStyle(driverGoldDeep)
            .frame(maxWidth: .infinity)
            .frame(height: 50)
            .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color.white))
        }
        .buttonStyle(.plain)
    }
}

/// Yellow "ملاحظة التوصيل" box, saved on the customer for next time.
fileprivate struct DriverNoteBox: View {
    let note: String?
    let onEdit: () -> Void

    var body: some View {
        Button(action: onEdit) {
            if let note {
                filled(note)
            } else {
                empty
            }
        }
        .buttonStyle(.plain)
        .padding(.horizontal, 16)
        .padding(.top, 12)
    }

    private func filled(_ note: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 6) {
                Image(systemName: "note.text").font(.system(size: 15)).foregroundStyle(driverAmberText)
                Text("ملاحظة التوصيل").font(.gh(14, .semibold)).foregroundStyle(driverAmberText)
                Spacer()
                Text("تعديل").font(.gh(14, .medium)).foregroundStyle(GH.burgundy)
            }
            Text(note)
                .font(.gh(16))
                .foregroundStyle(GH.label)
                .multilineTextAlignment(.leading)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(Color(hex: 0xFFFFD43B).opacity(0.2)))
        .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(Color(hex: 0xFFFAB005).opacity(0.5), lineWidth: 1))
        .contentShape(Rectangle())
    }

    private var empty: some View {
        HStack(spacing: 8) {
            Image(systemName: "square.and.pencil").font(.system(size: 16)).foregroundStyle(GH.secondary)
            Text("أضف ملاحظة توصيل للمرة الجاية")
                .font(.gh(14.5))
                .foregroundStyle(GH.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, 14)
        .frame(height: 48)
        .background(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(GH.border, style: StrokeStyle(lineWidth: 1, dash: [5, 4])))
        .contentShape(Rectangle())
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
