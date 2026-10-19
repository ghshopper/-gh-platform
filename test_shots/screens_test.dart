// Renders the main admin screens with sample data to PNG files, to review the
// design. Run: flutter test test_shots --update-goldens
import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:gh_shopper/data/store.dart';
import 'package:gh_shopper/main.dart';
import 'package:gh_shopper/pages/customers_page.dart';
import 'package:gh_shopper/pages/login_page.dart';
import 'package:gh_shopper/pages/more_page.dart';
import 'package:gh_shopper/pages/order_detail_page.dart';
import 'package:gh_shopper/pages/orders_page.dart';
import 'package:gh_shopper/pages/today_page.dart';
import 'package:gh_shopper/pages/trips_page.dart';
import 'package:gh_shopper/pages/requests_page.dart';
import 'package:gh_shopper/pages/story_page.dart';
import 'package:gh_shopper/story/story_canvas.dart';
import 'package:gh_shopper/story/cutout.dart';
import 'package:gh_shopper/pages/products_page.dart';
import 'package:gh_shopper/pages/driver_money.dart';
import 'package:gh_shopper/pages/driver_home.dart';
import 'package:gh_shopper/models.dart';
import 'package:gh_shopper/ui/kit.dart';
import 'package:gh_shopper/ui/colors.dart';
import 'package:gh_shopper/pages/search_page.dart';
import 'package:gh_shopper/pdf_waybill.dart';
import 'dart:io';

String iso(DateTime d) => d.toUtc().toIso8601String();

