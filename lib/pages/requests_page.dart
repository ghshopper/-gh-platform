import 'package:flutter/cupertino.dart';
import 'package:url_launcher/url_launcher.dart';

import '../data/store.dart';
import '../format.dart';
import '../messages.dart';
import '../models.dart';
import '../ui/colors.dart';
import '../ui/delivery_picker.dart';
import '../ui/kit.dart';
import 'item_pages.dart' show MessagePage;
import 'order_detail_page.dart';
import 'order_form_page.dart' show paymentMethods;

/// Customers' "find me this piece" requests (app and website). A found piece
/// becomes a real order for the customer with one form.
class RequestsPage extends StatelessWidget {
  const RequestsPage({super.key});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Store.i,
      builder: (context, _) {
        final all = Store.i.requests;
        final open = all.where((r) => r.isOpen).toList();
        final done = all.where((r) => !r.isOpen).toList();
        return GHPage(
          title: 'طلبات القطع',
          previousPageTitle: 'رجوع',
          onRefresh: Store.i.refresh,
          children: [
            if (all.isEmpty)
              const EmptyState(
                icon: CupertinoIcons.sparkles,
                title: 'ما في طلبات',
                message: 'لما عميل يطلب قطعة من التطبيق أو الموقع تطلع هنا.',
              ),
            if (open.isNotEmpty)
              Section(
                header: 'تنتظرك · ${open.length}',
                children: open.map((r) => RequestTile(r)).toList(),
              ),
            if (done.isNotEmpty)
              Section(
                header: 'آخر ٣٠ يوم',
                children: done.map((r) => RequestTile(r)).toList(),
              ),
          ],
        );
      },
    );
  }
}

class RequestTile extends StatelessWidget {
  const RequestTile(this.r, {super.key});

  final PieceRequest r;

  @override
  Widget build(BuildContext context) {
    return Tile(
      leading: _Photo(r.imageUrl, size: 44),
      title: r.name,
      subtitle: [r.customerName, dateStr(r.createdAt)].join(' · '),
      trailing: Badge(r.statusLabel, color: r.statusColor),
      onTap: () => pushPage(context, RequestDetailPage(id: r.id)),
    );
  }
}

class _Photo extends StatelessWidget {
  const _Photo(this.url, {this.size = 44});

  final String? url;
  final double size;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(size * 0.2),
      child: Container(
        width: size,
        height: size,
        color: GH.sand,
        child: url == null
            ? Icon(CupertinoIcons.photo, size: size * 0.45, color: GH.gold)
            : Image.network(url!, fit: BoxFit.cover,
                errorBuilder: (_, __, ___) =>
                    Icon(CupertinoIcons.photo, size: size * 0.45, color: GH.gold)),
      ),
    );
  }
}

class RequestDetailPage extends StatelessWidget {
  const RequestDetailPage({super.key, required this.id});

  final String id;

  Future<void> _convert(BuildContext context, PieceRequest r) async {
    final res = await presentForm<({String orderId, String payUrl})>(
        context, ConvertRequestPage(request: r));
    if (res == null || !context.mounted) return;
    pushPage(context, OrderDetailPage(orderId: res.orderId));
    final o = Store.i.order(res.orderId);
    if (o != null && context.mounted) {
      final send = await confirm(context, 'تم إنشاء الطلب ${o.invoiceNo}',
          message: 'ترسل للعميل رابط الدفع على واتساب؟');
      if (send && context.mounted) {
        presentForm(context, MessagePage(order: o, template: payLinkTemplate(res.payUrl)));
      }
    }
  }

  Future<void> _status(BuildContext context, PieceRequest r, String s) async {
    try {
      await Store.i.setRequestStatus(r.id, s);
    } catch (e) {
      if (context.mounted) toast(context, errorText(e), error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: Store.i,
      builder: (context, _) {
        PieceRequest? r;
        for (final x in Store.i.requests) {
          if (x.id == id) r = x;
        }
        if (r == null) {
          return const GHPage(title: 'الطلب', children: [
            EmptyState(icon: CupertinoIcons.doc_text, title: 'الطلب غير موجود'),
          ]);
        }
        final req = r;
        final phone = waPhone(req.customerPhone);
        return GHPage(
          title: 'طلب قطعة',
          previousPageTitle: 'رجوع',
          bottom: req.status == 'ordered' && req.orderId != null
              ? PrimaryButton('فتح الطلب',
                  icon: CupertinoIcons.doc_text,
                  onPressed: () => pushPage(context, OrderDetailPage(orderId: req.orderId!)))
              : req.isOpen
                  ? PrimaryButton('تحويل لطلب للعميل',
                      icon: CupertinoIcons.arrow_right_arrow_left,
                      onPressed: () => _convert(context, req))
                  : null,
          children: [
            if (req.imageUrl != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: AspectRatio(
                    aspectRatio: 1,
                    child: Image.network(req.imageUrl!, fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => Container(color: GH.sand)),
                  ),
                ),
              ),
            Section(children: [
              Tile(
                title: req.name,
                subtitle: [if (req.brand != null) req.brand!, if (req.category != null) req.category!].join(' · '),
                trailing: Badge(req.statusLabel, color: req.statusColor),
                chevron: false,
              ),
              if (req.description != null)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
                  child: Text(req.description!, style: T.body),
                ),
              if (req.url != null)
                Tile(
                  leading: const IconBox(CupertinoIcons.link, color: GH.blue),
                  title: 'رابط القطعة',
                  subtitle: req.url,
                  onTap: () => launchUrl(Uri.parse(req.url!), mode: LaunchMode.externalApplication),
                ),
            ]),
            Section(header: 'العميل', children: [
              Tile(
                leading: Avatar(req.customerName, size: 32),
                title: req.customerName,
                subtitle: req.customerPhone,
                chevron: false,
              ),
              if (phone != null)
                Tile(
                  leading: const IconBox(CupertinoIcons.chat_bubble_fill, color: Color(0xFF25D366)),
                  title: 'واتساب',
                  onTap: () => launchUrl(Uri.parse('https://wa.me/$phone'),
                      mode: LaunchMode.externalApplication),
                ),
            ]),
            if (req.isOpen)
              Section(header: 'الحالة', children: [
                if (req.status == 'pending')
                  Tile(
                    title: 'أبحث عنها',
                    leading: const IconBox(CupertinoIcons.search, color: GH.amber),
                    onTap: () => _status(context, req, 'reviewing'),
                  ),
                Tile(
                  title: 'غير متوفرة',
                  leading: const IconBox(CupertinoIcons.xmark, color: GH.red),
                  onTap: () => _status(context, req, 'not_found'),
                ),
              ]),
            Padding(
              padding: const EdgeInsets.fromLTRB(32, 10, 32, 0),
              child: Text('وصل ${dateStr(req.createdAt)}', style: T.small),
            ),
          ],
        );
      },
    );
  }
}

