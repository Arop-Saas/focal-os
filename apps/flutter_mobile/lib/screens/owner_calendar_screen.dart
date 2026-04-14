import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
import 'job_detail_screen.dart';
import 'book_job_screen.dart';

class OwnerCalendarScreen extends StatefulWidget {
  const OwnerCalendarScreen({super.key});

  @override
  State<OwnerCalendarScreen> createState() => _OwnerCalendarScreenState();
}

class _OwnerCalendarScreenState extends State<OwnerCalendarScreen> {
  late DateTime _currentMonth;
  late DateTime _selectedDate;
  Map<int, dynamic> _dayData = {};
  List<dynamic> _dayJobs = [];
  bool _isLoadingCalendar = true;
  bool _isLoadingJobs = false;

  @override
  void initState() {
    super.initState();
    final now = DateTime.now();
    _currentMonth = DateTime(now.year, now.month);
    _selectedDate = DateTime(now.year, now.month, now.day);
    _loadMonth();
    _loadDayJobs();
  }

  Future<void> _loadMonth() async {
    setState(() => _isLoadingCalendar = true);
    try {
      final api = context.read<ApiService>();
      final data = await api.getAdminMonthOverview(_currentMonth.year, _currentMonth.month);
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

  Future<void> _loadDayJobs() async {
    setState(() => _isLoadingJobs = true);
    try {
      final api = context.read<ApiService>();
      final dateStr = DateFormat('yyyy-MM-dd').format(_selectedDate);
      final jobs = await api.getAdminJobsByDate(dateStr);
      if (mounted) setState(() { _dayJobs = jobs; _isLoadingJobs = false; });
    } catch (e) {
      if (mounted) setState(() { _dayJobs = []; _isLoadingJobs = false; });
    }
  }

  void _changeMonth(int delta) {
    setState(() {
      _currentMonth = DateTime(_currentMonth.year, _currentMonth.month + delta);
    });
    _loadMonth();
  }

  void _selectDate(DateTime date) {
    setState(() => _selectedDate = date);
    _loadDayJobs();
  }

  void _openBookJob() {
    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => BookJobScreen(initialDate: _selectedDate)),
    ).then((created) {
      if (created == true) {
        _loadMonth();
        _loadDayJobs();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openBookJob,
        backgroundColor: const Color(0xFF0F172A),
        icon: const Icon(Icons.add_rounded, color: Colors.white),
        label: const Text('Book', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 15)),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        elevation: 4,
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            await _loadMonth();
            await _loadDayJobs();
          },
          color: const Color(0xFF0F172A),
          child: CustomScrollView(
            slivers: [
              // Header
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                  child: Row(
                    children: [
                      const Text(
                        'Calendar',
                        style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                      ),
                      const Spacer(),
                      GestureDetector(
                        onTap: () {
                          final now = DateTime.now();
                          setState(() {
                            _currentMonth = DateTime(now.year, now.month);
                            _selectedDate = DateTime(now.year, now.month, now.day);
                          });
                          _loadMonth();
                          _loadDayJobs();
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(
                            color: const Color(0xFF0F172A).withOpacity(0.06),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Text(
                            'Today',
                            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF0F172A)),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              // Calendar card
              SliverToBoxAdapter(
                child: Container(
                  margin: const EdgeInsets.fromLTRB(20, 16, 20, 0),
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
                      _isLoadingCalendar
                          ? const Padding(padding: EdgeInsets.all(40), child: CircularProgressIndicator(strokeWidth: 2))
                          : _buildCalendar(),
                      const SizedBox(height: 12),
                    ],
                  ),
                ),
              ),

              // Selected date header
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
                  child: Row(
                    children: [
                      Text(
                        _isToday(_selectedDate)
                            ? "Today's Jobs"
                            : DateFormat('EEE, MMM d').format(_selectedDate),
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
                          '${_dayJobs.length}',
                          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              // Day's jobs
              if (_isLoadingJobs)
                const SliverToBoxAdapter(
                  child: Padding(
                    padding: EdgeInsets.all(40),
                    child: Center(child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF0F172A))),
                  ),
                )
              else if (_dayJobs.isEmpty)
                SliverToBoxAdapter(child: _buildEmptyState())
              else
                SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) => _buildJobCard(_dayJobs[index]),
                    childCount: _dayJobs.length,
                  ),
                ),

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
                  onTap: () => _selectDate(thisDate),
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
                              (jobCount as int).clamp(0, 3),
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
      if (staff != null) photographer = staff['displayName'] ?? '';
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
            ).then((_) => _loadDayJobs());
          },
          child: Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: isRush ? Colors.red.shade200 : const Color(0xFFE2E8F0)),
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
                Expanded(
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
                      const SizedBox(height: 4),
                      Row(
                        children: [
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
                          padding: const EdgeInsets.only(top: 4),
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
                const SizedBox(width: 4),
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
          Text('No jobs scheduled', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Colors.grey.shade600)),
          const SizedBox(height: 4),
          Text('Tap Book to schedule a shoot', style: TextStyle(fontSize: 13, color: Colors.grey.shade400)),
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
