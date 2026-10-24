import SwiftUI

// Screenshot pages (demo keys "widgets" and "liveactivity"): every widget face and
// the Live Activity banners drawn inside the app with sample data, since CI can't
// put widgets on the simulator's home screen. Also the trip page's
// "تابع الرحلة على شاشة القفل" row.

/// A widget-sized card: the face on its background, with the home screen's corner and margin.
fileprivate struct WGFrame<Content: View>: View {
    let width: CGFloat
    let height: CGFloat
    let style: GWBackgroundStyle
    @ViewBuilder let content: () -> Content

    var body: some View {
        content()
            .padding(16)
            .frame(width: width, height: height)
            .background(GWBackground(style))
            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
            .ghShadow()
    }
}

fileprivate enum WGSize {
    static let small = CGSize(width: 158, height: 158)
    static let medium = CGSize(width: 338, height: 158)
    static let large = CGSize(width: 338, height: 354)
}

fileprivate struct WGCaption: View {
    let text: String
    let caps: String

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text(text)
                .font(.gh(15, .semibold))
                .foregroundStyle(GH.label)
            Spacer(minLength: 8)
            GWCaps(caps, color: GH.gold, size: 9)
        }
        .padding(.horizontal, 20)
        .padding(.top, 22)
        .padding(.bottom, 10)
    }
}

/// A dark wallpaper like the lock screen, for the accessory widgets and Live Activities.
fileprivate struct WGLockWallpaper<Content: View>: View {
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(spacing: 14) {
            content()
        }
        .padding(.vertical, 18)
        .padding(.horizontal, 12)
        .frame(maxWidth: .infinity)
        .background(
            LinearGradient(colors: [GWHex.color(0x3B2A26), GWHex.color(0x120C0B)], startPoint: .top, endPoint: .bottom)
        )
        .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
        .environment(\.colorScheme, .dark)
        .padding(.horizontal, 16)
    }
}

/// The lock screen clock, so the accessories read in context.
fileprivate struct WGClock: View {
    let inline: GWState

    var body: some View {
        VStack(spacing: 0) {
            GWLockInline(state: inline)
                .font(GWFont.plex(14, .medium))
                .foregroundStyle(Color.white.opacity(0.85))
                .lineLimit(1)
            Text(verbatim: "9:41")
                .font(.system(size: 78, weight: .semibold, design: .rounded))
                .foregroundStyle(Color.white.opacity(0.92))
                .environment(\.layoutDirection, .leftToRight)
        }
    }
}

struct WidgetGalleryPage: View {
    private let staff = GWState.sampleStaff
    private let driver = GWState.sampleDriver

    init() {}

    var body: some View {
        GHPage("الودجت") {
            WGCaption(text: "الشاشة الرئيسية", caps: "HOME SCREEN")
            smallRow
            mediums
            larges
            WGCaption(text: "شاشة القفل", caps: "LOCK SCREEN")
            lockPanel
            WGCaption(text: "المندوب", caps: "DRIVER")
            driverWidgets
        }
    }

    private var smallRow: some View {
        HStack(spacing: 20) {
            WGFrame(width: WGSize.small.width, height: WGSize.small.height, style: .maroon) {
                GWTodaySmall(state: staff)
            }
            WGFrame(width: WGSize.small.width, height: WGSize.small.height, style: .paper) {
                GWMonthSmall(state: staff)
            }
        }
        .frame(maxWidth: .infinity)
    }

