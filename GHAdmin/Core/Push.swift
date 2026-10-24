import Foundation
import UIKit
import UserNotifications
import FirebaseCore
import FirebaseMessaging

/// Staff notifications (new order, payment, piece request) through Firebase.
/// Drivers register on their own endpoint and only get their own pushes (new order, handover confirmed).
/// Anything missing or failing is ignored: the app works the same, just without pushes.
@MainActor
final class Push: NSObject, ObservableObject {
    static let shared = Push()

    private var configured = false
    private var sentFor: String?
    /// A notification tapped before the tabs were ready.
    private var pending: [AnyHashable: Any]?

    /// Called at launch (AppDelegate). Never throws.
    func configure() {
        guard !configured, !DemoData.isOn,
              Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil else { return }
        FirebaseApp.configure()
        Messaging.messaging().delegate = self
        UNUserNotificationCenter.current().delegate = self
        configured = true
    }

    /// After sign-in (staff and drivers): ask for permission, send the token to the server.
    func start() async {
        guard configured, Api.shared.session != nil else { return }
        let granted = (try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound])) ?? false
        guard granted else { return }
        UIApplication.shared.registerForRemoteNotifications()
        if let token = try? await Messaging.messaging().token() { await register(token) }
        if let p = pending {
            pending = nil
            try? await Task.sleep(nanoseconds: 700_000_000)
            await open(p)
        }
    }

    func register(_ token: String) async {
        let key = "\(Api.shared.session?.token ?? ""):\(token)"
        guard sentFor != key, let s = Api.shared.session else { return }
        // A driver must never land on the staff list (/ps/push-device is staff only).
        let path = s.isDriver ? "/ps/driver/push-device" : "/ps/push-device"
        if (try? await Api.shared.post(path, ["token": token, "platform": "ios"])) != nil {
            sentFor = key
        }
    }

    private static func icon(_ type: String?) -> String {
        switch type {
        case "payment": return "creditcard.fill"
        case "product_request": return "sparkles"
        case "chat": return "bubble.left.and.bubble.right.fill"
        case "review", "review_service": return "star.fill"
        case "driver_order": return "car.fill"
        case "driver_failed": return "exclamationmark.triangle.fill"
        case "driver_handover", "handover", "handover_confirmed", "handover_rejected": return "banknote.fill"
        default: return "bell.fill"
        }
    }

    /// Opens what a notification is about: the order, or the piece requests.
    func open(_ data: [AnyHashable: Any]) async {
        guard let session = Api.shared.session else { pending = data; return }
        let type = data["type"] as? String
        if session.isDriver {
            await openForDriver(type, data)
            return
        }
        if type == "driver_handover" || type == "handover" {
            Task { await Store.shared.refresh() }
            pushPage(DriversPage())
            return
        }
        if type == "chat" {
            let threadId = (data["thread_id"] as? String) ?? (data["thread_id"] as? NSNumber)?.stringValue
            Task { await Store.shared.refreshChatsUnread() }
            if let threadId, !threadId.isEmpty {
                pushPage(ChatThreadPage(threadId: threadId))
            } else {
                pushPage(ChatsPage())
            }
            return
        }
        let orderId = (data["ps_order_id"] as? String) ?? (data["ps_order_id"] as? NSNumber)?.stringValue
        if type == "product_request" || (orderId ?? "").isEmpty {
            if type == "product_request" {
                Task { await Store.shared.refresh() }
                pushPage(RequestsPage())
            }
            return
        }
        guard let orderId else { return }
        if Store.shared.order(orderId) == nil { await Store.shared.refresh() }
        guard Store.shared.order(orderId) != nil else { return }
        pushPage(OrderDetailPage(orderId: orderId))
    }

    /// Driver pushes: a new order opens it; money (handover) opens حسابي.
    private func openForDriver(_ type: String?, _ data: [AnyHashable: Any]) async {
        let orderId = (data["ps_order_id"] as? String) ?? (data["ps_order_id"] as? NSNumber)?.stringValue
        await DriverData.shared.refresh()
        if let type, type.contains("handover") {
            Nav.shared.popToRoot()
            DriverData.shared.wantTab = 2
            return
        }
        guard let orderId, !orderId.isEmpty else { return }
        guard DriverData.shared.orders.contains(where: { $0.id == orderId }) else { return }
        pushPage(DriverOrderPage(orderId: orderId))
    }

    fileprivate func foreground(_ n: UNNotification) {
        let info = n.request.content.userInfo
        let isDriver = Api.shared.session?.isDriver ?? false
        if let ch = info["channel"] as? String {
            // staff pushes never show on a driver's phone, and the other way round
            if isDriver && ch == "staff" { return }
            if !isDriver && ch != "staff" { return }
        }
        if isDriver {
            Task { await DriverData.shared.refresh() }
        } else {
            Task { await Store.shared.refresh() }
        }
        let text = [n.request.content.title, n.request.content.body].filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }.joined(separator: " · ")
        toast(text.isEmpty ? "إشعار جديد" : text, icon: Push.icon(info["type"] as? String)) {
            Task { await Push.shared.open(info) }
        }
    }
}

extension Push: MessagingDelegate {
    nonisolated func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard let fcmToken else { return }
        Task { @MainActor in await Push.shared.register(fcmToken) }
    }
}

extension Push: UNUserNotificationCenterDelegate {
    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification) async -> UNNotificationPresentationOptions {
        await MainActor.run { Push.shared.foreground(notification) }
        return [.badge, .sound]
    }

    nonisolated func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse) async {
        let info = response.notification.request.content.userInfo
        await Push.shared.open(info)
    }
}

/// Firebase needs the APNs token; push needs the app delegate.
final class AppDelegate: NSObject, UIApplicationDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        MainActor.assumeIsolated { Push.shared.configure() }
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        if FirebaseApp.app() != nil { Messaging.messaging().apnsToken = deviceToken }
    }
}
