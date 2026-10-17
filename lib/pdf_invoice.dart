import 'dart:typed_data';

import 'package:flutter/services.dart' show rootBundle;
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

import 'format.dart';
import 'models.dart';

final _burgundy = PdfColor.fromHex('#5A0F1C');
final _gold = PdfColor.fromHex('#B08A45');
final _sand = PdfColor.fromHex('#EAD7C0');
final _muted = PdfColor.fromHex('#8A6A3A');
final _ink = PdfColor.fromHex('#3A0610');
final _cream = PdfColor.fromHex('#FBF7F0');

Future<pw.Font> _font(String path) async =>
    pw.Font.ttf(await rootBundle.load(path));

/// Builds the bilingual (Arabic / English) customer invoice.
Future<Uint8List> buildInvoicePdf(Order o) async {
  final regular = await _font('assets/fonts/Tajawal-Regular.ttf');
  final bold = await _font('assets/fonts/Tajawal-Bold.ttf');
  final ruqaa = await _font('assets/fonts/ArefRuqaa-Bold.ttf');
  final logoBytes = await rootBundle.load('assets/images/logo.png');
  final logo = pw.MemoryImage(logoBytes.buffer.asUint8List());

  final doc = pw.Document(
    title: 'GH Shopper ${o.invoiceNo}',
    author: 'GH Shopper',
    theme: pw.ThemeData.withFont(base: regular, bold: bold),
  );

  pw.Widget label(String ar, String en, {bool strong = false}) => pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Text(ar,
              style: pw.TextStyle(
                  fontSize: strong ? 11 : 10,
                  font: strong ? bold : regular,
                  color: _ink)),
          pw.Text(en, style: pw.TextStyle(fontSize: 7, color: _muted)),
        ],
      );

  pw.Widget totalRow(String ar, String en, double value,
          {bool strong = false}) =>
      pw.Padding(
        padding: const pw.EdgeInsets.symmetric(vertical: 3),
        child: pw.Row(
          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
          crossAxisAlignment: pw.CrossAxisAlignment.center,
          children: [
            label(ar, en, strong: strong),
            pw.Text(omrLatin(value),
                style: pw.TextStyle(
                    fontSize: strong ? 12 : 10,
                    font: strong ? bold : regular,
                    color: _ink)),
          ],
        ),
      );

  final itemRows = <pw.Widget>[];
  for (var i = 0; i < o.activeItems.length; i++) {
    final it = o.activeItems[i];
    itemRows.add(pw.Container(
      padding: const pw.EdgeInsets.symmetric(vertical: 6),
      decoration: pw.BoxDecoration(
        border: pw.Border(bottom: pw.BorderSide(color: _sand, width: 0.6)),
      ),
      child: pw.Row(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.SizedBox(
            width: 16,
            child: pw.Text('${i + 1}',
                style: pw.TextStyle(fontSize: 9, color: _muted)),
          ),
          pw.Expanded(
            child: pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Text(it.name,
                    style: pw.TextStyle(fontSize: 10.5, font: bold, color: _ink)),
                if (it.details != null)
                  pw.Text(it.details!,
                      style: pw.TextStyle(fontSize: 8.5, color: _muted)),
              ],
            ),
          ),
          pw.SizedBox(width: 8),
          pw.Text(plainOmr(it.price),
              style: pw.TextStyle(fontSize: 10.5, color: _ink)),
        ],
      ),
    ));
  }

  doc.addPage(
    pw.MultiPage(
      pageFormat: PdfPageFormat.a5,
      margin: const pw.EdgeInsets.fromLTRB(30, 28, 30, 28),
      textDirection: pw.TextDirection.rtl,
      build: (context) => [
        // Header
        pw.Row(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
          children: [
            pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.Text('فاتورة',
                    style: pw.TextStyle(
                        font: ruqaa, fontSize: 26, color: _burgundy)),
                pw.Text('INVOICE',
                    style: pw.TextStyle(
                        fontSize: 8, letterSpacing: 3, color: _muted)),
                pw.SizedBox(height: 8),
                pw.Text(o.invoiceNo,
                    style: pw.TextStyle(fontSize: 11, font: bold, color: _ink)),
                pw.Text(dateStr(o.createdAt),
                    style: pw.TextStyle(fontSize: 9, color: _muted)),
              ],
            ),
            pw.Image(logo, width: 64, height: 64),
          ],
        ),
        pw.SizedBox(height: 14),
        // Customer
        pw.Container(
          padding: const pw.EdgeInsets.all(10),
          decoration: pw.BoxDecoration(
            color: _cream,
            borderRadius: pw.BorderRadius.circular(8),
            border: pw.Border.all(color: _sand, width: 0.8),
          ),
          child: pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            children: [
              label('العميلة', 'Customer'),
              pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.end,
                children: [
                  pw.Text(o.customerName,
                      style:
                          pw.TextStyle(fontSize: 11, font: bold, color: _ink)),
                  if (o.customer?.phone != null)
                    pw.Text(o.customer!.phone!,
                        style: pw.TextStyle(fontSize: 9, color: _muted)),
                ],
              ),
            ],
          ),
        ),
        pw.SizedBox(height: 14),
        // Items header
        pw.Container(
          padding: const pw.EdgeInsets.only(bottom: 4),
          decoration: pw.BoxDecoration(
            border: pw.Border(bottom: pw.BorderSide(color: _burgundy, width: 1)),
          ),
          child: pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            children: [
              label('القطعة', 'Item', strong: true),
              label('السعر', 'Price (OMR)', strong: true),
            ],
          ),
        ),
        ...itemRows,
        pw.SizedBox(height: 10),
        totalRow('مجموع القطع', 'Subtotal', o.itemsTotal),
        if (o.deliveryFee > 0) totalRow('التوصيل', 'Delivery', o.deliveryFee),
        pw.Divider(color: _sand, thickness: 0.8),
        totalRow('الإجمالي', 'Total', o.total, strong: true),
        if (o.payments.isNotEmpty) ...[
          pw.SizedBox(height: 10),
          pw.Text('الدفعات  ·  Payments',
              style: pw.TextStyle(fontSize: 10, font: bold, color: _burgundy)),
          pw.SizedBox(height: 4),
          ...o.payments.map(
            (p) => pw.Padding(
              padding: const pw.EdgeInsets.symmetric(vertical: 2),
              child: pw.Row(
                mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                children: [
                  pw.Text(
                      '${dateStr(p.paidOn)}${p.method == null ? '' : '  ·  ${p.method}'}${p.note == null ? '' : '  ·  ${p.note}'}',
                      style: pw.TextStyle(fontSize: 9, color: _ink)),
                  pw.Text(omrLatin(p.amount),
                      style: pw.TextStyle(fontSize: 9, color: _ink)),
                ],
              ),
            ),
          ),
          pw.SizedBox(height: 4),
          totalRow('المدفوع', 'Paid', o.paid),
        ],
        pw.SizedBox(height: 8),
        pw.Container(
          padding: const pw.EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: pw.BoxDecoration(
            color: _burgundy,
            borderRadius: pw.BorderRadius.circular(8),
          ),
          child: pw.Row(
            mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
            children: [
              pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Text('المتبقي',
                      style: pw.TextStyle(
                          fontSize: 11, font: bold, color: PdfColors.white)),
                  pw.Text('Balance due',
                      style: pw.TextStyle(fontSize: 7, color: _sand)),
                ],
              ),
              pw.Text(omrLatin(o.remaining < 0 ? 0 : o.remaining),
                  style: pw.TextStyle(
                      fontSize: 13, font: bold, color: PdfColors.white)),
            ],
          ),
        ),
        pw.SizedBox(height: 22),
        pw.Center(
          child: pw.Text('شكراً لثقتكِ',
              style: pw.TextStyle(font: ruqaa, fontSize: 18, color: _gold)),
        ),
        pw.Center(
          child: pw.Text('Thank you  ·  GH SHOPPER  ·  Muscat',
              style: pw.TextStyle(fontSize: 7.5, letterSpacing: 1.5, color: _muted)),
        ),
      ],
    ),
  );

  return doc.save();
}

/// Builds the invoice and opens the iOS share sheet (WhatsApp, Files, Print…).
Future<void> shareInvoice(Order o) async {
  final bytes = await buildInvoicePdf(o);
  await Printing.sharePdf(bytes: bytes, filename: '${o.invoiceNo}.pdf');
}
