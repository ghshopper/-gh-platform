import SwiftUI
import UIKit

// MARK: - Haptics

enum Haptic {
    @MainActor static func select() { UISelectionFeedbackGenerator().selectionChanged() }
    @MainActor static func light() { UIImpactFeedbackGenerator(style: .light).impactOccurred() }
    @MainActor static func heavy() { UIImpactFeedbackGenerator(style: .heavy).impactOccurred() }
    @MainActor static func success() { UINotificationFeedbackGenerator().notificationOccurred(.success) }
}

// MARK: - Alerts and action sheets (UIKit, so they show above any open form)

/// Yes / no question. Returns true for the OK button.
@MainActor
func confirm(_ title: String, message: String? = nil, ok: String = "حذف", destructive: Bool = true) async -> Bool {
    await withCheckedContinuation { cont in
        guard let top = topViewController() else { cont.resume(returning: false); return }
        let a = UIAlertController(title: title, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "إلغاء", style: .cancel) { _ in cont.resume(returning: false) })
        let okAction = UIAlertAction(title: ok, style: destructive ? .destructive : .default) { _ in cont.resume(returning: true) }
        a.addAction(okAction)
        if !destructive { a.preferredAction = okAction }
        top.present(a, animated: true)
    }
}

/// A simple message with an OK button.
@MainActor
func alert(_ title: String, message: String? = nil) async {
    await withCheckedContinuation { (cont: CheckedContinuation<Void, Never>) in
        guard let top = topViewController() else { cont.resume(); return }
        let a = UIAlertController(title: title, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "تمام", style: .default) { _ in cont.resume() })
        top.present(a, animated: true)
    }
}

struct SheetAction<T> {
    let label: String
    let value: T
    var destructive: Bool = false
    init(_ label: String, _ value: T, destructive: Bool = false) {
        self.label = label; self.value = value; self.destructive = destructive
    }
}

/// iOS action sheet. Returns the chosen value, or nil when cancelled.
@MainActor
func pickAction<T>(title: String? = nil, message: String? = nil, actions: [SheetAction<T>]) async -> T? {
    await withCheckedContinuation { cont in
        guard let top = topViewController() else { cont.resume(returning: nil); return }
        let a = UIAlertController(title: title, message: message, preferredStyle: .actionSheet)
        for act in actions {
            a.addAction(UIAlertAction(title: act.label, style: act.destructive ? .destructive : .default) { _ in
                cont.resume(returning: act.value)
            })
        }
        a.addAction(UIAlertAction(title: "إلغاء", style: .cancel) { _ in cont.resume(returning: nil) })
        a.popoverPresentationController?.sourceView = top.view
        top.present(a, animated: true)
    }
}

/// An alert with a text field. Returns the text, or nil when cancelled.
@MainActor
func promptText(_ title: String, message: String? = nil, placeholder: String? = nil, initial: String = "",
                ok: String = "حفظ", keyboard: UIKeyboardType = .default, secure: Bool = false) async -> String? {
    await withCheckedContinuation { cont in
        guard let top = topViewController() else { cont.resume(returning: nil); return }
        let a = UIAlertController(title: title, message: message, preferredStyle: .alert)
        a.addTextField { tf in
            tf.text = initial
            tf.placeholder = placeholder
            tf.keyboardType = keyboard
            tf.isSecureTextEntry = secure
            tf.font = .gh(16)
        }
        a.addAction(UIAlertAction(title: "إلغاء", style: .cancel) { _ in cont.resume(returning: nil) })
        let okA = UIAlertAction(title: ok, style: .default) { _ in cont.resume(returning: a.textFields?.first?.text ?? "") }
        a.addAction(okA)
        a.preferredAction = okA
        top.present(a, animated: true)
    }
}

/// Bottom date picker with Done / Cancel.
@MainActor
func pickDate(_ initial: Date = Date()) async -> Date? {
    await withCheckedContinuation { cont in
        guard let top = topViewController() else { cont.resume(returning: nil); return }
        let vc = DatePickerSheet(initial: initial) { cont.resume(returning: $0) }
        if let s = vc.sheetPresentationController {
            s.detents = [.medium()]
            s.prefersGrabberVisible = true
        }
        top.present(vc, animated: true)
    }
}

private final class DatePickerSheet: UIViewController, UIAdaptivePresentationControllerDelegate {
    private let initial: Date
    private let onDone: (Date?) -> Void
    private var sent = false
    private let picker = UIDatePicker()

