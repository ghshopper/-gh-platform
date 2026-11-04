import PDFKit
import SwiftUI
import UIKit

// Printing many orders at once: invoices (white page for a home printer),
// waybills (10 × 15 cm) or packing slips (A5, no prices), all in one PDF and
// one AirPrint job.

enum BulkPrintKind: String, CaseIterable, Hashable {
    case invoices, waybills, slips

    var label: String {
        switch self {
        case .invoices: return "الفواتير"
        case .waybills: return "البوليصات"
        case .slips: return "قوائم التغليف"
        }
    }

    var pageSize: CGSize {
        switch self {
        case .waybills: return ghWaybillPageSize
        case .invoices, .slips: return CGSize(width: 148 * ghPdfMM, height: 210 * ghPdfMM)
        }
    }
}

/// All the pages of several PDFs in one document.
func mergePdfs(_ parts: [Data]) -> Data {
    let out = PDFDocument()
    for d in parts {
        guard let doc = PDFDocument(data: d) else { continue }
        for i in 0..<doc.pageCount {
            if let p = doc.page(at: i) { out.insert(p, at: out.pageCount) }
        }
    }
    return out.dataRepresentation() ?? Data()
}

@MainActor
func buildBulkPdf(_ orders: [Order], kind: BulkPrintKind) -> Data {
    let s = Store.shared
    let parts: [Data] = orders.map { o in
        let c = s.customer(o.customerId)
        switch kind {
        case .invoices: return buildInvoicePdf(o, customer: c, biz: s.settings, forPrint: true)
        case .waybills: return buildWaybillPdf(o, customer: c, biz: s.settings, driverName: s.driver(o.driverId)?.name)
        case .slips: return buildPackingSlipPdf(o, customer: c, biz: s.settings, driverName: s.driver(o.driverId)?.name)
        }
    }
    return parts.count == 1 ? parts[0] : mergePdfs(parts)
}

private final class BulkPrintDelegate: NSObject, UIPrintInteractionControllerDelegate {
    let pageSize: CGSize
    init(pageSize: CGSize) { self.pageSize = pageSize; super.init() }
    func printInteractionController(_ c: UIPrintInteractionController, choosePaper paperList: [UIPrintPaper]) -> UIPrintPaper {
        UIPrintPaper.bestPaper(forPageSize: pageSize, withPapersFrom: paperList)
    }
}

private final class BulkOnce { var done = false }

/// Asks print or share, builds one PDF for all the orders and sends it.
@MainActor
func bulkPrint(_ orders: [Order], kind: BulkPrintKind) async {
    guard !orders.isEmpty else { return }
    let how: String? = await pickAction(title: "\(kind.label) · \(orders.count) طلب", actions: [
        SheetAction("اطبع (AirPrint)", "print"),
        SheetAction("شارك PDF", "share"),
    ])
    guard let how else { return }
    toast("لحظة… نجهز \(orders.count) \(kind == .waybills ? "بوليصة" : kind == .invoices ? "فاتورة" : "قائمة")")
    await Task.yield()
    let data = buildBulkPdf(orders, kind: kind)
    if how == "share" {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("GH-\(kind.rawValue)-\(orders.count).pdf")
        do { try data.write(to: url, options: .atomic) } catch { toastError(error); return }
        share([url])
    } else {
        let controller = UIPrintInteractionController.shared
        let info = UIPrintInfo(dictionary: nil)
        info.outputType = kind == .invoices ? .grayscale : .general
        info.orientation = .portrait
        info.jobName = "GH \(kind.label) (\(orders.count))"
        controller.printInfo = info
        controller.printingItem = data
        let delegate = BulkPrintDelegate(pageSize: kind.pageSize)
        controller.delegate = delegate
        let once = BulkOnce()
        await withCheckedContinuation { (cont: CheckedContinuation<Void, Never>) in
            let finish: () -> Void = { if once.done { return }; once.done = true; cont.resume() }
            if !controller.present(animated: true, completionHandler: { _, _, _ in finish() }) { finish() }
        }
        if controller.delegate === delegate { controller.delegate = nil }
    }
    if kind == .waybills {
        for o in orders where o.labelPrintedAt == nil { try? await Store.shared.markLabelPrinted(o.id) }
    }
}

// MARK: - Packing slip (A5, no prices)

private enum PS {
    static let maroon = UIColor(hex: 0xFF350304)
    static let gold = UIColor(hex: 0xFF8A6A2E)
    static let hair = UIColor(hex: 0xFFE6DCCF)
    static let grey = UIColor(hex: 0xFF777777)
    static let ink = UIColor(hex: 0xFF1A1A1A)
}

