import 'package:flutter/material.dart';
import 'dashboard_screen.dart';
import 'profile_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;

  final _screens = const [
    DashboardScreen(),
    ProfileScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: _screens,
      ),
      bottomNavigationBar: NavigationBar(
        height: 64,
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) => setState(() => _currentIndex = index),
        destinations: [
          NavigationDestination(
            icon: Icon(Icons.home_outlined, color: Colors.grey.shade400),
            selectedIcon: const Icon(Icons.home_rounded, color: Color(0xFF0F172A)),
            label: 'Home',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline_rounded, color: Colors.grey.shade400),
            selectedIcon: const Icon(Icons.person_rounded, color: Color(0xFF0F172A)),
            label: 'Profile',
          ),
        ],
      ),
    );
  }
}
