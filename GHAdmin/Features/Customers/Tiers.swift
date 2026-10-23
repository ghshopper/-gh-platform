import SwiftUI
import UIKit

// ───────────────────────── Loyalty tiers ─────────────────────────
// Three tiers by points: Beige 0+, Burgundy 20,000+, Black 50,000+. The server
// sends the Arabic name (بيج / عنابي / أسود); the English key also works.

fileprivate struct TierDef {
    let key: String
    let ar: String
    let min: Int
    /// 0xAARRGGBB
    let hex: UInt32
}

fileprivate let tierDefs: [TierDef] = [
    TierDef(key: "beige", ar: "بيج", min: 0, hex: 0xFFD9C4A3),
    TierDef(key: "burgundy", ar: "عنابي", min: 20000, hex: 0xFF5C0A16),
    TierDef(key: "black", ar: "أسود", min: 50000, hex: 0xFF111111),
]

fileprivate func tierIndex(_ tier: String?, _ points: Int) -> Int {
    let t = (tier ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    for i in 0..<tierDefs.count {
        if tierDefs[i].key == t || tierDefs[i].ar == t { return i }
    }
    // Unknown name: go by the points.
    var i = 0
    for k in 0..<tierDefs.count {
        if points >= tierDefs[k].min { i = k }
    }
    return i
}

/// The tier's Arabic name («بيج», «عنابي», «أسود»).
func tierName(_ tier: String?, _ points: Int = 0) -> String {
    let t = (tier ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    let i = tierIndex(tier, points)
    let lower = t.lowercased()
    let known = tierDefs.contains { $0.key == lower || $0.ar == t }
    return known || t.isEmpty ? tierDefs[i].ar : t
}

/// A colour that reads on the page for the tier badge.
func tierColor(_ tier: String?, _ points: Int = 0) -> Color {
    switch tierIndex(tier, points) {
    case 0: return GH.gold
    case 1: return GH.burgundy
    default: return GH.label
    }
}

/// 12345 → "12,345" (no sign).
func plainPoints(_ n: Int) -> String {
    let s = Array(String(abs(n)))
    var out = ""
    for i in 0..<s.count {
        if i > 0 && (s.count - i) % 3 == 0 { out.append(",") }
        out.append(s[i])
    }
    return out
}

/// Color.lerp(a, b, t) on 0xAARRGGBB values.
fileprivate func lerpHex(_ a: UInt32, _ b: UInt32, _ t: Double) -> Color {
    func ch(_ v: UInt32, _ shift: UInt32) -> Double { Double((v >> shift) & 0xff) / 255 }
    func mix(_ shift: UInt32) -> Double { ch(a, shift) + (ch(b, shift) - ch(a, shift)) * t }
    return Color(.sRGB, red: mix(16), green: mix(8), blue: mix(0), opacity: mix(24))
}

/// The customer's loyalty card: tier, points and how far to the next tier.
struct TierCard: View {
    let tier: String?
    let points: Int

    init(tier: String?, points: Int) {
        self.tier = tier
        self.points = points
    }

    private var index: Int { tierIndex(tier, points) }
    private var def: TierDef { tierDefs[index] }
    private var next: TierDef? { index + 1 < tierDefs.count ? tierDefs[index + 1] : nil }
    private var light: Bool { index == 0 }
    private var fg: Color { light ? Color(hex: 0xFF3A2414) : Color(hex: 0xFFF3E6CC) }

    private var progress: Double {
        guard let next else { return 1 }
        let span = Double(next.min - def.min)
        if span <= 0 { return 1 }
        let p = Double(points - def.min) / span
        return Swift.min(Swift.max(p, 0), 1)
    }

    private var gradient: LinearGradient {
        let start = lerpHex(def.hex, 0xFFFFFFFF, light ? 0.25 : 0.12)
        let end = Color(hex: def.hex)
        // In RTL the "top start" corner is the top right (as in GH.brandGradient).
        return LinearGradient(colors: [start, end], startPoint: .topTrailing, endPoint: .bottomLeading)
    }

    private var nextText: String {
        guard let next else { return "أعلى فئة" }
        return "باقي \(plainPoints(next.min - points)) نقطة لفئة \(next.ar)"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            topRow
            Text("فئة \(def.ar)")
                .font(.gh(22, .bold)).foregroundStyle(fg)
                .padding(.top, 6)
            Text("\(plainPoints(points)) نقطة")
                .font(.gh(15, .medium)).foregroundStyle(fg.opacity(220.0 / 255.0))
                .padding(.top, 2)
            progressBar.padding(.top, 12)
            Text(nextText)
                .font(.gh(12.5)).foregroundStyle(fg.opacity(190.0 / 255.0))
                .padding(.top, 6)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, 18).padding(.vertical, 16)
        .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(gradient))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).stroke(Color(hex: 0x55C9A465), lineWidth: 1))
        .ghShadow()
    }

    private var topRow: some View {
        HStack(spacing: 0) {
            Text("GH PRIVILEGE")
                .font(.system(size: 11, weight: .semibold))
                .tracking(2.4)
                .foregroundStyle(fg.opacity(170.0 / 255.0))
                .environment(\.layoutDirection, .leftToRight)
            Spacer(minLength: 8)
            Image(systemName: "star.circle.fill")
                .font(.system(size: 22))
                .foregroundStyle(light ? GH.burgundy : Color(hex: 0xFFC9A465))
        }
    }

    private var progressBar: some View {
        let p = progress
        let track = fg.opacity(40.0 / 255.0)
        return GeometryReader { geo in
            ZStack(alignment: .leading) {
                Rectangle().fill(track)
                Rectangle().fill(Color(hex: 0xFFC9A465)).frame(width: geo.size.width * CGFloat(p))
            }
        }
        .frame(height: 6)
        .clipShape(RoundedRectangle(cornerRadius: 4, style: .continuous))
    }
}
