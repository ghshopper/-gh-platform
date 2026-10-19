import 'dart:async';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:http/http.dart' as http;

/// Brand photos come on a plain white or grey background. This takes the
/// background out (so the piece sits on the story's beige) and trims the
/// empty space around the piece, so it shows big.
///
/// Returns null when the photo can't be loaded; returns the photo trimmed but
/// untouched when its background isn't plain (a model, a street…).
Future<ImageProvider?> cutoutImage(String url, {bool removeShadow = true}) async {
  try {
    final uri = Uri.parse(url);
    final res = await http.get(uri, headers: {
      // like Safari, and no AVIF (the app can't read it)
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      'Accept': 'image/webp,image/png,image/jpeg,image/*;q=0.8',
      'Referer': '${uri.scheme}://${uri.host}/',
    }).timeout(const Duration(seconds: 30));
    if (res.statusCode != 200 || res.bodyBytes.isEmpty) return null;
    return await cutoutBytes(res.bodyBytes, removeShadow: removeShadow);
  } catch (_) {
    return null;
  }
}

Future<ImageProvider?> cutoutBytes(Uint8List bytes, {bool removeShadow = true}) async {
  final buffer = await ui.ImmutableBuffer.fromUint8List(bytes);
  final desc = await ui.ImageDescriptor.encoded(buffer);
  // Big enough for a 1080 story, small enough to be quick.
  const maxSide = 1400;
  final scale = desc.width > desc.height ? maxSide / desc.width : maxSide / desc.height;
  final codec = await desc.instantiateCodec(
    targetWidth: scale < 1 ? (desc.width * scale).round() : null,
    targetHeight: scale < 1 ? (desc.height * scale).round() : null,
  );
  final frame = await codec.getNextFrame();
  final img = frame.image;
  final raw = await img.toByteData(format: ui.ImageByteFormat.rawStraightRgba);
  final w = img.width, h = img.height;
  img.dispose();
  if (raw == null) return null;

  final out = await compute(_cut, _Job(raw.buffer.asUint8List(), w, h, removeShadow));
  if (out == null) return null;

  final completer = Completer<ui.Image>();
  ui.decodeImageFromPixels(out.rgba, out.w, out.h, ui.PixelFormat.rgba8888, completer.complete);
  final cut = await completer.future;
  final png = await cut.toByteData(format: ui.ImageByteFormat.png);
  cut.dispose();
  if (png == null) return null;
  return MemoryImage(png.buffer.asUint8List());
}

class _Job {
  _Job(this.rgba, this.w, this.h, this.removeShadow);
  final Uint8List rgba;
  final int w;
  final int h;
  final bool removeShadow;
}

class _Out {
  _Out(this.rgba, this.w, this.h);
  final Uint8List rgba;
  final int w;
  final int h;
}

