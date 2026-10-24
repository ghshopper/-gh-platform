import SwiftUI
import UIKit

// The gift message card (كرت الإهداء). The shop pre-prints blank ivory cards,
// 150 × 100 mm landscape, with a small gold cheetah at the top centre; staff
// print only the customer's message onto them on an office inkjet (front
// tray, 4×6" photo paper, fed portrait, short edge first). So the PDF / print
// is TEXT ONLY: no background, no cheetah.
//
// Layout (approved sample s15.html): the message box is 20 mm from the left
// and right, 34 mm from the top and 14 mm from the bottom; the text is
// centred both ways in it. IBM Plex Sans Arabic Regular 5.2 mm, line height
// 1.75, maroon #350304, centred, right-to-left; shrunk down to 3.6 mm when it
// does not fit.

/// Card page size: 150 × 100 mm landscape (425.2 × 283.5 pt).
let ghGiftCardPageSize = CGSize(width: 150 * ghPdfMM, height: 100 * ghPdfMM)

/// 4×6" photo paper in portrait (101.6 × 152.4 mm = 288 × 432 pt).
private let giftCardPaper = CGSize(width: 288, height: 432)

private func gcMM(_ v: CGFloat) -> CGFloat { v * ghPdfMM }

private enum GiftCardInk {
    static var maroon: UIColor { UIColor(red: 0x35 / 255.0, green: 0x03 / 255.0, blue: 0x04 / 255.0, alpha: 1) }
    /// The pre-printed card's ivory (preview only, never printed).
    static var ivory: UIColor { UIColor(red: 0xF4 / 255.0, green: 0xEE / 255.0, blue: 0xE8 / 255.0, alpha: 1) }
}

/// The message box on the card, in points.
private var giftCardBox: CGRect {
    CGRect(x: gcMM(20), y: gcMM(34), width: gcMM(110), height: gcMM(52))
}

private let giftCardFontMax: CGFloat = 5.2
private let giftCardFontMin: CGFloat = 3.6

private func giftCardPara(_ text: String, sizeMM: CGFloat) -> GHPdfPara {
    GHPdfPara(text, ghPdfPlex(sizeMM, .regular), GiftCardInk.maroon, lh: 1.75, align: .center)
}

/// Line endings normalised and blank edges trimmed.
private func giftCardClean(_ text: String) -> String {
    let unix = text.replacingOccurrences(of: "\r\n", with: "\n").replacingOccurrences(of: "\r", with: "\n")
    return unix.trimmingCharacters(in: .whitespacesAndNewlines)
}

/// The paragraph at the biggest size (5.2 mm down to 3.6 mm, 0.1 mm steps) that fits the box.
private func giftCardFitted(_ text: String) -> GHPdfPara {
    let box = giftCardBox
    var size = giftCardFontMax
    var para = giftCardPara(text, sizeMM: size)
    while para.height(width: box.width) > box.height && size - 0.1 >= giftCardFontMin - 0.001 {
        size -= 0.1
        para = giftCardPara(text, sizeMM: size)
    }
    return para
}

/// Draws the message (text only) into the current UIKit context, the card's
/// top-left corner at `origin`.
private func drawGiftCardText(_ text: String, origin: CGPoint = .zero) {
    let clean = giftCardClean(text)
    if clean.isEmpty { return }
    let box = giftCardBox
    let para = giftCardFitted(clean)
    let h = para.height(width: box.width)
    let top = origin.y + box.minY + (box.height - h) / 2
    para.draw(x: origin.x + box.minX, y: top, width: box.width)
}

// MARK: - Text helpers

