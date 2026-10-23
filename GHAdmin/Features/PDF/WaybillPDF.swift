import UIKit

// Port of pdf_waybill.dart: the waybill / shipping label, 100 × 150 mm
// (standard label-printer size). The QR is the order's tracking link: the
// driver scans it to pick the parcel up, and a customer who scans it sees the
// tracking page.

/// Label page size (100 × 150 mm).
let ghWaybillPageSize = CGSize(width: 100 * ghPdfMM, height: 150 * ghPdfMM)

private enum WC {
    static var ink: UIColor { .black }
    static var muted: UIColor { UIColor(hex: 0xFF555555) }
    static var white: UIColor { .white }
}

private func wt(_ s: String, _ size: CGFloat, _ w: GHWeight = .regular, _ c: UIColor? = nil,
                kern: CGFloat = 0, ltr: Bool = false, maxLines: Int = 0) -> GHPdfText {
    GHPdfText(s, size: size, weight: w, color: c ?? WC.ink, kern: kern, ltr: ltr, maxLines: maxLines)
}

/// Small English label then the Arabic one (a pw.Row in RTL: English on the right).
private struct Kicker {
    let en: GHPdfText
    let ar: GHPdfText
    let enSize: CGSize
    let arSize: CGSize

    init(_ ar: String, _ en: String) {
        self.en = wt(en, 5.6, .regular, WC.muted, kern: 1.4)
        self.ar = wt(ar, 6.8, .medium, WC.muted)
        self.enSize = self.en.size(maxWidth: 1000)
        self.arSize = self.ar.size(maxWidth: 1000)
    }

    var width: CGFloat { enSize.width + 4 + arSize.width }
    var height: CGFloat { max(enSize.height, arSize.height) }

    func draw(right: CGFloat, y: CGFloat) {
        let h = height
        en.draw(in: CGRect(x: right - enSize.width, y: y + (h - enSize.height) / 2,
                           width: enSize.width, height: enSize.height))
        let arX = right - enSize.width - 4 - arSize.width
        ar.draw(in: CGRect(x: arX, y: y + (h - arSize.height) / 2,
                           width: arSize.width, height: arSize.height))
    }
}

private func digits(_ s: String) -> String {
    String(s.filter { $0.isASCII && $0.isNumber })
}

private func samePhone(_ a: String, _ b: String?) -> Bool {
    func last8(_ v: String) -> String {
        let d = digits(v)
        return d.count >= 8 ? String(d.suffix(8)) : ""
    }
    let x = last8(a)
    guard let b, !x.isEmpty else { return false }
    let rest = a.filter { !(($0.isASCII && $0.isNumber) || $0.isWhitespace || $0 == "+") }
    return rest.isEmpty && x == last8(b)
}

private func phoneText(_ p: String) -> String {
    let d = digits(p)
    let local = (d.count == 11 && d.hasPrefix("968")) ? String(d.dropFirst(3)) : d
    if local.count == 8 {
        return "+968 \(local.prefix(4)) \(local.suffix(4))"
    }
    return p
}

/// The Genacom office written first in the address by the server, and the
/// address without it.
private func splitOffice(_ address: String?) -> (office: String?, address: String?) {
    guard let address else { return (nil, nil) }
    let pattern = "^استلام من مكتب جيناكم: ([^،]+?)(?: \\(([^)]*)\\))?(?:،|$)"
    guard let re = try? NSRegularExpression(pattern: pattern, options: []) else { return (nil, address) }
    let ns = address as NSString
    guard let m = re.firstMatch(in: address, options: [], range: NSRange(location: 0, length: ns.length)) else {
        return (nil, address)
    }
    let g1 = m.range(at: 1)
    let office: String? = g1.location == NSNotFound ? nil : ns.substring(with: g1)
    let rest = ns.substring(from: NSMaxRange(m.range)).trimmingCharacters(in: .whitespacesAndNewlines)
    return (office, rest.isEmpty ? nil : rest)
}