/// Price and delivery for the found piece; creates the customer's order.
class ConvertRequestPage extends StatefulWidget {
  const ConvertRequestPage({super.key, required this.request});

  final PieceRequest request;

  @override
  State<ConvertRequestPage> createState() => _ConvertRequestPageState();
}

class _ConvertRequestPageState extends State<ConvertRequestPage> {
  late final _brand = TextEditingController(text: widget.request.brand);
  late final _name = TextEditingController(text: widget.request.name);
  late final _details = TextEditingController();
  final _price = TextEditingController();
  final _delivery = TextEditingController();
  final _deposit = TextEditingController();
  DeliveryMethod _method = DeliveryMethod.home;
  String _depositMethod = paymentMethods.first;
  bool _notify = true;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _delivery.text = plainOmr(Store.i.settings.feeFor(_method)).replaceAll(',', '');
  }

  @override
  void dispose() {
    for (final c in [_brand, _name, _details, _price, _delivery, _deposit]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    final price = parseAmount(_price.text) ?? 0;
    if (_name.text.trim().isEmpty || price <= 0) {
      toast(context, 'اكتب اسم القطعة وسعرها', error: true);
      return;
    }
    setState(() => _saving = true);
    try {
      final res = await Store.i.convertRequest(widget.request.id, {
        'brand': _brand.text.trim().isEmpty ? null : _brand.text.trim(),
        'name': _name.text.trim(),
        'details': _details.text.trim().isEmpty ? null : _details.text.trim(),
        'price': price,
        'delivery_fee': parseAmount(_delivery.text) ?? 0,
        'delivery_method': _method.key,
        'deposit': parseAmount(_deposit.text) ?? 0,
        'deposit_method': _depositMethod,
        'notify': _notify,
      });
      if (mounted) Navigator.pop(context, res);
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
    final delivery = parseAmount(_delivery.text) ?? 0;
    return GHPage(
      title: 'تحويل لطلب',
      leading: NavButton('إلغاء', onPressed: () => Navigator.pop(context)),
      trailing: _saving
          ? const CupertinoActivityIndicator()
          : NavButton('إنشاء', bold: true, onPressed: _save),
      children: [
        Section(
          header: 'القطعة · لـ ${widget.request.customerName}',
          children: [
            FieldRow(label: 'البراند', controller: _brand, placeholder: 'Chanel'),
            FieldRow(label: 'القطعة', controller: _name),
            FieldRow(label: 'التفاصيل', controller: _details, placeholder: 'المقاس، اللون…'),
            AmountRow(label: 'السعر للعميل', controller: _price, onChanged: (_) => setState(() {})),
          ],
        ),
        Section(
          header: 'التوصيل والعربون',
          children: [
            DeliveryPicker(
              value: _method,
              onChanged: (m) => setState(() {
                _method = m;
                _delivery.text = plainOmr(Store.i.settings.feeFor(m)).replaceAll(',', '');
              }),
            ),
            AmountRow(label: 'رسوم التوصيل', controller: _delivery, onChanged: (_) => setState(() {})),
            AmountRow(label: 'العربون المستلم', controller: _deposit),
            PickerRow(
              label: 'طريقة العربون',
              value: _depositMethod,
              onTap: () async {
                final m = await actionSheet<String>(context,
                    title: 'طريقة الدفع',
                    actions: paymentMethods.map((m) => SheetAction(m, m)).toList());
                if (m != null) setState(() => _depositMethod = m);
              },
            ),
          ],
        ),
        Section(
          footer: 'الطلب يدخل الطلبات هنا، ويطلع للعميل في «طلباتي» في التطبيق والموقع مع زر الدفع.',
          children: [
            SwitchRow(
              label: 'إشعار للعميل في التطبيق',
              value: _notify,
              onChanged: (v) => setState(() => _notify = v),
            ),
          ],
        ),
        Section(children: [
          KV('القطعة', omr(price)),
          KV('التوصيل', omr(delivery)),
          KV('الإجمالي', omr(price + delivery), strong: true, color: GH.burgundy),
        ]),
      ],
    );
  }
}
