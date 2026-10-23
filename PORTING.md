# Porting the Flutter admin app to SwiftUI

The old app is Flutter, in `/home/claude/-gh-platform/lib` (read-only for you).
The new app is SwiftUI, in `/home/claude/gh-swift/GHAdmin`. iOS 17+, Swift 5.10, Xcode 26 SDK.
Everything is Arabic, right-to-left (the whole app runs with `.environment(\.layoutDirection, .rightToLeft)`).

**Goal: a faithful port.** Same screens, same sections and rows, same texts (copy the Arabic strings
exactly), same actions, same rules and calculations, same API calls. Only the toolkit changes.
Do not drop features, do not invent new ones, do not "simplify" a flow. If a Dart screen has a
button, the Swift screen has it, doing the same thing.

There is no Swift compiler here. Write careful, conservative Swift that compiles first time:
- Break big `body`s into small computed properties / sub-views (`private var header: some View`),
  so the type checker never times out. Keep each expression short.
- No force-unwrap of server data. Use the helpers in `Core/Format.swift` (`jd`, `js`, `ji`, `jb`, `jdate`, `jlist`).
- Only iOS 17 APIs. No third-party packages (Firebase is the only package, already wired).
- `View` structs are main-actor isolated; call async store methods inside `Task { ... }`.
- Use `@ObservedObject private var store = Store.shared` to read data; it re-renders on change.
- Use `@State` for form fields (Strings), parse numbers with `parseAmount(_:)` (accepts Arabic digits).
- Switch over enums exhaustively. Mark helper closures `@escaping` when stored.
- Don't redefine anything that already exists in Core/ or UI/ (names below). If you need a small
  helper, make it `private` / `fileprivate` in your own file so names never clash with other files.

## The core you build on (read these files first, they are short)

- `UI/Theme.swift` — colours `GH.burgundy`, `GH.bg`, `GH.card`, `GH.label`, `GH.secondary`, `GH.tertiary`,
  `GH.separator`, `GH.green/red/amber/blue/purple/teal/pink/gold/goldLight/ink/sand/panel/border/imageBg`,
  `GH.statusRequested…`, `GH.brandGradient`, `GH.avatarFor(name)`. Fonts: `.font(.gh(16))`,
  `.font(.gh(17, .semibold))` (weights `.regular .medium .semibold .bold`), `.font(.serif(30))` (story),
  text styles `TS.title TS.body TS.sub TS.small TS.header TS.money TS.big`. Bundled images:
  `GHImage.named("logo" | "story_cheetah" | "story_cheetah_light" | "story_logo")` → `UIImage?`, `GHImage.logo` → `Image`.
  `.ghShadow()` = the card shadow.
- `UI/Kit.swift` — the Dart kit, same names:
  - `GHPage(title, onRefresh: { await ... }, largeTitle: true, trailing: { NavButton(...) }, leading: {...}, bottom: { PrimaryButton(...) }) { content }`
    (content is a vertical list; put `GHSection`s, `Pad { }` blocks, `EmptyState`, etc. in it).
  - `GHSection("header", footer: "…", trailing: { HeaderButton(...) }) { rows… }` — white rounded group, hairlines between rows automatically.
  - `Tile("title", subtitle:, value:, valueColor:, valueFont:, titleFont:, titleColor:, chevron:, action: { }, onLongPress: { }, leading: { IconBox(...) }, trailing: { ... })`
  - `KV("label", "value", strong: true, color: GH.red)`, `Badge("label", color:)`, `IconBox("sf.symbol", color:, size:)`, `Avatar(name, size:)`,
    `StatCard(label:, value:, icon:, color:, hero:, action:)`, `QuickAction(icon:, label:, color:, action:)`, `StepDots(index)`,
  - Buttons: `PrimaryButton("label", icon:, busy:) { }` (pass `nil` action to disable), `SecondaryButton`, `ChipButton("label", selected:, icon:) { }`, `ChipBar { chips }`,
    `NavButton("حفظ", bold: true) { }`, `NavIcon("plus") { }`, `HeaderButton("label", icon:) { }`.
  - Fields: `FieldRow("label", text: $x, placeholder:, keyboard: .phone/.decimal/.email/.number/.url/.text, suffix:, ltr:, autofocus:, secure:)`,
    `AmountRow("label", text: $x, suffix: "ر.ع")`, `NotesRow(text: $x, placeholder:)`, `PickerRow("label", value: String?, placeholder:) { }`,
    `SwitchRow("label", subtitle:, isOn: $flag)`, `Segments(value: $v, options: [(v, "label")])`.
  - `EmptyState(icon:, title:, message:) { optional action }`, `LoadingView()`, `Pressable(action:) { content }`, `Pad(h:, top:, bottom:) { }`,
    `RemoteImage(url:)` / `RemoteImage(path:)` (private photo through `Store.photoUrl`).
