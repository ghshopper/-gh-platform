import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../format.dart';
import '../messages.dart';
import '../models.dart';
import '../pdf_invoice.dart';
import '../repo.dart';
import '../theme.dart';
import '../widgets.dart';
import 'order_form_screen.dart' show paymentMethods;

class OrderDetailScreen extends StatefulWidget {
  const OrderDetailScreen({super.key, required this.orderId});

  final String orderId;

  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen> {
  Order? _order;
  Object? _error;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final o = await Repo.order(widget.orderId);
      if (mounted) {
        setState(() {
          _order = o;
          _error = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = e);
    }
  }

  /// Runs a write, then reloads the order. Shows errors as a snackbar.
  Future<void> _run(Future<void> Function() action, {String? done}) async {
    setState(() => _busy = true);
    try {
      await action();
      await _load();
      if (done != null && mounted) showMsg(context, done);
    } catch (e) {
      if (mounted) showMsg(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  // ---------- items ----------

  Future<void> _itemDialog({OrderItem? item}) async {
    final name = TextEditingController(text: item?.name);
    final details = TextEditingController(text: item?.details);
    final price = TextEditingController(
        text: item == null ? '' : plainOmr(item.price).replaceAll(',', ''));
    final formKey = GlobalKey<FormState>();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(item == null ? 'قطعة جديدة' : 'تعديل القطعة'),
        content: Form(
          key: formKey,
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextFormField(
                  controller: name,
                  decoration: const InputDecoration(labelText: 'اسم القطعة'),
                  validator: (v) =>
                      (v ?? '').trim().isEmpty ? 'مطلوب' : null,
                ),
                const SizedBox(height: 10),
                TextFormField(
                  controller: details,
                  decoration:
                      const InputDecoration(labelText: 'التفاصيل (اختياري)'),
                ),
                const SizedBox(height: 10),
                AmountField(
                    controller: price,
                    label: 'السعر للعميلة',
                    required: true),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('إلغاء')),
          FilledButton(
            onPressed: () {
              if (formKey.currentState?.validate() ?? false) {
                Navigator.pop(ctx, true);
              }
            },
            child: const Text('حفظ'),
          ),
        ],
      ),
    );
    if (ok != true) return;
    final n = name.text.trim();
    final d = details.text.trim().isEmpty ? null : details.text.trim();
    final p = parseAmount(price.text) ?? 0;
    if (item == null) {
      await _run(() => Repo.addItem(widget.orderId, name: n, details: d, price: p));
    } else {
      await _run(() => Repo.updateItem(item.id, name: n, details: d, price: p));
    }
  }

  Future<void> _itemMenu(OrderItem item, String action) async {
    if (action == 'edit') return _itemDialog(item: item);
    if (action == 'delete') {
      if (!await confirm(context, 'حذف ${item.name}؟')) return;
      return _run(() => Repo.deleteItem(item.id));
    }
    final status = itemStatusFrom(action);
    await _run(() => Repo.setItemStatus(item, status));
  }

  Future<void> _markAll(ItemStatus status) async {
    final o = _order!;
    final targets = o.activeItems
        .where((i) => i.status.index < status.index)
        .toList();
    if (targets.isEmpty) return;
    await _run(() async {
      for (final i in targets) {
        await Repo.setItemStatus(i, status);
      }
    }, done: 'تم: ${status.label}');
    if (status == ItemStatus.arrived && mounted) {
      final send = await confirm(context, 'ترسل لها رسالة إن طلبها وصل؟',
          ok: 'أرسل', danger: false);
      if (send) _composeMessage(messageTemplates[2]);
    }
  }

  // ---------- payments ----------

  Future<void> _paymentDialog() async {
    final o = _order!;
    final amount = TextEditingController(
        text: o.hasBalance ? plainOmr(o.remaining).replaceAll(',', '') : '');
    final note = TextEditingController();
    var method = paymentMethods.first;
    var date = DateTime.now();
    final formKey = GlobalKey<FormState>();
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setD) => AlertDialog(
          title: const Text('تسجيل دفعة'),
          content: Form(
            key: formKey,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  AmountField(controller: amount, label: 'المبلغ', required: true),
                  const SizedBox(height: 10),
                  DropdownButtonFormField<String>(
                    value: method,
                    decoration: const InputDecoration(labelText: 'الطريقة'),
                    items: paymentMethods
                        .map((m) => DropdownMenuItem(value: m, child: Text(m)))
                        .toList(),
                    onChanged: (v) => setD(() => method = v ?? method),
                  ),
                  const SizedBox(height: 10),
                  OutlinedButton.icon(
                    icon: const Icon(Icons.event),
                    label: Text('التاريخ: ${dateStr(date)}'),
                    onPressed: () async {
                      final d = await showDatePicker(
                        context: ctx,
                        initialDate: date,
                        firstDate: DateTime(2024),
                        lastDate: DateTime.now().add(const Duration(days: 365)),
                      );
                      if (d != null) setD(() => date = d);
                    },
                  ),
                  const SizedBox(height: 10),
                  TextFormField(
                    controller: note,
                    decoration:
                        const InputDecoration(labelText: 'ملاحظة (اختياري)'),
                  ),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(
                onPressed: () => Navigator.pop(ctx, false),
                child: const Text('إلغاء')),
            FilledButton(
              onPressed: () {
                if (formKey.currentState?.validate() ?? false) {
                  Navigator.pop(ctx, true);
                }
              },
              child: const Text('حفظ'),
            ),
          ],
        ),
      ),
    );
    if (ok != true) return;
    final value = parseAmount(amount.text) ?? 0;
    if (value <= 0) return;
    await _run(
      () => Repo.addPayment(widget.orderId,
          amount: value,
          method: method,
          paidOn: date,
          note: note.text.trim().isEmpty ? null : note.text.trim()),
      done: 'تم تسجيل الدفعة',
    );
  }

  Future<void> _deletePayment(Payment p) async {
    if (!await confirm(context, 'حذف دفعة ${omr(p.amount)}؟')) return;
    await _run(() => Repo.deletePayment(p.id));
  }

  // ---------- order fields ----------

  Future<void> _editDelivery() async {
    final o = _order!;
    final c = TextEditingController(
        text: o.deliveryFee == 0 ? '' : plainOmr(o.deliveryFee).replaceAll(',', ''));
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('رسوم التوصيل'),
        content: AmountField(controller: c, label: 'المبلغ'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('إلغاء')),
          FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('حفظ')),
        ],
      ),
    );
    if (ok != true) return;
    final v = parseAmount(c.text) ?? 0;
    await _run(() => Repo.updateOrder(o.id, {'delivery_fee': v < 0 ? 0 : v}));
  }

  Future<void> _editNotes() async {
    final o = _order!;
    final c = TextEditingController(text: o.notes);
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('ملاحظات الطلب'),
        content: TextField(controller: c, maxLines: 4),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('إلغاء')),
          FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('حفظ')),
        ],
      ),
    );
    if (ok != true) return;
    final t = c.text.trim();
    await _run(() => Repo.updateOrder(o.id, {'notes': t.isEmpty ? null : t}));
  }

  Future<void> _deleteOrder() async {
    final o = _order!;
    if (!await confirm(context, 'حذف الطلب ${o.invoiceNo}؟',
        body: 'بينحذف الطلب مع قطعه ودفعاته.')) {
      return;
    }
    try {
      await Repo.deleteOrder(o.id);
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) showMsg(context, errorText(e), error: true);
    }
  }

  // ---------- sharing ----------

  Future<void> _sharePdf() async {
    setState(() => _busy = true);
    try {
      await shareInvoice(_order!);
    } catch (e) {
      if (mounted) showMsg(context, errorText(e), error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _pickMessage() async {
    final t = await showModalBottomSheet<MsgTemplate>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Padding(
              padding: EdgeInsets.only(bottom: 8),
              child: Text('اختر الرسالة',
                  style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: GH.burgundy)),
            ),
            ...messageTemplates.map((m) => ListTile(
                  leading: const Icon(Icons.chat_bubble_outline,
                      color: GH.burgundy),
                  title: Text(m.title),
                  onTap: () => Navigator.pop(ctx, m),
                )),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
    if (t != null) _composeMessage(t);
  }

  Future<void> _composeMessage(MsgTemplate t) async {
    final o = _order!;
    final text = TextEditingController(text: t.build(o));
    final action = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(t.title),
        content: SizedBox(
          width: 400,
          child: TextField(
            controller: text,
            maxLines: 12,
            minLines: 6,
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(ctx, 'copy'),
              child: const Text('نسخ')),
          FilledButton.icon(
            onPressed: () => Navigator.pop(ctx, 'send'),
            icon: const Icon(Icons.send),
            label: const Text('واتساب'),
          ),
        ],
      ),
    );
    if (action == null) return;
    if (action == 'copy') {
      await Clipboard.setData(ClipboardData(text: text.text));
      if (mounted) showMsg(context, 'تم النسخ');
      return;
    }
    final phone = waPhone(o.customer?.phone);
    final encoded = Uri.encodeComponent(text.text);
    final uri = phone == null
        ? Uri.parse('https://wa.me/?text=$encoded')
        : Uri.parse('https://wa.me/$phone?text=$encoded');
    final opened =
        await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!opened && mounted) {
      await Clipboard.setData(ClipboardData(text: text.text));
      showMsg(context, 'ما قدرت أفتح واتساب، نسخت الرسالة لك');
    }
  }

  // ---------- UI ----------

  @override
  Widget build(BuildContext context) {
    final o = _order;
    return Scaffold(
      appBar: AppBar(
        title: Text(o?.invoiceNo ?? 'الطلب'),
        actions: [
          if (o != null)
            PopupMenuButton<String>(
              onSelected: (v) {
                if (v == 'notes') _editNotes();
                if (v == 'delete') _deleteOrder();
              },
              itemBuilder: (_) => const [
                PopupMenuItem(value: 'notes', child: Text('ملاحظات الطلب')),
                PopupMenuItem(
                    value: 'delete',
                    child: Text('حذف الطلب', style: TextStyle(color: GH.red))),
              ],
            ),
        ],
        bottom: _busy
            ? const PreferredSize(
                preferredSize: Size.fromHeight(3),
                child: LinearProgressIndicator(minHeight: 3))
            : null,
      ),
      body: o == null
          ? (_error != null
              ? ErrorRetry(error: _error!, onRetry: _load)
              : const Center(child: CircularProgressIndicator()))
          : RefreshIndicator(onRefresh: _load, child: _content(o)),
      bottomNavigationBar: o == null
          ? null
          : SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                child: Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _busy ? null : _sharePdf,
                        icon: const Icon(Icons.picture_as_pdf_outlined),
                        label: const Text('الفاتورة'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: _busy ? null : _pickMessage,
                        icon: const Icon(Icons.chat_outlined),
                        label: const Text('رسالة واتساب'),
                      ),
                    ),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _content(Order o) {
    final st = o.overallStatus;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        GhCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(o.customerName,
                        style: const TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w700,
                            color: GH.ink)),
                  ),
                  StatusPill(label: st.label, color: st.color),
                ],
              ),
              const SizedBox(height: 4),
              Text(
                [
                  dateStr(o.createdAt),
                  if (o.trip != null) o.trip!,
                  if (o.customer?.phone != null) o.customer!.phone!,
                ].join(' · '),
                style: const TextStyle(color: GH.muted),
              ),
              if (o.notes != null) ...[
                const SizedBox(height: 8),
                Text(o.notes!, style: const TextStyle(color: GH.ink)),
              ],
              const Divider(height: 22),
              KeyValue('مجموع القطع', omr(o.itemsTotal)),
              InkWell(
                onTap: _editDelivery,
                child: Row(
                  children: [
                    Expanded(
                        child: KeyValue('التوصيل', omr(o.deliveryFee))),
                    const SizedBox(width: 6),
                    const Icon(Icons.edit, size: 16, color: GH.muted),
                  ],
                ),
              ),
              KeyValue('الإجمالي', omr(o.total), strong: true),
              KeyValue('المدفوع', omr(o.paid), color: GH.green),
              KeyValue(
                'المتبقي',
                omr(o.remaining),
                strong: true,
                color: o.hasBalance ? GH.red : GH.green,
              ),
              if (o.costOmr > 0) ...[
                const Divider(height: 22),
                KeyValue('تكلفة الشراء', omr(o.costOmr), color: GH.muted),
                KeyValue('ربحك التقديري', omr(o.itemsTotal - o.costOmr),
                    color: GH.muted),
              ],
            ],
          ),
        ),
        SectionTitle(
          'القطع',
          trailing: TextButton.icon(
            onPressed: _busy ? null : () => _itemDialog(),
            icon: const Icon(Icons.add),
            label: const Text('قطعة'),
          ),
        ),
        if (o.activeItems.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final s in const [
                  ItemStatus.purchased,
                  ItemStatus.arrived,
                  ItemStatus.delivered
                ])
                  if (o.activeItems.any((i) => i.status.index < s.index))
                    ActionChip(
                      avatar: Icon(Icons.done_all, size: 18, color: s.color),
                      label: Text('الكل: ${s.actionLabel}'),
                      onPressed: _busy ? null : () => _markAll(s),
                    ),
              ],
            ),
          ),
        ...o.items.map((i) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _itemCard(i),
            )),
        SectionTitle(
          'الدفعات',
          trailing: TextButton.icon(
            onPressed: _busy ? null : _paymentDialog,
            icon: const Icon(Icons.add),
            label: const Text('دفعة'),
          ),
        ),
        if (o.payments.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 8),
            child: Text('ما في دفعات مسجلة',
                style: TextStyle(color: GH.muted)),
          ),
        ...o.payments.map((p) => Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: GhCard(
                padding:
                    const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                child: Row(
                  children: [
                    const Icon(Icons.payments_outlined, color: GH.green),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(omr(p.amount),
                              style:
                                  const TextStyle(fontWeight: FontWeight.w700)),
                          Text(
                            [
                              dateStr(p.paidOn),
                              if (p.method != null) p.method!,
                              if (p.note != null) p.note!,
                            ].join(' · '),
                            style:
                                const TextStyle(color: GH.muted, fontSize: 13),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      tooltip: 'حذف',
                      icon: const Icon(Icons.delete_outline, color: GH.muted),
                      onPressed: _busy ? null : () => _deletePayment(p),
                    ),
                  ],
                ),
              ),
            )),
      ],
    );
  }

  Widget _itemCard(OrderItem i) {
    final next = i.status.next;
    final cancelled = i.status == ItemStatus.cancelled;
    return GhCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      i.name,
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: cancelled ? Colors.grey : GH.ink,
                        decoration:
                            cancelled ? TextDecoration.lineThrough : null,
                      ),
                    ),
                    if (i.details != null)
                      Text(i.details!,
                          style: const TextStyle(color: GH.muted)),
                    const SizedBox(height: 4),
                    Text(omr(i.price),
                        style: const TextStyle(
                            fontWeight: FontWeight.w700, color: GH.burgundy)),
                    if (i.costAmount != null)
                      Text(
                        'التكلفة: ${money(i.costAmount!, i.costCurrency ?? '')}'
                        '${i.costOmr == null ? '' : ' ≈ ${omr(i.costOmr!)}'}',
                        style: const TextStyle(color: GH.muted, fontSize: 12),
                      ),
                  ],
                ),
              ),
              StatusPill(label: i.status.label, color: i.status.color),
              PopupMenuButton<String>(
                onSelected: (v) => _itemMenu(i, v),
                itemBuilder: (_) => [
                  ...ItemStatus.values
                      .where((s) => s != i.status)
                      .map((s) => PopupMenuItem(
                          value: s.name, child: Text(s.actionLabel))),
                  const PopupMenuDivider(),
                  const PopupMenuItem(value: 'edit', child: Text('تعديل')),
                  const PopupMenuItem(
                      value: 'delete',
                      child: Text('حذف', style: TextStyle(color: GH.red))),
                ],
              ),
            ],
          ),
          if (next != null) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                _stepDots(i.status),
                const Spacer(),
                FilledButton.tonalIcon(
                  style: FilledButton.styleFrom(
                    backgroundColor: GH.sand,
                    foregroundColor: GH.burgundy,
                    minimumSize: const Size(44, 40),
                  ),
                  onPressed: _busy
                      ? null
                      : () => _run(() => Repo.setItemStatus(i, next)),
                  icon: const Icon(Icons.check, size: 18),
                  label: Text(next.actionLabel),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _stepDots(ItemStatus s) {
    const steps = [
      ItemStatus.requested,
      ItemStatus.purchased,
      ItemStatus.arrived,
      ItemStatus.delivered
    ];
    return Row(
      children: [
        for (var k = 0; k < steps.length; k++) ...[
          Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: s.index >= steps[k].index ? GH.burgundy : GH.sand,
            ),
          ),
          if (k < steps.length - 1)
            Container(
              width: 16,
              height: 2,
              color: s.index > steps[k].index ? GH.burgundy : GH.sand,
            ),
        ],
      ],
    );
  }
}