Map<String, dynamic> sample() {
  final now = DateTime.now();
  final d = (int days) => iso(now.subtract(Duration(days: days)));
  final customers = [
    {'id': '1', 'name': 'أميرة الحارثي', 'phone': '96899093898', 'city': 'مسقط', 'gender': 'f', 'loyalty_points': 23400, 'loyalty_tier': 'عنابي'},
    {'id': '2', 'name': 'سارة البلوشي', 'phone': '96891234567', 'city': 'السيب', 'gender': 'f'},
    {'id': '3', 'name': 'خالد الرواحي', 'phone': '96892223344', 'city': 'صحار', 'gender': 'm'},
    {'id': '4', 'name': 'نور الهنائي', 'phone': '96895556677', 'city': 'نزوى', 'gender': 'f'},
  ];
  Map<String, dynamic> item(String id, String o, String brand, String name, double price, String status, {double? cost}) => {
        'id': id, 'order_id': o, 'brand': brand, 'name': name, 'price': price, 'status': status,
        if (cost != null) ...{'cost_amount': cost, 'cost_currency': 'OMR', 'cost_rate': 1},
        'created_at': d(3),
      };
  final orders = [
    {
      'id': 'o1', 'order_no': 128, 'customer_id': '1', 'trip_id': 't1', 'delivery_fee': 2, 'created_at': d(1),
      'tracking_token': 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'store_order_number': 'ORD-6AD51A4F', 'store_source': 'app', 'store_paid_online': true,
      'discount': 21, 'discount_label': 'خصم (كود GH10)',
      'notes': 'طلب من التطبيق ORD-6AD51A4F\nالدفع: بطاقة / Apple Pay (أموال)',
      'items': [item('i1', 'o1', 'DIOR', 'Lady Dior Medium', 2100, 'requested'), item('i2', 'o1', 'CHANEL', 'Classic Card Holder', 310, 'requested')],
      'payments': [{'id': 'p1', 'order_id': 'o1', 'amount': 2391, 'method': 'بطاقة / Apple Pay (أموال)', 'paid_on': d(1), 'note': 'دفع الموقع ORD-6AD51A4F'}],
      'events': [{'type': 'created', 'note': 'من التطبيق ORD-6AD51A4F', 'at': d(1)}],
    },
    {
      'id': 'o2', 'order_no': 127, 'customer_id': '2', 'delivery_fee': 2, 'created_at': d(4),
      'tracking_token': 'bbbbbbbb-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'items': [item('i3', 'o2', 'HERMÈS', 'Oran Sandals', 265, 'arrived', cost: 230), item('i4', 'o2', 'LOEWE', 'Puzzle Bag Small', 1450, 'purchased', cost: 1180)],
      'payments': [{'id': 'p2', 'order_id': 'o2', 'amount': 800, 'method': 'تحويل بنكي', 'paid_on': d(4), 'note': 'عربون'}],
      'events': [{'type': 'created', 'at': d(4)}, {'type': 'purchased', 'at': d(2)}, {'type': 'arrived', 'at': d(1)}],
    },
    {
      'id': 'o3', 'order_no': 126, 'customer_id': '3', 'delivery_fee': 2, 'delivery_collect': true, 'created_at': d(6),
      'delivery_method': 'home', 'delivery_address': 'الخوض، شارع ١٨، منزل ٤٢ · https://maps.google.com/?q=23.6,58.2', 'tracking_token': 'dddddddd-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'driver_id': 'd1', 'driver_status': 'picked',
      'items': [item('i5', 'o3', 'LOUIS VUITTON', 'Keepall 45', 980, 'out_for_delivery', cost: 820)],
      'payments': [{'id': 'p3', 'order_id': 'o3', 'amount': 980, 'method': 'تحويل بنكي', 'paid_on': d(6)}],
    },
    {
      'id': 'o5', 'order_no': 129, 'customer_id': '4', 'delivery_fee': 1, 'created_at': d(0),
      'tracking_token': 'cccccccc-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'delivery_method': 'genacom_office',
      'delivery_address': 'استلام من مكتب جيناكم: نزوى (فرق، خلف بنك العز)، نور الهنائي، 95556677، الداخلية، نزوى',
      'store_order_number': 'ORD-77A', 'store_source': 'app', 'store_paid_online': true,
      'items': [item('i7', 'o5', 'CHANEL', 'Classic Flap Medium', 4200, 'arrived'), item('i8', 'o5', 'DIOR', 'Saddle Card Holder', 380, 'arrived')],
      'events': [{'type': 'arrived', 'at': d(4)}],
      'payments': [{'id': 'p5', 'order_id': 'o5', 'amount': 4581, 'method': 'بطاقة / Apple Pay (أموال)', 'paid_on': d(0)}],
    },
    {
      'id': 'o4', 'order_no': 125, 'customer_id': '4', 'delivery_fee': 0, 'created_at': d(9),
      'store_order_number': 'ORD-5F1', 'store_source': 'web',
      'items': [item('i6', 'o4', 'CARTIER', 'Love Bracelet', 2750, 'delivered', cost: 2400)],
      'payments': [{'id': 'p4', 'order_id': 'o4', 'amount': 2750, 'method': 'نقداً مع المندوب', 'paid_on': d(8), 'note': 'حصّله المندوب سالم'}],
    },
  ];
  return {
    'orders': orders,
    'customers': customers,
    'trips': [
      {'id': 't1', 'name': 'ميلان أكتوبر', 'destination': 'Milan', 'starts_on': d(-3), 'ends_on': d(-10)},
      {'id': 't2', 'name': 'باريس سبتمبر', 'destination': 'Paris', 'starts_on': d(40), 'ends_on': d(33)},
    ],
    'expenses': [
      {'id': 'e1', 'trip_id': 't1', 'title': 'طيران', 'amount': 180, 'currency': 'OMR', 'rate': 1, 'spent_on': d(2)},
      {'id': 'e2', 'title': 'تغليف', 'amount': 35, 'currency': 'OMR', 'rate': 1, 'spent_on': d(3)},
    ],
    'invoices': [],
    'requests': [
      {'id': '7', 'customer_name': 'مريم البوسعيدي', 'customer_phone': '95551234', 'name': 'شنطة شانيل كلاسيك', 'brand': 'CHANEL', 'description': 'لون أسود، مقاس ميديم', 'url': 'https://www.chanel.com', 'status': 'pending', 'created_at': d(0)},
      {'id': '6', 'customer_name': 'سارة البلوشي', 'customer_phone': '91234567', 'name': 'Hermès Oran', 'status': 'ordered', 'order_id': 'o2', 'created_at': d(5)},
    ],
    'drivers': [{'id': 'd1', 'name': 'سالم', 'phone': '96890000000', 'active': true}],
    'settings': {'company_name': 'GH Shopper', 'phone': '+968 7724 6972'},
  };
}

Future<void> loadFonts() async {
  final plex = <String>['Regular', 'Medium', 'SemiBold', 'Bold'];
  for (final fam in ['IBMPlexSansArabic', 'CupertinoSystemText', 'CupertinoSystemDisplay', '.SF Pro Text', '.SF Pro Display', '.SF UI Text', 'Roboto']) {
    final l = FontLoader(fam);
    for (final w in plex) {
      l.addFont(rootBundle.load('assets/fonts/IBMPlexSansArabic-$w.ttf'));
    }
    await l.load();
  }
  final serif = FontLoader('Cormorant')..addFont(rootBundle.load('assets/fonts/CormorantGaramond.ttf'));
  await serif.load();
  final icons = FontLoader('packages/cupertino_icons/CupertinoIcons')
    ..addFont(rootBundle.load('packages/cupertino_icons/assets/CupertinoIcons.ttf'));
  await icons.load();
}

