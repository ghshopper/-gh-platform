import 'dart:convert';
import 'dart:io';

import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

import '../format.dart';
import '../models.dart';
import 'store.dart';

/// Builds a monthly Excel-compatible report (CSV with UTF-8 BOM so Arabic
/// opens correctly in Excel and Numbers) and opens the share sheet.
class Report {
  static String _cell(Object? v) {
    final s = (v ?? '').toString().replaceAll('"', '""');
    return '"$s"';
  }

  static String _num(double v) => v.toStringAsFixed(3);

  static Future<void> shareMonth(int year, int month) async {
    final store = Store.i;
    bool inMonth(DateTime? d) {
      if (d == null) return false;
      final l = d.toLocal();
      return l.year == year && l.month == month;
    }

    final orders = store.orders.where((o) => inMonth(o.createdAt)).toList()
      ..sort((a, b) => a.orderNo.compareTo(b.orderNo));

    final rows = <List<Object?>>[
      [
        'رقم الفاتورة',
        'التاريخ',
        'العميل',
        'الرحلة',
        'عدد القطع',
        'مبيعات القطع',
        'التوصيل',
        'الإجمالي',
        'المدفوع',
        'المتبقي',
        'تكلفة الشراء (ر.ع)',
        'الربح التقديري',
      ],
    ];
    var sales = 0.0, delivery = 0.0, paid = 0.0, cost = 0.0;
    for (final o in orders) {
      final trip = store.trip(o.tripId)?.name ?? o.trip ?? '';
      rows.add([
        o.invoiceNo,
        dateStr(o.createdAt),
        store.customerName(o),
        trip,
        o.activeItems.length,
        _num(o.itemsTotal),
        _num(o.deliveryFee),
        _num(o.total),
        _num(o.paid),
        _num(o.remaining),
        _num(o.costOmr),
        _num(o.itemsTotal - o.costOmr),
      ]);
      sales += o.itemsTotal;
      delivery += o.deliveryFee;
      paid += o.paid;
      cost += o.costOmr;
    }
    rows.add([]);
    rows.add(['المجموع', '', '', '', '', _num(sales), _num(delivery),
      _num(sales + delivery), _num(paid), _num(sales + delivery - paid),
      _num(cost), _num(sales - cost)]);

    // Items sheet section
    rows.add([]);
    rows.add(['القطع']);
    rows.add([
      'رقم الفاتورة', 'العميل', 'البراند', 'القطعة', 'الحالة', 'سعر البيع',
      'مكان الشراء', 'سعر الشراء', 'العملة', 'بالريال', 'تاكس فري', 'استُلم'
    ]);
    for (final o in orders) {
      for (final i in o.activeItems) {
        rows.add([
          o.invoiceNo,
          store.customerName(o),
          i.brand ?? '',
          i.name,
          i.status.label,
          _num(i.price),
          i.purchasePlace?.label ?? '',
          i.costAmount == null ? '' : i.costAmount!.toStringAsFixed(2),
          i.costCurrency ?? '',
          i.costOmr == null ? '' : _num(i.costOmr!),
          i.hasTaxFree ? i.taxFreeAmount.toStringAsFixed(2) : '',
          i.hasTaxFree ? (i.taxFreeReceived ? 'نعم' : 'لا') : '',
        ]);
      }
    }

    final csv = rows.map((r) => r.map(_cell).join(',')).join('\r\n');
    final bytes = <int>[0xEF, 0xBB, 0xBF, ...utf8.encode(csv)];
    final dir = await getTemporaryDirectory();
    final name =
        'GH-Shopper-$year-${month.toString().padLeft(2, '0')}.csv';
    final file = File('${dir.path}/$name');
    await file.writeAsBytes(bytes, flush: true);
    await Share.shareXFiles([XFile(file.path, mimeType: 'text/csv')],
        subject: 'تقرير GH Shopper $month/$year');
  }
}
