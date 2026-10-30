import SwiftUI

/// Knows the brands (a built-in luxury list, their short names and Arabic spellings, plus every brand
/// already typed in orders) and recognises one even when it's misspelt: "Luis Vitton" → Louis Vuitton,
/// "ysl" → Saint Laurent, "شانيل" → Chanel.
enum Brands {
    /// Canonical name → other ways people write it.
    static let known: [String: [String]] = [
        "Louis Vuitton": ["LV", "لويس فيتون", "لوي فيتون", "Louis Vitton", "Luis Vuitton"],
        "Chanel": ["شانيل", "شنل", "Channel"],
        "Dior": ["Christian Dior", "ديور"],
        "Hermès": ["Hermes", "هيرميس", "هيرمز", "ارميس"],
        "Gucci": ["قوتشي", "غوتشي", "قوچي"],
        "Prada": ["برادا"],
        "Saint Laurent": ["YSL", "Yves Saint Laurent", "سان لوران", "ايف سان لوران"],
        "Cartier": ["كارتير", "كارتيه"],
        "Van Cleef & Arpels": ["Van Cleef", "VCA", "فان كليف"],
        "Bvlgari": ["Bulgari", "بولغاري", "بلغاري"],
        "Tiffany & Co.": ["Tiffany", "تيفاني"],
        "Celine": ["Céline", "سيلين"],
        "Loewe": ["لويفي", "لوي"],
        "Bottega Veneta": ["Bottega", "بوتيغا", "بوتيجا"],
        "Fendi": ["فندي"],
        "Balenciaga": ["بالنسياغا", "بالنسياجا"],
        "Givenchy": ["جيفنشي"],
        "Valentino": ["فالنتينو"],
        "Versace": ["فيرساتشي", "فرساتشي"],
        "Burberry": ["بربري", "بيربري"],
        "Miu Miu": ["ميو ميو"],
        "Chloé": ["Chloe", "كلوي"],
        "Goyard": ["قويارد", "غويارد"],
        "Moynat": ["موينا"],
        "Delvaux": ["ديلفو"],
        "Jacquemus": ["جاكموس"],
        "Alaïa": ["Alaia", "علايا"],
        "The Row": ["ذا رو"],
        "Loro Piana": ["لورو بيانا"],
        "Brunello Cucinelli": ["Cucinelli", "كوتشينيلي"],
        "Max Mara": ["ماكس مارا"],
        "Dolce & Gabbana": ["D&G", "Dolce Gabbana", "دولتشي"],
        "Off-White": ["Off White"],
        "Christian Louboutin": ["Louboutin", "لوبوتان"],
        "Jimmy Choo": ["جيمي تشو"],
        "Manolo Blahnik": ["Manolo", "مانولو"],
        "Aquazzura": ["اكوازورا"],
        "Amina Muaddi": ["امينا معدي"],
        "Roger Vivier": ["روجيه فيفييه"],
        "Golden Goose": ["قولدن قوس"],
        "Alexander McQueen": ["McQueen", "ماكوين"],
        "Marni": ["مارني"],
        "Moncler": ["مونكلير"],
        "Rolex": ["رولكس"],
        "Patek Philippe": ["Patek", "باتيك"],
        "Audemars Piguet": ["AP", "اوديمار"],
        "Omega": ["اوميغا", "أوميغا"],
        "Chopard": ["شوبارد"],
        "Boucheron": ["بوشرون"],
        "Graff": ["غراف"],
        "Messika": ["ميسيكا"],
        "Pomellato": ["بوميلاتو"],
        "Tom Ford": ["توم فورد"],
        "Creed": ["كريد"],
        "Maison Francis Kurkdjian": ["MFK", "Kurkdjian", "فرانسيس"],
        "Byredo": ["بايريدو"],
        "Le Labo": ["لي لابو"],
        "Guerlain": ["غيرلان", "جيرلان"],
        "Parfums de Marly": ["Marly", "دي مارلي"],
        "Kilian": ["By Kilian", "كيليان"],
        "Diptyque": ["ديبتيك"],
        "La Mer": ["لامير"],
        "Sisley": ["سيسلي"],
        "Charlotte Tilbury": ["تيلبري"],
        "Zara": ["زارا"],
        "Mango": ["مانجو"],
        "Massimo Dutti": ["ماسيمو"],
        "Apple": ["ابل", "آبل"],
        "Dyson": ["دايسون"],
    ]

    /// Lower case, no accents, no spaces/punctuation, Arabic letters unified.
    static func norm(_ s: String) -> String {
        var t = s.folding(options: [.diacriticInsensitive, .caseInsensitive, .widthInsensitive], locale: nil).lowercased()
        let map: [Character: Character] = ["أ": "ا", "إ": "ا", "آ": "ا", "ة": "ه", "ى": "ي", "ؤ": "و", "ئ": "ي", "چ": "ج", "گ": "ك", "ڤ": "ف"]
        t = String(t.map { map[$0] ?? $0 })
        if t.hasPrefix("ال") && t.count > 4 { t.removeFirst(2) }
        return t.filter { $0.isLetter || $0.isNumber }
    }

