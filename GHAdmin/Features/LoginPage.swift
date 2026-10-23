import SwiftUI

struct LoginPage: View {
    @State private var email = ""
    @State private var password = ""
    @State private var busy = false

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                GHImage.logo.resizable().scaledToFit().frame(height: 120)
                Text("تسجيل الدخول").font(TS.big).foregroundStyle(GH.label).padding(.top, 28)
                VStack(spacing: 0) {
                    field($email, "الإيميل أو رقم الجوال", keyboard: .emailAddress)
                    Rectangle().fill(GH.separator).frame(height: 0.5)
                    field($password, "كلمة المرور", secure: true)
                }
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .padding(.top, 24)
                PrimaryButton("دخول", busy: busy) { Task { await submit() } }.padding(.top, 20)
                Text("نفس حسابك في لوحة الإدارة بالموقع. المناديب يدخلون برقم الجوال.")
                    .font(TS.small).foregroundStyle(GH.secondary).multilineTextAlignment(.center).padding(.top, 14)
            }
            .frame(maxWidth: 420)
            .padding(24)
            .frame(maxWidth: .infinity)
            .padding(.top, 60)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(GH.bg.ignoresSafeArea())
    }

    @ViewBuilder
    private func field(_ text: Binding<String>, _ placeholder: String, keyboard: UIKeyboardType = .default, secure: Bool = false) -> some View {
        Group {
            if secure {
                SecureField("", text: text, prompt: Text(placeholder).foregroundStyle(GH.tertiary))
            } else {
                TextField("", text: text, prompt: Text(placeholder).foregroundStyle(GH.tertiary))
                    .keyboardType(keyboard)
            }
        }
        .font(.gh(17)).foregroundStyle(GH.label)
        .textInputAutocapitalization(.never)
        .autocorrectionDisabled()
        .environment(\.layoutDirection, .leftToRight)
        .multilineTextAlignment(.leading)
        .padding(.horizontal, 16).padding(.vertical, 15)
        .background(GH.card)
        .onSubmit { Task { await submit() } }
    }

    private func submit() async {
        let id = normalizeDigits(email.trimmingCharacters(in: .whitespaces))
        guard !id.isEmpty, password.count >= 6 else {
            toast("اكتب الإيميل أو رقمك وكلمة المرور", error: true)
            return
        }
        busy = true
        defer { busy = false }
        do {
            try await Api.shared.login(id, password)
        } catch let t as TwoFactorRequired {
            await askCode(t.challenge)
        } catch {
            toastError(error)
        }
    }

    /// The 6-digit code from the authenticator app.
    private func askCode(_ challenge: String) async {
        while true {
            guard let code = await promptText("الرمز الثاني", message: "اكتب الرمز من تطبيق المصادقة في جوالك.",
                                              placeholder: "000000", ok: "دخول", keyboard: .numberPad) else { return }
            do {
                try await Api.shared.loginTwoFactor(challenge, normalizeDigits(code.trimmingCharacters(in: .whitespaces)))
                return
            } catch {
                toastError(error)
                if errorText(error).contains("انتهت") { return }
            }
        }
    }
}
