import SwiftUI
import UIKit

// The old app's building blocks (lib/ui/kit.dart), in SwiftUI.

// MARK: - Page

/// An iOS page with a large title, optional pull-to-refresh and a pinned bottom bar.
struct GHPage<Content: View, Trailing: View, Leading: View, Bottom: View>: View {
    let title: String
    var onRefresh: (() async -> Void)?
    var largeTitle = true
    @ViewBuilder var trailing: () -> Trailing
    @ViewBuilder var leading: () -> Leading
    @ViewBuilder var bottom: () -> Bottom
    @ViewBuilder var content: () -> Content

    var body: some View {
        let scroll = ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) { content() }
                .padding(.bottom, 40)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(GH.bg.ignoresSafeArea())
        .navigationTitle(title)
        .navigationBarTitleDisplayMode(largeTitle ? .large : .inline)
        .toolbar {
            if Trailing.self != EmptyView.self { ToolbarItem(placement: .topBarTrailing) { trailing() } }
            if Leading.self != EmptyView.self { ToolbarItem(placement: .topBarLeading) { leading() } }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            if Bottom.self != EmptyView.self {
                bottom()
                    .padding(.horizontal, 16).padding(.top, 10).padding(.bottom, 8)
                    .frame(maxWidth: .infinity)
                    .background(
                        UnevenRoundedRectangle(topLeadingRadius: 22, topTrailingRadius: 22)
                            .fill(GH.tabBar)
                            .shadow(color: GH.barShadow, radius: 10, y: -4)
                            .ignoresSafeArea(edges: .bottom))
            }
        }
        if let onRefresh {
            scroll.refreshable { await onRefresh() }
        } else {
            scroll
        }
    }
}

extension GHPage {
    init(_ title: String, onRefresh: (() async -> Void)? = nil, largeTitle: Bool = true,
         @ViewBuilder trailing: @escaping () -> Trailing = { EmptyView() },
         @ViewBuilder leading: @escaping () -> Leading = { EmptyView() },
         @ViewBuilder bottom: @escaping () -> Bottom = { EmptyView() },
         @ViewBuilder content: @escaping () -> Content) {
        self.title = title
        self.onRefresh = onRefresh
        self.largeTitle = largeTitle
        self.trailing = trailing
        self.leading = leading
        self.bottom = bottom
        self.content = content
    }
}

/// Text button for navigation bars.
struct NavButton: View {
    let label: String
    var bold = false
    let action: (() -> Void)?
    init(_ label: String, bold: Bool = false, action: (() -> Void)?) { self.label = label; self.bold = bold; self.action = action }
    var body: some View {
        Button(label) { action?() }
            .font(.gh(17, bold ? .semibold : .regular))
            .foregroundStyle(action == nil ? GH.tertiary : GH.burgundy)
            .disabled(action == nil)
    }
}

struct NavIcon: View {
    let symbol: String
    let action: (() -> Void)?
    init(_ symbol: String, action: (() -> Void)?) { self.symbol = symbol; self.action = action }
    var body: some View {
        Button { action?() } label: { Image(systemName: symbol).font(.system(size: 20, weight: .regular)) }
            .foregroundStyle(GH.burgundy)
            .disabled(action == nil)
    }
}

// MARK: - Sections & rows

/// Puts a hairline between the rows of a section.
private struct DividedRows: _VariadicView_MultiViewRoot {
    func body(children: _VariadicView.Children) -> some View {
        let last = children.last?.id
        VStack(alignment: .leading, spacing: 0) {
            ForEach(children) { child in
                child
                if child.id != last {
                    Rectangle().fill(GH.separator).frame(height: 0.5).padding(.leading, 16)
                }
            }
        }
    }
}

struct DividedVStack<Content: View>: View {
    @ViewBuilder let content: () -> Content
    var body: some View { _VariadicView.Tree(DividedRows()) { content() } }
}

/// iOS inset-grouped section: a header, a white rounded group, a footer.
struct GHSection<Content: View, Trailing: View>: View {
    var header: String?
    var footer: String?
    @ViewBuilder var trailing: () -> Trailing
    @ViewBuilder var content: () -> Content

