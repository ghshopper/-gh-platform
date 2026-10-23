import UIKit
import CoreImage

// Small drawing kit shared by the invoice and the waybill PDFs (the Dart
// `pdf` package widgets they used: Text, Column, barcodes). Everything is laid
// out right-to-left: "start" is the right edge.

/// Points per millimetre (PdfPageFormat.mm).
let ghPdfMM: CGFloat = 72.0 / 25.4

/// Horizontal alignment of the lines of a stack. start = right (RTL).
enum GHPdfAlign { case start, end, center }

/// One run of text, measured and drawn with UIKit (Arabic shaped by CoreText).
struct GHPdfText {
    let attributed: NSAttributedString
    let maxLines: Int
    let lineHeight: CGFloat

    init(_ text: String, size: CGFloat, weight: GHWeight = .regular, color: UIColor,
         kern: CGFloat = 0, ltr: Bool = false, maxLines: Int = 0) {
        let font = UIFont.gh(size, weight)
        let p = NSMutableParagraphStyle()
        p.baseWritingDirection = ltr ? .leftToRight : .rightToLeft
        p.alignment = ltr ? .left : .right
        p.lineBreakMode = .byWordWrapping
        var attrs: [NSAttributedString.Key: Any] = [
            .font: font,
            .foregroundColor: color,
            .paragraphStyle: p,
        ]
        if kern != 0 { attrs[.kern] = kern }
        self.attributed = NSAttributedString(string: text, attributes: attrs)
        self.maxLines = maxLines
        self.lineHeight = ceil(font.lineHeight)
    }

    /// Size of the text when it may wrap at `maxWidth`.
    func size(maxWidth: CGFloat) -> CGSize {
        let limit = max(maxWidth, 1)
        let r = attributed.boundingRect(
            with: CGSize(width: limit, height: CGFloat.greatestFiniteMagnitude),
            options: [.usesLineFragmentOrigin, .usesFontLeading], context: nil)
        var h = ceil(r.height)
        if maxLines > 0 { h = min(h, lineHeight * CGFloat(maxLines)) }
        h = max(h, lineHeight)
        let w = min(ceil(r.width), limit)
        return CGSize(width: w, height: h)
    }

    func draw(in rect: CGRect) {
        attributed.draw(with: rect,
                        options: [.usesLineFragmentOrigin, .usesFontLeading, .truncatesLastVisibleLine],
                        context: nil)
    }

    /// Draws with the right edge at `right` (RTL start), top at `y`.
    @discardableResult
    func draw(right: CGFloat, y: CGFloat, maxWidth: CGFloat) -> CGSize {
        let s = size(maxWidth: maxWidth)
        draw(in: CGRect(x: right - s.width, y: y, width: s.width, height: s.height))
        return s
    }

    /// Draws with the left edge at `left`, top at `y`.
    @discardableResult
    func draw(left: CGFloat, y: CGFloat, maxWidth: CGFloat) -> CGSize {
        let s = size(maxWidth: maxWidth)
        draw(in: CGRect(x: left, y: y, width: s.width, height: s.height))
        return s
    }
}

/// A vertical stack of texts and gaps (a pw.Column of Texts and SizedBoxes).
struct GHPdfStack {
    enum Piece {
        case text(GHPdfText)
        case gap(CGFloat)
    }

    var pieces: [Piece] = []
    var align: GHPdfAlign = .start

    init(align: GHPdfAlign = .start) { self.align = align }

    mutating func add(_ t: GHPdfText) { pieces.append(.text(t)) }
    mutating func add(_ ts: [GHPdfText]) { for t in ts { pieces.append(.text(t)) } }
    mutating func gap(_ g: CGFloat) { pieces.append(.gap(g)) }

    var isEmpty: Bool { pieces.isEmpty }

    /// Intrinsic width (the widest line), at most `maxWidth`.
    func width(maxWidth: CGFloat) -> CGFloat {
        var w: CGFloat = 0
        for p in pieces {
            switch p {
            case .text(let t): w = max(w, t.size(maxWidth: maxWidth).width)
            case .gap: break
            }
        }
        return w
    }

    func height(width: CGFloat) -> CGFloat {
        var h: CGFloat = 0
        for p in pieces {
            switch p {
            case .text(let t): h += t.size(maxWidth: width).height
            case .gap(let g): h += g
            }
        }
        return h
    }

    /// Draws in the box that starts at `x` (left edge) and is `width` wide.
    func draw(x: CGFloat, y: CGFloat, width: CGFloat) {
        var cy = y
        for p in pieces {
            switch p {
            case .text(let t):
                let s = t.size(maxWidth: width)
                let px: CGFloat
                switch align {
                case .start: px = x + width - s.width
                case .end: px = x
                case .center: px = x + (width - s.width) / 2
                }
                t.draw(in: CGRect(x: px, y: cy, width: s.width, height: s.height))
                cy += s.height
            case .gap(let g):
                cy += g
            }
        }
    }
}

// MARK: - Shapes

func ghPdfFill(_ rect: CGRect, _ color: UIColor, radius: CGFloat = 0) {
    color.setFill()
    if radius > 0 {
        UIBezierPath(roundedRect: rect, cornerRadius: radius).fill()
    } else {
        UIBezierPath(rect: rect).fill()
    }
}

