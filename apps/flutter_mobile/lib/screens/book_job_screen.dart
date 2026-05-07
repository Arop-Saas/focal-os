import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';

class BookJobScreen extends StatefulWidget {
  final DateTime? initialDate;
  const BookJobScreen({super.key, this.initialDate});

  @override
  State<BookJobScreen> createState() => _BookJobScreenState();
}

class _BookJobScreenState extends State<BookJobScreen> {
  // Form data
  Map<String, dynamic> _formData = {};
  bool _isLoadingForm = true;
  bool _isSubmitting = false;
  String? _error;

  // Selections
  String? _selectedClientId;
  String? _selectedPackageId;
  final List<String> _selectedStaffIds = [];
  late DateTime _selectedDate;
  TimeOfDay _selectedTime = const TimeOfDay(hour: 10, minute: 0);

  // Text controllers
  final _addressController = TextEditingController();
  final _cityController = TextEditingController();
  final _stateController = TextEditingController();
  final _zipController = TextEditingController();
  final _notesController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _selectedDate = widget.initialDate ?? DateTime.now();
    _loadFormData();
  }

  @override
  void dispose() {
    _addressController.dispose();
    _cityController.dispose();
    _stateController.dispose();
    _zipController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _loadFormData() async {
    try {
      final api = context.read<ApiService>();
      final data = await api.getJobFormData();
      if (mounted) setState(() { _formData = data; _isLoadingForm = false; });
    } catch (e) {
      if (mounted) setState(() { _error = e.toString(); _isLoadingForm = false; });
    }
  }

  List<dynamic> get _clients => (_formData['clients'] as List?) ?? [];
  List<dynamic> get _packages => (_formData['packages'] as List?) ?? [];
  List<dynamic> get _staff => (_formData['staff'] as List?) ?? [];

  String _getStaffName(dynamic s) {
    if (s is Map) {
      final member = s['member'];
      if (member is Map) {
        final user = member['user'];
        if (user is Map) return user['fullName']?.toString() ?? '';
      }
    }
    return '';
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365)),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: Color(0xFF0F172A),
              onPrimary: Colors.white,
              surface: Colors.white,
            ),
          ),
          child: child!,
        );
      },
    );
    if (picked != null) setState(() => _selectedDate = picked);
  }

  Future<void> _pickTime() async {
    final picked = await showTimePicker(
      context: context,
      initialTime: _selectedTime,
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.light(
              primary: Color(0xFF0F172A),
              onPrimary: Colors.white,
            ),
          ),
          child: child!,
        );
      },
    );
    if (picked != null) setState(() => _selectedTime = picked);
  }

  Future<void> _submit() async {
    // Validation
    if (_selectedClientId == null) {
      _showError('Please select a client');
      return;
    }
    if (_addressController.text.trim().length < 5) {
      _showError('Please enter a valid property address');
      return;
    }

    setState(() => _isSubmitting = true);

    try {
      final api = context.read<ApiService>();
      final scheduledAt = DateTime(
        _selectedDate.year, _selectedDate.month, _selectedDate.day,
        _selectedTime.hour, _selectedTime.minute,
      );

      final input = <String, dynamic>{
        'clientId': _selectedClientId,
        'propertyAddress': _addressController.text.trim(),
        'propertyCity': _cityController.text.trim(),
        'propertyState': _stateController.text.trim(),
        'scheduledAt': scheduledAt.toUtc().toIso8601String(),
        'assignedStaffIds': _selectedStaffIds,
      };
      if (_selectedPackageId != null) input['packageId'] = _selectedPackageId;
      if (_zipController.text.trim().isNotEmpty) input['propertyZip'] = _zipController.text.trim();
      if (_notesController.text.trim().isNotEmpty) input['internalNotes'] = _notesController.text.trim();

      await api.createJob(input);

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Job booked successfully!'),
            backgroundColor: const Color(0xFF059669),
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        );
        Navigator.of(context).pop(true);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSubmitting = false);
        _showError('Failed to book job: $e');
      }
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.red.shade600,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 1,
        leading: IconButton(
          icon: const Icon(Icons.close_rounded, color: Color(0xFF0F172A)),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text('Book a Shoot', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: Color(0xFF0F172A))),
        centerTitle: true,
      ),
      body: _isLoadingForm
          ? const Center(child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF0F172A)))
          : _error != null
              ? Center(child: Text('Failed to load form data', style: TextStyle(color: Colors.red.shade600)))
              : ListView(
                  padding: const EdgeInsets.all(20),
                  children: [
                    // Date & Time row
                    _sectionLabel('When'),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: _tapField(
                            icon: Icons.calendar_today_rounded,
                            label: DateFormat('EEE, MMM d').format(_selectedDate),
                            onTap: _pickDate,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: _tapField(
                            icon: Icons.access_time_rounded,
                            label: _selectedTime.format(context),
                            onTap: _pickTime,
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 24),

                    // Client picker
                    _sectionLabel('Client'),
                    const SizedBox(height: 8),
                    _buildDropdown<String>(
                      value: _selectedClientId,
                      hint: 'Select a client',
                      items: _clients.map((c) {
                        final id = c['id']?.toString() ?? '';
                        final name = '${c['firstName'] ?? ''} ${c['lastName'] ?? ''}'.trim();
                        final company = c['company']?.toString() ?? '';
                        return DropdownMenuItem(
                          value: id,
                          child: Text(company.isNotEmpty ? '$name ($company)' : name),
                        );
                      }).toList(),
                      onChanged: (v) => setState(() => _selectedClientId = v),
                    ),

                    const SizedBox(height: 24),

                    // Property address
                    _sectionLabel('Property Address'),
                    const SizedBox(height: 8),
                    _buildTextField(_addressController, 'Street address', Icons.location_on_rounded),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(child: _buildTextField(_cityController, 'City', null)),
                        const SizedBox(width: 10),
                        SizedBox(width: 80, child: _buildTextField(_stateController, 'State', null)),
                        const SizedBox(width: 10),
                        SizedBox(width: 100, child: _buildTextField(_zipController, 'Zip', null)),
                      ],
                    ),

                    const SizedBox(height: 24),

                    // Package picker
                    _sectionLabel('Package'),
                    const SizedBox(height: 8),
                    _buildDropdown<String>(
                      value: _selectedPackageId,
                      hint: 'Select a package (optional)',
                      items: _packages.map((p) {
                        final id = p['id']?.toString() ?? '';
                        final name = p['name']?.toString() ?? '';
                        final price = p['price'];
                        final priceStr = price != null ? ' - ${NumberFormat.simpleCurrency().format((price as num).toDouble())}' : '';
                        return DropdownMenuItem(value: id, child: Text('$name$priceStr'));
                      }).toList(),
                      onChanged: (v) => setState(() => _selectedPackageId = v),
                    ),

                    const SizedBox(height: 24),

                    // Staff assignment
                    _sectionLabel('Assign Photographer'),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: _staff.map((s) {
                        final id = s['id']?.toString() ?? '';
                        final name = _getStaffName(s);
                        final isSelected = _selectedStaffIds.contains(id);
                        return GestureDetector(
                          onTap: () {
                            setState(() {
                              if (isSelected) {
                                _selectedStaffIds.remove(id);
                              } else {
                                _selectedStaffIds.add(id);
                              }
                            });
                          },
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                            decoration: BoxDecoration(
                              color: isSelected ? const Color(0xFF0F172A) : Colors.white,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color: isSelected ? const Color(0xFF0F172A) : const Color(0xFFE2E8F0),
                              ),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  isSelected ? Icons.check_circle_rounded : Icons.person_outline_rounded,
                                  size: 16,
                                  color: isSelected ? Colors.white : Colors.grey.shade400,
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  name,
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                    color: isSelected ? Colors.white : const Color(0xFF0F172A),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                    if (_staff.isEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text('No staff available', style: TextStyle(fontSize: 13, color: Colors.grey.shade400)),
                      ),

                    const SizedBox(height: 24),

                    // Notes
                    _sectionLabel('Notes'),
                    const SizedBox(height: 8),
                    Container(
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFFE2E8F0)),
                      ),
                      child: TextField(
                        controller: _notesController,
                        maxLines: 3,
                        decoration: InputDecoration(
                          hintText: 'Internal notes (optional)',
                          hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 14),
                          border: InputBorder.none,
                          contentPadding: const EdgeInsets.all(14),
                        ),
                        style: const TextStyle(fontSize: 14, color: Color(0xFF0F172A)),
                      ),
                    ),

                    const SizedBox(height: 32),

                    // Submit button
                    GestureDetector(
                      onTap: _isSubmitting ? null : _submit,
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        decoration: BoxDecoration(
                          color: _isSubmitting ? Colors.grey.shade300 : const Color(0xFF0F172A),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Center(
                          child: _isSubmitting
                              ? const SizedBox(
                                  width: 20, height: 20,
                                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                )
                              : const Text(
                                  'Book Shoot',
                                  style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700),
                                ),
                        ),
                      ),
                    ),

                    const SizedBox(height: 40),
                  ],
                ),
    );
  }

  Widget _sectionLabel(String text) {
    return Text(
      text,
      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.grey.shade500, letterSpacing: 0.3),
    );
  }

  Widget _tapField({required IconData icon, required String label, required VoidCallback onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Row(
          children: [
            Icon(icon, size: 18, color: const Color(0xFF3B82F6)),
            const SizedBox(width: 8),
            Text(label, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: Color(0xFF0F172A))),
          ],
        ),
      ),
    );
  }

  Widget _buildDropdown<T>({
    required T? value,
    required String hint,
    required List<DropdownMenuItem<T>> items,
    required ValueChanged<T?> onChanged,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<T>(
          value: value,
          hint: Text(hint, style: TextStyle(color: Colors.grey.shade400, fontSize: 14)),
          isExpanded: true,
          style: const TextStyle(fontSize: 14, color: Color(0xFF0F172A)),
          items: items,
          onChanged: onChanged,
          icon: Icon(Icons.keyboard_arrow_down_rounded, color: Colors.grey.shade400),
        ),
      ),
    );
  }

  Widget _buildTextField(TextEditingController controller, String hint, IconData? icon) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: TextField(
        controller: controller,
        decoration: InputDecoration(
          hintText: hint,
          hintStyle: TextStyle(color: Colors.grey.shade400, fontSize: 14),
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
          prefixIcon: icon != null ? Icon(icon, size: 18, color: Colors.grey.shade400) : null,
        ),
        style: const TextStyle(fontSize: 14, color: Color(0xFF0F172A)),
      ),
    );
  }
}
