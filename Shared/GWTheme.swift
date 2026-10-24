import SwiftUI
import UIKit

// The widgets' look: calm luxury on the brand colours (maroon, gold, ivory),
// IBM Plex Sans Arabic, small spaced Latin capitals and the leaping cheetah.
// Compiled into the app (widget gallery) and the extension.

enum GWHex {
    /// 0xRRGGBB
    static func color(_ rgb: UInt32, _ opacity: Double = 1) -> Color {
        let r = Double((rgb >> 16) & 0xff) / 255
        let g = Double((rgb >> 8) & 0xff) / 255
        let b = Double(rgb & 0xff) / 255
        return Color(.sRGB, red: r, green: g, blue: b, opacity: opacity)
    }
}

/// Fixed brand colours.
enum GWBrand {
    static let maroon = GWHex.color(0x350304)
    static let burgundy = GWHex.color(0x5C0B16)
    static let wine = GWHex.color(0x6B111C)
    static let gold = GWHex.color(0xCEAE6E)
    static let ivory = GWHex.color(0xF4EEE8)
    static let night = GWHex.color(0x1F1915)
    static let nightDeep = GWHex.color(0x110C0A)

    static let blue = GWHex.color(0x3F7BD9)
    static let purple = GWHex.color(0x8A57C9)
    static let red = GWHex.color(0xD9443F)
    static let amber = GWHex.color(0xD98A1E)
    static let green = GWHex.color(0x2E9A60)
    static let teal = GWHex.color(0x1C9C9C)
    static let grey = GWHex.color(0x8E8E93)

    static func status(_ key: String) -> Color {
        switch key {
        case "requested": return blue
        case "purchased": return amber
        case "arrived": return green
        case "out_for_delivery": return teal
        case "delivered": return purple
        default: return grey
        }
    }
}

/// Colours that follow light / dark (resolved from the view's colour scheme).
struct GWPalette {
    let dark: Bool

    init(_ scheme: ColorScheme) { dark = scheme == .dark }

    var paper: Color { dark ? GWHex.color(0x16100E) : GWHex.color(0xF4EEE8) }
    var card: Color { dark ? GWHex.color(0x241B18) : GWHex.color(0xFFFFFF) }
    var ink: Color { dark ? GWHex.color(0xF3EBE2) : GWHex.color(0x1F1915) }
    var muted: Color { dark ? GWHex.color(0xB2A49B) : GWHex.color(0x7A6C66) }
    var faint: Color { dark ? GWHex.color(0x6E625B) : GWHex.color(0xB9AEA7) }
    /// Burgundy on ivory, a soft rose on the dark paper.
    var accent: Color { dark ? GWHex.color(0xD98A95) : GWHex.color(0x5C0B16) }
    /// Gold dark enough to read on ivory.
    var gold: Color { dark ? GWHex.color(0xCEAE6E) : GWHex.color(0xA4803C) }
    var hairline: Color { dark ? GWHex.color(0xCEAE6E, 0.22) : GWHex.color(0xB08A45, 0.28) }
    var track: Color { dark ? GWHex.color(0xFFFFFF, 0.10) : GWHex.color(0x5C0B16, 0.08) }
}

enum GWWeight { case regular, medium, semibold, bold }

enum GWFont {
    static func name(_ w: GWWeight) -> String {
        switch w {
        case .regular: return "IBMPlexSansArabic-Regular"
        case .medium: return "IBMPlexSansArabic-Medium"
        case .semibold: return "IBMPlexSansArabic-SemiBold"
        case .bold: return "IBMPlexSansArabic-Bold"
        }
    }

    /// The brand font at a fixed size (widgets have a fixed canvas).
    static func plex(_ size: CGFloat, _ w: GWWeight = .regular) -> Font {
        Font.custom(name(w), fixedSize: size)
    }

    static func number(_ size: CGFloat, _ w: GWWeight = .bold) -> Font {
        plex(size, w).monospacedDigit()
    }
}

