import SwiftUI
import UIKit

// المميزات: the owner switches each customer feature on/off and edits its
// settings (GET / PUT /ps/features, full admins only).

fileprivate enum FeatFieldKind { case toggle, int, decimal, text, ids }

fileprivate struct FeatField: Identifiable {
    let key: String
    let label: String
    let kind: FeatFieldKind
    var id: String { key }
}

fileprivate struct FeatDef: Identifiable {
    let key: String
    let name: String
    let desc: String
    let icon: String
    let color: Color
    let fields: [FeatField]
    var id: String { key }
}

/// The 10 features, in the contract's order, with their Arabic names.
fileprivate let featDefs: [FeatDef] = [
    FeatDef(key: "wishlist_alerts", name: "تنبيهات المفضلة",
            desc: "ينبّه العميل لما ينزل سعر قطعة في مفضلته، أو ترجع متوفرة، أو تنزل قطعة جديدة.",
            icon: "heart.fill", color: GH.pink, fields: []),
    FeatDef(key: "quotes", name: "عروض أسعار القطع",
            desc: "ترسل للعميل سعر القطعة اللي طلبها، يقبل العرض من التطبيق ويدفع.",
            icon: "tag.fill", color: GH.gold,
            fields: [FeatField(key: "expires_days", label: "مدة العرض (أيام)", kind: .int)]),
    FeatDef(key: "smart_push", name: "إشعارات ذكية",
            desc: "إشعار للعميل في كل مرحلة من طلبه: اشترينا قطعتك، وصلت عُمان، في الطريق، تم التسليم.",
            icon: "bell.badge.fill", color: GH.blue, fields: []),
    FeatDef(key: "wallet", name: "محفظة GH",
            desc: "رصيد للعميل يدفع منه: تحويل النقاط، شحن بالبطاقة، ورصيد تضيفه أنت.",
            icon: "wallet.pass.fill", color: GH.green,
            fields: [FeatField(key: "points_convert", label: "تحويل النقاط للمحفظة", kind: .toggle),
                     FeatField(key: "topup", label: "شحن الرصيد بالبطاقة", kind: .toggle),
                     FeatField(key: "topup_min", label: "أقل مبلغ شحن", kind: .decimal),
                     FeatField(key: "topup_max", label: "أعلى مبلغ شحن", kind: .decimal)]),
    FeatDef(key: "gifts", name: "إرسال هدية",
            desc: "العميل يرسل الطلب هدية: اسم ورقم المستلم، رسالة، تغليف، وإخفاء الأسعار.",
            icon: "gift.fill", color: GH.burgundy,
            fields: [FeatField(key: "wrap", label: "تغليف هدية", kind: .toggle),
                     FeatField(key: "wrap_fee", label: "سعر التغليف", kind: .decimal)]),
    FeatDef(key: "vip_progress", name: "مستوى VIP",
            desc: "بطاقة مستوى العميل وكم نقطة باقي له للمستوى الجاي ومميزاته.",
            icon: "crown.fill", color: GH.gold, fields: []),
    FeatDef(key: "purchase_photos", name: "صور القطعة من المحل",
            desc: "يشوف العميل صورة قطعته والإيصال أول ما نشتريها.",
            icon: "camera.fill", color: GH.teal, fields: []),
    FeatDef(key: "reviews", name: "التقييمات",
            desc: "تقييم القطع بعد الاستلام، وتقييم الخدمة بعد التوصيل. تظهر بعد موافقتك.",
            icon: "star.fill", color: GH.amber,
            fields: [FeatField(key: "service", label: "تقييم الخدمة", kind: .toggle)]),
    FeatDef(key: "chat", name: "المحادثة المباشرة",
            desc: "العميل يكتب لكم من التطبيق والموقع، وتردون من «المحادثات».",
            icon: "bubble.left.and.bubble.right.fill", color: GH.purple,
            fields: [FeatField(key: "welcome_ar", label: "رسالة الترحيب", kind: .text),
                     FeatField(key: "welcome_en", label: "Welcome (EN)", kind: .text),
                     FeatField(key: "hours_ar", label: "أوقات الرد", kind: .text),
                     FeatField(key: "hours_en", label: "Hours (EN)", kind: .text)]),
    FeatDef(key: "weekly_new", name: "جديدنا هذا الأسبوع",
            desc: "ستوريات في أول الصفحة الرئيسية بأحدث القطع.",
            icon: "sparkles", color: GH.rose,
            fields: [FeatField(key: "days", label: "قطع آخر (أيام)", kind: .int),
                     FeatField(key: "max", label: "أكثر عدد", kind: .int),
                     FeatField(key: "title_ar", label: "العنوان", kind: .text),
                     FeatField(key: "title_en", label: "Title (EN)", kind: .text),
                     FeatField(key: "product_ids", label: "قطع مثبتة", kind: .ids)]),
]

/// The Arabic name of a feature key (for messages elsewhere).
func featureName(_ key: String) -> String {
    featDefs.first { $0.key == key }?.name ?? key
}

/// Only full admins may change the features (the server checks too).
@MainActor func canManageFeatures() -> Bool { Api.shared.session?.role == "admin" && Api.shared.access.full }

/// Shown by a page whose feature is switched off (the server answered 403 feature_off).
struct GHFeatureOffState: View {
    let feature: String

    init(feature: String) { self.feature = feature }

