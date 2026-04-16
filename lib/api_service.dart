import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/widgets.dart';
import 'package:http/http.dart' as http;

class ApiService {
  static String get baseUrl {
    if (kIsWeb) {
      final scheme = Uri.base.scheme == 'https' ? 'https' : 'http';
      final host = Uri.base.host.isNotEmpty ? Uri.base.host : '127.0.0.1';
      return '$scheme://$host:5000';
    }
    if (defaultTargetPlatform == TargetPlatform.android) {
      return 'http://10.0.2.2:5000';
    }
    return 'http://127.0.0.1:5000';
  }

  // Existing method for /analyze
  static Future<Map<String, dynamic>> analyzeEvent({
    required String sessionId,
    required String location,
    required String device,
    required String event,
    required int keystrokeInterval,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/analyze'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'session_id': sessionId,
        'location': location,
        'device': device,
        'event': event,
        'keystroke_interval': keystrokeInterval,
      }),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else {
      throw Exception('Failed to analyze event: ${response.body}');
    }
  }

  // New method for /session (to store login data)
  static Future<Map<String, dynamic>> createSession({
    required String email,
    required String device,
    required String event,
    required int keystrokeInterval,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/session'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'email': email,
        'device': device,
        'event': event,
        'keystroke_interval': keystrokeInterval,
      }),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else {
      throw Exception('Failed to create session: ${response.body}');
    }
  }

  // Updated method for /events (to fetch events from Firestore)
  static Future<List<Map<String, dynamic>>> getEvents() async {
    try {
      final response = await http.get(Uri.parse('$baseUrl/events'));
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as List<dynamic>;
        return data.map((item) => item as Map<String, dynamic>).toList();
      }
      throw Exception('Failed to fetch events: ${response.body}');
    } catch (e) {
      if (kIsWeb && baseUrl.contains('127.0.0.1')) {
        final fallbackUrl = Uri.parse('http://localhost:5000/events');
        final fallbackResponse = await http.get(fallbackUrl);
        if (fallbackResponse.statusCode == 200) {
          final data = jsonDecode(fallbackResponse.body) as List<dynamic>;
          return data.map((item) => item as Map<String, dynamic>).toList();
        }
      }
      throw Exception(
          'Failed to fetch events. Ensure the backend is running at http://127.0.0.1:5000 or http://localhost:5000. Error: $e');
    }
  }
}
