import 'dart:async';

import 'package:flutter/cupertino.dart';

import '../data/api.dart';
import '../format.dart';
import '../ui/colors.dart';
import '../ui/kit.dart';
import 'story_page.dart';

/// A store product as the admin app shows and edits it.
class AdminProduct {
  AdminProduct(this.raw);

  final Map<String, dynamic> raw;

  static double _n(dynamic v) => double.tryParse('${v ?? ''}') ?? 0;

  int get id => int.tryParse('${raw['id']}') ?? 0;
  String get nameAr => (raw['name_ar'] ?? '').toString();
  String get nameEn => (raw['name_en'] ?? '').toString();
  String get name => nameAr.trim().isNotEmpty ? nameAr : nameEn;
  String get brand => (raw['brand_name_en'] ?? raw['brand_name_ar'] ?? '').toString();
  double get price => _n(raw['price']);
  double? get comparePrice => _n(raw['compare_price']) > 0 ? _n(raw['compare_price']) : null;
  int get stock => int.tryParse('${raw['stock_quantity'] ?? 0}') ?? 0;
  bool get onOrder => raw['availability'] == 'on_order';
  bool get active => raw['status'] == 'active';
  String? get gender => raw['gender']?.toString();
  String? get origin => raw['origin']?.toString();
  bool get featured => raw['is_featured'] == true || raw['is_featured'] == 1;
  int? get categoryId => int.tryParse('${raw['category_id'] ?? ''}');
  String? get categoryName {
    final s = (raw['category_name'] ?? '').toString();
    return s.isEmpty ? null : s;
  }

  /// The same product with fields the server sent back merged in.
  AdminProduct merged(Map<String, dynamic> changes) => AdminProduct({...raw, ...changes});
  String? get image {
    final s = (raw['primary_image'] ?? '').toString();
    return s.isEmpty ? null : storyImageUrl(s);
  }

  /// A discount counts while it is lower than the price.
  bool get onSale => comparePrice != null && comparePrice! < price;
  double get sellPrice => onSale ? comparePrice! : price;

  StoryProduct toStory() => StoryProduct.fromJson(raw);
}

// ───────────────────────── Product grid ─────────────────────────

/// Search + grid of every store product, 60 at a time. Used by the products
/// page and the story picker.
class ProductBrowser extends StatefulWidget {
  const ProductBrowser({super.key, required this.onTap, this.isSelected, this.reloadKey, this.initial, this.onPrice});

  final void Function(AdminProduct p) onTap;

  /// Quick price change (products page only): price button / long press.
  final void Function(AdminProduct p)? onPrice;
  final bool Function(AdminProduct p)? isSelected;

  /// Change it to reload (after an edit).
  final Object? reloadKey;

  /// Ready products (screenshots); nothing is loaded then.
  final List<AdminProduct>? initial;

  @override
  State<ProductBrowser> createState() => ProductBrowserState();
}

class ProductBrowserState extends State<ProductBrowser> {
  final _search = TextEditingController();
  List<AdminProduct> _items = [];
  bool _loading = true;
  bool _more = false;
  int _page = 1;
  int _total = 0;
  String? _error;
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    final init = widget.initial;
    if (init != null) {
      _items = init;
      _total = init.length;
      _loading = false;
    } else {
      load();
    }
  }

  @override
  void didUpdateWidget(covariant ProductBrowser old) {
    super.didUpdateWidget(old);
    if (old.reloadKey != widget.reloadKey) load();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  /// Replaces one product after it was edited.
  void replace(AdminProduct p) {
    setState(() => _items = [for (final x in _items) x.id == p.id ? p : x]);
  }

  Future<void> load({bool next = false}) async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final q = Uri.encodeQueryComponent(_search.text.trim());
      final page = next ? _page + 1 : 1;
      final res = await Api.i.get('/admin/products?per_page=60&page=$page${q.isEmpty ? '' : '&search=$q'}');
      final rows = res is Map ? (res['data'] ?? []) : res;
      final list = (rows as List).whereType<Map>().map((e) => AdminProduct(Map<String, dynamic>.from(e))).toList();
      if (mounted) {
        setState(() {
          _items = next ? [..._items, ...list] : list;
          _page = page;
          _total = res is Map ? int.tryParse('${res['total'] ?? ''}') ?? _items.length : _items.length;
          _more = res is Map && (int.tryParse('${res['last_page'] ?? 1}') ?? 1) > page;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = errorText(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
          child: CupertinoSearchTextField(
            controller: _search,
            placeholder: 'ابحث باسم المنتج أو البراند',
            backgroundColor: GH.card,
            onChanged: (_) {
              _debounce?.cancel();
              _debounce = Timer(const Duration(milliseconds: 450), load);
            },
          ),
        ),
        if (_loading && _items.isEmpty)
          const Loading()
        else if (_error != null && _items.isEmpty)
          EmptyState(
            icon: CupertinoIcons.wifi_exclamationmark,
            title: 'ما قدرنا نجيب المنتجات',
            message: _error,
            action: SecondaryButton('حاول مرة ثانية', onPressed: load),
          )
        else if (_items.isEmpty)
          const EmptyState(icon: CupertinoIcons.search, title: 'ما في منتجات بهذا الاسم')
        else ...[
          Padding(
            padding: const EdgeInsets.fromLTRB(22, 16, 22, 8),
            child: Text('$_total منتج', style: T.header),
          ),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: _items.length,
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              childAspectRatio: 0.64,
            ),
            itemBuilder: (_, i) {
              final p = _items[i];
              return ProductCard(
                p,
                selected: widget.isSelected?.call(p),
                onTap: () => widget.onTap(p),
                onPrice: widget.onPrice == null ? null : () => widget.onPrice!(p),
              );
            },
          ),
          if (_more)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 0),
              child: SecondaryButton(_loading ? 'يحمّل…' : 'عرض المزيد',
                  onPressed: _loading ? null : () => load(next: true)),
            ),
        ],
      ],
    );
  }
}

