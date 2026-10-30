import Foundation

// Reads an Omani bank SMS / app notification (pasted, or read from a
// screenshot) and pulls out the amount, who sent it, the date and the
// reference. Pure functions: no Store, no UI.
//
// Sample texts it understands (and is meant to stay lenient with):
//
//  Bank Muscat:
//   "Dear Customer, your A/C XXXX1234 has been credited with OMR 25.500 on 28/10/2026
//    by Mobile Payment from FATMA SALIM AL BALUSHI. Ref No: FT26301ABC12. Avl Bal OMR 1,204.350"
//  Bank Muscat (Arabic):
//   "تم إيداع مبلغ ٢٥٫٥٠٠ ر.ع في حسابك رقم XXXX1234 من فاطمة سالم بتاريخ ٢٨/١٠/٢٠٢٦ الرقم المرجعي 123456789"
//  Sohar International:
//   "Amount OMR 60.000 received in A/C **7788 via Instant Transfer from SARA AL HINAI.
//    Txn Ref: SI2610300045 Date: 30/10/2026 10:15"
//  NBO:
//   "Credit Alert: RO 12.000 has been credited to your account ending 4321 from MARYAM K on 30OCT26. Ref 9876543"
//  Bank Dhofar:
//   "BankDhofar: Your A/C XXX123 credited by OMR 18.250 on 30-Oct-2026. Remitter: NOOR ALI. Ref# BD12345."
//  Ahli Bank:
//   "Ahli Bank: Incoming transfer of OMR 40.000 from KHALID S to your account ***901 on 2026-10-29. Reference: AB0099."
//  Mobile transfer (تحويل عبر الهاتف):
//   "تحويل عبر الهاتف: استلمت 30.000 ر.ع من 91234567 مريم البلوشي يوم 29/10/2026 رقم العملية 556677"

/// What was read from one transfer message. Every field is optional.
struct BankTransferText: Equatable {
    var amount: Double?
    var sender: String?
    /// 8-digit Omani mobile (no country code), when the message shows it in full.
    var phone: String?
    var date: Date?
    var ref: String?
    /// The bank's name in Arabic, when recognised.
    var bank: String?
    /// The message reads like money going out (a debit), not coming in.
    var outgoing = false

    var isEmpty: Bool { amount == nil && sender == nil && ref == nil && phone == nil }
}

enum BankTransferParser {

    // MARK: public