/// Draws text right-aligned (RTL) or left-aligned in a column; returns its height.
@discardableResult
private func psText(_ s: String, _ font: UIFont, _ color: UIColor, x: CGFloat, y: CGFloat, w: CGFloat,
                    align: NSTextAlignment = .right, ltr: Bool = false) -> CGFloat {
    let p = NSMutableParagraphStyle()
    p.alignment = align
    p.baseWritingDirection = ltr ? .leftToRight : .rightToLeft
    p.lineBreakMode = .byWordWrapping
    let a = NSAttributedString(string: s, attributes: [.font: font, .foregroundColor: color, .paragraphStyle: p])
    let r = a.boundingRect(with: CGSize(width: w, height: .greatestFiniteMagnitude), options: [.usesLineFragmentOrigin, .usesFontLeading], context: nil)
    a.draw(with: CGRect(x: x, y: y, width: w, height: ceil(r.height)), options: [.usesLineFragmentOrigin, .usesFontLeading], context: nil)
    return ceil(r.height)
}

private func psLine(_ y: CGFloat, _ x: CGFloat, _ w: CGFloat, _ color: UIColor = PS.hair, _ h: CGFloat = 0.6) {
    ghPdfFill(CGRect(x: x, y: y, width: w, height: h), color)
}

func buildPackingSlipPdf(_ o: Order, customer: Customer?, biz: BusinessSettings, driverName: String?) -> Data {
    let mm = ghPdfMM
    let pageW = 148 * mm, pageH = 210 * mm
    let L = 10 * mm, W = pageW - 20 * mm, R = L + W
    let bottom = pageH - 12 * mm
    let items = o.activeItems
    let g = o.gift
    let to = g?.to?.trimmingCharacters(in: .whitespaces).nilIfEmpty ?? customer?.name ?? "—"
    let phone = g?.phone?.nilIfEmpty ?? customer?.phone
    let address = o.deliveryAddress?.nilIfEmpty ?? customer?.address
    let how: String? = o.driverId != nil ? "مندوبنا" + (driverName.map { " · \($0)" } ?? "") : o.deliveryMethod?.label
    let track = o.trackingToken.map { AppConfig.trackingBaseUrl + $0 }
    let logo = GHImage.named("logo")

    let renderer = UIGraphicsPDFRenderer(bounds: CGRect(x: 0, y: 0, width: pageW, height: pageH))
    return renderer.pdfData { ctx in
        var y: CGFloat = 0
        var page = 0

        func header() {
            ctx.beginPage()
            page += 1
            y = 10 * mm
            ghPdfDrawImage(logo, fitIn: CGRect(x: R - 22 * mm, y: y, width: 22 * mm, height: 13 * mm))
            psText("قائمة التغليف", ghPdfPlex(5, .semibold), PS.maroon, x: L, y: y, w: 70 * mm, align: .left)
            psText("PACKING SLIP", ghPdfPlex(2.2, .medium), PS.gold, x: L, y: y + 7.5 * mm, w: 70 * mm, align: .left, ltr: true)
            y += 15 * mm
            psLine(y, L, W, PS.maroon, 1.1)
            y += 3 * mm
            let meta = "الطلب #\(o.invoiceNo)    ·    التاريخ \(dateStr(o.createdAt))    ·    \(items.count) قطعة" + (page > 1 ? "    ·    تابع" : "")
            y += psText(meta, ghPdfPlex(3.3, .medium), PS.ink, x: L, y: y, w: W)
            y += 2.5 * mm
            psLine(y, L, W)
            y += 3 * mm
        }

        header()

        // ship to + QR
        let qrSize = 21 * mm
        let colW = W - (track == nil ? 0 : qrSize + 4 * mm)
        let top = y
        y += psText(g != nil ? "إلى (هدية) · SHIP TO" : "إلى · SHIP TO", ghPdfPlex(2.7, .medium), PS.gold, x: R - colW, y: y, w: colW)
        y += psText(to, ghPdfPlex(4.6, .semibold), PS.ink, x: R - colW, y: y + 0.5 * mm, w: colW) + 0.5 * mm
        if let phone { y += psText(phone, ghPdfPlex(3.6, .medium), PS.ink, x: R - colW, y: y, w: colW) }
        if let address { y += psText(address, ghPdfPlex(3.1), PS.ink, x: R - colW, y: y + 0.5 * mm, w: colW) + 0.5 * mm }
        if let how { y += psText("التوصيل: \(how)", ghPdfPlex(3.1, .semibold), PS.maroon, x: R - colW, y: y + 0.8 * mm, w: colW) + 0.8 * mm }
        if g != nil, let from = customer?.name, from != to { y += psText("من: \(from)", ghPdfPlex(3.1), PS.grey, x: R - colW, y: y, w: colW) }
        if let track {
            ghPdfDrawQR(track, in: CGRect(x: L, y: top, width: qrSize, height: qrSize))
            y = max(y, top + qrSize)
        }
        y += 3 * mm
        psLine(y, L, W)
        y += 2.5 * mm

        // items
        let nW = 7 * mm, qW = 12 * mm, cW = 9 * mm
        let nameW = W - nW - qW - cW
        func itemsHead() {
            psText("#", ghPdfPlex(2.7, .medium), PS.gold, x: R - nW, y: y, w: nW)
            psText("القطعة", ghPdfPlex(2.7, .medium), PS.gold, x: R - nW - nameW, y: y, w: nameW)
            psText("العدد", ghPdfPlex(2.7, .medium), PS.gold, x: L + cW, y: y, w: qW, align: .center)
            psText("✓", ghPdfPlex(2.7, .medium), PS.gold, x: L, y: y, w: cW, align: .center)
            y += 5 * mm
            psLine(y, L, W, UIColor(hex: 0xFFCFB98F))
            y += 2 * mm
        }
        itemsHead()
        for (n, i) in items.enumerated() {
            var h: CGFloat = 0
            let brandFont = ghPdfPlex(2.5, .semibold), nameFont = ghPdfPlex(3.5, .medium), detFont = ghPdfPlex(2.9)
            // measure first so a piece never splits across pages
            func measure(_ s: String, _ f: UIFont) -> CGFloat {
                ceil(NSAttributedString(string: s, attributes: [.font: f]).boundingRect(with: CGSize(width: nameW, height: .greatestFiniteMagnitude), options: [.usesLineFragmentOrigin, .usesFontLeading], context: nil).height)
            }
            h = (i.brand.map { measure($0.uppercased(), brandFont) } ?? 0) + measure(i.name, nameFont) + (i.details.map { measure($0, detFont) } ?? 0)
            if y + h + 4 * mm > bottom - 30 * mm && n > 0 { header(); itemsHead() }
            let rowTop = y
            psText("\(n + 1)", ghPdfPlex(3.2), PS.grey, x: R - nW, y: rowTop, w: nW)
            var yy = rowTop
            if let b = i.brand { yy += psText(b.uppercased(), brandFont, PS.ink, x: R - nW - nameW, y: yy, w: nameW) }
            yy += psText(i.name, nameFont, PS.ink, x: R - nW - nameW, y: yy, w: nameW)
            if let d = i.details { yy += psText(d, detFont, PS.grey, x: R - nW - nameW, y: yy, w: nameW) }
            psText("1", ghPdfPlex(3.4, .medium), PS.ink, x: L + cW, y: rowTop, w: qW, align: .center, ltr: true)
            let box = CGRect(x: L + (cW - 4.4 * mm) / 2, y: rowTop + 0.6 * mm, width: 4.4 * mm, height: 4.4 * mm)
            let path = UIBezierPath(roundedRect: box, cornerRadius: 1 * mm)
            PS.maroon.setStroke(); path.lineWidth = 0.9; path.stroke()
            y = max(yy, rowTop + 6 * mm) + 2 * mm
            psLine(y, L, W)
            y += 2.5 * mm
        }

        // gift, note, checks, footer
        if g?.message?.nilIfEmpty != nil || g?.wrap == true {
            if y + 26 * mm > bottom { header() }
            y += 1.5 * mm
            let boxTop = y
            var yy = y + 2.5 * mm
            yy += psText("رسالة الهدية" + (g?.wrap == true ? " · تغليف هدية" : ""), ghPdfPlex(2.8, .semibold), PS.gold, x: L + 3 * mm, y: yy, w: W - 6 * mm)
            if let m = g?.message?.nilIfEmpty { yy += psText(m, ghPdfPlex(3.4), PS.ink, x: L + 3 * mm, y: yy + 1 * mm, w: W - 6 * mm) + 1 * mm }
            yy += 2.5 * mm
            let path = UIBezierPath(roundedRect: CGRect(x: L, y: boxTop, width: W, height: yy - boxTop), cornerRadius: 1.5 * mm)
            path.setLineDash([3, 2], count: 2, phase: 0)
            UIColor(hex: 0xFFCFB98F).setStroke(); path.lineWidth = 0.8; path.stroke()
            y = yy + 3 * mm
        }
        if let note = o.driverNote?.nilIfEmpty {
            y += psText("ملاحظة التوصيل: \(note)", ghPdfPlex(3.1), PS.ink, x: L, y: y, w: W) + 2 * mm
        }
        if y + 18 * mm > bottom { header() }
        y += psText("☐ القطع كاملة      ☐ الكرتون والأكياس      ☐ الفاتورة / الكرت", ghPdfPlex(3.1), PS.ink, x: L, y: y + 1 * mm, w: W) + 4 * mm
        psLine(y, L, W)
        y += 2.5 * mm
        let company = biz.companyName ?? "GH Shopper"
        psText("شكرًا لأنك اخترت \(company)", ghPdfPlex(2.9, .medium), PS.gold, x: L, y: y, w: W, align: .center)
        let contact = [biz.phone, biz.instagram.map { "@" + $0.replacingOccurrences(of: "@", with: "") }].compactMap { $0?.nilIfEmpty }.joined(separator: "  ·  ")
        if !contact.isEmpty { psText(contact, ghPdfPlex(2.7), PS.gold, x: L, y: y + 5 * mm, w: W, align: .center, ltr: true) }
    }
}

private extension String {
    var nilIfEmpty: String? {
        let t = trimmingCharacters(in: .whitespacesAndNewlines)
        return t.isEmpty ? nil : t
    }
}
