import UIKit

// Port of pdf_waybill.dart: the waybill / shipping label, 100 × 150 mm
// (standard label-printer size). The QR is the order's tracking link: the
// driver scans it to pick the parcel up, and a customer who scans it sees the
// tracking page.

/// Label page size (100 × 150 mm).
let ghWaybillPageSize = CGSize(width: 100 * ghPdfMM, height: 150 * ghPdfMM)

/// Thermal label printers print black only: everything on the label is
/// pure black on white (white text inside the cash block).
private enum WC {
    static var ink: UIColor { UIColor(red: 0, green: 0, blue: 0, alpha: 1) }
    static var paper: UIColor { UIColor(red: 1, green: 1, blue: 1, alpha: 1) }
}

/// One printer dot at 203 dpi (the usual thermal label resolution), in points.
private let waybillDot: CGFloat = 72.0 / 203.0

private func mm(_ v: CGFloat) -> CGFloat { v * ghPdfMM }

/// IBM Plex text; size and letter-spacing in mm; black unless a colour is given.
private func wp(_ s: String, _ size: CGFloat, _ w: GHWeight = .regular, _ c: UIColor? = nil,
                kern: CGFloat = 0, lh: CGFloat? = nil, align: NSTextAlignment = .right,
                ltr: Bool = false, maxLines: Int = 0) -> GHPdfPara {
    GHPdfPara(s, ghPdfPlex(size, w), c ?? WC.ink, kern: mm(kern), lh: lh, align: align, ltr: ltr,
              maxLines: maxLines)
}

/// Small spaced English label (.en): medium, letter-spaced.
private func wen(_ s: String, size: CGFloat = 1.65, kern: CGFloat = 0.5, color: UIColor? = nil,
                 align: NSTextAlignment = .left) -> GHPdfPara {
    wp(s, size, .medium, color, kern: kern, align: align, ltr: true)
}

/// The Arabic label then its English one, on one baseline (.lab).
private func wlab(_ ar: String, _ en: String) -> GHPdfInline {
    GHPdfInline([wp(ar, 2.15, .medium), wen(en, size: 1.5, kern: 0.45)], gap: mm(1.6))
}

/// A piece of a vertical stack: its height (with the space above it) and how to draw it.
private struct WBPiece {
    let height: CGFloat
    let draw: (CGFloat) -> Void
}

