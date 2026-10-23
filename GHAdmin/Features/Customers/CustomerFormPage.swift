import SwiftUI

/// Add or edit a customer. Gives back the saved customer.
struct CustomerFormPage: View {
    let customer: Customer?
    var done: ((Customer?) -> Void)?
    @Environment(\.dismiss) private var dismiss

    @State private var name: String
    @State private var phone: String
    @State private var city: String
    @State private var address: String
    @State private var notes: String
    @State private var male: Bool
    @State private var saving = false

    init(customer: Customer? = nil, done: ((Customer?) -> Void)? = nil) {
        self.customer = customer
        self.done = done
        _name = State(initialValue: customer?.name ?? "")
        _phone = State(initialValue: customer?.phone ?? "")
        _city = State(initialValue: customer?.city ?? "")
        _address = State(initialValue: customer?.address ?? "")
        _notes = State(initialValue: customer?.notes ?? "")
        _male = State(initialValue: customer?.isMale ?? false)
    }

    private func clean(_ s: String) -> String? {
        let t = s.trimmingCharacters(in: .whitespacesAndNewlines)
        return t.isEmpty ? nil : t
    }

    private func close(_ c: Customer?) {
        if let done { done(c) } else { dismiss() }
    }

    private func save() {
        let n = name.trimmingCharacters(in: .whitespacesAndNewlines)
        if n.isEmpty {
            toast("اكتب الاسم", error: true)
            return
        }
        saving = true
        let id = customer?.id
        let p = clean(phone), ci = clean(city), a = clean(address), no = clean(notes)
        let isMale = male
        Task {
            do {
                let c = try await Store.shared.saveCustomer(id: id, name: n, phone: p, city: ci, address: a,
                                                            notes: no, isMale: isMale)
                close(c)
            } catch {
                saving = false
                toastError(error)
            }
        }
    }

    var body: some View {
        GHPage(customer == nil ? "عميل جديد" : "تعديل العميل", trailing: {
            if saving {
                ProgressView()
            } else {
                NavButton("حفظ", bold: true) { save() }
            }
        }, leading: {
            NavButton("إلغاء") { close(nil) }
        }) {
            mainSection
            GHSection("ملاحظات") {
                NotesRow(text: $notes, placeholder: "المقاسات، الذوق، البراندات المفضلة…")
            }
        }
    }

    private var mainSection: some View {
        GHSection {
            Segments(value: $male, options: [(false, "عميلة"), (true, "عميل")])
            FieldRow("الاسم", text: $name, autofocus: customer == nil)
            FieldRow("الجوال", text: $phone, placeholder: "9XXXXXXX", keyboard: .phone, ltr: true)
            FieldRow("المنطقة", text: $city, placeholder: "اختياري")
            FieldRow("العنوان", text: $address, placeholder: "للمندوب: الحي، السكة، المنزل أو رابط الموقع")
        }
    }
}
