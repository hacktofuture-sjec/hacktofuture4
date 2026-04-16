import 'package:flutter/material.dart';
import 'dashboard.dart';
import 'reports.dart';
import 'settings.dart';

class UserMonitoringPage extends StatelessWidget {
  const UserMonitoringPage({super.key});

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
                          'User Monitoring',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 32),
                        _buildTrustScoreCard(fullWidth: isMobile),
                        const SizedBox(height: 32),
                        const Text(
                          'Active User Insights',
                          style: TextStyle(
                            color: Colors.white70,
                            fontSize: 18,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        const SizedBox(height: 16),
                        _buildUserInfoCard('User_ID 856', 'Texas, USA', 'Suspicious Login Attempt', Colors.orange),
                        _buildUserInfoCard('User_ID 102', 'Karnataka, India', 'Normal Activity', Colors.green),
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

  Widget _buildUserInfoCard(String id, String loc, String status, Color color) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF0A192F),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Row(
        children: [
          CircleAvatar(backgroundColor: color.withAlpha(26), child: Icon(Icons.person, color: color)),
          const SizedBox(width: 16),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(id, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              Text(loc, style: const TextStyle(color: Colors.white38, fontSize: 12)),
            ],
          ),
          const Spacer(),
          Text(status, style: TextStyle(color: color, fontSize: 12)),
        ],
      ),
    );
  }

  Widget _buildTrustScoreCard({bool fullWidth = false}) {
    return Container(
      width: fullWidth ? double.infinity : 400,
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(color: const Color(0xFF0A192F), borderRadius: BorderRadius.circular(4)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text('Total Trust Score', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 40),
          Center(
            child: RichText(
              text: const TextSpan(
                children: [
                  TextSpan(text: '94', style: TextStyle(color: Colors.cyan, fontSize: 64, fontWeight: FontWeight.bold)),
                  TextSpan(text: ' / 100', style: TextStyle(color: Colors.white24, fontSize: 18)),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),
          Stack(
            children: [
              Container(height: 4, width: double.infinity, decoration: BoxDecoration(color: Colors.white10, borderRadius: BorderRadius.circular(2))),
              FractionallySizedBox(
                widthFactor: 0.94,
                child: Container(
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.cyan,
                    borderRadius: BorderRadius.circular(2),
                    boxShadow: [BoxShadow(color: Colors.cyan.withAlpha(128), blurRadius: 4)],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
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
          _buildSidebarItem(context, 'Dashboard', isSelected: false, compact: sidebarWidth < 200, page: const DashboardPage()),
          _buildSidebarItem(context, 'User Monitoring', isSelected: true, compact: sidebarWidth < 200, page: const UserMonitoringPage()),
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
          color: isSelected ? Colors.cyan.withAlpha(13) : Colors.transparent,
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
      decoration: BoxDecoration(color: Colors.white.withAlpha(13), borderRadius: BorderRadius.circular(4)),
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
        ],
      ),
    );
  }
}
