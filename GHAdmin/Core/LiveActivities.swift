import Foundation
import ActivityKit

/// Lock screen / Dynamic Island activities, started and updated locally by the
/// app (no push tokens):
/// - a driver's delivery: from "استلمت، طالع أوصله" (or scanning the label) to تم التسليم / ما قدرت;
/// - a staff shopping trip: pieces left and the shop to go to now.
@MainActor
enum LiveActivities {
    static var enabled: Bool { ActivityAuthorizationInfo().areActivitiesEnabled }

    // MARK: delivery

    private static func activeDelivery(_ orderId: String) -> Activity<GHDeliveryAttributes>? {
        Activity<GHDeliveryAttributes>.activities.first { $0.attributes.orderId == orderId && $0.activityState == .active }
    }

    /// Starts (or moves forward) the delivery of one order. step: 0 معك · 1 في الطريق · 2 وصلت عند الباب.
    static func delivery(_ o: DriverOrder, step: Int) {
        if DemoData.isOn { return }
        if let a = activeDelivery(o.id) {
            var st = a.content.state
            if step <= st.step && !st.failed { return }
            st.step = step
            st.failed = false
            let content = ActivityContent(state: st, staleDate: nil)
            Task { await a.update(content) }
            return
        }
        guard enabled else { return }
        let attrs = GHDeliveryAttributes(orderId: o.id, invoiceNo: o.invoiceNo, name: o.recipientName,
                                         area: WidgetBridge.area(o), amount: o.toCollect, isGift: o.gift != nil)
        let st = GHDeliveryAttributes.ContentState(step: step, startedAt: Date(), endedAt: nil, failed: false)
        do {
            _ = try Activity<GHDeliveryAttributes>.request(attributes: attrs,
                                                           content: ActivityContent(state: st, staleDate: nil),
                                                           pushType: nil)
        } catch {
            // Live Activities off or too many: the app works the same without it.
        }
    }

    /// تم التسليم (delivered) or ما قدرت: shows the final state for a few minutes, then goes.
    static func deliveryFinished(_ orderId: String, delivered: Bool) {
        guard let a = activeDelivery(orderId) else { return }
        var st = a.content.state
        st.endedAt = Date()
        if delivered {
            st.step = 3
            st.failed = false
        } else {
            st.failed = true
        }
        let content = ActivityContent(state: st, staleDate: nil)
        let until = Date().addingTimeInterval(delivered ? 4 * 60 : 3 * 60)
        Task { await a.end(content, dismissalPolicy: .after(until)) }
    }

    /// After the driver's list reloads: end what is no longer open (or older than 12 hours),
    /// move "معك" to "في الطريق" when the order is picked.
    static func reconcileDeliveries(_ orders: [DriverOrder]) {
        for a in Activity<GHDeliveryAttributes>.activities where a.activityState == .active {
            let id = a.attributes.orderId
            let age = Date().timeIntervalSince(a.content.state.startedAt)
            guard let o = orders.first(where: { $0.id == id }), age < 12 * 3600 else {
                endNow(a)
                continue
            }
            if o.isDone {
                deliveryFinished(id, delivered: true)
            } else if o.isFailed {
                deliveryFinished(id, delivered: false)
            } else if o.status == .picked && a.content.state.step < 1 {
                delivery(o, step: 1)
            }
        }
    }

    private static func endNow(_ a: Activity<GHDeliveryAttributes>) {
        Task { await a.end(nil, dismissalPolicy: .immediate) }
    }

    // MARK: shopping trip

    static func isTracking(_ tripId: String) -> Bool {
        Activity<GHTripAttributes>.activities.contains { $0.attributes.tripId == tripId && $0.activityState == .active }
    }

    /// "تابع الرحلة على شاشة القفل". false when Live Activities are off.
    @discardableResult
    static func startTrip(_ t: Trip) -> Bool {
        if isTracking(t.id) { return true }
        guard enabled else { return false }
        let attrs = GHTripAttributes(tripId: t.id, tripName: t.name)
        let st = WidgetBridge.tripState(t.id)
        do {
            _ = try Activity<GHTripAttributes>.request(attributes: attrs,
                                                       content: ActivityContent(state: st, staleDate: nil),
                                                       pushType: nil)
            return true
        } catch {
            return false
        }
    }

    static func stopTrip(_ tripId: String) {
        for a in Activity<GHTripAttributes>.activities where a.attributes.tripId == tripId {
            Task { await a.end(nil, dismissalPolicy: .immediate) }
        }
    }

    /// After every refresh: pieces left and the current shop; a finished list stays 10 minutes, then goes.
    static func syncTrips() {
        for a in Activity<GHTripAttributes>.activities where a.activityState == .active {
            let tid = a.attributes.tripId
            if Store.shared.trip(tid) == nil {
                Task { await a.end(nil, dismissalPolicy: .immediate) }
                continue
            }
            let st = WidgetBridge.tripState(tid)
            if st == a.content.state { continue }
            let content = ActivityContent(state: st, staleDate: nil)
            if st.itemsLeft == 0 {
                let until = Date().addingTimeInterval(10 * 60)
                Task { await a.end(content, dismissalPolicy: .after(until)) }
            } else {
                Task { await a.update(content) }
            }
        }
    }

    // MARK: launch / sign-out

    /// On launch: a staff phone has no deliveries running; a signed-out phone has nothing.
    static func endStale(_ session: Session?) {
        if DemoData.isOn { return }
        if session?.isDriver != true {
            for a in Activity<GHDeliveryAttributes>.activities {
                Task { await a.end(nil, dismissalPolicy: .immediate) }
            }
        }
        if session == nil || session?.isDriver == true {
            for a in Activity<GHTripAttributes>.activities {
                Task { await a.end(nil, dismissalPolicy: .immediate) }
            }
        }
    }

    static func endAll() {
        for a in Activity<GHDeliveryAttributes>.activities {
            Task { await a.end(nil, dismissalPolicy: .immediate) }
        }
        for a in Activity<GHTripAttributes>.activities {
            Task { await a.end(nil, dismissalPolicy: .immediate) }
        }
    }
}