/// The address without what is printed elsewhere (name, phone, map link).
private func cleanAddress(_ address: String?, customer: Customer?) -> String? {
    guard let address else { return nil }
    var drop = Set<String>()
    if let n = customer?.name.trimmingCharacters(in: .whitespacesAndNewlines), !n.isEmpty { drop.insert(n) }
    if let p = customer?.phone?.trimmingCharacters(in: .whitespacesAndNewlines), !p.isEmpty { drop.insert(p) }
    var text = address
    if let re = try? NSRegularExpression(pattern: "https?://\\S+", options: []) {
        let ns = text as NSString
        text = re.stringByReplacingMatches(in: text, options: [], range: NSRange(location: 0, length: ns.length),
                                           withTemplate: "")
    }
    let separators = CharacterSet(charactersIn: "،,·")
    let parts = text.components(separatedBy: separators)
        .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
        .filter { !$0.isEmpty && !drop.contains($0) && !samePhone($0, customer?.phone) }
    return parts.isEmpty ? nil : parts.joined(separator: "، ")
}

/// Big band at the top: how this parcel travels (what the packer sorts by).
private func route(_ method: DeliveryMethod?, office: String?) -> (ar: String, en: String) {
    let carrier = method?.carrierName ?? ""
    switch method {
    case .genacomOffice?, .noolOffice?:
        let at = office.map { " · \($0)" } ?? ""
        return ("استلام من مكتب \(carrier)\(at)", "OFFICE PICKUP")
    case .gccGenacom?, .gccDhl?:
        return ("شحن خليجي · \(carrier) · لباب البيت", "GCC · COURIER · DOOR")
    case .genacom?, .nool?:
        return ("\(carrier) · لباب البيت", "COURIER · DOOR")
    default:
        return ("مندوب GH · لباب البيت", "GH DRIVER · DOOR")
    }
}

