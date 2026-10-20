import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';

import '../data/api.dart';

import '../data/rates.dart';
import '../data/store.dart';
import '../format.dart';
import '../messages.dart';
import '../models.dart';
import '../ui/colors.dart';
import '../ui/kit.dart';
import 'order_form_page.dart' show paymentMethods;
import 'price_entry.dart';

// ───────────────────────── Item add / edit ─────────────────────────

class ItemFormPage extends StatefulWidget {
  const ItemFormPage({super.key, required this.orderId, this.item});

  final String orderId;
  final OrderItem? item;

  @override
  State<ItemFormPage> createState() => _ItemFormPageState();
}

class _ItemFormPageState extends State<ItemFormPage> {
  late final _brand = TextEditingController(text: widget.item?.brand);
  late final _name = TextEditingController(text: widget.item?.name);
  late final _details = TextEditingController(text: widget.item?.details);
  late final _price = PriceDraft(item: widget.item);
  bool _saving = false;

  @override
  void dispose() {
    _brand.dispose();
    _name.dispose();
    _details.dispose();
    _price.dispose();
    super.dispose();
  }

  String? _clean(TextEditingController c) =>
      c.text.trim().isEmpty ? null : c.text.trim();

  Future<void> _save() async {
    if (_name.text.trim().isEmpty) {
      toast(context, 'اكتب اسم القطعة', error: true);
      return;
    }
    setState(() => _saving = true);
    try {
      await Store.i.saveItem(
        id: widget.item?.id,
        orderId: widget.orderId,
        name: _name.text.trim(),
        brand: _clean(_brand),
        details: _clean(_details),
        price: _price.omrValue,
        pricing: _price.toMap(),
      );
      await _price.remember();
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        toast(context, errorText(e), error: true);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return GHPage(
      title: widget.item == null ? 'قطعة جديدة' : 'تعديل القطعة',
      leading: NavButton('إلغاء', onPressed: () => Navigator.pop(context)),
      trailing: _saving
          ? const CupertinoActivityIndicator()
          : NavButton('حفظ', bold: true, onPressed: _save),
      children: [
        Section(children: [
          FieldRow(label: 'البراند', controller: _brand, placeholder: 'Dior'),
          FieldRow(
              label: 'القطعة',
              controller: _name,
              placeholder: 'Lady Dior',
              autofocus: widget.item == null),
          FieldRow(label: 'التفاصيل', controller: _details, placeholder: 'اختياري'),
        ]),
        Section(header: 'سعر البيع', children: _price.rows(() => setState(() {}))),
        const Padding(
          padding: EdgeInsets.fromLTRB(32, 8, 32, 0),
          child: Text('سعر البيع للعميل شامل العمولة. سعر الشراء تسجله لما تشتريها.',
              style: T.small),
        ),
      ],
    );
  }
}

// ───────────────────────── Record purchase ─────────────────────────

PurchasePlace _lastPlace = PurchasePlace.boutiqueEu;

/// Where it was bought and for how much. Private: never on the invoice.
class PurchasePage extends StatefulWidget {
  const PurchasePage({super.key, required this.item});

  final OrderItem item;

  @override
  State<PurchasePage> createState() => _PurchasePageState();
}

class _PurchasePageState extends State<PurchasePage> {
  late PurchasePlace _place;
  late String _currency;
  late final TextEditingController _price;
  late final TextEditingController _rate;
  bool _saving = false;
  bool _scanning = false;
  String? _scanNote;

