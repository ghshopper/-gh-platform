import SwiftUI
import UIKit

// Port of lib/pages/story_page.dart: pick products, then design and share
// their Instagram stories. (StoryProduct lives in Core/Products.swift.)

// MARK: - Pick products

/// Step 1: choose one or more store products.
struct StoryPickPage: View {
    /// In the order they were chosen.
    @State private var chosen: [StoryProduct] = []

    var body: some View {
        GHPage("ستوري المنتجات", bottom: {
            PrimaryButton(buttonLabel, icon: "sparkles", action: nextAction)
        }) {
            ProductBrowser(onTap: { p in toggle(p) },
                           isSelected: { p in chosen.contains { $0.id == p.id } })
        }
    }

    private var count: Int { chosen.count }

    private var buttonLabel: String {
        let n = count
        if n == 0 { return "اختر منتج أو أكثر" }
        return "التالي · \(n) \(n == 1 ? "منتج" : "منتجات")"
    }

    private var nextAction: (() -> Void)? {
        if count == 0 { return nil }
        let list = chosen
        return { pushPage(StoryComposePage(products: list)) }
    }

    private func toggle(_ p: AdminProduct) {
        if let i = chosen.firstIndex(where: { $0.id == p.id }) {
            chosen.remove(at: i)
        } else {
            chosen.append(p.toStory)
        }
    }
}

// MARK: - Design & share

/// Step 2: choose the design, check each story, then save / share them.
struct StoryComposePage: View {
    let products: [StoryProduct]
    /// For screenshots: ready data (with local photos).
    let dataOverride: [StoryData]?

    @State private var data: [StoryData]
    @State private var template: StoryTemplate = .classic
    @State private var cta = true
    @State private var scrolled: Int? = 0
    @State private var busy = false

    /// Photos with the background taken out (ready one by one).
    @State private var cutTasks: [Task<Void, Never>] = []
    @State private var cutting = 0
    @State private var cutFailed = 0
    @State private var generation = 0
    @State private var originals: [Int: Data] = [:]
    @State private var names = true
    @State private var shadow = true // take the soft shadow out too
    @State private var move = false // drag / pinch the photo instead of swiping
    @State private var started = false

    @State private var baseZoom: CGFloat = 1
    @State private var baseShift: CGSize = .zero
    @State private var dragging = false
    @State private var pinching = false

    init(products: [StoryProduct], dataOverride: [StoryData]? = nil) {
        self.products = products
        self.dataOverride = dataOverride
        _data = State(initialValue: dataOverride ?? products.map { $0.toData })
    }

    private var many: Bool { data.count > 1 }

    private var page: Int {
        guard !data.isEmpty else { return 0 }
        return min(max(scrolled ?? 0, 0), data.count - 1)
    }