/// Builds the waybill PDF (one 100 × 150 mm page).
func buildWaybillPdf(_ o: Order, customer: Customer?, biz: BusinessSettings, driverName: String? = nil) -> Data {
    let pageW = ghWaybillPageSize.width
    let pageH = ghWaybillPageSize.height
    let margin: CGFloat = 4.5 * ghPdfMM
    let L = margin
    let W = pageW - 2 * margin
    let R = L + W
    let bottom = pageH - margin

    let waybill = o.waybillNo
    let trackUrl = o.trackingToken.map { AppConfig.trackingBaseUrl + $0 } ?? "https://ghshopper.com"
    let collect = o.toCollect > 0
    let pieces = o.activeItems.count
    let split = splitOffice(o.deliveryAddress ?? customer?.address)
    let office = split.office
    let address = cleanAddress(split.address, customer: customer)
    let r = route(o.deliveryMethod, office: office)
    let logo = GHImage.named("logo")

    let format = UIGraphicsPDFRendererFormat()
    format.documentInfo = [kCGPDFContextTitle as String: "Waybill \(waybill)"]
    let renderer = UIGraphicsPDFRenderer(bounds: CGRect(x: 0, y: 0, width: pageW, height: pageH), format: format)

    return renderer.pdfData { ctx in
        ctx.beginPage()
        var y = margin

        // Brand and label title
        do {
            var title = GHPdfStack()
            title.add(wt("بوليصة شحن", 11, .bold))
            title.add(wt("SHIPPING LABEL", 5.8, .regular, WC.muted, kern: 1.6))
            let tw = title.width(maxWidth: W)
            let th = title.height(width: tw)
            var logoW: CGFloat = 0
            if let logo, logo.size.height > 0 { logoW = 30 * logo.size.width / logo.size.height }
            let h = max(th, 30)
            title.draw(x: R - tw, y: y + (h - th) / 2, width: tw)
            ghPdfDrawImage(logo, fitIn: CGRect(x: L, y: y + (h - 30) / 2, width: logoW, height: 30))
            y += h
        }
        // rule(t: 1.2)
        y += 5
        ghPdfFill(CGRect(x: L, y: y, width: W, height: 1.2), WC.ink)
        y += 1.2 + 5

        // How it travels
        do {
            let inner = W - 16
            let en = wt(r.en, 6, .regular, WC.white, kern: 1.2, ltr: true)
            let enSize = en.size(maxWidth: inner / 2)
            let arW = max(inner - 6 - enSize.width, 1)
            let ar = wt(r.ar, 12.5, .bold, WC.white, maxLines: 2)
            let arH = ar.size(maxWidth: arW).height
            let rowH = max(arH, enSize.height)
            let h = rowH + 12
            ghPdfFill(CGRect(x: L, y: y, width: W, height: h), WC.ink)
            ar.draw(right: R - 8, y: y + 6 + (rowH - arH) / 2, maxWidth: arW)
            en.draw(in: CGRect(x: L + 8, y: y + 6 + (rowH - enSize.height) / 2,
                               width: enSize.width, height: enSize.height))
            y += h
        }
        y += 7

        // Recipient and QR
        do {
            let qrLabel = wt("امسح للتتبّع", 6, .regular, WC.muted)
            let qrLabelSize = qrLabel.size(maxWidth: W / 2)
            let qrColW = max(74, qrLabelSize.width)
            let leftW = max(W - 8 - qrColW, 1)
            let kicker = Kicker("المستلم", "SHIP TO")
            var info = GHPdfStack()
            info.add(wt(customer?.name ?? "—", 15, .bold, maxLines: 2))
            if let phone = customer?.phone {
                info.add(wt(phoneText(phone), 14, .medium, ltr: true))
            }
            info.gap(3)
            if let office {
                info.add(wt("يستلم من مكتب جيناكم \(office)", 9, .bold, maxLines: 2))
            } else if let city = customer?.city {
                info.add(wt(city, 10, .bold))
            }
            if let address {
                info.add(wt(address, 8.2, .regular, maxLines: 4))
            }
            let infoH = info.height(width: leftW)
            let leftH = kicker.height + 3 + infoH
            let qrH = 74 + 3 + qrLabelSize.height
            kicker.draw(right: R, y: y)
            info.draw(x: R - leftW, y: y + kicker.height + 3, width: leftW)
            let qrX = L + (qrColW - 74) / 2
            ghPdfDrawQR(trackUrl, in: CGRect(x: qrX, y: y, width: 74, height: 74), color: WC.ink)
            qrLabel.draw(in: CGRect(x: L + (qrColW - qrLabelSize.width) / 2, y: y + 77,
                                    width: qrLabelSize.width, height: qrLabelSize.height))
            y += max(leftH, qrH)
        }
        // rule()
        y += 5
        ghPdfFill(CGRect(x: L, y: y, width: W, height: 0.6), WC.ink)
        y += 0.6 + 5

        // Cash to collect / prepaid
        do {
            let inner = W - 16
            var col = GHPdfStack()
            col.add(wt(collect ? "حصّل عند التسليم" : "مدفوع · لا تحصّل شيء", 10.5, .bold,
                       collect ? WC.white : WC.ink))
            col.add(wt(collect ? "CASH ON DELIVERY" : "PREPAID", 5.8, .regular,
                       collect ? WC.white : WC.muted, kern: 1.4))
            let amount = wt(omrLatin(o.toCollect), 16, .bold, WC.white, ltr: true)
            let aSize = collect ? amount.size(maxWidth: inner / 2) : CGSize.zero
            let colW = col.width(maxWidth: max(inner - aSize.width, 1))
            let colH = col.height(width: colW)
            let rowH = max(colH, aSize.height)
            let box = CGRect(x: L, y: y, width: W, height: rowH + 12)
            if collect { ghPdfFill(box, WC.ink) }
            ghPdfStroke(box, WC.ink, width: 1)
            col.draw(x: R - 8 - colW, y: y + 6 + (rowH - colH) / 2, width: colW)
            if collect {
                amount.draw(in: CGRect(x: L + 8, y: y + 6 + (rowH - aSize.height) / 2,
                                       width: aSize.width, height: aSize.height))
            }
            y += box.height
        }
        y += 7

        // Order facts
        do {
            let third = W / 3
            let facts: [(Kicker, GHPdfText)] = [
                (Kicker("الفاتورة", "INVOICE"), wt(o.invoiceNo, 9, .medium, ltr: true)),
                (Kicker("القطع", "PIECES"), wt("\(pieces)", 9, .medium)),
                (Kicker("التاريخ", "DATE"), wt(dateStr(o.createdAt), 9, .medium)),
            ]
            var rowH: CGFloat = 0
            for (i, f) in facts.enumerated() {
                let right = R - CGFloat(i) * third
                f.0.draw(right: right, y: y)
                let s = f.1.draw(right: right, y: y + f.0.height, maxWidth: third)
                rowH = max(rowH, f.0.height + s.height)
            }
            y += rowH
        }
        if let tracking = o.carrierTracking, !o.carrierIsLink {
            y += 5
            let kicker = Kicker("رقم الشحنة", "SHIPMENT")
            let t = wt(tracking, 9.5, .bold, ltr: true)
            let ts = t.size(maxWidth: max(W - kicker.width, 1))
            let rowH = max(kicker.height, ts.height)
            kicker.draw(right: R, y: y + (rowH - kicker.height) / 2)
            t.draw(in: CGRect(x: L, y: y + (rowH - ts.height) / 2, width: ts.width, height: ts.height))
            y += rowH
        }
        if driverName != nil || o.driverNote != nil {
            y += 5
            if let driverName {
                let s = wt("المندوب: \(driverName)", 8, .medium).draw(right: R, y: y, maxWidth: W)
                y += s.height
            }
            if let note = o.driverNote {
                let s = wt("ملاحظة: \(note)", 8, .medium, maxLines: 2).draw(right: R, y: y, maxWidth: W)
                y += s.height
            }
        }

        // pw.Spacer(): the rest sits at the bottom of the label.
        // Sender
        let fromKicker = Kicker("المرسل", "FROM")
        var senderParts: [String] = [biz.companyName ?? "GH Shopper"]
        if let p = biz.phone { senderParts.append(p) }
        if let i = biz.instagram { senderParts.append(i) }
        let senderW = max(W - fromKicker.width - 6, 1)
        let sender = wt(senderParts.joined(separator: "  ·  "), 7.5, .medium, maxLines: 1)
        let senderSize = sender.size(maxWidth: senderW)
        let senderH = max(fromKicker.height, senderSize.height)
        let senderTop = bottom - senderH
        fromKicker.draw(right: R, y: senderTop + (senderH - fromKicker.height) / 2)
        sender.draw(in: CGRect(x: R - fromKicker.width - 6 - senderSize.width,
                               y: senderTop + (senderH - senderSize.height) / 2,
                               width: senderSize.width, height: senderSize.height))
        // rule(t: 1.2)
        let ruleTop = senderTop - 5 - 1.2
        ghPdfFill(CGRect(x: L, y: ruleTop, width: W, height: 1.2), WC.ink)
        // Waybill number
        let number = wt(waybill, 13, .bold, kern: 2, ltr: true)
        let numberSize = number.size(maxWidth: W)
        let numberTop = ruleTop - 5 - numberSize.height
        number.draw(in: CGRect(x: L + (W - numberSize.width) / 2, y: numberTop,
                               width: numberSize.width, height: numberSize.height))
        // Waybill barcode
        let barTop = numberTop - 2 - 36
        ghPdfDrawCode128(waybill, in: CGRect(x: L, y: barTop, width: W, height: 36), color: WC.ink)
    }
}

