import SwiftUI

// Port of lib/pages/gulf_shipping_page.dart

/// − value + row used for day counts.
fileprivate struct GulfDayStepper: View {
    let label: String
    let value: Int
    let onChanged: (Int) -> Void

    var body: some View {
        Tile(label, chevron: false, trailing: { controls })
    }

    private var controls: some View {
        HStack(spacing: 0) {
            Button {
                if value > 0 { onChanged(value - 1) }
            } label: {
                Image(systemName: "minus.circle").font(.system(size: 26))
                    .foregroundStyle(value > 0 ? GH.burgundy : GH.tertiary)
                    .frame(minWidth: 36, minHeight: 36).padding(.horizontal, 10)
            }
            .buttonStyle(.borderless)
            .disabled(value <= 0)
            Text("\(value)").font(.gh(18, .semibold)).foregroundStyle(GH.label)
                .frame(width: 34).multilineTextAlignment(.center)
            Button {
                onChanged(value + 1)
            } label: {
                Image(systemName: "plus.circle").font(.system(size: 26))
                    .foregroundStyle(GH.burgundy)
                    .frame(minWidth: 36, minHeight: 36).padding(.horizontal, 10)
            }
            .buttonStyle(.borderless)
        }
    }
}

fileprivate struct CountryMeta: Identifiable {
    let raw: JSON
    var id: String { jstr(raw["code"]) }
}

/// Shipping to the other Gulf countries: one switch turns it on for the
/// website and the customer app. Customers see prices in their currency;
/// every payment stays in Omani rials (Amwal). Same settings as the
/// dashboard's "شحن الخليج" page.
@MainActor
struct GulfShippingPage: View {
    @State private var s: JSON?
    @State private var meta: [CountryMeta] = []
    @State private var fee = ""
    @State private var saving = false
    @State private var loadError: String?

    init() {}

    var body: some View {
        GHPage("شحن الخليج", trailing: {
            if saving {
                ProgressView()
            } else if s != nil {
                NavButton("حفظ", bold: true) { Task { await save() } }
            }
        }) {
            if let cur = s {
                content(cur)
            } else {
                loadingBlock
            }
        }
        .task { if s == nil { await load() } }
    }

    @ViewBuilder private var loadingBlock: some View {
        if let loadError {
            Text(loadError).font(TS.sub).foregroundStyle(GH.secondary).multilineTextAlignment(.center)
                .frame(maxWidth: .infinity).padding(40)
        } else {
            ProgressView().frame(maxWidth: .infinity).padding(40)
        }
    }

    @ViewBuilder private func content(_ cur: JSON) -> some View {
        enabledSection(cur)
        priceSection(cur)
        carrierSection
        countriesSection
        Text("أسعار الصرف وروابط التتبّع والملاحظة للعميل تتعدّل من لوحة التحكم.")
            .font(TS.small).foregroundStyle(GH.secondary)
            .padding(.horizontal, 32).padding(.top, 8).padding(.bottom, 24)
    }

    // MARK: sections

    private func enabledSection(_ cur: JSON) -> some View {
        let on = jb(cur["enabled"])
        let binding = Binding<Bool>(get: { jb(s?["enabled"]) }, set: { v in Task { await toggle(v) } })
        return GHSection(footer: "الأسعار تطلع للعميل بعملة بلده، والدفع دايماً بالريال العماني عبر أموال.") {
            SwitchRow("الشحن لدول الخليج", subtitle: on ? "شغّال في الموقع والتطبيق" : "موقّف", isOn: binding)
        }
    }

    private func intOf(_ v: Any?, _ fallback: Int) -> Int {
        jdn(v).map { Int($0) } ?? fallback
    }

    private func priceSection(_ cur: JSON) -> some View {
        let minDays = intOf(cur["min_days"], 3)
        let maxDays = intOf(cur["max_days"], 5)
        return GHSection("السعر والمدة", footer: "المدة تنضاف على مدة تجهيز الطلب نفسه (أيام عمل).") {
            AmountRow("سعر الشحن", text: $fee)
            GulfDayStepper(label: "من", value: minDays, onChanged: { v in setMin(v) })
            GulfDayStepper(label: "إلى", value: maxDays, onChanged: { v in setMax(v) })
        }
    }

