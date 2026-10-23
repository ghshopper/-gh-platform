import SwiftUI
import PhotosUI
import UIKit

/// Picks one photo from the camera (UIImagePickerController) or the library
/// (PhotosPicker), like `ImagePicker().pickImage(source:)` in the old app.
/// Attach it to a page with `.orderPhotoPicker(picker)`, then
/// `let img = await picker.pick(camera: true)`.
@MainActor
final class OrderPhotoPicker: ObservableObject {
    @Published var showCamera = false
    @Published var showLibrary = false
    @Published var libraryItem: PhotosPickerItem?
    fileprivate var loading = false
    private var cont: CheckedContinuation<UIImage?, Never>?

    /// Returns the chosen image, or nil when cancelled.
    func pick(camera: Bool) async -> UIImage? {
        finish(nil)
        // let the action sheet finish closing before presenting
        try? await Task.sleep(nanoseconds: 350_000_000)
        let useCamera = camera && UIImagePickerController.isSourceTypeAvailable(.camera)
        return await withCheckedContinuation { (c: CheckedContinuation<UIImage?, Never>) in
            self.cont = c
            if useCamera {
                self.showCamera = true
            } else {
                self.libraryItem = nil
                self.showLibrary = true
            }
        }
    }

    fileprivate func finish(_ image: UIImage?) {
        guard let c = cont else { return }
        cont = nil
        c.resume(returning: image)
    }

    fileprivate func cameraDone(_ image: UIImage?) {
        finish(image)
        showCamera = false
    }

    fileprivate func load(_ item: PhotosPickerItem) {
        loading = true
        Task { @MainActor in
            let data = try? await item.loadTransferable(type: Data.self)
            self.loading = false
            self.libraryItem = nil
            var image: UIImage? = nil
            if let data { image = UIImage(data: data) }
            self.finish(image)
        }
    }

    fileprivate func libraryClosed() {
        Task { @MainActor in
            try? await Task.sleep(nanoseconds: 600_000_000)
            if !self.loading && self.libraryItem == nil { self.finish(nil) }
        }
    }

    /// JPEG no larger than maxSide pixels on its longest side.
    static func jpeg(_ image: UIImage, maxSide: CGFloat, quality: CGFloat) -> Data? {
        let w = image.size.width * image.scale
        let h = image.size.height * image.scale
        let longest = max(w, h)
        var target = image
        if longest > maxSide && longest > 0 {
            let s = maxSide / longest
            let size = CGSize(width: (w * s).rounded(), height: (h * s).rounded())
            let fmt = UIGraphicsImageRendererFormat.default()
            fmt.scale = 1
            let renderer = UIGraphicsImageRenderer(size: size, format: fmt)
            target = renderer.image { _ in
                image.draw(in: CGRect(origin: .zero, size: size))
            }
        }
        return target.jpegData(compressionQuality: quality)
    }
}

/// The camera, as a SwiftUI view.
fileprivate struct CameraPicker: UIViewControllerRepresentable {
    let onDone: (UIImage?) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(onDone: onDone) }

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let p = UIImagePickerController()
        p.sourceType = .camera
        p.delegate = context.coordinator
        return p
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let onDone: (UIImage?) -> Void
        init(onDone: @escaping (UIImage?) -> Void) { self.onDone = onDone }

        func imagePickerController(_ picker: UIImagePickerController,
                                   didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            onDone(info[.originalImage] as? UIImage)
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            onDone(nil)
        }
    }
}

fileprivate struct OrderPhotoPickerHost: ViewModifier {
    @ObservedObject var picker: OrderPhotoPicker

    func body(content: Content) -> some View {
        content
            .fullScreenCover(isPresented: $picker.showCamera, onDismiss: { picker.finish(nil) }) {
                CameraPicker(onDone: { img in picker.cameraDone(img) })
                    .ignoresSafeArea()
            }
            .photosPicker(isPresented: $picker.showLibrary, selection: $picker.libraryItem, matching: .images)
            .onChange(of: picker.libraryItem) { _, item in
                if let item { picker.load(item) }
            }
            .onChange(of: picker.showLibrary) { _, shown in
                if !shown { picker.libraryClosed() }
            }
    }
}

extension View {
    /// Hosts the camera / photo library for an OrderPhotoPicker.
    func orderPhotoPicker(_ picker: OrderPhotoPicker) -> some View {
        modifier(OrderPhotoPickerHost(picker: picker))
    }
}
