import Foundation
import UIKit
import Vision
import CoreImage
import CoreGraphics

// Port of lib/story/cutout.dart.
//
// Brand photos come on a plain white or grey background. This takes the
// background out (so the piece sits on the story's beige) and trims the
// empty space around the piece, so it shows big.
//
// With "take the shadow out" on, the iOS 17 foreground mask (Vision) cuts the
// piece out (it never keeps the shadow); when Vision finds nothing it falls
// back to the old app's plain-background algorithm. With it off, the old
// algorithm runs without its shadow pass, so the soft shadow stays.
//
// Returns nil when the photo can't be loaded; returns the photo trimmed but
// untouched when its background isn't plain (a model, a street…).

private let storyPhotoUserAgent =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"

/// Downloads a store photo like Safari does (and asks for no AVIF).
func downloadStoryPhoto(_ url: String) async -> Data? {
    let u = URL(string: url) ?? URL(string: url.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "")
    guard let u else { return nil }
    var req = URLRequest(url: u)
    req.timeoutInterval = 30
    req.setValue(storyPhotoUserAgent, forHTTPHeaderField: "User-Agent")
    req.setValue("image/webp,image/png,image/jpeg,image/*;q=0.8", forHTTPHeaderField: "Accept")
    req.setValue("\(u.scheme ?? "https")://\(u.host ?? "")/", forHTTPHeaderField: "Referer")
    guard let (data, resp) = try? await URLSession.shared.data(for: req),
          (resp as? HTTPURLResponse)?.statusCode == 200,
          !data.isEmpty else { return nil }
    return data
}

/// The photo at this link with its background taken out (nil when it can't be loaded).
func cutoutImage(_ url: String, removeShadow: Bool = true) async -> UIImage? {
    guard let data = await downloadStoryPhoto(url) else { return nil }
    return await cutoutBytes(data, removeShadow: removeShadow)
}

/// The photo with its background taken out, worked out off the main thread.
func cutoutBytes(_ data: Data, removeShadow: Bool = true) async -> UIImage? {
    await Task.detached(priority: .userInitiated) {
        storyCutoutSync(data, removeShadow: removeShadow)
    }.value
}

// MARK: - Pipeline

/// Straight (not premultiplied) RGBA, 8 bits per channel, rows top to bottom.
private struct StoryPixels {
    var px: [UInt8]
    let w: Int
    let h: Int
}

private func storyCutoutSync(_ data: Data, removeShadow: Bool) -> UIImage? {
    guard let src = UIImage(data: data), let cg = storyUprightCG(src) else { return nil }
    // Big enough for a 1080 story, small enough to be quick.
    guard let pix = storyLoadRGBA(cg, maxSide: 1400) else { return nil }
    if removeShadow, let masked = storyForegroundMasked(pix),
       let out = storyCutPixels(masked, removeShadow: false, trimOnly: true) {
        return storyMakeImage(out)
    }
    guard let out = storyCutPixels(pix, removeShadow: removeShadow, trimOnly: false) else { return nil }
    return storyMakeImage(out)
}

/// The CGImage turned the right way up (JPEG orientation).
private func storyUprightCG(_ img: UIImage) -> CGImage? {
    if img.imageOrientation == .up { return img.cgImage }
    let format = UIGraphicsImageRendererFormat()
    format.scale = img.scale
    format.opaque = false
    let r = UIGraphicsImageRenderer(size: img.size, format: format)
    let drawn = r.image { _ in img.draw(in: CGRect(origin: .zero, size: img.size)) }
    return drawn.cgImage
}