_Out? _cut(_Job job) {
  final p = Uint8List.fromList(job.rgba);
  final w = job.w, h = job.h;
  if (w < 8 || h < 8) return null;

  // Background colour: the average of the four corners.
  List<double> corner(int x0, int y0) {
    var r = 0.0, g = 0.0, b = 0.0, a = 0.0, n = 0;
    final s = (w < h ? w : h) ~/ 40 + 2;
    for (var y = y0; y < y0 + s && y < h; y++) {
      for (var x = x0; x < x0 + s && x < w; x++) {
        final i = (y * w + x) * 4;
        r += p[i];
        g += p[i + 1];
        b += p[i + 2];
        a += p[i + 3];
        n++;
      }
    }
    return [r / n, g / n, b / n, a / n];
  }

  final s = (w < h ? w : h) ~/ 40 + 2;
  final cs = [corner(0, 0), corner(w - s, 0), corner(0, h - s), corner(w - s, h - s)];
  final transparentAlready = cs.every((c) => c[3] < 40);
  final bg = [0, 1, 2].map((k) => cs.fold<double>(0, (t, c) => t + c[k]) / 4).toList();
  double spread = 0;
  for (final c in cs) {
    final d = (c[0] - bg[0]).abs() + (c[1] - bg[1]).abs() + (c[2] - bg[2]).abs();
    if (d > spread) spread = d;
  }
  // A plain studio background: the four corners have (nearly) the same colour.
  final plain = !transparentAlready && spread < 36;

  if (plain) {
    const t1 = 22.0; // this close to the background: fully see-through
    const t2 = 52.0; // up to here: partly see-through (soft edges)
    double dist(int i) {
      final dr = p[i] - bg[0], dg = p[i + 1] - bg[1], db = p[i + 2] - bg[2];
      return (dr.abs() + dg.abs() + db.abs()) / 1.4;
    }

    final seen = Uint8List(w * h);
    final queue = Int32List(w * h);
    var head = 0, tail = 0;
    // Shine and white rims on the piece are lighter than the backdrop:
    // keep them (unless the backdrop is pure white, where nothing is lighter).
    final bgLum = bg[0] * 0.3 + bg[1] * 0.59 + bg[2] * 0.11;
    bool lighter(int i) => bgLum < 248 && p[i] * 0.3 + p[i + 1] * 0.59 + p[i + 2] * 0.11 > bgLum + 5;

    void push(int x, int y) {
      final k = y * w + x;
      if (seen[k] != 0) return;
      final d = dist(k * 4);
      if (d >= t2) return;
      // backdrop noise is always taken; only clearly lighter pixels are kept
      if (d > t1 && lighter(k * 4)) return;
      seen[k] = 1;
      queue[tail++] = k;
    }

    for (var x = 0; x < w; x++) {
      push(x, 0);
      push(x, h - 1);
    }
    for (var y = 0; y < h; y++) {
      push(0, y);
      push(w - 1, y);
    }
    while (head < tail) {
      final k = queue[head++];
      final x = k % w, y = k ~/ w;
      final d = dist(k * 4);
      final a = d <= t1 ? 0 : ((d - t1) / (t2 - t1) * 255).round().clamp(0, 255);
      p[k * 4 + 3] = a;
      // Spread only through clear background, not through the soft edge.
      if (d < (t1 + t2) / 2) {
        if (x > 0) push(x - 1, y);
        if (x < w - 1) push(x + 1, y);
        if (y > 0) push(x, y - 1);
        if (y < h - 1) push(x, y + 1);
      }
    }

    // Soft shadows under the piece: grey (no colour), darker than the
    // background, and changing smoothly (a piece's edge changes sharply).
    if (job.removeShadow) {
      double lum(int i) => (p[i] * 0.3 + p[i + 1] * 0.59 + p[i + 2] * 0.11);
      int chroma(int i) {
        final r = p[i], g = p[i + 1], b = p[i + 2];
        final mx = r > g ? (r > b ? r : b) : (g > b ? g : b);
        final mn = r < g ? (r < b ? r : b) : (g < b ? g : b);
        return mx - mn;
      }

      final bgL = bg[0] * 0.3 + bg[1] * 0.59 + bg[2] * 0.11;
      final bgC = (bg.reduce((a, b) => a > b ? a : b) - bg.reduce((a, b) => a < b ? a : b)).round();
      head = 0;
      tail = 0;
      for (var k = 0; k < w * h; k++) {
        if (seen[k] == 1) queue[tail++] = k;
      }
      void grow(int from, int k) {
        final i = k * 4;
        // new pixels, and the half see-through rim the first pass left
        if (seen[k] == 2 || (seen[k] == 1 && p[i + 3] == 0)) return;
        final l = lum(i);
        if (l > bgL + 4 || l < bgL - 120) return;
        if (chroma(i) - bgC > 14) return;
        if ((l - lum(from * 4)).abs() > 6) return;
        seen[k] = 2;
        p[i + 3] = 0;
        queue[tail++] = k;
      }

      while (head < tail) {
        final k = queue[head++];
        final x = k % w, y = k ~/ w;
        if (x > 0) grow(k, k - 1);
        if (x < w - 1) grow(k, k + 1);
        if (y > 0) grow(k, k - w);
        if (y < h - 1) grow(k, k + w);
      }
    }
  }

  // Trim the empty space around the piece.
  var minX = w, minY = h, maxX = -1, maxY = -1;
  if (plain || transparentAlready) {
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        if (p[(y * w + x) * 4 + 3] > 90) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
  }
  if (maxX < 0) {
    minX = 0;
    minY = 0;
    maxX = w - 1;
    maxY = h - 1;
  }
  final pad = ((maxX - minX) > (maxY - minY) ? (maxX - minX) : (maxY - minY)) ~/ 40;
  minX = (minX - pad).clamp(0, w - 1);
  minY = (minY - pad).clamp(0, h - 1);
  maxX = (maxX + pad).clamp(0, w - 1);
  maxY = (maxY + pad).clamp(0, h - 1);
  final cw = maxX - minX + 1, ch = maxY - minY + 1;
  final out = Uint8List(cw * ch * 4);
  for (var y = 0; y < ch; y++) {
    final from = ((minY + y) * w + minX) * 4;
    out.setRange(y * cw * 4, (y + 1) * cw * 4, p, from);
  }
  return _Out(out, cw, ch);
}