    static func parse(_ raw: String, now: Date = Date()) -> BankTransferText {
        let text = clean(raw)
        var out = BankTransferText()
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return out }
        out.amount = amount(in: text)
        out.ref = ref(in: text)
        out.phone = phone(in: text, ref: out.ref)
        out.sender = sender(in: text)
        out.date = date(in: text, now: now)
        out.bank = bank(in: text)
        out.outgoing = looksOutgoing(text)
        return out
    }

    /// A typed amount ("1,250.500", "٢٥٫٥", "25.5") → 3 decimals, nil when not a positive number.
    static func amount(fromField s: String) -> Double? {
        let t = clean(s).replacingOccurrences(of: " ", with: "")
        guard !t.isEmpty else { return nil }
        return number(t)
    }

    // MARK: cleaning

    /// Latin digits, no direction marks, plain spaces.
    static func clean(_ s: String) -> String {
        var out = String.UnicodeScalarView()
        for u in s.unicodeScalars {
            let v = u.value
            if (0x0660...0x0669).contains(v), let d = Unicode.Scalar(v - 0x0660 + 0x30) {
                out.append(d)
            } else if (0x06F0...0x06F9).contains(v), let d = Unicode.Scalar(v - 0x06F0 + 0x30) {
                out.append(d)
            } else if v == 0x066B {            // ٫ Arabic decimal separator
                out.append(".")
            } else if v == 0x066C {            // ٬ Arabic thousands separator
                out.append(",")
            } else if v == 0x00A0 || v == 0x202F || v == 0x2009 {
                out.append(" ")
            } else if v == 0x200E || v == 0x200F || v == 0x061C || (0x202A...0x202E).contains(v) || (0x2066...0x2069).contains(v) {
                continue                       // direction marks copied with SMS text
            } else {
                out.append(u)
            }
        }
        return String(out)
    }

    // MARK: amount

    private static let num = #"(\d{1,3}(?:,\d{3})+(?:\.\d{1,3})?|\d+(?:[.,]\d{1,3})?)"#
    private static let cur = #"(?:OMR|O\.M\.R\.?|R\.O\.?|RO|ر\.\s?ع\.?|ر\s?ع(?![\p{L}])|ريال(?:\s?عماني)?|ريالات)"#

    /// "1,250.000" → 1250, "25,500" (no dot) → 25.5 only when 25500 would be absurd.
    static func number(_ raw: String) -> Double? {
        var s = raw
        if s.contains(".") {
            s = s.replacingOccurrences(of: ",", with: "")
        } else if let comma = s.lastIndex(of: ",") {
            let after = s[s.index(after: comma)...].count
            let commas = s.filter { $0 == "," }.count
            let joined = s.replacingOccurrences(of: ",", with: "")
            if after == 3 {
                if commas == 1, let v = Double(joined), v >= 20_000 {
                    s = s.replacingOccurrences(of: ",", with: ".")
                } else {
                    s = joined
                }
            } else if commas == 1 {
                s = s.replacingOccurrences(of: ",", with: ".")
            } else {
                s = joined
            }
        }
        guard let v = Double(s), v > 0, v < 1_000_000 else { return nil }
        return (v * 1000).rounded() / 1000
    }

    private static func amount(in text: String) -> Double? {
        let ns = text as NSString
        var hits: [(loc: Int, value: Double, balance: Bool)] = []
        let patterns = [
            #"(?<![A-Za-z])"# + cur + #"\s*[:.]?\s*"# + num,
            num + #"\s*"# + cur + #"(?![A-Za-z])"#,
            #"(?:amount|amt|المبلغ|بمبلغ|مبلغ)\s*(?:of)?\s*[:：]?\s*(?:"# + cur + #")?\s*"# + num,
        ]
        for p in patterns {
            for h in transferRxHits(p, text) {
                guard let g = h.groups.last ?? nil, let v = number(g) else { continue }
                hits.append((h.range.location, v, isBalance(ns, before: h.range.location)))
            }
        }
        hits.sort { $0.loc < $1.loc }
        if let first = hits.first(where: { !$0.balance }) { return first.value }
        // nothing next to a currency: a number with exactly three decimals (25.500)
        for h in transferRxHits(#"(?<![\d/.:\-])(\d{1,3}(?:,\d{3})+|\d+)\.(\d{3})(?![\d/.:\-])"#, text) {
            if isBalance(ns, before: h.range.location) { continue }
            if let g = h.groups.first ?? nil, let v = number(g) { return v }
        }
        return hits.first?.value
    }

    /// "Avl Bal OMR 1,204.350" / "الرصيد المتاح": the account balance, not the transfer.
    private static func isBalance(_ ns: NSString, before loc: Int) -> Bool {
        let start = max(0, loc - 28)
        let ctx = ns.substring(with: NSRange(location: start, length: loc - start)).lowercased()
        return ["bal", "available", "avl", "limit", "رصيد", "الرصيد", "المتاح"].contains { ctx.contains($0) }
    }

    // MARK: sender

    private static let titles: Set<String> = ["mr", "mr.", "mrs", "mrs.", "ms", "ms.", "miss", "dr", "dr.",
                                             "السيد", "السيدة", "السيده", "الفاضل", "الفاضلة", "الفاضله"]
    private static let notAName: Set<String> = ["your", "a/c", "ac", "acc", "account", "card", "the", "a", "an", "mobile",
                                               "حساب", "حسابك", "بطاقة", "بطاقتك", "رقم", "قبل", "خلال", "تطبيق", "الحساب"]

    private static func sender(in text: String) -> String? {
        let patterns = [
            #"(?<![A-Za-z])(?:remitter(?:\s*name)?|sender(?:\s*name)?|ordering\s+customer|received\s+from|transfer\s+from|from)\s*[:：\-]?\s*(?=([^\n]+))"#,
            #"(?<![\p{L}])(?:اسم\s+المحول|اسم\s+المحوّل|اسم\s+المرسل|المحوّل|المحول|المرسل|واردة\s+من|وارد\s+من|مستلم\s+من|من)(?![\p{L}])\s*[:：\-]?\s*(?=([^\n]+))"#,
        ]
        for p in patterns {
            for h in transferRxHits(p, text) {
                guard let tail = h.groups.last ?? nil, let name = tidyName(tail) else { continue }
                return name
            }
        }
        return nil
    }

    /// The name at the start of the text after "from": up to the next date, reference, number or punctuation.
    private static func tidyName(_ raw: String) -> String? {
        var s = raw.trimmingCharacters(in: .whitespaces)
        // a phone or masked number before the name: "من 9123XXXX مريم"
        for _ in 0..<2 {
            if let h = transferRxHits(#"^(?:[+\d][\dxX*\-]*|[xX*]{3,}\d*)\s+"#, s).first {
                s = (s as NSString).substring(from: h.range.location + h.range.length)
            }
        }
        let stop = #"(\s+(?:on|at|ref|reference|via|to|into|in|date|dated|txn|for|with|has|amount|is|was|account|a/c)(?![A-Za-z])|\s+(?:بتاريخ|في|الى|إلى|لحساب|لحسابك|على|رقم|المرجع|الرقم|بمبلغ|مبلغ|عبر|يوم|تاريخ|تم)(?![\p{L}])|[.,،;:()\[\]|<>]|\s-\s|\d{3,}|[xX*]{3,})"#
        if let h = transferRxHits(stop, s).first {
            s = (s as NSString).substring(to: h.range.location)
        }
        var words = s.split(whereSeparator: { $0.isWhitespace }).map(String.init)
        words = words.filter { w in
            !w.contains(where: { $0.isNumber || $0 == "*" }) && !titles.contains(w.lowercased())
        }
        guard let first = words.first, !notAName.contains(first.lowercased()) else { return nil }
        words = Array(words.prefix(5))
        let name = words.joined(separator: " ")
        guard name.filter({ $0.isLetter }).count >= 2 else { return nil }
        // "FATMA SALIM" → "Fatma Salim"
        let latin = name.unicodeScalars.allSatisfy { $0.isASCII }
        if latin && name == name.uppercased() { return name.capitalized }
        return name
    }

    // MARK: phone

    private static func phone(in text: String, ref: String?) -> String? {
        for h in transferRxHits(#"(?<![A-Za-z0-9])(?:\+?968|00968)?[\s\-]?([79]\d{7})(?![0-9])"#, text) {
            guard let p = h.groups.last ?? nil else { continue }
            if let ref, ref.contains(p) { continue }
            return p
        }
        return nil
    }

    // MARK: date

    private static let months: [String: Int] = [
        "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
        "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
        "يناير": 1, "فبراير": 2, "مارس": 3, "أبريل": 4, "ابريل": 4, "إبريل": 4, "مايو": 5, "يونيو": 6,
        "يوليو": 7, "أغسطس": 8, "اغسطس": 8, "سبتمبر": 9, "أكتوبر": 10, "اكتوبر": 10, "نوفمبر": 11, "ديسمبر": 12,
    ]

    private static func date(in text: String, now: Date) -> Date? {
        var found: [(loc: Int, date: Date)] = []
        func add(_ loc: Int, _ y: Int?, _ m: Int?, _ d: Int?) {
            if let dt = makeDate(y, m, d, now: now) { found.append((loc, dt)) }
        }
        for h in transferRxHits(#"(?<!\d)(\d{4})[\-/.](\d{1,2})[\-/.](\d{1,2})(?!\d)"#, text) {
            add(h.range.location, int(h.groups[1]), int(h.groups[2]), int(h.groups[3]))
        }
        for h in transferRxHits(#"(?<![\d.])(\d{1,2})[\-/.](\d{1,2})[\-/.](\d{4}|\d{2})(?![\d])"#, text) {
            add(h.range.location, int(h.groups[3]), int(h.groups[2]), int(h.groups[1]))
        }
        for h in transferRxHits(#"(?<!\d)(\d{1,2})[\s\-/]?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?[\s\-/,]*(\d{4}|\d{2})(?!\d)"#, text) {
            add(h.range.location, int(h.groups[3]), months[(h.groups[2] ?? "").lowercased()], int(h.groups[1]))
        }
        let ar = "يناير|فبراير|مارس|أبريل|ابريل|إبريل|مايو|يونيو|يوليو|أغسطس|اغسطس|سبتمبر|أكتوبر|اكتوبر|نوفمبر|ديسمبر"
        for h in transferRxHits(#"(?<!\d)(\d{1,2})\s*("# + ar + #")\s*(\d{4})(?!\d)"#, text) {
            add(h.range.location, int(h.groups[3]), months[h.groups[2] ?? ""], int(h.groups[1]))
        }
        return found.sorted { $0.loc < $1.loc }.first?.date
    }

    private static func int(_ s: String?) -> Int? { s.flatMap { Int($0) } }

    private static func makeDate(_ y: Int?, _ m: Int?, _ d: Int?, now: Date) -> Date? {
        guard var y, let m, let d, (1...12).contains(m), (1...31).contains(d) else { return nil }
        if y < 100 { y += 2000 }
        let cal = Calendar(identifier: .gregorian)
        guard let dt = cal.date(from: DateComponents(year: y, month: m, day: d)),
              cal.component(.day, from: dt) == d else { return nil }
        // a transfer is from the last year or so, never from the future
        guard dt <= now.addingTimeInterval(86_400), dt >= now.addingTimeInterval(-400 * 86_400) else { return nil }
        return dt
    }

    // MARK: reference

    private static func ref(in text: String) -> String? {
        let label = #"(?:(?<![A-Za-z])(?:ref(?:erence)?(?:\s*(?:no|number|num|id))?\.?|txn\s*(?:id|ref|no)?|transaction\s*(?:id|ref|no|number)|trx\s*(?:id|no)?|utr|rrn)|الرقم\s+المرجعي|رقم\s+المرجع|المرجع|مرجع|رقم\s+العملية|رقم\s+المعاملة|رقم\s+الحوالة)"#
        for h in transferRxHits(label + #"\s*[.:#：\-]*\s*([A-Za-z0-9][A-Za-z0-9\-/]{3,})"#, text) {
            guard var v = h.groups.last ?? nil else { continue }
            while let last = v.last, last == "-" || last == "/" { v.removeLast() }
            if v.count >= 4, v.contains(where: { $0.isNumber }) { return v }
        }
        // Bank Muscat style FT numbers without a label
        if let h = transferRxHits(#"(?<![A-Za-z0-9])(FT[A-Z0-9]{6,})(?![A-Za-z0-9])"#, text).first, let v = h.groups.last ?? nil { return v }
        return nil
    }

    // MARK: bank / direction

    private static func bank(in text: String) -> String? {
        let t = text.lowercased()
        let banks: [(keys: [String], name: String)] = [
            (["bank muscat", "bankmuscat", "بنك مسقط"], "بنك مسقط"),
            (["sohar", "صحار"], "صحار الدولي"),
            (["nbo", "national bank of oman", "الوطني العماني"], "البنك الوطني العماني"),
            (["dhofar", "ظفار"], "بنك ظفار"),
            (["ahli", "الأهلي", "الاهلي"], "البنك الأهلي"),
            (["nizwa", "نزوى"], "بنك نزوى"),
            (["oman arab", "oab", "العربي"], "بنك عُمان العربي"),
            (["alizz", "العز"], "العز الإسلامي"),
            (["hsbc"], "HSBC"),
            (["mobile transfer", "mobile payment", "mpay", "تحويل عبر الهاتف", "التحويل عبر الهاتف"], "تحويل عبر الهاتف"),
        ]
        for b in banks where b.keys.contains(where: { t.contains($0) }) { return b.name }
        return nil
    }

    private static func looksOutgoing(_ text: String) -> Bool {
        let t = text.lowercased()
        let outWords = ["debited", "debit alert", "withdraw", "purchase", "spent", "خصم", "سحب", "شراء", "مدين"]
        let inWords = ["credited", "credit", "received", "deposit", "incoming", "إيداع", "ايداع", "استلام", "استلمت", "وارد", "أضيف", "اضيف", "دائن"]
        return outWords.contains { t.contains($0) } && !inWords.contains { t.contains($0) }
    }
}

