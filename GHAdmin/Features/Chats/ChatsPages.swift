import SwiftUI
import UIKit

// المحادثات: customers' live chat with the shop (app + website).
// Inbox: GET /ps/chats. Thread: GET /ps/chats/{id}?after_id=, polled every 4 s
// while the page is on screen; POST /ps/chats/{id} (text or photo), POST /ps/chats/{id}/read.

// MARK: - Models

/// One conversation in the inbox.
struct ChatThreadSummary: Identifiable, Hashable {
    let id: String
    var userId: String?
    var customerName: String
    var phone: String?
    var lastPreview: String?
    var lastFrom: String?
    var lastMessageAt: Date?
    var unread: Int

    init(_ m: JSON) {
        id = jstr(m["id"])
        userId = js(m["user_id"])
        customerName = js(m["customer_name"]) ?? "عميل"
        phone = js(m["phone"])
        lastPreview = js(m["last_preview"])
        lastFrom = js(m["last_from"])
        lastMessageAt = jdate(m["last_message_at"])
        unread = ji(m["unread_staff"])
    }
}

/// One message in a conversation.
struct ChatMessage: Identifiable, Hashable {
    let id: String
    /// customer or staff
    var from: String
    var body: String?
    var imageUrl: String?
    var orderId: String?
    var orderInvoice: String?
    var productName: String?
    var productImage: String?
    var staffName: String?
    var createdAt: Date?

    var fromStaff: Bool { from == "staff" }

    init(_ m: JSON) {
        id = jstr(m["id"])
        from = js(m["from"]) ?? "customer"
        body = js(m["body"])
        imageUrl = js(m["image_url"])
        let o = m["ps_order"] as? JSON
        orderId = js(o?["id"])
        orderInvoice = js(o?["invoice_no"])
        let p = m["product"] as? JSON
        productName = js(p?["name"])
        productImage = js(p?["image"])
        staffName = js(m["staff_name"])
        createdAt = jdate(m["created_at"])
    }
}

fileprivate let chatTimeFmt: DateFormatter = {
    let f = DateFormatter()
    f.locale = Locale(identifier: "en_US_POSIX")
    f.dateFormat = "h:mm a"
    return f
}()

/// 3:45 PM today, otherwise the day.
fileprivate func chatWhen(_ d: Date?) -> String {
    guard let d else { return "" }
    if Calendar.current.isDateInToday(d) { return chatTimeFmt.string(from: d) }
    if Calendar.current.isDateInYesterday(d) { return "أمس" }
    return dateStr(d)
}

fileprivate func chatIdNumber(_ s: String) -> Int { Int(s) ?? 0 }

// MARK: - Inbox

struct ChatsPage: View {
    @ObservedObject private var store = Store.shared
    @State private var threads: [ChatThreadSummary] = []
    @State private var loaded = false
    @State private var failure: String?
    @State private var featureOff = false

    init() {}

    var body: some View {
        GHPage("المحادثات", onRefresh: { await load() }, trailing: {
            HStack(spacing: 14) {
                NavIcon("ellipsis.circle") { Task { await inboxMenu() } }
                NavIcon("square.and.pencil") { startChat() }
            }
        }) {
            content
        }
        .task { await pollLoop() }
    }

    @ViewBuilder private var content: some View {
        if !loaded {
            LoadingView()
        } else if featureOff {
            GHFeatureOffState(feature: "chat")
        } else if let failure, threads.isEmpty {
            EmptyState(icon: "wifi.exclamationmark", title: "ما قدرنا نجيب المحادثات", message: failure) {
                SecondaryButton("حاول مرة ثانية", icon: "arrow.clockwise") { Task { await load() } }
            }
        } else if threads.isEmpty {
            EmptyState(icon: "bubble.left.and.bubble.right", title: "ما في محادثات",
                       message: "لما عميل يكتب لكم من التطبيق أو الموقع تطلع المحادثة هنا.")
        } else {
            listSections
        }
    }