    var body: some View {
        let admin = canManageFeatures()
        return EmptyState(icon: "power", title: "«\(featureName(feature))» غير مفعّلة",
                   message: "شغّلها من صفحة المميزات عشان تطلع للعملاء وتشتغل هنا.") {
            if admin {
                SecondaryButton("المميزات", icon: "switch.2") { pushPage(FeaturesPage()) }
            }
        }
    }
}

struct FeaturesPage: View {
    @State private var features: JSON = [:]
    @State private var loaded = false
    @State private var failure: String?
    @State private var saving: Set<String> = []

    init() {}

    var body: some View {
        GHPage("المميزات", onRefresh: { await load() }) {
            if !loaded {
                LoadingView()
            } else if let failure, features.isEmpty {
                EmptyState(icon: "lock", title: "ما قدرنا نفتح المميزات", message: failure) {
                    SecondaryButton("حاول مرة ثانية", icon: "arrow.clockwise") { Task { await load() } }
                }
            } else {
                Pad(top: 6) {
                    Text("شغّل أو وقّف أي ميزة للعملاء في التطبيق والموقع. التغيير يوصل خلال دقيقة.")
                        .font(TS.sub).foregroundStyle(GH.secondary)
                }
                ForEach(featDefs) { d in
                    FeatSection(def: d, values: values(d.key), busy: saving.contains(d.key),
                                onChange: { patch in Task { await save(d.key, patch) } })
                }
            }
        }
        .task { if !loaded { await load() } }
    }

    private func values(_ key: String) -> JSON { features[key] as? JSON ?? [:] }

    private func load() async {
        do {
            let res = try await Api.shared.get("/ps/features") as? JSON ?? [:]
            features = (res["features"] as? JSON) ?? res
            failure = nil
        } catch {
            failure = errorText(error)
        }
        loaded = true
    }

    private func save(_ key: String, _ patch: JSON) async {
        let before = features
        var current = values(key)
        patch.forEach { current[$0] = $1 }
        features[key] = current
        saving.insert(key)
        do {
            let res = try await Api.shared.put("/ps/features", [key: patch]) as? JSON ?? [:]
            let full = (res["features"] as? JSON) ?? res
            if full[key] is JSON { features = full }
            Haptic.success()
        } catch {
            features = before
            toastError(error)
        }
        saving.remove(key)
    }
}

fileprivate struct FeatSection: View {
    let def: FeatDef
    let values: JSON
    let busy: Bool
    let onChange: (JSON) -> Void

    private var isOn: Bool { jb(values["on"]) }

    private var onBinding: Binding<Bool> {
        let change = onChange
        return Binding(get: { jb(values["on"]) }, set: { v in change(["on": v]) })
    }

    var body: some View {
        GHSection(footer: def.desc) {
            head
            if isOn {
                ForEach(def.fields) { f in FeatFieldRow(field: f, values: values, onChange: onChange) }
            }
        }
    }

    private var head: some View {
        Tile(def.name, titleFont: .gh(16, .semibold), chevron: false, leading: {
            IconBox(def.icon, color: def.color)
        }, trailing: {
            HStack(spacing: 8) {
                if busy { ProgressView() }
                Toggle("", isOn: onBinding).labelsHidden().tint(GH.burgundy)
            }
        })
    }
}

fileprivate struct FeatFieldRow: View {
    let field: FeatField
    let values: JSON
    let onChange: (JSON) -> Void

    private var raw: Any? { values[field.key] }

    private var boolBinding: Binding<Bool> {
        let key = field.key
        let change = onChange
        return Binding(get: { jb(values[key]) }, set: { v in change([key: v]) })
    }

    private var ids: [Int] {
        ((raw as? [Any]) ?? []).map { ji($0) }.filter { $0 > 0 }
    }

    private var valueText: String {
        switch field.kind {
        case .toggle: return ""
        case .int: return "\(ji(raw))"
        case .decimal: return omr(jd(raw))
        case .text: return js(raw) ?? "—"
        case .ids: return ids.isEmpty ? "ولا وحدة" : "\(ids.count)"
        }
    }

    var body: some View {
        if field.kind == .toggle {
            SwitchRow(field.label, isOn: boolBinding)
        } else {
            Tile(field.label, value: valueText, valueFont: .gh(14), action: { Task { await edit() } })
        }
    }

    private func edit() async {
        switch field.kind {
        case .toggle:
            return
        case .int:
            guard let t = await promptText(field.label, initial: "\(ji(raw))", keyboard: .numberPad) else { return }
            guard let v = parseAmount(t) else { toast("اكتب رقم", error: true); return }
            onChange([field.key: Int(v)])
        case .decimal:
            guard let t = await promptText(field.label, initial: amountText(jd(raw)), keyboard: .decimalPad) else { return }
            guard let v = parseAmount(t) else { toast("اكتب رقم", error: true); return }
            onChange([field.key: v])
        case .text:
            guard let t = await promptText(field.label, initial: js(raw) ?? "") else { return }
            onChange([field.key: t.trimmingCharacters(in: .whitespacesAndNewlines)])
        case .ids:
            let initial = ids.map { String($0) }.joined(separator: ", ")
            guard let t = await promptText(field.label, message: "أرقام المنتجات (ID) مفصولة بفاصلة، تطلع أول الستوريات",
                                           placeholder: "12, 45, 78", initial: initial) else { return }
            let parts = normalizeDigits(t).components(separatedBy: CharacterSet(charactersIn: ".، "))
            let list = parts.compactMap { Int($0.trimmingCharacters(in: .whitespaces)) }.filter { $0 > 0 }
            onChange([field.key: list])
        }
    }
}