/// The editor's starting text: the gift message, with "إلى {to}" as the first
/// line when the message does not already start with إلى.
func giftCardInitialText(_ gift: OrderGift?) -> String {
    guard let gift else { return "" }
    let msg = giftCardClean(gift.message ?? "")
    let to = (gift.to ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    let startsWithTo = msg.hasPrefix("إلى") || msg.hasPrefix("الى")
    if to.isEmpty || startsWithTo { return msg }
    if msg.isEmpty { return "إلى \(to)" }
    return "إلى \(to)\n\(msg)"
}

/// The text to print: the message, then the signature ("— name") on the last line.
func giftCardText(message: String, signature: String) -> String {
    let body = giftCardClean(message)
    var sig = signature.trimmingCharacters(in: .whitespacesAndNewlines)
    if sig.isEmpty { return body }
    if !sig.hasPrefix("—") { sig = "— " + sig }
    if body.isEmpty { return sig }
    return body + "\n" + sig
}

// MARK: - PDF

/// Builds the card PDF: one 150 × 100 mm landscape page with the message only.
func buildGiftCardPdf(text: String) -> Data {
    let size = ghGiftCardPageSize
    let format = UIGraphicsPDFRendererFormat()
    format.documentInfo = [kCGPDFContextTitle as String: "Gift Card"]
    let renderer = UIGraphicsPDFRenderer(bounds: CGRect(origin: .zero, size: size), format: format)
    return renderer.pdfData { ctx in
        ctx.beginPage()
        drawGiftCardText(text)
    }
}

/// On-screen preview: the ivory card with the gold cheetah where it is
/// pre-printed (top 10 mm, 22 mm wide, centred), and the message to scale.
func giftCardPreviewImage(text: String) -> UIImage {
    let size = ghGiftCardPageSize
    let fmt = UIGraphicsImageRendererFormat()
    fmt.scale = 2
    fmt.opaque = true
    return UIGraphicsImageRenderer(size: size, format: fmt).image { _ in
        ghPdfFill(CGRect(origin: .zero, size: size), GiftCardInk.ivory)
        if let cheetah = GHImage.named("story_cheetah"), cheetah.size.width > 0 {
            let w = gcMM(22)
            let h = w * cheetah.size.height / cheetah.size.width
            cheetah.draw(in: CGRect(x: (size.width - w) / 2, y: gcMM(10), width: w, height: h))
        }
        drawGiftCardText(text)
    }
}

// MARK: - Print / share

/// Draws the card 1:1 (no scaling to the printable area), centred on the paper,
/// so the text lands exactly where it does on the 150 × 100 mm card.
private final class GiftCardPageRenderer: UIPrintPageRenderer {
    let text: String

    init(text: String) {
        self.text = text
        super.init()
    }

    override var numberOfPages: Int { 1 }

    override func drawPage(at pageIndex: Int, in printableRect: CGRect) {
        let paper = paperRect
        let card = ghGiftCardPageSize
        let origin = CGPoint(x: paper.midX - card.width / 2, y: paper.midY - card.height / 2)
        drawGiftCardText(text, origin: origin)
    }
}

/// Picks the paper closest to 4×6" (101.6 × 152.4 mm), in either orientation.
private final class GiftCardPrintDelegate: NSObject, UIPrintInteractionControllerDelegate {
    func printInteractionController(_ printInteractionController: UIPrintInteractionController,
                                    choosePaper paperList: [UIPrintPaper]) -> UIPrintPaper {
        var best: UIPrintPaper? = nil
        var bestDistance = CGFloat.greatestFiniteMagnitude
        for p in paperList {
            let s = p.paperSize
            let short = min(s.width, s.height)
            let long = max(s.width, s.height)
            let d = abs(short - giftCardPaper.width) + abs(long - giftCardPaper.height)
            if d < bestDistance {
                bestDistance = d
                best = p
            }
        }
        if let best { return best }
        return UIPrintPaper.bestPaper(forPageSize: giftCardPaper, withPapersFrom: paperList)
    }
}

private final class GiftCardPrintOnce {
    var done = false
}

/// Opens the iOS print sheet (AirPrint) for the card on 4×6" photo paper.
@MainActor
func printGiftCard(text: String) async {
    let controller = UIPrintInteractionController.shared
    let info = UIPrintInfo(dictionary: nil)
    info.outputType = .photo
    info.orientation = .landscape
    info.jobName = "Gift Card"
    controller.printInfo = info
    controller.printingItem = nil
    controller.printPageRenderer = GiftCardPageRenderer(text: text)
    let delegate = GiftCardPrintDelegate()
    controller.delegate = delegate
    let once = GiftCardPrintOnce()
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
    controller.printPageRenderer = nil
}

/// Writes Gift-Card.pdf (exact 150 × 100 mm page) and opens the share sheet.
@MainActor
func shareGiftCard(text: String) {
    let data = buildGiftCardPdf(text: text)
    let url = FileManager.default.temporaryDirectory.appendingPathComponent("Gift-Card.pdf")
    do {
        try data.write(to: url, options: .atomic)
    } catch {
        toastError(error)
        return
    }
    share([url])
}

// MARK: - Editor page

/// An action that is nil (disabled) when `on` is false.
fileprivate func gcEnabled(_ on: Bool, _ f: @escaping () -> Void) -> (() -> Void)? { on ? f : nil }

/// "اطبع كرت الإهداء": edit the message, see it on the card, print or share.
struct GiftCardPage: View {
    @State private var message: String
    @State private var signature = ""
    @State private var printing = false
    @Environment(\.dismiss) private var dismiss

    init(gift: OrderGift?) {
        _message = State(initialValue: giftCardInitialText(gift))
    }

    private var finalText: String { giftCardText(message: message, signature: signature) }
    private var isEmpty: Bool { finalText.isEmpty }

    var body: some View {
        GHPage("كرت الإهداء", largeTitle: false, leading: {
            NavButton("إغلاق", action: { dismiss() })
        }, bottom: {
            buttons
        }) {
            preview
            editorSection
            signatureSection
        }
    }

    private var preview: some View {
        let img = giftCardPreviewImage(text: finalText)
        return Image(uiImage: img)
            .resizable()
            .aspectRatio(1.5, contentMode: .fit)
            .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 6, style: .continuous).stroke(GH.separator, lineWidth: 0.5))
            .ghShadow()
            .padding(.horizontal, 16)
            .padding(.top, 12)
            .padding(.bottom, 8)
    }

    private var editorSection: some View {
        GHSection("الرسالة", footer: "يُطبع النص فقط على الكرت الجاهز (150 × 100 مم)، في الدرج الأمامي.") {
            TextField("", text: $message, prompt: Text("اكتب رسالة الإهداء").foregroundStyle(GH.tertiary), axis: .vertical)
                .lineLimit(4...12)
                .font(.gh(16))
                .foregroundStyle(GH.label)
                .multilineTextAlignment(.center)
                .padding(16)
        }
    }

    private var signatureSection: some View {
        GHSection("التوقيع", footer: "اختياري: يُكتب في آخر سطر (— الاسم).") {
            FieldRow("من", text: $signature, placeholder: "الاسم")
        }
    }

    private var buttons: some View {
        HStack(spacing: 10) {
            SecondaryButton("شارك PDF", icon: "square.and.arrow.up", action: gcEnabled(!isEmpty) {
                shareGiftCard(text: finalText)
            })
            PrimaryButton("اطبع", icon: "printer.fill", busy: printing, action: gcEnabled(!isEmpty && !printing) {
                Task { await doPrint() }
            })
        }
    }

    private func doPrint() async {
        printing = true
        await printGiftCard(text: finalText)
        printing = false
    }
}
