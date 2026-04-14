import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
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
  Timer? _refreshTimer;
  Timer? _tickTimer;
  bool _showMap = true;

  @override
  void initState() {
    super.initState();
    _loadStaff();
    // Auto-refresh every 30 seconds for live tracking
    _refreshTimer = Timer.periodic(const Duration(seconds: 30), (_) => _silentRefresh());
    // Tick every minute to update elapsed times
    _tickTimer = Timer.periodic(const Duration(seconds: 60), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    _tickTimer?.cancel();
    super.dispose();
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

  Future<void> _silentRefresh() async {
    try {
      final api = context.read<ApiService>();
      final data = await api.getAdminStaff();
      if (mounted) setState(() => _staff = data);
    } catch (_) {}
  }

  List<dynamic> get _clockedIn => _staff.where((s) => s['clockedIn'] == true).toList();
  List<dynamic> get _notClockedIn => _staff.where((s) => s['clockedIn'] != true).toList();

  // Workers with valid GPS coordinates
  List<dynamic> get _locatedWorkers => _clockedIn.where((s) {
    final lat = s['lastLatitude'];
    final lng = s['lastLongitude'];
    return lat != null && lng != null && lat is num && lng is num;
  }).toList();

  String _elapsedSince(String? isoString) {
    if (isoString == null) return '';
    final start = DateTime.tryParse(isoString);
    if (start == null) return '';
    final diff = DateTime.now().toUtc().difference(start.toUtc());
    final hours = diff.inHours;
    final mins = diff.inMinutes % 60;
    if (hours > 0) return '${hours}h ${mins}m';
    return '${mins}m';
  }

  @override
  Widget build(BuildContext context) {
    final clockedIn = _clockedIn;
    final others = _notClockedIn;
    final located = _locatedWorkers;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: _isLoading
            ? const Center(child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF0F172A)))
            : _error != null
                ? _buildError()
                : RefreshIndicator(
                    onRefresh: _loadStaff,
                    color: const Color(0xFF0F172A),
                    child: CustomScrollView(
                      slivers: [
                        // Header
                        SliverToBoxAdapter(
                          child: Padding(
                            padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                            child: Row(
                              children: [
                                const Expanded(
                                  child: Text('Team', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: Color(0xFF0F172A))),
                                ),
                                if (clockedIn.isNotEmpty)
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFF059669).withOpacity(0.1),
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        _PulsingDot(color: const Color(0xFF059669)),
                                        const SizedBox(width: 6),
                                        Text(
                                          '${clockedIn.length} on field',
                                          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF059669)),
                                        ),
                                      ],
                                    ),
                                  ),
                              ],
                            ),
                          ),
                        ),
                        SliverToBoxAdapter(
                          child: Padding(
                            padding: const EdgeInsets.fromLTRB(20, 4, 20, 0),
                            child: Text('${_staff.length} active members', style: TextStyle(fontSize: 14, color: Colors.grey.shade500)),
                          ),
                        ),

                        // ─── Map View (when workers have location) ──────
                        if (located.isNotEmpty && _showMap)
                          SliverToBoxAdapter(
                            child: Container(
                              margin: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                              height: 220,
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: const Color(0xFF059669).withOpacity(0.3)),
                              ),
                              clipBehavior: Clip.antiAlias,
                              child: Stack(
                                children: [
                                  _buildMap(located),
                                  // Map toggle button
                                  Positioned(
                                    top: 8, right: 8,
                                    child: GestureDetector(
                                      onTap: () => setState(() => _showMap = false),
                                      child: Container(
                                        padding: const EdgeInsets.all(6),
                                        decoration: BoxDecoration(
                                          color: Colors.white,
                                          borderRadius: BorderRadius.circular(8),
                                          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.1), blurRadius: 4)],
                                        ),
                                        child: const Icon(Icons.close_rounded, size: 16, color: Color(0xFF0F172A)),
                                      ),
                                    ),
                                  ),
                                  // Legend
                                  Positioned(
                                    bottom: 8, left: 8,
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                      decoration: BoxDecoration(
                                        color: Colors.white.withOpacity(0.9),
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          const Icon(Icons.location_on, size: 14, color: Color(0xFF059669)),
                                          const SizedBox(width: 4),
                                          Text('${located.length} tracked', style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: Color(0xFF059669))),
                                        ],
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),

                        // Show map button if hidden
                        if (located.isNotEmpty && !_showMap)
                          SliverToBoxAdapter(
                            child: Padding(
                              padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                              child: GestureDetector(
                                onTap: () => setState(() => _showMap = true),
                                child: Container(
                                  padding: const EdgeInsets.symmetric(vertical: 10),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF059669).withOpacity(0.08),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: const Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Icon(Icons.map_rounded, size: 16, color: Color(0xFF059669)),
                                      SizedBox(width: 6),
                                      Text('Show Map', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF059669))),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ),

                        // ─── Live Tracker Section ───────────────────────
                        if (clockedIn.isNotEmpty) ...[
                          SliverToBoxAdapter(
                            child: Padding(
                              padding: const EdgeInsets.fromLTRB(20, 20, 20, 10),
                              child: Row(
                                children: [
                                  Container(width: 8, height: 8, decoration: const BoxDecoration(shape: BoxShape.circle, color: Color(0xFF059669))),
                                  const SizedBox(width: 8),
                                  const Text('LIVE TRACKER', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Color(0xFF059669), letterSpacing: 1)),
                                ],
                              ),
                            ),
                          ),
                          SliverList(
                            delegate: SliverChildBuilderDelegate(
                              (context, index) => _buildLiveCard(clockedIn[index]),
                              childCount: clockedIn.length,
                            ),
                          ),
                        ],

                        // ─── Other Staff Section ────────────────────────
                        if (others.isNotEmpty) ...[
                          SliverToBoxAdapter(
                            child: Padding(
                              padding: EdgeInsets.fromLTRB(20, clockedIn.isNotEmpty ? 24 : 20, 20, 10),
                              child: Text(
                                clockedIn.isNotEmpty ? 'OFF FIELD' : 'ALL STAFF',
                                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.grey.shade400, letterSpacing: 1),
                              ),
                            ),
                          ),
                          SliverList(
                            delegate: SliverChildBuilderDelegate(
                              (context, index) => _buildStaffCard(others[index]),
                              childCount: others.length,
                            ),
                          ),
                        ],

                        if (_staff.isEmpty)
                          SliverFillRemaining(child: _buildEmpty()),

                        const SliverToBoxAdapter(child: SizedBox(height: 100)),
                      ],
                    ),
                  ),
      ),
    );
  }

  // ─── Map widget ─────────────────────────────────────────────────────────

  Widget _buildMap(List<dynamic> workers) {
    final markers = <Marker>[];
    double sumLat = 0, sumLng = 0;

    for (final w in workers) {
      final lat = (w['lastLatitude'] as num).toDouble();
      final lng = (w['lastLongitude'] as num).toDouble();
      final name = w['displayName'] ?? '?';
      sumLat += lat;
      sumLng += lng;

      markers.add(
        Marker(
          point: LatLng(lat, lng),
          width: 120,
          height: 50,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFF0F172A),
                  borderRadius: BorderRadius.circular(8),
                  boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.15), blurRadius: 6)],
                ),
                child: Text(
                  name.toString().split(' ').first,
                  style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              const Icon(Icons.location_on, color: Color(0xFF059669), size: 24),
            ],
          ),
        ),
      );
    }

    final centerLat = sumLat / workers.length;
    final centerLng = sumLng / workers.length;

    return FlutterMap(
      options: MapOptions(
        initialCenter: LatLng(centerLat, centerLng),
        initialZoom: workers.length == 1 ? 14.0 : 11.0,
        interactionOptions: const InteractionOptions(
          flags: InteractiveFlag.all & ~InteractiveFlag.rotate,
        ),
      ),
      children: [
        TileLayer(
          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          userAgentPackageName: 'com.example.scalist_mobile',
        ),
        MarkerLayer(markers: markers),
      ],
    );
  }

  // ─── Live tracker card (clocked-in workers) ───────────────────────────

  Widget _buildLiveCard(dynamic staff) {
    final name = staff['displayName'] ?? 'Unknown';
    final title = staff['title'] ?? '';
    final currentJob = staff['currentJob'];
    final address = currentJob?['propertyAddress'] ?? '';
    final city = currentJob?['propertyCity'] ?? '';
    final clientName = currentJob?['clientName'] ?? '';
    final actualStartAt = currentJob?['actualStartAt']?.toString();
    final elapsed = _elapsedSince(actualStartAt);
    final phone = staff['phone'] ?? '';
    final hasLocation = staff['lastLatitude'] != null && staff['lastLongitude'] != null;

    String clockInTime = '';
    if (actualStartAt != null) {
      final dt = DateTime.tryParse(actualStartAt);
      if (dt != null) clockInTime = DateFormat('h:mm a').format(dt.toLocal());
    }

    String locationAge = '';
    final lastLocAt = staff['lastLocationAt']?.toString();
    if (lastLocAt != null) {
      final dt = DateTime.tryParse(lastLocAt);
      if (dt != null) {
        final mins = DateTime.now().toUtc().difference(dt.toUtc()).inMinutes;
        if (mins < 1) {
          locationAge = 'just now';
        } else if (mins < 60) {
          locationAge = '${mins}m ago';
        } else {
          locationAge = '${mins ~/ 60}h ago';
        }
      }
    }

    return Container(
      margin: const EdgeInsets.fromLTRB(20, 0, 20, 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF059669).withOpacity(0.3), width: 1.5),
        boxShadow: [
          BoxShadow(color: const Color(0xFF059669).withOpacity(0.06), blurRadius: 12, offset: const Offset(0, 2)),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Name row with elapsed time
            Row(
              children: [
                Container(
                  width: 44, height: 44,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFF059669), width: 2),
                  ),
                  child: Container(
                    decoration: BoxDecoration(
                      color: const Color(0xFF059669).withOpacity(0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Center(
                      child: Text(
                        _getInitials(name),
                        style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF059669)),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF0F172A))),
                      if (title.isNotEmpty)
                        Text(title, style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xFF059669).withOpacity(0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.timer_outlined, size: 14, color: Color(0xFF059669)),
                      const SizedBox(width: 4),
                      Text(elapsed.isNotEmpty ? elapsed : '--', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF059669))),
                    ],
                  ),
                ),
              ],
            ),

            const SizedBox(height: 12),

            // Current job details
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF0FDF4),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (address.isNotEmpty)
                    Row(
                      children: [
                        const Icon(Icons.location_on_rounded, size: 15, color: Color(0xFF059669)),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            city.isNotEmpty ? '$address, $city' : address,
                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF0F172A)),
                            maxLines: 1, overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  if (clientName.isNotEmpty || clockInTime.isNotEmpty)
                    Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Row(
                        children: [
                          if (clientName.isNotEmpty) ...[
                            Icon(Icons.person_outline_rounded, size: 14, color: Colors.grey.shade500),
                            const SizedBox(width: 4),
                            Text(clientName, style: TextStyle(fontSize: 12, color: Colors.grey.shade600)),
                          ],
                          const Spacer(),
                          if (clockInTime.isNotEmpty) ...[
                            Icon(Icons.login_rounded, size: 13, color: Colors.grey.shade400),
                            const SizedBox(width: 4),
                            Text('Clocked in $clockInTime', style: TextStyle(fontSize: 11, color: Colors.grey.shade500)),
                          ],
                        ],
                      ),
                    ),
                ],
              ),
            ),

            // GPS + phone row
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Row(
                children: [
                  if (hasLocation) ...[
                    Icon(Icons.gps_fixed_rounded, size: 13, color: const Color(0xFF059669).withOpacity(0.7)),
                    const SizedBox(width: 4),
                    Text('GPS $locationAge', style: TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: const Color(0xFF059669).withOpacity(0.7))),
                  ] else ...[
                    Icon(Icons.gps_off_rounded, size: 13, color: Colors.grey.shade400),
                    const SizedBox(width: 4),
                    Text('No GPS', style: TextStyle(fontSize: 11, color: Colors.grey.shade400)),
                  ],
                  const Spacer(),
                  if (phone.isNotEmpty) ...[
                    Icon(Icons.phone_outlined, size: 13, color: Colors.grey.shade400),
                    const SizedBox(width: 4),
                    Text(phone, style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ─── Regular staff card ───────────────────────────────────────────────

  Widget _buildStaffCard(dynamic staff) {
    final name = staff['displayName'] ?? 'Unknown';
    final title = staff['title'] ?? '';
    final role = staff['role'] ?? '';
    final todayJobCount = staff['todayJobCount'] ?? 0;
    final phone = staff['phone'] ?? '';
    final email = staff['email'] ?? '';

    return Container(
      margin: const EdgeInsets.fromLTRB(20, 0, 20, 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 44, height: 44,
                  decoration: BoxDecoration(color: const Color(0xFFF1F5F9), borderRadius: BorderRadius.circular(14)),
                  child: Center(
                    child: Text(_getInitials(name), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Color(0xFF0F172A))),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Color(0xFF0F172A))),
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          if (title.isNotEmpty) Text(title, style: TextStyle(fontSize: 13, color: Colors.grey.shade500)),
                          if (title.isNotEmpty && role.isNotEmpty) Text(' · ', style: TextStyle(fontSize: 13, color: Colors.grey.shade400)),
                          if (role.isNotEmpty) Text(_formatRole(role), style: TextStyle(fontSize: 12, color: Colors.grey.shade400, fontWeight: FontWeight.w500)),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(color: const Color(0xFFF8FAFC), borderRadius: BorderRadius.circular(10)),
              child: Row(
                children: [
                  Icon(Icons.calendar_today_rounded, size: 14, color: Colors.grey.shade400),
                  const SizedBox(width: 6),
                  Text('$todayJobCount job${todayJobCount != 1 ? 's' : ''} today', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: Colors.grey.shade600)),
                ],
              ),
            ),
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
                    if (phone.isNotEmpty && email.isNotEmpty) const SizedBox(width: 16),
                    if (email.isNotEmpty) ...[
                      Icon(Icons.email_outlined, size: 13, color: Colors.grey.shade400),
                      const SizedBox(width: 4),
                      Expanded(child: Text(email, style: TextStyle(fontSize: 12, color: Colors.grey.shade500), maxLines: 1, overflow: TextOverflow.ellipsis)),
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

// ─── Pulsing green dot widget ─────────────────────────────────────────────

class _PulsingDot extends StatefulWidget {
  final Color color;
  const _PulsingDot({required this.color});

  @override
  State<_PulsingDot> createState() => _PulsingDotState();
}

class _PulsingDotState extends State<_PulsingDot> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: const Duration(milliseconds: 1500))..repeat(reverse: true);
    _animation = Tween<double>(begin: 0.4, end: 1.0).animate(CurvedAnimation(parent: _controller, curve: Curves.easeInOut));
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _animation,
      builder: (context, child) {
        return Container(
          width: 8, height: 8,
          decoration: BoxDecoration(shape: BoxShape.circle, color: widget.color.withOpacity(_animation.value)),
        );
      },
    );
  }
}