    init(_ header: String? = nil, footer: String? = nil,
         @ViewBuilder trailing: @escaping () -> Trailing = { EmptyView() },
         @ViewBuilder content: @escaping () -> Content) {
        self.header = header; self.footer = footer; self.trailing = trailing; self.content = content
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if header != nil || Trailing.self != EmptyView.self {
                HStack {
                    Text(header ?? "").font(TS.header).foregroundStyle(GH.secondary)
                    Spacer(minLength: 8)
                    trailing()
                }
                .padding(.leading, 6).padding(.trailing, 2).padding(.bottom, 8)
            }
            DividedVStack { content() }
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(GH.card)
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                .ghShadow()
            if let footer {
                Text(footer).font(TS.small).foregroundStyle(GH.secondary)
                    .padding(.horizontal, 8).padding(.top, 8)
            }
        }
        .padding(.horizontal, 16).padding(.top, 22)
    }
}

/// Small text button used in section headers.
struct HeaderButton: View {
    let label: String
    var icon: String?
    let action: (() -> Void)?
    init(_ label: String, icon: String? = nil, action: (() -> Void)?) { self.label = label; self.icon = icon; self.action = action }
    var body: some View {
        Button { action?() } label: {
            HStack(spacing: 4) {
                if let icon { Image(systemName: icon).font(.system(size: 15)) }
                Text(label).font(.gh(15, .medium))
            }
        }
        .foregroundStyle(GH.burgundy)
        .disabled(action == nil)
    }
}

/// Highlights while pressed, like a native table cell.
struct PressableStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .contentShape(Rectangle())
            .background(configuration.isPressed ? GH.pressed : Color.clear)
            .animation(.easeOut(duration: 0.09), value: configuration.isPressed)
    }
}

/// A tappable area that highlights like a table cell (with a selection tick).
struct Pressable<Content: View>: View {
    let action: (() -> Void)?
    var onLongPress: (() -> Void)?
    @ViewBuilder let content: () -> Content

    init(action: (() -> Void)?, onLongPress: (() -> Void)? = nil, @ViewBuilder content: @escaping () -> Content) {
        self.action = action; self.onLongPress = onLongPress; self.content = content
    }

    var body: some View {
        if let action, let onLongPress {
            Button { Haptic.select(); action() } label: { content() }
                .buttonStyle(PressableStyle())
                .simultaneousGesture(LongPressGesture(minimumDuration: 0.5).onEnded { _ in Haptic.light(); onLongPress() })
        } else if let action {
            Button { Haptic.select(); action() } label: { content() }
                .buttonStyle(PressableStyle())
        } else if let onLongPress {
            content().contentShape(Rectangle()).onLongPressGesture { onLongPress() }
        } else {
            content()
        }
    }
}

/// A list row: leading icon, title, subtitle, trailing value and chevron.
struct Tile<Leading: View, Trailing: View>: View {
    let title: String
    var subtitle: String?
    var value: String?
    var valueColor: Color?
    var valueFont: Font?
    var titleFont: Font?
    var titleColor: Color?
    var chevron: Bool?
    var action: (() -> Void)?
    var onLongPress: (() -> Void)?
    @ViewBuilder var leading: () -> Leading
    @ViewBuilder var trailing: () -> Trailing

    init(_ title: String, subtitle: String? = nil, value: String? = nil, valueColor: Color? = nil, valueFont: Font? = nil,
         titleFont: Font? = nil, titleColor: Color? = nil, chevron: Bool? = nil,
         action: (() -> Void)? = nil, onLongPress: (() -> Void)? = nil,
         @ViewBuilder leading: @escaping () -> Leading = { EmptyView() },
         @ViewBuilder trailing: @escaping () -> Trailing = { EmptyView() }) {
        self.title = title; self.subtitle = subtitle; self.value = value; self.valueColor = valueColor
        self.valueFont = valueFont; self.titleFont = titleFont; self.titleColor = titleColor; self.chevron = chevron
        self.action = action; self.onLongPress = onLongPress; self.leading = leading; self.trailing = trailing
    }

