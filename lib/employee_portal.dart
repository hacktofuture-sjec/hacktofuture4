import 'dart:async';
import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'auth_service.dart';
import 'adminlogin.dart';
import 'api_service.dart';

class EmployeePortalPage extends StatefulWidget {
  const EmployeePortalPage({super.key});

  @override
  State<EmployeePortalPage> createState() => _EmployeePortalPageState();
}

class _EmployeePortalPageState extends State<EmployeePortalPage> {
  StreamSubscription<User?>? _authSub;

  @override
  void initState() {
    super.initState();
    // Listen for auth state changes and log login event when user becomes available
    _authSub = FirebaseAuth.instance.authStateChanges().listen((user) {
      if (user != null) {
        _logEmployeeLogin(user);
      }
    });
  }

  @override
  void dispose() {
    _authSub?.cancel();
    super.dispose();
  }

  Future<void> _logEmployeeLogin([User? user]) async {
    final u = user ?? AuthService.currentUser;
    if (u != null) {
      try {
        await ApiService.analyzeEvent(
          sessionId: u.email ?? 'unknown',
          location: 'India',
          device: 'Android Chrome',
          event: 'employee_login',
          keystrokeInterval: 15,
        );
      } catch (e) {
        // ignore logging errors for now
      }
    }
  }

  List<Map<String, String>> get _employees => const [
        {
          'name': 'Sarah Chen',
          'role': 'Senior Architect',
          'team': 'Design',
          'location': 'New York',
          'status': 'Online',
        },
        {
          'name': 'Marcus Thorne',
          'role': 'Lead Engineer',
          'team': 'Engineering',
          'location': 'London',
          'status': 'Busy',
        },
        {
          'name': 'Elena Rodriguez',
          'role': 'Strategy Director',
          'team': 'Strategy',
          'location': 'Remote',
          'status': 'Available',
        },
        {
          'name': 'Julian Vo',
          'role': 'UX Designer',
          'team': 'Design',
          'location': 'New York',
          'status': 'Online',
        },
        {
          'name': 'Isabella Conti',
          'role': 'Project Lead',
          'team': 'Strategy',
          'location': 'London',
          'status': 'Away',
        },
        {
          'name': 'Liam Fischer',
          'role': 'DevOps Engineer',
          'team': 'Engineering',
          'location': 'Remote',
          'status': 'Online',
        },
      ];

  @override
  Widget build(BuildContext context) {
    final user = AuthService.currentUser;
    final screenWidth = MediaQuery.of(context).size.width;

    return Scaffold(
      backgroundColor: const Color(0xFFF4F7FB),
      body: SafeArea(
        child: Row(
          children: [
            // Sidebar
            Container(
              width: screenWidth < 1100 ? 250 : 280,
              color: const Color(0xFF123A6F),
              padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Employee Portal',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    user?.email ?? 'Precision & Serenity',
                    style: const TextStyle(
                      color: Color(0xBFFFFFFF),
                      fontSize: 12,
                    ),
                  ),
                  const SizedBox(height: 28),
                  _buildSidebarItem(Icons.home, 'Home', true),
                  const SizedBox(height: 16),
                  _buildSidebarItem(Icons.workspaces, 'My Workspace'),
                  const SizedBox(height: 16),
                  _buildSidebarItem(Icons.group, 'Team Portal'),
                  const SizedBox(height: 16),
                  _buildSidebarItem(Icons.article, 'Company News'),
                  const SizedBox(height: 16),
                  _buildSidebarItem(Icons.support_agent, 'Support'),
                  const Spacer(),
                  Container(
                    margin: const EdgeInsets.only(bottom: 18),
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0D4B8B),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Your Impact',
                          style: TextStyle(
                            color: Colors.white70,
                            fontSize: 12,
                          ),
                        ),
                        const SizedBox(height: 12),
                        _buildStatTile('42', 'Connections this month'),
                        const SizedBox(height: 12),
                        _buildStatTile('12', 'New teammates joined'),
                      ],
                    ),
                  ),
                  GestureDetector(
                    onTap: () async {
                      await AuthService.signOut();
                      if (context.mounted) {
                        Navigator.of(context).pushReplacement(
                          MaterialPageRoute(builder: (context) => const AdminLoginPage()),
                        );
                      }
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
                      decoration: BoxDecoration(
                        color: const Color(0xFF143F76),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Row(
                        children: const [
                          Icon(Icons.logout, color: Colors.white, size: 18),
                          SizedBox(width: 12),
                          Text(
                            'Logout',
                            style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // Main content
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 28),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Top header
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Company Directory',
                              style: TextStyle(
                                color: Color(0xFF0F1C34),
                                fontSize: 32,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            const SizedBox(height: 6),
                            const Text(
                              'Connect with the minds building the future of architecture.',
                              style: TextStyle(
                                color: Color(0xFF5D6B84),
                                fontSize: 14,
                              ),
                            ),
                          ],
                        ),
                        Container(
                          width: 360,
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                          decoration: BoxDecoration(
                            color: Colors.white,
                            borderRadius: BorderRadius.circular(16),
                            boxShadow: [
                              BoxShadow(
                                color: const Color.fromRGBO(0, 0, 0, 0.04),
                                blurRadius: 20,
                                spreadRadius: 2,
                              ),
                            ],
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.search, color: Color(0xFF56627A)),
                              const SizedBox(width: 12),
                              Expanded(
                                child: TextField(
                                  decoration: InputDecoration(
                                    border: InputBorder.none,
                                    hintText: 'Search by name, role, or team...',
                                    hintStyle: TextStyle(color: Colors.grey.shade400),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),

                    Expanded(
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Filter column
                          ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 320),
                            child: Column(
                              children: [
                                _buildFilterCard(),
                                const SizedBox(height: 20),
                                _buildDirectoryStatsCard(),
                              ],
                            ),
                          ),

                          const SizedBox(width: 24),

                          // Directory cards
                          Expanded(
                            child: GridView.builder(
                              itemCount: _employees.length,
                              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                                crossAxisCount: 3,
                                crossAxisSpacing: 18,
                                mainAxisSpacing: 18,
                                childAspectRatio: 0.82,
                              ),
                              itemBuilder: (context, index) {
                                final employee = _employees[index];
                                return _buildEmployeeCard(employee);
                              },
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSidebarItem(IconData icon, String label, [bool active = false]) {
    return Row(
      children: [
        Icon(icon, color: active ? Colors.white : Colors.white70, size: 18),
        const SizedBox(width: 12),
        Text(
          label,
          style: TextStyle(
            color: active ? Colors.white : Colors.white70,
            fontWeight: active ? FontWeight.w700 : FontWeight.w500,
          ),
        ),
      ],
    );
  }

  Widget _buildFilterCard() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: const Color.fromRGBO(0, 0, 0, 0.05),
            blurRadius: 20,
            spreadRadius: 4,
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Refine Search',
            style: TextStyle(
              color: Color(0xFF0F1C34),
              fontSize: 16,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 18),
          const Text('Department', style: TextStyle(color: Color(0xFF5D6B84), fontSize: 12)),
          const SizedBox(height: 10),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _buildFilterChip('All', true),
              _buildFilterChip('Design'),
              _buildFilterChip('Engineering'),
              _buildFilterChip('Strategy'),
              _buildFilterChip('Admin'),
            ],
          ),
          const SizedBox(height: 18),
          const Text('Location', style: TextStyle(color: Color(0xFF5D6B84), fontSize: 12)),
          const SizedBox(height: 10),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildLocationItem('New York HQ', true),
              _buildLocationItem('London Office'),
              _buildLocationItem('Singapore Hub'),
              _buildLocationItem('Remote'),
            ],
          ),
          const SizedBox(height: 18),
          TextButton(
            onPressed: () {},
            child: const Text('Reset Filters'),
          ),
        ],
      ),
    );
  }