  /// Photo of the boutique receipt: saved on the piece, and its total and
  /// currency filled in here (checked by you before saving).
  Future<void> _scanReceipt() async {
    final source = await actionSheet<ImageSource>(context, title: 'صورة الإيصال', actions: const [
      SheetAction('الكاميرا', ImageSource.camera),
      SheetAction('من الصور', ImageSource.gallery),
    ]);
    if (source == null) return;
    final file = await ImagePicker().pickImage(source: source, maxWidth: 1800, imageQuality: 85);
    if (file == null) return;
    final bytes = await file.readAsBytes();
    setState(() {
      _scanning = true;
      _scanNote = null;
    });
    try {
      Store.i.uploadItemPhoto(widget.item, 'receipt', bytes).ignore();
      final res = await Api.i.upload('/ps/receipt-scan', 'file', bytes);
      if (!mounted) return;
      final total = (res['total'] as num?)?.toDouble();
      final cur = (res['currency'] as String?)?.toUpperCase();
      setState(() {
        _scanning = false;
        if (total != null) _price.text = total.toStringAsFixed(2);
        if (cur != null && defaultRates.containsKey(cur) && cur != _currency) {
          final match = PurchasePlace.values.where((p) => p != PurchasePlace.other && p.currency == cur);
          _place = match.isNotEmpty && match.first == _place ? _place : PurchasePlace.other;
          _currency = cur;
          _rate.text = Rates.i.rateText(cur);
        }
        _scanNote = 'من الإيصال${res['store'] != null ? ' (${res['store']})' : ''}: ${total?.toStringAsFixed(2) ?? '—'} ${cur ?? ''} · راجعه قبل الحفظ';
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _scanning = false);
      toast(context, errorText(e), error: true);
    }
  }

  @override
  void initState() {
    super.initState();
    final i = widget.item;
    _place = i.purchasePlace ??
        (i.listCurrency == 'AED'
            ? PurchasePlace.dubai
            : i.listCurrency == 'EUR'
                ? PurchasePlace.boutiqueEu
                : _lastPlace);
    _currency = i.costCurrency ?? _place.currency;
    final guess = i.costAmount ??
        (i.listCurrency == _currency ? i.listPrice : null);
    _price = TextEditingController(
        text: guess == null ? '' : guess.toStringAsFixed(2));
    _rate = TextEditingController(
        text: i.costRate?.toString() ?? Rates.i.rateText(_currency));
  }

  @override
  void dispose() {
    _price.dispose();
    _rate.dispose();
    super.dispose();
  }

  void _choosePlace(PurchasePlace p) {
    setState(() {
      _place = p;
      if (p != PurchasePlace.other) {
        _currency = p.currency;
        _rate.text = Rates.i.rateText(_currency);
      }
    });
  }

  Future<void> _pickCurrency() async {
    final c = await actionSheet<String>(context,
        title: 'العملة',
        actions: defaultRates.keys.map((c) => SheetAction(c, c)).toList());
    if (c == null) return;
    setState(() {
      _currency = c;
      _rate.text = Rates.i.rateText(c);
    });
  }

  Future<void> _save() async {
    final price = parseAmount(_price.text) ?? 0;
    final rate = parseAmount(_rate.text) ?? 0;
    if (price <= 0) {
      toast(context, 'اكتب سعر الشراء', error: true);
      return;
    }
    if (rate <= 0) {
      toast(context, 'سعر الصرف غير صحيح', error: true);
      return;
    }
    setState(() => _saving = true);
    try {
      await Store.i.recordPurchase(widget.item,
          place: _place, price: price, currency: _currency, rate: rate);
      _lastPlace = _place;
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        toast(context, errorText(e), error: true);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final price = parseAmount(_price.text) ?? 0;
    final rate = parseAmount(_rate.text) ?? 0;
    final pct = _place.taxFreePct;
    return GHPage(
      title: 'تسجيل الشراء',
      leading: NavButton('إلغاء', onPressed: () => Navigator.pop(context)),
      trailing: _saving
          ? const CupertinoActivityIndicator()
          : NavButton('دفعت', bold: true, onPressed: _save),
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(32, 0, 32, 0),
          child: Text(widget.item.title, style: T.sub),
        ),
        Section(
          footer: _scanNote ?? 'صوّر الإيصال ونعبي السعر والعملة عنك، وتنحفظ الصورة مع القطعة.',
          children: [
            Tile(
              leading: const IconBox(CupertinoIcons.doc_text_viewfinder, color: GH.burgundy),
              title: _scanning ? 'نقرأ الإيصال…' : 'اقرأ السعر من الإيصال',
              trailing: _scanning ? const CupertinoActivityIndicator() : null,
              onTap: _scanning ? null : _scanReceipt,
            ),
          ],
        ),
        Section(
          header: 'وين اشتريتها؟',
          children: [
            Segments<PurchasePlace>(
              value: _place,
              options: {for (final p in PurchasePlace.values) p: p.label},
              onChanged: _choosePlace,
            ),
          ],
        ),
        Section(
          children: [
            if (_place == PurchasePlace.other)
              PickerRow(label: 'العملة', value: _currency, onTap: _pickCurrency),
            AmountRow(
              label: 'سعر الشراء',
              controller: _price,
              suffix: _currency,
              autofocus: widget.item.costAmount == null,
              onChanged: (_) => setState(() {}),
            ),
            AmountRow(
              label: 'سعر الصرف',
              controller: _rate,
              suffix: 'ر.ع / $_currency',
              onChanged: (_) => setState(() {}),
            ),
          ],
          footer: Rates.i.isLive
              ? 'سعر الصرف من السوق اليوم، وتقدر تعدّله.'
              : 'سعر صرف تقريبي، عدّله إذا تبي.',
        ),
        Section(
          children: [
            KV('بالريال', omr(price * rate)),
            KV(
              pct > 0
                  ? 'تاكس فري المفروض (${pct.toStringAsFixed(0)}٪)'
                  : 'تاكس فري',
              pct > 0 ? money(price * pct / 100, _currency) : 'ما في',
              strong: pct > 0,
              color: pct > 0 ? GH.green : GH.secondary,
            ),
            KV('سعر البيع للعميل', omr(widget.item.price), color: GH.secondary),
            if (price > 0 && rate > 0)
              KV('ربحك التقديري', omr(widget.item.price - price * rate),
                  color: GH.burgundy),
          ],
          footer: 'هذي البيانات لك بس، وما تطلع في الفاتورة. المبلغ ينخصم من رصيد العميل.',
        ),
      ],
    );
  }
}

// ───────────────────────── Payment ─────────────────────────

class PaymentFormPage extends StatefulWidget {
  const PaymentFormPage({super.key, required this.order});