class ProductCard extends StatelessWidget {
  const ProductCard(this.p, {super.key, required this.onTap, this.selected, this.onPrice});

  final AdminProduct p;
  final VoidCallback onTap;
  final VoidCallback? onPrice;

  /// null = not choosing; true/false = chosen or not.
  final bool? selected;

  @override
  Widget build(BuildContext context) {
    final on = selected == true;
    return GestureDetector(
      onTap: onTap,
      onLongPress: onPrice,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        decoration: BoxDecoration(
          color: GH.card,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(color: on ? GH.burgundy : const Color(0x00FFFFFF), width: 2),
          boxShadow: GH.shadow,
        ),
        clipBehavior: Clip.antiAlias,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Expanded(
              child: Stack(children: [
                Positioned.fill(
                  child: Container(
                    color: GH.imageBg,
                    padding: const EdgeInsets.all(12),
                    child: p.image == null
                        ? const Icon(CupertinoIcons.photo, color: GH.tertiary, size: 30)
                        : Image.network(p.image!,
                            fit: BoxFit.contain,
                            errorBuilder: (_, __, ___) =>
                                const Icon(CupertinoIcons.photo, color: GH.tertiary, size: 30)),
                  ),
                ),
                PositionedDirectional(
                  top: 8,
                  start: 8,
                  child: Row(children: [
                    if (!p.active) const _Pill('مخفي', color: GH.secondary),
                    if (p.onSale) ...[
                      if (!p.active) const SizedBox(width: 4),
                      const _Pill('خصم', color: GH.burgundy),
                    ],
                  ]),
                ),
                if (onPrice != null)
                  PositionedDirectional(
                    bottom: 6,
                    end: 6,
                    child: GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: onPrice,
                      child: Container(
                        width: 32,
                        height: 32,
                        decoration: BoxDecoration(color: GH.card, shape: BoxShape.circle, boxShadow: GH.shadow),
                        child: const Icon(CupertinoIcons.tag_fill, size: 15, color: GH.burgundy),
                      ),
                    ),
                  ),
                if (selected != null)
                  PositionedDirectional(
                    top: 8,
                    end: 8,
                    child: Container(
                      width: 26,
                      height: 26,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: on ? GH.burgundy : const Color(0xE6FFFFFF),
                        border: Border.all(color: on ? GH.burgundy : GH.tertiary, width: 1.5),
                      ),
                      child: on ? const Icon(CupertinoIcons.checkmark, size: 15, color: CupertinoColors.white) : null,
                    ),
                  ),
              ]),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 10, 12, 12),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                if (p.brand.isNotEmpty)
                  Text(p.brand.toUpperCase(),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      textDirection: TextDirection.ltr,
                      style: const TextStyle(fontSize: 10.5, letterSpacing: 1.2, fontWeight: FontWeight.w600, color: GH.gold)),
                const SizedBox(height: 2),
                Text(p.name,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 13, height: 1.3, color: GH.label)),
                const SizedBox(height: 6),
                Row(children: [
                  Flexible(
                    child: Text(omr(p.sellPrice),
                        maxLines: 1,
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: GH.burgundy)),
                  ),
                  if (p.onSale) ...[
                    const SizedBox(width: 6),
                    Flexible(
                      child: Text(omr(p.price).replaceAll(' ر.ع', ''),
                          maxLines: 1,
                          style: const TextStyle(
                              fontSize: 11.5, color: GH.tertiary, decoration: TextDecoration.lineThrough)),
                    ),
                  ],
                ]),
              ]),
            ),
          ],
        ),
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill(this.label, {required this.color});
  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
        decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(20)),
        child: Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: CupertinoColors.white)),
      );
}