void main() {
  setUpAll(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    SharedPreferences.setMockInitialValues({});
    await loadFonts();
  });

  final screens = <String, Widget Function()>{
    'login': () => const LoginPage(),
    'today': () => const TodayPage(),
    'orders': () => const OrdersPage(),
    'order': () => const OrderDetailPage(orderId: 'o2'),
    'order_online': () => const OrderDetailPage(orderId: 'o1'),
    'customers': () => const CustomersPage(),
    'customer': () => const CustomerDetailPage(customerId: '1'),
    'trips': () => const TripsPage(),
    'summary': () => const SummaryPage(),
    'requests': () => const RequestsPage(),
    'request': () => const RequestDetailPage(id: '7'),
    'convert': () => ConvertRequestPage(request: Store.i.requests.first),
  };

  for (final e in screens.entries) {
    testWidgets(e.key, (tester) async {
      tester.view.physicalSize = const Size(1179, 2556);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      Store.i.loadSnapshot(sample());
      await tester.pumpWidget(RepaintBoundary(
        child: CupertinoApp(
          debugShowCheckedModeBanner: false,
          theme: ghTheme,
          locale: const Locale('ar'),
          supportedLocales: const [Locale('ar'), Locale('en')],
          localizationsDelegates: const [
            GlobalCupertinoLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
          ],
          home: e.value(),
        ),
      ));
      await tester.pump(const Duration(milliseconds: 600));
      await expectLater(find.byType(RepaintBoundary).first, matchesGoldenFile('goldens/${e.key}.png'));
    });
  }

  StoryData storySample({bool sale = false}) => StoryData(
        brand: 'MAISON',
        name: 'عطر أو دو بارفان · 100 مل',
        price: 52.5,
        was: sale ? 65 : null,
        image: MemoryImage(File('test_shots/sample_product.jpg').readAsBytesSync()),
      );

  Future<void> warmImages(WidgetTester tester, List<ImageProvider> imgs) async {
    final ctx = tester.element(find.byType(RepaintBoundary).first);
    await tester.runAsync(() async {
      for (final i in imgs) {
        await precacheImage(i, ctx);
      }
    });
    await tester.pump(const Duration(milliseconds: 100));
  }

  const storyAssets = [
    AssetImage('assets/images/story_logo.png'),
    AssetImage('assets/images/story_cheetah.png'),
    AssetImage('assets/images/story_cheetah_light.png'),
  ];

  // The six story designs at full size (1080 × 1920).
  for (final t in StoryTemplate.values) {
    testWidgets('story-${t.name}', (tester) async {
      tester.view.physicalSize = const Size(1080, 1920);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      final d = storySample(sale: t == StoryTemplate.offer);
      await tester.pumpWidget(RepaintBoundary(
        child: Directionality(
          textDirection: TextDirection.rtl,
          child: StoryCanvas(data: d, template: t),
        ),
      ));
      await warmImages(tester, [d.image!, ...storyAssets]);
      await expectLater(find.byType(RepaintBoundary).first, matchesGoldenFile('goldens/story-${t.name}.png'));
    });
  }

  // A brand photo on a grey studio background: the background comes out.
  testWidgets('story-cutout', (tester) async {
    tester.view.physicalSize = const Size(1080, 1920);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final bytes = File('test_shots/sample_grey.jpg').readAsBytesSync();
    final img = await tester.runAsync(() => cutoutBytes(bytes));
    final d = StoryData(brand: 'DIOR', name: 'Dior Glycine Dioramour wallet', price: 283, image: img)..showName = false;
    await tester.pumpWidget(RepaintBoundary(
      child: Directionality(textDirection: TextDirection.rtl, child: StoryCanvas(data: d, template: StoryTemplate.classic)),
    ));
    await warmImages(tester, [img!, ...storyAssets]);
    await expectLater(find.byType(RepaintBoundary).first, matchesGoldenFile('goldens/story-cutout.png'));
  });

  Map<String, dynamic> prod(int id, String brand, String name, double price, {double? sale, String status = 'active'}) => {
        'id': id, 'name_ar': name, 'name_en': name, 'brand_name_en': brand, 'price': price,
        'compare_price': sale, 'status': status, 'stock_quantity': 2, 'availability': 'on_order',
        'gender': 'women', 'origin': 'europe', 'primary_image': null,
      };
  final products = [
    AdminProduct(prod(1, 'DIOR', 'Lady Dior Medium', 2100)),
    AdminProduct(prod(2, 'DOLCE & GABBANA', 'Sicily bag in dauphine leather', 1450, sale: 1290)),
    AdminProduct(prod(3, 'GUERLAIN', 'روج كيس كيس', 18.5)),
    AdminProduct(prod(4, 'LOEWE', 'Puzzle Bag Small', 1450, status: 'draft')),
  ];
  final account = DriverAccount({
    'pay_per_delivery': 1.5, 'deliveries': 42, 'month_deliveries': 12, 'month_earned': 18,
    'collected': 96, 'handed': 60, 'cash_with_driver': 36, 'earned': 63, 'paid': 45, 'owed_to_driver': 18, 'net': 18,
    'entries': [
      {'id': 'e1', 'type': 'handover', 'amount': 60, 'note': 'كاش أسبوع ١', 'on_date': '2026-10-15'},
      {'id': 'e2', 'type': 'payout', 'amount': 45, 'note': 'تحويل بنكي', 'on_date': '2026-10-12'},
    ],
    'recent': [
      {'id': 'o3', 'order_no': 126, 'created_at': '2026-10-13T10:00:00Z', 'customer_name': 'خالد الرواحي', 'customer_city': 'صحار', 'delivered_at': '2026-10-18T12:00:00Z', 'collected': 2, 'pay': 1.5},
      {'id': 'o9', 'order_no': 120, 'created_at': '2026-10-10T10:00:00Z', 'customer_name': 'نور الهنائي', 'customer_city': 'مسقط', 'delivered_at': '2026-10-16T12:00:00Z', 'collected': 0, 'pay': 1.5},
    ],
  });

  for (final screen in ['products', 'product-edit', 'driver-now', 'driver-past', 'driver-money', 'driver-admin']) {
    testWidgets(screen, (tester) async {
      tester.view.physicalSize = const Size(1179, 2556);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      Store.i.loadSnapshot(sample());
      DriverData.i.orders = [
        DriverOrder.fromMap({'id': 'o3', 'order_no': 126, 'customer_name': 'خالد الرواحي', 'customer_city': 'صحار', 'address': 'الخوض، شارع ١٨، منزل ٤٢', 'delivery_fee': 2, 'delivery_collect': true, 'driver_status': 'picked', 'items': [{'brand': 'LV', 'name': 'Keepall 45'}]}),
        DriverOrder.fromMap({'id': 'o5', 'order_no': 129, 'customer_name': 'نور الهنائي', 'customer_city': 'نزوى', 'delivery_fee': 1, 'delivery_collect': false, 'driver_status': 'assigned', 'items': [{'brand': 'CHANEL', 'name': 'Classic Flap'}, {'brand': 'DIOR', 'name': 'Saddle'}]}),
      ];
      DriverData.i.account = account;
      DriverData.i.ready = true;
      final Widget home = switch (screen) {
        'products' => ProductsPage(initial: products),
        'product-edit' => ProductEditPage(product: products[1]),
        'driver-admin' => GHPage(title: 'سالم', children: [AdminDriverMoney(driverId: 'd1', name: 'سالم', initial: account)]),
        _ => DriverHome(name: 'سالم', initialTab: screen == 'driver-now' ? 0 : screen == 'driver-past' ? 1 : 2),
      };
      await tester.pumpWidget(RepaintBoundary(
        child: CupertinoApp(
          debugShowCheckedModeBanner: false,
          theme: ghTheme,
          locale: const Locale('ar'),
          supportedLocales: const [Locale('ar'), Locale('en')],
          localizationsDelegates: const [
            GlobalCupertinoLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
          ],
          home: home,
        ),
      ));
      await warmImages(tester, storyAssets);
      await tester.pump(const Duration(milliseconds: 600));
      await expectLater(find.byType(RepaintBoundary).first, matchesGoldenFile('goldens/$screen.png'));
    });
  }

  // A photo with a soft shadow under the piece: shadow comes out too.
  testWidgets('story-shadow', (tester) async {
    tester.view.physicalSize = const Size(1080, 1920);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final bytes = File('test_shots/sample_shadow.jpg').readAsBytesSync();
    final img = await tester.runAsync(() => cutoutBytes(bytes));
    final d = StoryData(brand: 'MAISON', name: 'عطر', price: 52.5, image: img)..showName = false;
    await tester.pumpWidget(RepaintBoundary(
      child: Directionality(textDirection: TextDirection.rtl, child: StoryCanvas(data: d, template: StoryTemplate.clean)),
    ));
    await warmImages(tester, [img!, ...storyAssets]);
    await expectLater(find.byType(RepaintBoundary).first, matchesGoldenFile('goldens/story-shadow.png'));
  });

  for (final screen in ['story-compose', 'today2', 'more']) {
    testWidgets(screen, (tester) async {
      tester.view.physicalSize = const Size(1179, 2556);
      tester.view.devicePixelRatio = 3;
      addTearDown(tester.view.reset);
      Store.i.loadSnapshot(sample());
      final d = storySample();
      await tester.pumpWidget(RepaintBoundary(
        child: CupertinoApp(
          debugShowCheckedModeBanner: false,
          theme: ghTheme,
          locale: const Locale('ar'),
          supportedLocales: const [Locale('ar'), Locale('en')],
          localizationsDelegates: const [
            GlobalCupertinoLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
          ],
          home: screen == 'story-compose'
              ? StoryComposePage(products: const [], dataOverride: [d, storySample(sale: true)])
              : screen == 'more'
                  ? const MorePage()
                  : const TodayPage(),
        ),
      ));
      await warmImages(tester, [d.image!, ...storyAssets]);
      await tester.pump(const Duration(milliseconds: 600));
      await expectLater(find.byType(RepaintBoundary).first, matchesGoldenFile('goldens/$screen.png'));
    });
  }

  // Items 15–20: global search, category picker, quick price, dark mode.
  final cats = <Map<String, dynamic>>[
    {'id': 1, 'parent_id': null, 'name_ar': 'نسائي', 'products_count': 0},
    {'id': 2, 'parent_id': 1, 'name_ar': 'حقائب', 'products_count': 34},
    {'id': 3, 'parent_id': 2, 'name_ar': 'حقائب كتف', 'products_count': 12},
    {'id': 4, 'parent_id': 2, 'name_ar': 'محافظ', 'products_count': 9},
    {'id': 5, 'parent_id': 1, 'name_ar': 'مجوهرات', 'products_count': 21},
    {'id': 6, 'parent_id': null, 'name_ar': 'رجالي', 'products_count': 0},
    {'id': 7, 'parent_id': 6, 'name_ar': 'ساعات', 'products_count': 8},
    {'id': 8, 'parent_id': 6, 'name_ar': 'أحذية', 'products_count': 5},
  ];
  for (final screen in ['search', 'categories', 'quick-price', 'today-dark', 'order-dark', 'customer-dark', 'products-dark', 'search-dark']) {
    testWidgets(screen, (tester) async {
      tester.view.physicalSize = const Size(1179, 2556);
      tester.view.devicePixelRatio = 3;
      final dark = screen.endsWith('-dark');
      tester.platformDispatcher.platformBrightnessTestValue = dark ? Brightness.dark : Brightness.light;
      GH.dark = dark;
      addTearDown(() {
        tester.view.reset();
        tester.platformDispatcher.clearPlatformBrightnessTestValue();
        GH.dark = false;
      });
      Store.i.loadSnapshot(sample());
      final Widget home = switch (screen) {
        'search' || 'search-dark' => SearchPage(initialQuery: 'شانيل', initialProducts: [products[0], products[1]]),
        'categories' => CategoryPickerPage(selected: 3, initialRows: cats),
        'quick-price' => QuickPricePage(product: products[1]),
        'today-dark' => const TodayPage(),
        'order-dark' => const OrderDetailPage(orderId: 'o2'),
        'customer-dark' => const CustomerDetailPage(customerId: '1'),
        _ => ProductsPage(initial: products),
      };
      await tester.pumpWidget(RepaintBoundary(
        child: CupertinoApp(
          debugShowCheckedModeBanner: false,
          theme: ghTheme,
          locale: const Locale('ar'),
          supportedLocales: const [Locale('ar'), Locale('en')],
          localizationsDelegates: const [
            GlobalCupertinoLocalizations.delegate,
            GlobalMaterialLocalizations.delegate,
            GlobalWidgetsLocalizations.delegate,
          ],
          home: home,
        ),
      ));
      await tester.pump(const Duration(milliseconds: 600));
      await expectLater(find.byType(RepaintBoundary).first, matchesGoldenFile('goldens/$screen.png'));
    });
  }

  test('waybills', () async {
    Store.i.loadSnapshot(sample());
    for (final id in ['o3', 'o5']) {
      final o = Store.i.order(id)!;
      final bytes = await buildWaybillPdf(o, Store.i.customer(o.customerId), Store.i.settings, driverName: id == 'o3' ? 'سالم' : null);
      Directory('test_shots/goldens').createSync(recursive: true);
      File('test_shots/goldens/waybill-$id.pdf').writeAsBytesSync(bytes);
    }
  });
}