    private var unreadThreads: [ChatThreadSummary] { threads.filter { $0.unread > 0 } }
    private var readThreads: [ChatThreadSummary] { threads.filter { $0.unread == 0 } }

    @ViewBuilder private var listSections: some View {
        let unread = unreadThreads
        let rest = readThreads
        if !unread.isEmpty {
            GHSection("غير مقروءة · \(unread.count)") {
                ForEach(unread) { t in ChatThreadRow(thread: t) }
            }
        }
        if !rest.isEmpty {
            GHSection(unread.isEmpty ? nil : "الكل") {
                ForEach(rest) { t in ChatThreadRow(thread: t) }
            }
        }
    }

    private func pollLoop() async {
        await load()
        while !Task.isCancelled {
            try? await Task.sleep(nanoseconds: 10_000_000_000)
            if Task.isCancelled { break }
            await load()
        }
    }

    private func load() async {
        do {
            let res = try await Api.shared.get("/ps/chats")
            var rows: [JSON] = []
            if let arr = res as? [Any] {
                rows = arr.compactMap { $0 as? JSON }
            } else if let obj = res as? JSON {
                rows = jlist(obj["data"] ?? obj["threads"])
            }
            threads = rows.map(ChatThreadSummary.init)
            store.chatsUnread = threads.reduce(0) { $0 + $1.unread }
            failure = nil
            featureOff = false
        } catch {
            if let e = error as? ApiError, e.status == 403 { featureOff = true }
            failure = errorText(error)
        }
        loaded = true
    }

    private func inboxMenu() async {
        let actions: [SheetAction<String>] = [
            SheetAction("محادثة جديدة", "new"),
            SheetAction("تعديل الردود الجاهزة", "replies"),
        ]
        guard let a = await pickAction(title: "المحادثات", actions: actions) else { return }
        if a == "replies" {
            pushPage(ChatRepliesEditPage())
        } else {
            startChat()
        }
    }

    /// Staff writes first to a customer (POST /ps/chats/start/{userId}).
    private func startChat() {
        Task {
            let c: Customer? = await Nav.shared.pushForResult { d in CustomerPickerPage(done: d) }
            guard let c else { return }
            do {
                let res = try await Api.shared.post("/ps/chats/start/\(c.id)") as? JSON ?? [:]
                let t = (res["thread"] as? JSON) ?? res
                let id = jstr(t["id"])
                if id.isEmpty { return }
                pushPage(ChatThreadPage(threadId: id, title: c.name))
            } catch {
                toastError(error)
            }
        }
    }
}

fileprivate struct ChatThreadRow: View {
    let thread: ChatThreadSummary

    private var preview: String {
        let p = thread.lastPreview ?? "صورة"
        return thread.lastFrom == "staff" ? "أنت: \(p)" : p
    }

    var body: some View {
        let t = thread
        let tf: Font? = t.unread > 0 ? Font.gh(16, .semibold) : nil
        return Tile(t.customerName, subtitle: preview,
                    titleFont: tf,
                    action: { pushPage(ChatThreadPage(threadId: t.id, title: t.customerName)) },
                    leading: { Avatar(t.customerName, size: 40) },
                    trailing: { trailing })
    }

    private var trailing: some View {
        VStack(alignment: .trailing, spacing: 4) {
            Text(chatWhen(thread.lastMessageAt)).font(TS.small).foregroundStyle(GH.secondary)
            if thread.unread > 0 {
                Text("\(thread.unread)")
                    .font(.gh(12, .semibold)).foregroundStyle(.white)
                    .padding(.horizontal, 7).padding(.vertical, 2)
                    .background(Capsule().fill(GH.burgundy))
            }
        }
    }
}

// MARK: - Thread

struct ChatThreadPage: View {
    let threadId: String
    var title: String?

