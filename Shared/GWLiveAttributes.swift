import Foundation
import ActivityKit

// Live Activities: defined once, compiled into the app (which starts and updates
// them locally) and the widget extension (which draws them).

/// A driver on the way to one order.
struct GHDeliveryAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        /// 0 معك · 1 في الطريق · 2 وصلت عند الباب · 3 تم التسليم
        var step: Int
        var startedAt: Date
        /// Set when the activity ends (delivered or couldn't deliver).
        var endedAt: Date?
        /// "ما قدرت" (couldn't deliver).
        var failed: Bool
    }

    var orderId: String
    var invoiceNo: String
    /// The customer, or the gift's recipient.
    var name: String
    var area: String
    /// What to collect at the door; 0 = already paid.
    var amount: Double
    var isGift: Bool
}

/// The staff's shopping trip (the trip's shopping list on the lock screen).
struct GHTripAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var itemsLeft: Int
        var itemsTotal: Int
        /// The first shop still on the list, and how many pieces there.
        var currentShop: String?
        var currentCount: Int
        /// The shop after it.
        var nextShop: String?
        var shopsLeft: Int
    }

    var tripId: String
    var tripName: String
}

/// The delivery steps, in order.
enum GWDeliveryStep {
    static let labels = ["معك", "في الطريق", "وصلت عند الباب", "تم التسليم"]

    static func label(_ step: Int) -> String {
        let i = min(max(step, 0), labels.count - 1)
        return labels[i]
    }

    static let icons = ["shippingbox.fill", "car.fill", "mappin.and.ellipse", "checkmark.seal.fill"]

    static func icon(_ step: Int) -> String {
        let i = min(max(step, 0), icons.count - 1)
        return icons[i]
    }
}

enum GWLiveSample {
    static let delivery = GHDeliveryAttributes(orderId: "d1", invoiceNo: "241001", name: "نورة السالمي",
                                               area: "الخوير", amount: 45.5, isGift: true)
    static var deliveryState: GHDeliveryAttributes.ContentState {
        GHDeliveryAttributes.ContentState(step: 1, startedAt: Date().addingTimeInterval(-14 * 60), endedAt: nil, failed: false)
    }

    static let trip = GHTripAttributes(tripId: "demo-trip", tripName: "ميلان أكتوبر")
    static let tripState = GHTripAttributes.ContentState(itemsLeft: 9, itemsTotal: 21, currentShop: "Dior Montenapoleone",
                                                         currentCount: 3, nextShop: "Louis Vuitton", shopsLeft: 5)
}
