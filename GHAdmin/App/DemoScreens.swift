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
        case "chats": tab.wrappedValue = 4; pushPage(ChatsPage())
        case "chat": tab.wrappedValue = 4; pushPage(ChatThreadPage(threadId: "1", title: "مريم البلوشية"))
        case "features": tab.wrappedValue = 4; pushPage(FeaturesPage())
        case "reviews": tab.wrappedValue = 4; pushPage(ReviewsPage())
        case "giftcard":
            if let o = store.orders.first(where: { $0.gift != nil }) ?? order {
                presentForm(GiftCardPage(gift: o.gift))
            }
        case "invoicepdf", "waybillpdf", "giftinvoicepdf":
            let pick: Order? = key == "giftinvoicepdf" ? (store.orders.first { $0.gift != nil } ?? order) : order
            if let o = pick {
                let c = store.customer(o.customerId)
                let data = key == "waybillpdf"
                    ? buildWaybillPdf(o, customer: c, biz: store.settings, driverName: store.driver(o.driverId)?.name)
                    : buildInvoicePdf(o, customer: c, biz: store.settings)
                presentForm(DemoPdfPreview(data: data))
            }
        default: break
        }
    }

    /// Driver role ("driver:<key>" in ci/screens.txt): today · past · money · order (the gift) · failed · route.
    @MainActor
    static func openDriverIfAsked(tab: Binding<Int>) {
        guard let key = DemoData.screen else { return }
        let orders = DriverData.shared.orders
        switch key {
        case "today", "home": tab.wrappedValue = 0
        case "past": tab.wrappedValue = 1
        case "money": tab.wrappedValue = 2
        case "order":
            let o = orders.first { $0.gift != nil && !$0.isDone } ?? orders.first { !$0.isDone }
            if let o { pushPage(DriverOrderPage(orderId: o.id)) }
        case "picked":
            if let o = orders.first(where: { $0.status == .picked }) { pushPage(DriverOrderPage(orderId: o.id)) }
        case "failed":
            if let o = orders.first(where: { $0.isFailed }) { pushPage(DriverOrderPage(orderId: o.id)) }
        case "route": pushPage(DriverRoutePage())
        default: break
        }
    }
}


import PDFKit

/// Screenshot helper: shows a generated PDF's first page full screen.
struct DemoPdfPreview: UIViewRepresentable {
    let data: Data
    func makeUIView(context: Context) -> PDFView {
        let v = PDFView()
        v.document = PDFDocument(data: data)
        v.autoScales = true
        v.displayMode = .singlePage
        v.backgroundColor = .darkGray
        return v
    }
    func updateUIView(_ uiView: PDFView, context: Context) {}
}
