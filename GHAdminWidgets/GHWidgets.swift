import SwiftUI
import WidgetKit
import ActivityKit

// GH Shopper widgets: home screen, lock screen and the Live Activities.
// The faces live in /Shared (also drawn by the app's screenshot gallery).

@main
struct GHWidgetBundle: WidgetBundle {
    var body: some Widget {
        GHHomeWidgets().body
        GHLockWidgets().body
        GHLiveWidgets().body
    }
}

struct GHHomeWidgets: WidgetBundle {
    var body: some Widget {
        GHTodayWidget()
        GHAttentionWidget()
        GHMonthWidget()
        GHTripWidget()
        GHLatestWidget()
    }
}

struct GHLockWidgets: WidgetBundle {
    var body: some Widget {
        GHLockTodayWidget()
        GHLockAttentionWidget()
        GHDriverWidget()
    }
}

struct GHLiveWidgets: WidgetBundle {
    var body: some Widget {
        GHDeliveryLiveActivity()
        GHTripLiveActivity()
    }
}

// MARK: - shared modifiers

extension View {
    /// Arabic, right to left, with the brand background.
    func gwWidget(_ style: GWBackgroundStyle) -> some View {
        self
            .environment(\.layoutDirection, .rightToLeft)
            .environment(\.locale, Locale(identifier: "ar"))
            .containerBackground(for: .widget) { GWBackground(style) }
    }

    /// Lock screen: the system draws it (vibrant); only the circle gets the soft disc.
    func gwAccessory(disc: Bool) -> some View {
        self
            .environment(\.layoutDirection, .rightToLeft)
            .environment(\.locale, Locale(identifier: "ar"))
            .containerBackground(for: .widget) {
                if disc { AccessoryWidgetBackground() } else { Color.clear }
            }
    }
}

// MARK: - home screen

struct GHTodayWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "gh.today", provider: GWProvider()) { entry in
            GHTodayFace(entry: entry)
        }
        .configurationDisplayName("اليوم")
        .description("طلبات اليوم ومبيعاته وما ينتظر التحصيل.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

struct GHTodayFace: View {
    let entry: GWEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        if family == .systemMedium {
            GWTodayMedium(state: entry.state).gwWidget(.maroon)
        } else {
            GWTodaySmall(state: entry.state).gwWidget(.maroon)
        }
    }
}

struct GHAttentionWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "gh.attention", provider: GWProvider()) { entry in
            GHAttentionFace(entry: entry)
        }
        .configurationDisplayName("يحتاج انتباهك")
        .description("طلبات القطع والمحادثات والتوصيلات اللي ما تسلّمت والمبالغ.")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}

struct GHAttentionFace: View {
    let entry: GWEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        if family == .systemLarge {
            GWAttentionLarge(state: entry.state).gwWidget(.paper)
        } else {
            GWAttentionMedium(state: entry.state).gwWidget(.paper)
        }
    }
}

struct GHMonthWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "gh.month", provider: GWProvider()) { entry in
            GWMonthSmall(state: entry.state).gwWidget(.paper)
        }
        .configurationDisplayName("الشهر")
        .description("مبيعات الشهر والربح التقريبي.")
        .supportedFamilies([.systemSmall])
    }
}

struct GHTripWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "gh.trip", provider: GWProvider()) { entry in
            GHTripFace(entry: entry)
        }
        .configurationDisplayName("رحلة الشراء")
        .description("القطع الباقية في الرحلة والمحلات.")
        .supportedFamilies([.systemMedium, .systemLarge])
    }
}

struct GHTripFace: View {
    let entry: GWEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        if family == .systemLarge {
            GWTripLarge(state: entry.state).gwWidget(.paper)
        } else {
            GWTripMedium(state: entry.state).gwWidget(.paper)
        }
    }
}

struct GHLatestWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "gh.latest", provider: GWProvider()) { entry in
            GWLatestLarge(state: entry.state).gwWidget(.paper)
        }
        .configurationDisplayName("آخر الطلبات")
        .description("آخر خمس طلبات وحالتها.")
        .supportedFamilies([.systemLarge])
    }
}

// MARK: - lock screen

struct GHLockTodayWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "gh.lock.today", provider: GWProvider()) { entry in
            GHLockTodayFace(entry: entry)
        }
        .configurationDisplayName("اليوم")
        .description("طلبات اليوم ومبيعاته على شاشة القفل.")
        .supportedFamilies([.accessoryRectangular, .accessoryInline])
    }
}

struct GHLockTodayFace: View {
    let entry: GWEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        if family == .accessoryInline {
            GWLockInline(state: entry.state).gwAccessory(disc: false)
        } else {
            GWLockRect(state: entry.state).gwAccessory(disc: false)
        }
    }
}

struct GHLockAttentionWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "gh.lock.attention", provider: GWProvider()) { entry in
            GWLockCircular(state: entry.state).gwAccessory(disc: true)
        }
        .configurationDisplayName("المحادثات")
        .description("المحادثات غير المقروءة أو طلبات القطع الجديدة.")
        .supportedFamilies([.accessoryCircular])
    }
}