private func storyLoadRGBA(_ cg: CGImage, maxSide: Int) -> StoryPixels? {
    let side = max(cg.width, cg.height)
    guard side > 0 else { return nil }
    let scale = min(1.0, Double(maxSide) / Double(side))
    let w = max(1, Int((Double(cg.width) * scale).rounded()))
    let h = max(1, Int((Double(cg.height) * scale).rounded()))
    var buf = [UInt8](repeating: 0, count: w * h * 4)
    let space = CGColorSpaceCreateDeviceRGB()
    let ok: Bool = buf.withUnsafeMutableBytes { raw -> Bool in
        guard let ctx = CGContext(data: raw.baseAddress, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
                                  space: space, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return false }
        ctx.interpolationQuality = .high
        ctx.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
        return true
    }
    guard ok else { return nil }
    // Premultiplied → straight alpha.
    var i = 0
    let n = w * h * 4
    while i < n {
        let a = Int(buf[i + 3])
        if a > 0 && a < 255 {
            buf[i] = UInt8(min(255, Int(buf[i]) * 255 / a))
            buf[i + 1] = UInt8(min(255, Int(buf[i + 1]) * 255 / a))
            buf[i + 2] = UInt8(min(255, Int(buf[i + 2]) * 255 / a))
        }
        i += 4
    }
    return StoryPixels(px: buf, w: w, h: h)
}

private func storyMakeCG(_ pix: StoryPixels) -> CGImage? {
    let data = Data(pix.px) as CFData
    guard let provider = CGDataProvider(data: data) else { return nil }
    return CGImage(width: pix.w, height: pix.h, bitsPerComponent: 8, bitsPerPixel: 32, bytesPerRow: pix.w * 4,
                   space: CGColorSpaceCreateDeviceRGB(),
                   bitmapInfo: CGBitmapInfo(rawValue: CGImageAlphaInfo.last.rawValue),
                   provider: provider, decode: nil, shouldInterpolate: true, intent: .defaultIntent)
}

private func storyMakeImage(_ pix: StoryPixels) -> UIImage? {
    guard let cg = storyMakeCG(pix) else { return nil }
    return UIImage(cgImage: cg)
}

/// iOS 17 foreground mask: the piece(s) with everything else see-through.
private func storyForegroundMasked(_ pix: StoryPixels) -> StoryPixels? {
    guard let cg = storyMakeCG(pix) else { return nil }
    let request = VNGenerateForegroundInstanceMaskRequest()
    let handler = VNImageRequestHandler(cgImage: cg, options: [:])
    do {
        try handler.perform([request])
        guard let obs = request.results?.first, !obs.allInstances.isEmpty else { return nil }
        let buffer = try obs.generateMaskedImage(ofInstances: obs.allInstances, from: handler,
                                                 croppedToInstancesExtent: false)
        let ci = CIImage(cvPixelBuffer: buffer)
        let ctx = CIContext(options: nil)
        guard let out = ctx.createCGImage(ci, from: ci.extent) else { return nil }
        return storyLoadRGBA(out, maxSide: Int.max / 2)
    } catch {
        return nil
    }
}

// MARK: - The old app's algorithm (same numbers)