/// Small spaced Latin capitals: the brand's quiet signature ("GH SHOPPER", "TODAY").
struct GWCaps: View {
    let text: String
    let color: Color
    var size: CGFloat = 8.5

    init(_ text: String, color: Color, size: CGFloat = 8.5) {
        self.text = text
        self.color = color
        self.size = size
    }

    var body: some View {
        Text(verbatim: text.uppercased())
            .font(GWFont.plex(size, .semibold))
            .tracking(size * 0.28)
            .foregroundStyle(color)
            .lineLimit(1)
            .environment(\.layoutDirection, .leftToRight)
    }
}

enum GWImage {
    /// The gold cheetah: the deeper gold for light backgrounds, the light gold for dark ones.
    static func cheetah(onDark: Bool) -> UIImage? {
        let name = onDark ? "story_cheetah_light" : "story_cheetah"
        if let i = UIImage(named: name) { return i }
        if let p = Bundle.main.path(forResource: name, ofType: "png") { return UIImage(contentsOfFile: p) }
        return nil
    }
}

/// The small leaping cheetah.
struct GWCheetah: View {
    let onDark: Bool
    var height: CGFloat = 12
    var opacity: Double = 1

    var body: some View {
        if let img = GWImage.cheetah(onDark: onDark) {
            Image(uiImage: img)
                .resizable()
                .scaledToFit()
                .frame(height: height)
                .opacity(opacity)
        }
    }
}

enum GWBackgroundStyle { case paper, maroon, night }

/// Each widget's background (the extension passes it to containerBackground; the gallery draws it).
struct GWBackground: View {
    let style: GWBackgroundStyle
    @Environment(\.colorScheme) var scheme

    init(_ style: GWBackgroundStyle) { self.style = style }

    var body: some View {
        switch style {
        case .paper: paper
        case .maroon: maroon
        case .night: night
        }
    }

    private var paper: some View {
        let p = GWPalette(scheme)
        return ZStack {
            p.paper
            LinearGradient(colors: [GWBrand.gold.opacity(p.dark ? 0.07 : 0.10), .clear],
                           startPoint: .topTrailing, endPoint: .center)
        }
    }

    private var maroon: some View {
        let top = scheme == .dark ? GWHex.color(0x4A0810) : GWBrand.wine
        let bottom = scheme == .dark ? GWHex.color(0x1C0102) : GWBrand.maroon
        return LinearGradient(colors: [top, bottom], startPoint: .topTrailing, endPoint: .bottomLeading)
    }

    private var night: some View {
        LinearGradient(colors: [GWHex.color(0x2A201C), GWBrand.nightDeep], startPoint: .top, endPoint: .bottom)
    }
}

/// A thin progress line (grows from the leading edge: the right in Arabic).
struct GWProgressLine: View {
    let value: Double
    let track: Color
    let fill: Color
    var height: CGFloat = 3

    var body: some View {
        GeometryReader { g in
            ZStack(alignment: .leading) {
                Capsule().fill(track)
                Capsule().fill(fill).frame(width: max(height, g.size.width * min(max(value, 0), 1)))
            }
        }
        .frame(height: height)
    }
}

/// Deep links into the app (registered URL scheme "ghadmin").
enum GWLink {
    static let today = URL(string: "ghadmin://today")!
    static let requests = URL(string: "ghadmin://requests")!
    static let chats = URL(string: "ghadmin://chats")!
    static let orders = URL(string: "ghadmin://orders")!
    static let drivers = URL(string: "ghadmin://drivers")!
    static let driver = URL(string: "ghadmin://driver")!
    static let trips = URL(string: "ghadmin://trips")!

    static func order(_ id: String) -> URL { URL(string: "ghadmin://order/\(id)") ?? orders }
    static func trip(_ id: String) -> URL { URL(string: "ghadmin://trip/\(id)") ?? trips }
    static func driverOrder(_ id: String) -> URL { URL(string: "ghadmin://driver/order/\(id)") ?? driver }
}