/// Keeps the label paper size when the print sheet picks a paper.
private final class WaybillPrintDelegate: NSObject, UIPrintInteractionControllerDelegate {
    let pageSize: CGSize

    init(pageSize: CGSize) {
        self.pageSize = pageSize
        super.init()
    }

    func printInteractionController(_ printInteractionController: UIPrintInteractionController,
                                    choosePaper paperList: [UIPrintPaper]) -> UIPrintPaper {
        UIPrintPaper.bestPaper(forPageSize: pageSize, withPapersFrom: paperList)
    }
}

private final class WaybillPrintOnce {
    var done = false
}

/// Opens the iOS print sheet (AirPrint label printer, or Save as PDF).
@MainActor
func printWaybill(_ o: Order, customer: Customer?, biz: BusinessSettings, driverName: String? = nil) async {
    let data = buildWaybillPdf(o, customer: customer, biz: biz, driverName: driverName)
    let controller = UIPrintInteractionController.shared
    let info = UIPrintInfo(dictionary: nil)
    info.outputType = .general
    info.orientation = .portrait
    info.jobName = "Waybill \(o.waybillNo)"
    controller.printInfo = info
    controller.printingItem = data
    let delegate = WaybillPrintDelegate(pageSize: ghWaybillPageSize)
    controller.delegate = delegate
    let once = WaybillPrintOnce()
    await withCheckedContinuation { (cont: CheckedContinuation<Void, Never>) in
        let finish: () -> Void = {
            if once.done { return }
            once.done = true
            cont.resume()
        }
        let shown = controller.present(animated: true) { _, _, _ in finish() }
        if !shown { finish() }
    }
    if controller.delegate === delegate { controller.delegate = nil }
}
