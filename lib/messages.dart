import 'format.dart';
import 'models.dart';

/// Ready-made WhatsApp messages. Each one is built from the order and can be
/// edited before sending.
class MsgTemplate {
  const MsgTemplate(this.title, this.build);

  final String title;
  final String Function(Order o) build;
}

String _items(Iterable<OrderItem> items) =>
    items.map((i) => '• ${i.name}${i.details == null ? '' : ' (${i.details})'}').join('\n');

String _first(Order o) {
  final n = o.customerName.trim();
  if (n.isEmpty || n == '—') return '';
  return ' ${n.split(' ').first}';
}

final List<MsgTemplate> messageTemplates = [
  MsgTemplate('تأكيد الطلب', (o) {
    return 'هلا${_first(o)} 🤍\n'
        'تم تأكيد طلبكِ من GH Shopper\n'
        'رقم الفاتورة: ${o.invoiceNo}\n\n'
        '${_items(o.activeItems)}\n\n'
        'المجموع: ${omr(o.itemsTotal)}'
        '${o.deliveryFee > 0 ? '\nالتوصيل: ${omr(o.deliveryFee)}' : ''}\n'
        'المدفوع: ${omr(o.paid)}\n'
        'المتبقي: ${omr(o.remaining)}\n\n'
        'شكراً لثقتكِ 🐆';
  }),
  MsgTemplate('تم الشراء', (o) {
    final bought = o.activeItems
        .where((i) => i.status.index >= ItemStatus.purchased.index)
        .toList();
    return 'هلا${_first(o)} 🤍\n'
        'بشارة! اشترينا لكِ:\n'
        '${_items(bought.isEmpty ? o.activeItems : bought)}\n\n'
        'أول ما يوصل مسقط نبلغكِ ✨';
  }),
  MsgTemplate('وصل الطلب', (o) {
    final arrived = o.activeItems
        .where((i) => i.status == ItemStatus.arrived)
        .toList();
    return 'هلا${_first(o)} 🤍\n'
        'طلبكِ وصل مسقط بالسلامة 🎉\n'
        '${_items(arrived.isEmpty ? o.activeItems : arrived)}\n\n'
        'المتبقي: ${omr(o.remaining)}'
        '${o.deliveryFee > 0 ? ' (شامل التوصيل ${omr(o.deliveryFee)})' : ''}\n'
        'متى يناسبكِ نوصّله لكِ؟';
  }),
  MsgTemplate('تذكير بالمبلغ المتبقي', (o) {
    return 'هلا${_first(o)} 🤍\n'
        'تذكير لطيف بالمبلغ المتبقي على طلبكِ ${o.invoiceNo}:\n'
        '${omr(o.remaining)}\n\n'
        'شكراً لكِ 🐆';
  }),
  MsgTemplate('تم التسليم', (o) {
    return 'هلا${_first(o)} 🤍\n'
        'إن شاء الله عجبكِ طلبكِ ✨\n'
        'شكراً لأنكِ وثقتِ فينا، ونشوفكِ في الرحلة الجاية 🐆\n'
        'GH Shopper';
  }),
];