    @StateObject private var picker = OrderPhotoPicker()
    @State private var messages: [ChatMessage] = []
    @State private var customerId: String?
    @State private var customerName: String?
    @State private var customerPhone: String?
    @State private var customerTier: String?
    @State private var text = ""
    @State private var sending = false
    @State private var loaded = false
    @State private var failure: String?
    @State private var replies: [ChatReply]?
    @State private var showReplies = false
    @FocusState private var typing: Bool

    init(threadId: String, title: String? = nil) {
        self.threadId = threadId
        self.title = title
    }

    private var pageTitle: String { customerName ?? title ?? "محادثة" }

    var body: some View {
        ScrollViewReader { proxy in
            scroll
                .onChange(of: messages.count) { _, _ in scrollToEnd(proxy) }
        }
        .background(GH.bg.ignoresSafeArea())
        .navigationTitle(pageTitle)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { ToolbarItem(placement: .topBarTrailing) { menuButton } }
        .safeAreaInset(edge: .bottom, spacing: 0) { composer }
        .orderPhotoPicker(picker)
        .task { await pollLoop() }
        .task { await loadReplies() }
        .sheet(isPresented: $showReplies) { repliesSheet }
    }

    private var repliesSheet: some View {
        ChatRepliesSheet(replies: replies ?? fallbackChatReplies) { r in
            useReply(r)
        }
        .environment(\.layoutDirection, .rightToLeft)
    }

    private var scroll: some View {
        ScrollView {
            LazyVStack(spacing: 6) {
                header
                ForEach(messages) { m in
                    ChatBubble(message: m).id(m.id)
                }
                Color.clear.frame(height: 4).id("chat-end")
            }
            .padding(.horizontal, 12).padding(.top, 8).padding(.bottom, 8)
        }
        .scrollDismissesKeyboard(.interactively)
        .defaultScrollAnchor(.bottom)
    }

    @ViewBuilder private var header: some View {
        if !loaded {
            LoadingView()
        } else if let failure, messages.isEmpty {
            EmptyState(icon: "wifi.exclamationmark", title: "ما قدرنا نجيب المحادثة", message: failure)
        } else if messages.isEmpty {
            EmptyState(icon: "bubble.left.and.bubble.right", title: "ابدأ المحادثة",
                       message: "اكتب رسالة للعميل، توصله إشعار على التطبيق.")
        } else if let tier = customerTier {
            Text(tier).font(TS.small).foregroundStyle(GH.secondary)
                .padding(.horizontal, 10).padding(.vertical, 4)
                .background(Capsule().fill(GH.panel))
                .padding(.bottom, 6)
        }
    }

    private var menuButton: some View {
        NavIcon("ellipsis.circle") { Task { await menu() } }
    }

    // MARK: composer

