import SwiftUI
import UIKit

/// A page put on a navigation stack (any SwiftUI view).
struct Screen: Identifiable, Hashable {
    let id = UUID()
    let view: AnyView
    init<V: View>(_ v: V) { view = AnyView(v) }
    static func == (a: Screen, b: Screen) -> Bool { a.id == b.id }
    func hash(into h: inout Hasher) { h.combine(id) }
}

/// A full-screen form (slides up), with its own pages pushed inside it.
struct Modal: Identifiable {
    let id = UUID()
    let root: AnyView
    var path: [Screen] = []
}

/// App-wide navigation, like the old app's root navigator: pages are pushed
/// over the tabs, forms slide up from the bottom (and may push pages or open
/// another form on top).
@MainActor
final class Nav: ObservableObject {
    static let shared = Nav()
    private init() {}

    @Published var path: [Screen] = []
    @Published var modals: [Modal] = []

    /// Pushes a page on the top-most stack (inside the open form, if any).
    func push<V: View>(_ v: V) {
        if modals.isEmpty { path.append(Screen(v)) } else { modals[modals.count - 1].path.append(Screen(v)) }
    }

    /// Opens a full-screen form.
    func present<V: View>(_ v: V) { modals.append(Modal(root: AnyView(v))) }

    /// Back one page on the top-most stack; closes the form when it is on its first page.
    func pop() {
        if modals.isEmpty {
            if !path.isEmpty { path.removeLast() }
        } else if !modals[modals.count - 1].path.isEmpty {
            modals[modals.count - 1].path.removeLast()
        } else {
            modals.removeLast()
        }
    }

    /// Closes the top-most form.
    func dismiss() { if !modals.isEmpty { modals.removeLast() } }

    /// Back to the tabs.
    func popToRoot() { modals.removeAll(); path.removeAll() }

    /// Opens a form that gives back a value: the view gets a `done` callback.
    func presentForResult<T, V: View>(_ build: @escaping (_ done: @escaping (T?) -> Void) -> V) async -> T? {
        await withCheckedContinuation { (cont: CheckedContinuation<T?, Never>) in
            var finished = false
            let done: (T?) -> Void = { value in
                guard !finished else { return }
                finished = true
                Nav.shared.dismiss()
                cont.resume(returning: value)
            }
            present(ResultForm(onClose: { done(nil) }) { build(done) })
        }
    }

    /// Pushes a page that gives back a value (e.g. a picker list).
    func pushForResult<T, V: View>(_ build: @escaping (_ done: @escaping (T?) -> Void) -> V) async -> T? {
        await withCheckedContinuation { (cont: CheckedContinuation<T?, Never>) in
            var finished = false
            let done: (T?) -> Void = { value in
                guard !finished else { return }
                finished = true
                Nav.shared.pop()
                cont.resume(returning: value)
            }
            push(ResultForm(onClose: { done(nil) }) { build(done) })
        }
    }
}

/// Resolves a pending result with nil when the page goes away by a swipe.
private struct ResultForm<Content: View>: View {
    let onClose: () -> Void
    var closeOnDisappear = false
    @ViewBuilder let content: () -> Content
    var body: some View {
        content().onDisappear { if closeOnDisappear { onClose() } }
    }
}

// MARK: - Short helpers used by every page

@MainActor func pushPage<V: View>(_ v: V) { Nav.shared.push(v) }
@MainActor func presentForm<V: View>(_ v: V) { Nav.shared.present(v) }
@MainActor func popPage() { Nav.shared.pop() }
@MainActor func dismissForm() { Nav.shared.dismiss() }

/// Hosts the root stack and every open form.
struct NavHost<Root: View>: View {
    @ObservedObject var nav = Nav.shared
    @ViewBuilder let root: () -> Root

    var body: some View {
        NavigationStack(path: $nav.path) {
            root().navigationDestination(for: Screen.self) { $0.view }
        }
        .fullScreenCover(item: modalBinding(0)) { _ in ModalLevel(level: 0) }
    }

    private func modalBinding(_ level: Int) -> Binding<Modal?> {
        Binding(get: { nav.modals.indices.contains(level) ? nav.modals[level] : nil },
                set: { v in if v == nil, nav.modals.count > level { nav.modals.removeSubrange(level...) } })
    }
}

private struct ModalLevel: View {
    @ObservedObject var nav = Nav.shared
    let level: Int

    var body: some View {
        if nav.modals.indices.contains(level) {
            NavigationStack(path: Binding(get: { nav.modals.indices.contains(level) ? nav.modals[level].path : [] },
                                          set: { p in if nav.modals.indices.contains(level) { nav.modals[level].path = p } })) {
                nav.modals[level].root.navigationDestination(for: Screen.self) { $0.view }
            }
            .environment(\.layoutDirection, .rightToLeft)
            .fullScreenCover(item: Binding(get: { nav.modals.indices.contains(level + 1) ? nav.modals[level + 1] : nil },
                                           set: { v in if v == nil, nav.modals.count > level + 1 { nav.modals.removeSubrange((level + 1)...) } })) { _ in
                ModalLevel(level: level + 1)
            }
        }
    }
}

// MARK: - UIKit bridges (alerts, sheets, share)

@MainActor
func topViewController() -> UIViewController? {
    let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
    let window = scenes.flatMap(\.windows).first { $0.isKeyWindow } ?? scenes.first?.windows.first
    var top = window?.rootViewController
    while let p = top?.presentedViewController, !p.isBeingDismissed { top = p }
    return top
}

/// Opens a link (WhatsApp, maps, phone, Instagram…).
@MainActor func openURL(_ s: String) {
    guard let url = URL(string: s) else { return }
    UIApplication.shared.open(url)
}

/// WhatsApp chat with a ready message.
@MainActor func openWhatsApp(phone: String?, text: String) {
    let t = text.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
    if let p = waPhone(phone) { openURL("https://wa.me/\(p)?text=\(t)") } else { openURL("https://wa.me/?text=\(t)") }
}

@MainActor func callPhone(_ phone: String?) {
    guard let p = phone.map({ normalizeDigits($0).filter { $0.isNumber || $0 == "+" } }), !p.isEmpty else { return }
    openURL("tel://\(p)")
}

/// The iOS share sheet (text, links, files, images).
@MainActor func share(_ items: [Any]) {
    guard let top = topViewController() else { return }
    let vc = UIActivityViewController(activityItems: items, applicationActivities: nil)
    vc.popoverPresentationController?.sourceView = top.view
    top.present(vc, animated: true)
}

@MainActor func copyText(_ s: String, toastText: String = "انسخ") {
    UIPasteboard.general.string = s
    toast(toastText)
}
