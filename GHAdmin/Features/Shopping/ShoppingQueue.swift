import Foundation
import Network
import UIKit

// Shopping mode keeps every purchase on the phone first (JSON + photo files in
// Application Support), then sends it. Nothing is lost when the boutique has no
// signal, and a piece is never recorded twice (one entry per item id, and each
// step — price, receipt, photo — is marked done as soon as the server has it).

// MARK: - Server calls

extension Store {
    /// Same endpoint as recordPurchase (PUT /ps/items/{id}/purchase), with the tax-free % you chose.
    /// No refresh here: the queue refreshes once after sending everything.
    func shopRecordPurchase(itemId: String, place: PurchasePlace, price: Double, currency: String,
                            rate: Double, taxFreePct: Double) async throws {
        try await Api.shared.put("/ps/items/\(itemId)/purchase", [
            "place": place.key, "price": price, "currency": currency, "rate": rate, "tax_free_pct": taxFreePct,
        ])
    }

    /// Same endpoint as uploadItemPhoto (POST /ps/items/{id}/photo). kind is "photo" or "receipt".
    func shopUploadItemPhoto(itemId: String, kind: String, data: Data) async throws {
        try await Api.shared.upload("/ps/items/\(itemId)/photo", field: "file", data: data, fields: ["kind": kind])
    }

    /// The newest trip that hasn't ended (one with pieces still to buy first), else the newest trip.
    var shopDefaultTripId: String? {
        let today = Calendar.current.startOfDay(for: Date())
        let old = Date.distantPast
        let sorted = trips.sorted { ($0.startsOn ?? old) > ($1.startsOn ?? old) }
        let open = sorted.filter { ($0.endsOn ?? Date.distantFuture) >= today }
        let toBuy: (Trip) -> Bool = { t in
            self.ordersOfTrip(t.id).contains { o in o.activeItems.contains { $0.status == .requested && !$0.instant } }
        }
        return (open.first(where: toBuy) ?? open.first ?? sorted.first(where: toBuy) ?? sorted.first)?.id
    }
}

// MARK: - A purchase waiting on the phone

struct ShoppingPendingPurchase: Codable, Identifiable, Hashable {
    /// The item id: one entry per piece.
    var id: String
    var orderId: String
    var title: String
    var place: String
    var price: Double
    var currency: String
    var rate: Double
    var taxFreePct: Double
    /// File names inside the queue folder (one receipt may be shared by several pieces).
    var receiptFile: String?
    var photoFile: String?
    var purchaseDone: Bool
    var receiptDone: Bool
    var photoDone: Bool
    var createdAt: Date
    var lastError: String?
    /// The server refused it (not a network problem): waits for you to retry or remove it.
    var blocked: Bool

    init(id: String, orderId: String, title: String, place: PurchasePlace, price: Double, currency: String,
         rate: Double, taxFreePct: Double) {
        self.id = id; self.orderId = orderId; self.title = title; self.place = place.key
        self.price = price; self.currency = currency; self.rate = rate; self.taxFreePct = taxFreePct
        receiptFile = nil; photoFile = nil
        purchaseDone = false; receiptDone = false; photoDone = false
        createdAt = Date(); lastError = nil; blocked = false
    }

    var purchasePlace: PurchasePlace { PurchasePlace.from(place) ?? .other }
    var omr: Double { price * rate }
}

// MARK: - The queue

@MainActor
final class ShoppingQueue: ObservableObject {
    static let shared = ShoppingQueue()

    /// Not on the server yet (in the order they were bought).
    @Published private(set) var pending: [ShoppingPendingPurchase] = []
    /// Sent this session (kept until the app restarts, so a piece never shows as "to buy" again
    /// while the store is refreshing).
    @Published private(set) var recorded: [String: ShoppingPendingPurchase] = [:]
    @Published private(set) var uploading = false

    private var monitor: NWPathMonitor?
    private var activeObserver: NSObjectProtocol?
    private var online = true

    private init() {
        load()
        activeObserver = NotificationCenter.default.addObserver(
            forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { _ in
            Task { @MainActor in await ShoppingQueue.shared.flush() }
        }
        let m = NWPathMonitor()
        m.pathUpdateHandler = { path in
            let ok = path.status == .satisfied
            Task { @MainActor in
                let q = ShoppingQueue.shared
                let back = ok && !q.online
                q.online = ok
                if back { await q.flush() }
            }
        }
        m.start(queue: DispatchQueue(label: "app.ghshopper.shopping.net"))
        monitor = m
    }

    /// Call once at app start so waiting purchases go up even before shopping mode is opened.
    func start() {
        Task { await flush() }
    }

    // MARK: lookups

    func entry(_ itemId: String) -> ShoppingPendingPurchase? { pending.first { $0.id == itemId } }
    func isPending(_ itemId: String) -> Bool { pending.contains { $0.id == itemId } }
    /// Bought in shopping mode on this phone (waiting, or already sent this session).
    func isLocal(_ itemId: String) -> Bool { isPending(itemId) || recorded[itemId] != nil }
    var waitingCount: Int { pending.filter { !$0.blocked }.count }

    // MARK: files

    private var dir: URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let d = base.appendingPathComponent("gh_shopping_queue", isDirectory: true)
        try? FileManager.default.createDirectory(at: d, withIntermediateDirectories: true)
        return d
    }

