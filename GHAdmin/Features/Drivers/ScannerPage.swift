import SwiftUI
import UIKit
import AVFoundation

// Port of lib/pages/scanner_page.dart

/// Full-screen camera that returns the first QR / barcode it reads.
struct ScannerPage: View {
    let title: String
    let done: ((String?) -> Void)?

    @Environment(\.dismiss) private var dismiss
    @State private var torch = false
    @State private var finished = false

    init(title: String = "امسح البوليصة", done: ((String?) -> Void)? = nil) {
        self.title = title
        self.done = done
    }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            CameraScannerView(torch: torch, onCode: { v in found(v) })
                .ignoresSafeArea()
            frameBox
            hint
        }
        .navigationBarTitleDisplayMode(.inline)
        .navigationBarBackButtonHidden(true)
        .toolbarBackground(Color.black.opacity(0.8), for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .toolbar {
            ToolbarItem(placement: .principal) {
                Text(title).font(.gh(17, .semibold)).foregroundStyle(Color.white)
            }
            ToolbarItem(placement: .topBarLeading) {
                Button { close(nil) } label: {
                    Text("إلغاء").font(.gh(17)).foregroundStyle(Color.white)
                }
            }
            ToolbarItem(placement: .topBarTrailing) {
                Button { torch.toggle() } label: {
                    Image(systemName: torch ? "bolt.fill" : "bolt.slash").foregroundStyle(Color.white)
                }
            }
        }
    }

    private var frameBox: some View {
        RoundedRectangle(cornerRadius: 24, style: .continuous)
            .stroke(GH.gold, lineWidth: 3)
            .frame(width: 250, height: 250)
            .allowsHitTesting(false)
    }

    private var hint: some View {
        VStack {
            Spacer()
            Text("وجّه الكاميرا على كود الفاتورة أو البوليصة")
                .font(.gh(16))
                .foregroundStyle(Color.white)
                .multilineTextAlignment(.center)
                .frame(maxWidth: .infinity)
                .padding(.bottom, 70)
        }
        .allowsHitTesting(false)
    }

    private func found(_ v: String) {
        if finished { return }
        finished = true
        close(v)
    }

    private func close(_ v: String?) {
        if let done { done(v) } else { dismiss() }
    }
}

// MARK: - Camera (AVFoundation)

fileprivate struct CameraScannerView: UIViewControllerRepresentable {
    let torch: Bool
    let onCode: (String) -> Void

    func makeUIViewController(context: Context) -> CodeScannerController {
        let vc = CodeScannerController()
        vc.onCode = onCode
        return vc
    }

    func updateUIViewController(_ vc: CodeScannerController, context: Context) {
        vc.onCode = onCode
        vc.setTorch(torch)
    }
}

fileprivate final class CodeScannerController: UIViewController, AVCaptureMetadataOutputObjectsDelegate {
    var onCode: ((String) -> Void)?

    private let session = AVCaptureSession()
    private let sessionQueue = DispatchQueue(label: "gh.scanner.session")
    private var preview: AVCaptureVideoPreviewLayer?
    private var device: AVCaptureDevice?
    private var configured = false
    private var found = false
    private var torchOn = false
    private var wantTorch = false

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            configure()
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { granted in
                Task { @MainActor [weak self] in
                    if granted { self?.configure() }
                }
            }
        default:
            break
        }
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        preview?.frame = view.bounds
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        start()
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        applyTorch(false)
        stop()
    }

    private func configure() {
        if configured { return }
        guard let dev = AVCaptureDevice.default(for: .video),
              let input = try? AVCaptureDeviceInput(device: dev) else { return }
        configured = true
        device = dev
        session.beginConfiguration()
        if session.canAddInput(input) { session.addInput(input) }
        let output = AVCaptureMetadataOutput()
        if session.canAddOutput(output) {
            session.addOutput(output)
            output.setMetadataObjectsDelegate(self, queue: DispatchQueue.main)
            let wanted: [AVMetadataObject.ObjectType] = [.qr, .code128]
            output.metadataObjectTypes = wanted.filter { output.availableMetadataObjectTypes.contains($0) }
        }
        session.commitConfiguration()

        let layer = AVCaptureVideoPreviewLayer(session: session)
        layer.videoGravity = .resizeAspectFill
        layer.frame = view.bounds
        view.layer.addSublayer(layer)
        preview = layer
        start()
    }

    private func start() {
        guard configured, !found else { return }
        let s = session
        sessionQueue.async {
            if !s.isRunning { s.startRunning() }
            Task { @MainActor [weak self] in
                guard let self else { return }
                if self.wantTorch { self.applyTorch(true) }
            }
        }
    }

    private func stop() {
        let s = session
        sessionQueue.async {
            if s.isRunning { s.stopRunning() }
        }
    }

    /// Called from SwiftUI with the torch button's state.
    func setTorch(_ on: Bool) {
        wantTorch = on
        applyTorch(on)
    }

    private func applyTorch(_ on: Bool) {
        guard let d = device, d.hasTorch, torchOn != on else { return }
        do {
            try d.lockForConfiguration()
            d.torchMode = on ? .on : .off
            d.unlockForConfiguration()
            torchOn = on
        } catch {
            // the torch is not available right now
        }
    }

    nonisolated func metadataOutput(_ output: AVCaptureMetadataOutput,
                                    didOutput metadataObjects: [AVMetadataObject],
                                    from connection: AVCaptureConnection) {
        var values: [String] = []
        for obj in metadataObjects {
            if let code = obj as? AVMetadataMachineReadableCodeObject, let v = code.stringValue, !v.isEmpty {
                values.append(v)
            }
        }
        if values.isEmpty { return }
        let first = values[0]
        Task { @MainActor [weak self] in
            self?.handle(first)
        }
    }

    private func handle(_ value: String) {
        if found { return }
        found = true
        applyTorch(false)
        stop()
        onCode?(value)
    }
}