struct GHDriverWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "gh.driver", provider: GWProvider()) { entry in
            GHDriverFace(entry: entry)
        }
        .configurationDisplayName("توصيلاتي")
        .description("التوصيلات الباقية والكاش اللي معك والتوصيلة الجاية.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])
    }
}

struct GHDriverFace: View {
    let entry: GWEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        switch family {
        case .accessoryRectangular:
            GWDriverLockRect(state: entry.state).gwAccessory(disc: false)
        case .systemMedium:
            GWDriverMedium(state: entry.state).gwWidget(.night)
        default:
            GWDriverSmall(state: entry.state).gwWidget(.night)
        }
    }
}

// MARK: - Live Activities

struct GHDeliveryLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: GHDeliveryAttributes.self) { context in
            GWDeliveryLockView(attributes: context.attributes, state: context.state)
                .environment(\.layoutDirection, .rightToLeft)
                .environment(\.locale, Locale(identifier: "ar"))
                .activityBackgroundTint(GWBrand.maroon)
                .activitySystemActionForegroundColor(GWBrand.gold)
                .widgetURL(GWLink.driverOrder(context.attributes.orderId))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    GWDeliveryIslandIcon(attributes: context.attributes, state: context.state)
                        .padding(.leading, 6)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    GWDeliveryIslandAmount(attributes: context.attributes)
                        .padding(.trailing, 6)
                }
                DynamicIslandExpandedRegion(.center) {
                    GWDeliveryIslandCenter(attributes: context.attributes, state: context.state)
                        .environment(\.layoutDirection, .rightToLeft)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    GWDeliveryIslandBottom(attributes: context.attributes, state: context.state)
                        .environment(\.layoutDirection, .rightToLeft)
                        .environment(\.locale, Locale(identifier: "ar"))
                }
            } compactLeading: {
                GWDeliveryIslandIcon(attributes: context.attributes, state: context.state)
            } compactTrailing: {
                GWDeliveryIslandAmount(attributes: context.attributes)
            } minimal: {
                GWDeliveryIslandIcon(attributes: context.attributes, state: context.state)
            }
            .widgetURL(GWLink.driverOrder(context.attributes.orderId))
            .keylineTint(GWBrand.gold)
        }
    }
}

struct GHTripLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: GHTripAttributes.self) { context in
            GWTripLockView(attributes: context.attributes, state: context.state)
                .environment(\.layoutDirection, .rightToLeft)
                .environment(\.locale, Locale(identifier: "ar"))
                .activityBackgroundTint(GWBrand.night)
                .activitySystemActionForegroundColor(GWBrand.gold)
                .widgetURL(GWLink.trip(context.attributes.tripId))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Image(systemName: "airplane")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(GWBrand.gold)
                        .padding(.leading, 6)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    GWTripIslandCount(state: context.state)
                        .padding(.trailing, 6)
                }
                DynamicIslandExpandedRegion(.center) {
                    Text(context.attributes.tripName)
                        .font(GWFont.plex(15, .semibold))
                        .foregroundStyle(GWBrand.ivory)
                        .lineLimit(1)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    GHTripIslandBottom(state: context.state)
                        .environment(\.layoutDirection, .rightToLeft)
                }
            } compactLeading: {
                Image(systemName: "bag.fill")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(GWBrand.gold)
            } compactTrailing: {
                GWTripIslandCount(state: context.state)
            } minimal: {
                Text(GWFmt.count(context.state.itemsLeft))
                    .font(GWFont.number(13, .bold))
                    .foregroundStyle(GWBrand.gold)
            }
            .widgetURL(GWLink.trip(context.attributes.tripId))
            .keylineTint(GWBrand.gold)
        }
    }
}

struct GHTripIslandBottom: View {
    let state: GHTripAttributes.ContentState

    private var progress: Double {
        guard state.itemsTotal > 0 else { return 1 }
        return Double(state.itemsTotal - state.itemsLeft) / Double(state.itemsTotal)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            GWProgressLine(value: progress, track: GWBrand.ivory.opacity(0.14), fill: GWBrand.gold, height: 4)
            HStack(spacing: 6) {
                Image(systemName: "mappin.circle.fill")
                    .font(.system(size: 12))
                    .foregroundStyle(GWBrand.gold)
                Text(state.currentShop ?? "اكتملت القائمة")
                    .font(GWFont.plex(12, .semibold))
                    .foregroundStyle(GWBrand.ivory)
                    .lineLimit(1)
                Spacer(minLength: 4)
                if let next = state.nextShop {
                    Text("بعده: \(next)")
                        .font(GWFont.plex(10.5))
                        .foregroundStyle(GWBrand.ivory.opacity(0.6))
                        .lineLimit(1)
                }
            }
        }
        .padding(.horizontal, 4)
    }
}
