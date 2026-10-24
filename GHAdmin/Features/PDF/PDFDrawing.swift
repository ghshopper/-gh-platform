import UIKit
import CoreImage
import CoreText

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

// MARK: - CSS-like text
// The approved invoice and waybill designs are specified as HTML in
// millimetres: font sizes, line heights (CSS `line-height` factors), letter
// spacing. These helpers lay text out the way the browser does: every line
// sits in a line box of `lineBox` points with the glyphs centred in it
// (half-leading above and below), so a design's mm values map 1:1.

/// IBM Plex Sans Arabic at a size given in millimetres.
func ghPdfPlex(_ sizeMM: CGFloat, _ weight: GHWeight = .regular) -> UIFont {
    UIFont.gh(sizeMM * ghPdfMM, weight)
}

/// Cormorant Garamond at a size given in millimetres. The bundled file is the
/// variable font (registered as CormorantGaramond-Light); `weight` is set on
/// its wght axis (300…700). Falls back to the Light face.
func ghPdfSerif(_ sizeMM: CGFloat, weight: CGFloat = 400) -> UIFont {
    let size = sizeMM * ghPdfMM
    guard let light = UIFont(name: "CormorantGaramond-Light", size: size) else {
        return UIFont.systemFont(ofSize: size, weight: .light)
    }
    if weight <= 300 { return light }
    let key = UIFontDescriptor.AttributeName(rawValue: kCTFontVariationAttribute as String)
    let wghtTag = NSNumber(value: 0x77676874) // 'wght'
    let axes: [NSNumber: NSNumber] = [wghtTag: NSNumber(value: Double(weight))]
    let descriptor = light.fontDescriptor.addingAttributes([key: axes])
    return UIFont(descriptor: descriptor, size: size)
}

/// One styled run of a paragraph.
struct GHPdfRun {
    let text: String
    let font: UIFont
    let color: UIColor
    let kern: CGFloat

    init(_ text: String, _ font: UIFont, _ color: UIColor, kern: CGFloat = 0) {
        self.text = text
        self.font = font
        self.color = color
        self.kern = kern
    }
}

/// A paragraph that wraps like a CSS block: `lh` is the CSS line-height
/// factor (nil = normal), `kern` is letter-spacing in points.
struct GHPdfPara {
    let attributed: NSAttributedString
    let ascent: CGFloat
    let descent: CGFloat
    let lineBox: CGFloat
    let maxLines: Int
    let alignment: NSTextAlignment

    private struct Line {
        let range: NSRange
        let width: CGFloat
    }

    init(_ text: String, _ font: UIFont, _ color: UIColor, kern: CGFloat = 0, lh: CGFloat? = nil,
         align: NSTextAlignment = .right, ltr: Bool = false, maxLines: Int = 0) {
        self.init(runs: [GHPdfRun(text, font, color, kern: kern)], lh: lh, align: align, ltr: ltr,
                  maxLines: maxLines)
    }

    init(runs: [GHPdfRun], lh: CGFloat? = nil, align: NSTextAlignment = .right, ltr: Bool = false,
         maxLines: Int = 0) {
        let p = NSMutableParagraphStyle()
        p.baseWritingDirection = ltr ? .leftToRight : .rightToLeft
        p.alignment = align
        p.lineBreakMode = .byWordWrapping
        let s = NSMutableAttributedString()
        var asc: CGFloat = 0
        var desc: CGFloat = 0
        var size: CGFloat = 0
        for r in runs {
            var attrs: [NSAttributedString.Key: Any] = [
                .font: r.font,
                .foregroundColor: r.color,
                .paragraphStyle: p,
            ]
            if r.kern != 0 { attrs[.kern] = r.kern }
            s.append(NSAttributedString(string: r.text, attributes: attrs))
            asc = max(asc, r.font.ascender)
            desc = max(desc, -r.font.descender)
            if size == 0 { size = r.font.pointSize }
        }
        self.attributed = s
        self.ascent = asc
        self.descent = desc
        if let lh {
            self.lineBox = lh * size
        } else {
            self.lineBox = asc + desc
        }
        self.maxLines = maxLines
        self.alignment = align
    }

    /// Offset of the first baseline from the top of the box.
    var firstBaseline: CGFloat { (lineBox - ascent - descent) / 2 + ascent }

    /// Line breaks at `width` (CoreText, the same typesetter UIKit draws with).
    private func lines(_ width: CGFloat) -> [Line] {
        let total = (attributed.string as NSString).length
        if total == 0 { return [Line(range: NSRange(location: 0, length: 0), width: 0)] }
        let typesetter = CTTypesetterCreateWithAttributedString(attributed as CFAttributedString)
        let limit = Double(max(width, 1))
        var out: [Line] = []
        var start = 0
        while start < total {
            var count = CTTypesetterSuggestLineBreak(typesetter, start, limit)
            if count <= 0 { count = 1 }
            let line = CTTypesetterCreateLine(typesetter, CFRange(location: start, length: count))
            let full = CTLineGetTypographicBounds(line, nil, nil, nil)
            let w = full - CTLineGetTrailingWhitespaceWidth(line)
            out.append(Line(range: NSRange(location: start, length: count), width: CGFloat(max(w, 0))))
            start += count
        }
        return out
    }

