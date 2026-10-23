import SwiftUI
import UIKit

// Port of lib/story/story_canvas.dart: the six Instagram story designs,
// always laid out at 1080 × 1920 points (render with ImageRenderer at scale 1).

/// One product on an Instagram story.
struct StoryData {
    var brand: String
    var name: String
    var price: Double
    /// The old price (crossed out on the offer story). Nil when no discount.
    var was: Double?
    /// The photo (the original first, then the one with the background taken out).
    var image: UIImage?

    /// Photo size (1 = fits its place) and how far it is moved.
    var zoom: CGFloat = 1
    var shiftX: CGFloat = 0
    var shiftY: CGFloat = 0

    /// Show the product name under the brand.
    var showName = true

    init(brand: String, name: String, price: Double, was: Double? = nil, image: UIImage? = nil) {
        self.brand = brand
        self.name = name
        self.price = price
        self.was = was
        self.image = image
    }

    var offPercent: Int? {
        guard let w = was, w > price, w > 0 else { return nil }
        return Int(((w - price) / w * 100).rounded())
    }
}

extension StoryProduct {
    /// The story's own copy of the product (the photo is loaded by the compose page).
    var toData: StoryData { StoryData(brand: brand, name: name, price: price, was: was, image: nil) }
}

/// The six approved story designs (1080 × 1920).
enum StoryTemplate: String, CaseIterable, Identifiable {
    case classic, arch, tag, editorial, offer, clean

    var id: String { rawValue }

    var label: String {
        switch self {
        case .classic: return "كلاسيك"
        case .arch: return "القوس"
        case .tag: return "بطاقة السعر"
        case .editorial: return "مجلة"
        case .offer: return "عرض / خصم"
        case .clean: return "نظيف"
        }
    }
}

func storyPrice(_ v: Double) -> String { String(format: "%.3f", v) }

fileprivate enum StoryPalette {
    static let beige = Color(hex: 0xFFF3ECE1)
    static let beige2 = Color(hex: 0xFFE9DFCF)
    static let ink = Color(hex: 0xFF1F1915)
    static let sub = Color(hex: 0xFF6E6258)
    static let maroon = Color(hex: 0xFF5C0B16)
    static let gold = Color(hex: 0xFF967034)
    static let goldLight = Color(hex: 0xFFE2C88C)
    static let white = Color(hex: 0xFFFFFFFF)
}

/// Latin serif (Cormorant Garamond).
fileprivate func storyLatin(_ s: String, _ size: CGFloat, color: Color = StoryPalette.ink, spacing: CGFloat = 0) -> Text {
    Text(s).font(.serif(size)).tracking(spacing).foregroundColor(color)
}

/// Arabic (IBM Plex Sans Arabic).
fileprivate func storyAr(_ s: String, _ size: CGFloat, color: Color = StoryPalette.ink, weight: GHWeight = .regular) -> Text {
    Text(s).font(.gh(size, weight)).foregroundColor(color)
}

/// Prices: clean, even digits.
fileprivate func storyNum(_ s: String, _ size: CGFloat, color: Color = StoryPalette.ink, weight: GHWeight = .semibold) -> Text {
    Text(s).font(.gh(size, weight).monospacedDigit()).tracking(size * 0.01).foregroundColor(color)
}

fileprivate extension View {
    /// Flutter `Positioned(top:, left:, width:, height:)`.
    func storyBox(_ top: CGFloat, _ left: CGFloat, _ w: CGFloat, _ h: CGFloat) -> some View {
        self.frame(width: w, height: h).offset(x: left, y: top)
    }

    /// Centred across the story, at this height.
    func storyCentered(_ top: CGFloat) -> some View {
        self.frame(width: StoryCanvas.width).offset(y: top)
    }
}

/// The story itself, always laid out at 1080 × 1920.
struct StoryCanvas: View {
    let data: StoryData
    let template: StoryTemplate
    /// "Order from the app" lines.
    var showCta: Bool = true

    static let width: CGFloat = 1080
    static let height: CGFloat = 1920

