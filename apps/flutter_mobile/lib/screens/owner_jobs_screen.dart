import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
import 'job_detail_screen.dart';

class OwnerJobsScreen extends StatefulWidget {
  const OwnerJobsScreen({super.key});

  @override
  State<OwnerJobsScreen> createState() => _OwnerJobsScreenState();
}

class _OwnerJobsScreenState extends State<OwnerJobsScreen> {
  List<dynamic> _jobs = [];
  bool _isLoading = true;
  String? _error;
  String _filterStatus = 'ALL';

  @override
  void initState() {
    super.initState();
    _loadJobs();
  }

  Future<void> _loadJobs() async {
    setState(() { _isLoading = true; _error = null; });
    try {
      final api = context.read<ApiService>();
      final data = await api.getAdminJobs();
      if (mounted) setState(() { _jobs = data; _isLoading = false; });
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _isLoading = false; });
    }
  }

  List<dynamic> get _filteredJobs {
    if (_filterStatus == 'ALL') return _jobs;
    return _jobs.where((j) => j['status'] == _filterStatus).toList();
  }

  // Group jobs by date
  Map<String, List<dynamic>> get _groupedJobs {
    final map = <String, List<dynamic>>{};
    for (final job in _filteredJobs) {
      final scheduledAt = job['scheduledAt'];
      if (scheduledAt == null) continue;
      final dt = DateTime.tryParse(scheduledAt.toString());
      if (dt == null) continue;
      final key = DateFormat('yyyy-MM-dd').format(dt.toLocal());
      map.putIfAbsent(key, () => []).add(job);
    }
    return Map.fromEntries(map.entries.toList()..sort((a, b) => a.key.compareTo(b.key)));
  }

  @override
  Widget build(BuildContext context) {
    final statuses = ['ALL', 'CONFIRMED', 'ASSIGNED', 'IN_PROGRESS', 'EDITING'];

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            const Padding(
              padding: EdgeInsets.fromLTRB(20, 16, 20, 0),
              child: Text(
                'Jobs',
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 4, 20, 0),
              child: Text(
                'Next 14 days',
                style: TextStyle(fontSize: 14, color: Colors.grey.shade500),
              ),
            ),

            // Filter chips
            const SizedBox(height: 16),
            SizedBox(
              height: 36,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 20),
                itemCount: statuses.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (context, index) {
                  final s = statuses[index];
                  final isActive = _filterStatus == s;
                  final config = s == 'ALL' ? _StatusConfig('All', const Color(0xFF0F172A)) : _getStatusConfig(s);
                  return GestureDetector(
                    onTap: () => setState(() => _filterStatus = s),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      decoration: BoxDecoration(
                        color: isActive ? const Color(0xFF0F172A) : Colors.white,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: isActive ? const Color(0xFF0F172A) : const Color(0xFFE2E8F0)),
                      ),
                      child: Text(
                        config.label,
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: isActive ? Colors.white : Colors.grey.shade600,
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 16),

            // Jobs list
            Expanded(
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF0F172A)))
                  : _error != null
                      ? _buildError()
                      : _filteredJobs.isEmpty
                          ? _buildEmpty()
                          : RefreshIndicator(
                              onRefresh: _loadJobs,
                              color: const Color(0xFF0F172A),
                              child: ListView.builder(
                                padding: const EdgeInsets.only(bottom: 100),
                                itemCount: _groupedJobs.length,
                                itemBuilder: (context, sectionIndex) {
                                  final entry = _groupedJobs.entries.elementAt(sectionIndex);
                                  final date = DateTime.parse(entry.key);
                                  final jobs = entry.value;
                                  final isToday = _isToday(date);

                                  return Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Padding(
                                        padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
                                        child: Text(
                                          isToday ? 'Today' : DateFormat('EEE, MMM d').format(date),
                                          style: TextStyle(
                                            fontSize: 14,
                                            fontWeight: FontWeight.w700,
                                            color: isToday ? const Color(0xFF3B82F6) : Colors.grey.shade600,
                                          ),
                                        ),
                                      ),
                                      ...jobs.map((job) => _buildJobCard(job)),
                                    ],
                                  );
                                },
                              ),
                            ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildJobCard(dynamic job) {
    final status = job['status']?.toString() ?? 'PENDING';
    final address = job['propertyAddress'] ?? '';
    final city = job['propertyCity'] ?? '';
    final client = job['client'];
    final clientName = client != null ? '${client['firstName'] ?? ''} ${client['lastName'] ?? ''}'.trim() : '';
    final scheduledAt = job['scheduledAt'];
    final isRush = job['isRush'] == true;
    final pkg = job['package'];
    final packageName = pkg != null ? (pkg['name'] ?? '') : '';
    final assignmentsList = job['assignments'] as List? ?? [];
    String photographer = '';
    if (assignmentsList.isNotEmpty) {
      final staff = assignmentsList[0]['staff'];
      if (staff != null) {
        final member = staff['member'];
        final user = member != null ? member['user'] : null;
        photographer = user != null ? (user['fullName'] ?? '') : '';
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
            ).then((_) => _loadJobs());
          },
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: isRush ? Colors.red.shade200 : const Color(0xFFE2E8F0)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    if (isRush)
                      Container(
                        margin: const EdgeInsets.only(right: 6),
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.red.shade50,
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(color: Colors.red.shade200),
                        ),
                        child: Text('RUSH', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: Colors.red.shade700, letterSpacing: 0.5)),
                      ),
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
                const SizedBox(height: 6),
                if (city.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Row(
                      children: [
                        Icon(Icons.location_on_rounded, size: 13, color: Colors.grey.shade400),
                        const SizedBox(width: 3),
                        Text(city, style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
                      ],
                    ),
                  ),
                Row(
                  children: [
                    if (timeStr.isNotEmpty) ...[
                      Icon(Icons.access_time_rounded, size: 13, color: Colors.grey.shade400),
                      const SizedBox(width: 3),
                      Text(timeStr, style: TextStyle(fontSize: 12, color: Colors.grey.shade500, fontWeight: FontWeight.w500)),
                      const SizedBox(width: 12),
                    ],
                    Icon(Icons.person_outline_rounded, size: 13, color: Colors.grey.shade400),
                    const SizedBox(width: 3),
                    Expanded(
                      child: Text(
                        clientName,
                        style: TextStyle(fontSize: 12, color: Colors.grey.shade500),
                        maxLines: 1, overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (amount != null)
                      Text(
                        NumberFormat.simpleCurrency().format((amount as num).toDouble()),
                        style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                      ),
                  ],
                ),
                if (photographer.isNotEmpty || packageName.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Row(
                      children: [
                        if (packageName.isNotEmpty)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: const Color(0xFF3B82F6).withOpacity(0.08),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              packageName,
                              style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w500, color: Color(0xFF3B82F6)),
                            ),
                          ),
                        if (packageName.isNotEmpty && photographer.isNotEmpty)
                          const SizedBox(width: 8),
                        if (photographer.isNotEmpty)
                          Row(
                            children: [
                              Icon(Icons.camera_alt_outlined, size: 12, color: Colors.grey.shade400),
                              const SizedBox(width: 3),
                              Text(photographer, style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
                            ],
                          ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildEmpty() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.work_outline_rounded, size: 48, color: Colors.grey.shade300),
          const SizedBox(height: 12),
          Text('No jobs found', style: TextStyle(fontWeight: FontWeight.w600, color: Colors.grey.shade600)),
          const SizedBox(height: 4),
          Text('No upcoming jobs match this filter', style: TextStyle(fontSize: 13, color: Colors.grey.shade400)),
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
          Text('Failed to load jobs', style: TextStyle(fontWeight: FontWeight.w600, color: Colors.red.shade700)),
          const SizedBox(height: 16),
          GestureDetector(
            onTap: _loadJobs,
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

  bool _isToday(DateTime date) {
    final now = DateTime.now();
    return date.year == now.year && date.month == now.month && date.day == now.day;
  }

  _StatusConfig _getStatusConfig(String status) {
    switch (status.toUpperCase()) {
      case 'CONFIRMED':
        return _StatusConfig('Confirmed', const Color(0xFF059669));
      case 'ASSIGNED':
        return _StatusConfig('Assigned', const Color(0xFF3B82F6));
      case 'IN_PROGRESS':
        return _StatusConfig('In Progress', const Color(0xFF0EA5E9));
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
}

class _StatusConfig {
  final String label;
  final Color color;
  _StatusConfig(this.label, this.color);
}
