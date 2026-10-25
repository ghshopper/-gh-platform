import SwiftUI

// Internal investment (full admins only): the shared pool, its safety,
// the investors and the pieces the pool bought. Same data and rules as the
// dashboard's «الاستثمار الداخلي» page (GET /admin/investments …).

// MARK: - Helpers

fileprivate let invMonthNames = [
    "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
    "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
]

fileprivate func invMonthName(_ ym: String?) -> String {
    guard let ym else { return "" }
    let parts = ym.split(separator: "-")
    guard parts.count == 2, let y = Int(parts[0]), let m = Int(parts[1]), m >= 1, m <= 12 else { return ym }
    return "\(invMonthNames[m - 1]) \(y)"
}

fileprivate func invMonthKey(_ d: Date) -> String {
    var cal = Calendar(identifier: .gregorian)
    cal.timeZone = TimeZone(identifier: "Asia/Muscat") ?? TimeZone.current
    let c = cal.dateComponents([.year, .month], from: d)
    return String(format: "%04d-%02d", c.year ?? 2026, c.month ?? 1)
}

fileprivate func invAddMonths(_ ym: String, _ n: Int) -> String {
    let parts = ym.split(separator: "-")
    guard parts.count == 2, let y = Int(parts[0]), let m = Int(parts[1]) else { return ym }
    let total = y * 12 + (m - 1) + n
    return String(format: "%04d-%02d", total / 12, total % 12 + 1)
}

fileprivate func invPct(_ v: Double) -> String {
    let r = (v * 100).rounded() / 100
    if r == r.rounded() { return "\(Int(r))%" }
    return "\(r)%"
}

fileprivate func invDay(_ v: Any?) -> String {
    guard let d = jdate(v) else { return "—" }
    return dateStr(d)
}

fileprivate func invSafetyColor(_ status: String) -> Color {
    switch status {
    case "danger": return GH.red
    case "watch": return GH.amber
    default: return GH.green
    }
}

fileprivate func invPieceStatus(_ s: String) -> (String, Color) {
    switch s {
    case "sold": return ("انباعت", GH.green)
    case "returned": return ("رجعت للمورد", GH.secondary)
    case "written_off": return ("خسارة", GH.red)
    default: return ("بالمخزن", GH.blue)
    }
}

fileprivate func invProfitStatus(_ s: String) -> (String, Color) {
    switch s {
    case "paid": return ("انصرف له", GH.secondary)
    case "reinvested": return ("انضاف لمبلغه", GH.green)
    default: return ("ينتظر قرارك", GH.amber)
    }
}

/// A JSON row with a stable id for ForEach.
fileprivate struct InvRow: Identifiable {
    let id: String
    let raw: JSON
}

fileprivate func invRows(_ list: [JSON]) -> [InvRow] {
    var out: [InvRow] = []
    for (i, r) in list.enumerated() {
        let key = js(r["id"]) ?? "row\(i)"
        out.append(InvRow(id: key, raw: r))
    }
    return out
}

fileprivate func invLoadError(_ e: Error) -> String {
    if let a = e as? ApiError, a.status == 403 { return "هالصفحة للمدير العام ومدير النظام بس" }
    return errorText(e)
}

fileprivate struct InvLoading: View {
    let error: String?
    var body: some View {
        if let error {
            Text(error).font(TS.sub).foregroundStyle(GH.secondary).multilineTextAlignment(.center)
                .frame(maxWidth: .infinity).padding(40)
        } else {
            ProgressView().frame(maxWidth: .infinity).padding(40)
        }
    }
}

// MARK: - Investments

@MainActor
struct InvestmentsPage: View {
    @State private var data: JSON?
    @State private var loadError: String?

    init() {}

    var body: some View {
        GHPage("الاستثمار الداخلي", onRefresh: { await load() }, trailing: {
            NavIcon("plus") { Task { await addInvestor() } }
        }) {
            if let d = data {
                content(d)
            } else {
                InvLoading(error: loadError)
            }
        }
        .onAppear { Task { await load() } }
    }

    @ViewBuilder private func content(_ d: JSON) -> some View {
        if let pool = d["pool"] as? JSON {
            InvPoolSection(pool: pool, onMove: { Task { await poolMove() } })
            InvSafetySection(safety: pool["safety"] as? JSON ?? [:])
            piecesSection(pool)
        }
        totalsSection(d["totals"] as? JSON ?? [:])
        investorsSection(jlist(d["investors"]))
        Text("الربح ينحسب على المبلغ اللي عنده أول كل شهر. الفلوس اللي تجي في نص الشهر تبدأ تربح من الشهر اللي بعده (إلا لو جات يوم ١).")
            .font(TS.small).foregroundStyle(GH.secondary)
            .padding(.horizontal, 24).padding(.top, 10)
    }

    private func piecesSection(_ pool: JSON) -> some View {
        let n = ji(pool["pieces_count"])
        return GHSection {
            Tile("القطع", subtitle: "البضاعة اللي انشرت من فلوس الصندوق", value: n == 0 ? nil : "\(n)",
                 action: { pushPage(PiecesPage()) },
                 leading: { IconBox("shippingbox.fill", color: GH.gold) })
        }
    }

    private func totalsSection(_ t: JSON) -> some View {
        GHSection("المستثمرين") {
            KV("مجموع مبالغهم", omr(jd(t["capital"])))
            KV("أرباح تنتظر قرارك", omr(jd(t["pending"])), color: jd(t["pending"]) > 0 ? GH.amber : nil)
            KV("أرباح هالشهر (تستحق آخر الشهر)", omr(jd(t["this_month"])))
            KV("انصرف لهم لين الحين", omr(jd(t["paid_out"])))
        }
    }

