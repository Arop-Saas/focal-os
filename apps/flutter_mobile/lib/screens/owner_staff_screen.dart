import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../services/api_service.dart';

class OwnerStaffScreen extends StatefulWidget {
  const OwnerStaffScreen({super.key});

  @override
  State<OwnerStaffScreen> createState() => _OwnerStaffScreenState();
}

class _OwnerStaffScreenState extends State<OwnerStaffScreen> {
  List<dynamic> _staff = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadStaff();
  }

  Future<void> _loadStaff() async {
    setState(() { _isLoading = true; _error = null; });
    try {
      final api = context.read<ApiService>();
      final data = await api.getAdminStaff();
      if (mounted) setState(() { _staff = data; _isLoading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _isLoading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final clockedInCount = _staff.where((s) => s['clockedIn'] == true).length;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
              child: Row(
                children: [
                  const Expanded(
                    child: Text(
                      'Team',
                      style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                    ),
                  ),
                  if (!_isLoading && clockedInCount > 0)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: const Color(0xFF059669).withOpacity(0.1),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 7, height: 7,
                            decoration: const BoxDecoration(shape: BoxShape.circle, color: Color(0xFF059669)),
                          ),
                          const SizedBox(width: 6),
                          Text(
                            '$clockedInCount on field',
                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF059669)),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 16),
              child: Text(
                '${_staff.length} active members',
                style: TextStyle(fontSize: 14, color: Colors.grey.shade500),
              ),
            ),

            // Staff list
            Expanded(
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF0F172A)))
                  : _error != null
                      ? _buildError()
                      : _staff.isEmpty
                          ? _buildEmpty()
                          : RefreshIndicator(
                              onRefresh: _loadStaff,
                              color: const Color(0xFF0F172A),
                              child: ListView.builder(
                                padding: const EdgeInsets.only(bottom: 100),
                                itemCount: _staff.length,
                                itemBuilder: (context, index) => _buildStaffCard(_staff[index]),
                              ),
                            ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStaffCard(dynamic staff) {
    final name = staff['displayName'] ?? 'Unknown';
    final title = staff['title'] ?? '';
    final role = staff['member']?['role'] ?? '';
    final todayJobCount = staff['todayJobCount'] ?? 0;
    final clockedIn = staff['clockedIn'] == true;
    final currentJob = staff['currentJob'];
    final phone = staff['phone'] ?? '';
    final email = staff['email'] ?? '';

    return Container(
      margin: const EdgeInsets.fromLTRB(20, 0, 20, 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: clockedIn ? const Color(0xFF059669).withOpacity(0.3) : const Color(0xFFE2E8F0)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                // Avatar
                Container(
                  width: 44, height: 44,
                  decoration: BoxDecoration(
                    color: clockedIn ? const Color(0xFF059669).withOpacity(0.1) : const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Center(
                    child: Text(
                      _getInitials(name),
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: clockedIn ? const Color(0xFF059669) : const Color(0xFF0F172A),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              name,
                              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Color(0xFF0F172A)),
                            ),
                          ),
                          if (clockedIn)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: const Color(0xFF059669).withOpacity(0.1),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Container(
                                    width: 6, height: 6,
                                    decoration: const BoxDecoration(shape: BoxShape.circle, color: Color(0xFF059669)),
                                  ),
                                  const SizedBox(width: 4),
                                  const Text(
                                    'On Field',
                                    style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Color(0xFF059669)),
                                  ),
                                ],
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          if (title.isNotEmpty)
                            Text(title, style: TextStyle(fontSize: 13, color: Colors.grey.shade500)),
                          if (title.isNotEmpty && role.isNotEmpty)
                            Text(' · ', style: TextStyle(fontSize: 13, color: Colors.grey.shade400)),
                          if (role.isNotEmpty)
                            Text(
                              _formatRole(role),
                              style: TextStyle(fontSize: 12, color: Colors.grey.shade400, fontWeight: FontWeight.w500),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),

            // Today's stats
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                children: [
                  Icon(Icons.calendar_today_rounded, size: 14, color: Colors.grey.shade400),
                  const SizedBox(width: 6),
                  Text(
                    '$todayJobCount job${todayJobCount != 1 ? 's' : ''} today',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: Colors.grey.shade600),
                  ),
                  if (currentJob != null) ...[
                    const SizedBox(width: 12),
                    Icon(Icons.location_on_rounded, size: 14, color: Colors.grey.shade400),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        currentJob['propertyAddress'] ?? '',
                        style: TextStyle(fontSize: 12, color: Colors.grey.shade500),
                        maxLines: 1, overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ],
              ),
            ),

            // Contact row
            if (phone.isNotEmpty || email.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Row(
                  children: [
                    if (phone.isNotEmpty) ...[
                      Icon(Icons.phone_outlined, size: 13, color: Colors.grey.shade400),
                      const SizedBox(width: 4),
                      Text(phone, style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
                    ],
                    if (phone.isNotEmpty && email.isNotEmpty)
                      const SizedBox(width: 16),
                    if (email.isNotEmpty) ...[
                      Icon(Icons.email_outlined, size: 13, color: Colors.grey.shade400),
                      const SizedBox(width: 4),
                      Expanded(
                        child: Text(
                          email,
                          style: TextStyle(fontSize: 12, color: Colors.grey.shade500),
                          maxLines: 1, overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmpty() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.people_outline_rounded, size: 48, color: Colors.grey.shade300),
          const SizedBox(height: 12),
          Text('No staff members', style: TextStyle(fontWeight: FontWeight.w600, color: Colors.grey.shade600)),
        ],
      ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.wifi_off_rounded, size: 48, color: Colors.red.shade300),
          const SizedBox(height: 12),
          Text('Failed to load team', style: TextStyle(fontWeight: FontWeight.w600, color: Colors.red.shade700)),
          const SizedBox(height: 16),
          GestureDetector(
            onTap: _loadStaff,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 10),
              decoration: BoxDecoration(color: const Color(0xFF0F172A), borderRadius: BorderRadius.circular(10)),
              child: const Text('Retry', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
            ),
          ),
        ],
      ),
    );
  }

  String _getInitials(String name) {
    if (name.isEmpty) return '?';
    final parts = name.trim().split(' ');
    if (parts.length >= 2) return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    return name[0].toUpperCase();
  }

  String _formatRole(String role) {
    switch (role) {
      case 'OWNER': return 'Owner';
      case 'ADMIN': return 'Admin';
      case 'MANAGER': return 'Manager';
      case 'MEMBER': return 'Member';
      default: return role;
    }
  }
}
