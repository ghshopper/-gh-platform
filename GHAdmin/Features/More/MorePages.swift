import SwiftUI

// Port of lib/pages/more_page.dart

fileprivate struct YearMonth {
    let year: Int
    let month: Int
}

fileprivate let monthNames = [
    "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
    "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
]

// MARK: - More

@MainActor
struct MorePage: View {
    @ObservedObject private var store = Store.shared
    @State private var faceId = AppLock.isEnabled
    @State private var faceIdAvailable = false

    init() {}

    var body: some View {
        GHPage("المزيد") {
            storeSection
            mainSection
            settingsSection
            logoutSection
            Text("GH Shopper · 1.1").font(TS.small).foregroundStyle(GH.secondary)
                .frame(maxWidth: .infinity).padding(.top, 24)
        }
        .onAppear {
            faceId = AppLock.isEnabled
            faceIdAvailable = AppLock.isAvailable
        }
    }

    private var storeSection: some View {
        GHSection("المتجر") {
            Tile("المنتجات", subtitle: "الأسعار، الخصم، الكمية، الظهور في المتجر",
                 action: { pushPage(ProductsPage()) },
                 leading: { IconBox("bag.fill", color: GH.burgundy) })
            Tile("ستوري المنتجات", subtitle: "صورة إنستقرام جاهزة: المنتج والسعر بتصميم GH",
                 action: { pushPage(StoryPickPage()) },
                 leading: { IconBox("camera.on.rectangle.fill", color: GH.pink) })
        }
    }

    private var openRequests: Int { store.requests.filter { $0.isOpen }.count }

    private var mainSection: some View {
        GHSection {
            Tile("الملخص والأرباح",
                 action: { pushPage(SummaryPage()) },
                 leading: { IconBox("chart.pie.fill", color: GH.burgundy) })
            Tile("طلبات القطع", value: openRequests == 0 ? nil : "\(openRequests)",
                 action: { pushPage(RequestsPage()) },
                 leading: { IconBox("sparkles", color: GH.burgundy) })
            Tile("فواتير الشراء",
                 action: { pushPage(PurchaseInvoicesPage()) },
                 leading: { IconBox("bag.fill", color: GH.gold) })
            Tile("المناديب", value: store.drivers.isEmpty ? nil : "\(store.drivers.count)",
                 action: { pushPage(DriversPage()) },
                 leading: { IconBox("car.fill", color: GH.blue) })
            Tile("تقرير Excel شهري",
                 action: { Task { await export() } },
                 leading: { IconBox("tablecells.fill", color: GH.green) })
        }
    }

    private var etaSubtitle: String {
        let eta = store.settings.eta
        let dubai = eta["dubai"]?.label ?? ""
        let europe = eta["europe"]?.label ?? ""
        return "دبي \(dubai) · أوروبا \(europe)"
    }

    private var ratesSubtitle: String {
        Rates.shared.isLive ? "محدّثة \(dateStr(Rates.shared.updatedAt))" : "تقريبية"
    }

    private var ratesValue: String {
        "1 € = \(Rates.shared.rateText("EUR")) · 1 د.إ = \(Rates.shared.rateText("AED"))"
    }

    private var faceIdBinding: Binding<Bool> {
        Binding(get: { faceId }, set: { v in Task { await toggleFaceId(v) } })
    }

    private var settingsSection: some View {
        GHSection {
            Tile("مدة التوصيل", subtitle: etaSubtitle,
                 action: { pushPage(DeliveryTimesPage()) },
                 leading: { IconBox("clock.fill", color: GH.amber) })
            Tile("شحن الخليج", subtitle: "السعودية، الإمارات، الكويت، قطر، البحرين",
                 action: { pushPage(GulfShippingPage()) },
                 leading: { IconBox("globe", color: GH.burgundy) })
            Tile("بيانات الشركة", subtitle: "تطلع في الفاتورة",
                 action: { pushPage(SettingsPage()) },
                 leading: { IconBox("building.2.fill", color: Color(hex: 0xFF5856D6)) })
            Tile("نقل البيانات القديمة", subtitle: "مرة وحدة بعد التحديث",
                 action: { pushPage(ImportPage()) },
                 leading: { IconBox("arrow.down.doc.fill", color: GH.teal) })
            if faceIdAvailable {
                SwitchRow("قفل بالـ Face ID", isOn: faceIdBinding)
            }
            Tile("أسعار الصرف", subtitle: ratesSubtitle, value: ratesValue,
                 valueColor: GH.secondary, valueFont: .gh(13), chevron: false,
                 leading: { IconBox("arrow.2.circlepath", color: Color(hex: 0xFF007AFF)) })
        }
    }