    private var canSend: Bool {
        !sending && !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private var composer: some View {
        HStack(alignment: .bottom, spacing: 8) {
            Button { Task { await sendPhoto() } } label: {
                Image(systemName: "camera.fill")
                    .font(.system(size: 19))
                    .foregroundStyle(sending ? GH.tertiary : GH.burgundy)
                    .frame(width: 38, height: 38)
            }
            .buttonStyle(.plain)
            .disabled(sending)
            Button { showReplies = true } label: {
                Image(systemName: "text.bubble")
                    .font(.system(size: 19))
                    .foregroundStyle(GH.burgundy)
                    .frame(width: 34, height: 38)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("ردود جاهزة")
            TextField("", text: $text, prompt: Text("اكتب رسالة…").foregroundStyle(GH.tertiary), axis: .vertical)
                .font(.gh(16)).foregroundStyle(GH.label)
                .lineLimit(1...5)
                .focused($typing)
                .padding(.horizontal, 12).padding(.vertical, 8)
                .background(RoundedRectangle(cornerRadius: 19, style: .continuous).fill(GH.bg))
            sendButton
        }
        .padding(.horizontal, 10).padding(.top, 8).padding(.bottom, 8)
        .background(GH.tabBar.shadow(color: GH.barShadow, radius: 8, y: -3).ignoresSafeArea(edges: .bottom))
    }

    @ViewBuilder private var sendButton: some View {
        if sending {
            ProgressView().frame(width: 38, height: 38)
        } else {
            Button { Task { await sendText() } } label: {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.system(size: 32))
                    .foregroundStyle(canSend ? GH.burgundy : GH.disabled)
                    .frame(width: 38, height: 38)
            }
            .buttonStyle(.plain)
            .disabled(!canSend)
        }
    }

    // MARK: loading

    private func scrollToEnd(_ proxy: ScrollViewProxy) {
        withAnimation(.easeOut(duration: 0.2)) { proxy.scrollTo("chat-end", anchor: .bottom) }
    }

    private func pollLoop() async {
        await load(full: messages.isEmpty)
        while !Task.isCancelled {
            try? await Task.sleep(nanoseconds: 4_000_000_000)
            if Task.isCancelled { break }
            await load(full: false)
        }
    }

    private var lastId: String? {
        messages.max { chatIdNumber($0.id) < chatIdNumber($1.id) }?.id
    }

    private func load(full: Bool) async {
        var path = "/ps/chats/\(threadId)"
        if !full, let last = lastId { path += "?after_id=\(last)" }
        do {
            let res = try await Api.shared.get(path) as? JSON ?? [:]
            if let c = res["customer"] as? JSON {
                customerId = js(c["id"])
                customerName = js(c["name"]) ?? customerName
                customerPhone = js(c["phone"])
                customerTier = js(c["tier"])
            }
            let fresh = jlist(res["messages"]).map(ChatMessage.init)
            let gotNewFromCustomer = merge(fresh)
            failure = nil
            if full || gotNewFromCustomer { await markRead() }
        } catch {
            if messages.isEmpty { failure = errorText(error) }
        }
        loaded = true
    }

    /// Adds messages not seen yet. Returns true when a new customer message came in.
    @discardableResult
    private func merge(_ fresh: [ChatMessage]) -> Bool {
        if fresh.isEmpty { return false }
        let known = Set(messages.map(\.id))
        let added = fresh.filter { !known.contains($0.id) }
        if added.isEmpty { return false }
        var all = messages + added
        all.sort { chatIdNumber($0.id) < chatIdNumber($1.id) }
        messages = all
        return added.contains { !$0.fromStaff }
    }

    private func markRead() async {
        _ = try? await Api.shared.post("/ps/chats/\(threadId)/read")
        await Store.shared.refreshChatsUnread()
    }

    // MARK: sending

    private func sendText() async {
        let body = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if body.isEmpty || sending { return }
        sending = true
        do {
            let res = try await Api.shared.post("/ps/chats/\(threadId)", ["body": body]) as? JSON
            text = ""
            if let m = res?["message"] as? JSON { merge([ChatMessage(m)]) }
            await load(full: false)
        } catch {
            toastError(error)
        }
        sending = false
    }

    private func sendPhoto() async {
        let source = await pickAction(title: "أرسل صورة", actions: [
            SheetAction("الكاميرا", true),
            SheetAction("من الصور", false),
        ])
        guard let camera = source else { return }
        guard let img = await picker.pick(camera: camera) else { return }
        guard let bytes = OrderPhotoPicker.jpeg(img, maxSide: 2000, quality: 0.8) else { return }
        let caption = text.trimmingCharacters(in: .whitespacesAndNewlines)
        var fields: [String: String] = [:]
        if !caption.isEmpty { fields["body"] = caption }
        sending = true
        do {
            let res = try await Api.shared.upload("/ps/chats/\(threadId)", field: "image", data: bytes, fields: fields) as? JSON
            if !caption.isEmpty { text = "" }
            if let m = res?["message"] as? JSON { merge([ChatMessage(m)]) }
            await load(full: false)
        } catch {
            toastError(error)
        }
        sending = false
    }

    // MARK: menu

    private func menu() async {
        var actions: [SheetAction<String>] = []
        if let cid = customerId, Store.shared.customer(cid) != nil {
            actions.append(SheetAction("صفحة العميل", "customer"))
        }
        if customerPhone != nil {
            actions.append(SheetAction("واتساب", "whatsapp"))
            actions.append(SheetAction("اتصال", "call"))
        }
        actions.append(SheetAction("ردود جاهزة", "quick"))
        guard let a = await pickAction(title: pageTitle, message: customerPhone, actions: actions) else { return }
        switch a {
        case "customer": if let cid = customerId { pushPage(CustomerDetailPage(customerId: cid)) }
        case "whatsapp": openWhatsApp(phone: customerPhone, text: "")
        case "call": callPhone(customerPhone)
        default: showReplies = true
        }
    }

    // MARK: ready replies

    /// GET /ps/chat-replies once per page; the built-in replies stand in when it fails.
    private func loadReplies() async {
        if replies != nil { return }
        do {
            replies = try await ChatRepliesApi.load()
        } catch {
            replies = fallbackChatReplies
        }
    }

    private var customerFirstName: String {
        if let c = Store.shared.customer(customerId) {
            let f = c.firstName.trimmingCharacters(in: .whitespacesAndNewlines)
            if !f.isEmpty { return f }
        }
        let full = (customerName ?? title ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if let first = full.split(separator: " ").first { return String(first) }
        return ""
    }

    /// The order the chat is about: the latest message that carries one.
    private var chatOrderInvoice: String? {
        let sorted = messages.sorted { chatIdNumber($0.id) < chatIdNumber($1.id) }
        for m in sorted.reversed() {
            if let inv = m.orderInvoice, !inv.isEmpty { return inv }
        }
        return nil
    }

    private func useReply(_ r: ChatReply) {
        let filled = fillChatReply(r.text, name: customerFirstName, order: chatOrderInvoice)
        let current = text.trimmingCharacters(in: .whitespacesAndNewlines)
        text = current.isEmpty ? filled : current + "\n" + filled
        showReplies = false
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) { typing = true }
    }
}

// MARK: - Ready replies (الردود الجاهزة)

/// One ready reply. Placeholders in `text`: {name} = customer's first name, {order} = the chat's order number.
struct ChatReply: Identifiable, Hashable {
    let id = UUID()
    var title: String
    var text: String

