import UIKit

// Port of pdf_invoice.dart: the bilingual (Arabic / English) customer
// invoice, A5, right-to-left, several pages when the items do not fit.

private enum IC {
    static var burgundy: UIColor { UIColor(hex: 0xFF5A0F1C) }
    static var ink: UIColor { UIColor(hex: 0xFF1C1C1E) }
    static var muted: UIColor { UIColor(hex: 0xFF6D6D72) }
    static var line: UIColor { UIColor(hex: 0xFFE5E5EA) }
    static var tint: UIColor { UIColor(hex: 0xFFF7F2EE) }
    static var gold: UIColor { UIColor(hex: 0xFFB08A45) }
}

/// One top-level child of the pw.MultiPage: a fixed height and how to draw it.
private struct InvBlock {
    let height: CGFloat
    let isGap: Bool
    let draw: (CGFloat) -> Void

    init(_ height: CGFloat, isGap: Bool = false, draw: @escaping (CGFloat) -> Void) {
        self.height = height
        self.isGap = isGap
        self.draw = draw
    }

    static func gap(_ h: CGFloat) -> InvBlock { InvBlock(h, isGap: true) { _ in } }
}

/// Text in the invoice's style: regular IBM Plex, ink, right-to-left.
private func it(_ s: String, _ size: CGFloat, _ w: GHWeight = .regular,
                _ c: UIColor? = nil, kern: CGFloat = 0) -> GHPdfText {
    GHPdfText(s, size: size, weight: w, color: c ?? IC.ink, kern: kern)
}

/// The Arabic word over its small English label.
private func twoLang(_ ar: String, _ en: String, strong: Bool = false,
                     color: UIColor? = nil, size: CGFloat = 9.5) -> [GHPdfText] {
    [it(ar, size, strong ? .bold : .medium, color),
     it(en, 6.5, .regular, IC.muted, kern: 0.6)]
}

private func twoLangStack(_ ar: String, _ en: String, strong: Bool = false,
                          color: UIColor? = nil, size: CGFloat = 9.5) -> GHPdfStack {
    var s = GHPdfStack()
    s.add(twoLang(ar, en, strong: strong, color: color, size: size))
    return s
}

/// A row of the totals column (fixed width): label on the right, amount on the left.
private struct InvRow {
    let height: CGFloat
    let draw: (CGFloat) -> Void
}

private func amountRow(_ ar: String, _ en: String, _ v: Double, strong: Bool = false,
                       left: CGFloat, width: CGFloat) -> InvRow {
    let label = twoLangStack(ar, en, strong: strong)
    let amount = it(omrLatin(v), strong ? 11 : 9.5, strong ? .bold : .medium)
    let aSize = amount.size(maxWidth: width)
    let lw = max(width - aSize.width, 1)
    let lh = label.height(width: lw)
    let inner = max(lh, aSize.height)
    return InvRow(height: inner + 7) { y in
        let top = y + 3.5
        let labelW = label.width(maxWidth: lw)
        label.draw(x: left + width - labelW, y: top + (inner - lh) / 2, width: labelW)
        amount.draw(in: CGRect(x: left, y: top + (inner - aSize.height) / 2,
                               width: aSize.width, height: aSize.height))
    }
}

