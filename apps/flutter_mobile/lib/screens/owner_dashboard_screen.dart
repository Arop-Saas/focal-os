import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import 'job_detail_screen.dart';

class OwnerDashboardScreen extends StatefulWidget {
  const OwnerDashboardScreen({super.key});

  @override
  State<OwnerDashboardScreen> createState() => _OwnerDashboardScreenState();
}

class _OwnerDashboardScreenState extends State<OwnerDashboardScreen> {
  Map<String, dynamic> _overview = {};
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() { _isLoading = true; _error = null; });
    try {
      final api = context.read<ApiService>();
      debugPrint('[OwnerDashboard] Loading admin overview...');
      final data = await api.getAdminOverview();
      debugPrint('[OwnerDashboard] Got data: ${data.keys.toList()}');
      if (mounted) setState(() { _overview = data; _isLoading = false; });
    } catch (e) {
      debugPrint('[OwnerDashboard] ERROR: $e');
      if (mounted) setState(() { _error = e.toString(); _isLoading = false; });
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final greeting = _getGreeting();
    final firstName = auth.userName.split(' ').first;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _loadData,
          color: const Color(0xFF0F172A),
          child: _isLoading
              ? const Center(child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF0F172A)))
              : _error != null
                  ? _buildError()
                  : CustomScrollView(
                      slivers: [
                        // Header
                        SliverToBoxAdapter(
                          child: Padding(
                            padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                            child: Row(
                              children: [
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        '$greeting,',
                                        style: TextStyle(fontSize: 14, color: Colors.grey.shade500, fontWeight: FontWeight.w500),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        firstName,
                                        style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                                      ),
                                    ],
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF0F172A),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: const Text(
                                    'OWNER',
                                    style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.5),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),

                        // Workspace name
                        if (_overview['workspaceName'] != null)
                          SliverToBoxAdapter(
                            child: Padding(
                              padding: const EdgeInsets.fromLTRB(20, 4, 20, 0),
                              child: Text(
                                _overview['workspaceName'],
                                style: TextStyle(fontSize: 14, color: Colors.grey.shade500, fontWeight: FontWeight.w500),
                              ),
                            ),
                          ),

                        // Stats cards
                        SliverToBoxAdapter(
                          child: Padding(
                            padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
                            child: Row(
                              children: [
                                _buildStatCard(
                                  'Revenue',
                                  _formatCurrency(_overview['monthRevenue'] ?? 0),
                                  'This month',
                                  const Color(0xFF059669),
                                  Icons.trending_up_rounded,
                                ),
                                const SizedBox(width: 12),
                                _buildStatCard(
                                  'Today',
                                  '${(_overview['todayJobs'] as List?)?.length ?? 0}',
                                  'Jobs scheduled',
                                  const Color(0xFF3B82F6),
                                  Icons.calendar_today_rounded,
                                ),
                              ],
                            ),
                          ),
                        ),
                        SliverToBoxAdapter(
                          child: Padding(
                            padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
                            child: Row(
                              children: [
                                _buildStatCard(
                                  'Upcoming',
                                  '${_overview['upcomingJobs'] ?? 0}',
                                  'Jobs queued',
                                  const Color(0xFFF59E0B),
                                  Icons.schedule_rounded,
                                ),
                                const SizedBox(width: 12),
                                _buildStatCard(
                                  'Team',
                                  '${_overview['activeStaff'] ?? 0}',
                                  'Active staff',
                                  const Color(0xFF8B5CF6),
                                  Icons.people_rounded,
                                ),
                              ],
                            ),
                          ),
                        ),

                        // Status breakdown
                        if (_overview['statusCounts'] is Map && (_overview['statusCounts'] as Map).isNotEmpty)
                          SliverToBoxAdapter(
                            child: Container(
                              margin: const EdgeInsets.fromLTRB(20, 20, 20, 0),
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: const Color(0xFFE2E8F0)),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text(
                                    "Today's Breakdown",
                                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                                  ),
                                  const SizedBox(height: 12),
                                  Wrap(
                                    spacing: 8,
                                    runSpacing: 8,
                                    children: (_overview['statusCounts'] as Map).entries.map((e) {
                                      final config = _getStatusConfig(e.key.toString());
                                      return Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                        decoration: BoxDecoration(
                                          color: config.color.withOpacity(0.1),
                                          borderRadius: BorderRadius.circular(8),
                                        ),
                                        child: Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            Text(
                                              config.label,
                                              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: config.color),
                                            ),
                                            const SizedBox(width: 6),
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                              decoration: BoxDecoration(
                                                color: config.color.withOpacity(0.15),
                                                borderRadius: BorderRadius.circular(6),
                                              ),
                                              child: Text(
                                                '${e.value}',
                                                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: config.color),
                                              ),
                                            ),
                                          ],
                                        ),
                                      );
                                    }).toList(),
                                  ),
                                ],
                              ),
                            ),
                          ),

                        // Today's jobs header
                        SliverToBoxAdapter(
                          child: Padding(
                            padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
                            child: Row(
                              children: [
                                const Text(
                                  "Today's Schedule",
                                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                                ),
                                const SizedBox(width: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF0F172A).withOpacity(0.08),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(
                                    '${(_overview['todayJobs'] as List?)?.length ?? 0}',
                                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),

                        // Today's jobs list
                        if ((_overview['todayJobs'] as List?)?.isEmpty ?? true)
                          SliverToBoxAdapter(child: _buildEmptyJobs())
                        else
                          SliverList(
                            delegate: SliverChildBuilderDelegate(
                              (context, index) {
                                final jobs = _overview['todayJobs'] as List;
                                return _buildJobCard(jobs[index]);
                              },
                              childCount: (_overview['todayJobs'] as List?)?.length ?? 0,
                            ),
                          ),

                        const SliverToBoxAdapter(child: SizedBox(height: 100)),
                      ],
                    ),
        ),
      ),
    );
  }

  Widget _buildStatCard(String title, String value, String subtitle, Color color, IconData icon) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 36, height: 36,
                  decoration: BoxDecoration(
                    color: color.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(icon, size: 18, color: color),
                ),
                const Spacer(),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              value,
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
            ),
            const SizedBox(height: 2),
            Text(
              subtitle,
              style: TextStyle(fontSize: 12, color: Colors.grey.shade500, fontWeight: FontWeight.w500),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildJobCard(dynamic job) {
    final status = job['status']?.toString() ?? 'PENDING';
    final address = job['propertyAddress'] ?? '';
    final client = job['client'];
    final clientName = client != null ? '${client['firstName'] ?? ''} ${client['lastName'] ?? ''}'.trim() : '';
    final scheduledAt = job['scheduledAt'];
    final assignments = job['assignments'] as List? ?? [];
    String photographer = 'Unassigned';
    if (assignments.isNotEmpty) {
      final staff = assignments[0]['staff'];
      if (staff != null) {
        final member = staff['member'];
        final user = member != null ? member['user'] : null;
        photographer = user != null ? (user['fullName'] ?? 'Unassigned') : 'Unassigned';
      }
    }
    final amount = job['totalAmount'];

    String timeStr = '';
    if (scheduledAt != null) {
      final dt = DateTime.tryParse(scheduledAt.toString());
      if (dt != null) timeStr = DateFormat('h:mm a').format(dt.toLocal());
    }

    final statusConfig = _getStatusConfig(status);

    return Container(
      margin: const EdgeInsets.fromLTRB(20, 0, 20, 10),
      child: Material(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () {
            Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => JobDetailScreen(jobId: job['id'] ?? '', jobData: job)),
            ).then((_) => _loadData());
          },
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Row(
              children: [
                // Time
                Container(
                  width: 56,
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Column(
                    children: [
                      Text(
                        timeStr.isNotEmpty ? timeStr.split(' ')[0] : '--',
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                      ),
                      Text(
                        timeStr.isNotEmpty ? timeStr.split(' ').last : '',
                        style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Colors.grey.shade400),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              address,
                              style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF0F172A)),
                              maxLines: 1, overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: statusConfig.color.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              statusConfig.label,
                              style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: statusConfig.color),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        clientName,
                        style: TextStyle(fontSize: 13, color: Colors.grey.shade600, fontWeight: FontWeight.w500),
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Icon(Icons.person_outline_rounded, size: 13, color: Colors.grey.shade400),
                          const SizedBox(width: 3),
                          Expanded(
                            child: Text(
                              photographer,
                              style: TextStyle(fontSize: 12, color: Colors.grey.shade500),
                              maxLines: 1, overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          if (amount != null)
                            Text(
                              _formatCurrency(amount),
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 4),
                Icon(Icons.chevron_right_rounded, color: Colors.grey.shade300, size: 22),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildEmptyJobs() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20),
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        children: [
          Container(
            width: 56, height: 56,
            decoration: BoxDecoration(
              color: const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(Icons.event_available_rounded, size: 28, color: Colors.grey.shade400),
          ),
          const SizedBox(height: 14),
          Text('No jobs today', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Colors.grey.shade600)),
          const SizedBox(height: 4),
          Text('Your team has a free day', style: TextStyle(fontSize: 13, color: Colors.grey.shade400)),
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
          Text('Failed to load dashboard', style: TextStyle(fontWeight: FontWeight.w600, color: Colors.red.shade700)),
          const SizedBox(height: 16),
          GestureDetector(
            onTap: _loadData,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFF0F172A),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Text('Retry', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
            ),
          ),
        ],
      ),
    );
  }

  String _formatCurrency(dynamic amount) {
    final value = (amount is int) ? amount.toDouble() : (amount is num) ? amount.toDouble() : 0.0;
    return NumberFormat.simpleCurrency().format(value);
  }

  _StatusConfig _getStatusConfig(String status) {
    switch (status.toUpperCase()) {
      case 'CONFIRMED':
      case 'SCHEDULED':
        return _StatusConfig('Confirmed', const Color(0xFF059669));
      case 'ASSIGNED':
        return _StatusConfig('Assigned', const Color(0xFF3B82F6));
      case 'IN_PROGRESS':
        return _StatusConfig('In Progress', const Color(0xFF3B82F6));
      case 'EDITING':
        return _StatusConfig('Editing', const Color(0xFF8B5CF6));
      case 'COMPLETED':
        return _StatusConfig('Done', const Color(0xFF6B7280));
      case 'DELIVERED':
        return _StatusConfig('Delivered', const Color(0xFF059669));
      case 'CANCELLED':
        return _StatusConfig('Cancelled', const Color(0xFFEF4444));
      default:
        return _StatusConfig('Pending', const Color(0xFFF59E0B));
    }
  }

  String _getGreeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }
}

class _StatusConfig {
  final String label;
  final Color color;
  _StatusConfig(this.label, this.color);
}
