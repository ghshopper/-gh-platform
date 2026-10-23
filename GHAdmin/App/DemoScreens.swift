import SwiftUI

/// Screenshot runs: "-demo -screen <key>" opens a page with the demo data.
enum DemoScreens {
    @MainActor
    static func openIfAsked(tab: Binding<Int>) {
        guard let key = DemoData.screen else { return }
        let store = Store.shared
        let order = store.orders.first { $0.activeItems.count > 1 } ?? store.orders.first
        switch key {
        case "today": tab.wrappedValue = 0
        case "orders": tab.wrappedValue = 1
        case "customers": tab.wrappedValue = 2
        case "trips": tab.wrappedValue = 3
        case "more": tab.wrappedValue = 4
        case "order": if let order { pushPage(OrderDetailPage(orderId: order.id)) }
        case "requests": pushPage(RequestsPage())
        default: break
        }
    }
}