    init(title: String, text: String) {
        self.title = title
        self.text = text
    }
}

/// Used when GET /ps/chat-replies fails (the replies the thread page offered before).
fileprivate let fallbackChatReplies: [ChatReply] = [
    ChatReply(title: "ترحيب", text: "هلا {name}، كيف نقدر نساعدك؟"),
    ChatReply(title: "لحظات", text: "لحظات وأرد عليك 🤍"),
    ChatReply(title: "نتابع لك", text: "تمام، نتابع لك الموضوع ونرد عليك."),
    ChatReply(title: "شكر", text: "شكراً لك 🤍"),
]

/// GET / PUT /ps/chat-replies → {data: [{title, text}]}.
fileprivate enum ChatRepliesApi {
    static func parse(_ res: Any?) -> [ChatReply] {
        var rows: [JSON] = []
        if let arr = res as? [Any] {
            rows = arr.compactMap { $0 as? JSON }
        } else if let obj = res as? JSON {
            rows = jlist(obj["data"] ?? obj["replies"])
        }
        var out: [ChatReply] = []
        for r in rows {
            let t = jstr(r["title"])
            let x = jstr(r["text"])
            if t.isEmpty && x.isEmpty { continue }
            out.append(ChatReply(title: t, text: x))
        }
        return out
    }

    static func load() async throws -> [ChatReply] {
        let res = try await Api.shared.get("/ps/chat-replies")
        return parse(res)
    }

    static func save(_ replies: [ChatReply]) async throws -> [ChatReply] {
        let body: [Any] = replies.map { r -> Any in
            let j: JSON = ["title": r.title, "text": r.text]
            return j
        }
        let res = try await Api.shared.put("/ps/chat-replies", ["replies": body])
        let saved = parse(res)
        if saved.isEmpty && !replies.isEmpty { return replies }
        return saved
    }
}

/// Fills {name} and {order}. A missing value is dropped with a leading "#" / "رقم"
/// and the doubled spaces it would leave.
fileprivate func fillChatReply(_ text: String, name: String?, order: String?) -> String {
    var s = text
    s = fillChatPlaceholder(s, key: "name", value: name)
    s = fillChatPlaceholder(s, key: "order", value: order)
    s = s.replacingOccurrences(of: "[ \\t]{2,}", with: " ", options: .regularExpression)
    s = s.replacingOccurrences(of: "[ \\t]+([،,.!?؟:؛])", with: "$1", options: .regularExpression)
    let lines = s.components(separatedBy: "\n").map { $0.trimmingCharacters(in: .whitespaces) }
    return lines.joined(separator: "\n").trimmingCharacters(in: .whitespacesAndNewlines)
}

fileprivate func fillChatPlaceholder(_ text: String, key: String, value: String?) -> String {
    let v = (value ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    let token = "{" + key + "}"
    if !v.isEmpty { return text.replacingOccurrences(of: token, with: v) }
    let pattern = "[ \\t]*(?:رقم[ \\t]*)?#?[ \\t]*\\{" + key + "\\}"
    return text.replacingOccurrences(of: pattern, with: "", options: .regularExpression)
}

/// The list opened from the composer: title + preview, searchable.
fileprivate struct ChatRepliesSheet: View {
    let replies: [ChatReply]
    let onPick: (ChatReply) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var query = ""

    init(replies: [ChatReply], onPick: @escaping (ChatReply) -> Void) {
        self.replies = replies
        self.onPick = onPick
    }

    private var filtered: [ChatReply] {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if q.isEmpty { return replies }
        return replies.filter { r in
            r.title.lowercased().contains(q) || r.text.lowercased().contains(q)
        }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 0) { content }
                    .padding(.bottom, 30)
            }
            .background(GH.bg.ignoresSafeArea())
            .navigationTitle("ردود جاهزة")
            .navigationBarTitleDisplayMode(.inline)
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "بحث في الردود")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    NavButton("إغلاق") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
    }

    @ViewBuilder private var content: some View {
        let list = filtered
        if replies.isEmpty {
            EmptyState(icon: "text.bubble", title: "ما في ردود جاهزة",
                       message: "أضفها من المحادثات ← ⋯ ← تعديل الردود الجاهزة.")
        } else if list.isEmpty {
            EmptyState(icon: "magnifyingglass", title: "ما في رد بهذا البحث")
        } else {
            GHSection {
                ForEach(list) { r in
                    row(r)
                }
            }
        }
    }

    private func row(_ r: ChatReply) -> some View {
        let t = r.title.isEmpty ? "بدون عنوان" : r.title
        let preview = r.text.replacingOccurrences(of: "\n", with: " ")
        return Pressable(action: { onPick(r) }) {
            VStack(alignment: .leading, spacing: 3) {
                Text(t).font(.gh(16, .semibold)).foregroundStyle(GH.label)
                Text(preview).font(TS.sub).foregroundStyle(GH.secondary)
                    .lineLimit(2)
                    .multilineTextAlignment(.leading)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 16).padding(.vertical, 11)
        }
    }
}

