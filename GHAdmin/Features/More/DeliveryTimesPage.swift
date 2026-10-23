import SwiftUI

// Port of lib/pages/delivery_times_page.dart

/// − value + row used for day counts.
fileprivate struct DayStepper: View {
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

/// How long delivery takes from Dubai, from Europe and from stock in Oman.
/// Customers see it on the product page, in the bag and at checkout.
@MainActor
struct DeliveryTimesPage: View {
    @State private var eta: [String: EtaRule]
    @State private var saving = false
    @Environment(\.dismiss) private var dismiss

    init() {
        _eta = State(initialValue: Store.shared.settings.eta)
    }

    var body: some View {
        GHPage("مدة التوصيل", trailing: {
            if saving {
                ProgressView()
            } else {
                NavButton("حفظ", bold: true) { Task { await save() } }
            }
        }) {
            ForEach(EtaRule.origins.map { $0.key }, id: \.self) { k in
                originSection(k)
            }
            Text("أيام العمل ما تحسب الجمعة والسبت. المنتج اللي ما حددت مصدره: تسليم فوري = عُمان، بالطلب = أوروبا.")
                .font(TS.small).foregroundStyle(GH.secondary)
                .padding(.horizontal, 32).padding(.top, 8).padding(.bottom, 24)
        }
    }

    private func label(_ k: String) -> String {
        EtaRule.origins.first { $0.key == k }?.label ?? k
    }

    private func rule(_ k: String) -> EtaRule {
        eta[k] ?? EtaRule.defaults[k] ?? EtaRule(min: 1, max: 1)
    }

    private func originSection(_ k: String) -> some View {
        let r = rule(k)
        let work = Binding<Bool>(get: { rule(k).workDays }, set: { v in set(k, work: v) })
        return GHSection(label(k), footer: "يطلع للعميل: يوصلك خلال \(r.label)") {
            DayStepper(label: "من", value: r.min, onChanged: { v in set(k, min: v) })
            DayStepper(label: "إلى", value: r.max, onChanged: { v in set(k, max: v) })
            Segments(value: work, options: [(true, "أيام عمل"), (false, "أيام")])
        }
    }

    private func clamp(_ v: Int, _ lo: Int, _ hi: Int) -> Int {
        v < lo ? lo : (v > hi ? hi : v)
    }

    private func set(_ k: String, min: Int? = nil, max: Int? = nil, work: Bool? = nil) {
        let r = rule(k)
        var a = clamp(min ?? r.min, 0, 90)
        var b = clamp(max ?? r.max, 0, 120)
        if min != nil && b < a { b = a }
        if max != nil && a > b { a = b }
        eta[k] = EtaRule(min: a, max: b, workDays: work ?? r.workDays)
    }

    private func save() async {
        saving = true
        var body: JSON = [:]
        for (k, r) in eta { body[k] = r.json }
        do {
            try await Store.shared.saveSettings(["delivery_eta": body])
            toast("تم الحفظ، ويطلع للعملاء على طول")
            dismiss()
        } catch {
            saving = false
            toastError(error)
        }
    }
}
