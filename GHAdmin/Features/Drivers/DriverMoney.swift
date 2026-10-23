import SwiftUI
import UIKit

// Port of lib/pages/driver_money.dart

fileprivate func moneyFixed3(_ v: Double) -> String { String(format: "%.3f", v) }

// MARK: - Models

/// A driver's money with us (from the server).
struct DriverAccount {
    let m: JSON

    init(_ m: JSON) { self.m = m }

    var rate: Double { jd(m["pay_per_delivery"]) }
    var deliveries: Int { ji(m["deliveries"]) }
    var monthDeliveries: Int { ji(m["month_deliveries"]) }
    var monthEarned: Double { jd(m["month_earned"]) }
    var collected: Double { jd(m["collected"]) }
    var handed: Double { jd(m["handed"]) }
    var cash: Double { jd(m["cash_with_driver"]) }
    var earned: Double { jd(m["earned"]) }
    var paid: Double { jd(m["paid"]) }
    var owed: Double { jd(m["owed_to_driver"]) }

    /// > 0: the driver hands this to us · < 0: we transfer it to him.
    var net: Double { jd(m["net"]) }

    var entries: [DriverEntry] { jlist(m["entries"]).map { DriverEntry($0) } }

    var recent: [PastDelivery] { jlist(m["recent"]).map { PastDelivery($0) } }
}

struct DriverEntry {
    let m: JSON

    init(_ m: JSON) { self.m = m }

    var id: String { jstr(m["id"]) }
    var isHandover: Bool { js(m["type"]) == "handover" }
    var amount: Double { jd(m["amount"]) }
    var note: String? {
        guard let n = js(m["note"]) else { return nil }
        return n.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : n
    }
    var date: Date? { jdate(m["on_date"]) }
}

struct PastDelivery {
    let m: JSON

    init(_ m: JSON) { self.m = m }

    var id: String { jstr(m["id"]) }
    var customer: String { jstr(m["customer_name"]) }
    var city: String? { js(m["customer_city"]) }
    var at: Date? { jdate(m["delivered_at"]) }
    var collected: Double { jd(m["collected"]) }
    var pay: Double { jd(m["pay"]) }
    var invoiceNo: String {
        let n = ji(m["order_no"])
        if let ref = js(m["ref_no"]), !ref.isEmpty { return ref }
        return invoiceNumber(n, jdate(m["created_at"]))
    }
}

// MARK: - Shared pieces

/// The big money card: who owes whom.
struct DriverBalanceCard: View {
    let a: DriverAccount
    /// Wording for the driver ("you") or for the admin ("he").
    var forDriver: Bool = true

    init(_ a: DriverAccount, forDriver: Bool = true) {
        self.a = a
        self.forDriver = forDriver
    }

    private var settled: Bool { abs(a.net) < 0.0005 }

    private var title: String {
        if settled { return "الحساب صافي ✓" }
        if a.net > 0 { return forDriver ? "سلّم لنا" : "يسلّم لنا" }
        return forDriver ? "بنحوّل لك" : "نحوّل له"
    }

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            cheetah
            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: 22, style: .continuous).fill(GH.brandGradient))
        .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
        .shadow(color: GH.burgundyDeep.opacity(0.27), radius: 11, x: 0, y: 10)
        .padding(.horizontal, 16)
        .padding(.top, 8)
    }

    @ViewBuilder
    private var cheetah: some View {
        if let img = GHImage.named("story_cheetah_light") {
            Image(uiImage: img)
                .resizable()
                .scaledToFit()
                .frame(width: 170)
                .opacity(0.2)
                .padding(.trailing, -24)
                .padding(.bottom, 8)
        }
    }

    private var content: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(title)
                .font(.gh(14, .medium))
                .foregroundStyle(GH.goldLight)
            Text(settled ? omr(0) : omr(abs(a.net)))
                .font(.gh(30, .bold).monospacedDigit())
                .foregroundStyle(Color.white)
                .padding(.top, 4)
            miniRow.padding(.top, 14)
        }
        .padding(18)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var miniRow: some View {
        HStack(spacing: 0) {
            BalanceMini(label: forDriver ? "كاش عندك لنا" : "كاش عنده لنا",
                        value: omr(a.cash),
                        hint: forDriver ? "حصّلته من العملاء ولسا ما سلّمته" : "حصّله من العملاء ولسا ما سلّمه")
            Rectangle()
                .fill(Color(hex: 0x33FFFFFF))
                .frame(width: 1, height: 44)
                .padding(.horizontal, 12)
            BalanceMini(label: forDriver ? "لك عندنا" : "له عندنا",
                        value: omr(a.owed),
                        hint: a.rate > 0 ? "\(omr(a.rate)) لكل توصيلة" : "أجرة التوصيل")
        }
    }
}