// MARK: - Name matching (sender ↔ customer)

/// Loose name comparison across Arabic and English spellings
/// ("FATMA AL BALUSHI" ≈ "فاطمة البلوشي"): ignores ال / al, spaces, case and diacritics.
enum TransferNameMatch {
    private static let drop: Set<String> = ["al", "el", "bin", "bint", "ibn", "bn", "mr", "mrs", "ms", "miss", "dr",
                                            "بن", "بنت", "ابن", "ال", "السيد", "السيده", "سيد", "سيده"]

    static func tokens(_ s: String) -> [String] {
        var scalars = String.UnicodeScalarView()
        for u in BankTransferParser.clean(s).lowercased().unicodeScalars {
            let v = u.value
            if (0x064B...0x065F).contains(v) || v == 0x0670 || v == 0x0640 { continue } // harakat, tatweel
            switch v {
            case 0x0623, 0x0625, 0x0622, 0x0671: scalars.append("ا")
            case 0x0649, 0x0626: scalars.append("ي")
            case 0x0629: scalars.append("ه")
            case 0x0624: scalars.append("و")
            default: scalars.append(u)
            }
        }
        let folded = String(scalars).folding(options: [.caseInsensitive, .diacriticInsensitive, .widthInsensitive], locale: nil)
        var out: [String] = []
        for w in folded.split(whereSeparator: { !$0.isLetter }) {
            var t = String(w)
            if drop.contains(t) { continue }
            if t.hasPrefix("ال") && t.count >= 4 { t = String(t.dropFirst(2)) }
            if !t.isEmpty { out.append(t) }
        }
        return out
    }

