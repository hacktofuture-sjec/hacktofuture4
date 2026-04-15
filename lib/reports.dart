import 'package:flutter/material.dart';
import 'dashboard.dart';
import 'user_monitoring.dart';
import 'settings.dart';

class ReportsPage extends StatelessWidget {
  const ReportsPage({super.key});

  @override
  Widget build(BuildContext context) {
    final double screenWidth = MediaQuery.of(context).size.width;

    return Scaffold(
      backgroundColor: const Color(0xFF001122),
      body: Row(
        children: [
          _buildSidebar(context, screenWidth),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(40.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Personalized Security Report',
                    style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold),
                  ),
                  const Text(
                    'Analysis for: User_ID 856',
                    style: TextStyle(color: Colors.white38, fontSize: 14),
                  ),
                  const SizedBox(height: 32),
                  
                  // Stats Cards Row for Single User
                  Row(
                    children: [
                      _buildMetricCard('Recent Threats', '03', Icons.bug_report, Colors.red),
                      const SizedBox(width: 20),
                      _buildMetricCard('Identity Score', '94%', Icons.verified_user, Colors.green),
                      const SizedBox(width: 20),
                      _buildMetricCard('Last Login', '2h ago', Icons.access_time, Colors.cyan),
                    ],
                  ),
                  
                  const SizedBox(height: 48),
                  
                  const Text(
                    'User Activity Log (Last 7 Days)',
                    style: TextStyle(color: Colors.white70, fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 24),
                  
                  // Individual User Statistical Chart
                  Expanded(
                    child: Container(
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: const Color(0xFF0A192F),
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        mainAxisAlignment: MainAxisAlignment.spaceAround,
                        children: [
                          _buildChartBar('MON', 0.1, Colors.green),
                          _buildChartBar('TUE', 0.2, Colors.green),
                          _buildChartBar('WED', 0.6, Colors.orange), // A small spike here
                          _buildChartBar('THU', 0.1, Colors.green),
                          _buildChartBar('FRI', 0.1, Colors.green),
                          _buildChartBar('SAT', 0.05, Colors.green),
                          _buildChartBar('SUN', 0.05, Colors.green),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMetricCard(String title, String value, IconData icon, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(color: const Color(0xFF0A192F), borderRadius: BorderRadius.circular(4)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: color, size: 24),
            const SizedBox(height: 16),
            Text(value, style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.bold)),
            Text(title, style: const TextStyle(color: Colors.white38, fontSize: 12)),
          ],
        ),
      ),
    );
  }

  Widget _buildChartBar(String label, double heightFactor, Color color) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.end,
      children: [
        Container(
          width: 30,
          height: 200 * heightFactor,
          decoration: BoxDecoration(
            color: color.withOpacity(0.8),
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(height: 8),
        Text(label, style: const TextStyle(color: Colors.white38, fontSize: 10)),
      ],
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
          _buildSidebarItem(context, 'Dashboard', isSelected: false, page: const DashboardPage()),
          _buildSidebarItem(context, 'User Monitoring', isSelected: false, page: const UserMonitoringPage()),
          _buildSidebarItem(context, 'Reports', isSelected: true, page: const ReportsPage()),
          _buildSidebarItem(context, 'Settings', isSelected: false, page: const SettingsPage()),
          const Spacer(),
        ],
      ),
    );
  }

  Widget _buildSidebarItem(BuildContext context, String title, {bool isSelected = false, required Widget page}) {
    return InkWell(
      onTap: () {
        if (!isSelected) Navigator.pushReplacement(context, MaterialPageRoute(builder: (context) => page));
      },
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
        decoration: BoxDecoration(
          border: isSelected ? const Border(left: BorderSide(color: Colors.cyan, width: 3)) : null,
          color: isSelected ? Colors.cyan.withOpacity(0.05) : Colors.transparent,
        ),
        child: Text(title, style: TextStyle(color: isSelected ? Colors.cyan : Colors.white60)),
      ),
    );
  }
}
