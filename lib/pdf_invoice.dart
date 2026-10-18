import 'dart:typed_data';

import 'package:flutter/services.dart' show rootBundle;
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';

import 'format.dart';
import 'models.dart';

final _burgundy = PdfColor.fromHex('#5A0F1C');
final _ink = PdfColor.fromHex('#1C1C1E');
final _muted = PdfColor.fromHex('#6D6D72');
final _line = PdfColor.fromHex('#E5E5EA');
final _tint = PdfColor.fromHex('#F7F2EE');
final _gold = PdfColor.fromHex('#B08A45');

Future<pw.Font> _font(String path) async =>
    pw.Font.ttf(await rootBundle.load(path));

/// Builds the bilingual (Arabic / English) customer invoice.
Future<Uint8List> buildInvoicePdf(
    Order o, Customer? customer, BusinessSettings biz) async {
  final regular = await _font('assets/fonts/IBMPlexSansArabic-Regular.ttf');
  final medium = await _font('assets/fonts/IBMPlexSansArabic-Medium.ttf');
  final bold = await _font('assets/fonts/IBMPlexSansArabic-Bold.ttf');
  final logoBytes = await rootBundle.load('assets/images/logo.png');
  final logo = pw.MemoryImage(logoBytes.buffer.asUint8List());

  final doc = pw.Document(
    title: 'GH Shopper ${o.invoiceNo}',
    author: biz.companyName ?? 'GH Shopper',
    theme: pw.ThemeData.withFont(base: regular, bold: bold),
  );

  pw.TextStyle st(double size,
          {pw.Font? font, PdfColor? color, double? spacing}) =>
      pw.TextStyle(
          fontSize: size,
          font: font ?? regular,
          color: color ?? _ink,
          letterSpacing: spacing);

  pw.Widget twoLang(String ar, String en,
          {bool strong = false, PdfColor? color, double size = 9.5}) =>
      pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          pw.Text(ar,
              style: st(size, font: strong ? bold : medium, color: color)),
          pw.Text(en, style: st(6.5, color: _muted, spacing: 0.6)),
        ],
      );

  pw.Widget amountRow(String ar, String en, double v,
          {bool strong = false}) =>
      pw.Padding(
        padding: const pw.EdgeInsets.symmetric(vertical: 3.5),
        child: pw.Row(
          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
          children: [
            twoLang(ar, en, strong: strong),
            pw.Text(omrLatin(v),
                style: st(strong ? 11 : 9.5, font: strong ? bold : medium)),
          ],
        ),
      );

  final company = biz.companyName ?? 'GH Shopper';
  final companyEn = biz.companyNameEn;
  final contact = <String>[
    if (biz.phone != null) biz.phone!,
    if (biz.instagram != null) biz.instagram!,
  ].join('  ·  ');

  final items = o.activeItems;

  doc.addPage(
    pw.MultiPage(
      pageFormat: PdfPageFormat.a5,
      margin: const pw.EdgeInsets.fromLTRB(30, 30, 30, 26),
      textDirection: pw.TextDirection.rtl,
      footer: (ctx) => pw.Container(
        padding: const pw.EdgeInsets.only(top: 8),
        decoration: pw.BoxDecoration(
            border: pw.Border(top: pw.BorderSide(color: _line, width: 0.6))),
        child: pw.Row(
          mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
          children: [
            pw.Text(
              [
                company,
                if (biz.crNumber != null) 'س.ت ${biz.crNumber}',
                if (biz.taxNumber != null) 'الرقم الضريبي ${biz.taxNumber}',
                if (biz.address != null) biz.address!,
              ].join('  ·  '),
              style: st(7, color: _muted),
            ),
            pw.Text('${ctx.pageNumber}/${ctx.pagesCount}',
                style: st(7, color: _muted)),
          ],
        ),
      ),
      build: (ctx) => [
        // ── Header: company on one side, invoice title on the other
        pw.Row(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Image(logo, width: 52, height: 52),
            pw.SizedBox(width: 10),
            pw.Expanded(
              child: pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  pw.Text(company, style: st(12, font: bold)),
                  if (companyEn != null)
                    pw.Text(companyEn, style: st(8, color: _muted)),
                  if (biz.crNumber != null)
                    pw.Text('السجل التجاري  CR No. ${biz.crNumber}',
                        style: st(7.5, color: _muted)),
                  if (contact.isNotEmpty)
                    pw.Text(contact, style: st(7.5, color: _muted)),
                ],
              ),
            ),
            pw.Column(
              crossAxisAlignment: pw.CrossAxisAlignment.end,
              children: [
                pw.Text('فاتورة', style: st(18, font: bold, color: _burgundy)),
                pw.Text('INVOICE',
                    style: st(7, color: _muted, spacing: 2.5)),
              ],
            ),
          ],
        ),
        pw.SizedBox(height: 16),
        // ── Meta: number, date, customer
        pw.Container(
          padding: const pw.EdgeInsets.all(10),
          decoration: pw.BoxDecoration(
            color: _tint,
            borderRadius: pw.BorderRadius.circular(6),
          ),
          child: pw.Row(
            crossAxisAlignment: pw.CrossAxisAlignment.start,
            children: [
              pw.Expanded(
                child: pw.Column(
                  crossAxisAlignment: pw.CrossAxisAlignment.start,
                  children: [
                    twoLang('العميل', 'Bill to', size: 8),
                    pw.SizedBox(height: 3),
                    pw.Text(customer?.name ?? '—', style: st(10.5, font: bold)),
                    if (customer?.phone != null)
                      pw.Text(customer!.phone!, style: st(8.5, color: _muted)),
                  ],
                ),
              ),
              pw.Column(
                crossAxisAlignment: pw.CrossAxisAlignment.start,
                children: [
                  twoLang('رقم الفاتورة', 'Invoice no.', size: 8),
                  pw.Text(o.invoiceNo, style: st(10, font: bold)),
                  pw.SizedBox(height: 5),
                  twoLang('التاريخ', 'Date', size: 8),
                  pw.Text(dateStr(o.createdAt), style: st(9.5, font: medium)),
                ],
              ),
            ],
          ),
        ),
        pw.SizedBox(height: 16),
        // ── Items
        pw.Container(
          padding: const pw.EdgeInsets.symmetric(vertical: 5, horizontal: 6),
          decoration: pw.BoxDecoration(
            border: pw.Border(
                bottom: pw.BorderSide(color: _burgundy, width: 0.9)),
          ),
          child: pw.Row(
            children: [
              pw.SizedBox(width: 16, child: pw.Text('#', style: st(8, color: _muted))),
              pw.Expanded(child: twoLang('القطعة', 'Item', strong: true, size: 8.5)),
              twoLang('السعر', 'Price (OMR)', strong: true, size: 8.5),
            ],
          ),
        ),
        ...List.generate(items.length, (k) {
          final it = items[k];
          return pw.Container(
            padding: const pw.EdgeInsets.symmetric(vertical: 7, horizontal: 6),
            decoration: pw.BoxDecoration(
              border: pw.Border(bottom: pw.BorderSide(color: _line, width: 0.6)),
            ),
            child: pw.Row(
              crossAxisAlignment: pw.CrossAxisAlignment.start,
              children: [
                pw.SizedBox(
                    width: 16,
                    child: pw.Text('${k + 1}', style: st(8.5, color: _muted))),
                pw.Expanded(
                  child: pw.Column(
                    crossAxisAlignment: pw.CrossAxisAlignment.start,
                    children: [
                      if (it.brand != null)
                        pw.Text(it.brand!.toUpperCase(),
                            style: st(7, color: _gold, spacing: 1)),
                      pw.Text(it.name, style: st(10, font: medium)),
                      if (it.details != null)
                        pw.Text(it.details!, style: st(8, color: _muted)),
                    ],
                  ),
                ),
                pw.SizedBox(width: 10),
                pw.Text(plainOmr(it.price), style: st(10, font: medium)),
              ],
            ),
          );
        }),
        pw.SizedBox(height: 12),
        // ── Totals
        pw.Row(
          crossAxisAlignment: pw.CrossAxisAlignment.start,
          children: [
            pw.Expanded(
              child: o.payments.isEmpty
                  ? pw.SizedBox()
                  : pw.Column(
                      crossAxisAlignment: pw.CrossAxisAlignment.start,
                      children: [
                        twoLang('الدفعات', 'Payments', strong: true, size: 8.5),
                        pw.SizedBox(height: 4),
                        ...o.payments.map((p) => pw.Padding(
                              padding: const pw.EdgeInsets.only(bottom: 2),
                              child: pw.Text(
                                '${dateStr(p.paidOn)}  ·  ${omrLatin(p.amount)}${p.method == null ? '' : '  ·  ${p.method}'}',
                                style: st(7.5, color: _muted),
                              ),
                            )),
                      ],
                    ),
            ),
            pw.SizedBox(width: 16),
            pw.SizedBox(
              width: 170,
              child: pw.Column(
                children: [
                  amountRow('مجموع القطع', 'Subtotal', o.itemsTotal),
                  if (o.deliveryFee > 0)
                    amountRow('التوصيل', 'Delivery', o.deliveryFee),
                  if (o.tax > 0) amountRow('الضريبة', 'Tax', o.tax),
                  if (o.discount > 0)
                    amountRow(o.discountLabel ?? 'خصم', 'Discount', -o.discount),
                  pw.Divider(color: _line, thickness: 0.6, height: 8),
                  amountRow('الإجمالي', 'Total', o.total, strong: true),
                  if (o.paid > 0) amountRow('المدفوع', 'Paid', o.paid),
                  pw.SizedBox(height: 6),
                  pw.Container(
                    padding: const pw.EdgeInsets.symmetric(
                        horizontal: 10, vertical: 7),
                    decoration: pw.BoxDecoration(
                      color: _burgundy,
                      borderRadius: pw.BorderRadius.circular(6),
                    ),
                    child: pw.Row(
                      mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
                      children: [
                        twoLang('المتبقي', 'Balance due',
                            strong: true, color: PdfColors.white, size: 9.5),
                        pw.Text(
                            omrLatin(o.remaining < 0 ? 0 : o.remaining),
                            style: st(12, font: bold, color: PdfColors.white)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        if (biz.bankDetails != null) ...[
          pw.SizedBox(height: 16),
          twoLang('بيانات التحويل', 'Bank details', strong: true, size: 8.5),
          pw.SizedBox(height: 3),
          pw.Text(biz.bankDetails!, style: st(8.5)),
        ],
        if (biz.invoiceNote != null) ...[
          pw.SizedBox(height: 12),
          pw.Text(biz.invoiceNote!, style: st(8, color: _muted)),
        ],
        pw.SizedBox(height: 18),
        pw.Center(
          child: pw.Column(children: [
            pw.Text('شكراً لثقتكم', style: st(12, font: bold, color: _burgundy)),
            pw.Text('Thank you for your trust',
                style: st(7, color: _muted, spacing: 1)),
          ]),
        ),
      ],
    ),
  );

  return doc.save();
}

/// Builds the invoice and opens the iOS share sheet (WhatsApp, Files, Print…).
Future<void> shareInvoice(
    Order o, Customer? customer, BusinessSettings biz) async {
  final bytes = await buildInvoicePdf(o, customer, biz);
  await Printing.sharePdf(bytes: bytes, filename: '${o.invoiceNo}.pdf');
}