    @ViewBuilder private func investorsSection(_ list: [JSON]) -> some View {
        if list.isEmpty {
            EmptyState(icon: "person.2", title: "ما فيه مستثمرين للحين", message: "اضغط + وسجّل المبلغ وتاريخ ما استلمته.")
        } else {
            GHSection {
                ForEach(invRows(list)) { row in
                    investorTile(row.raw)
                }
            }
        }
    }

    private func investorTile(_ i: JSON) -> some View {
        let id = ji(i["id"])
        let active = jstr(i["status"]) == "active"
        let pending = jd(i["pending"])
        let sub = "\(invPct(jd(i["monthly_pct"]))) بالشهر · مبلغه \(omr(jd(i["capital"])))" + (active ? "" : " · منتهي")
        return Tile(jstr(i["name"]), subtitle: sub,
                    value: pending > 0 ? "ينتظر \(plainOmr(pending))" : nil,
                    valueColor: GH.amber, valueFont: .gh(13, .semibold),
                    titleColor: active ? GH.label : GH.secondary,
                    action: { pushPage(InvestorDetailPage(investorId: id)) },
                    leading: { Avatar(jstr(i["name"]), size: 36) })
    }

    private func load() async {
        do {
            let res = try await Api.shared.get("/admin/investments") as? JSON ?? [:]
            data = res
            loadError = nil
        } catch {
            loadError = invLoadError(error)
            if data != nil { toastError(error) }
        }
    }

    private func addInvestor() async {
        let saved: Bool? = await Nav.shared.presentForResult { done in InvInvestorForm(done: done) }
        if saved == true { await load() }
    }

    private func poolMove() async {
        let saved: Bool? = await Nav.shared.presentForResult { done in InvPoolMoveForm(done: done) }
        if saved == true { await load() }
    }
}

fileprivate struct InvPoolSection: View {
    let pool: JSON
    let onMove: () -> Void

    private var cash: Double { jd(pool["cash_available"]) }

    var body: some View {
        GHSection("صندوق الاستثمار",
                  footer: "الكاش = مبالغ المستثمرين − اللي انضاف لمبالغهم من أرباحهم + الربح المحقق − تكلفة اللي بالمخزن − الأرباح اللي انصرفت ± حركات المحل",
                  trailing: { HeaderButton("حركة", icon: "arrow.left.arrow.right") { onMove() } }) {
            KV("الكاش المتوفر", omr(cash), strong: true, color: cash < 0 ? GH.red : nil)
            KV("بعد الأرباح اللي تنتظر", omr(jd(pool["cash_after_pending"])))
            KV("مبالغ المستثمرين", omr(jd(pool["capital"])))
            KV("بالمخزن (بالتكلفة) · \(ji(pool["in_stock_qty"])) قطعة", omr(jd(pool["in_stock_cost"])))
            KV("الربح المحقق", omr(jd(pool["realized_profit"])))
            KV("ربح هالشهر", omr(jd(pool["profit_this_month"])))
            KV("ربح الشهر الماضي", omr(jd(pool["profit_last_month"])))
            KV("المخزن بسعر البيع", omr(jd(pool["stock_value_at_price"])))
            KV("ربح متوقع بالمخزن", omr(jd(pool["expected_profit_in_stock"])), color: GH.green)
        }
    }
}

