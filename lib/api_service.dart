import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiService {
  static const List<String> backendBaseUrls = [
    'https://kissing-foothold-upheaval.ngrok-free.dev',
  ];

  static Future<Map<String, dynamic>> analyzeEvent({
    required String sessionId,
    required String location,
    required String device,
    required String event,
    int? keystrokeInterval,
  }) async {
    Exception? lastException;

    for (final baseUrl in backendBaseUrls) {
      final endpoint = '$baseUrl/analyze';
      try {
        final body = <String, dynamic>{
          'session_id': sessionId,
          'location': location,
          'device': device,
          'event': event,
        };
        if (keystrokeInterval != null) {
          body['keystroke_interval'] = keystrokeInterval;
        }

        final response = await http.post(
          Uri.parse(endpoint),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode(body),
        );

        if (response.statusCode == 200) {
          return jsonDecode(response.body) as Map<String, dynamic>;
        }

        lastException = Exception('Backend request failed at $endpoint with status ${response.statusCode}: ${response.body}');
      } catch (error) {
        lastException = Exception('Failed to reach backend at $endpoint: $error');
      }
    }

    throw lastException ?? Exception('Failed to reach backend');
  }

  static Future<List<Map<String, dynamic>>> getEvents() async {
    Exception? lastException;

    for (final baseUrl in backendBaseUrls) {
      final endpoint = '$baseUrl/events';
      try {
        final response = await http.get(Uri.parse(endpoint));

        if (response.statusCode == 200) {
          final data = jsonDecode(response.body) as List<dynamic>;
          return data.map((e) => e as Map<String, dynamic>).toList();
        }

        lastException = Exception('Backend request failed at $endpoint with status ${response.statusCode}: ${response.body}');
      } catch (error) {
        lastException = Exception('Failed to reach backend at $endpoint: $error');
      }
    }

    throw lastException ?? Exception('Failed to reach backend');
  }
}
