import UIKit

// Port of pdf_invoice.dart: the bilingual (Arabic / English) customer
// invoice, A5, right-to-left, several pages when the items do not fit.
// Design: the approved ivory / maroon / gold invoice. Every size below is in
// millimetres, as in the HTML prototype (docs/invoice.html).

private enum IC {
    static var ivory: UIColor { UIColor(hex: 0xFFF4EEE8) }
    static var maroon: UIColor { UIColor(hex: 0xFF350304) }
    static var gold: UIColor { UIColor(hex: 0xFFB8955A) }
    /// Hairlines: gold at 45 %.
    static var hair: UIColor { UIColor(hex: 0x73B8955A) }
    static func faded(_ alpha: CGFloat) -> UIColor { maroon.withAlphaComponent(alpha) }
}

private func mm(_ v: CGFloat) -> CGFloat { v * ghPdfMM }

/// IBM Plex text; size and letter-spacing in mm; maroon unless a colour is given.
private func ip(_ s: String, _ size: CGFloat, _ w: GHWeight = .regular, _ c: UIColor? = nil,
                kern: CGFloat = 0, lh: CGFloat? = nil, align: NSTextAlignment = .right,
                ltr: Bool = false, maxLines: Int = 0) -> GHPdfPara {
    GHPdfPara(s, ghPdfPlex(size, w), c ?? IC.maroon, kern: mm(kern), lh: lh, align: align, ltr: ltr,
              maxLines: maxLines)
}

/// The small spaced English label (.en): medium, gold, 0.55 mm tracking.
private func ien(_ s: String, size: CGFloat = 1.6, align: NSTextAlignment = .left) -> GHPdfPara {
    ip(s, size, .medium, IC.gold, kern: 0.55, align: align, ltr: true)
}

/// The Arabic label then its English one, on one baseline (.lab).
private func lab(_ ar: String, _ en: String) -> GHPdfInline {
    GHPdfInline([ip(ar, 2.1, .medium, IC.faded(0.55)), ien(en)], gap: mm(1.8))
}

/// CSS grid `fr` columns.
private func gridWidths(_ fr: [CGFloat], total: CGFloat, gap: CGFloat) -> [CGFloat] {
    let free = max(total - gap * CGFloat(max(fr.count - 1, 0)), 1)
    let sum = max(fr.reduce(0, +), 0.0001)
    return fr.map { free * $0 / sum }
}

/// One top-level child of the pw.MultiPage: a fixed height and how to draw it.
private struct InvBlock {
    let height: CGFloat
    let draw: (CGFloat) -> Void

    init(_ height: CGFloat, draw: @escaping (CGFloat) -> Void) {
        self.height = height
        self.draw = draw
    }
}

/// One column of the facts row: label, then its values.
private struct InvFact {
    let label: GHPdfInline
    let values: [GHPdfPara]

    func height(_ w: CGFloat) -> CGFloat {
        var h = label.height + mm(1.6)
        for v in values { h += v.height(width: w) }
        return h
    }

    func draw(left: CGFloat, top: CGFloat, width w: CGFloat) {
        label.draw(right: left + w, top: top)
        var y = top + label.height + mm(1.6)
        for v in values {
            v.draw(x: left, y: y, width: w)
            y += v.height(width: w)
        }
    }
}

/// A block of the side column (payments, bank details, note).
private struct InvSide {
    let label: GHPdfInline?
    let texts: [GHPdfPara]

    func height(_ w: CGFloat) -> CGFloat {
        var h: CGFloat = mm(4.2)
        if let label { h += label.height + mm(1.6) }
        for t in texts { h += t.height(width: w) }
        return h
    }

    func draw(left: CGFloat, top: CGFloat, width w: CGFloat) {
        var y = top
        if let label {
            label.draw(right: left + w, top: y)
            y += label.height + mm(1.6)
        }
        for t in texts {
            t.draw(x: left, y: y, width: w)
            y += t.height(width: w)
        }
    }
}

/// A row of the totals column.
private struct InvRow {
    let height: CGFloat
    let draw: (CGFloat) -> Void
}