    private func lineCount(_ width: CGFloat) -> Int {
        let n = lines(width).count
        return maxLines > 0 ? min(n, maxLines) : n
    }

    /// Widest line when wrapped at `maxWidth` (the intrinsic width of one line).
    func width(maxWidth: CGFloat = 10_000) -> CGFloat {
        var w: CGFloat = 0
        for l in lines(maxWidth) { w = max(w, l.width) }
        return min(ceil(w), maxWidth)
    }

    func height(width: CGFloat) -> CGFloat {
        CGFloat(max(lineCount(width), 1)) * lineBox
    }

    /// Draws the paragraph in the box (x, y, width), aligned inside it.
    func draw(x: CGFloat, y: CGFloat, width: CGFloat) {
        let all = lines(width)
        let ns = attributed.string as NSString
        let count = maxLines > 0 ? min(all.count, maxLines) : all.count
        if count <= 0 { return }
        for i in 0..<count {
            var range = all[i].range
            let truncate = (i == count - 1) && count < all.count
            if truncate { range = NSRange(location: range.location, length: ns.length - range.location) }
            while range.length > 0 {
                let c = ns.character(at: range.location + range.length - 1)
                if c == 10 || c == 13 || c == 32 || c == 0x2028 || c == 0x2029 {
                    range.length -= 1
                } else {
                    break
                }
            }
            if range.length <= 0 { continue }
            let sub = attributed.attributedSubstring(from: range)
            let baseline = y + CGFloat(i) * lineBox + firstBaseline
            let top = baseline - ascent
            let h = ceil(ascent + descent) + 1
            // 2 pt of slack so a measured line never re-wraps when drawn.
            let rect: CGRect
            switch alignment {
            case .left: rect = CGRect(x: x, y: top, width: width + 2, height: h)
            case .center: rect = CGRect(x: x - 1, y: top, width: width + 2, height: h)
            default: rect = CGRect(x: x - 2, y: top, width: width + 2, height: h)
            }
            var options: NSStringDrawingOptions = [.usesLineFragmentOrigin]
            if truncate { options.insert(.truncatesLastVisibleLine) }
            sub.draw(with: rect, options: options, context: nil)
        }
    }

    /// One line with its baseline at `baseline` and its left edge at `left`.
    func drawLine(left: CGFloat, baseline: CGFloat) {
        draw(x: left, y: baseline - firstBaseline, width: width())
    }

    func drawLine(right: CGFloat, baseline: CGFloat) {
        let w = width()
        draw(x: right - w, y: baseline - firstBaseline, width: w)
    }

    func drawLine(centerX: CGFloat, baseline: CGFloat) {
        let w = width()
        draw(x: centerX - w / 2, y: baseline - firstBaseline, width: w)
    }
}

/// Single-line pieces side by side on one baseline (a CSS flex row with
/// align-items: baseline). Right-to-left: the first piece is on the right.
struct GHPdfInline {
    let pieces: [GHPdfPara]
    let gap: CGFloat
    let widths: [CGFloat]

    init(_ pieces: [GHPdfPara], gap: CGFloat) {
        self.pieces = pieces
        self.gap = gap
        self.widths = pieces.map { $0.width() }
    }

    var width: CGFloat {
        widths.reduce(0, +) + gap * CGFloat(max(pieces.count - 1, 0))
    }

    /// Height above the shared baseline.
    var above: CGFloat {
        var v: CGFloat = 0
        for p in pieces { v = max(v, p.firstBaseline) }
        return v
    }

    /// Height below the shared baseline.
    var below: CGFloat {
        var v: CGFloat = 0
        for p in pieces { v = max(v, p.lineBox - p.firstBaseline) }
        return v
    }

    var height: CGFloat { above + below }

    func draw(right: CGFloat, baseline: CGFloat) {
        var r = right
        for (i, p) in pieces.enumerated() {
            let w = widths[i]
            p.drawLine(left: r - w, baseline: baseline)
            r -= w + gap
        }
    }

    func draw(right: CGFloat, top: CGFloat) {
        draw(right: right, baseline: top + above)
    }
}

/// Wraps text in a left-to-right embedding, so a phone number or a handle
/// keeps its order inside an Arabic line.
func ghPdfLTR(_ s: String) -> String { "\u{202A}\(s)\u{202C}" }

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

/// QR code (pw.Barcode.qrCode(), correction level L by default) filling `rect`.
func ghPdfDrawQR(_ text: String, in rect: CGRect, color: UIColor = .black, correction: String = "L") {
    guard let filter = CIFilter(name: "CIQRCodeGenerator") else { return }
    filter.setValue(Data(text.utf8), forKey: "inputMessage")
    filter.setValue(correction, forKey: "inputCorrectionLevel")
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
