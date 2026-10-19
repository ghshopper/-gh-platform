import 'package:flutter/cupertino.dart';

import '../data/push.dart';
import '../data/store.dart';
import '../ui/colors.dart';
import 'customers_page.dart';
import 'more_page.dart';
import 'orders_page.dart';
import 'today_page.dart';
import 'trips_page.dart';

/// Bottom tab bar. Tabs stay alive, so switching between them is instant.
class Tabs extends StatefulWidget {
  const Tabs({super.key});

  @override
  State<Tabs> createState() => _TabsState();
}

class _TabsState extends State<Tabs> {
  /// Kept across the rebuild after a light/dark switch.
  static int _index = 0;

  @override
  void initState() {
    super.initState();
    Store.i.start();
    // Staff notifications: ask once signed in, then register the phone.
    Push.i.start();
  }

  static const _pages = <Widget>[
    TodayPage(),
    OrdersPage(),
    CustomersPage(),
    TripsPage(),
    MorePage(),
  ];

  @override
  Widget build(BuildContext context) {
    return CupertinoPageScaffold(
      backgroundColor: GH.bg,
      child: Column(
        children: [
          Expanded(
            child: IndexedStack(index: _index, children: _pages),
          ),
          _TabBar(
            index: _index,
            onTap: (i) => setState(() => _index = i),
          ),
        ],
      ),
    );
  }
}

class _TabBar extends StatelessWidget {
  const _TabBar({required this.index, required this.onTap});

  final int index;
  final ValueChanged<int> onTap;

  static const _items = [
    (CupertinoIcons.sun_max, CupertinoIcons.sun_max_fill, 'اليوم'),
    (CupertinoIcons.doc_text, CupertinoIcons.doc_text_fill, 'الطلبات'),
    (CupertinoIcons.person_2, CupertinoIcons.person_2_fill, 'العملاء'),
    (CupertinoIcons.airplane, CupertinoIcons.airplane, 'الرحلات'),
    (CupertinoIcons.square_grid_2x2, CupertinoIcons.square_grid_2x2_fill, 'المزيد'),
  ];

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: GH.tabBar,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        boxShadow: [BoxShadow(color: GH.barShadow, blurRadius: 24, offset: Offset(0, -6))],
      ),
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(8, 8, 8, 4),
          child: Row(
            children: [
              for (var i = 0; i < _items.length; i++)
                Expanded(
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () => onTap(i),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        AnimatedContainer(
                          duration: const Duration(milliseconds: 180),
                          curve: Curves.easeOut,
                          width: 56,
                          height: 32,
                          decoration: BoxDecoration(
                            color: i == index ? GH.burgundy.withAlpha(22) : const Color(0x00FFFFFF),
                            borderRadius: BorderRadius.circular(16),
                          ),
                          child: Icon(i == index ? _items[i].$2 : _items[i].$1,
                              size: 22, color: i == index ? GH.burgundy : GH.secondary),
                        ),
                        const SizedBox(height: 3),
                        Text(_items[i].$3,
                            style: TextStyle(
                                fontSize: 11,
                                fontWeight: i == index ? FontWeight.w600 : FontWeight.w500,
                                color: i == index ? GH.burgundy : GH.secondary)),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