- `UI/Dialogs.swift` — all async, call from a `Task`:
  `await confirm("title", message:, ok: "حذف", destructive: true) -> Bool`, `await alert("title", message:)`,
  `await pickAction(title:, message:, actions: [SheetAction("label", value, destructive:)]) -> T?`,
  `await promptText("title", message:, placeholder:, initial:, ok:, keyboard:, secure:) -> String?`,
  `await pickDate(initial) -> Date?`, `toast("text")`, `toast("text", error: true)`, `toast("...", icon:, onTap:)`,
  `toastError(error)`, `await attempt { try await ... } -> Bool` (shows the error as a red toast), `Haptic.select()/light()/success()`.
- `UI/Nav.swift` — navigation like the Dart `pushPage` / `presentForm`:
  - `pushPage(SomeView())` (= Dart `pushPage`), `presentForm(SomeView())` (= Dart `presentForm`, slides up full screen).
  - Close the current page/form with `@Environment(\.dismiss) private var dismiss` → `dismiss()` (works for pushed pages and forms).
  - Pages that RETURN a value (Dart `Navigator.pop(context, value)`) take a last init param
    `var done: ((T?) -> Void)? = nil`. When closing with a value: `if let done { done(value) } else { dismiss() }`
    (never call both). Callers that await a value use
    `let c: Customer? = await Nav.shared.pushForResult { done in CustomerPickerPage(done: done) }` (for Dart `pushPage<T>`)
    or `await Nav.shared.presentForResult { done in CustomerFormPage(done: done) }` (for Dart `presentForm<T>`).
  - `openURL("https://…")`, `openWhatsApp(phone:, text:)`, `callPhone(phone)`, `share([text or URL or UIImage])`, `copyText("…", toastText: "انسخ الرابط")`.
  - `Nav.shared.popToRoot()`.
- `UI/PriceEntry.swift` — `PriceDraft` (ObservableObject) + `PriceRows(draft:)` (rows to put in a GHSection), `priceCurrencies`, `rememberCommission`.
- `Core/Models.swift` — every Dart model with the same fields in camelCase: `Customer, BusinessSettings, EtaRule, Carrier, DeliveryMethod, Trip, TripExpense, ItemStatus, PurchasePlace, OrderItem, Payment, Order, OrderEvent (icon is an SF Symbol name), DriverStatus, Driver, DriverOrder, PurchaseInvoice, PieceRequest, defaultRates, rateCurrencies, invoiceNumber(_:_:)`.
  Enum cases: `ItemStatus.requested/.purchased/.arrived/.outForDelivery/.delivered/.cancelled` (`.key`, `.label`, `.color`, `.next`, `.actionLabel`, `.index`, comparable),
  `DeliveryMethod.home/.office/.nool/.noolOffice/.genacom/.genacomOffice/.gccGenacom/.gccDhl` (`.key .label .carrier .isGulf .toBranch .isCourier .carrierName`, `DeliveryMethod.from(String?)`, `DeliveryMethod.of(carrier, branch:)`), `Carrier`, `PurchasePlace`, `DriverStatus`.
- `Core/Store.swift` — `Store.shared`, same API as the Dart `Store.i` (async throws): orders, customers, trips, expenses, invoices, drivers, requests, settings, ready, syncing, lastError,
  `refresh()`, `customer(id)`, `trip(id)`, `order(id)`, `driver(id)`, `withDrivers`, `customerName(o)`, `ordersOf`, `ordersOfTrip`, `expensesOf`, `allItems` ([(order, item)]),
  `saveCustomer`, `deleteCustomer`, `customerPortalLink`, `orderPayLink`, `convertRequest`, `setRequestStatus`, `createOrder`, `updateOrder`, `markShipped`, `markLabelPrinted`, `orderByToken`,
  `deleteOrder`, `saveItem(id:orderId:name:brand:details:price:pricing:)`, `deleteItem`, `setItemStatus`, `setItemsStatus`, `recordPurchase`, `savePlan`, `setTaxFreeReceived`,
  `uploadItemPhoto(item, kind:, data:)`, `removeItemPhoto`, `photoUrl`, `createDriver`, `setDriverPassword`, `deleteDriver`, `saveDriver`, `setDelivery`, `addPayment`, `deletePayment`,
  `saveTrip`, `deleteTrip`, `addExpense`, `deleteExpense`, `savePurchaseInvoice(..., link: [(item:, cost:)])`, `deletePurchaseInvoice`, `unlinkItem`, `saveSettings`.