    /// Consonant outline in Latin letters: "فاطمه" and "fatma" both → "ftm".
    static func skeleton(_ t: String) -> String {
        var s = t
        if t.unicodeScalars.contains(where: { (0x0600...0x06FF).contains($0.value) }) {
            s = t.applyingTransform(.toLatin, reverse: false) ?? t
        }
        s = (s.applyingTransform(.stripDiacritics, reverse: false) ?? s).lowercased()
        s = String(s.filter { $0 >= "a" && $0 <= "z" })
        for (a, b) in [("kh", "k"), ("sh", "s"), ("th", "t"), ("dh", "d"), ("gh", "g"), ("ph", "f"), ("q", "k"), ("c", "k"), ("ee", "i"), ("oo", "u")] {
            s = s.replacingOccurrences(of: a, with: b)
        }
        var out = ""
        for ch in s where !"aeiouyw".contains(ch) {
            if out.last != ch { out.append(ch) }
        }
        if out.count > 2 && out.hasSuffix("h") { out.removeLast() }
        return out
    }

    /// 0 (nothing alike) … 1 (same name).
    static func score(sender: String, name: String) -> Double {
        let a = Array(tokens(sender).prefix(4))
        let b = tokens(name)
        guard !a.isEmpty, !b.isEmpty else { return 0 }
        let bs = b.map(skeleton)
        var total = 0.0
        for t in a {
            let sk = skeleton(t)
            var best = 0.0
            for (j, u) in b.enumerated() {
                let us = bs[j]
                var s = 0.0
                if t == u {
                    s = 1
                } else if min(t.count, u.count) >= 3 && (t.hasPrefix(u) || u.hasPrefix(t)) {
                    s = 0.8
                } else if sk.count >= 2 && sk == us {
                    s = 0.75
                } else if min(sk.count, us.count) >= 2 && abs(sk.count - us.count) <= 1 && (sk.hasPrefix(us) || us.hasPrefix(sk)) {
                    s = 0.55
                }
                best = max(best, s)
            }
            total += best
        }
        return min(1, total / Double(min(a.count, b.count)))
    }
}

// MARK: - Regex helper

struct TransferRxHit {
    let range: NSRange
    /// Index 0 is the whole match; nil for a group that did not take part.
    let groups: [String?]
}

func transferRxHits(_ pattern: String, _ s: String) -> [TransferRxHit] {
    guard let re = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else { return [] }
    let ns = s as NSString
    return re.matches(in: s, range: NSRange(location: 0, length: ns.length)).map { m in
        TransferRxHit(range: m.range, groups: (0..<m.numberOfRanges).map { i in
            let r = m.range(at: i)
            return r.location == NSNotFound ? nil : ns.substring(with: r)
        })
    }
}