// MARK: - Helpers used by other pages

/// Opens the scanner and returns the scanned text (or nil).
@MainActor
func scanCode(title: String? = nil) async -> String? {
    let t = title ?? "امسح البوليصة"
    let result: String? = await Nav.shared.presentForResult { done in
        ScannerPage(title: t, done: done)
    }
    return result
}

/// Pulls the tracking token (a UUID) out of a scanned waybill QR.
func tokenFromCode(_ code: String) -> String? {
    let pattern = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
    guard let r = code.range(of: pattern, options: .regularExpression) else { return nil }
    return String(code[r]).lowercased()
}

/// Finds the order a scanned (or typed) code points to, from the loaded
/// orders: the invoice / waybill QR (…/track/?t=<token>), the bare tracking
/// token, the invoice ref (GH-…) or the order number (201001).
@MainActor
func orderFromCode(_ code: String) -> Order? {
    let c = code.trimmingCharacters(in: .whitespacesAndNewlines)
    if c.isEmpty { return nil }
    let store = Store.shared
    var t: String? = URLComponents(string: c)?.queryItems?.first(where: { $0.name == "t" })?.value
    if t == nil { t = tokenFromCode(c) }
    if let t {
        if let o = store.orderByToken(t.lowercased()) ?? store.orderByToken(t) { return o }
    }
    let upper = c.uppercased()
    for o in store.orders {
        if (o.refNo ?? "").uppercased() == upper || o.invoiceNo.uppercased() == upper { return o }
        if o.waybillNo == upper || o.legacyWaybillNo == upper { return o }
        if let s = o.storeOrderNumber, s.uppercased() == upper { return o }
    }
    let digits = scannerDigitRuns(c)
    for d in digits.reversed() {
        let n = Int(d)
        for o in store.orders {
            if let n, o.orderNo == n { return o }
            let refDigits = String((o.refNo ?? "").filter { $0.isASCII && $0.isNumber })
            if refDigits == d { return o }
        }
    }
    return nil
}

/// Every run of 3+ ASCII digits in the text.
fileprivate func scannerDigitRuns(_ s: String) -> [String] {
    guard let re = try? NSRegularExpression(pattern: "[0-9]{3,}") else { return [] }
    let ns = s as NSString
    let matches = re.matches(in: s, range: NSRange(location: 0, length: ns.length))
    return matches.map { ns.substring(with: $0.range) }
}

/// Scan button action: opens the camera, then the order it finds.
@MainActor
func scanAndOpen() async {
    guard let code = await scanCode(title: "امسح كود الطلب") else { return }
    guard let o = orderFromCode(code) else {
        toast("ما لقينا طلب لهذا الكود", error: true)
        return
    }
    pushPage(OrderDetailPage(orderId: o.id))
}