    /// Every brand we know: the built-in list plus the ones already used in orders (most used first).
    @MainActor
    static func all() -> [String] {
        var count: [String: Int] = [:]
        for o in Store.shared.orders {
            for i in o.items {
                let b = (i.brand ?? "").trimmingCharacters(in: .whitespaces)
                if !b.isEmpty { count[b, default: 0] += 1 }
            }
        }
        var seen = Set<String>()
        var out: [String] = []
        // a used spelling that matches a known brand counts for the known brand
        for (b, _) in count.sorted(by: { $0.value > $1.value }) {
            let name = canonical(b) ?? b
            if seen.insert(norm(name)).inserted { out.append(name) }
        }
        for b in known.keys.sorted() where seen.insert(norm(b)).inserted { out.append(b) }
        return out
    }

    /// The known brand this exact text stands for (its name or one of its other spellings), if any.
    static func canonical(_ text: String) -> String? {
        let n = norm(text)
        if n.isEmpty { return nil }
        for (b, aliases) in known {
            if norm(b) == n || aliases.contains(where: { norm($0) == n }) { return b }
        }
        return nil
    }

    /// Typo distance (insert, delete, change, swap two letters).
    static func distance(_ a: String, _ b: String) -> Int {
        let x = Array(a), y = Array(b)
        if x.isEmpty { return y.count }
        if y.isEmpty { return x.count }
        var d = Array(repeating: Array(repeating: 0, count: y.count + 1), count: x.count + 1)
        for i in 0...x.count { d[i][0] = i }
        for j in 0...y.count { d[0][j] = j }
        for i in 1...x.count {
            for j in 1...y.count {
                let cost = x[i - 1] == y[j - 1] ? 0 : 1
                d[i][j] = min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
                if i > 1, j > 1, x[i - 1] == y[j - 2], x[i - 2] == y[j - 1] {
                    d[i][j] = min(d[i][j], d[i - 2][j - 2] + 1)
                }
            }
        }
        return d[x.count][y.count]
    }

    /// The brand they most likely meant, when what they typed isn't already a brand's exact name.
    /// nil when it's already right or nothing is close enough.
    @MainActor
    static func correction(for text: String) -> String? {
        let t = text.trimmingCharacters(in: .whitespacesAndNewlines)
        let n = norm(t)
        guard n.count >= 2 else { return nil }
        if let c = canonical(t) { return c == t ? nil : c }
        let list = all()
        if list.contains(where: { $0 == t }) { return nil }
        if let same = list.first(where: { norm($0) == n }) { return same == t ? nil : same }
        var best: (name: String, score: Int)? = nil
        for b in list {
            var names = [b]
            names += known[b] ?? []
            for name in names {
                let m = norm(name)
                let allowed = max(1, min(3, m.count / 4))
                let dist = distance(n, m)
                if dist <= allowed, best == nil || dist < best!.score { best = (b, dist) }
            }
        }
        return best?.name
    }

    /// Brands starting with (or containing) what's typed, for the suggestions under the field.
    @MainActor
    static func suggestions(for text: String, limit: Int = 4) -> [String] {
        let n = norm(text)
        guard n.count >= 2 else { return [] }
        var starts: [String] = [], contains: [String] = []
        for b in all() {
            let names = [b] + (known[b] ?? [])
            let ns = names.map(norm)
            if ns.contains(where: { $0.hasPrefix(n) }) { starts.append(b) }
            else if ns.contains(where: { $0.contains(n) }) { contains.append(b) }
        }
        var out = starts + contains
        if out.isEmpty, let c = correction(for: text) { out = [c] }
        return Array(out.filter { $0 != text }.prefix(limit))
    }
}

/// The brand field: suggests brands while typing and offers the right spelling («تقصد Louis Vuitton؟»).
struct BrandField: View {
    let label: String
    @Binding var text: String
    var placeholder: String?
    @State private var dismissed = ""

    init(_ label: String = "البراند", text: Binding<String>, placeholder: String? = nil) {
        self.label = label; self._text = text; self.placeholder = placeholder
    }

    var body: some View {
        FieldRow(label, text: $text, placeholder: placeholder)
        let options = text == dismissed ? [] : Brands.suggestions(for: text)
        if !options.isEmpty {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    if let fix = Brands.correction(for: text), options.first == fix, Brands.canonical(text) == nil {
                        Text("تقصد").font(.gh(13)).foregroundStyle(GH.secondary)
                    }
                    ForEach(options, id: \.self) { b in
                        Button {
                            Haptic.select()
                            text = b
                            dismissed = b
                        } label: {
                            Text(b).font(.gh(14, .medium)).foregroundStyle(GH.label)
                                .padding(.horizontal, 12).padding(.vertical, 7)
                                .background(Capsule().fill(Color(uiColor: .tertiarySystemFill)))
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.horizontal, 16).padding(.bottom, 10)
            }
            .environment(\.layoutDirection, .leftToRight)
        }
    }
}
