import Foundation

/// Full link for a store image path (/storage/…).
func storyImageUrl(_ path: String) -> String {
    if path.hasPrefix("http") { return path }
    let site = AppConfig.apiBaseUrl.replacingOccurrences(of: "/api", with: "", options: [.anchored, .backwards])
    return site + (path.hasPrefix("/") ? "" : "/") + path
}

/// A store product as the admin app shows and edits it (the raw JSON from /admin/products).
struct AdminProduct: Identifiable, Hashable {
    let raw: JSON

    init(_ raw: JSON) { self.raw = raw }

    static func == (a: AdminProduct, b: AdminProduct) -> Bool { a.id == b.id && a.price == b.price && a.stock == b.stock && a.active == b.active && a.comparePrice == b.comparePrice }
    func hash(into h: inout Hasher) { h.combine(id) }

    var id: Int { ji(raw["id"]) }
    var nameAr: String { jstr(raw["name_ar"]) }
    var nameEn: String { jstr(raw["name_en"]) }
    var name: String { nameAr.trimmingCharacters(in: .whitespaces).isEmpty ? nameEn : nameAr }
    var brand: String { js(raw["brand_name_en"]) ?? js(raw["brand_name_ar"]) ?? "" }
    var price: Double { jd(raw["price"]) }
    var comparePrice: Double? { jd(raw["compare_price"]) > 0 ? jd(raw["compare_price"]) : nil }
    var stock: Int { ji(raw["stock_quantity"]) }
    var onOrder: Bool { js(raw["availability"]) == "on_order" }
    var active: Bool { js(raw["status"]) == "active" }
    var gender: String? { js(raw["gender"]) }
    var origin: String? { js(raw["origin"]) }
    var featured: Bool { jb(raw["is_featured"]) }
    var categoryId: Int? { js(raw["category_id"]).flatMap { Int($0) } }
    var categoryName: String? { js(raw["category_name"]) }

    /// The same product with fields the server sent back merged in.
    func merged(_ changes: JSON) -> AdminProduct {
        var r = raw
        changes.forEach { r[$0] = $1 }
        return AdminProduct(r)
    }

    var image: String? { js(raw["primary_image"]).map(storyImageUrl) }

    /// A discount counts while it is lower than the price.
    var onSale: Bool { comparePrice.map { $0 < price } ?? false }
    var sellPrice: Double { onSale ? comparePrice! : price }

    var toStory: StoryProduct { StoryProduct(raw) }
}

/// A store product, as the Instagram story needs it.
struct StoryProduct: Identifiable, Hashable {
    let id: Int
    var name: String
    var brand: String
    var price: Double
    var was: Double?
    var image: String?

    init(id: Int, name: String, brand: String, price: Double, was: Double? = nil, image: String? = nil) {
        self.id = id; self.name = name; self.brand = brand; self.price = price; self.was = was; self.image = image
    }

    /// Same rule as the website: a discount counts while it is lower than the price and not expired.
    init(_ j: JSON) {
        let price = jd(j["price"])
        let compare = jd(j["compare_price"])
        let until = jdate(j["discount_expires_at"])
        let onSale = compare > 0 && compare < price && (until == nil || until! > Date())
        let img = js(j["primary_image"]) ?? js(j["image"]) ?? ""
        id = ji(j["id"])
        let ar = jstr(j["name_ar"]).trimmingCharacters(in: .whitespaces)
        name = ar.isEmpty ? jstr(j["name_en"]) : ar
        brand = js(j["brand_name_en"]) ?? js(j["brand_name"]) ?? js(j["brand_name_ar"]) ?? ""
        self.price = onSale ? compare : price
        was = onSale ? price : nil
        image = img.isEmpty ? nil : storyImageUrl(img)
    }
}
