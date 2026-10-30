import SwiftUI

/// ذوق العميلة: edit her favourite brands, sizes, colours, budget and notes.
/// Opened from «ذوقها» on the customer page (presentForm).
@MainActor
struct TasteProfilePage: View {
    let customerId: String
    @ObservedObject private var store = Store.shared
    @Environment(\.dismiss) private var dismiss

    @State private var brands: [String]
    @State private var newBrand = ""
    @State private var clothes: String
    @State private var shoes: String
    @State private var rings: String
    /// Sizes other than ملابس / أحذية / خواتم ("حزام" = "85").
    @State private var otherSizes: [TasteSize]
    @State private var colors: [String]
    @State private var newColor = ""
    @State private var budget: String
    @State private var notes: String
    @State private var saving = false

    private static let quickColors = ["أسود", "أبيض", "بيج", "بني", "كحلي", "رمادي", "وردي", "أحمر", "أخضر", "ذهبي", "فضي"]

    init(customerId: String) {
        self.customerId = customerId
        let s = Store.shared.customer(customerId)?.style ?? CustomerStyle()
        _brands = State(initialValue: s.brands)
        _clothes = State(initialValue: s.sizes["clothes"] ?? "")
        _shoes = State(initialValue: s.sizes["shoes"] ?? "")
        _rings = State(initialValue: s.sizes["rings"] ?? "")
        let fixed = Set(CustomerStyle.sizeKeys.map { $0.key })
        _otherSizes = State(initialValue: s.orderedSizes.filter { !fixed.contains($0.key) })
        _colors = State(initialValue: s.colors)
        _budget = State(initialValue: s.budget ?? "")
        _notes = State(initialValue: s.notes ?? "")
    }

    private var customer: Customer? { store.customer(customerId) }
    private var she: Bool { !(customer?.isMale ?? false) }

    private func clean(_ s: String) -> String? {
        let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
        return t.isEmpty ? nil : t
    }

    private func same(_ a: String, _ b: String) -> Bool { Brands.norm(a) == Brands.norm(b) }

    // ───────── body ─────────

    var body: some View {
        GHPage(she ? "ذوقها" : "ذوقه", trailing: {
            if saving {
                ProgressView()
            } else {
                NavButton("حفظ", bold: true) { save() }
            }
        }, leading: {
            NavButton("إلغاء") { dismiss() }
        }) {
            brandsSection
            sizesSection
            colorsSection
            GHSection("الميزانية") {
                FieldRow("الميزانية", text: $budget, placeholder: "مثلاً 200 إلى 500 ر.ع للقطعة")
            }
            GHSection("ملاحظات") {
                NotesRow(text: $notes, placeholder: "مثلاً: \(she ? "تحب" : "يحب") الشنط الصغيرة، ما \(she ? "تحب" : "يحب") الذهبي")
            }
            if customer?.style != nil {
                Pad(top: 24) {
                    Button {
                        Task { await clearAll() }
                    } label: {
                        Text("مسح الذوق").font(.gh(17)).foregroundStyle(GH.red)
                            .frame(maxWidth: .infinity).padding(.vertical, 14)
                    }
                    .buttonStyle(.plain)
                }
            }
        }
    }

    // ───────── brands ─────────

    private var brandSuggestions: [String] {
        Array(Brands.all().filter { b in !brands.contains(where: { same($0, b) }) }.prefix(14))
    }

