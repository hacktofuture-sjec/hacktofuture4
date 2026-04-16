import 'dart:async';
import 'package:flutter/material.dart';
import 'user_monitoring.dart';
import 'reports.dart';
import 'settings.dart';
import 'api_service.dart';
import 'auth_service.dart';
import 'adminlogin.dart';

class DashboardPage extends StatefulWidget {
  const DashboardPage({super.key});

  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  List<Map<String, dynamic>> _events = [];
  Timer? _refreshTimer;

  @override
  void initState() {
    super.initState();
    _fetchEvents();
    // Refresh events every 30 seconds
    _refreshTimer = Timer.periodic(const Duration(seconds: 30), (timer) {
      _fetchEvents();
    });
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  Future<void> _fetchEvents() async {
    try {
      final events = await ApiService.getEvents();
      if (mounted) {
        setState(() {
          _events = events;
        });
      }
    } catch (e) {
      // Handle error
    }
  }

  Future<void> _refreshEvents() async {
    await _fetchEvents();
  }

  Future<void> _logout() async {
    try {
      await AuthService.signOut();
      if (mounted) {
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (context) => const AdminLoginPage()),
          (route) => false,
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to logout')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final double screenWidth = MediaQuery.of(context).size.width;
    final bool isMobile = screenWidth < 800;

    return Scaffold(
      backgroundColor: const Color(0xFF001122),
      body: Row(
        children: [
          _buildSidebar(context, screenWidth),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildTopHeader(),
                Expanded(
                  child: SingleChildScrollView(
                    padding: EdgeInsets.symmetric(
                      horizontal: isMobile ? 16.0 : 40.0, 
                      vertical: 20.0
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'Live Event Stream',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 24),
                        _buildEventList(),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEventList() {
    if (_events.isEmpty) {
      return const Text('No events yet', style: TextStyle(color: Colors.white));
    }

    return Column(
      children: _events.map((event) {
        final type = event['trust_score'] < 40 ? 'THREAT' : event['trust_score'] < 60 ? 'SUSPICIOUS' : 'SECURE';
        final color = type == 'THREAT' ? Colors.red : type == 'SUSPICIOUS' ? Colors.orange : Colors.green;
        final location = event['location'] ?? 'Unknown';
        final message = 'User ${event['session_id']} logged in from IP ${event['ip']}';

        return _buildEventCard(
          type: type,
          color: color,
          location: location,
          message: message,
        );
      }).toList(),
    );
  }

  Widget _buildSidebar(BuildContext context, double width) {
    final double sidebarWidth = width < 1000 ? 180 : 240;
    return Container(
      width: sidebarWidth,
      color: const Color(0xFF000D1A),
      padding: const EdgeInsets.symmetric(vertical: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24.0),
            child: Text('Cyber Sentinel', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: sidebarWidth < 200 ? 14 : 18)),
          ),
          const SizedBox(height: 48),
          _buildSidebarItem(context, 'Dashboard', isSelected: true, compact: sidebarWidth < 200, page: const DashboardPage()),
          _buildSidebarItem(context, 'User Monitoring', isSelected: false, compact: sidebarWidth < 200, page: const UserMonitoringPage()),
          _buildSidebarItem(context, 'Reports', isSelected: false, compact: sidebarWidth < 200, page: const ReportsPage()),
          _buildSidebarItem(context, 'Settings', isSelected: false, compact: sidebarWidth < 200, page: const SettingsPage()),
          const Spacer(),
          _buildAdminProfile(compact: sidebarWidth < 200),
        ],
      ),
    );
  }

  Widget _buildSidebarItem(BuildContext context, String title, {bool isSelected = false, bool compact = false, required Widget page}) {
    return InkWell(
      onTap: () {
        if (!isSelected) {
          Navigator.pushReplacement(context, MaterialPageRoute(builder: (context) => page));
        }
      },
      child: Container(
        width: double.infinity,
        padding: EdgeInsets.symmetric(horizontal: 24, vertical: compact ? 12 : 16),
        decoration: BoxDecoration(
          border: isSelected ? const Border(left: BorderSide(color: Colors.cyan, width: 3)) : null,
          color: isSelected ? Colors.cyan.withOpacity(0.05) : Colors.transparent,
        ),
        child: Text(
          title,
          style: TextStyle(
            color: isSelected ? Colors.cyan : Colors.white60,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
            fontSize: compact ? 12 : 14,
          ),
        ),
      ),
    );
  }

  Widget _buildAdminProfile({bool compact = false}) {
    return Container(
      margin: const EdgeInsets.all(12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: Colors.white.withOpacity(0.05), borderRadius: BorderRadius.circular(4)),
      child: Row(
        children: [
          const CircleAvatar(radius: 16, backgroundColor: Colors.white10, child: Icon(Icons.person, size: 18, color: Colors.white70)),
          if (!compact) ...[
            const SizedBox(width: 10),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text('ADMIN', style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                  Text('SENIOR ENGINEER', style: TextStyle(color: Colors.white54, fontSize: 8), overflow: TextOverflow.ellipsis),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildTopHeader() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      child: Row(
        children: [
          Expanded(child: Container(height: 40, constraints: const BoxConstraints(maxWidth: 400), decoration: BoxDecoration(color: Colors.black26, borderRadius: BorderRadius.circular(4)))),
          const SizedBox(width: 16),
          const Text('PROFILE', style: TextStyle(color: Colors.white38, fontSize: 11, fontWeight: FontWeight.bold)),
          const SizedBox(width: 8),
          const Icon(Icons.person_outline, color: Colors.white70, size: 24),
          const SizedBox(width: 16),
          TextButton.icon(
            onPressed: _refreshEvents,
            icon: const Icon(Icons.refresh, color: Colors.white70, size: 20),
            label: const Text('REFRESH', style: TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.bold)),
            style: TextButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              backgroundColor: Colors.blue.withAlpha(26),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
            ),
          ),
          const SizedBox(width: 16),
          TextButton.icon(
            onPressed: _logout,
            icon: const Icon(Icons.logout, color: Colors.white70, size: 20),
            label: const Text('LOGOUT', style: TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.bold)),
            style: TextButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              backgroundColor: Colors.red.withAlpha(26),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildEventCard({required String type, required Color color, required String location, required String message}) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(color: const Color(0xFF0A192F), borderRadius: BorderRadius.circular(4)),
      child: IntrinsicHeight(
        child: Row(
          children: [
            Container(width: 4, decoration: BoxDecoration(color: color, borderRadius: const BorderRadius.horizontal(left: Radius.circular(4)))),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(color: color.withOpacity(0.1), borderRadius: BorderRadius.circular(2)),
                          child: Text(type, style: TextStyle(color: color, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 0.5)),
                        ),
                        const SizedBox(width: 12),
                        const Icon(Icons.public, color: Colors.white24, size: 14),
                        const SizedBox(width: 4),
                        Text(location, style: const TextStyle(color: Colors.white38, fontSize: 11)),
                        const Spacer(),
                        const Icon(Icons.more_vert, color: Colors.white38, size: 18),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text(message, style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w500)),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