    private var mediums: some View {
        VStack(spacing: 20) {
            WGFrame(width: WGSize.medium.width, height: WGSize.medium.height, style: .paper) {
                GWAttentionMedium(state: staff)
            }
            WGFrame(width: WGSize.medium.width, height: WGSize.medium.height, style: .maroon) {
                GWTodayMedium(state: staff)
            }
            WGFrame(width: WGSize.medium.width, height: WGSize.medium.height, style: .paper) {
                GWTripMedium(state: staff)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 20)
    }

    private var larges: some View {
        VStack(spacing: 20) {
            WGFrame(width: WGSize.large.width, height: WGSize.large.height, style: .paper) {
                GWAttentionLarge(state: staff)
            }
            WGFrame(width: WGSize.large.width, height: WGSize.large.height, style: .paper) {
                GWTripLarge(state: staff)
            }
            WGFrame(width: WGSize.large.width, height: WGSize.large.height, style: .paper) {
                GWLatestLarge(state: staff)
            }
            HStack(spacing: 20) {
                WGFrame(width: WGSize.small.width, height: WGSize.small.height, style: .paper) {
                    GWAttentionMedium(state: GWState.signedOut)
                }
                WGFrame(width: WGSize.small.width, height: WGSize.small.height, style: .maroon) {
                    GWTodaySmall(state: driver)
                }
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 20)
    }

    private var lockPanel: some View {
        WGLockWallpaper {
            WGClock(inline: staff)
            HStack(spacing: 10) {
                GWLockCircular(state: staff)
                    .foregroundStyle(Color.white)
                    .frame(width: 72, height: 72)
                    .background(Circle().fill(Color.white.opacity(0.14)))
                GWLockRect(state: staff)
                    .foregroundStyle(Color.white)
                    .frame(width: 170, height: 72)
            }
            GWDriverLockRect(state: driver)
                .foregroundStyle(Color.white)
                .frame(width: 170, height: 72)
        }
    }

    private var driverWidgets: some View {
        VStack(spacing: 20) {
            HStack(spacing: 20) {
                WGFrame(width: WGSize.small.width, height: WGSize.small.height, style: .night) {
                    GWDriverSmall(state: driver)
                }
                WGFrame(width: WGSize.small.width, height: WGSize.small.height, style: .night) {
                    GWDriverSmall(state: staff)
                }
            }
            WGFrame(width: WGSize.medium.width, height: WGSize.medium.height, style: .night) {
                GWDriverMedium(state: driver)
            }
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Live Activities gallery

/// A Live Activity banner as it sits on the lock screen.
fileprivate struct WGBanner<Content: View>: View {
    let tint: Color
    @ViewBuilder let content: () -> Content

    var body: some View {
        content()
            .frame(maxWidth: .infinity)
            .background(tint)
            .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
    }
}

/// The Dynamic Island, compact (pill) and expanded.
fileprivate struct WGIslandCompact<Leading: View, Trailing: View>: View {
    @ViewBuilder let leading: () -> Leading
    @ViewBuilder let trailing: () -> Trailing

    var body: some View {
        HStack(spacing: 0) {
            leading().frame(width: 44)
            Spacer(minLength: 96)
            trailing().frame(minWidth: 44)
        }
        .padding(.horizontal, 10)
        .frame(width: 250, height: 37)
        .background(Capsule().fill(Color.black))
    }
}

struct LiveActivityGalleryPage: View {
    private let delivery = GWLiveSample.delivery
    private let onTheWay = GWLiveSample.deliveryState
    private var atDoor: GHDeliveryAttributes.ContentState {
        GHDeliveryAttributes.ContentState(step: 2, startedAt: Date().addingTimeInterval(-26 * 60), endedAt: nil, failed: false)
    }
    private var done: GHDeliveryAttributes.ContentState {
        GHDeliveryAttributes.ContentState(step: 3, startedAt: Date().addingTimeInterval(-31 * 60), endedAt: Date(), failed: false)
    }
    private var paidDelivery: GHDeliveryAttributes {
        GHDeliveryAttributes(orderId: "d2", invoiceNo: "241002", name: "سارة الهنائية", area: "العذيبة", amount: 0, isGift: false)
    }

    init() {}

    var body: some View {
        GHPage("الأنشطة المباشرة") {
            WGCaption(text: "التوصيل", caps: "LIVE ACTIVITY")
            WGLockWallpaper {
                WGBanner(tint: GWBrand.maroon) {
                    GWDeliveryLockView(attributes: delivery, state: onTheWay)
                }
                WGBanner(tint: GWBrand.maroon) {
                    GWDeliveryLockView(attributes: paidDelivery, state: atDoor)
                }
                WGBanner(tint: GWBrand.maroon) {
                    GWDeliveryLockView(attributes: delivery, state: done)
                }
            }
            WGCaption(text: "الجزيرة الديناميكية", caps: "DYNAMIC ISLAND")
            island
            WGCaption(text: "رحلة الشراء", caps: "SHOPPING TRIP")
            WGLockWallpaper {
                WGBanner(tint: GWBrand.night) {
                    GWTripLockView(attributes: GWLiveSample.trip, state: GWLiveSample.tripState)
                }
                WGIslandCompact(leading: {
                    Image(systemName: "bag.fill")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(GWBrand.gold)
                }, trailing: {
                    GWTripIslandCount(state: GWLiveSample.tripState)
                })
            }
        }
    }

    private var island: some View {
        VStack(spacing: 14) {
            WGIslandCompact(leading: {
                GWDeliveryIslandIcon(attributes: delivery, state: onTheWay)
            }, trailing: {
                GWDeliveryIslandAmount(attributes: delivery)
            })
            expanded
        }
        .frame(maxWidth: .infinity)
        .environment(\.colorScheme, .dark)
    }

    private var expanded: some View {
        VStack(spacing: 12) {
            HStack(alignment: .top) {
                GWDeliveryIslandIcon(attributes: delivery, state: onTheWay)
                Spacer(minLength: 8)
                GWDeliveryIslandCenter(attributes: delivery, state: onTheWay)
                Spacer(minLength: 8)
                GWDeliveryIslandAmount(attributes: delivery)
            }
            GWDeliveryIslandBottom(attributes: delivery, state: onTheWay)
        }
        .padding(.horizontal, 22)
        .padding(.vertical, 16)
        .frame(width: 361)
        .background(RoundedRectangle(cornerRadius: 42, style: .continuous).fill(Color.black))
    }
}

// MARK: - trip page: follow on the lock screen

/// "تابع الرحلة على شاشة القفل" on a trip with pieces still to buy.
struct TripLiveRow: View {
    let trip: Trip
    @State private var on = false
    @ObservedObject private var store = Store.shared

    init(trip: Trip) { self.trip = trip }

    var body: some View {
        let left = WidgetBridge.tripState(trip.id).itemsLeft
        Group {
            if on || left > 0 {
                GHSection(footer: on ? "تتحدث لحالها كل ما تشتري قطعة، وتختفي لما تكتمل القائمة." : nil) {
                    row
                }
            }
        }
        .onAppear { on = LiveActivities.isTracking(trip.id) }
        .onChange(of: store.syncing) { _, _ in on = LiveActivities.isTracking(trip.id) }
    }

    @ViewBuilder
    private var row: some View {
        if on {
            Tile("إيقاف المتابعة على شاشة القفل", titleColor: GH.red, chevron: false,
                 action: { stop() },
                 leading: { IconBox("xmark.circle.fill", color: GH.red) })
        } else {
            Tile("تابع الرحلة على شاشة القفل", subtitle: "القطع الباقية والمحل اللي بعده", chevron: false,
                 action: { start() },
                 leading: { IconBox("lock.fill", color: GH.gold) })
        }
    }

    private func start() {
        if LiveActivities.startTrip(trip) {
            Haptic.success()
            on = true
            toast("الرحلة على شاشة القفل ✓")
        } else {
            toast("فعّل «الأنشطة المباشرة» لـ GH Shopper من الإعدادات", error: true)
        }
    }

    private func stop() {
        LiveActivities.stopTrip(trip.id)
        Haptic.light()
        on = false
    }
}
