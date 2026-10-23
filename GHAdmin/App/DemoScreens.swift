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
        case "customer": if let c = store.customers.first(where: { !store.ordersOf($0.id).isEmpty }) ?? store.customers.first { pushPage(CustomerDetailPage(customerId: c.id)) }
        case "trip": if let t = store.trips.first { tab.wrappedValue = 3; pushPage(TripDetailPage(tripId: t.id)) }
        case "summary": tab.wrappedValue = 4; pushPage(SummaryPage())
        case "settings": tab.wrappedValue = 4; pushPage(SettingsPage())
        case "drivers": tab.wrappedValue = 4; pushPage(DriversPage())
        case "products": tab.wrappedValue = 4; pushPage(ProductsPage())
        case "purchases": tab.wrappedValue = 4; pushPage(PurchaseInvoicesPage())
        case "neworder": presentForm(OrderFormPage())
        case "search": pushPage(SearchPage())
        default: break
        }
    }
}
