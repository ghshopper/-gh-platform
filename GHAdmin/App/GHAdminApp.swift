import SwiftUI
import UIKit

@main
struct GHAdminApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    init() {
        Appearance.apply()
    }

    var body: some Scene {
        WindowGroup {
            AuthGate()
                .environment(\.layoutDirection, .rightToLeft)
                .environment(\.locale, Locale(identifier: "ar"))
                .tint(GH.burgundy)
                .font(.gh(16))
        }
    }
}

/// UIKit bars in the brand font and colours.
enum Appearance {
    static func apply() {
        let nav = UINavigationBarAppearance()
        nav.configureWithDefaultBackground()
        nav.backgroundColor = UIColor(GH.bar)
        nav.shadowColor = .clear
        nav.titleTextAttributes = [.font: UIFont.gh(17, .semibold), .foregroundColor: UIColor(GH.label)]
        nav.largeTitleTextAttributes = [.font: UIFont.gh(31, .bold), .foregroundColor: UIColor(GH.label)]
        let button = UIBarButtonItemAppearance()
        button.normal.titleTextAttributes = [.font: UIFont.gh(16.5), .foregroundColor: UIColor(GH.burgundy)]
        nav.buttonAppearance = button
        nav.backButtonAppearance = button
        UINavigationBar.appearance().standardAppearance = nav
        UINavigationBar.appearance().scrollEdgeAppearance = nav
        UINavigationBar.appearance().compactAppearance = nav
        UINavigationBar.appearance().tintColor = UIColor(GH.burgundy)

        let seg = UISegmentedControl.appearance()
        seg.setTitleTextAttributes([.font: UIFont.gh(14)], for: .normal)
        seg.setTitleTextAttributes([.font: UIFont.gh(14, .semibold)], for: .selected)
        UISwitch.appearance().onTintColor = UIColor(GH.burgundy)
    }
}

struct AuthGate: View {
    @ObservedObject private var api = Api.shared
    @ObservedObject private var store = Store.shared

    var body: some View {
        Group {
            if !api.restored {
                ZStack { GH.bg.ignoresSafeArea(); ProgressView() }
            } else if let s = api.session {
                LockGate {
                    if s.isDriver {
                        NavHost { DriverHome(name: s.name) }
                    } else {
                        AdminShell()
                    }
                }
                .id(s.token)
            } else {
                LoginPage()
                    .onAppear { if store.ready { store.clear() }; Nav.shared.popToRoot() }
            }
        }
        .onOpenURL { url in DeepLinks.shared.open(url) }
        .task {
            if DemoData.isOn {
                api.useDemoSession(role: DemoData.role)
                store.loadSnapshot(DemoData.bootstrap)
            } else {
                api.restore()
                await Rates.shared.load()
            }
        }
    }
}

/// Asks for Face ID before showing the app, when the lock is turned on.
struct LockGate<Content: View>: View {
    @ViewBuilder let content: () -> Content
    @State private var locked: Bool? = nil
    @Environment(\.scenePhase) private var phase
    /// Unlocked since the app last went to the background.
    @State private var unlocked = false

    var body: some View {
        ZStack {
            if locked != nil { content() }
            if locked == true {
                ZStack {
                    GH.bg.ignoresSafeArea()
                    VStack(spacing: 28) {
                        GHImage.logo.resizable().scaledToFit().frame(height: 110)
                        PrimaryButton("افتح بالـ Face ID", icon: "lock.open") { Task { await unlock() } }
                            .frame(width: 240)
                    }
                }
                .transition(.opacity)
            }
        }
        .task { await check() }
        .onChange(of: phase) { _, p in
            if p == .background {
                unlocked = false
                if AppLock.isEnabled { locked = true }
            } else if p == .active, locked == true {
                Task { await unlock() }
            }
        }
    }

    private func check() async {
        let on = AppLock.isEnabled && !unlocked && !DemoData.isOn
        locked = on
        if on { await unlock() }
    }

    private func unlock() async {
        if await AppLock.unlock() {
            unlocked = true
            withAnimation { locked = false }
        }
    }
}

/// Bottom tab bar (the old app's rounded white bar).
struct Tabs: View {
    @AppStorage("gh_tab") private var index = 0
    @ObservedObject private var store = Store.shared
    @ObservedObject private var links = DeepLinks.shared
    @ObservedObject private var api = Api.shared
    @Environment(\.horizontalSizeClass) private var sizeClass

    static let items: [(icon: String, selected: String, label: String)] = [
        ("sun.max", "sun.max.fill", "اليوم"),
        ("doc.text", "doc.text.fill", "الطلبات"),
        ("person.2", "person.2.fill", "العملاء"),
        ("airplane", "airplane", "الرحلات"),
        ("square.grid.2x2", "square.grid.2x2.fill", "المزيد"),
    ]
    private var items: [(icon: String, selected: String, label: String)] { Tabs.items }

    /// The tabs this staff role may open (orders → today, orders, trips; customers → customers).
    static func visible(_ a: StaffAccess) -> [Int] {
        items.indices.filter { i in
            switch i {
            case 0, 1: return a.can("orders")
            case 2: return a.can("customers") || a.can("orders")
            case 3: return a.full
            default: return true
            }
        }
    }
    private var visible: [Int] { Tabs.visible(api.access) }

    private var current: Int { visible.contains(index) ? index : (visible.first ?? 4) }