    private var listURL: URL { dir.appendingPathComponent("queue.json") }
    private func fileURL(_ name: String) -> URL { dir.appendingPathComponent(name) }

    private func load() {
        guard let d = try? Data(contentsOf: listURL),
              let list = try? JSONDecoder().decode([ShoppingPendingPurchase].self, from: d) else { return }
        pending = list
    }

    private func save() {
        guard let d = try? JSONEncoder().encode(pending) else { return }
        try? d.write(to: listURL, options: [.atomic])
    }

    private func writePhoto(_ data: Data?, prefix: String) -> String? {
        guard let data else { return nil }
        let name = "\(prefix)_\(UUID().uuidString).jpg"
        do { try data.write(to: fileURL(name), options: [.atomic]) } catch { return nil }
        return name
    }

    /// Deletes photo files no waiting purchase points to any more.
    private func cleanFiles() {
        let used = Set(pending.flatMap { [$0.receiptFile, $0.photoFile].compactMap { $0 } })
        guard let names = try? FileManager.default.contentsOfDirectory(atPath: dir.path) else { return }
        for n in names where n.hasSuffix(".jpg") && !used.contains(n) {
            try? FileManager.default.removeItem(at: fileURL(n))
        }
    }

    private func modify(_ id: String, _ change: (inout ShoppingPendingPurchase) -> Void) {
        guard let k = pending.firstIndex(where: { $0.id == id }) else { return }
        change(&pending[k])
        save()
    }

    // MARK: writes

    /// Saves the purchases on the phone first (with their photos). One receipt photo can be shared
    /// by all of them; the piece photo is only kept when there is a single piece.
    func add(_ list: [ShoppingPendingPurchase], receipt: Data?, photo: Data?) {
        let receiptName = writePhoto(receipt, prefix: "r")
        let photoName = list.count == 1 ? writePhoto(photo, prefix: "p") : nil
        for var p in list {
            if let receiptName { p.receiptFile = receiptName }
            if let photoName { p.photoFile = photoName }
            recorded[p.id] = nil
            if let k = pending.firstIndex(where: { $0.id == p.id }) {
                // the same piece again: the new price goes up, photos not retaken stay
                let old = pending[k]
                if p.receiptFile == nil { p.receiptFile = old.receiptFile; p.receiptDone = old.receiptDone }
                if p.photoFile == nil { p.photoFile = old.photoFile; p.photoDone = old.photoDone }
                pending[k] = p
            } else {
                pending.append(p)
            }
        }
        save()
        cleanFiles()
    }

    /// Gives up on a purchase the server refused (it won't be recorded).
    func remove(_ itemId: String) {
        pending.removeAll { $0.id == itemId }
        save()
        cleanFiles()
    }

    /// Tries a refused purchase again.
    func retry(_ itemId: String) async {
        modify(itemId) { $0.blocked = false; $0.lastError = nil }
        await flush()
    }

    /// Network down, server busy or signed out: worth trying again later.
    static func isRetryable(_ e: Error) -> Bool {
        if let a = e as? ApiError {
            guard let s = a.status else { return true }
            return s >= 500 || s == 401 || s == 408 || s == 429
        }
        return true
    }

    /// Sends everything waiting (one at a time, in order). Stops at the first network
    /// failure and keeps the rest for next time. Refreshes the store once when something went up.
    func flush() async {
        // one run at a time: a second caller waits for the current run, then goes again
        while uploading { try? await Task.sleep(nanoseconds: 250_000_000) }
        let ids = pending.filter { !$0.blocked }.map(\.id)
        if ids.isEmpty { return }
        guard let s = Api.shared.session, !s.isDriver else { return }
        uploading = true
        var sent = 0
        for id in ids {
            do {
                try await send(id)
                if let k = pending.firstIndex(where: { $0.id == id }) {
                    recorded[id] = pending[k]
                    pending.remove(at: k)
                    save()
                }
                sent += 1
            } catch {
                let again = ShoppingQueue.isRetryable(error)
                let msg = errorText(error)
                modify(id) { p in
                    p.lastError = msg
                    if !again { p.blocked = true }
                }
                if again { break }
            }
        }
        cleanFiles()
        uploading = false
        if sent > 0 { await Store.shared.refresh() }
    }

    private func send(_ id: String) async throws {
        guard let p = entry(id) else { return }
        if !p.purchaseDone {
            try await Store.shared.shopRecordPurchase(itemId: p.id, place: p.purchasePlace, price: p.price,
                                                      currency: p.currency, rate: p.rate, taxFreePct: p.taxFreePct)
            modify(id) { $0.purchaseDone = true }
        }
        if let f = p.receiptFile, !p.receiptDone {
            // a missing file can't be sent: skip it rather than block the purchase
            if let data = try? Data(contentsOf: fileURL(f)) {
                try await Store.shared.shopUploadItemPhoto(itemId: id, kind: "receipt", data: data)
            }
            modify(id) { $0.receiptDone = true }
        }
        if let f = p.photoFile, !p.photoDone {
            if let data = try? Data(contentsOf: fileURL(f)) {
                try await Store.shared.shopUploadItemPhoto(itemId: id, kind: "photo", data: data)
            }
            modify(id) { $0.photoDone = true }
        }
    }
}