// ───────────────────────── Products page ─────────────────────────

class ProductsPage extends StatefulWidget {
  const ProductsPage({super.key, this.initial});

  final List<AdminProduct>? initial;

  @override
  State<ProductsPage> createState() => _ProductsPageState();
}

class _ProductsPageState extends State<ProductsPage> {
  final _browser = GlobalKey<ProductBrowserState>();

  @override
  Widget build(BuildContext context) {
    return GHPage(
      title: 'المنتجات',
      onRefresh: () async => _browser.currentState?.load(),
      trailing: NavIcon(CupertinoIcons.camera_on_rectangle,
          onPressed: () => pushPage(context, const StoryPickPage())),
      children: [
        ProductBrowser(
          key: _browser,
          initial: widget.initial,
          onTap: (p) async {
            final changed = await pushPage<AdminProduct>(context, ProductEditPage(product: p));
            if (changed != null) _browser.currentState?.replace(changed);
          },
          onPrice: (p) async {
            final changed = await presentForm<AdminProduct>(context, QuickPricePage(product: p));
            if (changed != null) _browser.currentState?.replace(changed);
          },
        ),
      ],
    );
  }
}

// ───────────────────────── Edit one product ─────────────────────────

class ProductEditPage extends StatefulWidget {
  const ProductEditPage({super.key, required this.product});

  final AdminProduct product;

  @override
  State<ProductEditPage> createState() => _ProductEditPageState();
}

class _ProductEditPageState extends State<ProductEditPage> {
  late final p = widget.product;
  late final _nameAr = TextEditingController(text: p.nameAr);
  late final _nameEn = TextEditingController(text: p.nameEn);
  late final _price = TextEditingController(text: p.price.toStringAsFixed(3));
  late final _sale = TextEditingController(text: p.onSale ? p.comparePrice!.toStringAsFixed(3) : '');
  late final _stock = TextEditingController(text: '${p.stock}');
  late bool _onOrder = p.onOrder;
  late bool _active = p.active;
  late bool _featured = p.featured;
  late String _gender = p.gender ?? '';
  late String _origin = p.origin ?? '';
  late int? _categoryId = p.categoryId;
  late String? _categoryPath = p.categoryName;
  bool _busy = false;

  double? _num(String s) => double.tryParse(s
      .trim()
      .replaceAll(',', '.')
      .replaceAllMapped(RegExp('[٠-٩]'), (m) => '${m[0]!.codeUnitAt(0) - 0x0660}'));