    private var brandsSection: some View {
        GHSection("البراندات \(she ? "اللي تحبها" : "اللي يحبها")",
                  footer: "اكتب البراند واضغط «أضف»، أو اختر من الاقتراحات. نطلع \(she ? "لها" : "له") القطع من هالبراندات.") {
            if !brands.isEmpty {
                TasteFlow(spacing: 8).callAsFunction {
                    ForEach(brands, id: \.self) { b in
                        TasteChip(b) { brands.removeAll { $0 == b } }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 16).padding(.vertical, 12)
            }
            BrandField("براند", text: $newBrand, placeholder: "مثلاً Chanel")
            if let t = clean(newBrand) {
                Tile("أضف «\(Brands.canonical(t) ?? t)»", titleColor: GH.burgundy, chevron: false,
                     action: { addBrand() },
                     leading: { IconBox("plus", color: GH.burgundy) })
            }
            let picks = brandSuggestions
            if !picks.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Text("اقتراحات").font(TS.sub).foregroundStyle(GH.secondary).padding(.horizontal, 16)
                    ChipBar {
                        ForEach(picks, id: \.self) { b in
                            ChipButton(b, icon: "plus") { add(brand: b) }
                        }
                    }
                    .environment(\.layoutDirection, .leftToRight)
                }
                .padding(.vertical, 10)
            }
        }
    }

    private func add(brand raw: String) {
        guard let t = clean(raw) else { return }
        let name = Brands.canonical(t) ?? t
        if !brands.contains(where: { same($0, name) }) { brands.append(name) }
    }

    private func addBrand() {
        add(brand: newBrand)
        newBrand = ""
    }

    // ───────── sizes ─────────

    private var sizesSection: some View {
        GHSection("المقاسات", footer: "اكتب المقاس مثل ما يطلع في المحل (M، 38، 52…).") {
            FieldRow("ملابس", text: $clothes, placeholder: "مثلاً M أو 38")
            FieldRow("أحذية", text: $shoes, placeholder: "مثلاً 38", ltr: true)
            FieldRow("خواتم", text: $rings, placeholder: "مثلاً 52", ltr: true)
            ForEach(otherSizes) { e in
                Tile(e.key, value: e.value, chevron: false,
                     action: { Task { await editOther(e) } },
                     trailing: {
                         Button {
                             otherSizes.removeAll { $0.key == e.key }
                         } label: {
                             Image(systemName: "minus.circle.fill").foregroundStyle(GH.red)
                         }
                         .buttonStyle(.plain)
                     })
            }
            Tile("أضف مقاس ثاني", subtitle: "مثلاً حزام، قفازات، ساعة", titleColor: GH.burgundy, chevron: false,
                 action: { Task { await addOther() } },
                 leading: { IconBox("plus", color: GH.blue) })
        }
    }

    @MainActor
    private func addOther() async {
        guard let k = await promptText("اسم المقاس", placeholder: "مثلاً حزام", ok: "التالي"), let key = clean(k) else { return }
        let fixed = CustomerStyle.sizeKeys.first { $0.label == key }
        guard let v = await promptText("مقاس \(key)", placeholder: "مثلاً 85", ok: "أضف"), let value = clean(v) else { return }
        if let fixed {
            // typed one of the fixed names: fill that field instead
            switch fixed.key {
            case "clothes": clothes = value
            case "shoes": shoes = value
            default: rings = value
            }
            return
        }
        otherSizes.removeAll { $0.key == key }
        otherSizes.append(TasteSize(key: key, value: value))
    }

    @MainActor
    private func editOther(_ e: TasteSize) async {
        guard let v = await promptText("مقاس \(e.key)", initial: e.value, ok: "حفظ") else { return }
        if let i = otherSizes.firstIndex(where: { $0.key == e.key }) {
            if let value = clean(v) {
                otherSizes[i] = TasteSize(key: e.key, value: value)
            } else {
                otherSizes.remove(at: i)
            }
        }
    }

    // ───────── colours ─────────

    private var colorsSection: some View {
        GHSection("الألوان") {
            if !colors.isEmpty {
                TasteFlow(spacing: 8).callAsFunction {
                    ForEach(colors, id: \.self) { c in
                        TasteChip(c, color: GH.gold) { colors.removeAll { $0 == c } }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(.horizontal, 16).padding(.vertical, 12)
            }
            FieldRow("لون", text: $newColor, placeholder: "مثلاً بيج")
            if let t = clean(newColor) {
                Tile("أضف «\(t)»", titleColor: GH.burgundy, chevron: false,
                     action: { add(color: t); newColor = "" },
                     leading: { IconBox("plus", color: GH.gold) })
            }
            let picks = TasteProfilePage.quickColors.filter { c in !colors.contains(c) }
            if !picks.isEmpty {
                ChipBar {
                    ForEach(picks, id: \.self) { c in
                        ChipButton(c, icon: "plus") { add(color: c) }
                    }
                }
                .padding(.vertical, 8)
            }
        }
    }

    private func add(color raw: String) {
        guard let t = clean(raw) else { return }
        if !colors.contains(where: { $0.lowercased() == t.lowercased() }) { colors.append(t) }
    }

    // ───────── save ─────────

    private func build() -> CustomerStyle {
        var s = CustomerStyle()
        s.brands = brands
        s.colors = colors
        // what's typed but not added yet counts too
        if let t = clean(newBrand) {
            let name = Brands.canonical(t) ?? t
            if !s.brands.contains(where: { same($0, name) }) { s.brands.append(name) }
        }
        if let t = clean(newColor), !s.colors.contains(where: { $0.lowercased() == t.lowercased() }) {
            s.colors.append(t)
        }
        if let v = clean(clothes) { s.sizes["clothes"] = v }
        if let v = clean(shoes) { s.sizes["shoes"] = v }
        if let v = clean(rings) { s.sizes["rings"] = v }
        for e in otherSizes { s.sizes[e.key] = e.value }
        s.budget = clean(budget)
        s.notes = clean(notes)
        return s
    }

    private func save() {
        let style = build()
        let id = customerId
        saving = true
        Task {
            do {
                try await Store.shared.saveStyle(id, style.isEmpty ? nil : style)
                toast("انحفظ")
                dismiss()
            } catch {
                saving = false
                toastError(error)
            }
        }
    }

    @MainActor
    private func clearAll() async {
        guard await confirm("مسح \(she ? "ذوقها" : "ذوقه")؟", message: "تنمسح البراندات والمقاسات والألوان والملاحظات.", ok: "مسح") else { return }
        saving = true
        do {
            try await Store.shared.saveStyle(customerId, nil)
            toast("انمسح")
            dismiss()
        } catch {
            saving = false
            toastError(error)
        }
    }
}