/// A border of `width` drawn inside `rect` (as the pdf package does).
func ghPdfStroke(_ rect: CGRect, _ color: UIColor, width: CGFloat) {
    color.setStroke()
    let path = UIBezierPath(rect: rect.insetBy(dx: width / 2, dy: width / 2))
    path.lineWidth = width
    path.stroke()
}

/// Draws an image scaled to fit (BoxFit.contain), centred in `rect`.
func ghPdfDrawImage(_ image: UIImage?, fitIn rect: CGRect) {
    guard let image, image.size.width > 0, image.size.height > 0 else { return }
    let scale = min(rect.width / image.size.width, rect.height / image.size.height)
    let w = image.size.width * scale
    let h = image.size.height * scale
    image.draw(in: CGRect(x: rect.midX - w / 2, y: rect.midY - h / 2, width: w, height: h))
}

// MARK: - Barcodes (CoreImage generators, drawn as vector bars)

/// Dark modules of a generated code, cropped to the symbol (no quiet zone).
private struct GHPdfModules {
    let cols: Int
    let rows: Int
    let dark: [Bool]

    func isDark(_ x: Int, _ y: Int) -> Bool { dark[y * cols + x] }
}

private func ghPdfModules(_ image: CIImage?) -> GHPdfModules? {
    guard let image else { return nil }
    let extent = image.extent.integral
    if extent.isInfinite || extent.isEmpty { return nil }
    let context = CIContext(options: nil)
    guard let cg = context.createCGImage(image, from: extent) else { return nil }
    let w = cg.width
    let h = cg.height
    if w <= 0 || h <= 0 { return nil }
    var pixels = [UInt8](repeating: 255, count: w * h)
    let drawn: Bool = pixels.withUnsafeMutableBytes { raw -> Bool in
        guard let base = raw.baseAddress else { return false }
        guard let c = CGContext(data: base, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w,
                                space: CGColorSpaceCreateDeviceGray(),
                                bitmapInfo: CGImageAlphaInfo.none.rawValue) else { return false }
        c.setFillColor(gray: 1, alpha: 1)
        c.fill(CGRect(x: 0, y: 0, width: w, height: h))
        c.interpolationQuality = .none
        c.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
        return true
    }
    if !drawn { return nil }

    var minX = w, maxX = -1, minY = h, maxY = -1
    for y in 0..<h {
        for x in 0..<w where pixels[y * w + x] < 128 {
            if x < minX { minX = x }
            if x > maxX { maxX = x }
            if y < minY { minY = y }
            if y > maxY { maxY = y }
        }
    }
    if maxX < minX || maxY < minY { return nil }
    let cols = maxX - minX + 1
    let rows = maxY - minY + 1
    var dark = [Bool](repeating: false, count: cols * rows)
    for y in 0..<rows {
        for x in 0..<cols {
            dark[y * cols + x] = pixels[(y + minY) * w + (x + minX)] < 128
        }
    }
    return GHPdfModules(cols: cols, rows: rows, dark: dark)
}

/// QR code (pw.Barcode.qrCode(), correction level L) filling `rect`.
func ghPdfDrawQR(_ text: String, in rect: CGRect, color: UIColor = .black) {
    guard let filter = CIFilter(name: "CIQRCodeGenerator") else { return }
    filter.setValue(Data(text.utf8), forKey: "inputMessage")
    filter.setValue("L", forKey: "inputCorrectionLevel")
    guard let m = ghPdfModules(filter.outputImage) else { return }
    let cw = rect.width / CGFloat(m.cols)
    let ch = rect.height / CGFloat(m.rows)
    color.setFill()
    for y in 0..<m.rows {
        var x = 0
        while x < m.cols {
            if m.isDark(x, y) {
                var end = x
                while end + 1 < m.cols && m.isDark(end + 1, y) { end += 1 }
                let r = CGRect(x: rect.minX + CGFloat(x) * cw, y: rect.minY + CGFloat(y) * ch,
                               width: CGFloat(end - x + 1) * cw, height: ch)
                UIBezierPath(rect: r.insetBy(dx: 0, dy: -0.05)).fill()
                x = end + 1
            } else {
                x += 1
            }
        }
    }
}

/// Code 128 bars (pw.Barcode.code128(), drawText: false) filling `rect`.
func ghPdfDrawCode128(_ text: String, in rect: CGRect, color: UIColor = .black) {
    guard let filter = CIFilter(name: "CICode128BarcodeGenerator") else { return }
    guard let data = text.data(using: .ascii) else { return }
    filter.setValue(data, forKey: "inputMessage")
    filter.setValue(NSNumber(value: 0), forKey: "inputQuietSpace")
    guard let m = ghPdfModules(filter.outputImage) else { return }
    let y = m.rows / 2
    let cw = rect.width / CGFloat(m.cols)
    color.setFill()
    var x = 0
    while x < m.cols {
        if m.isDark(x, y) {
            var end = x
            while end + 1 < m.cols && m.isDark(end + 1, y) { end += 1 }
            let r = CGRect(x: rect.minX + CGFloat(x) * cw, y: rect.minY,
                           width: CGFloat(end - x + 1) * cw, height: rect.height)
            UIBezierPath(rect: r).fill()
            x = end + 1
        } else {
            x += 1
        }
    }
}
