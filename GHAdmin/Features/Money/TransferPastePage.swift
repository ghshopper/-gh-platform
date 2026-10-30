import SwiftUI
import UIKit
import Vision
import ImageIO

// تسجيل التحويلات: paste a bank SMS (or pick a screenshot), check what was
// read, pick the order and record the payment in one tap.

// MARK: - Store helpers

/// One order offered for a transfer, with why it was suggested.
struct TransferMatch: Identifiable {
    let order: Order
    let customerName: String
    /// The amount is exactly what's left on the order (or what's due now).
    let exact: Bool
    /// 0…1: how close the customer's name is to the sender's.
    let nameScore: Double
    let phoneMatch: Bool
    var id: String { order.id }

    var nameLevel: Int { nameScore >= 0.6 ? 2 : (nameScore >= 0.3 ? 1 : 0) }

    var reasons: [String] {
        var r: [String] = []
        if exact { r.append("نفس المبلغ") }
        if nameLevel == 2 { r.append("الاسم يطابق") } else if nameLevel == 1 { r.append("الاسم قريب") }
        if phoneMatch { r.append("نفس الرقم") }
        return r
    }
}

/// Transfers recorded since the app opened (amount + reference + order), so the same SMS isn't recorded twice.
@MainActor
enum TransferSessionLog {
    static var recorded: Set<String> = []

    static func key(orderId: String, amount: Double, ref: String?) -> String {
        "\(orderId)|\(String(format: "%.3f", amount))|\((ref ?? "").lowercased())"
    }
}

extension Store {
    /// Orders that still owe money (remaining > 0), newest first.
    var moneyOwingOrders: [Order] {
        orders.filter { $0.hasBalance }
            .sorted { ($0.createdAt ?? .distantPast) > ($1.createdAt ?? .distantPast) }
    }

    /// Owing orders ranked for a transfer: exact amount, then the sender's name, then the phone, then newest.
    func moneyRankTransfer(amount: Double?, sender: String?, phone: String?) -> [TransferMatch] {
        let senderName = sender?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let phone8 = phone.map { String(normalizeDigits($0).filter { $0.isNumber && $0.isASCII }.suffix(8)) } ?? ""
        let list: [TransferMatch] = moneyOwingOrders.map { o in
            let c = customer(o.customerId)
            let name = c?.name ?? "—"
            var exact = false
            if let a = amount, a > 0 {
                exact = abs(o.remaining - a) < 0.0005 || abs(o.dueNow - a) < 0.0005
            }
            var score = 0.0
            if !senderName.isEmpty {
                score = TransferNameMatch.score(sender: senderName, name: name)
                if let client = o.clientName, !client.isEmpty {
                    score = max(score, TransferNameMatch.score(sender: senderName, name: client))
                }
            }
            var phoneHit = false
            if phone8.count == 8, let p = c?.phone {
                let digits = normalizeDigits(p).filter { $0.isNumber && $0.isASCII }
                phoneHit = String(digits.suffix(8)) == phone8
            }
            return TransferMatch(order: o, customerName: name, exact: exact, nameScore: score, phoneMatch: phoneHit)
        }
        return list.sorted { a, b in
            if a.exact != b.exact { return a.exact }
            if a.nameLevel != b.nameLevel { return a.nameLevel > b.nameLevel }
            if a.phoneMatch != b.phoneMatch { return a.phoneMatch }
            if abs(a.nameScore - b.nameScore) > 0.001 { return a.nameScore > b.nameScore }
            return (a.order.createdAt ?? .distantPast) > (b.order.createdAt ?? .distantPast)
        }
    }

