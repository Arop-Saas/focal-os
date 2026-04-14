import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import '../services/api_service.dart';

class JobDetailScreen extends StatefulWidget {
  final String jobId;
  final Map<String, dynamic>? jobData;

  const JobDetailScreen({super.key, required this.jobId, this.jobData});

  @override
  State<JobDetailScreen> createState() => _JobDetailScreenState();
}

class _JobDetailScreenState extends State<JobDetailScreen> {
  Map<String, dynamic>? _job;
  bool _isLoading = true;
  bool _actionLoading = false;

  @override
  void initState() {
    super.initState();
    if (widget.jobData != null) {
      _job = Map<String, dynamic>.from(widget.jobData!);
      _isLoading = false;
    }
    _loadJob();
  }

  Future<void> _loadJob() async {
    try {
      final api = context.read<ApiService>();
      final data = await api.getJob(widget.jobId);
      if (mounted && data != null) {
        setState(() {
          _job = data is Map<String, dynamic> ? data : null;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _clockIn() async {
    setState(() => _actionLoading = true);
    try {
      final api = context.read<ApiService>();
      await api.clockIn(widget.jobId);
      await _loadJob();
      if (mounted) _showSnack('Clocked in!', const Color(0xFF059669));
    } catch (e) {
      if (mounted) _showSnack('Failed: $e', Colors.red);
    }
    if (mounted) setState(() => _actionLoading = false);
  }

  Future<void> _clockOut() async {
    setState(() => _actionLoading = true);
    try {
      final api = context.read<ApiService>();
      await api.clockOut(widget.jobId);
      await _loadJob();
      if (mounted) _showSnack('Clocked out!', const Color(0xFF059669));
    } catch (e) {
      if (mounted) _showSnack('Failed: $e', Colors.red);
    }
    if (mounted) setState(() => _actionLoading = false);
  }

  Future<void> _completeJob() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Complete Job', style: TextStyle(fontWeight: FontWeight.w600)),
        content: const Text('Mark this job as complete?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Complete', style: TextStyle(fontWeight: FontWeight.w600)),
          ),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _actionLoading = true);
    try {
      final api = context.read<ApiService>();
      await api.completeJob(widget.jobId);
      await _loadJob();
      if (mounted) _showSnack('Job completed!', const Color(0xFF059669));
    } catch (e) {
      if (mounted) _showSnack('Failed: $e', Colors.red);
    }
    if (mounted) setState(() => _actionLoading = false);
  }

  void _showSnack(String msg, Color color) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg, style: const TextStyle(fontWeight: FontWeight.w500)),
        backgroundColor: color,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  Future<void> _openMaps(String address) async {
    final uri = Uri.parse('https://www.google.com/maps/search/?api=1&query=${Uri.encodeComponent(address)}');
    if (await canLaunchUrl(uri)) await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        leading: GestureDetector(
          onTap: () => Navigator.pop(context),
          child: Container(
            margin: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.arrow_back_rounded, size: 20, color: Color(0xFF0F172A)),
          ),
        ),
        title: const Text('Job Details', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: Color(0xFF0F172A))),
        centerTitle: true,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF0F172A)))
          : _job == null
              ? const Center(child: Text('Job not found'))
              : _buildContent(),
      bottomNavigationBar: _job != null ? _buildActions() : null,
    );
  }

  Widget _buildContent() {
    final job = _job!;
    final status = job['status']?.toString() ?? 'PENDING';
    final packageName = job['package']?['name'] ?? 'Job';
    final client = job['client'];
    final clientName = client != null ? '${client['firstName'] ?? ''} ${client['lastName'] ?? ''}'.trim() : '';
    final clientPhone = client?['phone'] ?? '';
    final clientEmail = client?['email'] ?? '';
    final address = job['propertyAddress'] ?? '';
    final city = job['propertyCity'] ?? '';
    final scheduledAt = job['scheduledAt'];
    final notes = job['internalNotes'] ?? job['clientNotes'] ?? '';
    final services = job['services'] as List? ?? [];

    String dateTime = '';
    if (scheduledAt != null) {
      final dt = DateTime.tryParse(scheduledAt.toString());
      if (dt != null) dateTime = DateFormat('EEEE, MMMM d  ·  h:mm a').format(dt.toLocal());
    }

    final statusConfig = _getStatusConfig(status);

    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        // Header card
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(packageName, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: Color(0xFF0F172A))),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                    decoration: BoxDecoration(
                      color: statusConfig.color.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(statusConfig.label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: statusConfig.color)),
                  ),
                ],
              ),
              if (dateTime.isNotEmpty) ...[
                const SizedBox(height: 12),
                Row(
                  children: [
                    Icon(Icons.schedule_rounded, size: 16, color: Colors.grey.shade400),
                    const SizedBox(width: 6),
                    Text(dateTime, style: TextStyle(fontSize: 14, color: Colors.grey.shade600, fontWeight: FontWeight.w500)),
                  ],
                ),
              ],
            ],
          ),
        ),

        const SizedBox(height: 14),

        // Location
        if (address.isNotEmpty)
          _buildCard(
            icon: Icons.location_on_rounded,
            iconColor: const Color(0xFFEF4444),
            title: 'Location',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(address, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: Color(0xFF0F172A))),
                if (city.isNotEmpty)
                  Text(city, style: TextStyle(fontSize: 13, color: Colors.grey.shade500)),
                const SizedBox(height: 10),
                GestureDetector(
                  onTap: () => _openMaps('$address $city'),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      color: const Color(0xFF3B82F6).withOpacity(0.08),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.directions_rounded, size: 16, color: Color(0xFF3B82F6)),
                        SizedBox(width: 6),
                        Text('Navigate', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Color(0xFF3B82F6))),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),

        // Client
        if (clientName.isNotEmpty)
          _buildCard(
            icon: Icons.person_rounded,
            iconColor: const Color(0xFF8B5CF6),
            title: 'Client',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(clientName, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500, color: Color(0xFF0F172A))),
                if (clientPhone.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  GestureDetector(
                    onTap: () => launchUrl(Uri.parse('tel:$clientPhone')),
                    child: Text(clientPhone, style: const TextStyle(fontSize: 13, color: Color(0xFF3B82F6))),
                  ),
                ],
                if (clientEmail.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(clientEmail, style: TextStyle(fontSize: 13, color: Colors.grey.shade500)),
                ],
              ],
            ),
          ),

        // Services
        if (services.isNotEmpty)
          _buildCard(
            icon: Icons.camera_alt_rounded,
            iconColor: const Color(0xFFF59E0B),
            title: 'Services',
            child: Wrap(
              spacing: 8, runSpacing: 8,
              children: services.map<Widget>((s) {
                final name = s['service']?['name'] ?? '';
                return Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(name, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: Color(0xFF334155))),
                );
              }).toList(),
            ),
          ),

        // Notes
        if (notes.isNotEmpty)
          _buildCard(
            icon: Icons.sticky_note_2_rounded,
            iconColor: const Color(0xFF059669),
            title: 'Notes',
            child: Text(notes, style: TextStyle(fontSize: 14, color: Colors.grey.shade600, height: 1.4)),
          ),

        // Clock times
        if (job['actualStartAt'] != null)
          _buildCard(
            icon: Icons.timer_rounded,
            iconColor: const Color(0xFF3B82F6),
            title: 'Time Log',
            child: Column(
              children: [
                _timeRow('Clocked In', job['actualStartAt']),
                if (job['actualEndAt'] != null)
                  _timeRow('Clocked Out', job['actualEndAt']),
              ],
            ),
          ),

        const SizedBox(height: 100),
      ],
    );
  }

  Widget _buildCard({required IconData icon, required Color iconColor, required String title, required Widget child}) {
    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(18),
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
                width: 30, height: 30,
                decoration: BoxDecoration(color: iconColor.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
                child: Icon(icon, size: 16, color: iconColor),
              ),
              const SizedBox(width: 10),
              Text(title, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.grey.shade400)),
            ],
          ),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }

  Widget _timeRow(String label, dynamic value) {
    String formatted = '';
    if (value != null) {
      final dt = DateTime.tryParse(value.toString());
      if (dt != null) formatted = DateFormat('h:mm a').format(dt.toLocal());
    }
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(fontSize: 14, color: Colors.grey.shade500)),
          Text(formatted, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF0F172A))),
        ],
      ),
    );
  }

  Widget? _buildActions() {
    final status = _job?['status']?.toString().toUpperCase() ?? '';
    if (status == 'COMPLETED' || status == 'CANCELLED' || status == 'DELIVERED' || status == 'EDITING') {
      return null;
    }

    return Container(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(top: BorderSide(color: Colors.grey.shade200)),
      ),
      child: Row(
        children: [
          if (status == 'PENDING' || status == 'CONFIRMED' || status == 'SCHEDULED')
            Expanded(
              child: _actionButton('Clock In', Icons.login_rounded, const Color(0xFF0F172A), _clockIn),
            )
          else if (status == 'IN_PROGRESS') ...[
            Expanded(
              child: _actionButton('Clock Out', Icons.logout_rounded, const Color(0xFFF59E0B), _clockOut),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _actionButton('Complete', Icons.check_circle_rounded, const Color(0xFF059669), _completeJob),
            ),
          ],
        ],
      ),
    );
  }

  Widget _actionButton(String label, IconData icon, Color color, VoidCallback onTap) {
    return GestureDetector(
      onTap: _actionLoading ? null : onTap,
      child: Container(
        height: 50,
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Center(
          child: _actionLoading
              ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              : Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(icon, size: 18, color: Colors.white),
                    const SizedBox(width: 8),
                    Text(label, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Colors.white)),
                  ],
                ),
        ),
      ),
    );
  }

  _StatusConfig _getStatusConfig(String status) {
    switch (status.toUpperCase()) {
      case 'CONFIRMED': case 'SCHEDULED':
        return _StatusConfig('Confirmed', const Color(0xFF059669));
      case 'IN_PROGRESS':
        return _StatusConfig('In Progress', const Color(0xFF3B82F6));
      case 'EDITING':
        return _StatusConfig('Editing', const Color(0xFF8B5CF6));
      case 'COMPLETED':
        return _StatusConfig('Done', const Color(0xFF6B7280));
      case 'DELIVERED':
        return _StatusConfig('Delivered', const Color(0xFF059669));
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
