import 'dart:convert';
import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'userdashboard.dart';

const String backendBaseUrl =
    'http://127.0.0.1:5000'; // Use 10.0.2.2 on Android emulator if needed.

class UserLoginPage extends StatefulWidget {
  const UserLoginPage({super.key});

  @override
  State<UserLoginPage> createState() => _UserLoginPageState();
}

class _UserLoginPageState extends State<UserLoginPage> {
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  bool _obscurePassword = true;

  @override
  void initState() {
    super.initState();
    if (InteractionTracker.sessionStart == null) {
      InteractionTracker.startSession();
    }
  }

  Future<void> _logUserLogin(String email) async {
    final response = await http.post(
      Uri.parse('$backendBaseUrl/session'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'email': email,
        'device': 'user_dashboard',
        'event': 'user_login',
      }),
    );

    if (response.statusCode != 200) {
      throw Exception('Backend session request failed: ${response.body}');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          // Background Image (Brighter Office/Modern)
          Container(
            decoration: const BoxDecoration(
              image: DecorationImage(
                image: NetworkImage(
                  'https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&q=80&w=2070',
                ),
                fit: BoxFit.cover,
              ),
            ),
          ),
          // Bright Sky Blue Gradient Overlay
          Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  const Color(0xFF0EA5E9).withOpacity(0.8), // Sky Blue
                  const Color(0xFF2563EB).withOpacity(0.85), // Decent Blue
                ],
              ),
            ),
          ),

          Center(
            child: SingleChildScrollView(
              child: Padding(
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  children: [
                    // Clean White Logo
                    Container(
                      padding: const EdgeInsets.all(18),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.2),
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: Colors.white.withOpacity(0.4),
                          width: 1.5,
                        ),
                      ),
                      child: const Icon(
                        Icons.waves_rounded,
                        size: 45,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 20),
                    const Text(
                      'SKYPORTAL',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 30,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 6,
                      ),
                    ),
                    const SizedBox(height: 40),

                    // Brighter Glass Card
                    ClipRRect(
                      borderRadius: BorderRadius.circular(24),
                      child: BackdropFilter(
                        filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
                        child: Container(
                          constraints: const BoxConstraints(maxWidth: 400),
                          padding: const EdgeInsets.all(32),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.15),
                            borderRadius: BorderRadius.circular(24),
                            border: Border.all(
                              color: Colors.white.withOpacity(0.3),
                            ),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Sign In',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 26,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              const SizedBox(height: 32),

                              _buildLabel('EMAIL ADDRESS'),
                              _buildTextField(
                                controller: _emailController,
                                hint: 'user@skyportal.com',
                                icon: Icons.mail_outline_rounded,
                                onChanged: (_) {
                                  InteractionTracker.trackKeystroke();
                                },
                              ),
                              const SizedBox(height: 24),

                              _buildLabel('PASSWORD'),
                              _buildTextField(
                                controller: _passwordController,
                                hint: '••••••••',
                                icon: Icons.lock_open_rounded,
                                isPassword: true,
                                onChanged: (_) {
                                  InteractionTracker.trackKeystroke();
                                },
                                suffixIcon: IconButton(
                                  icon: Icon(
                                    _obscurePassword
                                        ? Icons.visibility_off_rounded
                                        : Icons.visibility_rounded,
                                    color: Colors.white70,
                                    size: 18,
                                  ),
                                  onPressed: () => setState(
                                    () => _obscurePassword = !_obscurePassword,
                                  ),
                                ),
                              ),

                              const SizedBox(height: 40),
                              SizedBox(
                                width: double.infinity,
                                height: 52,
                                child: ElevatedButton(
                                  onPressed: () async {
                                    final email =
                                        _emailController.text.trim().isEmpty
                                        ? 'anonymous_user'
                                        : _emailController.text.trim();

                                    try {
                                      await _logUserLogin(email);
                                    } catch (e) {
                                      ScaffoldMessenger.of(
                                        context,
                                      ).showSnackBar(
                                        SnackBar(
                                          content: Text(
                                            'Login recorded locally, but live event send failed: $e',
                                          ),
                                          backgroundColor: Colors.orange,
                                        ),
                                      );
                                    }

                                    Navigator.pushReplacement(
                                      context,
                                      MaterialPageRoute(
                                        builder: (context) =>
                                            const DashboardPage(),
                                      ),
                                    );
                                  },
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: Colors.white,
                                    foregroundColor: const Color(0xFF2563EB),
                                    elevation: 0,
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                  ),
                                  child: const Text(
                                    'CONTINUE',
                                    style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w900,
                                      letterSpacing: 1.5,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 32),
                    Text(
                      'SECURE CLOUD INFRASTRUCTURE',
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.6),
                        fontSize: 9,
                        letterSpacing: 1.5,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLabel(String text) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 8),
      child: Text(
        text,
        style: const TextStyle(
          color: Colors.white70,
          fontSize: 10,
          fontWeight: FontWeight.w700,
          letterSpacing: 1.2,
        ),
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String hint,
    required IconData icon,
    bool isPassword = false,
    Widget? suffixIcon,
    ValueChanged<String>? onChanged,
  }) {
    return TextField(
      controller: controller,
      obscureText: isPassword && _obscurePassword,
      onChanged: onChanged,
      style: const TextStyle(color: Colors.white),
      decoration: InputDecoration(
        hintText: hint,
        hintStyle: TextStyle(
          color: Colors.white.withOpacity(0.3),
          fontSize: 14,
        ),
        prefixIcon: Icon(icon, color: Colors.white, size: 20),
        suffixIcon: suffixIcon,
        filled: true,
        fillColor: Colors.white.withOpacity(0.1),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 16,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: Colors.white.withOpacity(0.2)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: Colors.white, width: 1.5),
        ),
      ),
    );
  }
}
