import SwiftUI

// Live Activity faces: the lock screen banner and the Dynamic Island pieces.
// Plain views (no ActivityKit / WidgetKit types) so the app's gallery can draw them;
// the extension puts them into ActivityConfiguration / DynamicIsland.

// MARK: - delivery

/// معك → في الطريق → وصلت عند الباب → تم التسليم, as dots on a gold line.
struct GWStepTrack: View {
    let step: Int
    let failed: Bool

    var body: some View {
        HStack(spacing: 0) {
            ForEach(0..<4, id: \.self) { i in
                if i > 0 {
                    Rectangle()
                        .fill(i <= step ? GWBrand.gold : GWBrand.ivory.opacity(0.18))
                        .frame(height: 2)
                }
                dot(i)
            }
        }
    }

    private func dotColor(_ i: Int) -> Color {
        if i == step && failed { return GWBrand.red }
        return i <= step ? GWBrand.gold : GWBrand.ivory.opacity(0.22)
    }

    private func dot(_ i: Int) -> some View {
        let current = i == step
        return ZStack {
            Circle().fill(dotColor(i))
            if current {
                Image(systemName: failed ? "xmark" : GWDeliveryStep.icon(i))
                    .font(.system(size: 8, weight: .bold))
                    .foregroundStyle(GWBrand.maroon)
            }
        }
        .frame(width: current ? 18 : 8, height: current ? 18 : 8)
    }
}

/// Elapsed time: live while on the way, fixed once ended.
struct GWElapsed: View {
    let state: GHDeliveryAttributes.ContentState
    var size: CGFloat = 12

    var body: some View {
        if let end = state.endedAt {
            Text(GWFmt.duration(end.timeIntervalSince(state.startedAt)))
                .font(GWFont.number(size, .semibold))
        } else {
            Text(state.startedAt, style: .timer)
                .font(GWFont.number(size, .semibold))
                .multilineTextAlignment(.trailing)
                .frame(width: size * 4.4, alignment: .trailing)
        }
    }
}

/// The lock screen banner of a delivery (on maroon).
struct GWDeliveryLockView: View {
    let attributes: GHDeliveryAttributes
    let state: GHDeliveryAttributes.ContentState

    private var stepText: String {
        if state.failed { return "ما قدرت أسلّم" }
        return GWDeliveryStep.label(state.step)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            top
            GWStepTrack(step: state.step, failed: state.failed)
                .padding(.horizontal, 2)
            bottom
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
    }

    private var top: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(GWBrand.gold.opacity(0.16))
                Image(systemName: attributes.isGift ? "gift.fill" : "car.fill")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(GWBrand.gold)
            }
            .frame(width: 38, height: 38)
            VStack(alignment: .leading, spacing: 1) {
                Text(attributes.name)
                    .font(GWFont.plex(16, .semibold))
                    .foregroundStyle(GWBrand.ivory)
                    .lineLimit(1)
                Text(attributes.area.isEmpty ? attributes.invoiceNo : attributes.area)
                    .font(GWFont.plex(11.5))
                    .foregroundStyle(GWBrand.ivory.opacity(0.62))
                    .lineLimit(1)
            }
            Spacer(minLength: 8)
            GWAmountTag(amount: attributes.amount, size: 14)
        }
    }

    private var bottom: some View {
        HStack(spacing: 6) {
            Text(stepText)
                .font(GWFont.plex(12, .semibold))
                .foregroundStyle(state.failed ? GWHex.color(0xF08A86) : GWBrand.gold)
            Spacer(minLength: 6)
            GWCheetah(onDark: true, height: 9, opacity: 0.75)
            Spacer(minLength: 6)
            Image(systemName: "clock")
                .font(.system(size: 10, weight: .medium))
                .foregroundStyle(GWBrand.ivory.opacity(0.55))
            GWElapsed(state: state, size: 12)
                .foregroundStyle(GWBrand.ivory.opacity(0.8))
        }
    }
}

/// Dynamic Island, compact leading: the car (or gift) in gold.
struct GWDeliveryIslandIcon: View {
    let attributes: GHDeliveryAttributes
    let state: GHDeliveryAttributes.ContentState

    var body: some View {
        Image(systemName: state.failed ? "exclamationmark.triangle.fill" : (state.step >= 3 ? "checkmark.seal.fill" : "car.fill"))
            .font(.system(size: 14, weight: .semibold))
            .foregroundStyle(state.failed ? GWBrand.red : GWBrand.gold)
    }
}

/// Dynamic Island, compact trailing: the amount to collect, or مدفوع.
struct GWDeliveryIslandAmount: View {
    let attributes: GHDeliveryAttributes

