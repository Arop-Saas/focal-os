import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class AuthService extends ChangeNotifier {
  final SupabaseClient _supabase = Supabase.instance.client;

  bool _isLoading = true;
  bool _isAuthenticated = false;
  String? _accessToken;
  User? _user;

  bool get isLoading => _isLoading;
  bool get isAuthenticated => _isAuthenticated;
  String? get accessToken => _accessToken;
  User? get user => _user;
  String get userName => _user?.userMetadata?['name'] ?? _user?.email ?? '';
  String get userEmail => _user?.email ?? '';

  AuthService() {
    _init();
  }

  Future<void> _init() async {
    // Check for existing session
    final session = _supabase.auth.currentSession;
    if (session != null) {
      _accessToken = session.accessToken;
      _user = session.user;
      _isAuthenticated = true;
    }
    _isLoading = false;
    notifyListeners();

    // Listen for auth state changes
    _supabase.auth.onAuthStateChange.listen((data) {
      final session = data.session;
      if (session != null) {
        _accessToken = session.accessToken;
        _user = session.user;
        _isAuthenticated = true;
      } else {
        _accessToken = null;
        _user = null;
        _isAuthenticated = false;
      }
      notifyListeners();
    });
  }

  Future<String?> signIn(String email, String password) async {
    try {
      final response = await _supabase.auth.signInWithPassword(
        email: email.trim().toLowerCase(),
        password: password,
      );

      if (response.session != null) {
        _accessToken = response.session!.accessToken;
        _user = response.user;
        _isAuthenticated = true;
        notifyListeners();
        return null; // success
      }
      return 'Login failed. Please try again.';
    } on AuthException catch (e) {
      return e.message;
    } catch (e) {
      return 'Something went wrong. Please try again.';
    }
  }

  Future<void> signOut() async {
    await _supabase.auth.signOut();
    _accessToken = null;
    _user = null;
    _isAuthenticated = false;
    notifyListeners();
  }
}