fileprivate struct BalanceMini: View {
    let label: String
    let value: String
    let hint: String

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(label)
                .font(.gh(12.5))
                .foregroundStyle(GH.goldLight)
            Text(value)
                .font(.gh(18, .bold).monospacedDigit())
                .foregroundStyle(Color.white)
                .lineLimit(1)
                .minimumScaleFactor(0.5)
                .padding(.top, 2)
            Text(hint)
                .font(.gh(11))
                .foregroundStyle(Color(hex: 0xB3FFFFFF))
                .lineLimit(1)
                .truncationMode(.tail)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct DriverEntryTile: View {
    let e: DriverEntry
    var forDriver: Bool = true
    var onDelete: (() -> Void)?

    init(_ e: DriverEntry, forDriver: Bool = true, onDelete: (() -> Void)? = nil) {
        self.e = e
        self.forDriver = forDriver
        self.onDelete = onDelete
    }

    private var title: String {
        if e.isHandover { return forDriver ? "سلّمت لنا كاش" : "استلمنا منه كاش" }
        return forDriver ? "حوّلنا لك" : "حوّلنا له"
    }

    private var subtitle: String {
        var parts = [dateStr(e.date)]
        if let n = e.note { parts.append(n) }
        return parts.joined(separator: " · ")
    }

    private var tint: Color { e.isHandover ? GH.green : GH.blue }

    var body: some View {
        Tile(title,
             subtitle: subtitle,
             value: omr(e.amount),
             valueColor: tint,
             valueFont: .gh(15, .semibold),
             chevron: false,
             action: onDelete,
             leading: {
                 IconBox(e.isHandover ? "arrow.up.circle.fill" : "arrow.down.circle.fill", color: tint)
             })
    }
}

struct PastDeliveryTile: View {
    let d: PastDelivery
    var onTap: (() -> Void)?

    init(_ d: PastDelivery, onTap: (() -> Void)? = nil) {
        self.d = d
        self.onTap = onTap
    }

    private var subtitle: String {
        var parts = [dateStr(d.at)]
        if let c = d.city, !c.isEmpty { parts.append(c) }
        if d.collected > 0 { parts.append("حصّل \(omr(d.collected))") }
        return parts.joined(separator: " · ")
    }

    var body: some View {
        Tile(d.customer,
             subtitle: subtitle,
             value: d.pay > 0 ? "+\(omr(d.pay))" : nil,
             valueColor: GH.green,
             valueFont: .gh(14, .semibold),
             chevron: onTap != nil,
             action: onTap,
             leading: { Avatar(d.customer, size: 34) })
    }
}

// MARK: - Admin: a driver's money

/// On the driver's page in the admin app: balance, pay per delivery, record
/// cash he handed over or money we transferred.
struct AdminDriverMoney: View {
    let driverId: String
    let name: String
    /// Ready account (screenshots); nothing is loaded then.
    let initial: DriverAccount?

    @State private var a: DriverAccount?
    @State private var loadError: String?
    @State private var started = false

    init(driverId: String, name: String, initial: DriverAccount? = nil) {
        self.driverId = driverId
        self.name = name
        self.initial = initial
        _a = State(initialValue: initial)
    }

    var body: some View {
        Group {
            if let a {
                loaded(a)
            } else if let loadError {
                GHSection {
                    Tile("ما قدرنا نجيب الحساب", subtitle: loadError, action: { Task { await load() } })
                }
            } else {
                LoadingView()
            }
        }
        .task {
            if started { return }
            started = true
            if a == nil { await load() }
        }
    }

    private func loaded(_ a: DriverAccount) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            DriverBalanceCard(a, forDriver: false)
            buttons
            accountSection(a)
            entriesSection(a)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var buttons: some View {
        HStack(spacing: 10) {
            SecondaryButton("استلمت منه", icon: "arrow.up.circle") { Task { await entry("handover") } }
            SecondaryButton("حوّلت له", icon: "arrow.down.circle") { Task { await entry("payout") } }
        }
        .padding(.horizontal, 16)
        .padding(.top, 12)
    }

    private func accountSection(_ a: DriverAccount) -> some View {
        GHSection("الحساب") {
            Tile("أجرة التوصيلة",
                 value: a.rate > 0 ? omr(a.rate) : "حدّدها",
                 action: { Task { await rate() } },
                 leading: { IconBox("dollarsign", color: GH.gold) })
            KV("توصيلات هالشهر", "\(a.monthDeliveries)")
            KV("أجرته هالشهر", omr(a.monthEarned))
            KV("كل اللي حصّله من العملاء", omr(a.collected))
            KV("سلّمه لنا", omr(a.handed))
            KV("كل أجرته", omr(a.earned))
            KV("حوّلنا له", omr(a.paid))
        }
    }

    @ViewBuilder
    private func entriesSection(_ a: DriverAccount) -> some View {
        let list = a.entries
        if !list.isEmpty {
            GHSection("التسليم والتحويلات", footer: "اضغط على قيد عشان تحذفه.") {
                ForEach(Array(list.enumerated()), id: \.offset) { _, e in
                    DriverEntryTile(e, forDriver: false, onDelete: { Task { await delete(e) } })
                }
            }
        }
    }

    // MARK: actions

    private func load() async {
        do {
            let res = try await Api.shared.get("/ps/drivers/\(driverId)/account")
            if let m = res as? JSON {
                a = DriverAccount(m)
            }
        } catch {
            loadError = errorText(error)
        }
    }

    private func entry(_ type: String) async {
        let isHandover = type == "handover"
        var initialAmount = ""
        if let cur = a {
            if isHandover {
                initialAmount = cur.cash > 0 ? moneyFixed3(cur.cash) : ""
            } else {
                initialAmount = cur.owed > 0 ? moneyFixed3(cur.owed) : ""
            }
        }
        let title = isHandover ? "استلمت منه كاش" : "حوّلت له"
        let footer = isHandover ? "الكاش اللي حصّله من العملاء وسلّمه لك." : "أجرة التوصيل اللي حوّلتها له."
        let start = initialAmount
        let res: DriverMoneyFormResult? = await Nav.shared.presentForResult { done in
            DriverMoneyForm(title: title, footer: footer, amountLabel: "المبلغ", withNote: true,
                            initialAmount: start, done: done)
        }
        guard let res else { return }
        guard let v = parseAmount(res.amount), v > 0 else {
            toast("اكتب المبلغ", error: true)
            return
        }
        var payload: JSON = ["type": type, "amount": v]
        let note = res.note.trimmingCharacters(in: .whitespacesAndNewlines)
        if !note.isEmpty { payload["note"] = note }
        do {
            let r = try await Api.shared.post("/ps/drivers/\(driverId)/entries", payload)
            if let m = r as? JSON { a = DriverAccount(m) }
            toast("انحفظ ✓")
        } catch {
            toastError(error)
        }
    }

    private func rate() async {
        let current = a?.rate ?? 0
        let start = current > 0 ? moneyFixed3(current) : ""
        let res: DriverMoneyFormResult? = await Nav.shared.presentForResult { done in
            DriverMoneyForm(title: "أجرة التوصيلة",
                            footer: "تنحسب له مع كل توصيلة يسلّمها من الحين. التوصيلات القديمة تبقى على أجرتها.",
                            amountLabel: "لكل توصيلة", withNote: false,
                            initialAmount: start, done: done)
        }
        guard let res else { return }
        let v = parseAmount(res.amount) ?? 0
        do {
            try await Api.shared.put("/ps/drivers/\(driverId)", ["pay_per_delivery": v])
            await load()
        } catch {
            toastError(error)
        }
    }

    private func delete(_ e: DriverEntry) async {
        let ok = await confirm("حذف هذا القيد؟", message: "\(omr(e.amount)) · \(dateStr(e.date))")
        if !ok { return }
        do {
            let r = try await Api.shared.delete("/ps/drivers/\(driverId)/entries/\(e.id)")
            if let m = r as? JSON { a = DriverAccount(m) }
        } catch {
            toastError(error)
        }
    }
}

// MARK: - Small forms (amount + optional note)

fileprivate struct DriverMoneyFormResult {
    let amount: String
    let note: String
}

fileprivate struct DriverMoneyForm: View {
    let title: String
    let footer: String
    let amountLabel: String
    let withNote: Bool
    let done: ((DriverMoneyFormResult?) -> Void)?

    @State private var amount: String
    @State private var note = ""
    @Environment(\.dismiss) private var dismiss

    init(title: String, footer: String, amountLabel: String, withNote: Bool, initialAmount: String,
         done: ((DriverMoneyFormResult?) -> Void)? = nil) {
        self.title = title
        self.footer = footer
        self.amountLabel = amountLabel
        self.withNote = withNote
        self.done = done
        _amount = State(initialValue: initialAmount)
    }

    var body: some View {
        GHPage(title,
               trailing: { NavButton("حفظ", bold: true) { close(DriverMoneyFormResult(amount: amount, note: note)) } },
               leading: { NavButton("إلغاء") { close(nil) } }) {
            GHSection(footer: footer) {
                AmountRow(amountLabel, text: $amount, autofocus: true)
                if withNote {
                    FieldRow("ملاحظة", text: $note, placeholder: "اختياري")
                }
            }
        }
    }

    private func close(_ value: DriverMoneyFormResult?) {
        if let done { done(value) } else { dismiss() }
    }
}