- `Core/API.swift` — `Api.shared.get/post/put/patch/delete(path, body)` returning `Any?` (cast with `as? JSON`), `Api.shared.upload(path, field:, data:, fields:)`, `Api.shared.session`, `Api.shared.logout()`,
  `AppConfig.apiBaseUrl / trackingBaseUrl`, `errorText(error)`, `nn(optional)` (nil → JSON null in a body).
- `Core/Format.swift` — `omr(v)`, `omrLatin`, `plainOmr`, `money(v, "EUR")`, `m(v)`, `dateStr(d)`, `dateTimeStr(d)`, `dayString(d)`, `normalizeDigits`, `parseAmount`, `waPhone`, `amountText(v)`, JSON helpers.
- `Core/Services.swift` — `Rates.shared.rate("EUR")`, `.rateText`, `.isLive`; `AppLock.isEnabled / isAvailable / unlock()`.
- `Core/Messages.swift` — `MsgTemplate`, `messageTemplates`, `quickReplies`, `QuickReply`, `payLinkTemplate(url)`, `trackingLink(order)`.
- `Core/Report.swift` — `Report.shareMonth(year:month:)`.
- `Core/Products.swift` — `AdminProduct` (raw JSON wrapper, same getters as Dart), `StoryProduct`, `storyImageUrl(path)`.
- `Core/DemoData.swift` — offline demo mode for screenshots; you don't need it.

Icons: Dart `CupertinoIcons.x` → the matching SF Symbol name string (e.g. `doc_text` → `"doc.text"`, `person_2_fill` → `"person.2.fill"`,
`cart` → `"cart"`, `bag_fill` → `"bag.fill"`, `forward` → `"chevron.forward"`, `add` → `"plus"`, `qrcode_viewfinder` → `"qrcode.viewfinder"`, `share` → `"square.and.arrow.up"`, `chat_bubble_text` → `"text.bubble"`, `phone` → `"phone"`, `trash` → `"trash"`).
Use only symbols that exist in SF Symbols 5.

## The page contract (every group uses these exact names and inits)

Group A — orders / today / search (`Features/Orders/`):
- `TodayPage()`, `OrdersPage()`
- `OrderRow(order: Order, showCustomer: Bool = true, onTap: (() -> Void)? = nil)` — with nil onTap it does what the Dart row does when onTap is null.
- `OrderFormPage(customer: Customer? = nil, tripId: String? = nil)` (opened with presentForm)
- `SearchLauncher(onTap: @escaping () -> Void)`, `SearchPage(todayOnly: Bool = false, initialQuery: String = "", initialProducts: [AdminProduct]? = nil)`
- `DeliveryPicker(value: DeliveryMethod, onChanged: @escaping (DeliveryMethod) -> Void)` (rows to put inside a GHSection)

Group B — order detail and its pages (`Features/OrderDetail/`):
- `OrderDetailPage(orderId: String)`, `ReturnPage(order: Order)`
- `ItemFormPage(orderId: String, item: OrderItem? = nil)`, `PurchasePage(item: OrderItem)`, `PlanPage(item: OrderItem)`,
  `PaymentFormPage(order: Order)`, `MessagePage(order: Order, template: MsgTemplate)`, `PhotoPage(path: String, title: String)`, `Thumb(path: String, size: CGFloat = 44)`
- `printOrderWaybill(_ o: Order) async` (the Dart top-level helper)

Group C — customers / piece requests / import (`Features/Customers/`):
- `CustomersPage()`, `CustomerDetailPage(customerId: String)`, `CustomerFormPage(customer: Customer? = nil, done: ((Customer?) -> Void)? = nil)`,
  `CustomerPickerPage(done: ((Customer?) -> Void)? = nil)`, `TierCard(tier: String?, points: Int)`, `tierName(_ tier: String?, _ points: Int = 0) -> String`, `plainPoints(_ n: Int) -> String`
- `RequestsPage()`, `RequestTile(_ r: PieceRequest)`, `RequestDetailPage(id: String)`, `ConvertRequestPage(request: PieceRequest)`
- `ImportPage()`

Group D — trips / more / purchases / settings pages (`Features/More/`):
- `TripsPage()`, `TripDetailPage(tripId: String)`, `TripFormPage(trip: Trip? = nil)`, `ExpenseFormPage(tripId: String? = nil)`
- `MorePage()`, `SummaryPage()`, `ExpensesPage()`, `SettingsPage()`, `PurchaseInvoicesPage()`, `PurchaseInvoiceFormPage(invoice: PurchaseInvoice? = nil)`,
  `DeliveryTimesPage()`, `GulfShippingPage()`