  Future<void> _save() async {
    final price = _num(_price.text);
    if (price == null || price <= 0) {
      toast(context, 'اكتب السعر', error: true);
      return;
    }
    final sale = _sale.text.trim().isEmpty ? 0.0 : _num(_sale.text);
    if (sale == null || (sale > 0 && sale >= price)) {
      toast(context, 'سعر الخصم لازم يكون أقل من السعر', error: true);
      return;
    }
    setState(() => _busy = true);
    try {
      final res = await Api.i.post('/admin/products/${p.id}/quick', {
        'name_ar': _nameAr.text.trim().isEmpty ? p.name : _nameAr.text.trim(),
        'name_en': _nameEn.text.trim(),
        'price': price,
        'compare_price': sale,
        'stock_quantity': int.tryParse(_stock.text.trim()) ?? p.stock,
        'availability': _onOrder ? 'on_order' : 'instant',
        'status': _active ? 'active' : 'draft',
        'gender': _gender.isEmpty ? null : _gender,
        'origin': _origin.isEmpty ? null : _origin,
        'is_featured': _featured,
      });
      var data = res is Map && res['data'] is Map ? Map<String, dynamic>.from(res['data'] as Map) : null;
      if (_categoryId != p.categoryId && _categoryId != null) {
        final r = await Api.i.patch('/admin/products/${p.id}/quick', {'category_id': _categoryId});
        final back = r is Map && r['product'] is Map ? Map<String, dynamic>.from(r['product'] as Map) : <String, dynamic>{};
        data = {...?data, ...back, 'category_id': _categoryId, 'category_name': _categoryPath?.split(' › ').last};
      }
      if (!mounted) return;
      toast(context, 'انحفظ ✓');
      Navigator.pop(context, data == null ? null : AdminProduct(data));
    } catch (e) {
      if (mounted) {
        setState(() => _busy = false);
        toast(context, errorText(e), error: true);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return GHPage(
      title: 'تعديل المنتج',
      previousPageTitle: 'المنتجات',
      bottom: PrimaryButton('حفظ', icon: CupertinoIcons.checkmark_alt, busy: _busy, onPressed: _save),
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
          child: Container(
            height: 220,
            decoration: BoxDecoration(
              color: GH.imageBg,
              borderRadius: BorderRadius.circular(20),
            ),
            padding: const EdgeInsets.all(16),
            child: p.image == null
                ? const Icon(CupertinoIcons.photo, size: 40, color: GH.tertiary)
                : Image.network(p.image!, fit: BoxFit.contain,
                    errorBuilder: (_, __, ___) => const Icon(CupertinoIcons.photo, size: 40, color: GH.tertiary)),
          ),
        ),
        if (p.brand.isNotEmpty)
          Padding(
            padding: const EdgeInsets.fromLTRB(22, 12, 22, 0),
            child: Text(p.brand.toUpperCase(),
                textDirection: TextDirection.ltr,
                textAlign: TextAlign.start,
                style: const TextStyle(fontSize: 12, letterSpacing: 1.6, fontWeight: FontWeight.w600, color: GH.gold)),
          ),
        Section(header: 'الاسم', children: [
          FieldRow(label: 'عربي', controller: _nameAr),
          FieldRow(label: 'إنجليزي', controller: _nameEn, ltr: true),
        ]),
        Section(
          header: 'السعر',
          footer: 'اترك سعر الخصم فاضي إذا ما عليه خصم.',
          children: [
            AmountRow(label: 'السعر', controller: _price),
            AmountRow(label: 'بعد الخصم', controller: _sale),
          ],
        ),
        Section(header: 'التوفر', children: [
          Segments<bool>(
            value: _onOrder,
            options: const {false: 'تسليم فوري', true: 'بالطلب'},
            onChanged: (v) => setState(() => _onOrder = v),
          ),
          FieldRow(label: 'الكمية', controller: _stock, keyboard: TextInputType.number, ltr: true),
          SwitchRow(
            label: 'ظاهر في المتجر',
            subtitle: _active ? 'العملاء يشوفونه' : 'مخفي عن العملاء',
            value: _active,
            onChanged: (v) => setState(() => _active = v),
          ),
          SwitchRow(
            label: 'منتج مميز',
            subtitle: 'يطلع في «منتجات مميزة»',
            value: _featured,
            onChanged: (v) => setState(() => _featured = v),
          ),
        ]),
        Section(header: 'التصنيف', children: [
          Tile(
            leading: const IconBox(CupertinoIcons.square_stack_3d_up_fill, color: GH.gold),
            title: _categoryPath ?? 'بدون تصنيف',
            subtitle: 'القسم › الفئة › الفرعية',
            onTap: () async {
              final picked = await presentForm<CategoryChoice>(context, CategoryPickerPage(selected: _categoryId));
              if (picked != null) {
                setState(() {
                  _categoryId = picked.id;
                  _categoryPath = picked.path;
                });
              }
            },
          ),
        ]),
        Section(header: 'لمن', children: [
          Segments<String>(
            value: _gender,
            options: const {'women': 'نسائي', 'men': 'رجالي', 'unisex': 'للجنسين', '': 'بدون'},
            onChanged: (v) => setState(() => _gender = v),
          ),
        ]),
        Section(header: 'يُشحن من', children: [
          Segments<String>(
            value: _origin,
            options: const {'oman': 'عُمان', 'dubai': 'دبي', 'europe': 'أوروبا', '': 'تلقائي'},
            onChanged: (v) => setState(() => _origin = v),
          ),
        ]),
        Section(children: [
          Tile(
            leading: const IconBox(CupertinoIcons.camera_on_rectangle_fill, color: GH.pink),
            title: 'اعمل له ستوري',
            onTap: () => pushPage(context, StoryComposePage(products: [p.toStory()])),
          ),
        ]),
      ],
    );
  }
}