    private var logoutSection: some View {
        GHSection(footer: Api.shared.session?.name ?? "") {
            Tile("تسجيل خروج", titleFont: .gh(16), titleColor: GH.red, chevron: false,
                 action: { Task { await logout() } })
        }
    }

    private func logout() async {
        if await confirm("تسجيل خروج؟", ok: "خروج", destructive: true) {
            Api.shared.logout()
            Store.shared.clear()
        }
    }

    private func toggleFaceId(_ v: Bool) async {
        if v {
            let ok = await AppLock.unlock()
            if !ok { return }
        }
        AppLock.isEnabled = v
        faceId = v
    }

    private func export() async {
        let cal = Calendar(identifier: .gregorian)
        let now = Date()
        var months: [YearMonth] = []
        for k in 0..<6 {
            let d = cal.date(byAdding: .month, value: -k, to: now) ?? now
            let c = cal.dateComponents([.year, .month], from: d)
            months.append(YearMonth(year: c.year ?? 2026, month: c.month ?? 1))
        }
        let actions = months.map { ym in
            SheetAction("\(monthNames[ym.month - 1]) \(ym.year)", ym)
        }
        let m: YearMonth? = await actionSheet(title: "تقرير Excel", message: "اختر الشهر", actions: actions)
        guard let m else { return }
        Report.shareMonth(year: m.year, month: m.month)
    }
}

// MARK: - Summary

fileprivate enum Period: Hashable { case month, lastMonth, year, all }

fileprivate struct NamedAmount: Identifiable {
    let name: String
    let value: Double
    var id: String { name }
}

/// Everything the summary shows for one period.
fileprivate struct SummaryNumbers {
    var orderCount = 0
    var itemCount = 0
    var costedCount = 0
    var sales = 0.0
    var delivery = 0.0
    var collected = 0.0
    var cost = 0.0
    var discounts = 0.0
    var itemProfit = 0.0
    var spent = 0.0
    var net = 0.0
    var topExpenses: [NamedAmount] = []
    var topBrands: [NamedAmount] = []
    // current work (not tied to the period)
    var owed = 0.0
    var held = 0.0
    var taxFreeText = "—"

    @MainActor
    init(period: Period) {
        let store = Store.shared
        let orders = store.orders.filter { summaryInDate($0.createdAt, period) }
        orderCount = orders.count
        sales = orders.reduce(0) { $0 + $1.itemsTotal }
        delivery = orders.reduce(0) { $0 + $1.deliveryFee }
        collected = orders.reduce(0) { $0 + $1.paid }
        let items = orders.flatMap { $0.activeItems }
        itemCount = items.count
        let costed = items.filter { $0.costOmr != nil }
        costedCount = costed.count
        cost = costed.reduce(0) { $0 + ($1.costOmr ?? 0) }
        let costedSales = costed.reduce(0) { $0 + $1.price }
        discounts = orders.reduce(0) { $0 + $1.discount }
        itemProfit = costedSales - cost - discounts

        let expenses = store.expenses.filter { summaryInDate($0.spentOn, period) }
        spent = expenses.reduce(0) { $0 + $1.omr }
        net = itemProfit + delivery - spent
        var byTitle: [String: Double] = [:]
        for e in expenses { byTitle[e.title, default: 0] += e.omr }
        topExpenses = byTitle.map { NamedAmount(name: $0.key, value: $0.value) }.sorted { $0.value > $1.value }

        var brands: [String: Double] = [:]
        for o in orders {
            for i in o.activeItems { brands[i.brand ?? "أخرى", default: 0] += i.price }
        }
        topBrands = brands.map { NamedAmount(name: $0.key, value: $0.value) }.sorted { $0.value > $1.value }

        owed = store.orders.reduce(0) { $0 + ($1.remaining > 0 ? $1.remaining : 0) }
        held = store.orders.reduce(0) { $0 + ($1.customerBalance > 0 ? $1.customerBalance : 0) }
        var tfOrder: [String] = []
        var taxFree: [String: Double] = [:]
        for o in store.orders {
            for (c, v) in o.taxFreePending {
                if taxFree[c] == nil { tfOrder.append(c) }
                taxFree[c, default: 0] += v
            }
        }
        if !tfOrder.isEmpty {
            taxFreeText = tfOrder.map { money(taxFree[$0] ?? 0, $0) }.joined(separator: " + ")
        }
    }
}

