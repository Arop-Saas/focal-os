import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';
import 'dashboard_screen.dart';
import 'owner_dashboard_screen.dart';
import 'owner_jobs_screen.dart';
import 'owner_staff_screen.dart';
import 'profile_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;
  String _role = '';
  bool _isLoadingRole = true;

  @override
  void initState() {
    super.initState();
    _detectRole();
  }

  Future<void> _detectRole() async {
    try {
      final api = context.read<ApiService>();
      final result = await api.getMyRole();
      final role = result['role']?.toString() ?? 'unknown';
      debugPrint('[HomeScreen] Role detected: $role (isOwner: ${role == "admin"})');
      if (mounted) setState(() { _role = role; _isLoadingRole = false; });
    } catch (e) {
      debugPrint('[HomeScreen] Role detection failed: $e — defaulting to staff');
      if (mounted) setState(() { _role = 'staff'; _isLoadingRole = false; });
    }
  }

  bool get _isOwner => _role == 'admin';

  List<Widget> get _screens {
    if (_isOwner) {
      return const [
        OwnerDashboardScreen(),
        OwnerJobsScreen(),
        OwnerStaffScreen(),
        ProfileScreen(),
      ];
    }
    return const [
      DashboardScreen(),
      ProfileScreen(),
    ];
  }

  List<NavigationDestination> get _destinations {
    if (_isOwner) {
      return [
        NavigationDestination(
          icon: Icon(Icons.dashboard_outlined, color: Colors.grey.shade400),
          selectedIcon: const Icon(Icons.dashboard_rounded, color: Color(0xFF0F172A)),
          label: 'Dashboard',
        ),
        NavigationDestination(
          icon: Icon(Icons.work_outline_rounded, color: Colors.grey.shade400),
          selectedIcon: const Icon(Icons.work_rounded, color: Color(0xFF0F172A)),
          label: 'Jobs',
        ),
        NavigationDestination(
          icon: Icon(Icons.people_outline_rounded, color: Colors.grey.shade400),
          selectedIcon: const Icon(Icons.people_rounded, color: Color(0xFF0F172A)),
          label: 'Team',
        ),
        NavigationDestination(
          icon: Icon(Icons.person_outline_rounded, color: Colors.grey.shade400),
          selectedIcon: const Icon(Icons.person_rounded, color: Color(0xFF0F172A)),
          label: 'Profile',
        ),
      ];
    }
    return [
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
    ];
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoadingRole) {
      return const Scaffold(
        backgroundColor: Color(0xFFF8FAFC),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF0F172A)),
              SizedBox(height: 16),
              Text(
                'Loading your workspace...',
                style: TextStyle(fontSize: 14, color: Color(0xFF64748B), fontWeight: FontWeight.w500),
              ),
            ],
          ),
        ),
      );
    }

    return Scaffold(
      body: IndexedStack(
        index: _currentIndex,
        children: _screens,
      ),
      bottomNavigationBar: NavigationBar(
        height: 64,
        selectedIndex: _currentIndex,
        onDestinationSelected: (index) => setState(() => _currentIndex = index),
        destinations: _destinations,
      ),
    );
  }
}
