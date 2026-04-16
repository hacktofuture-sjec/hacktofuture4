import 'dart:async';
import 'package:flutter/material.dart';
import 'api_service.dart';
import 'auth_service.dart';  // Add this import
import 'adminlogin.dart';    // Add this import

class DashboardPage extends StatefulWidget {
  const DashboardPage({super.key});

  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  List<Map<String, dynamic>> _events = [];
  bool _loading = false;
  String? _error;
  Timer? _refreshTimer;
  int _selectedIndex = 0;

  @override
  void initState() {
    super.initState();
    _loadEvents();
    _refreshTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      if (_selectedIndex == 0) {
        _loadEvents();
      }
    });
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  Future<void> _loadEvents() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final events = await ApiService.getEvents();

      events.sort((a, b) {
        final aTs = a['created_at']?.toString() ?? '';
        final bTs = b['created_at']?.toString() ?? '';
        return bTs.compareTo(aTs);
      });

      setState(() {
        _events = events;
      });
    } catch (e) {
      setState(() {
        _error = 'Failed to fetch events: $e';
      });
    } finally {
      setState(() {
        _loading = false;
      });
    }
  }

  Widget _buildEventCard(Map<String, dynamic> event) {
    final email = event['email'] ?? 'Unknown';
    final ip = event['ip'] ?? 'Unknown';
    final location = event['location'] ?? 'Unknown';
    final action = event['event'] ?? 'admin_login';
    final trustScore = event['trust_score']?.toString() ?? 'N/A';

    final isAdminEvent = action.toString().toLowerCase() == 'admin_login';
    final userType = isAdminEvent ? 'ADMIN' : 'USER';
    final typeColor = isAdminEvent ? Colors.red.shade300 : Colors.green.shade300;
    final actionColor = action.toString().toLowerCase().contains('login')
        ? Colors.cyan.shade200
        : Colors.white70;

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFF0A1723),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF162737)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'User $email logged in from IP $ip',
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 10),
          Wrap(
            runSpacing: 8,
            spacing: 12,
            children: [
              _buildBadge(userType, color: typeColor),
              _buildBadge(location),
              _buildBadge(action.toString().toUpperCase(), color: actionColor),
              _buildBadge('Score: $trustScore'),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildBadge(String text, {Color color = const Color(0xFF1A3045)}) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 12),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        text,
        style: const TextStyle(color: Colors.white, fontSize: 12),
      ),
    );
  }

  void _onTabSelected(int index) {
    setState(() {
      _selectedIndex = index;
    });
    if (index == 0) {
      _loadEvents();
    }
  }

  Widget _buildMainContent() {
    if (_selectedIndex == 0) {
      return _loading
          ? const Center(child: CircularProgressIndicator(color: Colors.white))
          : _error != null
              ? Center(
                  child: Text(
                    _error!,
                    style: const TextStyle(color: Colors.redAccent),
                  ),
                )
              : _events.isEmpty
                  ? const Center(
                      child: Text(
                        'Waiting for live events...',
                        style: TextStyle(color: Colors.white70),
                      ),
                    )
                  : ListView.builder(
                      itemCount: _events.length,
                      itemBuilder: (context, index) {
                        return _buildEventCard(_events[index]);
                      },
                    );
    }

    return Center(
      child: Text(
        _selectedIndex == 1
            ? 'User Monitoring'
            : _selectedIndex == 2
                ? 'Reports'
                : 'Settings',
        style: const TextStyle(color: Colors.white70, fontSize: 22),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF001122),
      body: SafeArea(
        child: Row(
          children: [
            Container(
              width: 240,
              color: const Color(0xFF05111E),
              child: Column(
                children: [
                  const SizedBox(height: 24),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: Text(
                        'Cyber Sentinel',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 22,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 32),
                  _buildSidebarItem(0, Icons.dashboard, 'Dashboard'),
                  _buildSidebarItem(1, Icons.person_search, 'User Monitoring'),
                  _buildSidebarItem(2, Icons.bar_chart, 'Reports'),
                  _buildSidebarItem(3, Icons.settings, 'Settings'),
                  const Spacer(),
                  Container(
                    margin: const EdgeInsets.all(16),
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0E1F33),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      children: const [
                        CircleAvatar(
                          radius: 20,
                          backgroundColor: Colors.cyan,
                          child: Icon(Icons.person, color: Colors.black),
                        ),
                        SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            'ADMIN\nSenior Engineer',
                            style: TextStyle(color: Colors.white70, fontSize: 12),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: Column(
                children: [
                  Container(
                    height: 100,
                    padding: const EdgeInsets.symmetric(horizontal: 24),
                    color: const Color(0xFF02131E),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          'Live Event Stream',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 28,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Row(
                          children: [
                            TextButton.icon(
                              onPressed: _loadEvents,
                              icon: const Icon(Icons.refresh, color: Colors.white),
                              label: const Text('REFRESH', style: TextStyle(color: Colors.white)),
                            ),
                            const SizedBox(width: 16),
                            ElevatedButton(
                              onPressed: () async {
                                await AuthService.signOut();  // Sign out from Firebase
                                Navigator.of(context).pushReplacement(
                                  MaterialPageRoute(builder: (context) => const AdminLoginPage()),
                                );
                              },
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF132535),
                              ),
                              child: const Text('LOGOUT'),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  Expanded(
                    child: _buildMainContent(),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSidebarItem(int index, IconData icon, String label) {
    final selected = _selectedIndex == index;
    return Material(
      color: selected ? const Color(0xFF0B2A44) : Colors.transparent,
      child: ListTile(
        leading: Icon(icon, color: selected ? Colors.cyanAccent : Colors.white54),
        title: Text(
          label,
          style: TextStyle(color: selected ? Colors.cyanAccent : Colors.white54),
        ),
        selected: selected,
        onTap: () => _onTabSelected(index),
      ),
    );
  }
}