/// تعديل الردود الجاهزة: add, edit, delete and reorder, saved with PUT /ps/chat-replies.
struct ChatRepliesEditPage: View {
    @Environment(\.dismiss) private var dismiss
    @State private var rows: [ChatReply] = []
    @State private var loaded = false
    @State private var failure: String?
    @State private var saving = false

    init() {}

    var body: some View {
        GHPage("الردود الجاهزة", largeTitle: false, trailing: {
            saveButton
        }, bottom: {
            SecondaryButton("رد جديد", icon: "plus", action: addAction)
        }) {
            content
        }
        .task { await load() }
    }

    @ViewBuilder private var saveButton: some View {
        if saving {
            ProgressView()
        } else {
            NavButton("حفظ", bold: true, action: saveAction)
        }
    }

    private var canSave: Bool { loaded && failure == nil && !saving }

    private var saveAction: (() -> Void)? {
        if !canSave { return nil }
        return { Task { await save() } }
    }

    private var addAction: (() -> Void)? {
        if !canSave { return nil }
        return { addRow() }
    }

    @ViewBuilder private var content: some View {
        if !loaded {
            LoadingView()
        } else if let failure {
            EmptyState(icon: "wifi.exclamationmark", title: "ما قدرنا نجيب الردود", message: failure) {
                SecondaryButton("حاول مرة ثانية", icon: "arrow.clockwise") { Task { await reload() } }
            }
        } else {
            Pad(top: 16) {
                Text("اكتب {name} لاسم العميل الأول و {order} لرقم الطلب اللي تخص المحادثة. لو ما في طلب ينشال تلقائياً.")
                    .font(TS.small).foregroundStyle(GH.secondary)
            }
            if rows.isEmpty {
                EmptyState(icon: "text.bubble", title: "ما في ردود جاهزة", message: "اضغط «رد جديد» تحت.")
            }
            ForEach(Array(rows.enumerated()), id: \.element.id) { pair in
                replySection(pair.element, index: pair.offset)
            }
        }
    }

