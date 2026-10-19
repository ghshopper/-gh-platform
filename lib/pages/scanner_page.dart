import 'package:flutter/cupertino.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../data/store.dart';
import '../models.dart';
import '../ui/colors.dart';
import '../ui/kit.dart';
import 'order_detail_page.dart';

/// Full-screen camera that returns the first QR / barcode it reads.
class ScannerPage extends StatefulWidget {
  const ScannerPage({super.key, this.title = 'امسح البوليصة'});

  final String title;

  @override
  State<ScannerPage> createState() => _ScannerPageState();
}

class _ScannerPageState extends State<ScannerPage> {
  final _controller = MobileScannerController(
    detectionSpeed: DetectionSpeed.noDuplicates,
    formats: const [BarcodeFormat.qrCode, BarcodeFormat.code128],
  );
  bool _done = false;
  bool _torch = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_done) return;
    for (final b in capture.barcodes) {
      final v = b.rawValue;
      if (v != null && v.isNotEmpty) {
        _done = true;
        Navigator.pop(context, v);
        return;
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return CupertinoPageScaffold(
      backgroundColor: const Color(0xFF000000),
      navigationBar: CupertinoNavigationBar(
        backgroundColor: const Color(0xCC000000),
        border: null,
        transitionBetweenRoutes: false,
        middle: Text(widget.title,
            style: const TextStyle(color: CupertinoColors.white)),
        leading: CupertinoButton(
          padding: EdgeInsets.zero,
          onPressed: () => Navigator.pop(context),
          child: const Text('إلغاء', style: TextStyle(color: CupertinoColors.white)),
        ),
        trailing: CupertinoButton(
          padding: EdgeInsets.zero,
          onPressed: () {
            _controller.toggleTorch();
            setState(() => _torch = !_torch);
          },
          child: Icon(
              _torch ? CupertinoIcons.bolt_fill : CupertinoIcons.bolt_slash,
              color: CupertinoColors.white),
        ),
      ),
      child: Stack(
        fit: StackFit.expand,
        children: [
          MobileScanner(controller: _controller, onDetect: _onDetect),
          Center(
            child: Container(
              width: 250,
              height: 250,
              decoration: BoxDecoration(
                border: Border.all(color: GH.gold, width: 3),
                borderRadius: BorderRadius.circular(24),
              ),
            ),
          ),
          const Positioned(
            left: 0,
            right: 0,
            bottom: 70,
            child: Text(
              'وجّه الكاميرا على كود الفاتورة أو البوليصة',
              textAlign: TextAlign.center,
              style: TextStyle(color: CupertinoColors.white, fontSize: 16),
            ),
          ),
        ],
      ),
    );
  }
}

/// Opens the scanner and returns the scanned text (or null).
Future<String?> scanCode(BuildContext context, {String? title}) {
  return Navigator.of(context, rootNavigator: true).push<String>(
    CupertinoPageRoute(
      fullscreenDialog: true,
      builder: (_) => ScannerPage(title: title ?? 'امسح البوليصة'),
    ),
  );
}

/// Pulls the tracking token (a UUID) out of a scanned waybill QR.
String? tokenFromCode(String code) =>
    RegExp(r'[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}')
        .firstMatch(code)
        ?.group(0)
        ?.toLowerCase();

/// Finds the order a scanned (or typed) code points to, from the loaded
/// orders: the invoice / waybill QR (…/track/?t=<token>), the bare tracking
/// token, the invoice ref (GH-…) or the order number (201001).
Order? orderFromCode(String code) {
  final c = code.trim();
  if (c.isEmpty) return null;
  final store = Store.i;
  String? t;
  try {
    t = Uri.tryParse(c)?.queryParameters['t'];
  } catch (_) {}
  t ??= tokenFromCode(c);
  if (t != null) {
    final o = store.orderByToken(t.toLowerCase()) ?? store.orderByToken(t);
    if (o != null) return o;
  }
  final upper = c.toUpperCase();
  for (final o in store.orders) {
    if ((o.refNo ?? '').toUpperCase() == upper || o.invoiceNo.toUpperCase() == upper) return o;
    if (o.waybillNo == upper) return o;
    if (o.storeOrderNumber != null && o.storeOrderNumber!.toUpperCase() == upper) return o;
  }
  final digits = RegExp(r'\d{3,}').allMatches(c).map((m) => m.group(0)!).toList();
  for (final d in digits.reversed) {
    final n = int.tryParse(d);
    for (final o in store.orders) {
      if (o.orderNo == n) return o;
      if ((o.refNo ?? '').replaceAll(RegExp(r'\D'), '') == d) return o;
    }
  }
  return null;
}

/// Scan button action: opens the camera, then the order it finds.
Future<void> scanAndOpen(BuildContext context) async {
  final code = await scanCode(context, title: 'امسح كود الطلب');
  if (code == null || !context.mounted) return;
  final o = orderFromCode(code);
  if (o == null) {
    toast(context, 'ما لقينا طلب لهذا الكود', error: true);
    return;
  }
  pushPage(context, OrderDetailPage(orderId: o.id));
}