/// Builds the bilingual (Arabic / English) customer invoice.
func buildInvoicePdf(_ o: Order, customer: Customer?, biz: BusinessSettings) -> Data {
    let pageW: CGFloat = 148 * ghPdfMM
    let pageH: CGFloat = 210 * ghPdfMM
    let mL: CGFloat = 30, mT: CGFloat = 30, mR: CGFloat = 30, mB: CGFloat = 26
    let L = mL
    let W = pageW - mL - mR
    let R = L + W

    let company = biz.companyName ?? "GH Shopper"
    let companyEn = biz.companyNameEn
    var contactParts: [String] = []
    if let p = biz.phone { contactParts.append(p) }
    if let i = biz.instagram { contactParts.append(i) }
    let contact = contactParts.joined(separator: "  ·  ")
    let items = o.activeItems
    let logo = GHImage.named("logo")
    // A gift with hidden prices: the invoice goes in the parcel without any amounts.
    let gift = o.gift
    let hidePrices = gift?.hidePrices == true

    var blocks: [InvBlock] = []

    // ── Header: company on one side, invoice title on the other
    do {
        var title = GHPdfStack(align: .end)
        title.add(it("فاتورة", 18, .bold, IC.burgundy))
        title.add(it("INVOICE", 7, .regular, IC.muted, kern: 2.5))
        let titleW = title.width(maxWidth: W)
        let midW = max(W - 52 - 10 - titleW, 1)
        var mid = GHPdfStack()
        mid.add(it(company, 12, .bold))
        if let en = companyEn { mid.add(it(en, 8, .regular, IC.muted)) }
        if let cr = biz.crNumber { mid.add(it("السجل التجاري  CR No. \(cr)", 7.5, .regular, IC.muted)) }
        if !contact.isEmpty { mid.add(it(contact, 7.5, .regular, IC.muted)) }
        let h = max(52, max(mid.height(width: midW), title.height(width: titleW)))
        blocks.append(InvBlock(h) { y in
            ghPdfDrawImage(logo, fitIn: CGRect(x: R - 52, y: y, width: 52, height: 52))
            mid.draw(x: L + titleW, y: y, width: midW)
            title.draw(x: L, y: y, width: titleW)
        })
    }
    blocks.append(.gap(16))

    // ── Meta: number, date, customer
    do {
        let inner = W - 20
        var leftCol = GHPdfStack()
        leftCol.add(twoLang("رقم الفاتورة", "Invoice no.", size: 8))
        leftCol.add(it(o.invoiceNo, 10, .bold))
        leftCol.gap(5)
        leftCol.add(twoLang("التاريخ", "Date", size: 8))
        leftCol.add(it(dateStr(o.createdAt), 9.5, .medium))
        let leftW = leftCol.width(maxWidth: inner / 2)
        let rightW = max(inner - leftW, 1)
        var rightCol = GHPdfStack()
        rightCol.add(twoLang("العميل", "Bill to", size: 8))
        rightCol.gap(3)
        rightCol.add(it(customer?.name ?? "—", 10.5, .bold))
        if let phone = customer?.phone { rightCol.add(it(phone, 8.5, .regular, IC.muted)) }
        if let g = gift {
            rightCol.gap(5)
            rightCol.add(twoLang("هدية إلى 🎁", "Gift to", size: 8))
            rightCol.add(it(g.to ?? "—", 10, .bold))
        }
        let h = 20 + max(leftCol.height(width: leftW), rightCol.height(width: rightW))
        blocks.append(InvBlock(h) { y in
            ghPdfFill(CGRect(x: L, y: y, width: W, height: h), IC.tint, radius: 6)
            rightCol.draw(x: L + 10 + leftW, y: y + 10, width: rightW)
            leftCol.draw(x: L + 10, y: y + 10, width: leftW)
        })
    }
    blocks.append(.gap(16))

    // ── Items
    do {
        let inner = W - 12
        let hash = it("#", 8, .regular, IC.muted)
        let price = twoLangStack("السعر", "Price (OMR)", strong: true, size: 8.5)
        let priceW: CGFloat = hidePrices ? 0 : price.width(maxWidth: inner / 2)
        let midW = max(inner - 16 - priceW, 1)
        let item = twoLangStack("القطعة", "Item", strong: true, size: 8.5)
        let hashH = hash.size(maxWidth: 16).height
        let priceH: CGFloat = hidePrices ? 0 : price.height(width: priceW)
        let itemH = item.height(width: midW)
        let rowH = max(hashH, max(priceH, itemH))
        let h = rowH + 10
        blocks.append(InvBlock(h) { y in
            let top = y + 5
            hash.draw(right: R - 6, y: top + (rowH - hashH) / 2, maxWidth: 16)
            item.draw(x: L + 6 + priceW, y: top + (rowH - itemH) / 2, width: midW)
            if !hidePrices { price.draw(x: L + 6, y: top + (rowH - priceH) / 2, width: priceW) }
            ghPdfFill(CGRect(x: L, y: y + h - 0.9, width: W, height: 0.9), IC.burgundy)
        })
    }
    for (k, item) in items.enumerated() {
        let inner = W - 12
        let num = it("\(k + 1)", 8.5, .regular, IC.muted)
        let price = it(plainOmr(item.price), 10, .medium)
        let priceSize: CGSize = hidePrices ? .zero : price.size(maxWidth: inner / 2)
        let midW = max(inner - 16 - 10 - priceSize.width, 1)
        var mid = GHPdfStack()
        if let brand = item.brand { mid.add(it(brand.uppercased(), 7, .regular, IC.gold, kern: 1)) }
        mid.add(it(item.name, 10, .medium))
        if let d = item.details { mid.add(it(d, 8, .regular, IC.muted)) }
        let numH = num.size(maxWidth: 16).height
        let h = 14 + max(numH, max(mid.height(width: midW), priceSize.height))
        blocks.append(InvBlock(h) { y in
            let top = y + 7
            num.draw(right: R - 6, y: top, maxWidth: 16)
            mid.draw(x: L + 6 + priceSize.width + 10, y: top, width: midW)
            if !hidePrices {
                price.draw(in: CGRect(x: L + 6, y: top, width: priceSize.width, height: priceSize.height))
            }
            ghPdfFill(CGRect(x: L, y: y + h - 0.6, width: W, height: 0.6), IC.line)
        })
    }
    blocks.append(.gap(12))

    // ── Gift card message
    if let g = gift, let msg = g.message {
        let card = twoLangStack("رسالة الهدية", "Gift message", strong: true, size: 8.5)
        let cardH = card.height(width: W - 20)
        let t = it(msg, 10, .medium)
        let th = t.size(maxWidth: W - 20).height
        let h = 20 + cardH + 4 + th
        blocks.append(InvBlock(h) { y in
            ghPdfFill(CGRect(x: L, y: y, width: W, height: h), IC.tint, radius: 6)
            card.draw(x: L + 10, y: y + 10, width: W - 20)
            t.draw(right: R - 10, y: y + 10 + cardH + 4, maxWidth: W - 20)
        })
        blocks.append(.gap(12))
    }

    // ── Totals
    if !hidePrices {
        let colW: CGFloat = 170
        let colX = L
        var rows: [InvRow] = []
        rows.append(amountRow("مجموع القطع", "Subtotal", o.itemsTotal, left: colX, width: colW))
        if o.deliveryFee > 0 {
            rows.append(amountRow("التوصيل", "Delivery", o.deliveryFee, left: colX, width: colW))
        }
        if o.tax > 0 {
            rows.append(amountRow("الضريبة", "Tax", o.tax, left: colX, width: colW))
        }
        if o.discount > 0 {
            rows.append(amountRow(o.discountLabel ?? "خصم", "Discount", -o.discount, left: colX, width: colW))
        }
        rows.append(InvRow(height: 8) { y in
            ghPdfFill(CGRect(x: colX, y: y + 3.7, width: colW, height: 0.6), IC.line)
        })
        rows.append(amountRow("الإجمالي", "Total", o.total, strong: true, left: colX, width: colW))
        if o.paid > 0 {
            rows.append(amountRow("المدفوع", "Paid", o.paid, left: colX, width: colW))
        }
        rows.append(InvRow(height: 6) { _ in })
        // Balance due
        do {
            let inner = colW - 20
            let label = twoLangStack("المتبقي", "Balance due", strong: true, color: .white, size: 9.5)
            let amount = it(omrLatin(o.remaining < 0 ? 0 : o.remaining), 12, .bold, .white)
            let aSize = amount.size(maxWidth: inner)
            let lw = max(inner - aSize.width, 1)
            let labelW = label.width(maxWidth: lw)
            let lh = label.height(width: labelW)
            let rowH = max(lh, aSize.height)
            rows.append(InvRow(height: rowH + 14) { y in
                ghPdfFill(CGRect(x: colX, y: y, width: colW, height: rowH + 14), IC.burgundy, radius: 6)
                let top = y + 7
                label.draw(x: colX + colW - 10 - labelW, y: top + (rowH - lh) / 2, width: labelW)
                amount.draw(in: CGRect(x: colX + 10, y: top + (rowH - aSize.height) / 2,
                                       width: aSize.width, height: aSize.height))
            })
        }
        let colH = rows.reduce(CGFloat(0)) { $0 + $1.height }

        let payW = max(W - 16 - colW, 1)
        var pay = GHPdfStack()
        if !o.payments.isEmpty {
            pay.add(twoLang("الدفعات", "Payments", strong: true, size: 8.5))
            pay.gap(4)
            for p in o.payments {
                let method = p.method.map { "  ·  \($0)" } ?? ""
                pay.add(it("\(dateStr(p.paidOn))  ·  \(omrLatin(p.amount))\(method)", 7.5, .regular, IC.muted))
                pay.gap(2)
            }
        }
        let payH = pay.height(width: payW)
        let h = max(colH, payH)
        blocks.append(InvBlock(h) { y in
            pay.draw(x: R - payW, y: y, width: payW)
            var cy = y
            for r in rows {
                r.draw(cy)
                cy += r.height
            }
        })
    }

    if let bank = biz.bankDetails, !hidePrices {
        blocks.append(.gap(16))
        let head = twoLangStack("بيانات التحويل", "Bank details", strong: true, size: 8.5)
        let headH = head.height(width: W)
        blocks.append(InvBlock(headH) { y in head.draw(x: L, y: y, width: W) })
        blocks.append(.gap(3))
        let t = it(bank, 8.5)
        let th = t.size(maxWidth: W).height
        blocks.append(InvBlock(th) { y in t.draw(right: R, y: y, maxWidth: W) })
    }
    if let note = biz.invoiceNote {
        blocks.append(.gap(12))
        let t = it(note, 8, .regular, IC.muted)
        let th = t.size(maxWidth: W).height
        blocks.append(InvBlock(th) { y in t.draw(right: R, y: y, maxWidth: W) })
    }
    blocks.append(.gap(18))
    do {
        var thanks = GHPdfStack(align: .center)
        thanks.add(it("شكراً لثقتكم", 12, .bold, IC.burgundy))
        thanks.add(it("Thank you for your trust", 7, .regular, IC.muted, kern: 1))
        let h = thanks.height(width: W)
        blocks.append(InvBlock(h) { y in thanks.draw(x: L, y: y, width: W) })
    }

    // ── Footer (same on every page, with the page number)
    var footParts: [String] = [company]
    if let cr = biz.crNumber { footParts.append("س.ت \(cr)") }
    if let tax = biz.taxNumber { footParts.append("الرقم الضريبي \(tax)") }
    if let addr = biz.address { footParts.append(addr) }
    let footText = it(footParts.joined(separator: "  ·  "), 7, .regular, IC.muted)
    let sampleNum = it("99/99", 7, .regular, IC.muted)
    let numReserve = sampleNum.size(maxWidth: W).width
    let footTextW = max(W - numReserve - 8, 1)
    let footTextH = footText.size(maxWidth: footTextW).height
    let footH = 8 + max(footTextH, sampleNum.lineHeight)
    let footTop = pageH - mB - footH
    let contentBottom = footTop

    // ── Pagination (pw.MultiPage)
    var pages: [[(CGFloat, InvBlock)]] = [[]]
    var y = mT
    for b in blocks {
        var current = pages.count - 1
        if y + b.height > contentBottom && !pages[current].isEmpty {
            pages.append([])
            current += 1
            y = mT
        }
        if b.isGap && pages[current].isEmpty && current > 0 { continue }
        pages[current].append((y, b))
        y += b.height
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
            for (top, b) in page { b.draw(top) }
            // footer
            ghPdfFill(CGRect(x: L, y: footTop, width: W, height: 0.6), IC.line)
            footText.draw(right: R, y: footTop + 8, maxWidth: footTextW)
            let num = it("\(index + 1)/\(total)", 7, .regular, IC.muted)
            num.draw(left: L, y: footTop + 8, maxWidth: numReserve + 8)
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
