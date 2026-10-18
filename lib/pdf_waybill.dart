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
  final collect = o.deliveryCollect && o.deliveryFee > 0;
  final address = o.deliveryAddress ?? customer?.address;
  final pieces = o.activeItems.length;

  pw.Widget box(pw.Widget child, {PdfColor? fill}) => pw.Container(
        width: double.infinity,
        padding: const pw.EdgeInsets.all(7),
        decoration: pw.BoxDecoration(
          color: fill,
          border: pw.Border.all(color: ink, width: 1),
        ),
        child: child,
      );

  pw.Widget label(String ar, String en) => pw.Row(children: [
        pw.Text(ar, style: st(7.5, font: bold)),
        pw.SizedBox(width: 4),
        pw.Text(en, style: st(6, color: muted)),
      ]);

  final doc = pw.Document(
    title: 'Waybill $waybill',
    theme: pw.ThemeData.withFont(base: regular, bold: bold),
  );

  doc.addPage(pw.Page(
    pageFormat: const PdfPageFormat(100 * PdfPageFormat.mm, 150 * PdfPageFormat.mm,
        marginAll: 4 * PdfPageFormat.mm),
    textDirection: pw.TextDirection.rtl,
    build: (context) => pw.Column(
      crossAxisAlignment: pw.CrossAxisAlignment.stretch,
      children: [
        // Header: brand + waybill number
        pw.Row(
          crossAxisAlignment: pw.CrossAxisAlignment.center,
          children: [
            pw.Image(logo, height: 34),
            pw.Spacer(),
            pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.end,
              children: [
                pw.Text('بوليصة شحن', style: st(9, font: bold)),
                pw.Text('WAYBILL', style: st(6, color: muted)),
              ],
            ),
          ],
        ),
        pw.SizedBox(height: 4),
        // Barcode of the waybill number
        box(pw.Column(children: [
          pw.BarcodeWidget(
            barcode: pw.Barcode.code128(),
            data: waybill,
            height: 34,
            drawText: false,
          ),
          pw.SizedBox(height: 2),
          pw.Text(waybill,
              textDirection: pw.TextDirection.ltr,
              style: st(13, font: bold)),
        ])),
        pw.SizedBox(height: 4),
        // Recipient + QR
        box(pw.Row(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Expanded(
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  label('إلى', 'TO'),
                  pw.SizedBox(height: 2),
                  pw.Text(customer?.name ?? '—', style: st(12, font: bold)),
                  if (customer?.phone != null)
                    pw.Text(customer!.phone!,
                        textDirection: pw.TextDirection.ltr,
                        style: st(11, font: medium)),
                  if (customer?.city != null)
                    pw.Text(customer!.city!, style: st(9, font: medium)),
                  if (address != null)
                    pw.Text(address, style: st(8), maxLines: 4),
                ],
              ),
            ),
            pw.SizedBox(width: 6),
            pw.Column(children: [
              pw.BarcodeWidget(
                barcode: pw.Barcode.qrCode(),
                data: trackUrl,
                width: 78,
                height: 78,
              ),
              pw.SizedBox(height: 2),
              pw.Text('امسح للتتبّع', style: st(6, color: muted)),
            ]),
          ],
        )),
        pw.SizedBox(height: 4),
        // Cash to collect
        box(
          pw.Row(children: [
            pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Text(collect ? 'حصّل عند التسليم' : 'التوصيل مدفوع',
                    style: st(10, font: bold,
                        color: collect ? PdfColors.white : ink)),
                pw.Text(collect ? 'CASH ON DELIVERY' : 'PREPAID',
                    style: st(6, color: collect ? PdfColors.white : muted)),
              ],
            ),
            pw.Spacer(),
            if (collect)
              pw.Text(omrLatin(o.deliveryFee),
                  textDirection: pw.TextDirection.ltr,
                  style: st(15, font: bold, color: PdfColors.white)),
          ]),
          fill: collect ? ink : null,
        ),
        pw.SizedBox(height: 4),
        // Details
        box(pw.Column(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            if (o.deliveryMethod != null)
              pw.Padding(
                padding: const pw.EdgeInsets.only(bottom: 3),
                child: pw.Row(children: [
                  pw.Text('التوصيل: ${o.deliveryMethod!.label}',
                      style: st(10, font: bold)),
                  pw.Spacer(),
                  if (o.carrierTracking != null && !o.carrierIsLink)
                    pw.Text(o.carrierTracking!,
                        textDirection: pw.TextDirection.ltr,
                        style: st(9, font: medium)),
                ]),
              ),
            pw.Row(children: [
              pw.Expanded(child: label('الفاتورة', o.invoiceNo)),
              pw.Text('$pieces قطعة', style: st(8, font: medium)),
            ]),
            pw.SizedBox(height: 2),
            pw.Row(children: [
              pw.Expanded(
                  child: pw.Text('التاريخ ${dateStr(o.createdAt)}',
                      style: st(7.5, color: muted))),
              if (driverName != null)
                pw.Text('المندوب: $driverName', style: st(7.5, font: medium)),
            ]),
            if (o.driverNote != null) ...[
              pw.SizedBox(height: 3),
              pw.Text('ملاحظة: ${o.driverNote}', style: st(8, font: medium)),
            ],
          ],
        )),
        pw.Spacer(),
        // Sender
        pw.Divider(color: ink, thickness: 0.7),
        pw.Row(children: [
          label('من', 'FROM'),
          pw.SizedBox(width: 6),
          pw.Expanded(
            child: pw.Text(
              [
                biz.companyName ?? 'GH Shopper',
                if (biz.phone != null) biz.phone!,
                if (biz.instagram != null) biz.instagram!,
              ].join('  ·  '),
              style: st(7.5, font: medium),
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