    var body: some View {
        content
            .background(GH.bg.ignoresSafeArea())
            .navigationTitle("تصميم الستوري")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    NavButton("تعديل الكلام") { edit(page) }
                }
            }
            .onAppear {
                if !started {
                    started = true
                    cutAll(removeShadow: shadow)
                }
            }
    }

    @ViewBuilder private var content: some View {
        if data.isEmpty {
            Color.clear
        } else {
            VStack(spacing: 0) {
                pager.padding(.top, 8)
                hint
                templatesStrip
                optionsBar
                zoomRow
                buttons
            }
        }
    }

    // MARK: stories (swipe between products)

    private var pager: some View {
        GeometryReader { geo in
            ScrollView(.horizontal, showsIndicators: false) {
                LazyHStack(spacing: 0) {
                    ForEach(0..<data.count, id: \.self) { i in
                        storyPage(i)
                            .frame(width: geo.size.width * 0.78, height: geo.size.height)
                            .id(i)
                    }
                }
                .scrollTargetLayout()
            }
            .contentMargins(.horizontal, geo.size.width * 0.11, for: .scrollContent)
            .scrollTargetBehavior(.viewAligned)
            .scrollPosition(id: $scrolled)
            .scrollDisabled(move)
        }
    }

    private func storyPage(_ i: Int) -> some View {
        Color.clear
            .aspectRatio(9.0 / 16.0, contentMode: .fit)
            .overlay {
                GeometryReader { box in
                    storyCard(i, width: box.size.width)
                }
            }
            .padding(.horizontal, 8).padding(.vertical, 6)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func storyCard(_ i: Int, width: CGFloat) -> some View {
        StoryPreview(data: data[i], template: template, showCta: cta, width: width)
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .background(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(Color.white)
                    .shadow(color: Color.black.opacity(0.15), radius: 12, x: 0, y: 10))
            .contentShape(Rectangle())
            .gesture(moveGesture(i, boxWidth: width), including: move && i == page ? .all : .none)
    }

    private func moveGesture(_ i: Int, boxWidth: CGFloat) -> some Gesture {
        let k = StoryCanvas.width / max(boxWidth, 1)
        let drag = DragGesture(minimumDistance: 0)
            .onChanged { v in
                guard data.indices.contains(i) else { return }
                if !dragging {
                    dragging = true
                    baseShift = CGSize(width: data[i].shiftX, height: data[i].shiftY)
                }
                data[i].shiftX = min(max(baseShift.width + v.translation.width * k, -700), 700)
                data[i].shiftY = min(max(baseShift.height + v.translation.height * k, -1100), 1100)
            }
            .onEnded { _ in dragging = false }
        let pinch = MagnifyGesture()
            .onChanged { v in
                guard data.indices.contains(i) else { return }
                if !pinching {
                    pinching = true
                    baseZoom = data[i].zoom
                }
                data[i].zoom = min(max(baseZoom * v.magnification, 0.4), 2.6)
            }
            .onEnded { _ in pinching = false }
        return drag.simultaneously(with: pinch)
    }

    // MARK: hint line

    private var hintText: String {
        var parts: [String] = []
        if move { parts.append("اسحب الصورة لتحريكها، وكبّرها بإصبعين") }
        if cutting > 0 { parts.append("يشيل خلفية الصور…") }
        if cutting == 0 && cutFailed > 0 { parts.append("ما قدرت أجيب الصورة الأصلية لشيل الخلفية (\(cutFailed))") }
        if many && !move { parts.append("\(page + 1) من \(data.count) · اسحب للمنتج الثاني") }
        return parts.joined(separator: " · ")
    }

    private var hint: some View {
        Text(hintText)
            .font(TS.small).foregroundStyle(GH.secondary)
            .multilineTextAlignment(.center)
            .padding(.top, 6)
    }

    // MARK: designs

    private var templatesStrip: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(alignment: .top, spacing: 10) {
                ForEach(StoryTemplate.allCases) { t in templateButton(t) }
            }
            .padding(.horizontal, 16).padding(.top, 12).padding(.bottom, 4)
        }
        .frame(height: 128)
    }

    private func templateButton(_ t: StoryTemplate) -> some View {
        let on = t == template
        return Button { template = t } label: {
            VStack(spacing: 4) {
                StoryPreview(data: data[page], template: t, showCta: cta, width: 50)
                    .frame(width: 50, height: 89)
                    .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 8, style: .continuous)
                        .stroke(on ? GH.burgundy : GH.separator, lineWidth: on ? 2.5 : 1))
                Text(t.label)
                    .font(.gh(11.5, on ? .semibold : .regular))
                    .foregroundStyle(on ? GH.burgundy : GH.secondary)
                    .lineLimit(1)
            }
        }
        .buttonStyle(.plain)
        .animation(.easeOut(duration: 0.15), value: on)
    }

    // MARK: options, side by side

    private var optionsBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                StoryOptionChip(label: "تحريك الصورة", icon: "hand.draw", on: move) { v in move = v }
                StoryOptionChip(label: "شيل الظل", icon: "sun.min", on: shadow) { v in
                    shadow = v
                    cutAll(removeShadow: v)
                }
                StoryOptionChip(label: "اسم المنتج", icon: "textformat", on: names) { v in
                    names = v
                    for i in data.indices { data[i].showName = v }
                }
                StoryOptionChip(label: "«اطلب من التطبيق»", icon: "iphone", on: cta) { v in cta = v }
            }
            .padding(.horizontal, 16).padding(.vertical, 4)
        }
        .frame(height: 44)
    }

    // MARK: size

    private var zoomBinding: Binding<Double> {
        Binding(
            get: {
                let i = page
                guard data.indices.contains(i) else { return 1 }
                return Double(min(max(data[i].zoom, 0.4), 2.6))
            },
            set: { v in
                let i = page
                if data.indices.contains(i) { data[i].zoom = CGFloat(v) }
            })
    }

    private var zoomRow: some View {
        HStack(spacing: 0) {
            Image(systemName: "plus.magnifyingglass").font(.system(size: 20)).foregroundStyle(GH.secondary)
            Color.clear.frame(width: 6, height: 1)
            Text("الحجم").font(.gh(14)).foregroundStyle(GH.label)
            Slider(value: zoomBinding, in: 0.4...2.6)
                .tint(GH.burgundy)
                .padding(.horizontal, 8)
            Button { resetPhoto() } label: {
                Image(systemName: "arrow.counterclockwise").font(.system(size: 20)).foregroundStyle(GH.burgundy)
                    .frame(minWidth: 30, minHeight: 30)
                    .padding(.horizontal, 6)
            }
            .buttonStyle(.plain)
        }
        .padding(.leading, 12).padding(.trailing, 20).padding(.top, 2)
    }

    private func resetPhoto() {
        let i = page
        guard data.indices.contains(i) else { return }
        data[i].zoom = 1
        data[i].shiftX = 0
        data[i].shiftY = 0
    }

    // MARK: save / share

    private var buttons: some View {
        HStack(spacing: 10) {
            PrimaryButton(many ? "حفظ الكل" : "حفظ / مشاركة", icon: "square.and.arrow.down", busy: busy) {
                shareStories(all: true)
            }
            if many {
                SecondaryButton("هذي بس", icon: "photo", action: onlyThisAction)
            }
        }
        .padding(.horizontal, 16).padding(.vertical, 8)
    }

    private var onlyThisAction: (() -> Void)? {
        if busy { return nil }
        return { shareStories(all: false) }
    }

    // MARK: background cut-out

    private func cutAll(removeShadow: Bool) {
        cutFailed = 0
        let gen = generation + 1
        generation = gen
        let count = data.count
        cutTasks = (0..<count).map { i in
            Task { await cut(i, gen: gen, removeShadow: removeShadow) }
        }
    }

    private func cut(_ i: Int, gen: Int, removeShadow: Bool) async {
        guard dataOverride == nil, i < products.count, let url = products[i].image else { return }
        cutting += 1
        defer { cutting -= 1 }
        var loaded = originals[i]
        if loaded == nil {
            loaded = await downloadStoryPhoto(url)
            if let b = loaded { originals[i] = b }
        }
        guard let bytes = loaded else {
            if gen == generation { cutFailed += 1 }
            return
        }
        // Show the original photo while the background is taken out.
        if data.indices.contains(i), data[i].image == nil, let original = UIImage(data: bytes) {
            data[i].image = original
        }
        let img = await cutoutBytes(bytes, removeShadow: removeShadow)
        guard gen == generation, data.indices.contains(i) else { return }
        if let img {
            data[i].image = img
        } else {
            cutFailed += 1
        }
    }

    // MARK: edit the words

    private func edit(_ i: Int) {
        guard data.indices.contains(i) else { return }
        let d = data[i]
        Task {
            let r: StoryTextEdit? = await Nav.shared.presentForResult { done in
                StoryEditTextPage(brand: d.brand, name: d.name, price: storyPrice(d.price),
                                  was: d.was.map { storyPrice($0) } ?? "", done: done)
            }
            guard let r, data.indices.contains(i) else { return }
            data[i].brand = r.brand.trimmingCharacters(in: .whitespacesAndNewlines)
            data[i].name = r.name.trimmingCharacters(in: .whitespacesAndNewlines)
            data[i].price = parseAmount(r.price) ?? data[i].price
            data[i].was = r.was.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? nil : parseAmount(r.was)
        }
    }

    // MARK: render

    /// Renders one story at 1080 × 1920 pixels into a PNG file.
    private func capture(_ i: Int) async throws -> URL {
        if i < cutTasks.count { await cutTasks[i].value }
        try? await Task.sleep(nanoseconds: 120_000_000)
        guard data.indices.contains(i) else { throw ApiError(message: "الصورة مب جاهزة") }
        let canvas = StoryCanvas(data: data[i], template: template, showCta: cta)
        let renderer = ImageRenderer(content: canvas)
        renderer.scale = 1
        renderer.proposedSize = ProposedViewSize(width: StoryCanvas.width, height: StoryCanvas.height)
        guard let img = renderer.uiImage, let png = img.pngData() else {
            throw ApiError(message: "الصورة مب جاهزة")
        }
        let stamp = Int(Date().timeIntervalSince1970 * 1000)
        let file = FileManager.default.temporaryDirectory.appendingPathComponent("gh-story-\(stamp)-\(i + 1).png")
        try png.write(to: file, options: .atomic)
        return file
    }

    private func shareStories(all: Bool) {
        busy = true
        let which: [Int] = all ? Array(data.indices) : [page]
        Task {
            do {
                var files: [Any] = []
                for i in which {
                    if page != i {
                        scrolled = i
                        try? await Task.sleep(nanoseconds: 350_000_000)
                    }
                    files.append(try await capture(i))
                }
                share(files)
            } catch {
                toastError(error)
            }
            busy = false
        }
    }
}