    var body: some View {
        Group {
            if sizeClass == .regular {
                // iPad: the side menu (AdminShell) replaces the bottom bar
                page
            } else {
                page.safeAreaInset(edge: .bottom, spacing: 0) { bar }
            }
        }
        .task {
            if !DemoData.isOn {
                await api.refreshAccess()
                if api.access.can("orders") {
                    await store.start()
                    ShoppingQueue.shared.start() // purchases saved offline in the boutique
                }
                await Push.shared.start()
            } else {
                DemoScreens.openIfAsked(tab: $index)
            }
        }
        .onChange(of: links.tab) { _, t in
            if let t {
                index = t
                DeepLinks.shared.tab = nil
            }
        }
    }

    @ViewBuilder private var page: some View {
        switch current {
        case 0: TodayPage()
        case 1: OrdersPage()
        case 2: CustomersPage()
        case 3: TripsPage()
        default: MorePage()
        }
    }

    /// Unread chats on the Today and More tabs.
    @ViewBuilder private func tabBadge(_ i: Int) -> some View {
        let n = store.chatsUnread
        if n > 0 && (i == 0 || i == 4) {
            Text(n > 99 ? "99+" : "\(n)")
                .font(.gh(10, .semibold)).foregroundStyle(.white)
                .padding(.horizontal, 5).frame(minWidth: 17, minHeight: 17)
                .background(Capsule().fill(GH.red))
                .offset(x: 14, y: -3)
        }
    }

    private var bar: some View {
        HStack(spacing: 0) {
            ForEach(visible, id: \.self) { i in
                Button {
                    Haptic.select()
                    index = i
                } label: {
                    VStack(spacing: 3) {
                        Image(systemName: i == current ? items[i].selected : items[i].icon)
                            .font(.system(size: 19, weight: .regular))
                            .foregroundStyle(i == current ? GH.burgundy : GH.secondary)
                            .frame(width: 56, height: 32)
                            .background(Capsule().fill(i == current ? GH.burgundy.opacity(0.086) : .clear))
                            .overlay(alignment: .top) { tabBadge(i) }
                        Text(items[i].label)
                            .font(.gh(11, i == current ? .semibold : .medium))
                            .foregroundStyle(i == current ? GH.burgundy : GH.secondary)
                    }
                    .frame(maxWidth: .infinity)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .animation(.easeOut(duration: 0.18), value: current)
            }
        }
        .padding(.horizontal, 8).padding(.top, 8).padding(.bottom, 4)
        .background(
            UnevenRoundedRectangle(topLeadingRadius: 24, topTrailingRadius: 24)
                .fill(GH.tabBar)
                .shadow(color: GH.barShadow, radius: 12, y: -6)
                .ignoresSafeArea(edges: .bottom))
    }
}


/// The signed-in staff app: on iPad the side menu stays beside every page (pushed pages open next to it).
struct AdminShell: View {
    @Environment(\.horizontalSizeClass) private var sizeClass
    @AppStorage("gh_tab") private var index = 0
    @ObservedObject private var api = Api.shared
    @ObservedObject private var store = Store.shared

    var body: some View {
        if sizeClass == .regular {
            let visible = Tabs.visible(api.access)
            let current = visible.contains(index) ? index : (visible.first ?? 4)
            HStack(spacing: 0) {
                SideBar(items: Tabs.items, visible: visible, current: current, badge: store.chatsUnread) { i in
                    Haptic.select()
                    index = i
                    Nav.shared.popToRoot()
                }
                Rectangle().fill(GH.separator).frame(width: 0.5).ignoresSafeArea()
                NavHost { Tabs() }.frame(maxWidth: .infinity)
            }
            .background(GH.bg.ignoresSafeArea())
        } else {
            NavHost { Tabs() }
        }
    }
}

/// iPad: the main sections on the side, the brand on top.
private struct SideBar: View {
    let items: [(icon: String, selected: String, label: String)]
    let visible: [Int]
    let current: Int
    let badge: Int
    let pick: (Int) -> Void
    @ObservedObject private var api = Api.shared

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            VStack(alignment: .leading, spacing: 2) {
                Text("GH SHOPPER").font(.gh(15, .semibold)).tracking(3).foregroundStyle(GH.gold)
                Text(api.access.label ?? "لوحة الإدارة").font(.gh(13)).foregroundStyle(GH.secondary)
            }
            .padding(.horizontal, 14).padding(.top, 18).padding(.bottom, 14)
            ForEach(visible, id: \.self) { i in
                Button { pick(i) } label: {
                    HStack(spacing: 12) {
                        Image(systemName: i == current ? items[i].selected : items[i].icon)
                            .font(.system(size: 18))
                            .frame(width: 26)
                        Text(items[i].label).font(.gh(16, i == current ? .semibold : .regular))
                        Spacer(minLength: 0)
                        if badge > 0 && (i == 0 || i == 4) {
                            Text(badge > 99 ? "99+" : "\(badge)")
                                .font(.gh(11, .semibold)).foregroundStyle(.white)
                                .padding(.horizontal, 6).frame(minHeight: 18)
                                .background(Capsule().fill(GH.red))
                        }
                    }
                    .foregroundStyle(i == current ? GH.burgundy : GH.label)
                    .padding(.horizontal, 14).padding(.vertical, 11)
                    .background(RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(i == current ? GH.burgundy.opacity(0.09) : Color.clear))
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 10)
        .frame(width: 250)
        .frame(maxHeight: .infinity, alignment: .top)
        .background(GH.tabBar.ignoresSafeArea())
    }
}