  Widget _buildDirectoryStatsCard() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: const Color(0xFF123A6F),
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: const [
          Text(
            'Your Impact',
            style: TextStyle(color: Colors.white70, fontSize: 12),
          ),
          SizedBox(height: 24),
          Text('42', style: TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.bold)),
          SizedBox(height: 6),
          Text('Connections this month', style: TextStyle(color: Colors.white70, fontSize: 12)),
          SizedBox(height: 24),
          Text('12', style: TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.bold)),
          SizedBox(height: 6),
          Text('New teammates joined', style: TextStyle(color: Colors.white70, fontSize: 12)),
        ],
      ),
    );
  }

  Widget _buildLocationItem(String label, [bool selected = false]) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Icon(
            selected ? Icons.radio_button_checked : Icons.radio_button_unchecked,
            color: selected ? const Color(0xFF123A6F) : Colors.grey.shade400,
            size: 18,
          ),
          const SizedBox(width: 10),
          Text(
            label,
            style: TextStyle(
              color: selected ? const Color(0xFF123A6F) : const Color(0xFF5D6B84),
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String label, [bool active = false]) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: active ? const Color(0xFF123A6F) : const Color(0xFFE8EEF8),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: active ? Colors.white : const Color(0xFF5D6B84),
          fontSize: 12,
          fontWeight: active ? FontWeight.w700 : FontWeight.w500,
        ),
      ),
    );
  }

  Widget _buildEmployeeCard(Map<String, String> employee) {
    final statusColor = employee['status'] == 'Online'
        ? Colors.green
        : employee['status'] == 'Busy'
            ? Colors.orange
            : employee['status'] == 'Away'
                ? Colors.amber
                : Colors.grey;

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: const Color.fromRGBO(0, 0, 0, 0.04),
            blurRadius: 20,
            spreadRadius: 4,
          ),
        ],
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 26,
                backgroundColor: const Color(0xFFE7F0FF),
                child: Text(
                  employee['name']!.split(' ').map((part) => part[0]).take(2).join(),
                  style: const TextStyle(color: Color(0xFF123A6F), fontWeight: FontWeight.bold),
                ),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: statusColor.withAlpha(38),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Text(
                  employee['status']!,
                  style: TextStyle(color: statusColor, fontSize: 12, fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            employee['name']!,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF0F1C34)),
          ),
          const SizedBox(height: 6),
          Text(
            employee['role']!,
            style: const TextStyle(color: Color(0xFF5D6B84), fontSize: 13),
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              _buildTag(employee['team']!),
              _buildTag(employee['location']!),
            ],
          ),
          const Spacer(),
          Row(
            children: [
              Expanded(
                child: ElevatedButton(
                  onPressed: () {},
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF123A6F),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    padding: const EdgeInsets.symmetric(vertical: 12),
                  ),
                  child: const Text('View Profile'),
                ),
              ),
              const SizedBox(width: 10),
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: const Color(0xFFE8EEF8),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(Icons.message, color: Color(0xFF123A6F), size: 20),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTag(String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFFE8EEF8),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        label,
        style: const TextStyle(color: Color(0xFF4D638F), fontSize: 12, fontWeight: FontWeight.w600),
      ),
    );
  }

  Widget _buildStatTile(String value, String label) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          value,
          style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: const TextStyle(color: Colors.white70, fontSize: 12),
        ),
      ],
    );
  }
}