// MARK: - Option chip

/// An on/off chip in the options bar.
fileprivate struct StoryOptionChip: View {
    let label: String
    let icon: String
    let on: Bool
    let onChanged: (Bool) -> Void

    var body: some View {
        Button { onChanged(!on) } label: {
            HStack(spacing: 6) {
                Image(systemName: icon).font(.system(size: 16)).foregroundStyle(on ? GH.goldLight : GH.secondary)
                Text(label).font(.gh(13, .medium)).foregroundStyle(on ? Color.white : GH.label).lineLimit(1)
            }
            .padding(.horizontal, 12)
            .frame(height: 36)
            .background(RoundedRectangle(cornerRadius: 20, style: .continuous).fill(on ? GH.burgundy : GH.card))
            .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(on ? GH.burgundy : Color(hex: 0xFFE4D8C8), lineWidth: 1))
        }
        .buttonStyle(.plain)
        .animation(.easeOut(duration: 0.15), value: on)
    }
}

// MARK: - Edit the words

fileprivate struct StoryTextEdit {
    let brand: String
    let name: String
    let price: String
    let was: String
}

fileprivate struct StoryEditTextPage: View {
    var done: ((StoryTextEdit?) -> Void)?
    @Environment(\.dismiss) private var dismiss
    @State private var brand: String
    @State private var name: String
    @State private var price: String
    @State private var was: String

    init(brand: String, name: String, price: String, was: String, done: ((StoryTextEdit?) -> Void)?) {
        self.done = done
        _brand = State(initialValue: brand)
        _name = State(initialValue: name)
        _price = State(initialValue: price)
        _was = State(initialValue: was)
    }

    var body: some View {
        GHPage("تعديل الكلام", trailing: {
            NavButton("تم", bold: true) { finish(StoryTextEdit(brand: brand, name: name, price: price, was: was)) }
        }, leading: {
            NavButton("إلغاء") { finish(nil) }
        }) {
            GHSection(footer: "التعديل للستوري بس، ما يغيّر المنتج في المتجر.") {
                FieldRow("البراند", text: $brand, ltr: true)
                FieldRow("الاسم", text: $name)
                AmountRow("السعر", text: $price)
                AmountRow("قبل الخصم", text: $was)
            }
        }
    }

    private func finish(_ value: StoryTextEdit?) {
        if let done { done(value) } else { dismiss() }
    }
}