    private func replySection(_ r: ChatReply, index: Int) -> some View {
        GHSection("رد \(index + 1)", trailing: { sectionButtons(r.id, index: index) }) {
            FieldRow("العنوان", text: titleBinding(r.id), placeholder: "مثلاً: ترحيب")
            NotesRow(text: textBinding(r.id), placeholder: "هلا {name}، طلبك {order}…")
        }
    }

    private func sectionButtons(_ id: UUID, index: Int) -> some View {
        HStack(spacing: 16) {
            smallIcon("arrow.up", color: index == 0 ? GH.tertiary : GH.burgundy) { move(id, by: -1) }
                .disabled(index == 0)
            smallIcon("arrow.down", color: index == rows.count - 1 ? GH.tertiary : GH.burgundy) { move(id, by: 1) }
                .disabled(index == rows.count - 1)
            smallIcon("trash", color: GH.red) { Task { await remove(id) } }
        }
    }

    private func smallIcon(_ symbol: String, color: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol).font(.system(size: 15, weight: .medium)).foregroundStyle(color)
        }
        .buttonStyle(.plain)
    }

    private func titleBinding(_ id: UUID) -> Binding<String> {
        Binding(
            get: { rows.first(where: { $0.id == id })?.title ?? "" },
            set: { v in
                if let i = rows.firstIndex(where: { $0.id == id }) { rows[i].title = v }
            })
    }

    private func textBinding(_ id: UUID) -> Binding<String> {
        Binding(
            get: { rows.first(where: { $0.id == id })?.text ?? "" },
            set: { v in
                if let i = rows.firstIndex(where: { $0.id == id }) { rows[i].text = v }
            })
    }

    private func addRow() {
        rows.append(ChatReply(title: "", text: ""))
        Haptic.light()
    }

    private func move(_ id: UUID, by d: Int) {
        guard let i = rows.firstIndex(where: { $0.id == id }) else { return }
        let j = i + d
        if j < 0 || j >= rows.count { return }
        rows.swapAt(i, j)
        Haptic.select()
    }

    private func remove(_ id: UUID) async {
        guard let i = rows.firstIndex(where: { $0.id == id }) else { return }
        let r = rows[i]
        let empty = r.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            && r.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        if !empty {
            let ok = await confirm("حذف الرد؟", message: r.title.isEmpty ? nil : r.title)
            if !ok { return }
        }
        rows.removeAll { $0.id == id }
    }

    private func reload() async {
        loaded = false
        failure = nil
        await load()
    }

    private func load() async {
        if loaded && failure == nil { return }
        do {
            rows = try await ChatRepliesApi.load()
            failure = nil
        } catch {
            failure = errorText(error)
        }
        loaded = true
    }

    private func save() async {
        var out: [ChatReply] = []
        for r in rows {
            let t = r.title.trimmingCharacters(in: .whitespacesAndNewlines)
            let x = r.text.trimmingCharacters(in: .whitespacesAndNewlines)
            if t.isEmpty && x.isEmpty { continue }
            if x.isEmpty {
                toast("فيه رد بدون نص. اكتب النص أو احذفه.", error: true)
                return
            }
            let firstLine = x.components(separatedBy: "\n").first ?? x
            out.append(ChatReply(title: t.isEmpty ? String(firstLine.prefix(40)) : t, text: x))
        }
        saving = true
        do {
            rows = try await ChatRepliesApi.save(out)
            saving = false
            Haptic.success()
            toast("انحفظت الردود")
            dismiss()
        } catch {
            saving = false
            toastError(error)
        }
    }
}

