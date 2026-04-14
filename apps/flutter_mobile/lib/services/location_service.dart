import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'api_service.dart';

/// Manages GPS location tracking while the staff member is clocked in.
/// Sends location updates to the server every 2 minutes.
/// Singleton — use LocationService.instance after calling init().
class LocationService {
  static LocationService? _instance;
  ApiService? _api;
  Timer? _timer;
  bool _isTracking = false;
  Position? _lastPosition;

  LocationService._();

  static LocationService get instance {
    _instance ??= LocationService._();
    return _instance!;
  }

  void init(ApiService api) {
    _api = api;
  }

  bool get isTracking => _isTracking;
  Position? get lastPosition => _lastPosition;

  /// Request location permissions. Returns true if granted.
  Future<bool> requestPermission() async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      debugPrint('[Location] Location services disabled');
      return false;
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        debugPrint('[Location] Permission denied');
        return false;
      }
    }

    if (permission == LocationPermission.deniedForever) {
      debugPrint('[Location] Permission permanently denied');
      return false;
    }

    debugPrint('[Location] Permission granted: $permission');
    return true;
  }

  /// Start tracking — call when staff clocks in.
  Future<void> startTracking() async {
    if (_isTracking) return;
    if (_api == null) {
      debugPrint('[Location] Cannot start — API not initialized');
      return;
    }

    final hasPermission = await requestPermission();
    if (!hasPermission) {
      debugPrint('[Location] Cannot start tracking — no permission');
      return;
    }

    _isTracking = true;
    debugPrint('[Location] Started tracking');

    // Send initial location immediately
    await _sendLocation();

    // Then send every 2 minutes
    _timer = Timer.periodic(const Duration(minutes: 2), (_) => _sendLocation());
  }

  /// Stop tracking — call when staff clocks out.
  void stopTracking() {
    _timer?.cancel();
    _timer = null;
    _isTracking = false;
    _lastPosition = null;
    debugPrint('[Location] Stopped tracking');
  }

  /// Get current position and send to server.
  Future<void> _sendLocation() async {
    if (_api == null) return;
    try {
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 15),
        ),
      );

      _lastPosition = position;
      debugPrint('[Location] Got position: ${position.latitude}, ${position.longitude}');

      await _api!.updateLocation(position.latitude, position.longitude);
      debugPrint('[Location] Sent to server');
    } catch (e) {
      debugPrint('[Location] Error: $e');
    }
  }
}
