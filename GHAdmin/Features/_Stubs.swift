import SwiftUI

// Temporary pages so the core compiles; each is replaced by its real port.
struct TodayPage: View { var body: some View { GHPage("اليوم") { GHSection("مرحبا") { Tile("اليوم") } } } }
struct OrdersPage: View { var body: some View { GHPage("الطلبات") { EmptyState(icon: "doc.text", title: "الطلبات") } } }
struct CustomersPage: View { var body: some View { GHPage("العملاء") { EmptyState(icon: "person.2", title: "العملاء") } } }
struct TripsPage: View { var body: some View { GHPage("الرحلات") { EmptyState(icon: "airplane", title: "الرحلات") } } }
struct MorePage: View { var body: some View { GHPage("المزيد") { EmptyState(icon: "square.grid.2x2", title: "المزيد") } } }
struct DriverHome: View { let name: String; var body: some View { GHPage("طلباتي") { Text(name) } } }
struct RequestsPage: View { var body: some View { GHPage("طلبات القطع") { EmptyState(icon: "sparkles", title: "طلبات القطع") } } }
struct OrderDetailPage: View { let orderId: String; var body: some View { GHPage("الطلب") { Text(orderId) } } }