private func wbRule(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat) {
    ghPdfFill(CGRect(x: x, y: y, width: w, height: mm(0.25)), WC.ink)
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
    let L = mm(5)
    let W = pageW - 2 * L
    let R = L + W
    let bottom = pageH - mm(4.5)

    let waybill = o.waybillNo
    let trackUrl = o.trackingToken.map { AppConfig.trackingBaseUrl + $0 } ?? "https://ghshopper.com"
    let collect = o.toCollect > 0
    let pieces = o.activeItems.count
    let split = splitOffice(o.deliveryAddress ?? customer?.address)
    let office = split.office
    let address = cleanAddress(split.address, customer: customer)
    let r = route(o.deliveryMethod, office: office)
    // The gold cheetah printed as a black silhouette.
    let cheetah = GHImage.named("story_cheetah").map { waybillSilhouette($0) }
    // A gift goes to its recipient: their name and phone on the label.
    let gift = o.gift
    let recipientName = gift?.to ?? customer?.name ?? "—"
    let recipientPhone = gift?.phone ?? customer?.phone

    let format = UIGraphicsPDFRendererFormat()
    format.documentInfo = [kCGPDFContextTitle as String: "Waybill \(waybill)"]
    let renderer = UIGraphicsPDFRenderer(bounds: CGRect(x: 0, y: 0, width: pageW, height: pageH), format: format)

    return renderer.pdfData { ctx in
        ctx.beginPage()
        ghPdfFill(CGRect(x: 0, y: 0, width: pageW, height: pageH), WC.paper)
        var y = mm(5)

        // Label title (right) and brand mark (left)
        do {
            let tAr = wp("بوليصة شحن", 3.6, lh: 1.1)
            let tEn = wen("SHIPPING LABEL")
            let tW = max(tAr.width(), tEn.width())
            let tH = tAr.lineBox + mm(0.6) + tEn.lineBox
            let brand = GHPdfPara("GH SHOPPER", ghPdfSerif(3.1, weight: 600), WC.ink, kern: mm(1),
                                  align: .left, ltr: true)
            let imgW = mm(12)
            var imgH: CGFloat = 0
            if let c = cheetah, c.size.width > 0 { imgH = imgW * c.size.height / c.size.width }
            let bmH = max(brand.lineBox, imgH)
            let headH = max(tH, bmH)
            let tTop = y + (headH - tH) / 2
            tAr.drawLine(right: R, baseline: tTop + tAr.firstBaseline)
            tEn.drawLine(left: R - tW, baseline: tTop + tAr.lineBox + mm(0.6) + tEn.firstBaseline)
            let bmTop = y + (headH - bmH) / 2
            if let c = cheetah, imgH > 0 {
                c.draw(in: CGRect(x: L, y: bmTop + (bmH - imgH) / 2, width: imgW, height: imgH))
            }
            brand.draw(x: L + imgW + mm(2.4), y: bmTop + (bmH - brand.lineBox) / 2, width: brand.width())
            y += headH + mm(2.6)
        }
        wbRule(L, y, W)
        y += mm(0.25)

        // How it travels
        do {
            let en = wen(r.en, size: 1.9, kern: 0.6)
            let enW = en.width()
            let arW = max(W - enW - mm(3), 1)
            let ar = wp(r.ar, 5.2, .medium, lh: 1.25, maxLines: 2)
            let arH = ar.height(width: arW)
            let rowH = max(arH, en.lineBox)
            y += mm(2.8)
            ar.draw(x: R - arW, y: y + (rowH - arH) / 2, width: arW)
            en.draw(x: L, y: y + (rowH - en.lineBox) / 2, width: enW)
            y += rowH + mm(2.6)
        }
        wbRule(L, y, W)
        y += mm(0.25)

        // Recipient (right) and QR (left)
        do {
            y += mm(3.4)
            let qrSize = mm(27)
            let whoW = W - qrSize - mm(4)
            var who: [WBPiece] = []
            let shipTo = wlab("المستلم", "SHIP TO")
            who.append(WBPiece(height: shipTo.height + mm(1.2)) { t in shipTo.draw(right: R, top: t) })
            if gift != nil {
                let tag = GHPdfInline([wp("هدية", 3.2, .medium), wen("GIFT")], gap: mm(1.6))
                who.append(WBPiece(height: mm(0.4) + tag.height + mm(0.8)) { t in
                    tag.draw(right: R, top: t + mm(0.4))
                })
            }
            let name = wp(recipientName, 5.6, lh: 1.25, maxLines: 2)
            who.append(WBPiece(height: name.height(width: whoW)) { t in name.draw(x: R - whoW, y: t, width: whoW) })
            if let phone = recipientPhone {
                let ph = wp(phoneText(phone), 5.2, .medium, kern: 0.15, ltr: true)
                who.append(WBPiece(height: mm(0.4) + ph.lineBox) { t in
                    ph.draw(x: R - whoW, y: t + mm(0.4), width: whoW)
                })
            }
            var place: GHPdfPara? = nil
            if let office {
                place = wp("يستلم من مكتب جيناكم \(office)", 3.3, .medium, lh: 1.35, maxLines: 2)
            } else if let city = customer?.city {
                place = wp(city, 3.3, .medium, lh: 1.35)
            }
            if let place {
                who.append(WBPiece(height: mm(2.4) + place.height(width: whoW)) { t in
                    place.draw(x: R - whoW, y: t + mm(2.4), width: whoW)
                })
            }
            if let address {
                let ad = wp(address, 2.85, lh: 1.55, maxLines: 4)
                who.append(WBPiece(height: mm(0.6) + ad.height(width: whoW)) { t in
                    ad.draw(x: R - whoW, y: t + mm(0.6), width: whoW)
                })
            }
            var wy = y
            for piece in who {
                piece.draw(wy)
                wy += piece.height
            }
            ghPdfDrawQR(trackUrl, in: CGRect(x: L, y: y, width: qrSize, height: qrSize), color: WC.ink,
                        correction: "M", snap: waybillDot)
            let cap = wp("امسح للتتبّع", 2, align: .center)
            cap.draw(x: L, y: y + qrSize + mm(1.4), width: qrSize)
            let qrColH = qrSize + mm(1.4) + cap.lineBox
            y += max(wy - y, qrColH) + mm(3.4)
        }

        // Cash to collect / prepaid: a solid black block, white text
        do {
            y += mm(0.4)
            let ar = wp(collect ? "حصّل عند التسليم" : "مدفوع", 4.4, .medium, WC.paper, lh: 1.2)
            let en = wen(collect ? "CASH ON DELIVERY" : "PREPAID", kern: 0.6, color: WC.paper)
            let colW = max(ar.width(), en.width())
            let rightH = ar.lineBox + mm(0.8) + en.lineBox
            let amount = wp(plainOmr(o.toCollect), 7.4, .medium, WC.paper, kern: 0.1, lh: 1, align: .left, ltr: true)
            let unit = wp("OMR", 2, .medium, WC.paper, kern: 0.5, align: .left, ltr: true)
            let sub = wp("لا تحصّل أي مبلغ", 2.6, .regular, WC.paper)
            let leftH = collect ? amount.lineBox : sub.lineBox
            let innerH = max(rightH, leftH)
            let boxH = mm(3.4) + innerH + mm(3.6)
            ghPdfFill(CGRect(x: L, y: y, width: W, height: boxH), WC.ink)
            let inTop = y + mm(3.4)
            let rTop = inTop + (innerH - rightH) / 2
            ar.drawLine(right: R - mm(4.5), baseline: rTop + ar.firstBaseline)
            en.drawLine(left: R - mm(4.5) - colW, baseline: rTop + ar.lineBox + mm(0.8) + en.firstBaseline)
            let lTop = inTop + (innerH - leftH) / 2
            if collect {
                let base = lTop + amount.firstBaseline
                amount.drawLine(left: L + mm(4.5), baseline: base)
                unit.drawLine(left: L + mm(4.5) + amount.width() + mm(1.2), baseline: base)
            } else {
                sub.drawLine(left: L + mm(4.5), baseline: lTop + sub.firstBaseline)
            }
            y += boxH
        }

        // Order facts
        do {
            y += mm(3.2)
            let facts: [(GHPdfInline, GHPdfPara)] = [
                (wlab("الفاتورة", "INVOICE"), wp(o.invoiceNo, 3, .medium, ltr: true)),
                (wlab("القطع", "PIECES"), wp("\(pieces)", 3, .medium, ltr: true)),
                (wlab("التاريخ", "DATE"), wp(dateStr(o.createdAt), 3, .medium, ltr: true)),
            ]
            let fr: [CGFloat] = [1.25, 0.6, 1]
            let gap = mm(3)
            let free = W - 2 * gap
            var right = R
            var rowH: CGFloat = 0
            for (i, f) in facts.enumerated() {
                let w = free * fr[i] / 2.85
                f.0.draw(right: right, top: y)
                let vTop = y + f.0.height + mm(1.2)
                f.1.draw(x: right - w, y: vTop, width: w)
                rowH = max(rowH, f.0.height + mm(1.2) + f.1.height(width: w))
                right -= w + gap
            }
            y += rowH
        }
        if let tracking = o.carrierTracking, !o.carrierIsLink {
            y += mm(2.6)
            let k = wlab("رقم الشحنة", "SHIPMENT")
            let v = wp(tracking, 3.3, .medium, align: .left, ltr: true)
            let above = max(k.above, v.firstBaseline)
            let below = max(k.below + mm(1.2), v.lineBox - v.firstBaseline)
            k.draw(right: R, baseline: y + above)
            v.drawLine(left: L, baseline: y + above)
            y += above + below
        }
        if driverName != nil || o.driverNote != nil {
            y += mm(2.6)
            let bold = ghPdfPlex(2.65, .medium)
            let plain = ghPdfPlex(2.65, .regular)
            if let driverName {
                let t = GHPdfPara(runs: [GHPdfRun("المندوب:", bold, WC.ink), GHPdfRun(" \(driverName)", plain, WC.ink)],
                                  lh: 1.6)
                t.draw(x: L, y: y, width: W)
                y += t.height(width: W)
            }
            if let note = o.driverNote {
                let t = GHPdfPara(runs: [GHPdfRun("ملاحظة:", bold, WC.ink), GHPdfRun(" \(note)", plain, WC.ink)],
                                  lh: 1.6, maxLines: 2)
                t.draw(x: L, y: y, width: W)
                y += t.height(width: W)
            }
        }

        // The rest sits at the bottom of the label (the spacer).
        // Sender
        let fromLab = wlab("المرسل", "FROM")
        var senderParts: [String] = [biz.companyName ?? "GH Shopper"]
        if let p = biz.phone { senderParts.append(ghPdfLTR(p)) }
        if let i = biz.instagram { senderParts.append(ghPdfLTR(i)) }
        let sender = wp(senderParts.joined(separator: "  ·  "), 2.45, maxLines: 1)
        let senderW = max(W - fromLab.width - mm(2.4), 1)
        let fromAbove = max(fromLab.above, sender.firstBaseline)
        let fromBelow = max(fromLab.below + mm(1.2), sender.lineBox - sender.firstBaseline)
        let fromTop = bottom - (mm(2.2) + fromAbove + fromBelow)
        let fromBase = fromTop + mm(2.2) + fromAbove
        fromLab.draw(right: R, baseline: fromBase)
        sender.draw(x: R - fromLab.width - mm(2.4) - senderW, y: fromBase - sender.firstBaseline, width: senderW)
        let ruleTop = fromTop - mm(0.25)
        wbRule(L, ruleTop, W)
        // Waybill number
        let number = wp(waybill, 4.4, .medium, kern: 1.4, align: .center, ltr: true)
        let numberTop = ruleTop - mm(2.6) - number.lineBox
        number.draw(x: L, y: numberTop, width: W)
        // Waybill barcode (72 × 14 mm, quiet zone on both sides)
        let barTop = numberTop - mm(1.8) - mm(14)
        ghPdfDrawCode128(waybill, in: CGRect(x: L + (W - mm(72)) / 2, y: barTop, width: mm(72), height: mm(14)),
                         color: WC.ink, snap: waybillDot)
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

/// Builds the waybill and opens the iOS share sheet, so the PDF (exact
/// 100 × 150 mm page) can go to a label printer's own app (e.g. Phomemo's
/// Labelife, which has no AirPrint) or to Files.
@MainActor
func shareWaybill(_ o: Order, customer: Customer?, biz: BusinessSettings, driverName: String? = nil) async {
    let data = buildWaybillPdf(o, customer: customer, biz: biz, driverName: driverName)
    let name = "Waybill-\(o.waybillNo)".replacingOccurrences(of: "/", with: "-")
    let url = FileManager.default.temporaryDirectory.appendingPathComponent("\(name).pdf")
    do {
        try data.write(to: url, options: .atomic)
    } catch {
        toastError(error)
        return
    }
    share([url])
}


/// The cheetah as a solid black silhouette that keeps its transparent background
/// (thermal printers print black only). Drawn into a bitmap: image, then black
/// filled only where the image has paint (.sourceIn).
fileprivate func waybillSilhouette(_ img: UIImage) -> UIImage {
    let fmt = UIGraphicsImageRendererFormat()
    fmt.scale = max(img.scale, 3)
    fmt.opaque = false
    let rect = CGRect(origin: .zero, size: img.size)
    return UIGraphicsImageRenderer(size: img.size, format: fmt).image { ctx in
        img.draw(in: rect)
        ctx.cgContext.setBlendMode(.sourceIn)
        UIColor.black.setFill()
        ctx.cgContext.fill(rect)
    }
}
