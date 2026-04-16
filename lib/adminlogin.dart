import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'api_service.dart';
import 'auth_service.dart';
import 'dashboard.dart';
import 'employee_portal.dart';

class AdminLoginPage extends StatefulWidget {
  const AdminLoginPage({super.key});

  @override
  State<AdminLoginPage> createState() => _AdminLoginPageState();
}

class _AdminLoginPageState extends State<AdminLoginPage> {
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _passwordController = TextEditingController();
  bool _isLoading = false;
  String? _statusMessage;

  @override
  void initState() {
    super.initState();
    _emailController.text = 'admin@email.com';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF001122),
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            return SingleChildScrollView(
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: constraints.maxHeight),
                child: IntrinsicHeight(
                  child: Column(
                    children: [
                      // Custom Header Bar
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                        decoration: const BoxDecoration(
                          border: Border(bottom: BorderSide(color: Colors.white12, width: 0.5)),
                        ),
                        child: Row(
                          children: [
                            const Text(
                              'Cyber Sentinel',
                              style: TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 1,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Text(
                              'GATEWAY',
                              style: TextStyle(
                                color: Colors.cyan.shade300,
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      ),
                      
                      // Centered Login Card
                      Expanded(
                        child: Center(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 40),
                            child: Container(
                              width: 380,
                              padding: const EdgeInsets.all(32),
                              decoration: BoxDecoration(
                                color: const Color(0xFF0A192F),
                                borderRadius: BorderRadius.circular(8),
                                boxShadow: [
                                  BoxShadow(
                                    color: Colors.black.withAlpha(128),
                                    blurRadius: 20,
                                    spreadRadius: 5,
                                  ),
                                ],
                              ),
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Text(
                                    'Cyber Sentinel',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 24,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  const Text(
                                    'Stay Protected 24/7',
                                    style: TextStyle(
                                      color: Colors.white60,
                                      fontSize: 12,
                                    ),
                                  ),
                                  const SizedBox(height: 32),
                                  _buildInputField(
                                    label: 'EMAIL',
                                    controller: _emailController,
                                    icon: Icons.email_outlined,
                                    hint: 'ADMIN EMAIL',
                                  ),
                                  const SizedBox(height: 24),
                                  _buildInputField(
                                    label: 'PASSWORD',
                                    controller: _passwordController,
                                    icon: Icons.lock_outline,
                                    hint: '••••••••••••',
                                    isPassword: true,
                                  ),
                                  const SizedBox(height: 40),
                                  SizedBox(
                                    width: double.infinity,
                                    height: 50,
                                    child: ElevatedButton(
                                      onPressed: _isLoading
                                          ? null
                                          : () async {
                                              final email = _emailController.text.trim();
                                              final password = _passwordController.text.trim();
                                              final sessionId = email.isNotEmpty ? email : 'guest_session';
                                              final scaffoldMessenger = ScaffoldMessenger.of(context);
                                              final navigator = Navigator.of(context);
                                              if (email.isEmpty || password.isEmpty) {
                                                scaffoldMessenger.showSnackBar(
                                                  const SnackBar(
                                                    content: Text('Please enter email and password'),
                                                    backgroundColor: Colors.redAccent,
                                                  ),
                                                );
                                                return;
                                              }

                                              setState(() {
                                                _isLoading = true;
                                                _statusMessage = null;
                                              });

                                              try {
                                                final credential = await AuthService.signInWithEmailAndPassword(
                                                  email: email,
                                                  password: password,
                                                );

                                                if (!AuthService.isAdmin(credential.user)) {
                                                  // For non-admin users, navigate to employee portal
                                                  if (!mounted) return;
                                                  navigator.pushReplacement(
                                                    MaterialPageRoute(builder: (context) => const EmployeePortalPage()),
                                                  );
                                                  return;
                                                }

                                                try {
                                                  final result = await ApiService.analyzeEvent(
                                                    sessionId: sessionId,
                                                    location: 'India',
                                                    device: 'Android Chrome',
                                                    event: 'admin_login',
                                                    keystrokeInterval: 15,
                                                  );

                                                  if (!mounted) return;
                                                  setState(() {
                                                    _statusMessage = 'Backend logged login: ${result['action']} (${result['trust_score']})';
                                                  });
                                                } catch (backendError) {
                                                  if (!mounted) return;
                                                  setState(() {
                                                    _statusMessage = 'Authenticated as admin, but backend logging failed.';
                                                  });
                                                }

                                                if (!mounted) return;
                                                navigator.pushReplacement(
                                                  MaterialPageRoute(builder: (context) => const DashboardPage()),
                                                );
                                              } on FirebaseAuthException catch (error) {
                                                if (!mounted) return;
                                                String message;

                                                switch (error.code) {
                                                  case 'user-not-found':
                                                    message = 'No user found for that email.';
                                                    break;
                                                  case 'wrong-password':
                                                    message = 'Wrong password provided.';
                                                    break;
                                                  case 'invalid-email':
                                                    message = 'Please enter a valid email address.';
                                                    break;
                                                  case 'user-disabled':
                                                    message = 'This user account has been disabled.';
                                                    break;
                                                  default:
                                                    message = error.message ?? 'Authentication failed.';
                                                }

                                                scaffoldMessenger.showSnackBar(
                                                  SnackBar(
                                                    content: Text(message),
                                                    backgroundColor: Colors.redAccent,
                                                  ),
                                                );
                                              } catch (error) {
                                                if (!mounted) return;
                                                scaffoldMessenger.showSnackBar(
                                                  SnackBar(
                                                    content: Text(error.toString()),
                                                    backgroundColor: Colors.redAccent,
                                                  ),
                                                );
                                              } finally {
                                                if (mounted) {
                                                  setState(() {
                                                    _isLoading = false;
                                                  });
                                                }
                                              }
                                            },
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: const Color(0xFF90E0EF),
                                        foregroundColor: Colors.black87,
                                        shape: RoundedRectangleBorder(
                                          borderRadius: BorderRadius.circular(4),
                                        ),
                                      ),
                                      child: const Text(
                                        'LOGIN',
                                        style: TextStyle(
                                          fontWeight: FontWeight.bold,
                                          letterSpacing: 2,
                                        ),
                                      ),
                                    ),
                                  ),
                                  if (_statusMessage != null) ...[
                                    const SizedBox(height: 16),
                                    Text(
                                      _statusMessage!,
                                      style: const TextStyle(color: Colors.cyanAccent, fontSize: 12),
                                      textAlign: TextAlign.center,
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _buildInputField({
    required String label,
    required TextEditingController controller,
    required IconData icon,
    required String hint,
    bool isPassword = false,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            color: Colors.white38,
            fontSize: 10,
            fontWeight: FontWeight.bold,
            letterSpacing: 1.5,
          ),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: controller,
          obscureText: isPassword,
          style: const TextStyle(color: Colors.white),
          decoration: InputDecoration(
            prefixIcon: Icon(icon, color: Colors.white38, size: 20),
            hintText: hint,
            hintStyle: const TextStyle(color: Colors.white12, fontSize: 14),
            filled: true,
            fillColor: Colors.black26,
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            enabledBorder: const OutlineInputBorder(
              borderSide: BorderSide(color: Colors.transparent),
            ),
            focusedBorder: const OutlineInputBorder(
              borderSide: BorderSide(color: Colors.white12),
            ),
          ),
        ),
      ],
    );
  }
}