    private var carrierBinding: Binding<String> {
        Binding(get: { js(s?["carrier"]) ?? "genacom" },
                set: { v in edit { $0["carrier"] = v } })
    }

    private var carrierSection: some View {
        GHSection("الشركة الافتراضية للطلبات الجديدة",
                  footer: "العميل يشوف «شحن سريع لباب البيت» بدون اسم الشركة. تختار جيناكم أو DHL لكل طلب من صفحة الطلب.") {
            Segments(value: carrierBinding, options: [("genacom", "جيناكم"), ("dhl", "DHL")])
        }
    }

    private var countries: JSON { (s?["countries"] as? JSON) ?? [:] }

    private var countriesSection: some View {
        GHSection("الدول") {
            ForEach(meta) { m in
                countryRow(m.raw)
            }
        }
    }

    private func countryRow(_ m: JSON) -> some View {
        let code = jstr(m["code"])
        let c = countries[code] as? JSON
        let rate = js(c?["rate"]) ?? js(m["default_rate"]) ?? "null"
        let subtitle = "1 ر.ع = \(rate) \(js(m["symbol"]) ?? "null")"
        let binding = Binding<Bool>(
            get: { jb((countries[code] as? JSON)?["enabled"]) },
            set: { v in setCountry(code, enabled: v) })
        return SwitchRow(js(m["name_ar"]) ?? "null", subtitle: subtitle, isOn: binding)
    }

    // MARK: edits

    private func edit(_ f: (inout JSON) -> Void) {
        guard var cur = s else { return }
        f(&cur)
        s = cur
    }

    private func setMin(_ v: Int) {
        edit { cur in
            cur["min_days"] = v
            if (jdn(cur["max_days"]) ?? 0) < Double(v) { cur["max_days"] = v }
        }
    }

    private func setMax(_ v: Int) {
        edit { cur in
            let mn = jdn(cur["min_days"]) ?? 0
            if Double(v) < mn {
                cur["max_days"] = cur["min_days"]
            } else {
                cur["max_days"] = v
            }
        }
    }

    private func setCountry(_ code: String, enabled: Bool) {
        edit { cur in
            var all = (cur["countries"] as? JSON) ?? [:]
            var one = (all[code] as? JSON) ?? [:]
            one["enabled"] = enabled
            all[code] = one
            cur["countries"] = all
        }
    }

    // MARK: server

    private func load() async {
        do {
            let res = try await Api.shared.get("/admin/gcc-shipping") as? JSON ?? [:]
            let data = (res["data"] as? JSON) ?? [:]
            s = data
            meta = jlist(res["countries"]).map { CountryMeta(raw: $0) }
            fee = js(data["fee"]) ?? "5"
        } catch {
            loadError = errorText(error)
        }
    }

    private func save(quiet: Bool = false) async {
        guard let cur = s else { return }
        saving = true
        do {
            var body = cur
            if let f = parseAmount(fee) { body["fee"] = f }
            let res = try await Api.shared.put("/admin/gcc-shipping", body) as? JSON
            s = (res?["data"] as? JSON) ?? body
            saving = false
            if !quiet { toast("تم الحفظ، ويطلع للعملاء على طول") }
        } catch {
            saving = false
            toastError(error)
        }
    }

    private func toggle(_ on: Bool) async {
        let ok = await confirm(on ? "نشغّل الشحن للخليج؟" : "نوقف الشحن للخليج؟",
                               message: on
                                   ? "العملاء في السعودية والإمارات والكويت وقطر والبحرين يقدرون يطلبون من الموقع والتطبيق."
                                   : "الطلبات الحالية ما تتأثر.",
                               ok: on ? "شغّل" : "وقّف",
                               destructive: !on)
        if !ok { return }
        saving = true
        do {
            // only the switch: unsaved edits on the page stay unsaved
            let current = try await Api.shared.get("/admin/gcc-shipping") as? JSON ?? [:]
            var body = (current["data"] as? JSON) ?? [:]
            body["enabled"] = on
            try await Api.shared.put("/admin/gcc-shipping", body)
            edit { $0["enabled"] = on }
            saving = false
            toast(on ? "الشحن للخليج شغّال" : "الشحن للخليج موقّف")
        } catch {
            saving = false
            toastError(error)
        }
    }
}
