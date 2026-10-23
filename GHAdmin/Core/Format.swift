import Foundation

private let omrFormatter: NumberFormatter = {
    let f = NumberFormatter()
    f.locale = Locale(identifier: "en_US_POSIX")
    f.numberStyle = .decimal
    f.minimumFractionDigits = 3
    f.maximumFractionDigits = 3
    f.groupingSeparator = ","
    f.usesGroupingSeparator = true
    return f
}()

private let curFormatter: NumberFormatter = {
    let f = NumberFormatter()
    f.locale = Locale(identifier: "en_US_POSIX")
    f.numberStyle = .decimal
    f.minimumFractionDigits = 2
    f.maximumFractionDigits = 2
    f.groupingSeparator = ","
    f.usesGroupingSeparator = true
    return f
}()

/// 12.500 ر.ع
func omr(_ v: Double) -> String { "\(plainOmr(v)) ر.ع" }
/// 12.500 OMR (PDFs)
func omrLatin(_ v: Double) -> String { "\(plainOmr(v)) OMR" }
func plainOmr(_ v: Double) -> String { omrFormatter.string(from: NSNumber(value: v)) ?? String(format: "%.3f", v) }
/// 1,234.50 EUR
func money(_ v: Double, _ currency: String) -> String {
    "\(curFormatter.string(from: NSNumber(value: v)) ?? String(format: "%.2f", v)) \(currency)"
}
/// Same as omr(); kept so ported pages read like the old ones.
func m(_ v: Double) -> String { omr(v) }

private let dateFmt: DateFormatter = {
    let f = DateFormatter()
    f.locale = Locale(identifier: "en_US_POSIX")
    f.dateFormat = "d/M/yyyy"
    return f
}()

private let timeFmt: DateFormatter = {
    let f = DateFormatter()
    f.locale = Locale(identifier: "en_US_POSIX")
    f.dateFormat = "d/M  h:mm a"
    return f
}()

/// 18/10/2026 (— when nil)
func dateStr(_ d: Date?) -> String { d.map { dateFmt.string(from: $0) } ?? "—" }
/// 18/10  3:45 PM
func dateTimeStr(_ d: Date) -> String { timeFmt.string(from: d) }

/// yyyy-MM-dd for the server.
func dayString(_ d: Date) -> String {
    let c = Calendar(identifier: .gregorian).dateComponents([.year, .month, .day], from: d)
    return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
}

/// Arabic-Indic / Persian digits and separators → ASCII.
func normalizeDigits(_ input: String) -> String {
    let arabic = Array("٠١٢٣٤٥٦٧٨٩")
    let persian = Array("۰۱۲۳۴۵۶۷۸۹")
    var out = ""
    for ch in input {
        if let a = arabic.firstIndex(of: ch) { out.append(String(a)) }
        else if let p = persian.firstIndex(of: ch) { out.append(String(p)) }
        else if ch == "٫" || ch == "," { out.append(".") }
        else if ch == "٬" { continue }
        else { out.append(ch) }
    }
    return out.trimmingCharacters(in: .whitespacesAndNewlines)
}

func parseAmount(_ input: String) -> Double? {
    let s = normalizeDigits(input)
    if s.isEmpty { return nil }
    return Double(s)
}

/// Digits for wa.me (with the country code).
func waPhone(_ phone: String?) -> String? {
    guard let phone else { return nil }
    var d = normalizeDigits(phone).filter { $0.isNumber && $0.isASCII }
    if d.isEmpty { return nil }
    if d.hasPrefix("00") { d.removeFirst(2) }
    if d.count == 8 { d = "968" + d }
    return d
}

/// "3" → "3", 2.5 → "2.5" (no trailing zeros) for amount fields.
func amountText(_ v: Double?) -> String {
    guard let v else { return "" }
    if v == v.rounded() { return String(Int(v)) }
    var s = String(format: "%.3f", v)
    while s.hasSuffix("0") { s.removeLast() }
    if s.hasSuffix(".") { s.removeLast() }
    return s
}

// MARK: - JSON helpers (the server sends numbers as numbers or strings)

typealias JSON = [String: Any]

func jd(_ v: Any?) -> Double {
    if let n = v as? NSNumber { return n.doubleValue }
    if let s = v as? String { return Double(s) ?? 0 }
    return 0
}

func jdn(_ v: Any?) -> Double? {
    if v == nil || v is NSNull { return nil }
    if let n = v as? NSNumber { return n.doubleValue }
    if let s = v as? String { return Double(s) }
    return nil
}

func ji(_ v: Any?) -> Int {
    if let n = v as? NSNumber { return n.intValue }
    if let s = v as? String { return Int(s) ?? Int(Double(s) ?? 0) }
    return 0
}

func js(_ v: Any?) -> String? {
    if v == nil || v is NSNull { return nil }
    let s: String
    if let str = v as? String { s = str } else if let n = v as? NSNumber { s = n.stringValue } else { s = "\(v!)" }
    return s.isEmpty ? nil : s
}

func jstr(_ v: Any?) -> String { js(v) ?? "" }

func jb(_ v: Any?) -> Bool {
    if let b = v as? Bool { return b }
    if let n = v as? NSNumber { return n.boolValue }
    if let s = v as? String { return s == "1" || s == "true" }
    return false
}

private let isoFull: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return f
}()
private let isoPlain: ISO8601DateFormatter = {
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime]
    return f
}()
private let sqlFmt: DateFormatter = {
    let f = DateFormatter()
    f.locale = Locale(identifier: "en_US_POSIX")
    f.timeZone = TimeZone(identifier: "UTC")
    f.dateFormat = "yyyy-MM-dd HH:mm:ss"
    return f
}()
private let dayFmt: DateFormatter = {
    let f = DateFormatter()
    f.locale = Locale(identifier: "en_US_POSIX")
    f.dateFormat = "yyyy-MM-dd"
    return f
}()

/// Dates from the server: ISO 8601 (with or without fractions), SQL, or a day.
func jdate(_ v: Any?) -> Date? {
    guard let s = js(v) else { return nil }
    if let d = isoFull.date(from: s) ?? isoPlain.date(from: s) { return d }
    // Laravel's microseconds: 2026-10-18T10:00:00.000000Z
    if s.count > 20, s.contains("T"), let dot = s.firstIndex(of: ".") {
        let trimmed = String(s[..<dot]) + "Z"
        if let d = isoPlain.date(from: trimmed) { return d }
    }
    if s.count == 10 { return dayFmt.date(from: s) }
    return sqlFmt.date(from: String(s.prefix(19)))
}

func jlist(_ v: Any?) -> [JSON] { (v as? [Any])?.compactMap { $0 as? JSON } ?? [] }
