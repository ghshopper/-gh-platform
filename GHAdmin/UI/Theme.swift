import SwiftUI
import UIKit

// GH Shopper palette: the brand's deep maroon and gold on warm cream
// neutrals. Every colour has a light and a dark value and follows the phone's
// appearance by itself.

extension UIColor {
    convenience init(hex: UInt32) {
        let a = CGFloat((hex >> 24) & 0xff) / 255
        let r = CGFloat((hex >> 16) & 0xff) / 255
        let g = CGFloat((hex >> 8) & 0xff) / 255
        let b = CGFloat(hex & 0xff) / 255
        self.init(red: r, green: g, blue: b, alpha: a)
    }
}

extension Color {
    /// 0xAARRGGBB
    init(hex: UInt32) { self.init(uiColor: UIColor(hex: hex)) }

    /// A colour with a light and a dark value (0xAARRGGBB each).
    init(light: UInt32, dark: UInt32) {
        self.init(uiColor: UIColor { $0.userInterfaceStyle == .dark ? UIColor(hex: dark) : UIColor(hex: light) })
    }
}

enum GH {
    static let burgundy = Color(light: 0xFF5C0B16, dark: 0xFFC9606F)
    static let burgundyDeep = Color(hex: 0xFF350304)
    static let rose = Color(hex: 0xFFA8455A)
    static let gold = Color(hex: 0xFFB08A45)
    static let goldLight = Color(hex: 0xFFEADCBA)
    static let sand = Color(light: 0xFFF3EBDF, dark: 0xFF2A221D)
    static let ink = Color(light: 0xFF1F1915, dark: 0xFF5A4636)

    static let bg = Color(light: 0xFFF4EEE6, dark: 0xFF100C0A)
    static let card = Color(light: 0xFFFFFFFF, dark: 0xFF1E1916)
    static let separator = Color(light: 0xFFEDE5DA, dark: 0xFF332A25)
    static let label = Color(light: 0xFF1F1915, dark: 0xFFF3EBE2)
    static let secondary = Color(light: 0xFF7A6C66, dark: 0xFFB2A49B)
    static let tertiary = Color(light: 0xFFB9AEA7, dark: 0xFF6E625B)

    static let bar = Color(light: 0xF2F4EEE6, dark: 0xF0171310)
    static let tabBar = Color(light: 0xFCFFFFFF, dark: 0xFC1B1613)
    static let barShadow = Color(light: 0x183A2414, dark: 0x50000000)
    static let imageBg = Color(light: 0xFFF7F2EB, dark: 0xFF2A2420)
    static let pressed = Color(light: 0xFFF3ECE3, dark: 0xFF2B2420)
    static let border = Color(light: 0xFFE4D8C8, dark: 0xFF3D332D)
    static let disabled = Color(light: 0xFFD8CBC3, dark: 0xFF4A403A)
    static let panel = Color(light: 0xFFF2EAE0, dark: 0xFF29221E)
    static let shadowColor = Color(light: 0x0F3A2414, dark: 0x40000000)

    static let green = Color(hex: 0xFF1FA35B)
    static let red = Color(hex: 0xFFE5383B)
    static let amber = Color(hex: 0xFFF08C00)
    static let blue = Color(hex: 0xFF2F7CF6)
    static let purple = Color(hex: 0xFF8E4FD8)
    static let teal = Color(hex: 0xFF13A8A8)
    static let pink = Color(hex: 0xFFE5508C)
    static let grey = Color(uiColor: .systemGray)

    static let statusRequested = Color(hex: 0xFF2F7CF6)
    static let statusPurchased = Color(hex: 0xFFF08C00)
    static let statusArrived = Color(hex: 0xFF1FA35B)
    static let statusDelivered = Color(hex: 0xFF8E4FD8)

    /// Maroon gradient for the hero card and the primary button. In RTL the
    /// "leading top" corner is on the right, as in the old app.
    static let brandGradient = LinearGradient(
        colors: [Color(hex: 0xFF6B111C), Color(hex: 0xFF350304)],
        startPoint: .topTrailing, endPoint: .bottomLeading)

    static let avatars: [Color] = [
        Color(hex: 0xFF5C0B16), Color(hex: 0xFFB08A45), Color(hex: 0xFF2B2522), Color(hex: 0xFF8C5A3C),
        Color(hex: 0xFF6F7556), Color(hex: 0xFF4F5B6B), Color(hex: 0xFF9B6B6B), Color(hex: 0xFF7D6A4F),
    ]

    static func avatarFor(_ name: String) -> Color {
        let sum = name.unicodeScalars.reduce(0) { $0 + Int($1.value) }
        return avatars[sum % avatars.count]
    }
}

// MARK: - Fonts

enum GHWeight { case regular, medium, semibold, bold }

extension Font {
    /// The brand font (IBM Plex Sans Arabic), scaled with Dynamic Type.
    static func gh(_ size: CGFloat, _ weight: GHWeight = .regular) -> Font {
        let name: String
        switch weight {
        case .regular: name = "IBMPlexSansArabic-Regular"
        case .medium: name = "IBMPlexSansArabic-Medium"
        case .semibold: name = "IBMPlexSansArabic-SemiBold"
        case .bold: name = "IBMPlexSansArabic-Bold"
        }
        return .custom(name, size: size)
    }

    /// Latin serif used on the Instagram stories.
    static func serif(_ size: CGFloat) -> Font { .custom("CormorantGaramond-Light", size: size) }
}

extension UIFont {
    static func gh(_ size: CGFloat, _ weight: GHWeight = .regular) -> UIFont {
        let name: String
        switch weight {
        case .regular: name = "IBMPlexSansArabic-Regular"
        case .medium: name = "IBMPlexSansArabic-Medium"
        case .semibold: name = "IBMPlexSansArabic-SemiBold"
        case .bold: name = "IBMPlexSansArabic-Bold"
        }
        return UIFont(name: name, size: size) ?? .systemFont(ofSize: size)
    }
}

/// Text styles of the old app.
enum TS {
    static let title = Font.gh(17, .semibold)
    static let body = Font.gh(16)
    static let sub = Font.gh(13.5)
    static let small = Font.gh(12)
    static let header = Font.gh(13, .medium)
    static let money = Font.gh(16, .semibold).monospacedDigit()
    static let big = Font.gh(28, .bold).monospacedDigit()
}

/// Bundled images (logo, cheetah).
enum GHImage {
    static func named(_ name: String) -> UIImage? {
        if let i = UIImage(named: name) { return i }
        if let p = Bundle.main.path(forResource: name, ofType: "png") { return UIImage(contentsOfFile: p) }
        return nil
    }
    static var logo: Image { Image(uiImage: named("logo") ?? UIImage()) }
}

extension View {
    /// The soft two-layer card shadow.
    func ghShadow() -> some View {
        self.shadow(color: GH.shadowColor, radius: 9, x: 0, y: 6)
            .shadow(color: Color.black.opacity(0.03), radius: 1, x: 0, y: 1)
    }
}