    /// Any order by customer name, invoice number or phone (owing orders first).
    func moneySearchOrders(_ query: String, limit: Int = 20) -> [Order] {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty else { return [] }
        let qLower = normalizeDigits(q).lowercased()
        let qDigits = qLower.filter { $0.isNumber && $0.isASCII }
        let qName = TransferNameMatch.tokens(q).joined(separator: " ")
        let hits = orders.filter { o in
            if o.invoiceNo.lowercased().contains(qLower) || (o.refNo ?? "").lowercased().contains(qLower) { return true }
            let c = customer(o.customerId)
            if !qName.isEmpty {
                let n = TransferNameMatch.tokens(c?.name ?? "").joined(separator: " ")
                if n.contains(qName) { return true }
                if let client = o.clientName, TransferNameMatch.tokens(client).joined(separator: " ").contains(qName) { return true }
            }
            if qDigits.count >= 3, let p = c?.phone, normalizeDigits(p).contains(qDigits) { return true }
            return false
        }
        return Array(hits.sorted { a, b in
            if a.hasBalance != b.hasBalance { return a.hasBalance }
            return (a.createdAt ?? .distantPast) > (b.createdAt ?? .distantPast)
        }.prefix(limit))
    }

    /// Records a bank transfer on an order: «تحويل بنكي», note «تحويل · المرسل · المرجع».
    func moneyRecordTransfer(orderId: String, amount: Double, sender: String?, ref: String?, paidOn: Date?) async throws {
        var parts = ["تحويل"]
        if let s = sender?.trimmingCharacters(in: .whitespacesAndNewlines), !s.isEmpty { parts.append(s) }
        if let r = ref?.trimmingCharacters(in: .whitespacesAndNewlines), !r.isEmpty { parts.append(r) }
        try await addPayment(orderId, amount: amount, method: "تحويل بنكي", paidOn: paidOn ?? Date(),
                             note: parts.joined(separator: " · "))
    }
}

// MARK: - On-device text reading (Vision)

/// Reads the text in a screenshot / photo on the phone (Arabic and English), line by line.
func transferRecognizeText(_ image: UIImage) async -> String {
    guard let cg = image.cgImage else { return "" }
    let orientation = transferOrientation(image.imageOrientation)
    return await Task.detached(priority: .userInitiated) { () -> String in
        func run(_ langs: [String]?) -> [VNRecognizedTextObservation]? {
            let request = VNRecognizeTextRequest()
            request.recognitionLevel = .accurate
            request.usesLanguageCorrection = true
            if let langs {
                let supported = (try? request.supportedRecognitionLanguages()) ?? []
                request.recognitionLanguages = langs.map { w in
                    supported.first { $0 == w || $0.hasPrefix(w + "-") } ?? w
                }
            }
            let handler = VNImageRequestHandler(cgImage: cg, orientation: orientation, options: [:])
            do { try handler.perform([request]) } catch { return nil }
            return request.results
        }
        // Arabic + English first; the default (Latin) recogniser when that gives nothing
        let first = run(["ar", "en"]) ?? []
        let obs = first.isEmpty ? (run(nil) ?? []) : first
        return transferJoinLines(obs)
    }.value
}

/// Puts the recognised pieces back into lines, top to bottom (right to left for Arabic lines).
private func transferJoinLines(_ obs: [VNRecognizedTextObservation]) -> String {
    struct Piece { let text: String; let box: CGRect }
    let pieces: [Piece] = obs.compactMap { o in
        guard let t = o.topCandidates(1).first?.string, !t.isEmpty else { return nil }
        return Piece(text: t, box: o.boundingBox)
    }
    // Vision's boxes start at the bottom-left: higher midY = higher on the screen
    let sorted = pieces.sorted { $0.box.midY > $1.box.midY }
    var lines: [[Piece]] = []
    for p in sorted {
        if let last = lines.last?.first, abs(last.box.midY - p.box.midY) < max(last.box.height, p.box.height) * 0.5 {
            lines[lines.count - 1].append(p)
        } else {
            lines.append([p])
        }
    }
    return lines.map { line in
        let arabic = line.contains { p in p.text.unicodeScalars.contains { (0x0600...0x06FF).contains($0.value) } }
        let ordered = line.sorted { arabic ? $0.box.minX > $1.box.minX : $0.box.minX < $1.box.minX }
        return ordered.map(\.text).joined(separator: " ")
    }.joined(separator: "\n")
}

private func transferOrientation(_ o: UIImage.Orientation) -> CGImagePropertyOrientation {
    switch o {
    case .up: return .up
    case .down: return .down
    case .left: return .left
    case .right: return .right
    case .upMirrored: return .upMirrored
    case .downMirrored: return .downMirrored
    case .leftMirrored: return .leftMirrored
    case .rightMirrored: return .rightMirrored
    @unknown default: return .up
    }
}