fileprivate func summaryInDate(_ d: Date?, _ period: Period) -> Bool {
    guard let d else { return period == .all }
    let cal = Calendar(identifier: .gregorian)
    let now = Date()
    let c = cal.dateComponents([.year, .month], from: d)
    let n = cal.dateComponents([.year, .month], from: now)
    switch period {
    case .month:
        return c.year == n.year && c.month == n.month
    case .lastMonth:
        let lmDate = cal.date(byAdding: .month, value: -1, to: now) ?? now
        let lm = cal.dateComponents([.year, .month], from: lmDate)
        return c.year == lm.year && c.month == lm.month
    case .year:
        return c.year == n.year
    case .all:
        return true
    }
}

@MainActor
struct SummaryPage: View {
    @ObservedObject private var store = Store.shared
    @State private var period: Period = .month

    init() {}

    var body: some View {
        let n = SummaryNumbers(period: period)
        return GHPage("الملخص والأرباح", trailing: {
            NavIcon("plus.circle.fill") { presentForm(ExpenseFormPage()) }
        }) {
            Pad(h: 6, top: 4) {
                Segments(value: $period, options: [
                    (Period.month, "هذا الشهر"),
                    (Period.lastMonth, "الماضي"),
                    (Period.year, "السنة"),
                    (Period.all, "الكل"),
                ])
            }
            SummaryStatGrid(n: n)
            SummaryProfitSection(n: n)
            SummaryExpensesSection(n: n)
            SummaryWorkSection(n: n)
            if !n.topBrands.isEmpty {
                GHSection("أكثر البراندات مبيعاً") {
                    ForEach(Array(n.topBrands.prefix(6))) { e in
                        KV(e.name, omr(e.value))
                    }
                }
            }
        }
    }
}

fileprivate struct SummaryStatGrid: View {
    let n: SummaryNumbers

    var body: some View {
        VStack(spacing: 10) {
            HStack(spacing: 10) {
                StatCard(label: "صافي الربح", value: omr(n.net), icon: "chart.bar.fill", hero: true)
                StatCard(label: "المبيعات", value: omr(n.sales), icon: "bag.fill", color: GH.blue)
            }
            HStack(spacing: 10) {
                StatCard(label: "المصاريف", value: omr(n.spent), icon: "arrow.down.circle.fill", color: GH.red,
                         action: { pushPage(ExpensesPage()) })
                StatCard(label: "المحصّل", value: omr(n.collected), icon: "dollarsign.circle.fill", color: GH.green)
            }
        }
        .padding(.horizontal, 16).padding(.top, 14)
    }
}