Group E — drivers / driver app / scanner (`Features/Drivers/`):
- `DriversPage()`, `DriverFormPage()`, `DriverDetailPage(driverId: String)`, `DeliveryPage(order: Order)`
- `DriverHome(name: String, initialTab: Int = 0)`, `DriverOrderPage(orderId: String)`
- `DriverAccount`, `DriverEntry`, `PastDelivery` (models from driver_money.dart), `DriverBalanceCard(_ a: DriverAccount, forDriver: Bool = true)`,
  `DriverEntryTile(_ e: DriverEntry, forDriver: Bool = true, onDelete: (() -> Void)? = nil)`, `PastDeliveryTile(_ d: PastDelivery, onTap: (() -> Void)? = nil)`,
  `AdminDriverMoney(driverId: String, name: String, initial: DriverAccount? = nil)`
- `ScannerPage(title: String = "امسح البوليصة", done: ((String?) -> Void)? = nil)`, `scanCode(title: String? = nil) async -> String?`,
  `tokenFromCode(_ code: String) -> String?`, `scanAndOpen() async`

Group F — products and Instagram story (`Features/Products/`):
- `ProductBrowser(onTap: @escaping (AdminProduct) -> Void, isSelected: ((AdminProduct) -> Bool)? = nil, reloadKey: Int = 0, initial: [AdminProduct]? = nil, onPrice: ((AdminProduct) -> Void)? = nil)`
- `ProductCard(_ p: AdminProduct, selected: Bool? = nil, onTap: @escaping () -> Void, onPrice: (() -> Void)? = nil)`
- `ProductsPage(initial: [AdminProduct]? = nil)`, `ProductEditPage(product: AdminProduct)`, `QuickPricePage(product: AdminProduct)`, `CategoryPickerPage(selected: Int? = nil, initialRows: [JSON]? = nil, done: ...)`
- `StoryPickPage()`, `StoryComposePage(products: [StoryProduct], dataOverride: [StoryData]? = nil)`, `StoryData`, `StoryCanvas(...)`, cut-out helpers (Vision).

Group G — PDFs (`Features/PDF/`):
- `shareInvoice(_ o: Order, customer: Customer?, biz: BusinessSettings) async`, `printWaybill(_ o: Order, customer: Customer?, biz: BusinessSettings, driverName: String? = nil) async`
  (and the builders `buildInvoicePdf(...) -> Data`, `buildWaybillPdf(...) -> Data`).

`Features/_Stubs.swift` holds temporary placeholders for some of these names — do NOT edit it; the
lead removes a stub when your real type lands. Your file will define the real type with the same name.

## Flutter → SwiftUI cheatsheet

- `GHPage(title:, children: [...], trailing:, onRefresh:, bottom:)` → `GHPage("title", onRefresh: { await store.refresh() }, trailing: {...}, bottom: {...}) { ... }`
- `Section(header:, footer:, trailing:, children: [...])` → `GHSection("header", footer:, trailing: {...}) { ... }`
- `ListenableBuilder(listenable: Store.i, ...)` → just read `store` (an `@ObservedObject`).
- `setState(() => x = y)` → `@State var x`.
- `TextEditingController` → `@State private var text = ""` + `FieldRow(..., text: $text)`.
- `CupertinoSliverRefreshControl` → `onRefresh:`.
- `showCupertinoDialog` / `CupertinoAlertDialog` → `confirm` / `alert` / `promptText`.
- `showCupertinoModalPopup` with `CupertinoActionSheet` → `actionSheet`.
- `image_picker` → `PhotosPicker` (PhotosUI) for the library, and for the camera a small `UIImagePickerController` wrapper
  (put it in your own file, `fileprivate` name) presented with `.fullScreenCover`. Compress with `jpegData(compressionQuality: 0.8)`, max 2000 px side.
- `url_launcher` → `openURL`, `openWhatsApp`, `callPhone`.
- `share_plus` → `share([...])`.
- `SharedPreferences` → `UserDefaults.standard` / `@AppStorage`.
- `Wrap` → a `LazyVGrid` or a `ChipBar`; `GridView` → `LazyVGrid(columns: [GridItem(.flexible()), …])`.
- `IndexedStack`/`Segments` tabs → `@State` + `Segments`.

When done, reply with: the files you wrote, every public type/function with its init, anything you
could not port 1:1 and why, and anything another group must provide that is not in the contract.