    var body: some View {
        Text(attributes.amount > 0 ? GWFmt.amount(attributes.amount) : "مدفوع")
            .font(GWFont.number(13, .semibold))
            .foregroundStyle(GWBrand.gold)
            .lineLimit(1)
            .minimumScaleFactor(0.7)
    }
}

/// Dynamic Island, expanded: name in the middle, the track and time below.
struct GWDeliveryIslandCenter: View {
    let attributes: GHDeliveryAttributes
    let state: GHDeliveryAttributes.ContentState

    var body: some View {
        VStack(spacing: 0) {
            Text(attributes.name)
                .font(GWFont.plex(15, .semibold))
                .foregroundStyle(GWBrand.ivory)
                .lineLimit(1)
            Text(attributes.area)
                .font(GWFont.plex(11))
                .foregroundStyle(GWBrand.ivory.opacity(0.6))
                .lineLimit(1)
        }
    }
}

struct GWDeliveryIslandBottom: View {
    let attributes: GHDeliveryAttributes
    let state: GHDeliveryAttributes.ContentState

    var body: some View {
        VStack(spacing: 8) {
            GWStepTrack(step: state.step, failed: state.failed)
            HStack(spacing: 6) {
                Text(state.failed ? "ما قدرت أسلّم" : GWDeliveryStep.label(state.step))
                    .font(GWFont.plex(11.5, .semibold))
                    .foregroundStyle(GWBrand.gold)
                Spacer(minLength: 4)
                GWElapsed(state: state, size: 11.5)
                    .foregroundStyle(GWBrand.ivory.opacity(0.7))
            }
        }
        .padding(.horizontal, 4)
    }
}

// MARK: - shopping trip

/// The lock screen banner of a shopping trip (on night).
struct GWTripLockView: View {
    let attributes: GHTripAttributes
    let state: GHTripAttributes.ContentState

    private var progress: Double {
        guard state.itemsTotal > 0 else { return 1 }
        return Double(state.itemsTotal - state.itemsLeft) / Double(state.itemsTotal)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            top
            GWProgressLine(value: progress, track: GWBrand.ivory.opacity(0.14), fill: GWBrand.gold, height: 4)
            bottom
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
    }

    private var top: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle().fill(GWBrand.gold.opacity(0.16))
                Image(systemName: "airplane")
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(GWBrand.gold)
            }
            .frame(width: 38, height: 38)
            VStack(alignment: .leading, spacing: 1) {
                Text(attributes.tripName)
                    .font(GWFont.plex(16, .semibold))
                    .foregroundStyle(GWBrand.ivory)
                    .lineLimit(1)
                GWCaps("SHOPPING LIST", color: GWBrand.gold.opacity(0.8), size: 7.5)
            }
            Spacer(minLength: 8)
            VStack(alignment: .trailing, spacing: 0) {
                Text(GWFmt.count(state.itemsLeft))
                    .font(GWFont.number(24, .bold))
                    .foregroundStyle(GWBrand.gold)
                Text("من \(GWFmt.count(state.itemsTotal)) باقية")
                    .font(GWFont.plex(10))
                    .foregroundStyle(GWBrand.ivory.opacity(0.6))
            }
        }
    }

    @ViewBuilder
    private var bottom: some View {
        if state.itemsLeft == 0 {
            HStack(spacing: 6) {
                Image(systemName: "checkmark.seal.fill").foregroundStyle(GWBrand.gold)
                Text("اكتملت القائمة، كل القطع انشرت")
                    .font(GWFont.plex(12.5, .semibold))
                    .foregroundStyle(GWBrand.ivory)
            }
        } else {
            HStack(spacing: 6) {
                Image(systemName: "mappin.circle.fill")
                    .font(.system(size: 12))
                    .foregroundStyle(GWBrand.gold)
                Text(currentText)
                    .font(GWFont.plex(12.5, .semibold))
                    .foregroundStyle(GWBrand.ivory)
                    .lineLimit(1)
                Spacer(minLength: 6)
                if let next = state.nextShop {
                    Text("بعده: \(next)")
                        .font(GWFont.plex(11))
                        .foregroundStyle(GWBrand.ivory.opacity(0.6))
                        .lineLimit(1)
                }
            }
        }
    }

    private var currentText: String {
        guard let shop = state.currentShop else { return "\(GWFmt.count(state.itemsLeft)) قطع باقية" }
        return "\(shop) · \(GWFmt.count(state.currentCount))"
    }
}

/// Dynamic Island, compact trailing: pieces left / total.
struct GWTripIslandCount: View {
    let state: GHTripAttributes.ContentState

    var body: some View {
        Text("\(GWFmt.count(state.itemsLeft))/\(GWFmt.count(state.itemsTotal))")
            .font(GWFont.number(13, .semibold))
            .foregroundStyle(GWBrand.gold)
            .lineLimit(1)
            .minimumScaleFactor(0.7)
    }
}
