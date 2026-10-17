import 'package:flutter/material.dart';

import 'customers_screen.dart';
import 'orders_screen.dart';
import 'purchases_screen.dart';
import 'summary_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    // Each tab is rebuilt when selected so it always shows fresh data.
    final Widget body;
    switch (_tab) {
      case 0:
        body = const OrdersScreen();
        break;
      case 1:
        body = const CustomersScreen();
        break;
      case 2:
        body = const PurchasesScreen();
        break;
      default:
        body = const SummaryScreen();
    }
    return Scaffold(
      body: body,
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (i) => setState(() => _tab = i),
        destinations: const [
          NavigationDestination(
              icon: Icon(Icons.receipt_long_outlined),
              selectedIcon: Icon(Icons.receipt_long),
              label: 'الطلبات'),
          NavigationDestination(
              icon: Icon(Icons.people_outline),
              selectedIcon: Icon(Icons.people),
              label: 'العملاء'),
          NavigationDestination(
              icon: Icon(Icons.shopping_bag_outlined),
              selectedIcon: Icon(Icons.shopping_bag),
              label: 'المشتريات'),
          NavigationDestination(
              icon: Icon(Icons.insights_outlined),
              selectedIcon: Icon(Icons.insights),
              label: 'الملخص'),
        ],
      ),
    );
  }
}