    var body: some View {
        Pressable(action: action, onLongPress: onLongPress) {
            HStack(spacing: 0) {
                if Leading.self != EmptyView.self { leading().padding(.trailing, 12) }
                VStack(alignment: .leading, spacing: 2) {
                    Text(title).font(titleFont ?? TS.body).foregroundStyle(titleColor ?? GH.label)
                        .multilineTextAlignment(.leading)
                    if let subtitle {
                        Text(subtitle).font(TS.sub).foregroundStyle(GH.secondary).multilineTextAlignment(.leading)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                if let value {
                    Text(value).font(valueFont ?? .gh(16)).foregroundStyle(valueColor ?? GH.secondary)
                        .padding(.leading, 8)
                }
                if Trailing.self != EmptyView.self { trailing().padding(.leading, 8) }
                if chevron ?? (action != nil) {
                    Image(systemName: "chevron.forward").font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(GH.tertiary).padding(.leading, 6)
                }
            }
            .padding(.leading, 16).padding(.trailing, 14).padding(.vertical, 12)
            .frame(minHeight: 54)
        }
    }
}

/// Label on one side, value on the other (for totals).
struct KV: View {
    let label: String
    let value: String
    var strong = false
    var color: Color?
    init(_ label: String, _ value: String, strong: Bool = false, color: Color? = nil) {
        self.label = label; self.value = value; self.strong = strong; self.color = color
    }
    var body: some View {
        HStack {
            Text(label).font(strong ? TS.title : .gh(15.5)).foregroundStyle(GH.label)
                .frame(maxWidth: .infinity, alignment: .leading)
            Text(value).font(strong ? .gh(17, .semibold).monospacedDigit() : .gh(15.5, .medium).monospacedDigit())
                .foregroundStyle(color ?? GH.label)
        }
        .padding(.horizontal, 16).padding(.vertical, 9)
    }
}

/// Shopify-style status pill.
struct Badge: View {
    let label: String
    let color: Color
    init(_ label: String, color: Color) { self.label = label; self.color = color }
    var body: some View {
        HStack(spacing: 5) {
            Circle().fill(color).frame(width: 6, height: 6)
            Text(label).font(.gh(12, .semibold)).foregroundStyle(color).lineLimit(1)
        }
        .padding(.horizontal, 8).padding(.vertical, 3)
        .background(Capsule().fill(color.opacity(0.11)))
    }
}

/// Coloured round icon, like iOS Settings.
struct IconBox: View {
    let symbol: String
    var color: Color = GH.burgundy
    var size: CGFloat = 30
    init(_ symbol: String, color: Color = GH.burgundy, size: CGFloat = 30) { self.symbol = symbol; self.color = color; self.size = size }
    var body: some View {
        Image(systemName: symbol)
            .font(.system(size: size * 0.5, weight: .medium))
            .foregroundStyle(color)
            .frame(width: size, height: size)
            .background(RoundedRectangle(cornerRadius: size * 0.3, style: .continuous).fill(color.opacity(0.1)))
    }
}

struct Avatar: View {
    let name: String
    var size: CGFloat = 36
    init(_ name: String, size: CGFloat = 36) { self.name = name; self.size = size }
    var body: some View {
        let n = name.trimmingCharacters(in: .whitespaces)
        let c = GH.avatarFor(n)
        Text(n.isEmpty ? "؟" : String(n.prefix(1)))
            .font(.gh(size * 0.42, .bold)).foregroundStyle(.white)
            .frame(width: size, height: size)
            .background(Circle().fill(LinearGradient(colors: [c.opacity(0.82), c], startPoint: .top, endPoint: .bottom)))
    }
}

/// A big number card for dashboards. hero paints it in the brand maroon with the gold cheetah.
struct StatCard: View {
    let label: String
    let value: String
    var icon: String?
    var color: Color = GH.burgundy
    var hero = false
    var action: (() -> Void)?

    var body: some View {
        let card = ZStack(alignment: .bottomLeading) {
            if hero, let img = GHImage.named("story_cheetah_light") {
                Image(uiImage: img).resizable().scaledToFit().frame(width: 120).opacity(0.22)
                    .offset(x: -18, y: -6)
            }
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 8) {
                    if let icon {
                        Image(systemName: icon).font(.system(size: 14, weight: .medium))
                            .foregroundStyle(hero ? GH.goldLight : color)
                            .frame(width: 30, height: 30)
                            .background(RoundedRectangle(cornerRadius: 10).fill(hero ? Color.white.opacity(0.11) : color.opacity(0.09)))
                    }
                    Text(label).font(.gh(13.5, .medium)).foregroundStyle(hero ? GH.goldLight : GH.secondary).lineLimit(1)
                }
                Text(value).font(.gh(23, .bold).monospacedDigit()).foregroundStyle(hero ? Color.white : GH.label)
                    .lineLimit(1).minimumScaleFactor(0.5)
            }
            .padding(.horizontal, 14).padding(.top, 14).padding(.bottom, 16)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background {
            if hero { RoundedRectangle(cornerRadius: 20, style: .continuous).fill(GH.brandGradient) }
            else { RoundedRectangle(cornerRadius: 20, style: .continuous).fill(GH.card) }
        }
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .shadow(color: hero ? GH.burgundyDeep.opacity(0.27) : GH.shadowColor, radius: hero ? 11 : 9, y: hero ? 10 : 6)

        if let action {
            Button(action: action) { card }.buttonStyle(.plain)
        } else {
            card
        }
    }
}

/// Round shortcut button with a label under it (home screen quick actions).
struct QuickAction: View {
    let icon: String
    let label: String
    var color: Color = GH.burgundy
    let action: () -> Void
    var body: some View {
        Pressable(action: action) {
            VStack(spacing: 7) {
                Image(systemName: icon).font(.system(size: 21)).foregroundStyle(color)
                    .frame(width: 54, height: 54)
                    .background(RoundedRectangle(cornerRadius: 18, style: .continuous).fill(GH.card))
                    .ghShadow()
                Text(label).font(.gh(12.5, .medium)).foregroundStyle(GH.label).lineLimit(1)
            }
            .padding(.vertical, 6).frame(maxWidth: .infinity)
        }
    }
}

// MARK: - Buttons

struct PrimaryButton: View {
    let label: String
    var icon: String?
    var busy = false
    let action: (() -> Void)?
    init(_ label: String, icon: String? = nil, busy: Bool = false, action: (() -> Void)?) {
        self.label = label; self.icon = icon; self.busy = busy; self.action = action
    }
    var body: some View {
        let off = action == nil || busy
        Button { action?() } label: {
            ZStack {
                if busy { ProgressView().tint(.white) } else {
                    HStack(spacing: 8) {
                        if let icon { Image(systemName: icon).font(.system(size: 18)) }
                        Text(label).font(.gh(17, .semibold))
                    }
                    .foregroundStyle(.white)
                }
            }
            .frame(maxWidth: .infinity).frame(height: 52)
            .background {
                if off { RoundedRectangle(cornerRadius: 16, style: .continuous).fill(GH.disabled) }
                else { RoundedRectangle(cornerRadius: 16, style: .continuous).fill(GH.brandGradient) }
            }
            .shadow(color: off ? .clear : GH.burgundy.opacity(0.24), radius: 6, y: 4)
        }
        .buttonStyle(.plain)
        .disabled(off)
    }
}

struct SecondaryButton: View {
    let label: String
    var icon: String?
    let action: (() -> Void)?
    init(_ label: String, icon: String? = nil, action: (() -> Void)?) { self.label = label; self.icon = icon; self.action = action }
    var body: some View {
        Button { action?() } label: {
            HStack(spacing: 8) {
                if let icon { Image(systemName: icon).font(.system(size: 18)) }
                Text(label).font(.gh(17, .semibold))
            }
            .foregroundStyle(GH.burgundy)
            .frame(maxWidth: .infinity).frame(height: 52)
            .background(RoundedRectangle(cornerRadius: 16, style: .continuous).fill(GH.card))
            .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(GH.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .disabled(action == nil)
        .opacity(action == nil ? 0.5 : 1)
    }
}

/// Small rounded chip button (filters, quick actions).
struct ChipButton: View {
    let label: String
    var selected = false
    var icon: String?
    let action: (() -> Void)?
    init(_ label: String, selected: Bool = false, icon: String? = nil, action: (() -> Void)?) {
        self.label = label; self.selected = selected; self.icon = icon; self.action = action
    }
    var body: some View {
        Button { Haptic.select(); action?() } label: {
            HStack(spacing: 5) {
                if let icon { Image(systemName: icon).font(.system(size: 14)).foregroundStyle(selected ? GH.goldLight : GH.burgundy) }
                Text(label).font(.gh(14, .medium)).foregroundStyle(selected ? Color.white : GH.label).lineLimit(1)
            }
            .padding(.horizontal, 14).padding(.vertical, 7)
            .background(Capsule().fill(selected ? GH.ink : GH.card))
            .overlay(Capsule().stroke(selected ? GH.ink : GH.border, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .animation(.easeOut(duration: 0.15), value: selected)
    }
}

/// A horizontal strip of chips.
struct ChipBar<Content: View>: View {
    @ViewBuilder let content: () -> Content
    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) { content() }.padding(.horizontal, 16).padding(.vertical, 4)
        }
    }
}

// MARK: - Form fields

enum KeyboardKind { case text, number, decimal, phone, email, url }

private extension KeyboardKind {
    var ui: UIKeyboardType {
        switch self {
        case .text: return .default
        case .number: return .numberPad
        case .decimal: return .decimalPad
        case .phone: return .phonePad
        case .email: return .emailAddress
        case .url: return .URL
        }
    }
}

/// iOS Settings-style input row: label then field.
struct FieldRow: View {
    let label: String
    @Binding var text: String
    var placeholder: String?
    var keyboard: KeyboardKind = .text
    var suffix: String?
    var ltr = false
    var autofocus = false
    var secure = false
    @FocusState private var focused: Bool

    init(_ label: String, text: Binding<String>, placeholder: String? = nil, keyboard: KeyboardKind = .text,
         suffix: String? = nil, ltr: Bool = false, autofocus: Bool = false, secure: Bool = false) {
        self.label = label; self._text = text; self.placeholder = placeholder; self.keyboard = keyboard
        self.suffix = suffix; self.ltr = ltr; self.autofocus = autofocus; self.secure = secure
    }

    var body: some View {
        HStack(spacing: 0) {
            Text(label).font(.gh(16)).foregroundStyle(GH.label).frame(width: 112, alignment: .leading)
            Group {
                if secure {
                    SecureField("", text: $text, prompt: Text(placeholder ?? "").foregroundStyle(GH.tertiary))
                } else {
                    TextField("", text: $text, prompt: Text(placeholder ?? "").foregroundStyle(GH.tertiary))
                }
            }
            .font(.gh(16)).foregroundStyle(GH.label)
            .keyboardType(keyboard.ui)
            .textInputAutocapitalization(keyboard == .email || keyboard == .url || ltr ? .never : .sentences)
            .autocorrectionDisabled(keyboard != .text)
            .multilineTextAlignment(ltr ? .trailing : .leading)
            .environment(\.layoutDirection, ltr ? .leftToRight : .rightToLeft)
            .focused($focused)
            .padding(.vertical, 10)
            if let suffix { Text(suffix).font(TS.sub).foregroundStyle(GH.secondary).padding(.leading, 6) }
        }
        .padding(.leading, 16).padding(.trailing, 12).padding(.vertical, 4)
        .onAppear { if autofocus { DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) { focused = true } } }
    }
}

/// Money / number input row (accepts Arabic digits through parseAmount).
struct AmountRow: View {
    let label: String
    @Binding var text: String
    var suffix: String = "ر.ع"
    var autofocus = false
    init(_ label: String, text: Binding<String>, suffix: String = "ر.ع", autofocus: Bool = false) {
        self.label = label; self._text = text; self.suffix = suffix; self.autofocus = autofocus
    }
    var body: some View {
        FieldRow(label, text: $text, placeholder: "0", keyboard: .decimal, suffix: suffix.isEmpty ? nil : suffix,
                 ltr: true, autofocus: autofocus)
    }
}

/// Multi-line text area inside a section.
struct NotesRow: View {
    @Binding var text: String
    var placeholder: String?
    init(text: Binding<String>, placeholder: String? = nil) { self._text = text; self.placeholder = placeholder }
    var body: some View {
        TextField("", text: $text, prompt: Text(placeholder ?? "").foregroundStyle(GH.tertiary), axis: .vertical)
            .font(.gh(16)).foregroundStyle(GH.label)
            .lineLimit(3...8)
            .padding(16)
    }
}

/// A row that opens a picker (shows the chosen value).
struct PickerRow: View {
    let label: String
    let value: String?
    var placeholder: String?
    let action: () -> Void
    init(_ label: String, value: String?, placeholder: String? = nil, action: @escaping () -> Void) {
        self.label = label; self.value = value; self.placeholder = placeholder; self.action = action
    }
    var body: some View {
        Tile(label, value: value ?? placeholder ?? "اختر", valueColor: value == nil ? GH.tertiary : GH.secondary, action: action)
    }
}

struct SwitchRow: View {
    let label: String
    var subtitle: String?
    @Binding var isOn: Bool
    init(_ label: String, subtitle: String? = nil, isOn: Binding<Bool>) { self.label = label; self.subtitle = subtitle; self._isOn = isOn }
    var body: some View {
        Tile(label, subtitle: subtitle, chevron: false) {
            EmptyView()
        } trailing: {
            Toggle("", isOn: $isOn).labelsHidden().tint(GH.burgundy)
        }
    }
}

/// Sliding segmented control inside a padded row.
struct Segments<T: Hashable>: View {
    @Binding var value: T
    let options: [(T, String)]
    init(value: Binding<T>, options: [(T, String)]) { self._value = value; self.options = options }
    var body: some View {
        Picker("", selection: $value) {
            ForEach(options, id: \.0) { o in Text(o.1).tag(o.0) }
        }
        .pickerStyle(.segmented)
        .padding(10)
    }
}

// MARK: - States

struct EmptyState<Action: View>: View {
    let icon: String
    let title: String
    var message: String?
    @ViewBuilder var action: () -> Action
    init(icon: String, title: String, message: String? = nil, @ViewBuilder action: @escaping () -> Action = { EmptyView() }) {
        self.icon = icon; self.title = title; self.message = message; self.action = action
    }
    var body: some View {
        VStack(spacing: 0) {
            Image(systemName: icon).font(.system(size: 46)).foregroundStyle(GH.tertiary)
            Text(title).font(TS.title).foregroundStyle(GH.label).multilineTextAlignment(.center).padding(.top, 14)
            if let message {
                Text(message).font(TS.sub).foregroundStyle(GH.secondary).multilineTextAlignment(.center).padding(.top, 6)
            }
            if Action.self != EmptyView.self { action().padding(.top, 18) }
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 32).padding(.top, 60).padding(.bottom, 20)
    }
}

struct LoadingView: View {
    var body: some View { ProgressView().controlSize(.large).frame(maxWidth: .infinity).padding(48) }
}

/// Thin step indicator for item progress (0 = requested … 4 = delivered).
struct StepDots: View {
    let index: Int
    init(_ index: Int) { self.index = index }
    var body: some View {
        HStack(spacing: 0) {
            ForEach(0..<5, id: \.self) { k in
                Circle().fill(index >= k ? GH.burgundy : GH.separator).frame(width: 8, height: 8)
                if k < 4 { Rectangle().fill(index > k ? GH.burgundy : GH.separator).frame(width: 11, height: 2) }
            }
        }
    }
}

/// A plain padded block inside the page (not a section).
struct Pad<Content: View>: View {
    var h: CGFloat = 16
    var top: CGFloat = 0
    var bottom: CGFloat = 0
    @ViewBuilder let content: () -> Content
    var body: some View {
        content().padding(.horizontal, h).padding(.top, top).padding(.bottom, bottom)
    }
}

/// Shows a private photo (signed link from the server) or a remote image.
struct RemoteImage: View {
    var url: String?
    var path: String?
    var contentMode: ContentMode = .fill
    @State private var resolved: URL?

    var body: some View {
        ZStack {
            GH.imageBg
            if let resolved {
                AsyncImage(url: resolved) { phase in
                    switch phase {
                    case .success(let img): img.resizable().aspectRatio(contentMode: contentMode)
                    case .failure: Image(systemName: "photo").foregroundStyle(GH.tertiary)
                    default: ProgressView()
                    }
                }
            }
        }
        .clipped()
        .task(id: (url ?? "") + (path ?? "")) {
            if let url { resolved = URL(string: url) }
            else if let path, let u = try? await Store.shared.photoUrl(path) { resolved = URL(string: u) }
        }
    }
}