    init(data: StoryData, template: StoryTemplate, showCta: Bool = true) {
        self.data = data
        self.template = template
        self.showCta = showCta
    }

    var body: some View {
        designed
            .frame(width: Self.width, height: Self.height, alignment: .topLeading)
            .clipped()
            // Positions are absolute (left / right), as in the Dart canvas.
            .environment(\.layoutDirection, .leftToRight)
    }

    @ViewBuilder private var designed: some View {
        switch template {
        case .classic: designClassic
        case .arch: designArch
        case .tag: designTag
        case .editorial: designEditorial
        case .offer: designOffer
        case .clean: designClean
        }
    }

    // MARK: pieces

    private func storyBackground(_ c: Color) -> some View {
        c.frame(width: Self.width, height: Self.height)
    }

    private func gap(_ h: CGFloat) -> some View { Color.clear.frame(width: 1, height: h) }
    private func gapW(_ w: CGFloat) -> some View { Color.clear.frame(width: w, height: 1) }

    private func asset(_ name: String, width: CGFloat) -> some View {
        Image(uiImage: GHImage.named(name) ?? UIImage()).resizable().scaledToFit().frame(width: width)
    }

    private func asset(_ name: String, height: CGFloat) -> some View {
        Image(uiImage: GHImage.named(name) ?? UIImage()).resizable().scaledToFit().frame(height: height)
    }

    /// The product photo, blended into the background (white photo backgrounds
    /// disappear into the beige, like mix-blend-mode: multiply).
    @ViewBuilder private func photo(blend: Bool = true) -> some View {
        if let img = data.image {
            Image(uiImage: img)
                .resizable()
                .interpolation(.high)
                .scaledToFit()
                .scaleEffect(data.zoom)
                .offset(x: data.shiftX, y: data.shiftY)
                .blendMode(blend ? .multiply : .normal)
        } else {
            Color.clear
        }
    }

    /// The brand, shrunk to fit long names.
    private func brand(_ size: CGFloat, spacing: CGFloat = 0.2, color: Color = StoryPalette.ink, maxWidth: CGFloat = 900) -> some View {
        storyLatin(data.brand.uppercased(), size, color: color, spacing: size * spacing)
            .lineLimit(1)
            .minimumScaleFactor(0.05)
            .frame(width: maxWidth)
    }

