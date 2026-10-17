import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';

import '../data/store.dart';
import '../format.dart';
import '../messages.dart';
import '../models.dart';
import '../pdf_invoice.dart';
import '../ui/colors.dart';
import '../ui/kit.dart';
import 'customers_page.dart';
import 'item_pages.dart';
import 'trips_page.dart';

class OrderDetailPage extends StatefulWidget {
  const OrderDetailPage({super.key, required this.orderId});

  final String orderId;

  @override
  State<OrderDetailPage> createState() => _OrderDetailPageState();
}

class _OrderDetailPageState extends State<OrderDetailPage> {
  bool _busy = false;

  Future<void> _run(Future<void> Function() action, {String? done}) async {
    setState(() => _busy = true);
    try {
      await action();
      if (done != null && mounted) toast(context, done);
    } catch (e) {
      if (mounted) toast(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  // ───────────── items ─────────────

  Future<void> _advance(OrderItem item, ItemStatus status) async {
    if (status == ItemStatus.purchased && item.costAmount == null) {
      await presentForm(context, PurchasePage(item: item));
      return;
    }
    await _run(() => Store.i.setItemStatus(item, status),
        done: status.label);
  }

  Future<void> _pickPhoto(OrderItem item, String kind) async {
    final source = await actionSheet<ImageSource>(context,
        title: kind == 'photo' ? 'صورة القطعة' : 'صورة الإيصال',
        actions: const [
          SheetAction('الكاميرا', ImageSource.camera),
          SheetAction('من الصور', ImageSource.gallery),
        ]);
    if (source == null) return;
    final file = await ImagePicker()
        .pickImage(source: source, maxWidth: 1600, imageQuality: 80);
    if (file == null) return;
    final bytes = await file.readAsBytes();
    await _run(() => Store.i.uploadItemPhoto(item, kind, bytes),
        done: 'تم حفظ الصورة');
  }

  Future<void> _itemActions(Order o, OrderItem item) async {
    final next = item.status.next;
    final actions = <SheetAction<String>>[
      if (next != null) SheetAction(next.actionLabel, 'next'),
      SheetAction(
          item.costAmount == null ? 'تسجيل الشراء (السعر والمكان)' : 'تعديل بيانات الشراء',
          'purchase'),
      if (item.hasTaxFree)
        SheetAction(
            item.taxFreeReceived
                ? 'التاكس فري ما استلمته'
                : 'استلمت التاكس فري',
            'taxfree'),
      SheetAction(item.photoPath == null ? 'إضافة صورة للقطعة' : 'عرض صورة القطعة',
          'photo'),
      SheetAction(
          item.receiptPath == null ? 'إضافة صورة الإيصال' : 'عرض صورة الإيصال',
          'receipt'),
      const SheetAction('تعديل القطعة', 'edit'),
      const SheetAction('تغيير الحالة…', 'status'),
      const SheetAction('حذف القطعة', 'delete', destructive: true),
    ];
    final a = await actionSheet<String>(context,
        title: item.title, message: item.status.label, actions: actions);
    if (a == null || !mounted) return;
    switch (a) {
      case 'next':
        await _advance(item, next!);
        break;
      case 'purchase':
        await presentForm(context, PurchasePage(item: item));
        break;
      case 'taxfree':
        await _run(() => Store.i.setTaxFreeReceived(item.id, !item.taxFreeReceived));
        break;
      case 'photo':
      case 'receipt':
        final path = a == 'photo' ? item.photoPath : item.receiptPath;
        if (path == null) {
          await _pickPhoto(item, a);
        } else {
          final v = await actionSheet<String>(context, actions: const [
            SheetAction('عرض', 'view'),
            SheetAction('تغيير', 'change'),
            SheetAction('حذف الصورة', 'remove', destructive: true),
          ]);
          if (!mounted) return;
          if (v == 'view') {
            pushPage(context,
                PhotoPage(path: path, title: a == 'photo' ? item.name : 'الإيصال'));
          } else if (v == 'change') {
            await _pickPhoto(item, a);
          } else if (v == 'remove') {
            await _run(() => Store.i.removeItemPhoto(item, a));
          }
        }
        break;
      case 'edit':
        await presentForm(context, ItemFormPage(orderId: o.id, item: item));
        break;
      case 'status':
        final s = await actionSheet<ItemStatus>(context,
            title: 'الحالة',
            actions: ItemStatus.values
                .where((s) => s != item.status)
                .map((s) => SheetAction(s.label, s,
                    destructive: s == ItemStatus.cancelled))
                .toList());
        if (s != null) await _advance(item, s);
        break;
      case 'delete':
        if (await confirm(context, 'حذف ${item.name}؟')) {
          await _run(() => Store.i.deleteItem(item.id));
        }
        break;
    }
  }

  Future<void> _markAll(Order o, ItemStatus status) async {
    final targets =
        o.activeItems.where((i) => i.status.index < status.index).toList();
    if (targets.isEmpty) return;
    if (status == ItemStatus.purchased) {
      for (final i in targets) {
        if (!mounted) return;
        if (i.costAmount != null) {
          await Store.i.setItemStatus(i, status);
          continue;
        }
        final ok = await presentForm<bool>(context, PurchasePage(item: i));
        if (ok != true) break;
      }
      return;
    }
    await _run(() => Store.i.setItemsStatus(targets, status),
        done: 'تم: ${status.label}');
    if (status == ItemStatus.arrived && mounted) {
      final send = await confirm(context, 'ترسل رسالة إن الطلب وصل؟',
          ok: 'أرسل', destructive: false);
      if (send && mounted) {
        final updated = Store.i.order(o.id) ?? o;
        presentForm(context,
            MessagePage(order: updated, template: messageTemplates[2]));
      }
    }
  }

  // ───────────── order ─────────────

  Future<void> _orderActions(Order o) async {
    final a = await actionSheet<String>(context, title: o.invoiceNo, actions: [
      const SheetAction('الرحلة', 'trip'),
      const SheetAction('رسوم التوصيل', 'delivery'),
      const SheetAction('ملاحظات الطلب', 'notes'),
      if (o.trackingToken != null) const SheetAction('نسخ رابط التتبّع', 'track'),
      const SheetAction('حذف الطلب', 'delete', destructive: true),
    ]);
    if (a == null || !mounted) return;
    switch (a) {
      case 'trip':
        final id = await pickTrip(context, current: o.tripId);
        if (id != null) {
          await _run(() =>
              Store.i.updateOrder(o.id, {'trip_id': id.isEmpty ? null : id}));
        }
        break;
      case 'delivery':
        final v = await _askAmount('رسوم التوصيل', o.deliveryFee);
        if (v != null) {
          await _run(() => Store.i.updateOrder(o.id, {'delivery_fee': v}));
        }
        break;
      case 'notes':
        final t = await _askText('ملاحظات الطلب', o.notes ?? '');
        if (t != null) {
          await _run(() => Store.i
              .updateOrder(o.id, {'notes': t.trim().isEmpty ? null : t.trim()}));
        }
        break;
      case 'track':
        await Clipboard.setData(ClipboardData(text: trackingLink(o)));
        if (mounted) toast(context, 'نسخت رابط التتبّع');
        break;
      case 'delete':
        if (await confirm(context, 'حذف الطلب ${o.invoiceNo}؟',
            message: 'بينحذف الطلب مع قطعه ودفعاته.')) {
          try {
            await Store.i.deleteOrder(o.id);
            if (mounted) Navigator.pop(context);
          } catch (e) {
            if (mounted) toast(context, errorText(e), error: true);
          }
        }
        break;
    }
  }

  Future<double?> _askAmount(String title, double current) async {
    final c = TextEditingController(
        text: current == 0 ? '' : plainOmr(current).replaceAll(',', ''));
    final ok = await showCupertinoDialog<bool>(
      context: context,
      builder: (ctx) => CupertinoAlertDialog(
        title: Text(title),
        content: Padding(
          padding: const EdgeInsets.only(top: 12),
          child: CupertinoTextField(
            controller: c,
            autofocus: true,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
            textDirection: TextDirection.ltr,
            suffix: const Padding(
                padding: EdgeInsets.symmetric(horizontal: 8), child: Text('ر.ع')),
          ),
        ),
        actions: [
          CupertinoDialogAction(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('إلغاء')),
          CupertinoDialogAction(
              isDefaultAction: true,
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('حفظ')),
        ],
      ),
    );
    if (ok != true) return null;
    final v = parseAmount(c.text) ?? 0;
    return v < 0 ? 0 : v;
  }

  Future<String?> _askText(String title, String current) async {
    final c = TextEditingController(text: current);
    final ok = await showCupertinoDialog<bool>(
      context: context,
      builder: (ctx) => CupertinoAlertDialog(
        title: Text(title),
        content: Padding(
          padding: const EdgeInsets.only(top: 12),
          child: CupertinoTextField(controller: c, autofocus: true, maxLines: 4, minLines: 2),
        ),
        actions: [
          CupertinoDialogAction(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('إلغاء')),
          CupertinoDialogAction(
              isDefaultAction: true,
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('حفظ')),
        ],
      ),
    );
    return ok == true ? c.text : null;
  }

  Future<void> _sharePdf(Order o) async {
    await _run(() =>
        shareInvoice(o, Store.i.customer(o.customerId), Store.i.settings));
  }

  Future<void> _pickMessage(Order o) async {
    final t = await actionSheet<MsgTemplate>(context,
        title: 'رسالة واتساب',
        actions: messageTemplates
            .where((m) => o.trackingToken != null || !m.title.contains('تتبّع'))
            .map((m) => SheetAction(m.title, m))
            .toList());
    if (t != null && mounted) {
      presentForm(context, MessagePage(order: o, template: t));
    }
  }

  Future<void> _deletePayment(Payment p) async {
    if (await confirm(context, 'حذف دفعة ${omr(p.amount)}؟')) {
      await _run(() => Store.i.deletePayment(p.id));
    }
  }

  // ───────────── UI ─────────────

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Store.i,
      builder: (context, _) {
        final o = Store.i.order(widget.orderId);
        if (o == null) {
          return const GHPage(title: 'الطلب', children: [
            EmptyState(icon: CupertinoIcons.doc_text, title: 'الطلب غير موجود'),
          ]);
        }
        final customer = Store.i.customer(o.customerId);
        final trip = Store.i.trip(o.tripId);
        final st = o.overallStatus;
        return GHPage(
          title: o.invoiceNo,
          previousPageTitle: 'رجوع',
          onRefresh: Store.i.refresh,
          trailing: _busy
              ? const CupertinoActivityIndicator()
              : NavIcon(CupertinoIcons.ellipsis_circle,
                  onPressed: () => _orderActions(o)),
          bottom: Row(
            children: [
              Expanded(
                child: SecondaryButton('الفاتورة',
                    icon: CupertinoIcons.doc_richtext,
                    onPressed: _busy ? null : () => _sharePdf(o)),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: PrimaryButton('واتساب',
                    icon: CupertinoIcons.chat_bubble_fill,
                    onPressed: () => _pickMessage(o)),
              ),
            ],
          ),
          children: [
            // Summary card
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                    color: GH.card, borderRadius: BorderRadius.circular(14)),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    GestureDetector(
                      onTap: customer == null
                          ? null
                          : () => pushPage(context,
                              CustomerDetailPage(customerId: customer.id)),
                      child: Row(
                        children: [
                          Avatar(customer?.name ?? ''),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(customer?.name ?? '—', style: T.title),
                                Text(
                                  [
                                    dateStr(o.createdAt),
                                    if (trip != null) trip.name
                                    else if (o.trip != null) o.trip!,
                                  ].join(' · '),
                                  style: T.sub,
                                ),
                              ],
                            ),
                          ),
                          Badge(st.label, color: st.color),
                        ],
                      ),
                    ),
                    const SizedBox(height: 14),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text('الإجمالي', style: T.sub),
                              Text(omr(o.total), style: T.big),
                            ],
                          ),
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            const Text('المتبقي', style: T.sub),
                            Text(omr(o.remaining),
                                style: T.money.copyWith(
                                    fontSize: 18,
                                    color: o.hasBalance ? GH.red : GH.green)),
                          ],
                        ),
                      ],
                    ),
                    if (o.notes != null) ...[
                      const SizedBox(height: 10),
                      Text(o.notes!, style: T.sub),
                    ],
                  ],
                ),
              ),
            ),
            if (o.activeItems.any((i) => i.status.index < ItemStatus.delivered.index))
              SizedBox(
                height: 50,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                  children: [
                    for (final s in const [
                      ItemStatus.purchased,
                      ItemStatus.arrived,
                      ItemStatus.delivered
                    ])
                      if (o.activeItems.any((i) => i.status.index < s.index))
                        Padding(
                          padding: const EdgeInsetsDirectional.only(end: 8),
                          child: Chip('الكل: ${s.actionLabel}',
                              icon: CupertinoIcons.checkmark_alt,
                              onTap: _busy ? null : () => _markAll(o, s)),
                        ),
                  ],
                ),
              ),
            Section(
              header: 'القطع',
              trailing: HeaderButton('إضافة',
                  icon: CupertinoIcons.add,
                  onPressed: () =>
                      presentForm(context, ItemFormPage(orderId: o.id))),
              children: o.items.isEmpty
                  ? [const Tile(title: 'ما في قطع')]
                  : o.items.map((i) => _itemRow(o, i)).toList(),
            ),
            Section(
              header: 'الدفعات',
              trailing: HeaderButton('دفعة',
                  icon: CupertinoIcons.add,
                  onPressed: () =>
                      presentForm(context, PaymentFormPage(order: o))),
              children: [
                ...o.payments.map((p) => Tile(
                      leading: const IconBox(CupertinoIcons.money_dollar,
                          color: GH.green),
                      title: omr(p.amount),
                      subtitle: [
                        dateStr(p.paidOn),
                        if (p.method != null) p.method!,
                        if (p.note != null) p.note!,
                      ].join(' · '),
                      chevron: false,
                      onTap: () => _deletePayment(p),
                    )),
                KV('مجموع القطع', omr(o.itemsTotal)),
                KV('التوصيل', omr(o.deliveryFee)),
                KV('الإجمالي', omr(o.total), strong: true),
                KV('المدفوع', omr(o.paid), color: GH.green),
                KV('المتبقي', omr(o.remaining),
                    strong: true, color: o.hasBalance ? GH.red : GH.green),
              ],
            ),
            Section(
              header: 'خاص بك (ما يطلع في الفاتورة)',
              children: [
                KV('حوّل لك العميل', omr(o.paid)),
                KV('دفعت عن قطعه', omr(o.costOmr)),
                KV('رصيده الحالي عندك', omr(o.customerBalance),
                    strong: true,
                    color: o.customerBalance < -0.0005 ? GH.red : GH.green),
                if (o.costOmr > 0)
                  KV('ربحك التقديري', omr(o.itemsTotal - o.costOmr),
                      color: GH.burgundy),
                ...o.taxFreePending.entries.map((e) => KV(
                    'تاكس فري باقي تستلمه', money(e.value, e.key),
                    color: GH.amber)),
              ],
            ),
          ],
        );
      },
    );
  }

  Widget _itemRow(Order o, OrderItem i) {
    final cancelled = i.status == ItemStatus.cancelled;
    return Pressable(
      onTap: () => _itemActions(o, i),
      child: Padding(
        padding: const EdgeInsetsDirectional.fromSTEB(16, 12, 12, 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (i.photoPath != null) ...[
              Thumb(i.photoPath!),
              const SizedBox(width: 12),
            ],
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (i.brand != null)
                    Text(i.brand!.toUpperCase(),
                        style: const TextStyle(
                            fontSize: 11.5,
                            letterSpacing: 0.8,
                            fontWeight: FontWeight.w600,
                            color: GH.gold)),
                  Row(
                    children: [
                      Expanded(
                        child: Text(i.name,
                            style: T.title.copyWith(
                              color: cancelled ? GH.tertiary : GH.label,
                              decoration: cancelled
                                  ? TextDecoration.lineThrough
                                  : null,
                            )),
                      ),
                      Text(omr(i.price), style: T.money),
                    ],
                  ),
                  if (i.details != null) Text(i.details!, style: T.sub),
                  if (i.costAmount != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        [
                          'شراء ${money(i.costAmount!, i.costCurrency ?? '')}',
                          if (i.costOmr != null) '≈ ${omr(i.costOmr!)}',
                          if (i.purchasePlace != null) i.purchasePlace!.label,
                        ].join(' · '),
                        style: T.small,
                      ),
                    ),
                  if (i.hasTaxFree)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        'تاكس فري ${money(i.taxFreeAmount, i.costCurrency ?? '')} · ${i.taxFreeReceived ? 'استلمته ✓' : 'ما استلمته'}',
                        style: T.small.copyWith(
                            fontWeight: FontWeight.w600,
                            color: i.taxFreeReceived ? GH.green : GH.amber),
                      ),
                    ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Badge(i.status.label, color: i.status.color),
                      const SizedBox(width: 10),
                      if (!cancelled) StepDots(i.status.index),
                      if (i.receiptPath != null) ...[
                        const SizedBox(width: 8),
                        const Icon(CupertinoIcons.doc_text_viewfinder,
                            size: 16, color: GH.secondary),
                      ],
                      const Spacer(),
                      if (i.status.next != null)
                        CupertinoButton(
                          padding: const EdgeInsets.symmetric(horizontal: 10),
                          minSize: 30,
                          color: const Color(0xFFF1E7E8),
                          borderRadius: BorderRadius.circular(8),
                          onPressed: _busy
                              ? null
                              : () => _advance(i, i.status.next!),
                          child: Text(i.status.next!.actionLabel,
                              style: const TextStyle(
                                  fontSize: 13.5,
                                  fontWeight: FontWeight.w600,
                                  color: GH.burgundy)),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
