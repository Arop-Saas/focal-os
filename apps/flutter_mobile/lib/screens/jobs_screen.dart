import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
import 'job_detail_screen.dart';

class JobsScreen extends StatefulWidget {
  const JobsScreen({super.key});

  @override
  State<JobsScreen> createState() => _JobsScreenState();
}

class _JobsScreenState extends State<JobsScreen> {
  List<dynamic> _jobs = [];
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadJobs();
  }

  Future<void> _loadJobs() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final api = context.read<ApiService>();
      final jobs = await api.getMyJobs();
      if (mounted) {
        setState(() {
          _jobs = jobs;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString();
          _isLoading = false;
        });
      }
    }
  }

  Map<String, List<dynamic>> _groupJobs() {
    final now = DateTime.now();
    final today = DateTime(now.year, now.month, now.day);
    final tomorrow = today.add(const Duration(days: 1));
    final endOfWeek = today.add(Duration(days: 7 - today.weekday));

    final groups = <String, List<dynamic>>{
      'Today': [],
      'Tomorrow': [],
      'This Week': [],
      'Upcoming': [],
    };

    for (final job in _jobs) {
      final dateStr = job['date'] ?? job['scheduledDate'];
      if (dateStr == null) {
        groups['Upcoming']!.add(job);
        continue;
      }

      final date = DateTime.tryParse(dateStr);
      if (date == null) {
        groups['Upcoming']!.add(job);
        continue;
      }

      final jobDay = DateTime(date.year, date.month, date.day);

      if (jobDay == today) {
        groups['Today']!.add(job);
      } else if (jobDay == tomorrow) {
        groups['Tomorrow']!.add(job);
      } else if (jobDay.isAfter(today) && jobDay.isBefore(endOfWeek)) {
        groups['This Week']!.add(job);
      } else if (jobDay.isAfter(today)) {
        groups['Upcoming']!.add(job);
      }
    }

    // Remove empty groups
    groups.removeWhere((_, jobs) => jobs.isEmpty);
    return groups;
  }

  Color _statusColor(String? status) {
    switch (status?.toLowerCase()) {
      case 'confirmed':
        return Colors.green;
      case 'in_progress':
      case 'clocked_in':
        return Colors.blue;
      case 'completed':
        return Colors.grey;
      case 'cancelled':
        return Colors.red;
      default:
        return Colors.orange;
    }
  }

  String _statusLabel(String? status) {
    switch (status?.toLowerCase()) {
      case 'confirmed':
        return 'Confirmed';
      case 'in_progress':
      case 'clocked_in':
        return 'In Progress';
      case 'completed':
        return 'Completed';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status ?? 'Pending';
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Jobs'),
        centerTitle: false,
        titleTextStyle: theme.textTheme.headlineSmall?.copyWith(
          fontWeight: FontWeight.bold,
        ),
      ),
      body: _buildBody(theme),
    );
  }

  Widget _buildBody(ThemeData theme) {
    if (_isLoading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.error_outline, size: 48, color: theme.colorScheme.error),
              const SizedBox(height: 16),
              Text('Failed to load jobs', style: theme.textTheme.titleMedium),
              const SizedBox(height: 8),
              Text(_error!, style: theme.textTheme.bodySmall, textAlign: TextAlign.center),
              const SizedBox(height: 24),
              FilledButton.tonal(
                onPressed: _loadJobs,
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    if (_jobs.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.work_off_outlined, size: 64, color: theme.colorScheme.outline),
            const SizedBox(height: 16),
            Text('No upcoming jobs', style: theme.textTheme.titleMedium),
            const SizedBox(height: 8),
            Text(
              'Your assigned jobs will appear here.',
              style: theme.textTheme.bodyMedium?.copyWith(
                color: theme.colorScheme.onSurfaceVariant,
              ),
            ),
          ],
        ),
      );
    }

    final groups = _groupJobs();

    return RefreshIndicator(
      onRefresh: _loadJobs,
      child: ListView.builder(
        padding: const EdgeInsets.only(bottom: 16),
        itemCount: groups.length,
        itemBuilder: (context, groupIndex) {
          final groupName = groups.keys.elementAt(groupIndex);
          final groupJobs = groups[groupName]!;

          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 20, 16, 8),
                child: Text(
                  groupName,
                  style: theme.textTheme.titleSmall?.copyWith(
                    color: theme.colorScheme.primary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              ...groupJobs.map((job) => _buildJobCard(job, theme)),
            ],
          );
        },
      ),
    );
  }

  Widget _buildJobCard(dynamic job, ThemeData theme) {
    final status = job['status'] as String?;
    final title = job['title'] ?? job['serviceName'] ?? 'Job';
    final clientName = job['clientName'] ?? '';
    final dateStr = job['date'] ?? job['scheduledDate'];
    final timeStr = job['time'] ?? job['scheduledTime'] ?? '';
    final address = job['address'] ?? job['location'] ?? '';
    final jobId = job['id']?.toString() ?? '';

    String formattedDate = '';
    if (dateStr != null) {
      final date = DateTime.tryParse(dateStr);
      if (date != null) {
        formattedDate = DateFormat('EEE, MMM d').format(date);
      }
    }

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: theme.colorScheme.outlineVariant),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () {
          Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => JobDetailScreen(jobId: jobId, jobData: job),
            ),
          );
        },
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            title,
                            style: theme.textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: _statusColor(status).withOpacity(0.12),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            _statusLabel(status),
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: _statusColor(status),
                            ),
                          ),
                        ),
                      ],
                    ),
                    if (clientName.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          Icon(Icons.person_outline, size: 16, color: theme.colorScheme.onSurfaceVariant),
                          const SizedBox(width: 4),
                          Text(
                            clientName,
                            style: theme.textTheme.bodyMedium?.copyWith(
                              color: theme.colorScheme.onSurfaceVariant,
                            ),
                          ),
                        ],
                      ),
                    ],
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        if (formattedDate.isNotEmpty) ...[
                          Icon(Icons.calendar_today, size: 14, color: theme.colorScheme.onSurfaceVariant),
                          const SizedBox(width: 4),
                          Text(
                            formattedDate,
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: theme.colorScheme.onSurfaceVariant,
                            ),
                          ),
                        ],
                        if (timeStr.isNotEmpty) ...[
                          const SizedBox(width: 12),
                          Icon(Icons.access_time, size: 14, color: theme.colorScheme.onSurfaceVariant),
                          const SizedBox(width: 4),
                          Text(
                            timeStr,
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: theme.colorScheme.onSurfaceVariant,
                            ),
                          ),
                        ],
                      ],
                    ),
                    if (address.isNotEmpty) ...[
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          Icon(Icons.location_on_outlined, size: 14, color: theme.colorScheme.onSurfaceVariant),
                          const SizedBox(width: 4),
                          Expanded(
                            child: Text(
                              address,
                              style: theme.textTheme.bodySmall?.copyWith(
                                color: theme.colorScheme.onSurfaceVariant,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Icon(Icons.chevron_right, color: theme.colorScheme.outline),
            ],
          ),
        ),
      ),
    );
  }
}