fileprivate struct SummaryProfitSection: View {
    let n: SummaryNumbers

    var body: some View {
        let footer: String? = n.costedCount < n.itemCount ? "ربح القطع محسوب للقطع اللي مسجّل سعر شرائها فقط." : nil
        return GHSection("الأرباح", footer: footer) {
            KV("عدد الطلبات", "\(n.orderCount)")
            KV("عدد القطع", "\(n.itemCount)")
            KV("مبيعات القطع", omr(n.sales))
            KV("تكلفة الشراء", omr(n.cost))
            if n.discounts > 0 {
                KV("− الخصومات (أكواد ونقاط)", omr(n.discounts), color: GH.red)
            }
            KV("ربح القطع", omr(n.itemProfit), color: GH.green)
            KV("+ رسوم التوصيل", omr(n.delivery))
            KV("− المصاريف", omr(n.spent), color: GH.red)
            KV("صافي الربح", omr(n.net), strong: true, color: n.net < 0 ? GH.red : GH.burgundy)
        }
    }
}

fileprivate struct SummaryExpensesSection: View {
    let n: SummaryNumbers

    var body: some View {
        GHSection("المصاريف", trailing: {
            HeaderButton("إضافة", icon: "plus") { presentForm(ExpenseFormPage()) }
        }) {
            if n.topExpenses.isEmpty {
                Tile("ما في مصاريف في هذي الفترة", chevron: false)
            } else {
                ForEach(Array(n.topExpenses.prefix(6))) { e in
                    KV(e.name, omr(e.value))
                }
            }
            Tile("كل المصاريف", titleFont: .gh(16), titleColor: GH.burgundy,
                 action: { pushPage(ExpensesPage()) })
        }
    }
}

@MainActor
fileprivate struct SummaryWorkSection: View {
    let n: SummaryNumbers
    private static let statuses: [ItemStatus] = [.requested, .purchased, .arrived]

    private func count(_ s: ItemStatus) -> Int {
        Store.shared.allItems.filter { $0.item.status == s }.count
    }

    var body: some View {
        GHSection("الشغل الحالي") {
            ForEach(SummaryWorkSection.statuses, id: \.self) { s in
                Tile("قطع \(s.label)", value: "\(count(s))", chevron: false,
                     leading: { Circle().fill(s.color).frame(width: 10, height: 10) })
            }
            KV("مبالغ متبقية عند العملاء", omr(n.owed), strong: true, color: n.owed > 0.0005 ? GH.red : GH.green)
            KV("أرصدة العملاء عندك", omr(n.held), color: GH.green)
            KV("تاكس فري باقي تستلمه", n.taxFreeText, color: GH.purple)
        }
    }
}

// MARK: - Expenses

/// Every expense, general and per trip, newest first.
@MainActor
struct ExpensesPage: View {
    @ObservedObject private var store = Store.shared

    init() {}

    private var list: [TripExpense] {
        let old = Date(timeIntervalSince1970: 946_684_800)
        return store.expenses.sorted { ($0.spentOn ?? old) > ($1.spentOn ?? old) }
    }

    var body: some View {
        let l = list
        let total = l.reduce(0) { $0 + $1.omr }
        return GHPage("المصاريف", trailing: {
            NavIcon("plus.circle.fill") { presentForm(ExpenseFormPage()) }
        }) {
            if l.isEmpty {
                EmptyState(icon: "arrow.down.circle", title: "ما في مصاريف",
                           message: "سجّل مصاريف الشغل مثل الإعلانات والتغليف والشحن، أو مصاريف الرحلات من صفحة الرحلة.")
            } else {
                GHSection {
                    KV("المجموع", omr(total), strong: true)
                }
                GHSection(footer: "اضغط على المصروف عشان تحذفه.") {
                    ForEach(l) { e in
                        ExpenseListRow(expense: e)
                    }
                }
            }
        }
    }
}

@MainActor
fileprivate struct ExpenseListRow: View {
    let expense: TripExpense

    var body: some View {
        let e = expense
        let trip = Store.shared.trip(e.tripId)
        var parts: [String] = [dateStr(e.spentOn), trip?.name ?? "مصروف عام"]
        if e.currency != "OMR" { parts.append(money(e.amount, e.currency)) }
        let icon = trip == nil ? "briefcase.fill" : "airplane"
        let color = trip == nil ? GH.purple : GH.blue
        return Tile(e.title, subtitle: parts.joined(separator: " · "), value: omr(e.omr), chevron: false,
                    action: {
                        Task {
                            if await confirm("حذف «\(e.title)»؟") {
                                await attempt { try await Store.shared.deleteExpense(e.id) }
                            }
                        }
                    },
                    leading: { IconBox(icon, color: color) })
    }
}