// MARK: - Bubble

fileprivate struct ChatBubble: View {
    let message: ChatMessage

    private var mine: Bool { message.fromStaff }

    // Right-to-left: the customer's messages sit on the right, the shop's on the left.
    var body: some View {
        HStack(spacing: 0) {
            if mine { Spacer(minLength: 48) }
            bubble
            if !mine { Spacer(minLength: 48) }
        }
    }

    private var bubble: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let url = message.imageUrl { photo(url) }
            if let name = message.productName { attachment(icon: "bag.fill", text: name) }
            if let inv = message.orderInvoice { orderLink(inv) }
            if let body = message.body {
                Text(body)
                    .font(.gh(16))
                    .foregroundStyle(mine ? Color.white : GH.label)
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
            }
            footer
        }
        .padding(.horizontal, 12).padding(.vertical, 8)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(mine ? GH.burgundy : GH.card))
        .ghShadow()
    }

    private var footer: some View {
        let who = mine ? (message.staffName.map { "\($0) · " } ?? "") : ""
        return Text(who + chatWhen(message.createdAt))
            .font(.gh(11))
            .foregroundStyle(mine ? Color.white.opacity(0.7) : GH.secondary)
    }

    private func photo(_ url: String) -> some View {
        Button { pushPage(ChatPhotoPage(url: url)) } label: {
            RemoteImage(url: url)
                .frame(width: 200, height: 200)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
        }
        .buttonStyle(.plain)
    }

    private func attachment(icon: String, text: String) -> some View {
        HStack(spacing: 6) {
            Image(systemName: icon).font(.system(size: 13))
            Text(text).font(.gh(13, .medium)).lineLimit(2)
        }
        .foregroundStyle(mine ? Color.white : GH.burgundy)
        .padding(.horizontal, 8).padding(.vertical, 5)
        .background(RoundedRectangle(cornerRadius: 9).fill(mine ? Color.white.opacity(0.15) : GH.panel))
    }

    @ViewBuilder private func orderLink(_ invoice: String) -> some View {
        if let oid = message.orderId, Store.shared.order(oid) != nil {
            Button { pushPage(OrderDetailPage(orderId: oid)) } label: {
                attachment(icon: "doc.text", text: "الطلب \(invoice)")
            }
            .buttonStyle(.plain)
        } else {
            attachment(icon: "doc.text", text: "الطلب \(invoice)")
        }
    }
}

/// A chat photo, full width (signed link).
fileprivate struct ChatPhotoPage: View {
    let url: String

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            RemoteImage(url: url, contentMode: .fit)
        }
        .navigationTitle("صورة")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                NavIcon("square.and.arrow.up") { openURL(url) }
            }
        }
    }
}