// MARK: - Page

fileprivate struct TransferDone {
    let orderId: String
    let amount: Double
    let customerName: String
    let invoiceNo: String
}

@MainActor
struct TransferPastePage: View {
    @ObservedObject private var store = Store.shared
    @StateObject private var picker = OrderPhotoPicker()

    @State private var text = ""
    @State private var amount = ""
    @State private var sender = ""
    @State private var ref = ""
    @State private var date: Date?
    @State private var parsed = BankTransferText()
    @State private var pickedId: String?
    /// The order was chosen by the page (not by a tap), so a new paste may change it.
    @State private var autoPicked = false
    @State private var query = ""
    @State private var reading = false
    @State private var saving = false
    @State private var done: TransferDone?

    init() {}

    var body: some View {
        Group {
            if let d = done {
                donePage(d)
            } else {
                formPage
            }
        }
        .orderPhotoPicker(picker)
        .onChange(of: text) { _, v in apply(BankTransferParser.parse(v)) }
        .onChange(of: amount) { _, _ in autoPick() }
        .onChange(of: sender) { _, _ in autoPick() }
    }

    // MARK: computed

    private var amountValue: Double? { BankTransferParser.amount(fromField: amount) }

    private var matches: [TransferMatch] {
        store.moneyRankTransfer(amount: amountValue, sender: sender, phone: parsed.phone)
    }

    private var pickedOrder: Order? { pickedId.flatMap { store.order($0) } }

    // MARK: form

    private var formPage: some View {
        let ranked = matches
        let top = Array(ranked.prefix(5))
        return GHPage("تسجيل التحويلات", onRefresh: { await store.refresh() }, bottom: {
            PrimaryButton(saveLabel, icon: "checkmark", busy: saving, action: saveAction)
        }) {
            messageSection
            if parsed.outgoing {
                Pad(top: 10) {
                    Text("الرسالة شكلها تحويل طالع منك، مب وارد. تأكد قبل لا تسجّل.")
                        .font(TS.sub).foregroundStyle(GH.amber)
                }
            }
            detailsSection
            if let o = pickedOrder {
                pickedSection(o)
            }
            suggestionsSection(top)
            searchSection
        }
    }

    private var messageSection: some View {
        GHSection("رسالة البنك", footer: "الصق رسالة التحويل أو اختر صورة الشاشة، والتطبيق يطلع المبلغ والاسم والمرجع.") {
            NotesRow(text: $text, placeholder: "مثلاً: OMR 25.500 credited to your A/C from FATMA SALIM…")
            HStack(spacing: 8) {
                ChipButton("الصق", icon: "doc.on.clipboard") { Task { await paste() } }
                ChipButton("صورة", icon: "photo") { Task { await pickPhoto() } }
                if !text.isEmpty {
                    ChipButton("مسح", icon: "xmark") { reset() }
                }
                Spacer(minLength: 0)
                if reading {
                    HStack(spacing: 6) {
                        ProgressView()
                        Text("أقرا الصورة…").font(TS.small).foregroundStyle(GH.secondary)
                    }
                }
            }
            .padding(.horizontal, 12).padding(.vertical, 10)
        }
    }

    private var detailsSection: some View {
        GHSection(parsed.bank.map { "التحويل · \($0)" } ?? "التحويل") {
            AmountRow("المبلغ", text: $amount)
            FieldRow("من", text: $sender, placeholder: "اسم المحوّل")
            PickerRow("التاريخ", value: dateStr(date ?? Date())) {
                Task { if let d = await pickDate(date ?? Date()) { date = d } }
            }
            FieldRow("المرجع", text: $ref, placeholder: "اختياري", ltr: true)
        }
    }