/// Label on the right, amount on the left, on one baseline (.tr / .tr.total).
private func totalRow(_ label: String, _ value: String, strong: Bool,
                      left: CGFloat, width: CGFloat) -> InvRow {
    let k = ip(label, strong ? 3 : 2.5, .regular, IC.faded(strong ? 1 : 0.7))
    let a = ip(value, strong ? 3.2 : 2.6, .medium, nil, align: .left, ltr: true)
    let above = max(k.firstBaseline, a.firstBaseline)
    let below = max(k.lineBox - k.firstBaseline, a.lineBox - a.firstBaseline)
    // .tr.total: 1.4 mm margin, a 0.2 mm hairline, then 2.4 mm padding.
    let padTop = strong ? mm(1.4 + 0.2 + 2.4) : mm(0.75)
    let h = padTop + above + below + mm(0.75)
    return InvRow(height: h) { y in
        if strong {
            ghPdfFill(CGRect(x: left, y: y + mm(1.4), width: width, height: mm(0.2)), IC.hair)
        }
        let base = y + padTop + above
        k.drawLine(right: left + width, baseline: base)
        a.drawLine(left: left, baseline: base)
    }
}

/// Balance due (.due): maroon rule, label with its English line, big amount + OMR.
private func dueRow(_ v: Double, left: CGFloat, width: CGFloat) -> InvRow {
    let k = ip("المتبقي", 3.2)
    let en = ien("BALANCE DUE", size: 1.5, align: .right)
    let amount = ip(plainOmr(v), 5, .medium, nil, kern: 0.1, align: .left, ltr: true)
    let unit = ip("OMR", 1.7, .medium, IC.gold, kern: 0.5, align: .left, ltr: true)
    let above = max(k.firstBaseline, amount.firstBaseline)
    let belowK = (k.lineBox - k.firstBaseline) + mm(0.6) + en.lineBox
    let belowA = amount.lineBox - amount.firstBaseline
    let padTop = mm(2.4 + 0.25 + 2.6)
    let h = padTop + above + max(belowK, belowA)
    return InvRow(height: h) { y in
        ghPdfFill(CGRect(x: left, y: y + mm(2.4), width: width, height: mm(0.25)), IC.maroon)
        let base = y + padTop + above
        k.drawLine(right: left + width, baseline: base)
        let enTop = base + (k.lineBox - k.firstBaseline) + mm(0.6)
        // The English line is left-aligned (direction ltr) in the label's box.
        let boxW = max(k.width(), en.width())
        en.drawLine(left: left + width - boxW, baseline: enTop + en.firstBaseline)
        amount.drawLine(left: left, baseline: base)
        unit.drawLine(left: left + amount.width() + mm(1.2), baseline: base)
    }
}