  final Order order;

  @override
  State<PaymentFormPage> createState() => _PaymentFormPageState();
}

class _PaymentFormPageState extends State<PaymentFormPage> {
  late final _amount = TextEditingController(
      text: widget.order.hasBalance
          ? plainOmr(widget.order.remaining).replaceAll(',', '')
          : '');
  final _note = TextEditingController();
  String _method = paymentMethods.first;
  DateTime _date = DateTime.now();
  bool _saving = false;

  @override
  void dispose() {
    _amount.dispose();
    _note.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final v = parseAmount(_amount.text) ?? 0;
    if (v <= 0) {
      toast(context, 'اكتب المبلغ', error: true);
      return;
    }
    setState(() => _saving = true);
    try {
      await Store.i.addPayment(widget.order.id,
          amount: v,
          method: _method,
          paidOn: _date,
          note: _note.text.trim().isEmpty ? null : _note.text.trim());
      if (mounted) {
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _saving = false);
        toast(context, errorText(e), error: true);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return GHPage(
      title: 'تسجيل دفعة',
      leading: NavButton('إلغاء', onPressed: () => Navigator.pop(context)),
      trailing: _saving
          ? const CupertinoActivityIndicator()
          : NavButton('حفظ', bold: true, onPressed: _save),
      children: [
        Section(children: [
          AmountRow(label: 'المبلغ', controller: _amount, autofocus: true),
          PickerRow(
            label: 'الطريقة',
            value: _method,
            onTap: () async {
              final m = await actionSheet<String>(context,
                  actions: paymentMethods.map((m) => SheetAction(m, m)).toList());
              if (m != null) setState(() => _method = m);
            },
          ),
          PickerRow(
            label: 'التاريخ',
            value: dateStr(_date),
            onTap: () async {
              final d = await pickDate(context, _date);
              if (d != null) setState(() => _date = d);
            },
          ),
          FieldRow(label: 'ملاحظة', controller: _note, placeholder: 'اختياري'),
        ]),
        Padding(
          padding: const EdgeInsets.fromLTRB(32, 8, 32, 0),
          child: Text('المتبقي حالياً: ${omr(widget.order.remaining)}',
              style: T.small),
        ),
      ],
    );
  }
}

// ───────────────────────── WhatsApp message ─────────────────────────

class MessagePage extends StatefulWidget {
  const MessagePage({super.key, required this.order, required this.template});

