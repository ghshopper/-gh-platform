import SwiftUI

/// Add or edit a boutique. Presented with presentForm; gives back the saved one through `done` when given.
@MainActor
struct BoutiqueFormPage: View {
    let boutique: Boutique?
    var done: ((Boutique?) -> Void)?

    @State private var name: String
    @State private var brand: String
    @State private var city: String
    @State private var country: String
    @State private var address: String
    @State private var mapsUrl: String
    @State private var contactName: String
    @State private var contactPhone: String
    @State private var instagram: String
    @State private var hours: String
    @State private var taxFree: Bool
    @State private var taxFreePct: String
    @State private var taxFreeNote: String
    @State private var notes: String
    @State private var saving = false

    /// Edit `boutique`, or add a new one (optionally prefilled, e.g. from وضع التسوق).
    init(boutique: Boutique? = nil, name: String = "", brand: String? = nil, city: String? = nil,
         country: String? = nil, done: ((Boutique?) -> Void)? = nil) {
        self.boutique = boutique
        self.done = done
        _name = State(initialValue: boutique?.name ?? name)
        _brand = State(initialValue: boutique?.brand ?? brand ?? "")
        _city = State(initialValue: boutique?.city ?? city ?? "")
        _country = State(initialValue: boutique?.country ?? country ?? "")
        _address = State(initialValue: boutique?.address ?? "")
        _mapsUrl = State(initialValue: boutique?.mapsUrl ?? "")
        _contactName = State(initialValue: boutique?.contactName ?? "")
        _contactPhone = State(initialValue: boutique?.contactPhone ?? "")
        _instagram = State(initialValue: (boutique?.contactInstagram).map { "@" + $0 } ?? "")
        _hours = State(initialValue: boutique?.openingHours ?? "")
        _taxFree = State(initialValue: boutique?.taxFree ?? false)
        _taxFreePct = State(initialValue: amountText(boutique?.taxFreePct))
        _taxFreeNote = State(initialValue: boutique?.taxFreeNote ?? "")
        _notes = State(initialValue: boutique?.notes ?? "")
    }

    var body: some View {
        GHPage(boutique == nil ? "بوتيك جديد" : "تعديل البوتيك", trailing: {
            if saving {
                ProgressView()
            } else {
                NavButton("حفظ", bold: true) { save() }
            }
        }, leading: {
            NavButton("إلغاء") { close(nil) }
        }) {
            GHSection {
                FieldRow("الاسم", text: $name, placeholder: "مثلاً Dior Montaigne", autofocus: boutique == nil && name.isEmpty)
                FieldRow("البراند", text: $brand, placeholder: "اختياري")
                FieldRow("المدينة", text: $city, placeholder: "باريس، دبي، ميلان…")
                FieldRow("الدولة", text: $country, placeholder: "فرنسا")
            }
            GHSection("المكان", footer: "إذا ما حطيت رابط، نفتح الخريطة على الاسم والعنوان.") {
                FieldRow("العنوان", text: $address, placeholder: "الشارع والرقم")
                FieldRow("رابط الخريطة", text: $mapsUrl, placeholder: "https://maps…", keyboard: .url, ltr: true)
            }
            GHSection("الموظف اللي يخدمنا", footer: "الرقم مع رمز الدولة عشان الواتساب، مثلاً ‎+33 6 12 34 56 78") {
                FieldRow("الاسم", text: $contactName, placeholder: "اسم الموظف")
                FieldRow("الواتساب", text: $contactPhone, placeholder: "+33…", keyboard: .phone, ltr: true)
                FieldRow("انستقرام", text: $instagram, placeholder: "@username", keyboard: .url, ltr: true)
            }
            GHSection("أوقات الدوام") {
                NotesRow(text: $hours, placeholder: "مثلاً: السبت للخميس 10 الصبح لين 7 المسا، الأحد مسكّر")
            }
            GHSection("التاكس فري") {
                SwitchRow("يعطون تاكس فري", isOn: $taxFree)
                if taxFree {
                    AmountRow("النسبة", text: $taxFreePct, suffix: "٪")
                    FieldRow("ملاحظة", text: $taxFreeNote, placeholder: "الحد الأدنى، الجواز، وين نسترد…")
                }
            }
            GHSection("ملاحظات") {
                NotesRow(text: $notes, placeholder: "أي شي يفيد: يحجزون القطع، يرسلون صور، أفضل وقت…")
            }
        }
    }

    private func clean(_ s: String) -> String? {
        let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
        return t.isEmpty ? nil : t
    }

    private func close(_ b: Boutique?) {
        if let done { done(b) } else { dismissForm() }
    }

    private func save() {
        guard let n = clean(name) else {
            toast("اكتب اسم البوتيك", error: true)
            return
        }
        var pct: Double? = nil
        if taxFree, let t = clean(taxFreePct) {
            guard let v = parseAmount(t), v >= 0, v <= 100 else {
                toast("نسبة التاكس فري لازم تكون بين 0 و 100", error: true)
                return
            }
            pct = v
        }
        let body: JSON = [
            "name": n,
            "brand": nn(clean(brand)),
            "city": nn(clean(city)),
            "country": nn(clean(country)),
            "address": nn(clean(address)),
            "maps_url": nn(clean(mapsUrl)),
            "contact_name": nn(clean(contactName)),
            "contact_phone": nn(clean(normalizeDigits(contactPhone))),
            "contact_instagram": nn(clean(instagram)),
            "opening_hours": nn(clean(hours)),
            "tax_free": taxFree,
            "tax_free_pct": nn(pct),
            "tax_free_note": nn(taxFree ? clean(taxFreeNote) : nil),
            "notes": nn(clean(notes)),
        ]
        saving = true
        let id = boutique?.id
        Task {
            do {
                let b = try await BoutiqueBook.shared.save(id: id, body)
                Haptic.success()
                toast(id == nil ? "انضاف للدليل" : "انحفظ")
                close(b)
            } catch {
                saving = false
                toastError(error)
            }
        }
    }
}
