import 'dart:typed_data';

import 'package:flutter/services.dart' show rootBundle;
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

import 'config.dart';
import 'format.dart';
import 'models.dart';

/// Waybill / shipping label, 100 × 150 mm (standard label-printer size).
/// The QR is the order's tracking link: the driver scans it to pick the
/// parcel up, and a customer who scans it sees the tracking page.
Future<Uint8List> buildWaybillPdf(
    Order o, Customer? customer, BusinessSettings biz, {String? driverName}) async {
  final regular = pw.Font.ttf(
      await rootBundle.load('assets/fonts/IBMPlexSansArabic-Regular.ttf'));
  final medium = pw.Font.ttf(
      await rootBundle.load('assets/fonts/IBMPlexSansArabic-Medium.ttf'));
  final bold = pw.Font.ttf(
      await rootBundle.load('assets/fonts/IBMPlexSansArabic-Bold.ttf'));
  final logo = pw.MemoryImage(
      (await rootBundle.load('assets/images/logo.png')).buffer.asUint8List());

  const ink = PdfColors.black;
  final muted = PdfColor.fromHex('#555555');

  pw.TextStyle st(double size, {pw.Font? font, PdfColor? color}) =>
      pw.TextStyle(fontSize: size, font: font ?? regular, color: color ?? ink);

  final waybill = o.waybillNo;
  final trackUrl = o.trackingToken == null
      ? 'https://ghshopper.com'
      : '${AppConfig.trackingBaseUrl}${o.trackingToken}';
  final collect = o.toCollect > 0;
  final pieces = o.activeItems.length;
  final method = o.deliveryMethod;

  // A Genacom office pickup is written first in the address by the server.
  String? office;
  String? address = o.deliveryAddress ?? customer?.address;
  final m = RegExp(r'^استلام من مكتب جيناكم: ([^،]+?)(?: \(([^)]*)\))?(?:،|$)')
      .firstMatch(address ?? '');
  if (m != null) {
    office = m.group(1);
    address = address!.substring(m.end).trim();
    if (address.isEmpty) address = null;
  }

  // Big band at the top: how this parcel travels (what the packer sorts by).
  final (String routeAr, String routeEn) = switch (method) {
    DeliveryMethod.genacomOffice || DeliveryMethod.noolOffice => (
        'استلام من مكتب ${method!.carrierName}${office != null ? ' · $office' : ''}',
        'OFFICE PICKUP'
      ),
    DeliveryMethod.genacom || DeliveryMethod.nool => (
        '${method!.carrierName} · لباب البيت',
        'COURIER · DOOR'
      ),
    _ => ('مندوب GH · لباب البيت', 'GH DRIVER · DOOR'),
  };

  pw.Widget rule({double t = 0.6}) =>
      pw.Container(height: t, color: ink, margin: const pw.EdgeInsets.symmetric(vertical: 5));

  pw.Widget kicker(String ar, String en) => pw.Row(children: [
        pw.Text(en, style: st(5.6, color: muted).copyWith(letterSpacing: 1.4)),
        pw.SizedBox(width: 4),
        pw.Text(ar, style: st(6.8, font: medium, color: muted)),
      ]);

  final doc = pw.Document(
    title: 'Waybill $waybill',
    theme: pw.ThemeData.withFont(base: regular, bold: bold),
  );

  doc.addPage(pw.Page(
    pageFormat: const PdfPageFormat(100 * PdfPageFormat.mm, 150 * PdfPageFormat.mm,
        marginAll: 4.5 * PdfPageFormat.mm),
    textDirection: pw.TextDirection.rtl,
    build: (context) => pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.stretch,
      children: [
        // Brand and label title
        pw.Row(
          crossAxisAlignment: pw.CrossAxisAlignment.center,
          children: [
            pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Text('بوليصة شحن', style: st(11, font: bold)),
                pw.Text('SHIPPING LABEL', style: st(5.8, color: muted).copyWith(letterSpacing: 1.6)),
              ],
            ),
            pw.Spacer(),
            pw.Image(logo, height: 30),
          ],
        ),
        rule(t: 1.2),
        // How it travels
        pw.Container(
          color: ink,
          padding: const pw.EdgeInsets.symmetric(horizontal: 8, vertical: 6),
          child: pw.Row(children: [
            pw.Expanded(
              child: pw.Text(routeAr,
                  style: st(12.5, font: bold, color: PdfColors.white), maxLines: 2),
            ),
            pw.SizedBox(width: 6),
            pw.Text(routeEn,
                textDirection: pw.TextDirection.ltr,
                style: st(6, color: PdfColors.white).copyWith(letterSpacing: 1.2)),
          ]),
        ),
        pw.SizedBox(height: 7),
        // Recipient and QR
        pw.Row(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Expanded(
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  kicker('المستلم', 'SHIP TO'),
                  pw.SizedBox(height: 3),
                  pw.Text(customer?.name ?? '—', style: st(15, font: bold), maxLines: 2),
                  if (customer?.phone != null)
                    pw.Text(customer!.phone!,
                        textDirection: pw.TextDirection.ltr,
                        style: st(14, font: medium)),
                  pw.SizedBox(height: 3),
                  if (office != null)
                    pw.Text('يستلم من مكتب جيناكم $office', style: st(9, font: bold), maxLines: 2)
                  else if (customer?.city != null)
                    pw.Text(customer!.city!, style: st(10, font: bold)),
                  if (address != null)
                    pw.Text(address, style: st(8.2), maxLines: 4),
                ],
              ),
            ),
            pw.SizedBox(width: 8),
            pw.Column(children: [
              pw.BarcodeWidget(
                barcode: pw.Barcode.qrCode(),
                data: trackUrl,
                width: 74,
                height: 74,
              ),
              pw.SizedBox(height: 3),
              pw.Text('امسح للتتبّع', style: st(6, color: muted)),
            ]),
          ],
        ),
        rule(),
        // Cash to collect / prepaid
        pw.Container(
          padding: const pw.EdgeInsets.symmetric(horizontal: 8, vertical: 6),
          decoration: pw.BoxDecoration(
            color: collect ? ink : null,
            border: pw.Border.all(color: ink, width: 1),
          ),
          child: pw.Row(children: [
            pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Text(collect ? 'حصّل عند التسليم' : 'مدفوع · لا تحصّل شيء',
                    style: st(10.5, font: bold, color: collect ? PdfColors.white : ink)),
                pw.Text(collect ? 'CASH ON DELIVERY' : 'PREPAID',
                    style: st(5.8, color: collect ? PdfColors.white : muted).copyWith(letterSpacing: 1.4)),
              ],
            ),
            pw.Spacer(),
            if (collect)
              pw.Text(omrLatin(o.toCollect),
                  textDirection: pw.TextDirection.ltr,
                  style: st(16, font: bold, color: PdfColors.white)),
          ]),
        ),
        pw.SizedBox(height: 7),
        // Order facts
        pw.Row(children: [
          pw.Expanded(
            child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
              kicker('الفاتورة', 'INVOICE'),
              pw.Text(o.invoiceNo, textDirection: pw.TextDirection.ltr, style: st(9, font: medium)),
            ]),
          ),
          pw.Expanded(
            child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
              kicker('القطع', 'PIECES'),
              pw.Text('$pieces', style: st(9, font: medium)),
            ]),
          ),
          pw.Expanded(
            child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
              kicker('التاريخ', 'DATE'),
              pw.Text(dateStr(o.createdAt), style: st(9, font: medium)),
            ]),
          ),
        ]),
        if (o.carrierTracking != null && !o.carrierIsLink) ...[
          pw.SizedBox(height: 5),
          pw.Row(children: [
            kicker('رقم الشحنة', 'SHIPMENT'),
            pw.Spacer(),
            pw.Text(o.carrierTracking!, textDirection: pw.TextDirection.ltr, style: st(9.5, font: bold)),
          ]),
        ],
        if (driverName != null || o.driverNote != null) ...[
          pw.SizedBox(height: 5),
          if (driverName != null) pw.Text('المندوب: $driverName', style: st(8, font: medium)),
          if (o.driverNote != null) pw.Text('ملاحظة: ${o.driverNote}', style: st(8, font: medium), maxLines: 2),
        ],
        pw.Spacer(),
        // Waybill barcode
        pw.BarcodeWidget(
          barcode: pw.Barcode.code128(),
          data: waybill,
          height: 36,
          drawText: false,
        ),
        pw.SizedBox(height: 2),
        pw.Center(
          child: pw.Text(waybill,
              textDirection: pw.TextDirection.ltr,
              style: st(13, font: bold).copyWith(letterSpacing: 2)),
        ),
        rule(t: 1.2),
        // Sender
        pw.Row(children: [
          kicker('المرسل', 'FROM'),
          pw.SizedBox(width: 6),
          pw.Expanded(
            child: pw.Text(
              [
                biz.companyName ?? 'GH Shopper',
                if (biz.phone != null) biz.phone!,
                if (biz.instagram != null) biz.instagram!,
              ].join('  ·  '),
              style: st(7.5, font: medium),
              maxLines: 1,
            ),
          ),
        ]),
      ],
    ),
  ));

  return doc.save();
}

/// Opens the iOS print sheet (AirPrint label printer, or Save as PDF).
Future<void> printWaybill(Order o, Customer? customer, BusinessSettings biz,
    {String? driverName}) async {
  await Printing.layoutPdf(
    name: 'Waybill ${o.waybillNo}',
    format: const PdfPageFormat(100 * PdfPageFormat.mm, 150 * PdfPageFormat.mm),
    onLayout: (_) => buildWaybillPdf(o, customer, biz, driverName: driverName),
  );
}
