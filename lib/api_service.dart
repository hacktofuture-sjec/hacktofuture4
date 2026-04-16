import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiService {
  static const String baseUrl = 'http://127.0.0.1:5000';  // Update to your backend URL

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
    final response = await http.get(Uri.parse('$baseUrl/events'));
    if (response.statusCode == 200) {
      List<dynamic> data = jsonDecode(response.body);
      return data.map((item) => item as Map<String, dynamic>).toList();
    } else {
      throw Exception('Failed to fetch events: ${response.body}');
    }
  }
}