// ───────────────────────── Quick price ─────────────────────────

/// Change only the price / sale price, from the products grid.
class QuickPricePage extends StatefulWidget {
  const QuickPricePage({super.key, required this.product});

  final AdminProduct product;

  @override
  State<QuickPricePage> createState() => _QuickPricePageState();
}

class _QuickPricePageState extends State<QuickPricePage> {
  late final p = widget.product;
  late final _price = TextEditingController(text: p.price.toStringAsFixed(3));
  late final _sale = TextEditingController(text: p.onSale ? p.comparePrice!.toStringAsFixed(3) : '');
  bool _busy = false;

  double? _num(String s) => double.tryParse(normalizeDigits(s).trim().replaceAll(',', '.'));

  Future<void> _save() async {
    final price = _num(_price.text);
    if (price == null || price <= 0) {
      toast(context, 'اكتب السعر', error: true);
      return;
    }
    final sale = _sale.text.trim().isEmpty ? 0.0 : _num(_sale.text);
    if (sale == null || (sale > 0 && sale >= price)) {
      toast(context, 'سعر الخصم لازم يكون أقل من السعر', error: true);
      return;
    }
    setState(() => _busy = true);
    try {
      final res = await Api.i.patch('/admin/products/${p.id}/quick', {'price': price, 'compare_price': sale});
      final back = res is Map && res['product'] is Map ? Map<String, dynamic>.from(res['product'] as Map) : <String, dynamic>{};
      if (!mounted) return;
      toast(context, 'تغيّر السعر ✓');
      Navigator.pop(context, p.merged({'price': price, 'compare_price': sale, ...back}));
    } catch (e) {
      if (mounted) {
        setState(() => _busy = false);
        toast(context, errorText(e), error: true);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return GHPage(
      title: 'تغيير السعر',
      leading: NavButton('إلغاء', onPressed: () => Navigator.pop(context)),
      bottom: PrimaryButton('حفظ', icon: CupertinoIcons.checkmark_alt, busy: _busy, onPressed: _save),
      children: [
        Section(children: [
          Tile(
            leading: ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: Container(
                width: 44,
                height: 44,
                color: GH.imageBg,
                child: p.image == null
                    ? const Icon(CupertinoIcons.photo, size: 20, color: GH.tertiary)
                    : Image.network(p.image!, fit: BoxFit.contain,
                        errorBuilder: (_, __, ___) => const Icon(CupertinoIcons.photo, size: 20, color: GH.tertiary)),
              ),
            ),
            title: p.name,
            subtitle: p.brand,
            chevron: false,
          ),
        ]),
        Section(
          header: 'السعر',
          footer: 'اترك سعر الخصم فاضي إذا ما عليه خصم.',
          children: [
            AmountRow(label: 'السعر', controller: _price, autofocus: true),
            AmountRow(label: 'بعد الخصم', controller: _sale),
          ],
        ),
      ],
    );
  }
}

// ───────────────────────── Category picker ─────────────────────────

class CategoryChoice {
  const CategoryChoice(this.id, this.path);
  final int id;

  /// «القسم › الفئة › الفرعية»
  final String path;
}

class _Cat {
  _Cat(this.id, this.parentId, this.name, this.count);
  final int id;
  final int? parentId;
  final String name;
  final int count;
  final children = <_Cat>[];
}

/// Sections → categories → sub-categories, from GET /admin/categories
/// (flat rows with parent_id). Returns the picked one.
class CategoryPickerPage extends StatefulWidget {
  const CategoryPickerPage({super.key, this.selected, this.initialRows});

  final int? selected;

  /// Ready rows (screenshots); nothing is loaded then.
  final List<Map<String, dynamic>>? initialRows;

  static List<Map<String, dynamic>>? _cache;

  @override
  State<CategoryPickerPage> createState() => _CategoryPickerPageState();
}

class _CategoryPickerPageState extends State<CategoryPickerPage> {
  List<_Cat> _roots = [];
  final _byId = <int, _Cat>{};
  bool _loading = true;
  String? _error;
  String _q = '';

  @override
  void initState() {
    super.initState();
    final rows = widget.initialRows ?? CategoryPickerPage._cache;
    if (rows != null) {
      _build(rows);
      _loading = false;
      if (widget.initialRows == null) _load(quiet: true);
    } else {
      _load();
    }
  }