// MARK: - Company settings

@MainActor
struct SettingsPage: View {
    @State private var name: String
    @State private var nameEn: String
    @State private var cr: String
    @State private var tax: String
    @State private var homeFee: String
    @State private var officeFee: String
    @State private var phone: String
    @State private var insta: String
    @State private var address: String
    @State private var bank: String
    @State private var note: String
    @State private var saving = false
    @Environment(\.dismiss) private var dismiss

    init() {
        let s = Store.shared.settings
        _name = State(initialValue: s.companyName ?? "")
        _nameEn = State(initialValue: s.companyNameEn ?? "")
        _cr = State(initialValue: s.crNumber ?? "")
        _tax = State(initialValue: s.taxNumber ?? "")
        _homeFee = State(initialValue: "\(s.deliveryHomeFee)")
        _officeFee = State(initialValue: "\(s.deliveryOfficeFee)")
        _phone = State(initialValue: s.phone ?? "")
        _insta = State(initialValue: s.instagram ?? "")
        _address = State(initialValue: s.address ?? "")
        _bank = State(initialValue: s.bankDetails ?? "")
        _note = State(initialValue: s.invoiceNote ?? "")
    }

    var body: some View {
        GHPage("بيانات الشركة", trailing: {
            if saving {
                ProgressView()
            } else {
                NavButton("حفظ", bold: true) { Task { await save() } }
            }
        }) {
            companySection
            GHSection("أسعار التوصيل",
                      footer: "تنحط تلقائياً لما تختار طريقة التوصيل في الطلب. لباب البيت: مندوبنا أو نول أو جيناكم. من الفرع: العميل يستلم من فرع نول أو جيناكم.") {
                AmountRow("لباب البيت", text: $homeFee)
                AmountRow("من فرع الشركة", text: $officeFee)
            }
            GHSection("بيانات التحويل البنكي") {
                NotesRow(text: $bank, placeholder: "اسم البنك، اسم الحساب، رقم الحساب / IBAN")
            }
            GHSection("ملاحظة أسفل الفاتورة") {
                NotesRow(text: $note, placeholder: "مثلاً: العربون غير مسترد")
            }
        }
    }

    private var companySection: some View {
        GHSection(footer: "تطلع في رأس الفاتورة وأسفلها.") {
            FieldRow("اسم الشركة", text: $name, placeholder: "GH Shopper")
            FieldRow("بالإنجليزي", text: $nameEn, placeholder: "GH Shopper", ltr: true)
            FieldRow("السجل التجاري", text: $cr, placeholder: "رقم السجل", ltr: true)
            FieldRow("الرقم الضريبي", text: $tax, placeholder: "اختياري", ltr: true)
            FieldRow("الجوال", text: $phone, keyboard: .phone, ltr: true)
            FieldRow("الانستقرام", text: $insta, placeholder: "@ghshopper", ltr: true)
            FieldRow("العنوان", text: $address, placeholder: "مسقط، عُمان")
        }
    }

    private func v(_ s: String) -> Any {
        let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
        return t.isEmpty ? NSNull() : t
    }

    private func save() async {
        saving = true
        let data: JSON = [
            "company_name": v(name),
            "company_name_en": v(nameEn),
            "cr_number": v(cr),
            "tax_number": v(tax),
            "delivery_home_fee": nn(parseAmount(homeFee)),
            "delivery_office_fee": nn(parseAmount(officeFee)),
            "phone": v(phone),
            "instagram": v(insta),
            "address": v(address),
            "bank_details": v(bank),
            "invoice_note": v(note),
        ]
        do {
            try await Store.shared.saveSettings(data)
            toast("تم الحفظ")
            dismiss()
        } catch {
            saving = false
            toastError(error)
        }
    }
}