    private var hasName: Bool {
        data.showName && !data.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    @ViewBuilder private func name(_ size: CGFloat, color: Color = StoryPalette.sub, maxWidth: CGFloat = 900) -> some View {
        if hasName {
            storyAr(data.name, size, color: color)
                .multilineTextAlignment(.center)
                .lineLimit(2)
                .truncationMode(.tail)
                .frame(width: maxWidth)
                .environment(\.layoutDirection, .rightToLeft)
        }
    }

    @ViewBuilder private func fitText(_ t: Text, _ width: CGFloat?) -> some View {
        if let width {
            t.lineLimit(1).minimumScaleFactor(0.2).frame(maxWidth: width)
        } else {
            t.lineLimit(1).fixedSize()
        }
    }

    /// 12.500 then ر.ع (beside, or below).
    @ViewBuilder private func price(_ size: CGFloat, color: Color = StoryPalette.maroon, below: Bool = false, fit: CGFloat? = nil) -> some View {
        let n = storyNum(storyPrice(data.price), size * 0.78, color: color)
        let c = storyAr("ر.ع", size * 0.36, color: color, weight: .medium)
        if below {
            VStack(spacing: 6) {
                fitText(n, fit)
                c.fixedSize()
            }
        } else {
            HStack(alignment: .center, spacing: size * 0.18) {
                n.lineLimit(1).fixedSize()
                c.fixedSize()
            }
        }
    }

    private func kicker(_ s: String, color: Color = StoryPalette.gold, size: CGFloat = 30) -> some View {
        storyLatin(s, size, color: color, spacing: size * 0.42).lineLimit(1).fixedSize()
    }

    // MARK: 1 · Classic

    private var designClassic: some View {
        ZStack(alignment: .topLeading) {
            storyBackground(StoryPalette.beige)
            asset("story_logo", width: 170).storyCentered(250)
            kicker("NEW IN").storyCentered(470)
            photo().storyBox(530, 140, 800, 700)
            classicInfo.storyCentered(1250)
            if showCta {
                storyAr("متوفر الحين في تطبيق GH Shopper", 32, color: StoryPalette.sub, weight: .medium)
                    .lineLimit(1).fixedSize()
                    .storyCentered(1640)
            }
        }
    }

    private var classicInfo: some View {
        VStack(spacing: 0) {
            brand(66)
            gap(8)
            name(38)
            StoryPalette.gold.frame(width: 70, height: 2).padding(.vertical, 30)
            price(96)
        }
    }

    // MARK: 2 · Arch

    private var designArch: some View {
        ZStack(alignment: .topLeading) {
            storyBackground(StoryPalette.beige2)
            archWindow.offset(x: 130, y: 250)
            archInfo.offset(x: 130, y: 1250)
            asset("story_cheetah", width: 300).storyCentered(1648)
        }
    }

    private var archWindow: some View {
        ZStack(alignment: .topLeading) {
            StoryPalette.white.frame(width: 820, height: 1000)
            UnevenRoundedRectangle(topLeadingRadius: 392, topTrailingRadius: 392, style: .circular)
                .stroke(StoryPalette.goldLight, lineWidth: 2)
                .frame(width: 784, height: 1100)
                .offset(x: 18, y: 18)
            photo().storyBox(170, 60, 700, 780)
        }
        .frame(width: 820, height: 1000, alignment: .topLeading)
        .clipShape(UnevenRoundedRectangle(topLeadingRadius: 410, topTrailingRadius: 410, style: .circular))
    }

    private var archInfo: some View {
        VStack(spacing: 0) {
            brand(58, spacing: 0.22, maxWidth: 700)
            gap(6)
            name(36, maxWidth: 700)
            gap(34)
            archPill
        }
        .padding(.top, 56).padding(.horizontal, 60).padding(.bottom, 60)
        .frame(width: 820)
        .background(StoryPalette.beige)
    }

    /// In the old right-to-left row the words sit on the right of the price.
    private var archPill: some View {
        HStack(alignment: .center, spacing: 0) {
            price(64, color: StoryPalette.white)
            if showCta {
                gapW(22)
                storyAr("اطلبه الحين", 28, color: StoryPalette.goldLight).lineLimit(1).fixedSize()
            }
        }
        .padding(.horizontal, 44).padding(.vertical, 16)
        .background(Capsule().fill(StoryPalette.maroon))
    }

    // MARK: 3 · Price tag

    private var designTag: some View {
        ZStack(alignment: .topLeading) {
            storyBackground(StoryPalette.beige)
            tagHeader.storyCentered(260)
            photo().storyBox(470, 90, 760, 980)
            StoryStringShape().stroke(StoryPalette.gold, lineWidth: 2.5).storyBox(800, 690, 220, 160)
            priceTag
                .frame(width: 300, height: 420)
                .rotationEffect(.degrees(8))
                .offset(x: 1080 - 70 - 300, y: 900)
            if showCta { tagCta.storyCentered(1520) }
        }
    }

    private var tagHeader: some View {
        VStack(spacing: 0) {
            brand(84)
            gap(14)
            name(38)
        }
    }

    private var tagLine: some View {
        StoryPalette.goldLight.frame(width: 50, height: 1).padding(.vertical, 14)
    }

    private var priceTag: some View {
        ZStack(alignment: .topLeading) {
            StoryPalette.maroon.frame(width: 300, height: 420)
            Circle().fill(StoryPalette.beige).frame(width: 30, height: 30).offset(x: 135, y: 70 - 26)
            VStack(spacing: 0) {
                kicker("PRICE", color: StoryPalette.goldLight, size: 24)
                tagLine
                price(84, color: StoryPalette.white, below: true, fit: 260)
                tagLine
                kicker("GH", color: StoryPalette.goldLight, size: 24)
            }
            .frame(width: 300, height: 350)
            .offset(y: 70)
        }
        .frame(width: 300, height: 420, alignment: .topLeading)
        .clipShape(StoryTagShape())
    }

    private var tagCta: some View {
        storyAr("اطلبه من التطبيق", 32, weight: .medium)
            .lineLimit(1).fixedSize()
            .padding(.horizontal, 48).padding(.vertical, 18)
            .overlay(Rectangle().strokeBorder(StoryPalette.ink, lineWidth: 1.5))
    }

    // MARK: 4 · Editorial

    private var designEditorial: some View {
        ZStack(alignment: .topLeading) {
            storyBackground(StoryPalette.beige)
            editorialBrand.storyCentered(250)
            photo().storyBox(360, 120, 840, 980)
            editorialInfo.frame(width: 900).offset(x: 90, y: 1350)
            editorialFooter.frame(width: 900).offset(x: 90, y: 1560)
        }
    }

    private func bigBrand(_ color: Color) -> some View {
        storyLatin(data.brand.uppercased(), 250, color: color)
            .lineLimit(1)
            .minimumScaleFactor(0.05)
            .frame(width: 980)
    }

    private static let outline: [CGSize] = [
        CGSize(width: -1.5, height: -1.5), CGSize(width: 0, height: -1.5), CGSize(width: 1.5, height: -1.5),
        CGSize(width: -1.5, height: 0), CGSize(width: 1.5, height: 0),
        CGSize(width: -1.5, height: 1.5), CGSize(width: 0, height: 1.5), CGSize(width: 1.5, height: 1.5),
    ]

    /// Big brand name: beige letters with a thin gold outline.
    private var editorialBrand: some View {
        ZStack {
            ForEach(0..<Self.outline.count, id: \.self) { k in
                bigBrand(StoryPalette.gold).offset(Self.outline[k])
            }
            bigBrand(StoryPalette.beige2)
        }
    }

    private var nameParts: [String] { data.name.components(separatedBy: " · ") }

    private var editorialInfo: some View {
        VStack(spacing: 0) {
            StoryPalette.ink.frame(height: 1.5)
            HStack(alignment: .bottom, spacing: 24) {
                price(92, color: StoryPalette.ink)
                editorialText.frame(maxWidth: .infinity, alignment: .trailing)
            }
            .padding(.top, 34)
        }
    }

    /// Start-aligned in the old right-to-left layout = the right edge here.
    private var editorialText: some View {
        VStack(alignment: .trailing, spacing: 0) {
            storyLatin("N° 01 — New in", 34, color: StoryPalette.gold).lineLimit(1)
            if hasName {
                gap(4)
                storyAr(nameParts.first ?? "", 42, weight: .semibold)
                    .lineLimit(2).truncationMode(.tail)
                    .multilineTextAlignment(.trailing)
                if nameParts.count > 1 {
                    storyAr(nameParts.dropFirst().joined(separator: " · "), 30, color: StoryPalette.sub)
                        .multilineTextAlignment(.trailing)
                }
            } else {
                storyLatin(data.brand.uppercased(), 44, spacing: 8).lineLimit(1)
            }
        }
    }

    private var editorialFooter: some View {
        HStack(spacing: 0) {
            asset("story_logo", height: 60)
            Spacer(minLength: 0)
            storyAr("ghshopper.com", 30, color: StoryPalette.sub).lineLimit(1).fixedSize()
        }
    }

    // MARK: 5 · Offer

    private var offText: String {
        if let off = data.offPercent { return "خصم \(off)٪" }
        return "عرض خاص"
    }

    private var designOffer: some View {
        ZStack(alignment: .topLeading) {
            storyBackground(StoryPalette.maroon)
            StoryPalette.beige.storyBox(250, 70, 940, 1380)
            offerRibbon.frame(width: Self.width, alignment: .trailing).offset(x: 20, y: 300)
            kicker("SPECIAL OFFER").offset(x: 130, y: 306)
            photo().storyBox(400, 170, 740, 760)
            offerInfo.storyCentered(1180)
            offerFooter.storyCentered(1668)
        }
    }

    private var offerRibbon: some View {
        storyAr(offText, 44, color: StoryPalette.maroon, weight: .bold)
            .lineLimit(1).fixedSize()
            .padding(.leading, 54).padding(.trailing, 44).padding(.vertical, 14)
            .background(StoryPalette.goldLight)
            .clipShape(StoryRibbonShape())
    }

    private var offerInfo: some View {
        VStack(spacing: 0) {
            brand(56, maxWidth: 820)
            gap(4)
            name(34, maxWidth: 820)
            gap(26)
            HStack(alignment: .center, spacing: 0) {
                if let was = data.was, data.offPercent != nil {
                    storyNum(storyPrice(was), 46, color: StoryPalette.sub, weight: .regular)
                        .strikethrough(true, color: StoryPalette.sub)
                        .lineLimit(1).fixedSize()
                    gapW(34)
                }
                price(100)
            }
        }
    }

    private var offerFooter: some View {
        VStack(spacing: 0) {
            asset("story_cheetah_light", width: 250)
            gap(18)
            storyAr(showCta ? "العرض لفترة محدودة · في التطبيق" : "العرض لفترة محدودة", 30, color: StoryPalette.goldLight)
                .lineLimit(1).fixedSize()
        }
    }

    // MARK: 6 · Clean (no call to action)

    private var designClean: some View {
        ZStack(alignment: .topLeading) {
            storyBackground(StoryPalette.beige)
            asset("story_logo", width: 120).storyCentered(270)
            photo().storyBox(410, 110, 860, 850)
            cleanInfo.storyCentered(1290)
            asset("story_cheetah", width: 170).opacity(0.8).storyCentered(1640)
        }
    }

    private var cleanInfo: some View {
        VStack(spacing: 0) {
            brand(60, spacing: 0.24)
            gap(8)
            name(36)
            gap(30)
            price(84)
        }
    }
}

/// A story shown smaller (Flutter FittedBox): laid out at 1080 × 1920, scaled to this width.
struct StoryPreview: View {
    let data: StoryData
    let template: StoryTemplate
    var showCta: Bool = true
    let width: CGFloat