  void _build(List<Map<String, dynamic>> rows) {
    _byId.clear();
    for (final r in rows) {
      final id = int.tryParse('${r['id']}');
      if (id == null) continue;
      final name = '${r['name_ar'] ?? ''}'.trim().isNotEmpty ? '${r['name_ar']}' : '${r['name_en'] ?? ''}';
      _byId[id] = _Cat(id, int.tryParse('${r['parent_id'] ?? ''}'), name, int.tryParse('${r['products_count'] ?? 0}') ?? 0);
    }
    final roots = <_Cat>[];
    for (final c in _byId.values) {
      final parent = c.parentId == null ? null : _byId[c.parentId];
      if (parent == null) {
        roots.add(c);
      } else {
        parent.children.add(c);
      }
    }
    _roots = roots;
  }

  Future<void> _load({bool quiet = false}) async {
    if (!quiet) {
      setState(() {
        _loading = true;
        _error = null;
      });
    }
    try {
      final res = await Api.i.get('/admin/categories');
      final list = (res is Map ? (res['data'] ?? []) : res) as List;
      final rows = list.whereType<Map>().map((m) => Map<String, dynamic>.from(m)).toList();
      CategoryPickerPage._cache = rows;
      if (!mounted) return;
      setState(() {
        _build(rows);
        _loading = false;
      });
    } catch (e) {
      if (mounted && !quiet) {
        setState(() {
          _loading = false;
          _error = errorText(e);
        });
      }
    }
  }

  String _path(_Cat c) {
    final parts = <String>[c.name];
    var p = c.parentId == null ? null : _byId[c.parentId];
    var guard = 0;
    while (p != null && guard++ < 6) {
      parts.insert(0, p.name);
      p = p.parentId == null ? null : _byId[p.parentId];
    }
    return parts.join(' › ');
  }

  Widget _tile(_Cat c, {int depth = 0}) {
    final on = c.id == widget.selected;
    return Tile(
      leading: Padding(
        padding: EdgeInsetsDirectional.only(start: depth * 18.0),
        child: Icon(
          on ? CupertinoIcons.checkmark_circle_fill : (depth == 0 ? CupertinoIcons.folder_fill : CupertinoIcons.circle),
          size: depth == 0 ? 20 : 16,
          color: on ? GH.burgundy : (depth == 0 ? GH.gold : GH.tertiary),
        ),
      ),
      title: c.name,
      titleStyle: depth == 0 ? T.title.copyWith(fontSize: 16) : null,
      value: c.count > 0 ? '${c.count}' : null,
      chevron: false,
      onTap: () => Navigator.pop(context, CategoryChoice(c.id, _path(c))),
    );
  }

  @override
  Widget build(BuildContext context) {
    final q = normalizeDigits(_q).trim().toLowerCase();
    final children = <Widget>[
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 0),
        child: CupertinoSearchTextField(
          placeholder: 'ابحث عن تصنيف',
          backgroundColor: GH.card,
          onChanged: (v) => setState(() => _q = v),
        ),
      ),
    ];
    if (_loading) {
      children.add(const Loading());
    } else if (_error != null) {
      children.add(EmptyState(
        icon: CupertinoIcons.wifi_exclamationmark,
        title: 'ما قدرنا نجيب التصنيفات',
        message: _error,
        action: SecondaryButton('حاول مرة ثانية', onPressed: _load),
      ));
    } else if (q.isNotEmpty) {
      final hits = _byId.values.where((c) => _path(c).toLowerCase().contains(q)).toList();
      children.add(hits.isEmpty
          ? const EmptyState(icon: CupertinoIcons.search, title: 'ما في تصنيف بهذا الاسم')
          : Section(
              children: hits
                  .map((c) => Tile(
                        title: c.name,
                        subtitle: _path(c),
                        chevron: false,
                        trailing: c.id == widget.selected
                            ? const Icon(CupertinoIcons.checkmark_alt, color: GH.burgundy, size: 20)
                            : null,
                        onTap: () => Navigator.pop(context, CategoryChoice(c.id, _path(c))),
                      ))
                  .toList(),
            ));
    } else {
      for (final root in _roots) {
        final rows = <Widget>[_tile(root)];
        for (final c in root.children) {
          rows.add(_tile(c, depth: 1));
          for (final sub in c.children) {
            rows.add(_tile(sub, depth: 2));
          }
        }
        children.add(Section(children: rows));
      }
    }
    return GHPage(
      title: 'التصنيف',
      leading: NavButton('إلغاء', onPressed: () => Navigator.pop(context)),
      children: children,
    );
  }
}