/// trimOnly: the photo already has a see-through background; only trim it.
private func storyCutPixels(_ src: StoryPixels, removeShadow: Bool, trimOnly: Bool) -> StoryPixels? {
    let w = src.w, h = src.h
    if w < 8 || h < 8 { return nil }
    let n = w * h
    guard src.px.count == n * 4 else { return nil }
    let p = UnsafeMutablePointer<UInt8>.allocate(capacity: n * 4)
    defer { p.deallocate() }
    src.px.withUnsafeBufferPointer { b in
        if let base = b.baseAddress { p.initialize(from: base, count: n * 4) }
    }

    // Background colour: the average of the four corners.
    let s = min(w, h) / 40 + 2
    func corner(_ x0: Int, _ y0: Int) -> [Double] {
        var r = 0.0, g = 0.0, b = 0.0, a = 0.0, c = 0.0
        var y = y0
        while y < y0 + s && y < h {
            var x = x0
            while x < x0 + s && x < w {
                let i = (y * w + x) * 4
                r += Double(p[i]); g += Double(p[i + 1]); b += Double(p[i + 2]); a += Double(p[i + 3])
                c += 1
                x += 1
            }
            y += 1
        }
        let d = max(c, 1)
        return [r / d, g / d, b / d, a / d]
    }

    let cs = [corner(0, 0), corner(w - s, 0), corner(0, h - s), corner(w - s, h - s)]
    let transparentAlready = trimOnly || cs.allSatisfy { $0[3] < 40 }
    let bg0 = cs.reduce(0.0) { $0 + $1[0] } / 4
    let bg1 = cs.reduce(0.0) { $0 + $1[1] } / 4
    let bg2 = cs.reduce(0.0) { $0 + $1[2] } / 4
    var spread = 0.0
    for c in cs {
        let d = abs(c[0] - bg0) + abs(c[1] - bg1) + abs(c[2] - bg2)
        if d > spread { spread = d }
    }
    // A plain studio background: the four corners have (nearly) the same colour.
    let plain = !trimOnly && !transparentAlready && spread < 36

    func lum(_ i: Int) -> Double { Double(p[i]) * 0.3 + Double(p[i + 1]) * 0.59 + Double(p[i + 2]) * 0.11 }

    if plain {
        let t1 = 22.0 // this close to the background: fully see-through
        let t2 = 52.0 // up to here: partly see-through (soft edges)
        func dist(_ i: Int) -> Double {
            (abs(Double(p[i]) - bg0) + abs(Double(p[i + 1]) - bg1) + abs(Double(p[i + 2]) - bg2)) / 1.4
        }

        let seen = UnsafeMutablePointer<UInt8>.allocate(capacity: n)
        seen.initialize(repeating: 0, count: n)
        defer { seen.deallocate() }
        let qcap = n * 2
        let queue = UnsafeMutablePointer<Int>.allocate(capacity: qcap)
        queue.initialize(repeating: 0, count: qcap)
        defer { queue.deallocate() }
        var head = 0, tail = 0

        // Shine and white rims on the piece are lighter than the backdrop:
        // keep them (unless the backdrop is pure white, where nothing is lighter).
        let bgLum = bg0 * 0.3 + bg1 * 0.59 + bg2 * 0.11
        // How grainy the backdrop is, so grain is never mistaken for shine.
        var sum = 0.0, sq = 0.0, cnt = 0.0
        let cn = min(w, h) / 12 + 4
        var gy = 2
        while gy < cn && gy < h {
            var gx = 2
            while gx < cn && gx < w {
                let l = lum((gy * w + gx) * 4)
                sum += l
                sq += l * l
                cnt += 1
                gx += 1
            }
            gy += 1
        }
        let mean = sum / max(cnt, 1)
        let grain = (min(max(sq / max(cnt, 1) - mean * mean, 0), 1e9)).squareRoot()
        let shine = 3 + grain * 3.5
        func lighter(_ i: Int) -> Bool { bgLum < 248 && lum(i) > bgLum + shine }

        func push(_ x: Int, _ y: Int) {
            let k = y * w + x
            if seen[k] != 0 { return }
            let d = dist(k * 4)
            if d >= t2 { return }
            if lighter(k * 4) { return }
            seen[k] = 1
            if tail < qcap { queue[tail] = k; tail += 1 }
        }

        // The outer 2 pixels are often a white or dark line from the photo's
        // edge: always backdrop. Start from just inside them.
        for y in 0..<h {
            for x in 0..<w where x < 2 || y < 2 || x >= w - 2 || y >= h - 2 {
                let k = y * w + x
                seen[k] = 1
                p[k * 4 + 3] = 0
            }
        }
        for x in 2..<(w - 2) {
            push(x, 2)
            push(x, h - 3)
        }
        for y in 2..<(h - 2) {
            push(2, y)
            push(w - 3, y)
        }
        while head < tail {
            let k = queue[head]
            head += 1
            let x = k % w, y = k / w
            let d = dist(k * 4)
            let a: Int = d <= t1 ? 0 : min(max(Int(((d - t1) / (t2 - t1) * 255).rounded()), 0), 255)
            p[k * 4 + 3] = UInt8(a)
            // Spread only through clear background, not through the soft edge.
            if d < (t1 + t2) / 2 {
                if x > 0 { push(x - 1, y) }
                if x < w - 1 { push(x + 1, y) }
                if y > 0 { push(x, y - 1) }
                if y < h - 1 { push(x, y + 1) }
            }
        }

        // Soft shadows under the piece: grey (no colour), darker than the
        // background, and changing smoothly (a piece's edge changes sharply).
        if removeShadow {
            func chroma(_ i: Int) -> Int {
                let r = Int(p[i]), g = Int(p[i + 1]), b = Int(p[i + 2])
                return max(r, g, b) - min(r, g, b)
            }
            let bgL = bgLum
            let bgC = Int((max(bg0, bg1, bg2) - min(bg0, bg1, bg2)).rounded())
            head = 0
            tail = 0
            for k in 0..<n where seen[k] == 1 {
                if tail < qcap { queue[tail] = k; tail += 1 }
            }
            func grow(_ from: Int, _ k: Int) {
                let i = k * 4
                // new pixels, and the half see-through rim the first pass left
                if seen[k] == 2 || (seen[k] == 1 && p[i + 3] == 0) { return }
                let l = lum(i)
                if l > bgL + 4 || l < bgL - 120 { return }
                if chroma(i) - bgC > 14 { return }
                if abs(l - lum(from * 4)) > 6 { return }
                seen[k] = 2
                p[i + 3] = 0
                if tail < qcap { queue[tail] = k; tail += 1 }
            }
            while head < tail {
                let k = queue[head]
                head += 1
                let x = k % w, y = k / w
                if x > 0 { grow(k, k - 1) }
                if x < w - 1 { grow(k, k + 1) }
                if y > 0 { grow(k, k - w) }
                if y < h - 1 { grow(k, k + w) }
            }
        }

        // Lone specks left in the backdrop (photo noise): clear them.
        for _ in 0..<2 {
            for y in 1..<(h - 1) {
                for x in 1..<(w - 1) {
                    let k = y * w + x
                    if p[k * 4 + 3] == 0 { continue }
                    var clear = 0
                    for dy in -1...1 {
                        for dx in -1...1 where dx != 0 || dy != 0 {
                            if p[(k + dy * w + dx) * 4 + 3] == 0 { clear += 1 }
                        }
                    }
                    if clear >= 6 { p[k * 4 + 3] = 0 }
                }
            }
        }
    }

    // Trim the empty space around the piece.
    var minX = w, minY = h, maxX = -1, maxY = -1
    if plain || transparentAlready {
        for y in 0..<h {
            for x in 0..<w where p[(y * w + x) * 4 + 3] > 90 {
                if x < minX { minX = x }
                if x > maxX { maxX = x }
                if y < minY { minY = y }
                if y > maxY { maxY = y }
            }
        }
    }
    if maxX < 0 {
        minX = 0
        minY = 0
        maxX = w - 1
        maxY = h - 1
    }
    let pad = max(maxX - minX, maxY - minY) / 40
    minX = min(max(minX - pad, 0), w - 1)
    minY = min(max(minY - pad, 0), h - 1)
    maxX = min(max(maxX + pad, 0), w - 1)
    maxY = min(max(maxY + pad, 0), h - 1)
    let cw = maxX - minX + 1, ch = maxY - minY + 1
    var out = [UInt8](repeating: 0, count: cw * ch * 4)
    out.withUnsafeMutableBufferPointer { ob in
        guard let base = ob.baseAddress else { return }
        for y in 0..<ch {
            let from = ((minY + y) * w + minX) * 4
            memcpy(base + y * cw * 4, p + from, cw * 4)
        }
    }
    return StoryPixels(px: out, w: cw, h: ch)
}
