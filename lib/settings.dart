import 'package:flutter/material.dart';
import 'dashboard.dart';
import 'user_monitoring.dart';
import 'reports.dart';

class SettingsPage extends StatefulWidget {
  const SettingsPage({super.key});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  // Local state for settings toggles
  bool _securityEnabled = true;
  bool _notificationsEnabled = true;
  bool _databaseSync = false;

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
                    'Settings',
                    style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 32),
                  
                  _buildSettingItem(
                    Icons.security, 
                    'Security Protocols', 
                    'Configure advanced firewall rules',
                    _securityEnabled,
                    (val) => setState(() => _securityEnabled = val),
                  ),
                  
                  _buildSettingItem(
                    Icons.notifications_active, 
                    'Alert Thresholds', 
                    'Set sensitivity for threat detection',
                    _notificationsEnabled,
                    (val) => setState(() => _notificationsEnabled = val),
                  ),
                  
                  _buildSettingItem(
                    Icons.storage, 
                    'Database Config', 
                    'Manage secure data storage',
                    _databaseSync,
                    (val) => setState(() => _databaseSync = val),
                  ),

                  const SizedBox(height: 40),
                  ElevatedButton(
                    onPressed: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Settings saved successfully!'), backgroundColor: Colors.cyan),
                      );
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.cyan,
                      foregroundColor: Colors.black,
                      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
                    ),
                    child: const Text('SAVE CHANGES', style: TextStyle(fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSettingItem(IconData icon, String title, String sub, bool value, Function(bool) onChanged) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(color: const Color(0xFF0A192F), borderRadius: BorderRadius.circular(4)),
      child: Row(
        children: [
          Icon(icon, color: Colors.cyan, size: 24),
          const SizedBox(width: 20),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              Text(sub, style: const TextStyle(color: Colors.white38, fontSize: 12)),
            ],
          ),
          const Spacer(),
          Switch(
            value: value, 
            onChanged: onChanged, // Now functional
            activeThumbColor: Colors.cyan,
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
          _buildSidebarItem(context, 'Dashboard', isSelected: false, page: const DashboardPage()),
          _buildSidebarItem(context, 'User Monitoring', isSelected: false, page: const UserMonitoringPage()),
          _buildSidebarItem(context, 'Reports', isSelected: false, page: const ReportsPage()),
          _buildSidebarItem(context, 'Settings', isSelected: true, page: const SettingsPage()),
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
          color: isSelected ? Colors.cyan.withAlpha(13) : Colors.transparent,
        ),
        child: Text(title, style: TextStyle(color: isSelected ? Colors.cyan : Colors.white60)),
      ),
    );
  }
}