    var body: some View {
        let s = width / StoryCanvas.width
        StoryCanvas(data: data, template: template, showCta: showCta)
            .scaleEffect(s, anchor: .topLeading)
            .frame(width: width, height: StoryCanvas.height * s, alignment: .topLeading)
            .clipped()
            .environment(\.layoutDirection, .leftToRight)
    }
}

// MARK: - Shapes

fileprivate struct StoryTagShape: Shape {
    func path(in r: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: r.minX + r.width / 2, y: r.minY))
        p.addLine(to: CGPoint(x: r.maxX, y: r.minY + r.height * 0.16))
        p.addLine(to: CGPoint(x: r.maxX, y: r.maxY))
        p.addLine(to: CGPoint(x: r.minX, y: r.maxY))
        p.addLine(to: CGPoint(x: r.minX, y: r.minY + r.height * 0.16))
        p.closeSubpath()
        return p
    }
}

fileprivate struct StoryRibbonShape: Shape {
    func path(in r: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: r.minX, y: r.minY))
        p.addLine(to: CGPoint(x: r.maxX, y: r.minY))
        p.addLine(to: CGPoint(x: r.maxX, y: r.maxY))
        p.addLine(to: CGPoint(x: r.minX, y: r.maxY))
        p.addLine(to: CGPoint(x: r.minX + 22, y: r.minY + r.height / 2))
        p.closeSubpath()
        return p
    }
}

/// The string the price tag hangs from.
fileprivate struct StoryStringShape: Shape {
    func path(in r: CGRect) -> Path {
        var p = Path()
        p.move(to: CGPoint(x: r.minX + r.width * 0.62, y: r.maxY))
        p.addQuadCurve(to: CGPoint(x: r.minX + r.width * 0.05, y: r.minY),
                       control: CGPoint(x: r.minX + r.width * 0.1, y: r.minY + r.height * 0.1))
        return p
    }
}
