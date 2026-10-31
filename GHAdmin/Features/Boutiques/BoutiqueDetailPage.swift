import SwiftUI

/// One boutique: call / WhatsApp the associate, map, Instagram, hours, tax-free, notes, last visit.
@MainActor
struct BoutiqueDetailPage: View {
    let id: String
    @ObservedObject private var book = BoutiqueBook.shared
    @State private var visiting = false

    var body: some View {
        Group {
            if let b = book.boutique(id) {
                GHPage(b.name, onRefresh: { try? await book.load() }, largeTitle: false, trailing: {
                    NavButton("تعديل") { presentForm(BoutiqueFormPage(boutique: b)) }
                }) {
                    content(b)
                }
            } else {
                GHPage("البوتيك", largeTitle: false) {
                    if book.loaded {
                        EmptyState(icon: "building.2", title: "هذا البوتيك مب موجود", message: "يمكن انحذف من الدليل.")
                    } else {
                        LoadingView()
                    }
                }
            }
        }
        .task { await book.loadIfNeeded() }
    }

    // MARK: content

    @ViewBuilder private func content(_ b: Boutique) -> some View {
        header(b)
        actions(b)

        if b.contactName != nil || b.contactPhone != nil || b.contactInstagram != nil {
            GHSection("الموظف اللي يخدمنا") {
                if let n = b.contactName {
                    Tile(n, subtitle: b.contactPhone.map { "\u{200E}" + $0 }, chevron: false, leading: { Avatar(n) })
                } else if let p = b.contactPhone {
                    Tile("\u{200E}" + p, chevron: false, leading: { IconBox("phone.fill") })
                }
                if let p = b.contactPhone {
                    Tile("واتساب", subtitle: "رسالة سلام قصيرة", action: { whatsApp(b) },
                         onLongPress: { copyText(p, toastText: "انسخ الرقم") },
                         leading: { IconBox("message.fill", color: GH.green) })
                }
                if let ig = b.contactInstagram, let link = b.instagramLink {
                    Tile("انستقرام", value: "@\(ig)", action: { openURL(link) },
                         leading: { IconBox("camera.fill", color: GH.pink) })
                }
            }
        }

        if b.address != nil || b.mapsLink != nil {
            GHSection("المكان") {
                Tile(b.address ?? b.placeLine ?? b.name, subtitle: b.address == nil ? nil : b.placeLine,
                     action: mapAction(b),
                     onLongPress: copyAddress(b),
                     leading: { IconBox("map.fill", color: GH.blue) })
            }
        }

        if let h = b.openingHours {
            GHSection("أوقات الدوام") {
                Text(h).font(TS.body).foregroundStyle(GH.label)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(16)
            }
        }

        GHSection("التاكس فري", footer: b.taxFreeNote) {
            if b.taxFree {
                KV("يعطون تاكس فري", "إي", color: GH.green)
                if let p = b.taxFreePct, p > 0 { KV("النسبة تقريباً", "\(amountText(p))٪") }
            } else {
                KV("يعطون تاكس فري", "لا", color: GH.secondary)
            }
        }

        if let n = b.notes {
            GHSection("ملاحظات") {
                Text(n).font(TS.body).foregroundStyle(GH.label)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(16)
            }
        }

        GHSection("آخر زيارة") {
            KV("آخر مرة رحت", boutiqueVisitText(b.lastVisitAt))
            if let d = b.lastVisitAt { KV("التاريخ", dateStr(d), color: GH.secondary) }
        }
        Pad(top: 14) {
            PrimaryButton("زرته اليوم", icon: "checkmark.circle.fill", busy: visiting,
                          action: isToday(b.lastVisitAt) ? nil : { visited(b) })
        }

        GHSection {
            Tile("حذف البوتيك من الدليل", titleColor: GH.red, chevron: false, action: { remove(b) },
                 leading: { IconBox("trash", color: GH.red) })
        }
    }

    private func header(_ b: Boutique) -> some View {
        Pad(top: 6) {
            HStack(spacing: 14) {
                Avatar(b.brand ?? b.name, size: 54)
                VStack(alignment: .leading, spacing: 4) {
                    Text(b.name).font(.gh(20, .bold)).foregroundStyle(GH.label)
                    let sub = [b.brand, b.placeLine].compactMap { $0 }.joined(separator: " · ")
                    if !sub.isEmpty { Text(sub).font(TS.sub).foregroundStyle(GH.secondary) }
                    if let t = b.taxFreeLabel { Badge(t, color: GH.green) }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    @ViewBuilder private func actions(_ b: Boutique) -> some View {
        let hasPhone = b.contactPhone != nil
        if hasPhone || b.mapsLink != nil || b.instagramLink != nil {
            Pad(top: 16) {
                HStack(spacing: 6) {
                    if hasPhone {
                        QuickAction(icon: "phone.fill", label: "اتصال", action: { callPhone(b.contactPhone) })
                        QuickAction(icon: "message.fill", label: "واتساب", color: GH.green, action: { whatsApp(b) })
                    }
                    if let link = b.mapsLink {
                        QuickAction(icon: "map.fill", label: "الخريطة", color: GH.blue, action: { openURL(link) })
                    }
                    if let link = b.instagramLink {
                        QuickAction(icon: "camera.fill", label: "انستقرام", color: GH.pink, action: { openURL(link) })
                    }
                }
            }
        }
    }

    // MARK: actions

    /// Gulf numbers get an Arabic hello, everyone else English.
    private func whatsApp(_ b: Boutique) {
        let me = Api.shared.session?.name.trimmingCharacters(in: .whitespaces) ?? ""
        let digits = waPhone(b.contactPhone) ?? ""
        let gulf = ["968", "971", "966", "965", "974", "973"].contains { digits.hasPrefix($0) }
        let first = b.contactName?.split(separator: " ").first.map(String.init)
        let text: String
        if gulf {
            text = "هلا\(first.map { " \($0)" } ?? "")، معاك \(me.isEmpty ? "فريق" : me) من GH Shopper. شحالك؟"
        } else {
            text = "Hi\(first.map { " \($0)" } ?? ""), this is \(me.isEmpty ? "the team" : me) from GH Shopper. Hope you are well!"
        }
        openWhatsApp(phone: b.contactPhone, text: text)
    }

    private func mapAction(_ b: Boutique) -> (() -> Void)? {
        guard let link = b.mapsLink else { return nil }
        return { openURL(link) }
    }

    private func copyAddress(_ b: Boutique) -> (() -> Void)? {
        guard let a = b.address else { return nil }
        return { copyText(a, toastText: "انسخ العنوان") }
    }

    private func isToday(_ d: Date?) -> Bool {
        guard let d else { return false }
        return Calendar(identifier: .gregorian).isDateInToday(d)
    }

    private func visited(_ b: Boutique) {
        visiting = true
        Task {
            if await attempt({ _ = try await book.markVisited(b.id) }) {
                Haptic.success()
                toast("سجّلنا زيارتك اليوم")
            }
            visiting = false
        }
    }

    private func remove(_ b: Boutique) {
        Task {
            guard await confirm("نحذف \(b.name) من الدليل؟", message: "بيانات الموظف والملاحظات بتنمسح.") else { return }
            if await attempt({ try await book.delete(b.id) }) {
                toast("انحذف من الدليل")
                popPage()
            }
        }
    }
}
