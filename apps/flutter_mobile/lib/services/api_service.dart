import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'auth_service.dart';

class ApiService {
  static const String _baseUrl = 'https://scalist.io/api/trpc';
  final AuthService _auth;

  ApiService(this._auth);

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (_auth.accessToken != null) ...{
          'Authorization': 'Bearer ${_auth.accessToken}',
          // Send token via custom header too — Vercel/Next.js may strip Authorization
          'x-mobile-token': _auth.accessToken!,
        },
      };

  // ─── superjson helpers ─────────────────────────────────────────────────
  // tRPC uses superjson transformer — inputs must be wrapped as {"json": value}
  // and responses come back as {"json": value, "meta": {...}}

  /// Wrap a value in superjson serialization format
  Map<String, dynamic> _sjSerialize(dynamic value) {
    return {"json": value ?? null};
  }

  /// Unwrap a superjson-serialized value
  dynamic _sjDeserialize(dynamic value) {
    if (value is Map && value.containsKey('json')) {
      return value['json'];
    }
    // Fallback: return as-is if not superjson wrapped
    return value;
  }

  // ─── tRPC query helper (batch mode) ─────────────────────────────────────

  Future<dynamic> query(String procedure, [Map<String, dynamic>? input]) async {
    // tRPC batch format with superjson: ?batch=1&input={"0":{"json":actualInput}}
    final batchInput = jsonEncode({"0": _sjSerialize(input)});
    final uri = Uri.parse('$_baseUrl/$procedure?batch=1&input=${Uri.encodeComponent(batchInput)}');

    debugPrint('[API] GET $procedure (batch)');
    debugPrint('[API] URL: $uri');
    debugPrint('[API] Token: ${_auth.accessToken != null ? "${_auth.accessToken!.substring(0, 20)}..." : "NULL"}');

    final response = await http.get(uri, headers: _headers);

    final bodyPreview = response.body.length > 500 ? response.body.substring(0, 500) : response.body;
    debugPrint('[API] Response ${response.statusCode}: $bodyPreview');

    if (response.statusCode != 200) {
      throw ApiException('Request failed: ${response.statusCode}', response.statusCode);
    }

    // Check if response is HTML (middleware redirect — should not happen anymore)
    if (response.body.trimLeft().startsWith('<!DOCTYPE') || response.body.trimLeft().startsWith('<html')) {
      throw ApiException('Server returned HTML instead of JSON - API route not found', 0);
    }

    final body = jsonDecode(response.body);
    return _extractBatchResult(body);
  }

  // ─── tRPC mutation helper (batch mode) ──────────────────────────────────

  Future<dynamic> mutate(String procedure, Map<String, dynamic> input) async {
    // tRPC batch mutation: POST with ?batch=1 and body {"0":{"json":input}}
    final uri = Uri.parse('$_baseUrl/$procedure?batch=1');

    debugPrint('[API] POST $procedure (batch)');
    final requestBody = jsonEncode({"0": _sjSerialize(input)});
    debugPrint('[API] Body: $requestBody');

    final response = await http.post(
      uri,
      headers: _headers,
      body: requestBody,
    );

    final bodyPreview = response.body.length > 500 ? response.body.substring(0, 500) : response.body;
    debugPrint('[API] Response ${response.statusCode}: $bodyPreview');

    if (response.statusCode != 200) {
      throw ApiException('Request failed: ${response.statusCode}', response.statusCode);
    }

    if (response.body.trimLeft().startsWith('<!DOCTYPE') || response.body.trimLeft().startsWith('<html')) {
      throw ApiException('Server returned HTML instead of JSON', 0);
    }

    final body = jsonDecode(response.body);
    return _extractBatchResult(body);
  }

  // ─── Shared response parser ────────────────────────────────────────────

  dynamic _extractBatchResult(dynamic body) {
    // Batch response is an array: [{"result":{"data":{"json":...,"meta":...}}}]
    if (body is List && body.isNotEmpty) {
      final result = body[0];
      if (result is Map && result.containsKey('error')) {
        final error = result['error'];
        final message = error?['json']?['message'] ?? error?['message'] ?? error?['data']?['message'] ?? 'Unknown error';
        throw ApiException('tRPC error: $message', 0);
      }
      final data = result['result']?['data'];
      return _sjDeserialize(data);
    }
    // Fallback for non-batch response
    if (body is Map) {
      if (body.containsKey('error')) {
        final error = body['error'];
        final message = error?['json']?['message'] ?? error?['message'] ?? 'Unknown error';
        throw ApiException('tRPC error: $message', 0);
      }
      final data = body['result']?['data'];
      return _sjDeserialize(data);
    }
    return body;
  }

  // ─── Specific API calls ─────────────────────────────────────────────────

  Future<Map<String, dynamic>> getMyRole() async {
    final data = await query('mobile.getMyRole');
    debugPrint('[API] getMyRole returned: $data');
    return data is Map<String, dynamic> ? data : {'role': 'unknown'};
  }

  Future<List<dynamic>> getMyJobs() async {
    final data = await query('mobile.getMyJobs');
    debugPrint('[API] getMyJobs returned: ${data.runtimeType} - ${data is List ? '${data.length} items' : data}');
    return (data as List?) ?? [];
  }

  Future<List<dynamic>> getAllMyJobs() async {
    try {
      final data = await query('mobile.getAllMyJobs');
      debugPrint('[API] getAllMyJobs returned: ${data.runtimeType} - ${data is List ? '${data.length} items' : data}');
      return (data as List?) ?? [];
    } catch (e) {
      debugPrint('[API] getAllMyJobs failed: $e');
      return [];
    }
  }

  Future<dynamic> getJob(String jobId) async {
    return await query('mobile.getJob', {'jobId': jobId});
  }

  Future<dynamic> getProfile() async {
    return await query('mobile.getProfile');
  }

  // ─── Owner / Admin endpoints ────────────────────────────────────────────

  Future<Map<String, dynamic>> getAdminOverview() async {
    final data = await query('mobile.getAdminOverview');
    return data is Map<String, dynamic> ? data : {};
  }

  Future<List<dynamic>> getAdminJobs() async {
    final data = await query('mobile.getAdminJobs');
    return (data as List?) ?? [];
  }

  Future<List<dynamic>> getAdminStaff() async {
    final data = await query('mobile.getAdminStaff');
    return (data as List?) ?? [];
  }

  Future<Map<String, dynamic>> getAdminProfile() async {
    final data = await query('mobile.getAdminProfile');
    return data is Map<String, dynamic> ? data : {};
  }

  Future<dynamic> getMonthOverview(int year, int month) async {
    return await query('mobile.getMonthOverview', {'year': year, 'month': month});
  }

  Future<dynamic> clockIn(String jobId) async {
    return await mutate('mobile.clockIn', {'jobId': jobId});
  }

  Future<dynamic> clockOut(String jobId) async {
    return await mutate('mobile.clockOut', {'jobId': jobId});
  }

  Future<dynamic> completeJob(String jobId) async {
    return await mutate('mobile.completeJob', {'jobId': jobId});
  }
}

class ApiException implements Exception {
  final String message;
  final int statusCode;
  ApiException(this.message, this.statusCode);

  @override
  String toString() => 'ApiException($statusCode): $message';
}
