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
        if (_auth.accessToken != null)
          'Authorization': 'Bearer ${_auth.accessToken}',
      };

  // ─── tRPC query helper (batch mode) ─────────────────────────────────────

  Future<dynamic> query(String procedure, [Map<String, dynamic>? input]) async {
    // tRPC batch format: ?batch=1&input={"0":actualInput} or {"0":{}} for no input
    final batchInput = input != null ? jsonEncode({"0": input}) : jsonEncode({"0": {}});
    final uri = Uri.parse('$_baseUrl/$procedure?batch=1&input=${Uri.encodeComponent(batchInput)}');

    debugPrint('[API] GET $procedure (batch)');
    debugPrint('[API] URL: $uri');
    final response = await http.get(uri, headers: _headers);

    final bodyPreview = response.body.length > 300 ? response.body.substring(0, 300) : response.body;
    debugPrint('[API] Response ${response.statusCode}: $bodyPreview');

    if (response.statusCode != 200) {
      throw ApiException('Request failed: ${response.statusCode}', response.statusCode);
    }

    // Check if response is HTML (error case)
    if (response.body.trimLeft().startsWith('<!DOCTYPE') || response.body.trimLeft().startsWith('<html')) {
      throw ApiException('Server returned HTML instead of JSON - API route not found', 0);
    }

    final body = jsonDecode(response.body);
    // Batch response is always an array: [{"result":{"data":...}}]
    if (body is List && body.isNotEmpty) {
      final result = body[0];
      if (result is Map && result.containsKey('error')) {
        final error = result['error'];
        final message = error?['message'] ?? error?['data']?['message'] ?? 'Unknown error';
        throw ApiException('tRPC error: $message', 0);
      }
      return result['result']?['data'];
    }
    // Fallback for non-batch response
    if (body is Map) {
      if (body.containsKey('error')) {
        final error = body['error'];
        final message = error?['message'] ?? 'Unknown error';
        throw ApiException('tRPC error: $message', 0);
      }
      return body['result']?['data'];
    }
    return body;
  }

  // ─── tRPC mutation helper (batch mode) ──────────────────────────────────

  Future<dynamic> mutate(String procedure, Map<String, dynamic> input) async {
    // tRPC batch mutation: POST with ?batch=1 and body {"0":input}
    final uri = Uri.parse('$_baseUrl/$procedure?batch=1');

    debugPrint('[API] POST $procedure (batch)');
    final response = await http.post(
      uri,
      headers: _headers,
      body: jsonEncode({"0": input}),
    );

    final bodyPreview = response.body.length > 300 ? response.body.substring(0, 300) : response.body;
    debugPrint('[API] Response ${response.statusCode}: $bodyPreview');

    if (response.statusCode != 200) {
      throw ApiException('Request failed: ${response.statusCode}', response.statusCode);
    }

    if (response.body.trimLeft().startsWith('<!DOCTYPE') || response.body.trimLeft().startsWith('<html')) {
      throw ApiException('Server returned HTML instead of JSON', 0);
    }

    final body = jsonDecode(response.body);
    if (body is List && body.isNotEmpty) {
      final result = body[0];
      if (result is Map && result.containsKey('error')) {
        final error = result['error'];
        final message = error?['message'] ?? error?['data']?['message'] ?? 'Unknown error';
        throw ApiException('tRPC error: $message', 0);
      }
      return result['result']?['data'];
    }
    if (body is Map) {
      return body['result']?['data'];
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