    init(initial: Date, onDone: @escaping (Date?) -> Void) {
        self.initial = initial
        self.onDone = onDone
        super.init(nibName: nil, bundle: nil)
    }
    required init?(coder: NSCoder) { fatalError() }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(GH.card)
        presentationController?.delegate = self
        picker.datePickerMode = .date
        picker.preferredDatePickerStyle = .wheels
        picker.date = initial
        picker.locale = Locale(identifier: "ar")
        picker.calendar = Calendar(identifier: .gregorian)
        let cancel = UIButton(type: .system)
        cancel.setTitle("إلغاء", for: .normal)
        cancel.titleLabel?.font = .gh(17)
        cancel.addAction(UIAction { [weak self] _ in self?.finish(nil) }, for: .touchUpInside)
        let done = UIButton(type: .system)
        done.setTitle("تم", for: .normal)
        done.titleLabel?.font = .gh(17, .semibold)
        done.addAction(UIAction { [weak self] _ in self?.finish(self?.picker.date) }, for: .touchUpInside)
        let bar = UIStackView(arrangedSubviews: [cancel, UIView(), done])
        bar.isLayoutMarginsRelativeArrangement = true
        bar.layoutMargins = UIEdgeInsets(top: 8, left: 20, bottom: 0, right: 20)
        let stack = UIStackView(arrangedSubviews: [bar, picker])
        stack.axis = .vertical
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: view.topAnchor, constant: 8),
            stack.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])
    }

    private func finish(_ d: Date?) {
        guard !sent else { return }
        sent = true
        onDone(d)
        dismiss(animated: true)
    }

    func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
        if !sent { sent = true; onDone(nil) }
    }
}

// MARK: - Toast

struct ToastItem: Identifiable, Equatable {
    let id = UUID()
    let message: String
    let error: Bool
    let icon: String?
    let onTap: (() -> Void)?
    static func == (a: ToastItem, b: ToastItem) -> Bool { a.id == b.id }
}

@MainActor
final class ToastCenter: ObservableObject {
    static let shared = ToastCenter()
    @Published var current: ToastItem?
    private var window: UIWindow?

    func show(_ t: ToastItem) {
        installIfNeeded()
        withAnimation(.easeOut(duration: 0.26)) { current = t }
        let wait = t.onTap == nil ? 2.4 : 5.0
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: UInt64(wait * 1_000_000_000))
            if current?.id == t.id { withAnimation(.easeIn(duration: 0.25)) { current = nil } }
        }
    }

    /// Toasts live in their own window so they show above forms and sheets.
    private func installIfNeeded() {
        guard window == nil,
              let scene = UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }).first else { return }
        let w = PassThroughWindow(windowScene: scene)
        w.windowLevel = .alert + 1
        let host = UIHostingController(rootView: ToastOverlay().environment(\.layoutDirection, .rightToLeft))
        host.view.backgroundColor = .clear
        w.rootViewController = host
        w.isHidden = false
        window = w
    }
}

private final class PassThroughWindow: UIWindow {
    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        guard let v = super.hitTest(point, with: event) else { return nil }
        return v == rootViewController?.view ? nil : v
    }
}

private struct ToastOverlay: View {
    @ObservedObject var center = ToastCenter.shared
    var body: some View {
        VStack {
            if let t = center.current {
                HStack(spacing: 10) {
                    Image(systemName: t.icon ?? (t.error ? "exclamationmark.circle.fill" : "checkmark.circle.fill"))
                        .font(.system(size: 18)).foregroundStyle(.white)
                    Text(t.message).font(.gh(15, .medium)).foregroundStyle(.white)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(.horizontal, 16).padding(.vertical, 13)
                .background(RoundedRectangle(cornerRadius: 14).fill(t.error ? Color(hex: 0xFFB3261E) : Color(hex: 0xF21C1C1E)))
                .shadow(color: .black.opacity(0.2), radius: 8, y: 6)
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .transition(.move(edge: .top).combined(with: .opacity))
                .onTapGesture {
                    withAnimation { center.current = nil }
                    t.onTap?()
                }
                .allowsHitTesting(t.onTap != nil)
            }
            Spacer()
        }
    }
}

/// A short message that slides in at the top and disappears.
@MainActor
func toast(_ message: String, error: Bool = false, icon: String? = nil, onTap: (() -> Void)? = nil) {
    ToastCenter.shared.show(ToastItem(message: message, error: error, icon: icon, onTap: onTap))
    if error { Haptic.heavy() } else { Haptic.light() }
}

/// Shows an error as a red toast.
@MainActor func toastError(_ e: Error) { toast(errorText(e), error: true) }

/// Runs an action, showing any error as a red toast. Returns true when it worked.
@MainActor @discardableResult
func attempt(_ action: () async throws -> Void) async -> Bool {
    do { try await action(); return true } catch { toastError(error); return false }
}
