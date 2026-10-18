import 'package:flutter/cupertino.dart';

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
  int _index = 0;

  @override
  void initState() {
    super.initState();
    Store.i.start();
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
          CupertinoTabBar(
            currentIndex: _index,
            activeColor: GH.burgundy,
            inactiveColor: GH.tertiary,
            backgroundColor: const Color(0xF7FFFFFF),
            border: const Border(top: BorderSide(color: GH.separator, width: 0.5)),
            onTap: (i) => setState(() => _index = i),
            items: const [
              BottomNavigationBarItem(
                  icon: Icon(CupertinoIcons.sun_max),
                  activeIcon: Icon(CupertinoIcons.sun_max_fill),
                  label: 'اليوم'),
              BottomNavigationBarItem(
                  icon: Icon(CupertinoIcons.doc_text),
                  activeIcon: Icon(CupertinoIcons.doc_text_fill),
                  label: 'الطلبات'),
              BottomNavigationBarItem(
                  icon: Icon(CupertinoIcons.person_2),
                  activeIcon: Icon(CupertinoIcons.person_2_fill),
                  label: 'العملاء'),
              BottomNavigationBarItem(
                  icon: Icon(CupertinoIcons.airplane),
                  label: 'الرحلات'),
              BottomNavigationBarItem(
                  icon: Icon(CupertinoIcons.ellipsis_circle),
                  activeIcon: Icon(CupertinoIcons.ellipsis_circle_fill),
                  label: 'المزيد'),
            ],
          ),
        ],
      ),
    );
  }
}