/// Builds the bilingual (Arabic / English) customer invoice.
func buildInvoicePdf(_ o: Order, customer: Customer?, biz: BusinessSettings) -> Data {
    let pageW: CGFloat = mm(148)
    let pageH: CGFloat = mm(210)
    let L = mm(16)
    let W = pageW - 2 * L
    let R = L + W

    let company = biz.companyName ?? "GH Shopper"
    let brandEn = (biz.companyNameEn ?? "GH Shopper").uppercased()
    let items = o.activeItems
    let cheetah = GHImage.named("story_cheetah")
    let year = Calendar(identifier: .gregorian).component(.year, from: o.createdAt ?? Date())
    // A gift with hidden prices: the invoice goes in the parcel without any amounts.
    let gift = o.gift
    let hidePrices = gift?.hidePrices == true

    let hairH = mm(0.2)
    let hair = InvBlock(hairH) { y in
        ghPdfFill(CGRect(x: L, y: y, width: W, height: hairH), IC.hair)
    }
    var blocks: [InvBlock] = []

    // ── Facts: customer, gift recipient, number, date
    blocks.append(hair)
    do {
        var cols: [InvFact] = []
        var billTo: [GHPdfPara] = [ip(customer?.name ?? "—", 3.4, lh: 1.45)]
        if let phone = customer?.phone {
            billTo.append(ip(phone, 2.5, .regular, IC.faded(0.6), lh: 1.45, ltr: true))
        }
        cols.append(InvFact(label: lab("العميل", "BILL TO"), values: billTo))
        if let g = gift {
            cols.append(InvFact(label: lab("هدية إلى", "GIFT TO"), values: [ip(g.to ?? "—", 3.4, lh: 1.45)]))
        }
        cols.append(InvFact(label: lab("رقم الفاتورة", "INVOICE NO."),
                            values: [ip(o.invoiceNo, 2.8, .medium, kern: 0.1, ltr: true)]))
        cols.append(InvFact(label: lab("التاريخ", "DATE"),
                            values: [ip(dateStr(o.createdAt), 2.8, .medium, kern: 0.1, ltr: true)]))
        let fr: [CGFloat] = gift != nil ? [1.3, 0.95, 1.1, 0.75] : [1.5, 1, 0.8]
        let widths = gridWidths(fr, total: W, gap: mm(6))
        var inner: CGFloat = 0
        for (i, c) in cols.enumerated() { inner = max(inner, c.height(widths[i])) }
        let columns = cols
        blocks.append(InvBlock(mm(3.6) + inner + mm(3.6)) { y in
            var right = R
            for (i, c) in columns.enumerated() {
                let w = widths[i]
                c.draw(left: right - w, top: y + mm(3.6), width: w)
                right -= w + mm(6)
            }
        })
    }
    blocks.append(hair)

    // ── Items: # | item | price (30 mm, hidden for a gift with hidden prices)
    let numColW = mm(7)
    let priceColW = mm(30)
    let midW = W - numColW - priceColW
    do {
        let hash = ip("#", 2, .medium, IC.gold)
        let itemLab = lab("القطعة", "ITEM")
        let priceLab = lab("السعر", "PRICE · OMR")
        let rowH = max(hash.lineBox, itemLab.height)
        blocks.append(InvBlock(mm(3.6) + rowH + mm(2.2)) { y in
            let top = y + mm(3.6)
            hash.draw(x: R - numColW, y: top, width: numColW)
            itemLab.draw(right: R - numColW, top: top)
            if !hidePrices { priceLab.draw(right: L + priceLab.width, top: top) }
        })
    }
    blocks.append(hair)
    for (k, item) in items.enumerated() {
        let num = ip(String(format: "%02d", k + 1), 2, .medium, IC.gold, ltr: true)
        var mid: [(GHPdfPara, CGFloat)] = []  // (text, space above)
        if let brand = item.brand {
            mid.append((ip(brand.uppercased(), 1.65, .medium, IC.gold, kern: 0.6, ltr: true), 0))
        }
        mid.append((ip(item.name, 3.2, lh: 1.35), item.brand != nil ? mm(0.9) : 0))
        if let d = item.details {
            mid.append((ip(d, 2.35, .regular, IC.faded(0.6)), mm(0.5)))
        }
        var midH: CGFloat = 0
        for (p, gap) in mid { midH += gap + p.height(width: midW) }
        let price = ip(plainOmr(item.price), 2.9, .medium, nil, align: .left, ltr: true)
        let numH = mm(3.5) + num.lineBox
        let priceH: CGFloat = hidePrices ? 0 : mm(3.4) + price.lineBox
        let inner = max(midH, max(numH, priceH))
        let parts = mid
        blocks.append(InvBlock(hairH + mm(2) + inner + mm(2.3)) { y in
            ghPdfFill(CGRect(x: L, y: y, width: W, height: hairH), IC.hair)
            let top = y + hairH + mm(2)
            num.draw(x: R - numColW, y: top + mm(3.5), width: numColW)
            var cy = top
            for (p, gap) in parts {
                cy += gap
                p.draw(x: L + priceColW, y: cy, width: midW)
                cy += p.height(width: midW)
            }
            if !hidePrices { price.draw(x: L, y: top + mm(3.4), width: priceColW) }
        })
    }
    blocks.append(hair)

    // ── Gift card message
    if let g = gift, let msg = g.message {
        let label = lab("رسالة الهدية", "GIFT MESSAGE")
        let text = ip(msg, 3.5, lh: 1.85, align: .center)
        let th = text.height(width: W)
        let h = mm(9) + label.height + mm(3) + mm(0.2) + mm(4.4) + th + mm(2)
        blocks.append(InvBlock(h) { y in
            var cy = y + mm(9)
            label.draw(right: L + W / 2 + label.width / 2, top: cy)
            cy += label.height + mm(3)
            ghPdfFill(CGRect(x: L + W / 2 - mm(2.6), y: cy, width: mm(5.2), height: mm(0.2)), IC.gold)
            cy += mm(0.2) + mm(4.4)
            text.draw(x: L, y: cy, width: W)
        })
    }

    // ── Money: payments / bank / note on the right, totals on the left
    if !hidePrices {
        let sideW = mm(50)
        let totW = mm(58)
        var side: [InvSide] = []
        if !o.payments.isEmpty {
            var lines: [GHPdfPara] = []
            for p in o.payments {
                let method = p.method.map { "  ·  \($0)" } ?? ""
                lines.append(ip("\(dateStr(p.paidOn))  ·  \(omrLatin(p.amount))\(method)", 2.35, .regular,
                                IC.faded(0.72), lh: 1.75, ltr: true))
            }
            side.append(InvSide(label: lab("الدفعات", "PAYMENTS"), texts: lines))
        }
        if let bank = biz.bankDetails {
            side.append(InvSide(label: lab("بيانات التحويل", "BANK DETAILS"),
                                texts: [ip(bank, 2.35, .regular, IC.faded(0.72), lh: 1.75)]))
        }
        if let note = biz.invoiceNote {
            side.append(InvSide(label: nil, texts: [ip(note, 2.35, .regular, IC.faded(0.55), lh: 1.75)]))
        }
        var sideH: CGFloat = 0
        for s in side { sideH += s.height(sideW) }

        var rows: [InvRow] = []
        rows.append(totalRow("مجموع القطع", plainOmr(o.itemsTotal), strong: false, left: L, width: totW))
        if o.deliveryFee > 0 {
            rows.append(totalRow("التوصيل", plainOmr(o.deliveryFee), strong: false, left: L, width: totW))
        }
        if o.tax > 0 {
            rows.append(totalRow("الضريبة", plainOmr(o.tax), strong: false, left: L, width: totW))
        }
        if o.discount > 0 {
            rows.append(totalRow(o.discountLabel ?? "خصم", "−" + plainOmr(o.discount), strong: false,
                                 left: L, width: totW))
        }
        rows.append(totalRow("الإجمالي", plainOmr(o.total), strong: true, left: L, width: totW))
        if o.paid > 0 {
            rows.append(totalRow("المدفوع", plainOmr(o.paid), strong: false, left: L, width: totW))
        }
        rows.append(dueRow(o.remaining < 0 ? 0 : o.remaining, left: L, width: totW))
        var totH: CGFloat = 0
        for r in rows { totH += r.height }

        let sideBlocks = side
        let totalRows = rows
        blocks.append(InvBlock(mm(4) + max(sideH, totH)) { y in
            let top = y + mm(4)
            var sy = top
            for s in sideBlocks {
                s.draw(left: R - sideW, top: sy, width: sideW)
                sy += s.height(sideW)
            }
            var ty = top
            for r in totalRows {
                r.draw(ty)
                ty += r.height
            }
        })
    } else if let note = biz.invoiceNote {
        let t = ip(note, 2.3, .regular, IC.faded(0.6), lh: 1.7, align: .center)
        let th = t.height(width: W)
        blocks.append(InvBlock(mm(4) + th) { y in t.draw(x: L, y: y + mm(4), width: W) })
    }

    // ── Footer (every page): seller line, page number · signature · contact
    var contactParts: [String] = []
    if let p = biz.phone { contactParts.append(p) }
    if let i = biz.instagram { contactParts.append(i.uppercased()) }
    let contact = ien(contactParts.joined(separator: "  ·  "), align: .right)
    let sig = GHPdfPara("GH SHOPPER", ghPdfSerif(2.8, weight: 400), IC.gold, kern: mm(1.3), align: .left, ltr: true)
    let flH = max(sig.lineBox, contact.lineBox)
    let flTop = pageH - mm(8.5) - flH
    let flMid = flTop + flH / 2

    var sellerParts: [String] = [company]
    if let cr = biz.crNumber { sellerParts.append("س.ت \(cr)") }
    if let tax = biz.taxNumber { sellerParts.append("الرقم الضريبي \(tax)") }
    if let addr = biz.address { sellerParts.append(addr) }
    let seller = ip(sellerParts.joined(separator: " · "), 2.1, .regular, IC.faded(0.6), lh: 1.6, align: .center)
    let sellerTop = flTop - mm(3) - seller.height(width: W)

    // Thank-you lines: last page only, above the seller line.
    let thanksAr = ip("شكراً لثقتكم", 3.9, align: .center)
    let thanksEn = ien("THANK YOU FOR YOUR TRUST", align: .center)
    let thanksTop = sellerTop - mm(5) - (thanksAr.lineBox + mm(1.6) + thanksEn.lineBox)

    // ── Top strip (every page) and title (first page)
    let strip = [ien(brandEn), ien("PERSONAL SHOPPER"), ien(String(year))]
    let stripW = strip.map { $0.width() }
    let stripFree = max(W - stripW.reduce(0, +), 0)
    let titleEn = ien("INVOICE", align: .right)
    let titleAr = ip("فاتورة", 7, lh: 1)
    let headTop = mm(16.5)
    let titleH = titleEn.lineBox + mm(2.2) + titleAr.lineBox
    let cheetahW = mm(21)
    var cheetahH: CGFloat = 0
    if let c = cheetah, c.size.width > 0 { cheetahH = cheetahW * c.size.height / c.size.width }
    let headBottom = headTop + max(titleH, cheetahH + mm(0.6))

    // ── Pagination (pw.MultiPage)
    let firstTop = mm(33.5)
    let nextTop = mm(16.5)
    let pageBottom = sellerTop - mm(6)
    let lastBottom = thanksTop - mm(6)
    var pages: [[(CGFloat, InvBlock)]] = [[]]
    var y = firstTop
    for b in blocks {
        var current = pages.count - 1
        if y + b.height > pageBottom && !pages[current].isEmpty {
            pages.append([])
            current += 1
            y = nextTop
        }
        pages[current].append((y, b))
        y += b.height
    }
    // The last page also holds the thank-you lines: move its last block over
    // to a new page when they would overlap.
    if y > lastBottom {
        let last = pages.count - 1
        if pages[last].count > 1, let moved = pages[last].last {
            pages[last].removeLast()
            pages.append([(nextTop, moved.1)])
        } else {
            pages.append([])
        }
    }

    let format = UIGraphicsPDFRendererFormat()
    format.documentInfo = [
        kCGPDFContextTitle as String: "GH Shopper \(o.invoiceNo)",
        kCGPDFContextAuthor as String: biz.companyName ?? "GH Shopper",
    ]
    let renderer = UIGraphicsPDFRenderer(bounds: CGRect(x: 0, y: 0, width: pageW, height: pageH), format: format)
    let total = pages.count
    return renderer.pdfData { ctx in
        for (index, page) in pages.enumerated() {
            ctx.beginPage()
            ghPdfFill(CGRect(x: 0, y: 0, width: pageW, height: pageH), IC.ivory)

            // top strip: GH SHOPPER · PERSONAL SHOPPER · year (space-between)
            let stripTop = mm(8.5)
            strip[0].draw(x: L, y: stripTop, width: stripW[0])
            strip[1].draw(x: L + stripW[0] + stripFree / 2, y: stripTop, width: stripW[1])
            strip[2].draw(x: R - stripW[2], y: stripTop, width: stripW[2])

            if index == 0 {
                titleEn.drawLine(right: R, baseline: headTop + titleEn.firstBaseline)
                let arTop = headTop + titleEn.lineBox + mm(2.2)
                titleAr.drawLine(right: R, baseline: arTop + titleAr.firstBaseline)
                if let c = cheetah, cheetahH > 0 {
                    c.draw(in: CGRect(x: L, y: headBottom - mm(0.6) - cheetahH, width: cheetahW, height: cheetahH))
                }
            }

            for (top, b) in page { b.draw(top) }

            if index == total - 1 {
                thanksAr.draw(x: L, y: thanksTop, width: W)
                thanksEn.draw(x: L, y: thanksTop + thanksAr.lineBox + mm(1.6), width: W)
            }

            // footer
            seller.draw(x: L, y: sellerTop, width: W)
            let num = ien("\(index + 1) / \(total)")
            num.draw(x: L, y: flMid - num.lineBox / 2, width: num.width())
            let sw = sig.width()
            let sigLeft = pageW / 2 - (sw + mm(1.3)) / 2 + mm(1.3)
            sig.draw(x: sigLeft, y: flMid - sig.lineBox / 2, width: sw)
            let cw = contact.width()
            contact.draw(x: R - cw, y: flMid - contact.lineBox / 2, width: cw)
        }
    }
}

/// Builds the invoice and opens the iOS share sheet (WhatsApp, Files, Print…).
@MainActor
func shareInvoice(_ o: Order, customer: Customer?, biz: BusinessSettings) async {
    let data = buildInvoicePdf(o, customer: customer, biz: biz)
    let name = o.invoiceNo.replacingOccurrences(of: "/", with: "-")
    let url = FileManager.default.temporaryDirectory.appendingPathComponent("\(name).pdf")
    do {
        try data.write(to: url, options: .atomic)
    } catch {
        toastError(error)
        return
    }
    share([url])
}