    private func pickedSection(_ o: Order) -> some View {
        let a = amountValue ?? 0
        let after = o.remaining - a
        let afterText: String
        if a <= 0 {
            afterText = "باقي عليها \(omr(o.remaining))"
        } else if after > 0.0005 {
            afterText = "بيبقى عليها \(omr(after))"
        } else if after < -0.0005 {
            afterText = "بيزيد \(omr(-after)) عن الباقي"
        } else {
            afterText = "بيتسكّر الطلب كامل"
        }
        let oid = o.id
        return GHSection("الطلب اللي بتسجّل عليه") {
            Tile(store.customerName(o), subtitle: "\(o.invoiceNo) · \(afterText)", value: omr(o.remaining),
                 valueColor: GH.burgundy, valueFont: TS.money,
                 action: { pushPage(OrderDetailPage(orderId: oid)) },
                 leading: {
                     Image(systemName: "checkmark.circle.fill").font(.system(size: 24)).foregroundStyle(GH.green)
                 })
        }
    }

    @ViewBuilder
    private func suggestionsSection(_ top: [TransferMatch]) -> some View {
        if store.moneyOwingOrders.isEmpty {
            GHSection("طلبات عليها فلوس") {
                Tile("ما في طلبات عليها فلوس", subtitle: "دوّر تحت على أي طلب ثاني", chevron: false)
            }
        } else {
            GHSection("يمكن لهذي الطلبات", footer: "مرتبة حسب المبلغ ثم اسم المحوّل ثم الرقم ثم الأحدث.") {
                ForEach(top) { m in matchRow(m) }
            }
        }
    }

    private func matchRow(_ m: TransferMatch) -> some View {
        let on = m.order.id == pickedId
        var sub = [m.order.invoiceNo, dateStr(m.order.createdAt)]
        sub.append(contentsOf: m.reasons)
        let id = m.order.id
        return Tile(m.customerName, subtitle: sub.joined(separator: " · "), value: omr(m.order.remaining),
                    valueColor: m.exact ? GH.green : GH.secondary, chevron: false,
                    action: { pick(id) },
                    leading: { checkCircle(on) })
    }

    private var searchSection: some View {
        let results = store.moneySearchOrders(query)
        return GHSection("دوّر على طلب ثاني") {
            FieldRow("بحث", text: $query, placeholder: "الاسم، رقم الفاتورة أو الهاتف")
            ForEach(results) { o in
                let on = o.id == pickedId
                let id = o.id
                Tile(store.customerName(o), subtitle: "\(o.invoiceNo) · \(dateStr(o.createdAt))",
                     value: o.hasBalance ? omr(o.remaining) : "مدفوع",
                     valueColor: o.hasBalance ? GH.secondary : GH.green, chevron: false,
                     action: { pick(id) },
                     leading: { checkCircle(on) })
            }
            if !query.trimmingCharacters(in: .whitespaces).isEmpty && results.isEmpty {
                Tile("ما لقيت طلب بهذا البحث", chevron: false)
            }
        }
    }

    private func checkCircle(_ on: Bool) -> some View {
        Image(systemName: on ? "checkmark.circle.fill" : "circle")
            .font(.system(size: 22))
            .foregroundStyle(on ? GH.burgundy : GH.separator)
    }

    private var canSave: Bool { !saving && pickedOrder != nil && (amountValue ?? 0) > 0 }

    private var saveAction: (() -> Void)? {
        guard canSave else { return nil }
        return { Task { await save() } }
    }

    private var saveLabel: String {
        if let a = amountValue, a > 0 { return "سجّل \(omr(a))" }
        return "سجّل التحويل"
    }

    // MARK: done

    private func donePage(_ d: TransferDone) -> some View {
        let o = store.order(d.orderId)
        var msg = "\(omr(d.amount)) على طلب \(d.customerName) · \(d.invoiceNo)"
        if let o {
            msg += o.hasBalance ? "\nباقي عليها \(omr(o.remaining))" : "\nالطلب مدفوع كامل"
        }
        let oid = d.orderId
        return GHPage("تسجيل التحويلات") {
            EmptyState(icon: "checkmark.seal.fill", title: "انسجل التحويل", message: msg) {
                VStack(spacing: 10) {
                    PrimaryButton("سجّل تحويل ثاني", icon: "plus") { reset() }
                    SecondaryButton("افتح الطلب", icon: "doc.text") { pushPage(OrderDetailPage(orderId: oid)) }
                }
                .frame(maxWidth: 320)
            }
        }
    }

    // MARK: actions