fileprivate struct InvSafetySection: View {
    let safety: JSON

    private var status: String { js(safety["status"]) ?? "safe" }
    private var color: Color { invSafetyColor(status) }

    private var profitLabel: String {
        let used = (safety["months_used"] as? [Any])?.count ?? 0
        if jstr(safety["basis"]) == "this_month" { return "ربح البضاعة هالشهر لين الحين" }
        return used == 1 ? "ربح البضاعة (آخر شهر)" : "متوسط ربح البضاعة (آخر \(used) أشهر)"
    }

    private var ratioText: String {
        guard let r = jdn(safety["ratio"]) else { return "—" }
        return "\(r)×"
    }

    private var coverText: String {
        guard let c = jdn(safety["months_of_cover"]) else { return "—" }
        return "\(c) شهر"
    }

    private var header: some View {
        HStack(spacing: 12) {
            Image(systemName: status == "safe" ? "checkmark.shield.fill" : "exclamationmark.shield.fill")
                .font(.system(size: 26)).foregroundStyle(color)
            VStack(alignment: .leading, spacing: 2) {
                Text(jstr(safety["label"])).font(.gh(20, .bold)).foregroundStyle(color)
                Text(jstr(safety["message"])).font(TS.sub).foregroundStyle(GH.secondary)
                    .multilineTextAlignment(.leading)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 16).padding(.vertical, 12)
        .background(color.opacity(0.08))
    }

    var body: some View {
        GHSection("الأمان", footer: "آمن: الربح ١٫٥ ضعف أو أكثر من أرباح المستثمرين · انتبه: بين ١ و ١٫٥ · خطر: أقل. يوم ١ كل شهر يوصلك تنبيه لو الحالة مب آمن.") {
            header
            KV("أرباح المستثمرين بالشهر", omr(jd(safety["monthly_obligation"])))
            KV(profitLabel, omr(jd(safety["profit_used"])))
            KV("التغطية", ratioText, strong: true, color: color)
            KV("هالشهر لين الحين", omr(jd(safety["this_month_profit"])))
            KV("الكاش يكفي", coverText)
        }
    }
}

// MARK: - Investor

@MainActor
struct InvestorDetailPage: View {
    let investorId: Int
    @State private var data: JSON?
    @State private var loadError: String?
    @State private var busy = false

    init(investorId: Int) { self.investorId = investorId }

    private var investor: JSON { data?["investor"] as? JSON ?? [:] }
    private var entries: [JSON] { jlist(data?["entries"]) }
    private var pending: [JSON] {
        entries.filter { jstr($0["type"]) == "profit" && jstr($0["status"]) == "pending" }
            .sorted { jstr($0["month"]) < jstr($1["month"]) }
    }

    var body: some View {
        GHPage(jstr(investor["name"]).isEmpty ? "المستثمر" : jstr(investor["name"]), onRefresh: { await load() }, largeTitle: false, trailing: {
            if busy {
                ProgressView()
            } else if data != nil {
                NavIcon("ellipsis.circle") { Task { await more() } }
            }
        }) {
            if data != nil {
                numbersSection
                actionsSection
                ratesSection
                pendingSection
                entriesSection
            } else {
                InvLoading(error: loadError)
            }
        }
        .onAppear { Task { await load() } }
    }

    private var subtitle: String {
        var s = "\(invPct(jd(investor["monthly_pct"]))) بالشهر"
        let next = jd(investor["next_pct"])
        if abs(next - jd(investor["monthly_pct"])) > 0.0005 { s += " · من الشهر الجاي \(invPct(next))" }
        if let p = js(investor["phone"]) { s += " · \(p)" }
        if jstr(investor["status"]) != "active" { s += " · منتهي" }
        return s
    }

    private var numbersSection: some View {
        GHSection(subtitle) {
            KV("مبلغه الحين", omr(jd(investor["capital"])), strong: true)
            KV("ربح هالشهر (يستحق آخر الشهر)", omr(jd(investor["this_month"])))
            KV("ربح الشهر الجاي", omr(jd(investor["next_month"])))
            KV("انصرف له لين الحين", omr(jd(investor["paid_out"])))
            KV("انضاف لمبلغه من أرباحه", omr(jd(investor["reinvested"])))
            if jd(investor["pending"]) > 0 {
                KV("ينتظر قرارك", omr(jd(investor["pending"])), color: GH.amber)
            }
        }
    }

    private var actionsSection: some View {
        GHSection {
            Tile("إيداع", action: { Task { await move("deposit") } },
                 leading: { IconBox("plus.circle.fill", color: GH.green) })
            Tile("سحب من مبلغه", action: { Task { await move("withdraw") } },
                 leading: { IconBox("minus.circle.fill", color: GH.red) })
            Tile("تغيير النسبة", subtitle: "من شهر معيّن، بدون ما تتغيّر الأشهر اللي قبله",
                 action: { Task { await changeRate() } },
                 leading: { IconBox("percent", color: GH.blue) })
        }
    }

    @ViewBuilder private var ratesSection: some View {
        let rates = jlist(investor["rates"])
        if !rates.isEmpty {
            GHSection("تغييرات النسبة", footer: "اضغط على نسبة جاية عشان تشيلها.") {
                KV("قبل أول تغيير", invPct(jd(investor["base_pct"])))
                ForEach(invRows(rates)) { row in
                    rateTile(row.raw)
                }
            }
        }
    }

    private func rateTile(_ r: JSON) -> some View {
        let from = jstr(r["from_month"])
        let note = js(r["note"])
        return Tile("من \(invMonthName(from))", subtitle: note, value: invPct(jd(r["pct"])),
                    valueColor: GH.label, valueFont: .gh(16, .semibold), chevron: false,
                    action: { Task { await deleteRate(r) } })
    }

    @ViewBuilder private var pendingSection: some View {
        if !pending.isEmpty {
            GHSection("أرباح تنتظر قرارك", footer: "اضغط على الشهر: صرفته له، أو أضفه لمبلغه (يبدأ يربح من الشهر اللي بعده).") {
                ForEach(invRows(pending)) { row in
                    pendingTile(row.raw)
                }
            }
        }
    }

    private func pendingTile(_ e: JSON) -> some View {
        let sub = "\(plainOmr(jd(e["base"]))) × \(invPct(jd(e["pct"])))"
        return Tile(invMonthName(js(e["month"])), subtitle: sub, value: omr(jd(e["amount"])),
                    valueColor: GH.amber, valueFont: .gh(16, .semibold),
                    action: { Task { await settle(e) } })
    }

    @ViewBuilder private var entriesSection: some View {
        if !entries.isEmpty {
            GHSection("كشف الحساب") {
                ForEach(invRows(entries)) { row in
                    entryTile(row.raw)
                }
            }
        }
    }

    private func entryTitle(_ e: JSON) -> String {
        switch jstr(e["type"]) {
        case "deposit": return "إيداع"
        case "withdraw": return "سحب من المبلغ"
        case "reinvest": return "ربح انضاف للمبلغ"
        default: return "ربح \(invMonthName(js(e["month"])))"
        }
    }

    private func entryTile(_ e: JSON) -> some View {
        let type = jstr(e["type"])
        let amount = jd(e["amount"])
        let valueText = (type == "withdraw" ? "−" : "") + plainOmr(amount)
        var sub = invDay(e["effective_date"])
        if type == "profit" {
            sub += " · " + invProfitStatus(jstr(e["status"])).0
        } else if let n = js(e["note"]) {
            sub += " · " + n
        }
        let color: Color = type == "withdraw" ? GH.red : (type == "profit" ? invProfitStatus(jstr(e["status"])).1 : GH.green)
        let canAct = type == "deposit" || type == "withdraw" || (type == "profit" && jstr(e["status"]) != "pending")
        var act: (() -> Void)? = nil
        if canAct { act = { Task { await entryAction(e) } } }
        return Tile(entryTitle(e), subtitle: sub, value: valueText, valueColor: color, valueFont: .gh(15, .semibold),
                    chevron: false, action: act)
    }

    // MARK: actions

    private func load() async {
        do {
            let res = try await Api.shared.get("/admin/investments/\(investorId)") as? JSON ?? [:]
            data = res
            loadError = nil
        } catch {
            loadError = invLoadError(error)
            if data != nil { toastError(error) }
        }
    }

    private func move(_ type: String) async {
        let id = investorId
        let saved: Bool? = await Nav.shared.presentForResult { done in InvMoveForm(investorId: id, type: type, done: done) }
        if saved == true { await load() }
    }

    private func changeRate() async {
        let id = investorId
        let current = jd(investor["next_pct"])
        let minMonth = js(data?["can_change_rate_from"])
        let saved: Bool? = await Nav.shared.presentForResult { done in
            InvRateForm(investorId: id, current: current, minMonth: minMonth, done: done)
        }
        if saved == true { await load() }
    }

    private func deleteRate(_ r: JSON) async {
        let from = jstr(r["from_month"])
        if let minM = js(data?["can_change_rate_from"]), from < minM {
            toast("هالنسبة انصرفت عليها أرباح", error: true)
            return
        }
        let ok = await confirm("نشيل نسبة \(invPct(jd(r["pct"]))) من \(invMonthName(from))؟", ok: "شيل")
        if !ok { return }
        busy = true
        let done = await attempt { try await Api.shared.delete("/admin/investments/\(investorId)/rate/\(ji(r["id"]))") }
        busy = false
        if done { toast("انشالت"); await load() }
    }

    private func settle(_ e: JSON) async {
        let choice: String? = await pickAction(title: "ربح \(invMonthName(js(e["month"])))", message: omr(jd(e["amount"])), actions: [
            SheetAction("صرفته له", "pay"),
            SheetAction("أضفه لمبلغه", "reinvest"),
        ])
        guard let choice else { return }
        await post("/admin/investments/\(investorId)/entries/\(ji(e["id"]))/settle", ["action": choice],
                   ok: choice == "pay" ? "انسجّل إنه انصرف" : "انضاف لمبلغه")
    }

    private func entryAction(_ e: JSON) async {
        let type = jstr(e["type"])
        if type == "profit" {
            let ok = await confirm("نرجّع ربح \(invMonthName(js(e["month"]))) ينتظر قرارك؟", ok: "تراجع", destructive: false)
            if ok {
                await post("/admin/investments/\(investorId)/entries/\(ji(e["id"]))/settle", ["action": "undo"], ok: "رجع ينتظر قرارك")
            }
            return
        }
        let ok = await confirm("نشيل هالحركة؟", message: "\(entryTitle(e)) \(omr(jd(e["amount"])))", ok: "حذف")
        if !ok { return }
        busy = true
        let done = await attempt { try await Api.shared.delete("/admin/investments/\(investorId)/entries/\(ji(e["id"]))") }
        busy = false
        if done { toast("انشالت"); await load() }
    }

    private func post(_ path: String, _ payload: JSON, ok: String) async {
        busy = true
        let done = await attempt { try await Api.shared.post(path, payload) }
        busy = false
        if done { toast(ok); await load() }
    }

    private func more() async {
        let active = jstr(investor["status"]) == "active"
        let choice: String? = await pickAction(title: jstr(investor["name"]), actions: [
            SheetAction("تعديل الاسم والجوال", "edit"),
            SheetAction(active ? "إنهاء استثماره" : "إرجاعه", "status", destructive: active),
        ])
        guard let choice else { return }
        if choice == "edit" {
            guard let name = await promptText("الاسم", initial: jstr(investor["name"])) else { return }
            let phone = await promptText("رقم الجوال", initial: jstr(investor["phone"]), keyboard: .phonePad)
            var payload: JSON = ["name": name.trimmingCharacters(in: .whitespaces)]
            if let phone { payload["phone"] = phone.isEmpty ? NSNull() : phone }
            busy = true
            let done = await attempt { try await Api.shared.put("/admin/investments/\(investorId)", payload) }
            busy = false
            if done { toast("انحفظ"); await load() }
            return
        }
        if active {
            let ok = await confirm("ننهي استثماره؟", message: "ما بتنحسب له أرباح جديدة. (سجّل سحب مبلغه قبل)", ok: "إنهاء")
            if !ok { return }
        }
        busy = true
        let done = await attempt { try await Api.shared.put("/admin/investments/\(investorId)", ["status": active ? "closed" : "active"]) }
        busy = false
        if done { await load() }
    }
}

// MARK: - Pieces

@MainActor
struct PiecesPage: View {
    @State private var pieces: [JSON]?
    @State private var loadError: String?
    @State private var filter = ""
    @State private var busy = false

    init() {}

    private var shown: [JSON] {
        let all = pieces ?? []
        if filter.isEmpty { return all }
        return all.filter { jstr($0["status"]) == filter }
    }

    var body: some View {
        GHPage("القطع", onRefresh: { await load() }, trailing: {
            if busy {
                ProgressView()
            } else {
                NavIcon("plus") { Task { await add() } }
            }
        }) {
            filters
            if pieces == nil {
                InvLoading(error: loadError)
            } else if shown.isEmpty {
                EmptyState(icon: "shippingbox", title: "ما فيه قطع",
                           message: "اضغط + واربط بضاعة التسليم الفوري اللي انشرت من فلوس المستثمرين.")
            } else {
                list
            }
            Text("القطع المربوطة بالمتجر تنحسب مبيعاتها لحالها من طلبات المتجر (من يوم الشراء، الأقدم ينباع أول). لو الطلب انلغى أو رجع، البيعة تنشال. اللي تنباع برا طلبات المتجر سجّلها «بيعة يدوية».")
                .font(TS.small).foregroundStyle(GH.secondary)
                .padding(.horizontal, 24).padding(.top, 10)
        }
        .onAppear { Task { await load() } }
    }

    private var filters: some View {
        ChipBar {
            ChipButton("الكل", selected: filter.isEmpty) { filter = "" }
            ChipButton("بالمخزن", selected: filter == "in_stock") { filter = "in_stock" }
            ChipButton("انباعت", selected: filter == "sold") { filter = "sold" }
            ChipButton("رجعت", selected: filter == "returned") { filter = "returned" }
            ChipButton("خسارة", selected: filter == "written_off") { filter = "written_off" }
        }
        .padding(.top, 8)
    }

    private var list: some View {
        GHSection {
            ForEach(invRows(shown)) { row in
                pieceTile(row.raw)
            }
        }
    }

    private func pieceTitle(_ p: JSON) -> String {
        let name = jstr(p["name"])
        if let b = js(p["brand"]) { return "\(b) · \(name)" }
        return name
    }

    private func pieceTile(_ p: JSON) -> some View {
        let st = invPieceStatus(jstr(p["status"]))
        let qty = ji(p["qty"])
        let sold = ji(p["sold_qty"])
        let profit = jd(p["profit"])
        var sub = "\(sold)/\(qty) انباع · تكلفة \(plainOmr(jd(p["unit_cost"])))"
        if sold > 0 { sub += " · ربح \(plainOmr(profit))" }
        if let exp = jdn(p["expected_profit"]), ji(p["left"]) > 0 { sub += " · متوقع \(plainOmr(exp))" }
        sub += "\nاشتريت \(invDay(p["bought_on"]))" + (js(p["product_id"]) == nil ? " · مب بالمتجر" : "")
        return Tile(pieceTitle(p), subtitle: sub, chevron: false,
                    action: { Task { await actions(p) } },
                    trailing: { Badge(st.0, color: st.1) })
    }

    private func load() async {
        do {
            let res = try await Api.shared.get("/admin/investments/pieces") as? JSON ?? [:]
            pieces = jlist(res["pieces"])
            loadError = nil
        } catch {
            loadError = invLoadError(error)
            if pieces != nil { toastError(error) }
        }
    }

    private func add() async {
        let choice: String? = await pickAction(title: "قطعة جديدة للصندوق", actions: [
            SheetAction("ربط من المتجر", "link"),
            SheetAction("قطعة مب بالمتجر", "own"),
        ])
        guard let choice else { return }
        let saved: Bool?
        if choice == "link" {
            saved = await Nav.shared.presentForResult { done in InvLinkPage(done: done) }
        } else {
            saved = await Nav.shared.presentForResult { done in InvPieceForm(done: done) }
        }
        if saved == true { await load() }
    }

    private func actions(_ p: JSON) async {
        let status = jstr(p["status"])
        var acts: [SheetAction<String>] = []
        if status == "in_stock" {
            acts.append(SheetAction("بيعة يدوية", "sell"))
            acts.append(SheetAction("رجعت للمورد", "returned"))
            acts.append(SheetAction("خسارة (اشطب الباقي)", "written_off", destructive: true))
        }
        if status == "returned" || status == "written_off" {
            acts.append(SheetAction("رجعها للمخزن", "in_stock"))
        }
        for s in jlist(p["manual_sales"]) {
            acts.append(SheetAction("شيل بيعة \(ji(s["qty"])) بـ \(plainOmr(jd(s["amount"]))) (\(invDay(s["date"])))", "sale:\(ji(s["id"]))", destructive: true))
        }
        acts.append(SheetAction("شيلها من الصندوق", "delete", destructive: true))
        let pid = ji(p["id"])
        let msg = "انباع \(ji(p["sold_qty"]))/\(ji(p["qty"])) بـ \(omr(jd(p["sold_amount"])))"
        guard let choice: String = await pickAction(title: pieceTitle(p), message: msg, actions: acts) else { return }

        if choice == "sell" {
            let title = pieceTitle(p)
            let left = ji(p["left"])
            let price = jdn(p["price"])
            let saved: Bool? = await Nav.shared.presentForResult { done in
                InvSellForm(pieceId: pid, name: title, left: left, price: price, done: done)
            }
            if saved == true { await load() }
        } else if choice == "delete" {
            if await confirm("نشيل هالقطعة من الصندوق؟", message: "المنتج نفسه ما يتأثر", ok: "شيل") {
                await run { try await Api.shared.delete("/admin/investments/pieces/\(pid)") }
            }
        } else if choice.hasPrefix("sale:") {
            let sid = String(choice.dropFirst(5))
            await run { try await Api.shared.delete("/admin/investments/pieces/\(pid)/sales/\(sid)") }
        } else {
            await run { try await Api.shared.put("/admin/investments/pieces/\(pid)", ["status": choice, "closed_on": dayString(Date())]) }
        }
    }

    private func run(_ action: @escaping () async throws -> Void) async {
        busy = true
        let done = await attempt { try await action() }
        busy = false
        if done { toast("تم"); await load() }
    }
}

// MARK: - Forms

@MainActor
fileprivate struct InvInvestorForm: View {
    var done: ((Bool?) -> Void)? = nil
    @State private var name = ""
    @State private var phone = ""
    @State private var pct = "10"
    @State private var amount = ""
    @State private var date = Date()
    @State private var notes = ""
    @State private var saving = false
    @Environment(\.dismiss) private var dismiss

    init(done: ((Bool?) -> Void)? = nil) { self.done = done }

    var body: some View {
        GHPage("مستثمر جديد", trailing: {
            if saving { ProgressView() } else { NavButton("حفظ", bold: true) { Task { await save() } } }
        }, leading: {
            NavButton("إلغاء") { close(nil) }
        }) {
            GHSection {
                FieldRow("الاسم", text: $name)
                FieldRow("الجوال", text: $phone, keyboard: .phone, ltr: true)
                FieldRow("الربح الشهري", text: $pct, keyboard: .decimal, suffix: "%")
            }
            GHSection("أول مبلغ") {
                AmountRow("المبلغ", text: $amount)
                PickerRow("تاريخ الاستلام", value: dateStr(date)) {
                    Task { if let d = await pickDate(date) { date = d } }
                }
            }
            GHSection("ملاحظات") { NotesRow(text: $notes) }
        }
    }

    private func close(_ v: Bool?) { if let done { done(v) } else { dismiss() } }

    private func save() async {
        let n = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !n.isEmpty, let p = parseAmount(pct) else { toast("اكتب الاسم والنسبة", error: true); return }
        var payload: JSON = ["name": n, "monthly_pct": p, "date": dayString(date)]
        if !phone.isEmpty { payload["phone"] = normalizeDigits(phone) }
        if !notes.isEmpty { payload["notes"] = notes }
        if let a = parseAmount(amount), a > 0 { payload["amount"] = a }
        saving = true
        let ok = await attempt { try await Api.shared.post("/admin/investments", payload) }
        saving = false
        if ok { toast("انحفظ"); close(true) }
    }
}

@MainActor
fileprivate struct InvMoveForm: View {
    let investorId: Int
    let type: String
    var done: ((Bool?) -> Void)? = nil
    @State private var amount = ""
    @State private var date = Date()
    @State private var note = ""
    @State private var saving = false
    @Environment(\.dismiss) private var dismiss

    init(investorId: Int, type: String, done: ((Bool?) -> Void)? = nil) {
        self.investorId = investorId
        self.type = type
        self.done = done
    }

    var body: some View {
        GHPage(type == "deposit" ? "إيداع" : "سحب من مبلغه", trailing: {
            if saving { ProgressView() } else { NavButton("حفظ", bold: true) { Task { await save() } } }
        }, leading: {
            NavButton("إلغاء") { close(nil) }
        }) {
            GHSection(footer: type == "deposit"
                      ? "يبدأ يربح من أول الشهر الجاي (أو هالشهر لو التاريخ يوم ١)."
                      : "ينقص من مبلغه من هالتاريخ، والشهر اللي بعده ينحسب على الباقي.") {
                AmountRow("المبلغ", text: $amount, autofocus: true)
                PickerRow("التاريخ", value: dateStr(date)) {
                    Task { if let d = await pickDate(date) { date = d } }
                }
                FieldRow("ملاحظة", text: $note, placeholder: "مثلاً: تحويل بنكي")
            }
        }
    }

    private func close(_ v: Bool?) { if let done { done(v) } else { dismiss() } }

    private func save() async {
        guard let a = parseAmount(amount), a > 0 else { toast("اكتب المبلغ", error: true); return }
        var payload: JSON = ["type": type, "amount": a, "date": dayString(date)]
        if !note.isEmpty { payload["note"] = note }
        saving = true
        let ok = await attempt { try await Api.shared.post("/admin/investments/\(investorId)/entries", payload) }
        saving = false
        if ok { toast("انسجّل"); close(true) }
    }
}

@MainActor
fileprivate struct InvRateForm: View {
    let investorId: Int
    let current: Double
    let minMonth: String?
    var done: ((Bool?) -> Void)? = nil
    @State private var pct = ""
    @State private var month = ""
    @State private var note = ""
    @State private var saving = false
    @Environment(\.dismiss) private var dismiss

    init(investorId: Int, current: Double, minMonth: String?, done: ((Bool?) -> Void)? = nil) {
        self.investorId = investorId
        self.current = current
        self.minMonth = minMonth
        self.done = done
        let now = invMonthKey(Date())
        let start = (minMonth ?? now) > now ? (minMonth ?? now) : now
        _pct = State(initialValue: invPct(current).replacingOccurrences(of: "%", with: ""))
        _month = State(initialValue: start)
    }

    private var footer: String {
        var s = "النسبة الجديدة تطبّق من هالشهر وطالع. الأشهر اللي قبله تبقى على نسبتها."
        if let minMonth { s += " أقدم شهر تقدر تختاره \(invMonthName(minMonth)) (اللي قبله انصرف ربحه أو انضاف)." }
        return s
    }

    var body: some View {
        GHPage("تغيير النسبة", trailing: {
            if saving { ProgressView() } else { NavButton("حفظ", bold: true) { Task { await save() } } }
        }, leading: {
            NavButton("إلغاء") { close(nil) }
        }) {
            GHSection(footer: footer) {
                FieldRow("النسبة الجديدة", text: $pct, keyboard: .decimal, suffix: "%", autofocus: true)
                PickerRow("من شهر", value: invMonthName(month)) { Task { await pickMonth() } }
                FieldRow("ملاحظة", text: $note, placeholder: "مثلاً: اتفاق جديد")
            }
        }
    }

    private func close(_ v: Bool?) { if let done { done(v) } else { dismiss() } }

    private func pickMonth() async {
        let now = invMonthKey(Date())
        var first = minMonth ?? now
        if invAddMonths(now, -12) > first { first = invAddMonths(now, -12) }
        let last = invAddMonths(now, 12)
        var options: [SheetAction<String>] = []
        var m = first
        var guardCount = 0
        while m <= last && guardCount < 30 {
            options.append(SheetAction(invMonthName(m) + (m == now ? " (هالشهر)" : ""), m))
            m = invAddMonths(m, 1)
            guardCount += 1
        }
        if let picked: String = await pickAction(title: "من شهر", actions: options) { month = picked }
    }

    private func save() async {
        guard let p = parseAmount(pct), p >= 0, p <= 100 else { toast("اكتب النسبة", error: true); return }
        var payload: JSON = ["pct": p, "from_month": month]
        if !note.isEmpty { payload["note"] = note }
        saving = true
        let ok = await attempt { try await Api.shared.post("/admin/investments/\(investorId)/rate", payload) }
        saving = false
        if ok { toast("انحفظت النسبة"); close(true) }
    }
}

@MainActor
fileprivate struct InvPoolMoveForm: View {
    var done: ((Bool?) -> Void)? = nil
    @State private var type = "withdraw"
    @State private var amount = ""
    @State private var date = Date()
    @State private var note = ""
    @State private var saving = false
    @Environment(\.dismiss) private var dismiss

    init(done: ((Bool?) -> Void)? = nil) { self.done = done }

    var body: some View {
        GHPage("حركة على الصندوق", trailing: {
            if saving { ProgressView() } else { NavButton("حفظ", bold: true) { Task { await save() } } }
        }, leading: {
            NavButton("إلغاء") { close(nil) }
        }) {
            GHSection(footer: "للفلوس اللي تطلع أو تدخل الصندوق مب عن طريق المستثمرين أو القطع، عشان الكاش يطابق الواقع. التصحيح يقبل سالب.") {
                Segments(value: $type, options: [("withdraw", "سحب المحل"), ("deposit", "إضافة"), ("adjust", "تصحيح")])
                FieldRow("المبلغ", text: $amount, keyboard: .decimal, suffix: "ر.ع")
                PickerRow("التاريخ", value: dateStr(date)) {
                    Task { if let d = await pickDate(date) { date = d } }
                }
                FieldRow("ملاحظة", text: $note, placeholder: "مثلاً: ربح المحل")
            }
        }
    }

    private func close(_ v: Bool?) { if let done { done(v) } else { dismiss() } }

    private func save() async {
        let raw = amount.trimmingCharacters(in: .whitespaces)
        let negative = raw.hasPrefix("-") || raw.hasPrefix("−")
        let digits = negative ? String(raw.dropFirst()) : raw
        guard let a = parseAmount(digits), a > 0 else { toast("اكتب المبلغ", error: true); return }
        let signed: Double = (negative && type == "adjust") ? -a : a
        var payload: JSON = ["type": type, "amount": signed, "date": dayString(date)]
        if !note.isEmpty { payload["note"] = note }
        saving = true
        let ok = await attempt { try await Api.shared.post("/admin/investments/pool-moves", payload) }
        saving = false
        if ok { toast("انسجّل"); close(true) }
    }
}

@MainActor
fileprivate struct InvPieceForm: View {
    var done: ((Bool?) -> Void)? = nil
    @State private var brand = ""
    @State private var name = ""
    @State private var qty = "1"
    @State private var cost = ""
    @State private var date = Date()
    @State private var note = ""
    @State private var saving = false
    @Environment(\.dismiss) private var dismiss

    init(done: ((Bool?) -> Void)? = nil) { self.done = done }

    var body: some View {
        GHPage("قطعة مب بالمتجر", trailing: {
            if saving { ProgressView() } else { NavButton("حفظ", bold: true) { Task { await save() } } }
        }, leading: {
            NavButton("إلغاء") { close(nil) }
        }) {
            GHSection(footer: "قطعة انشرت من فلوس الصندوق وما انضافت للمتجر. لما تنباع سجّلها «بيعة يدوية».") {
                FieldRow("البراند", text: $brand)
                FieldRow("اسم القطعة", text: $name)
                FieldRow("العدد", text: $qty, keyboard: .number)
                AmountRow("تكلفة القطعة", text: $cost)
                PickerRow("تاريخ الشراء", value: dateStr(date)) {
                    Task { if let d = await pickDate(date) { date = d } }
                }
                FieldRow("ملاحظة", text: $note)
            }
        }
    }

    private func close(_ v: Bool?) { if let done { done(v) } else { dismiss() } }

    private func save() async {
        let n = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !n.isEmpty, let c = parseAmount(cost) else { toast("اكتب الاسم والتكلفة", error: true); return }
        let q = Int(normalizeDigits(qty)) ?? 1
        var payload: JSON = ["name": n, "qty": max(1, q), "unit_cost": c, "bought_on": dayString(date)]
        if !brand.isEmpty { payload["brand"] = brand }
        if !note.isEmpty { payload["note"] = note }
        saving = true
        let ok = await attempt { try await Api.shared.post("/admin/investments/pieces", payload) }
        saving = false
        if ok { toast("انضافت"); close(true) }
    }
}

@MainActor
fileprivate struct InvSellForm: View {
    let pieceId: Int
    let name: String
    let left: Int
    var done: ((Bool?) -> Void)? = nil
    @State private var qty = "1"
    @State private var amount = ""
    @State private var date = Date()
    @State private var note = ""
    @State private var saving = false
    @Environment(\.dismiss) private var dismiss

    init(pieceId: Int, name: String, left: Int, price: Double?, done: ((Bool?) -> Void)? = nil) {
        self.pieceId = pieceId
        self.name = name
        self.left = left
        self.done = done
        _amount = State(initialValue: price.map { plainOmr($0).replacingOccurrences(of: ",", with: "") } ?? "")
    }

    var body: some View {
        GHPage("بيعة يدوية", trailing: {
            if saving { ProgressView() } else { NavButton("حفظ", bold: true) { Task { await save() } } }
        }, leading: {
            NavButton("إلغاء") { close(nil) }
        }) {
            GHSection(name, footer: "باقي منها \(left). المبلغ = كامل اللي انباعت فيه (لكل العدد).") {
                FieldRow("العدد", text: $qty, keyboard: .number)
                AmountRow("المبلغ", text: $amount)
                PickerRow("تاريخ البيع", value: dateStr(date)) {
                    Task { if let d = await pickDate(date) { date = d } }
                }
                FieldRow("ملاحظة", text: $note, placeholder: "مثلاً: طلب رقم …")
            }
        }
    }

    private func close(_ v: Bool?) { if let done { done(v) } else { dismiss() } }

    private func save() async {
        let q = Int(normalizeDigits(qty)) ?? 1
        guard q >= 1, q <= max(1, left) else { toast("باقي منها \(left) بس", error: true); return }
        guard let a = parseAmount(amount), a >= 0 else { toast("اكتب المبلغ", error: true); return }
        var payload: JSON = ["qty": q, "amount": a, "sold_on": dayString(date)]
        if !note.isEmpty { payload["note"] = note }
        saving = true
        let ok = await attempt { try await Api.shared.post("/admin/investments/pieces/\(pieceId)/sell", payload) }
        saving = false
        if ok { toast("انسجّلت البيعة"); close(true) }
    }
}

/// One product ticked to link: how many and what one cost the pool.
fileprivate struct InvPick {
    var qty: Int
    var cost: Double
}

/// Instant-delivery products in stock that are not in the pool yet: tick and link.
@MainActor
fileprivate struct InvLinkPage: View {
    var done: ((Bool?) -> Void)? = nil
    @State private var products: [JSON]?
    @State private var loadError: String?
    @State private var picked: [Int: InvPick] = [:]
    @State private var query = ""
    @State private var date = Date()
    @State private var saving = false
    @Environment(\.dismiss) private var dismiss

    init(done: ((Bool?) -> Void)? = nil) { self.done = done }

    private var shown: [JSON] {
        let all = products ?? []
        let q = query.trimmingCharacters(in: .whitespaces).lowercased()
        if q.isEmpty { return all }
        return all.filter { p in
            let hay = "\(jstr(p["brand"])) \(jstr(p["name"])) \(jstr(p["name_ar"]))".lowercased()
            return hay.contains(q)
        }
    }

    var body: some View {
        GHPage("ربط من المتجر", largeTitle: false, trailing: {
            if saving {
                ProgressView()
            } else {
                NavButton(picked.isEmpty ? "اربط" : "اربط \(picked.count)", bold: true) { Task { await save() } }
            }
        }, leading: {
            NavButton("إلغاء") { close(nil) }
        }) {
            GHSection(footer: "اضغط على المنتج عشان تختاره. التكلفة تنعبى من سعر التكلفة في المنتج، واضغط مرة ثانية عشان تغيّرها أو تغيّر العدد.") {
                FieldRow("بحث", text: $query, placeholder: "البراند أو الاسم")
                PickerRow("تاريخ الشراء", value: dateStr(date)) {
                    Task { if let d = await pickDate(date) { date = d } }
                }
            }
            if products == nil {
                InvLoading(error: loadError)
            } else if shown.isEmpty {
                EmptyState(icon: "checkmark.circle", title: "كل بضاعة التسليم الفوري مربوطة")
            } else {
                GHSection {
                    ForEach(invRows(shown)) { row in
                        productTile(row.raw)
                    }
                }
            }
        }
        .task { if products == nil { await load() } }
    }

    private func productTile(_ p: JSON) -> some View {
        let id = ji(p["id"])
        let pick = picked[id]
        let costText = jdn(p["cost_price"]).map { plainOmr($0) } ?? "—"
        var sub = "السعر \(plainOmr(jd(p["price"]))) · التكلفة \(costText) · بالمخزن \(ji(p["stock"]))"
        if let pick { sub += "\nللصندوق: \(pick.qty) × \(plainOmr(pick.cost))" }
        let title = js(p["brand"]).map { "\($0) · \(jstr(p["name"]))" } ?? jstr(p["name"])
        return Tile(title, subtitle: sub, chevron: false,
                    action: { Task { await tap(p) } },
                    leading: {
                        Image(systemName: pick == nil ? "circle" : "checkmark.circle.fill")
                            .font(.system(size: 22)).foregroundStyle(pick == nil ? GH.tertiary : GH.green)
                    })
    }

    private func close(_ v: Bool?) { if let done { done(v) } else { dismiss() } }

    private func load() async {
        do {
            let res = try await Api.shared.get("/admin/investments/candidates") as? JSON ?? [:]
            products = jlist(res["products"])
            loadError = nil
        } catch {
            loadError = invLoadError(error)
        }
    }

    private func askCost(_ initial: Double?) async -> Double? {
        let start = initial.map { plainOmr($0).replacingOccurrences(of: ",", with: "") } ?? ""
        guard let t = await promptText("تكلفة القطعة", message: "كم دفع الصندوق في القطعة الوحدة (ر.ع)", initial: start, keyboard: .decimalPad) else { return nil }
        return parseAmount(t)
    }

    private func tap(_ p: JSON) async {
        let id = ji(p["id"])
        if let cur = picked[id] {
            let choice: String? = await pickAction(title: jstr(p["name"]), actions: [
                SheetAction("غيّر التكلفة", "cost"),
                SheetAction("غيّر العدد", "qty"),
                SheetAction("شيلها", "remove", destructive: true),
            ])
            guard let choice else { return }
            if choice == "remove" {
                picked[id] = nil
            } else if choice == "cost" {
                if let c = await askCost(cur.cost) { picked[id] = InvPick(qty: cur.qty, cost: c) }
            } else {
                if let t = await promptText("العدد", initial: "\(cur.qty)", keyboard: .numberPad), let q = Int(normalizeDigits(t)), q > 0 {
                    picked[id] = InvPick(qty: q, cost: cur.cost)
                }
            }
            return
        }
        Haptic.select()
        let stock = max(1, ji(p["stock"]))
        if let c = jdn(p["cost_price"]) {
            picked[id] = InvPick(qty: stock, cost: c)
        } else if let c = await askCost(nil) {
            picked[id] = InvPick(qty: stock, cost: c)
        }
    }

    private func save() async {
        if picked.isEmpty { toast("اختر منتج وحد على الأقل", error: true); return }
        var items: [JSON] = []
        for (id, v) in picked {
            items.append(["product_id": id, "qty": v.qty, "unit_cost": v.cost])
        }
        let payload: JSON = ["bought_on": dayString(date), "items": items]
        saving = true
        var added = 0
        let ok = await attempt {
            let res = try await Api.shared.post("/admin/investments/pieces/bulk", payload) as? JSON ?? [:]
            added = ji(res["added"])
        }
        saving = false
        if ok { toast("انربطت \(added) بالصندوق"); close(true) }
    }
}
