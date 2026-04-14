import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
import '../services/auth_service.dart';
import 'job_detail_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  late DateTime _currentMonth;
  late DateTime _selectedDate;
  Map<int, dynamic> _dayData = {};
  List<dynamic> _jobs = [];
  bool _isLoadingCalendar = true;
  bool _isLoadingJobs = true;
  String? _jobsError;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _currentMonth = DateTime(now.year, now.month);
    _selectedDate = DateTime(now.year, now.month, now.day);
    _loadAll();
  }

  Future<void> _loadAll() async {
    // Run debug auth check first to diagnose 401 issues
    try {
      final api = context.read<ApiService>();
      final debug = await api.debugAuth();
      debugPrint('╔══════════════════════════════════════════════════');
      debugPrint('║ DEBUG AUTH RESULT:');
      debugPrint('║ $debug');
      debugPrint('╚══════════════════════════════════════════════════');
    } catch (e) {
      debugPrint('╔══════════════════════════════════════════════════');
      debugPrint('║ DEBUG AUTH FAILED: $e');
      debugPrint('╚══════════════════════════════════════════════════');
    }
    await Future.wait([_loadMonth(), _loadJobs()]);
  }

  Future<void> _loadMonth() async {
    setState(() => _isLoadingCalendar = true);
    try {
      final api = context.read<ApiService>();
      final data = await api.getMonthOverview(_currentMonth.year, _currentMonth.month);
      if (mounted) {
        setState(() {
          if (data is Map) {
            final days = data['days'];
            if (days is Map) {
              _dayData = days.map((key, value) => MapEntry(int.tryParse(key.toString()) ?? 0, value));
            } else {
              _dayData = {};
            }
          } else {
            _dayData = {};
          }
          _isLoadingCalendar = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() { _dayData = {}; _isLoadingCalendar = false; });
    }
  }

  Future<void> _loadJobs() async {
    setState(() { _isLoadingJobs = true; _jobsError = null; });
    try {
      final api = context.read<ApiService>();
      // Try getMyJobs first (next 7 days), fall back to getAllMyJobs
      var jobs = await api.getMyJobs();
      if (jobs.isEmpty) {
        debugPrint('[Dashboard] getMyJobs empty, trying getAllMyJobs...');
        jobs = await api.getAllMyJobs();
      }
      debugPrint('[Dashboard] Loaded ${jobs.length} jobs');
      if (jobs.isNotEmpty) {
        debugPrint('[Dashboard] First job keys: ${jobs[0] is Map ? (jobs[0] as Map).keys.toList() : "not a map"}');
      }
      if (mounted) {
        setState(() { _jobs = jobs; _isLoadingJobs = false; });
      }
    } catch (e) {
      debugPrint('[Dashboard] Error loading jobs: $e');
      if (mounted) {
        setState(() { _jobsError = e.toString(); _isLoadingJobs = false; });
      }
    }
  }

  void _changeMonth(int delta) {
    setState(() {
      _currentMonth = DateTime(_currentMonth.year, _currentMonth.month + delta);
    });
    _loadMonth();
  }

  List<dynamic> get _filteredJobs {
    return _jobs.where((job) {
      final scheduledAt = job['scheduledAt'];
      if (scheduledAt == null) return false;
      final date = DateTime.tryParse(scheduledAt.toString());
      if (date == null) return false;
      final jobDay = DateTime(date.year, date.month, date.day);
      final selDay = DateTime(_selectedDate.year, _selectedDate.month, _selectedDate.day);
      return jobDay == selDay;
    }).toList();
  }

  List<dynamic> get _upcomingJobs {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final filtered = _jobs.where((job) {
      final scheduledAt = job['scheduledAt'];
      if (scheduledAt == null) return false;
      final date = DateTime.tryParse(scheduledAt.toString());
      if (date == null) return false;
      return DateTime(date.year, date.month, date.day).compareTo(today) >= 0;
    }).toList();
    filtered.sort((a, b) {
      final da = DateTime.tryParse(a['scheduledAt'].toString()) ?? DateTime(2099);
      final db = DateTime.tryParse(b['scheduledAt'].toString()) ?? DateTime(2099);
      return da.compareTo(db);
    });
    return filtered;
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
          onRefresh: _loadAll,
          color: const Color(0xFF0F172A),
          child: CustomScrollView(
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
                        width: 44, height: 44,
                        decoration: BoxDecoration(
                          color: const Color(0xFF0F172A),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Center(
                          child: Text(
                            _getInitials(auth.userName),
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 15),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              // Calendar section
              SliverToBoxAdapter(
                child: Container(
                  margin: const EdgeInsets.fromLTRB(20, 20, 20, 0),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [
                      BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 12, offset: const Offset(0, 2)),
                    ],
                  ),
                  child: Column(
                    children: [
                      // Month nav
                      Padding(
                        padding: const EdgeInsets.fromLTRB(20, 16, 12, 8),
                        child: Row(
                          children: [
                            Text(
                              DateFormat('MMMM yyyy').format(_currentMonth),
                              style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                            ),
                            const Spacer(),
                            _navButton(Icons.chevron_left, () => _changeMonth(-1)),
                            _navButton(Icons.chevron_right, () => _changeMonth(1)),
                          ],
                        ),
                      ),
                      // Day headers
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        child: Row(
                          children: ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => Expanded(
                            child: Center(
                              child: Text(d, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.grey.shade400)),
                            ),
                          )).toList(),
                        ),
                      ),
                      const SizedBox(height: 4),
                      // Calendar grid
                      _isLoadingCalendar
                        ? const Padding(padding: EdgeInsets.all(40), child: CircularProgressIndicator(strokeWidth: 2))
                        : _buildCalendar(),
                      const SizedBox(height: 12),
                    ],
                  ),
                ),
              ),

              // Jobs section header
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
                  child: Row(
                    children: [
                      Text(
                        _isToday(_selectedDate) ? 'Today\'s Jobs' : DateFormat('MMM d').format(_selectedDate),
                        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: const Color(0xFF0F172A).withOpacity(0.08),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          '${_filteredJobs.length}',
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              // Jobs list
              if (_isLoadingJobs)
                const SliverFillRemaining(
                  child: Center(child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF0F172A))),
                )
              else if (_jobsError != null)
                SliverToBoxAdapter(
                  child: _buildErrorCard(),
                )
              else if (_filteredJobs.isEmpty)
                SliverToBoxAdapter(
                  child: _buildEmptyState(),
                )
              else
                SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) => _buildJobCard(_filteredJobs[index]),
                    childCount: _filteredJobs.length,
                  ),
                ),

              // Upcoming section if selected date has no jobs
              if (!_isLoadingJobs && _filteredJobs.isEmpty && _upcomingJobs.isNotEmpty) ...[
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 20, 20, 12),
                    child: Text(
                      'Upcoming',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Colors.grey.shade500),
                    ),
                  ),
                ),
                SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) => _buildJobCard(_upcomingJobs[index], showDate: true),
                    childCount: _upcomingJobs.length.clamp(0, 5),
                  ),
                ),
              ],

              const SliverToBoxAdapter(child: SizedBox(height: 100)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _navButton(IconData icon, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 32, height: 32,
        margin: const EdgeInsets.only(left: 4),
        decoration: BoxDecoration(
          color: const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(icon, size: 18, color: const Color(0xFF0F172A)),
      ),
    );
  }

  Widget _buildCalendar() {
    final daysInMonth = DateUtils.getDaysInMonth(_currentMonth.year, _currentMonth.month);
    final firstDay = DateTime(_currentMonth.year, _currentMonth.month, 1);
    final startOffset = (firstDay.weekday - 1) % 7;
    final today = DateTime.now();
    final isCurrentMonth = today.year == _currentMonth.year && today.month == _currentMonth.month;
    final totalCells = startOffset + daysInMonth;
    final rows = (totalCells / 7).ceil();

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      child: Column(
        children: List.generate(rows, (row) {
          return Row(
            children: List.generate(7, (col) {
              final cellIndex = row * 7 + col;
              final dayNum = cellIndex - startOffset + 1;

              if (dayNum < 1 || dayNum > daysInMonth) {
                return const Expanded(child: SizedBox(height: 44));
              }

              final isToday = isCurrentMonth && today.day == dayNum;
              final thisDate = DateTime(_currentMonth.year, _currentMonth.month, dayNum);
              final isSelected = _selectedDate.year == thisDate.year &&
                  _selectedDate.month == thisDate.month &&
                  _selectedDate.day == thisDate.day;
              final dayInfo = _dayData[dayNum];
              final jobCount = dayInfo?['count'] ?? 0;

              return Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _selectedDate = thisDate),
                  child: Container(
                    height: 44,
                    margin: const EdgeInsets.all(2),
                    decoration: BoxDecoration(
                      color: isSelected
                          ? const Color(0xFF0F172A)
                          : isToday
                              ? const Color(0xFF0F172A).withOpacity(0.06)
                              : null,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          '$dayNum',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: (isToday || isSelected) ? FontWeight.w700 : FontWeight.w500,
                            color: isSelected
                                ? Colors.white
                                : isToday
                                    ? const Color(0xFF0F172A)
                                    : const Color(0xFF334155),
                          ),
                        ),
                        if (jobCount > 0) ...[
                          const SizedBox(height: 2),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: List.generate(
                              jobCount.clamp(0, 3) as int,
                              (_) => Container(
                                width: 4, height: 4,
                                margin: const EdgeInsets.symmetric(horizontal: 1),
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: isSelected ? Colors.white.withOpacity(0.7) : const Color(0xFF3B82F6),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              );
            }),
          );
        }),
      ),
    );
  }

  Widget _buildJobCard(dynamic job, {bool showDate = false}) {
    final status = job['status']?.toString() ?? 'PENDING';
    final packageName = job['package']?['name'] ?? 'Job';
    final client = job['client'];
    final clientName = client != null ? '${client['firstName'] ?? ''} ${client['lastName'] ?? ''}'.trim() : '';
    final address = job['propertyAddress'] ?? '';
    final scheduledAt = job['scheduledAt'];
    final jobId = job['id']?.toString() ?? '';

    String timeStr = '';
    String dateStr = '';
    if (scheduledAt != null) {
      final dt = DateTime.tryParse(scheduledAt.toString());
      if (dt != null) {
        timeStr = DateFormat('h:mm a').format(dt.toLocal());
        dateStr = DateFormat('EEE, MMM d').format(dt.toLocal());
      }
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
              MaterialPageRoute(builder: (_) => JobDetailScreen(jobId: jobId, jobData: job)),
            ).then((_) => _loadJobs());
          },
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Row(
              children: [
                // Time column
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
                // Info
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              packageName,
                              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Color(0xFF0F172A)),
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
                              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: statusConfig.color),
                            ),
                          ),
                        ],
                      ),
                      if (clientName.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          clientName,
                          style: TextStyle(fontSize: 13, color: Colors.grey.shade600, fontWeight: FontWeight.w500),
                        ),
                      ],
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          Icon(Icons.location_on_rounded, size: 13, color: Colors.grey.shade400),
                          const SizedBox(width: 3),
                          Expanded(
                            child: Text(
                              address,
                              style: TextStyle(fontSize: 12, color: Colors.grey.shade500),
                              maxLines: 1, overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                      if (showDate && dateStr.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            Icon(Icons.calendar_today_rounded, size: 12, color: Colors.grey.shade400),
                            const SizedBox(width: 3),
                            Text(dateStr, style: TextStyle(fontSize: 12, color: Colors.grey.shade500)),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Icon(Icons.chevron_right_rounded, color: Colors.grey.shade300, size: 22),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
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
          Text(
            'No jobs scheduled',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Colors.grey.shade600),
          ),
          const SizedBox(height: 4),
          Text(
            'Select a date to see scheduled jobs',
            style: TextStyle(fontSize: 13, color: Colors.grey.shade400),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorCard() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.red.shade50,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          Icon(Icons.wifi_off_rounded, size: 32, color: Colors.red.shade300),
          const SizedBox(height: 8),
          Text('Failed to load jobs', style: TextStyle(fontWeight: FontWeight.w600, color: Colors.red.shade700)),
          const SizedBox(height: 12),
          GestureDetector(
            onTap: _loadJobs,
            child: Text('Tap to retry', style: TextStyle(color: Colors.red.shade400, fontWeight: FontWeight.w500)),
          ),
        ],
      ),
    );
  }

  _StatusConfig _getStatusConfig(String status) {
    switch (status.toUpperCase()) {
      case 'CONFIRMED':
      case 'SCHEDULED':
        return _StatusConfig('Confirmed', const Color(0xFF059669));
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

  String _getInitials(String name) {
    if (name.isEmpty) return '?';
    final parts = name.trim().split(' ');
    if (parts.length >= 2) return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    return name[0].toUpperCase();
  }

  bool _isToday(DateTime date) {
    final now = DateTime.now();
    return date.year == now.year && date.month == now.month && date.day == now.day;
  }
}

class _StatusConfig {
  final String label;
  final Color color;
  _StatusConfig(this.label, this.color);
}
