import SwiftUI

/// Currencies offered when typing a selling price.
let priceCurrencies: [(String, String)] = [("OMR", "ر.ع"), ("EUR", "€ يورو"), ("AED", "درهم")]

private let commissionKey = "gh_last_commission"

func rememberCommission(_ v: Double) { UserDefaults.standard.set(v, forKey: commissionKey) }
private var lastCommission: Double { UserDefaults.standard.double(forKey: commissionKey) }

private func numText(_ v: Double, digits: Int = 2) -> String {
    var s = String(format: "%.\(digits)f", v)
    if s.contains(".") {
        while s.hasSuffix("0") { s.removeLast() }
        if s.hasSuffix(".") { s.removeLast() }
    }
    return s
}

/// Selling price typed in OMR, EUR or AED. Foreign prices are converted at
/// today's rate plus a commission, and the OMR result stays editable.
@MainActor
final class PriceDraft: ObservableObject {
    @Published var currency = "OMR"
    @Published var foreign = ""
    @Published var commission = ""
    @Published var omrText = ""

    init(item: OrderItem? = nil) {
        if let item {
            currency = item.listCurrency ?? "OMR"
            if let l = item.listPrice { foreign = numText(l) }
            if let c = item.commissionPct { commission = numText(c) }
            if item.price > 0 { omrText = numText(item.price, digits: 3) }
        } else if lastCommission > 0 {
            commission = numText(lastCommission)
        }
    }

    var isForeign: Bool { currency != "OMR" }
    var rate: Double { Rates.shared.rate(currency) }
    var foreignAmount: Double { parseAmount(foreign) ?? 0 }
    var commissionPct: Double { parseAmount(commission) ?? 0 }
    var computed: Double { foreignAmount * rate * (1 + commissionPct / 100) }
    var omrValue: Double { parseAmount(omrText) ?? 0 }

    func recompute() {
        guard isForeign else { return }
        omrText = foreignAmount > 0 ? numText(computed, digits: 3) : ""
    }

    /// Fields for the order item.
    var fields: JSON {
        [
            "price": omrValue,
            "list_price": isForeign && foreignAmount > 0 ? foreignAmount : NSNull(),
            "list_currency": isForeign && foreignAmount > 0 ? currency : NSNull(),
            "commission_pct": isForeign && foreignAmount > 0 ? commissionPct : NSNull(),
        ]
    }

    func remember() { if isForeign { rememberCommission(commissionPct) } }

    var symbol: String { currency == "EUR" ? "€" : currency == "AED" ? "د.إ" : "ر.ع" }
}

/// The price rows to place inside a GHSection.
struct PriceRows: View {
    @ObservedObject var draft: PriceDraft

    var body: some View {
        Segments(value: Binding(get: { draft.currency }, set: { draft.currency = $0; draft.recompute() }),
                 options: priceCurrencies)
        if draft.isForeign {
            AmountRow(draft.currency == "EUR" ? "السعر باليورو" : "السعر بالدرهم",
                      text: Binding(get: { draft.foreign }, set: { draft.foreign = $0; draft.recompute() }),
                      suffix: draft.symbol)
            AmountRow("العمولة", text: Binding(get: { draft.commission }, set: { draft.commission = $0; draft.recompute() }),
                      suffix: "٪")
        }
        AmountRow(draft.isForeign ? "السعر للعميل" : "السعر", text: $draft.omrText)
        if draft.isForeign && draft.foreignAmount > 0 {
            Text("\(numText(draft.foreignAmount)) \(draft.symbol) × \(Rates.shared.rateText(draft.currency))" +
                 (draft.commissionPct > 0 ? " + \(numText(draft.commissionPct))٪" : "") + " = \(omr(draft.computed))")
                .font(.gh(12.5)).foregroundStyle(GH.secondary)
                .padding(.horizontal, 16).padding(.top, 2).padding(.bottom, 10)
        }
    }
}
