import 'config.dart';
import 'format.dart';
import 'models.dart';

/// Ready-made WhatsApp messages. Wording follows the customer's gender and
/// every message can be edited before sending.
class MsgTemplate {
  const MsgTemplate(this.title, this.build);

  final String title;
  final String Function(Order o, Customer? c) build;
}

String trackingLink(Order o) =>
    o.trackingToken == null ? '' : '${AppConfig.trackingBaseUrl}${o.trackingToken}';

String _items(Iterable<OrderItem> items) => items
    .map((i) => '• ${i.title}${i.details == null ? '' : ' (${i.details})'}')
    .join('\n');

/// Picks the feminine or masculine form.
String _g(Customer? c, String female, String male) =>
    (c?.isMale ?? false) ? male : female;

String _hi(Customer? c) {
  final n = c?.firstName ?? '';
  return n.isEmpty ? 'هلا 🤍' : 'هلا $n 🤍';
}

final List<MsgTemplate> messageTemplates = [
  MsgTemplate('تأكيد الطلب', (o, c) {
    return '${_hi(c)}\n'
        'تم تأكيد ${_g(c, 'طلبكِ', 'طلبك')} من GH Shopper\n'
        'رقم الفاتورة: ${o.invoiceNo}\n\n'
        '${_items(o.activeItems)}\n\n'
        'المجموع: ${omr(o.itemsTotal)}'
        '${o.deliveryFee > 0 ? '\nالتوصيل: ${omr(o.deliveryFee)}' : ''}\n'
        'المدفوع: ${omr(o.paid)}\n'
        'المتبقي: ${omr(o.remaining)}\n\n'
        '${o.trackingToken == null ? '' : 'تقدر${_g(c, 'ين', '')} تتابع${_g(c, 'ين', '')} ${_g(c, 'طلبكِ', 'طلبك')} من هنا:\n${trackingLink(o)}\n\n'}'
        'شكراً ${_g(c, 'لثقتكِ', 'لثقتك')} 🐆';
  }),
  MsgTemplate('تم الشراء', (o, c) {
    final bought = o.activeItems
        .where((i) => i.status.index >= ItemStatus.purchased.index)
        .toList();
    return '${_hi(c)}\n'
        'بشارة! اشترينا ${_g(c, 'لكِ', 'لك')}:\n'
        '${_items(bought.isEmpty ? o.activeItems : bought)}\n\n'
        'أول ما يوصل مسقط ${_g(c, 'نبلغكِ', 'نبلغك')} ✨';
  }),
  MsgTemplate('وصل الطلب', (o, c) {
    final arrived =
        o.activeItems.where((i) => i.status == ItemStatus.arrived).toList();
    return '${_hi(c)}\n'
        '${_g(c, 'طلبكِ', 'طلبك')} وصل مسقط بالسلامة 🎉\n'
        '${_items(arrived.isEmpty ? o.activeItems : arrived)}\n\n'
        'المتبقي: ${omr(o.remaining)}'
        '${o.deliveryFee > 0 ? ' (شامل التوصيل ${omr(o.deliveryFee)})' : ''}\n'
        'متى ${_g(c, 'يناسبكِ', 'يناسبك')} نوصّله ${_g(c, 'لكِ', 'لك')}؟';
  }),
  MsgTemplate('خرج للتوصيل', (o, c) {
    return '${_hi(c)}\n'
        '${_g(c, 'طلبكِ', 'طلبك')} ${o.invoiceNo} طلع للتوصيل 🚗\n'
        'بنتواصل ${_g(c, 'معكِ', 'معك')} قبل لا نوصل.\n'
        'تتبّع${_g(c, 'ي', '')} ${_g(c, 'طلبكِ', 'طلبك')} من هنا:\n'
        '${trackingLink(o)}';
  }),
  MsgTemplate('تم الشحن (نول / جيناكم)', (o, c) {
    final company = o.deliveryMethod?.label ?? 'شركة الشحن';
    return '${_hi(c)}\n'
        'تم شحن ${_g(c, 'طلبكِ', 'طلبك')} ${o.invoiceNo} مع $company 📦\n'
        '${o.carrierTracking == null ? '' : 'رقم الشحنة: ${o.carrierTracking}\n'}'
        'تتبّع${_g(c, 'ي', '')} ${_g(c, 'طلبكِ', 'طلبك')} من هنا:\n'
        '${trackingLink(o)}';
  }),
  MsgTemplate('تذكير بالمبلغ المتبقي', (o, c) {
    return '${_hi(c)}\n'
        'تذكير لطيف بالمبلغ المتبقي على ${_g(c, 'طلبكِ', 'طلبك')} ${o.invoiceNo}:\n'
        '${omr(o.remaining)}\n\n'
        'شكراً ${_g(c, 'لكِ', 'لك')} 🐆';
  }),
  MsgTemplate('رابط تتبّع الطلب', (o, c) {
    return '${_hi(c)}\n'
        'تقدر${_g(c, 'ين', '')} تتابع${_g(c, 'ين', '')} حالة ${_g(c, 'طلبكِ', 'طلبك')} ${o.invoiceNo} من هنا:\n'
        '${trackingLink(o)}';
  }),
  MsgTemplate('تم التسليم', (o, c) {
    return '${_hi(c)}\n'
        'إن شاء الله ${_g(c, 'عجبكِ', 'عجبك')} ${_g(c, 'طلبكِ', 'طلبك')} ✨\n'
        'شكراً ${_g(c, 'لأنكِ وثقتِ', 'لأنك وثقت')} فينا، ${_g(c, 'ونشوفكِ', 'ونشوفك')} في الرحلة الجاية 🐆\n'
        'GH Shopper';
  }),
];