    private func apply(_ p: BankTransferText) {
        parsed = p
        if let a = p.amount { amount = amountText(a) }
        if let s = p.sender { sender = s }
        if let r = p.ref { ref = r }
        if let d = p.date { date = d }
        autoPick()
    }

    /// Picks the order by itself only when the match is clear.
    private func autoPick() {
        guard pickedId == nil || autoPicked else { return }
        let ranked = matches
        guard let first = ranked.first else { return }
        // as strong as the first one: then it's not clear which order it is
        let tie = ranked.dropFirst().first.map {
            $0.exact == first.exact && $0.nameLevel == first.nameLevel && $0.phoneMatch == first.phoneMatch
        } ?? false
        let strong = first.exact || (first.nameLevel == 2 && first.phoneMatch)
        let chosen: TransferMatch? = strong && !tie ? first : nil
        if let chosen {
            pickedId = chosen.order.id
            autoPicked = true
        } else if autoPicked {
            pickedId = nil
            autoPicked = false
        }
    }

    private func pick(_ id: String) {
        if pickedId == id {
            pickedId = nil
        } else {
            pickedId = id
        }
        autoPicked = false
    }

    private func paste() async {
        let pb = UIPasteboard.general
        if let s = pb.string, !s.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            text = s
        } else if let img = pb.image {
            await read(img)
        } else {
            toast("ما في نص منسوخ", error: true)
        }
    }

    private func pickPhoto() async {
        var camera = false
        if UIImagePickerController.isSourceTypeAvailable(.camera) {
            let c: Bool? = await pickAction(actions: [
                SheetAction("من الصور", false),
                SheetAction("صوّر بالكاميرا", true),
            ])
            guard let c else { return }
            camera = c
        }
        guard let img = await picker.pick(camera: camera) else { return }
        await read(img)
    }

    private func read(_ img: UIImage) async {
        reading = true
        let t = await transferRecognizeText(img)
        reading = false
        if t.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            toast("ما قدرت أقرا نص من الصورة", error: true)
            return
        }
        text = t
        if BankTransferParser.parse(t).amount == nil {
            toast("قريت الصورة بس ما لقيت المبلغ، اكتبه بنفسك", error: true)
        }
    }

    private func reset() {
        text = ""
        amount = ""
        sender = ""
        ref = ""
        date = nil
        parsed = BankTransferText()
        pickedId = nil
        autoPicked = false
        query = ""
        done = nil
    }

    private func save() async {
        guard let o = pickedOrder, let a = amountValue, a > 0 else { return }
        let cleanRef = ref.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanSender = sender.trimmingCharacters(in: .whitespacesAndNewlines)
        let key = TransferSessionLog.key(orderId: o.id, amount: a, ref: cleanRef)
        if TransferSessionLog.recorded.contains(key) {
            let again = await confirm("سجّلت هذا التحويل قبل شوي",
                                      message: "نفس المبلغ ونفس المرجع على نفس الطلب. تبي تسجّله مرة ثانية؟",
                                      ok: "سجّله مرة ثانية")
            if !again { return }
        } else if cleanRef.count >= 4, o.payments.contains(where: { ($0.note ?? "").contains(cleanRef) }) {
            let again = await confirm("هذا المرجع مسجّل على الطلب",
                                      message: "في دفعة على الطلب فيها نفس المرجع \(cleanRef). تبي تسجّله مرة ثانية؟",
                                      ok: "سجّله مرة ثانية")
            if !again { return }
        }
        if a > o.remaining + 0.0005 {
            let ok = await confirm("المبلغ أكثر من الباقي",
                                   message: "الباقي على الطلب \(omr(max(0, o.remaining))) والتحويل \(omr(a)).",
                                   ok: "سجّله كذا", destructive: false)
            if !ok { return }
        }
        saving = true
        let name = store.customerName(o)
        let invoice = o.invoiceNo
        let oid = o.id
        do {
            try await store.moneyRecordTransfer(orderId: oid, amount: a, sender: cleanSender, ref: cleanRef, paidOn: date)
            TransferSessionLog.recorded.insert(key)
            Haptic.success()
            saving = false
            done = TransferDone(orderId: oid, amount: a, customerName: name, invoiceNo: invoice)
        } catch {
            saving = false
            toastError(error)
        }
    }
}