  final Order order;
  final MsgTemplate template;

  @override
  State<MessagePage> createState() => _MessagePageState();
}

class _MessagePageState extends State<MessagePage> {
  late final _text = TextEditingController(
      text: widget.template.build(
          widget.order, Store.i.customer(widget.order.customerId)));

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    final c = Store.i.customer(widget.order.customerId);
    final phone = waPhone(c?.phone);
    final encoded = Uri.encodeComponent(_text.text);
    final uri = Uri.parse(phone == null
        ? 'https://wa.me/?text=$encoded'
        : 'https://wa.me/$phone?text=$encoded');
    final ok = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!mounted) return;
    if (ok) {
      Navigator.pop(context);
    } else {
      await Clipboard.setData(ClipboardData(text: _text.text));
      if (mounted) toast(context, 'ما قدرت أفتح واتساب، نسخت الرسالة');
    }
  }

  @override
  Widget build(BuildContext context) {
    return GHPage(
      title: widget.template.title,
      leading: NavButton('إلغاء', onPressed: () => Navigator.pop(context)),
      bottom: Row(
        children: [
          Expanded(
            child: SecondaryButton('نسخ',
                icon: CupertinoIcons.doc_on_doc,
                onPressed: () async {
                  await Clipboard.setData(ClipboardData(text: _text.text));
                  if (mounted) toast(context, 'تم النسخ');
                }),
          ),
          const SizedBox(width: 10),
          Expanded(
            flex: 2,
            child: PrimaryButton('إرسال واتساب',
                icon: CupertinoIcons.paperplane_fill, onPressed: _send),
          ),
        ],
      ),
      children: [
        Section(
          footer: 'تقدر تعدّل الرسالة قبل الإرسال.',
          children: [
            CupertinoTextField(
              controller: _text,
              minLines: 8,
              maxLines: 20,
              padding: const EdgeInsets.all(16),
              decoration: null,
              style: const TextStyle(fontSize: 16, color: GH.label, height: 1.45),
            ),
          ],
        ),
      ],
    );
  }
}

// ───────────────────────── Photo viewer ─────────────────────────

class PhotoPage extends StatelessWidget {
  const PhotoPage({super.key, required this.path, required this.title});

  final String path;
  final String title;

  @override
  Widget build(BuildContext context) {
    return CupertinoPageScaffold(
      backgroundColor: const Color(0xFF000000),
      navigationBar: CupertinoNavigationBar(
        middle: Text(title, style: const TextStyle(color: CupertinoColors.white)),
        backgroundColor: const Color(0xCC000000),
        border: null,
        transitionBetweenRoutes: false,
      ),
      child: Center(
        child: FutureBuilder<String>(
          future: Store.i.photoUrl(path),
          builder: (context, snap) {
            if (!snap.hasData) {
              return const CupertinoActivityIndicator(color: CupertinoColors.white);
            }
            return InteractiveViewer(
              maxScale: 5,
              child: Image.network(snap.data!, fit: BoxFit.contain),
            );
          },
        ),
      ),
    );
  }
}

/// Small rounded thumbnail of a stored photo.
class Thumb extends StatelessWidget {
  const Thumb(this.path, {super.key, this.size = 44});

  final String path;
  final double size;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(8),
      child: SizedBox(
        width: size,
        height: size,
        child: FutureBuilder<String>(
          future: Store.i.photoUrl(path),
          builder: (context, snap) => snap.hasData
              ? Image.network(snap.data!, fit: BoxFit.cover)
              : Container(color: GH.bg),
        ),
      ),
    );
  }
}
