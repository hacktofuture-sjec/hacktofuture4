import 'package:flutter/material.dart';
import 'api_service.dart';
import 'dashboard.dart';
import 'user_monitoring.dart';
import 'settings.dart';

class ReportsPage extends StatefulWidget {
  const ReportsPage({super.key});

  @override
  State<ReportsPage> createState() => _ReportsPageState();
}

class _ReportsPageState extends State<ReportsPage> {
  List<Map<String, dynamic>> _userStatus = [];
  bool _loading = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _loadUserStatus();
  }

  Future<void> _loadUserStatus() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final events = await ApiService.getEvents();

      // Group events by user (get latest event for each user)
      final userMap = <String, Map<String, dynamic>>{};
      for (final event in events) {
        final email = event['email']?.toString().trim() ?? 'Unknown';
        if (!userMap.containsKey(email) ||
            (event['created_at']?.toString() ?? '').compareTo(
                userMap[email]!['created_at']?.toString() ?? '') >
                0) {
          userMap[email] = event;
        }
      }

      // Convert to list and sort by trust_score (risk level)
      final userList = userMap.values.toList();
      userList.sort((a, b) {
        final aScore = int.tryParse(a['trust_score']?.toString() ?? '0') ?? 0;
        final bScore = int.tryParse(b['trust_score']?.toString() ?? '0') ?? 0;
        return bScore.compareTo(aScore); // Higher risk first
      });

      setState(() {
        _userStatus = userList;
      });
    } catch (e) {
      setState(() {
        _error = 'Failed to fetch user status: $e';
      });
    } finally {
      setState(() {
        _loading = false;
      });
    }
  }

  String _getRiskMode(int trustScore) {
    if (trustScore < 20) {
      return 'Normal';
    } else if (trustScore < 40) {
      return 'Increased Monitoring';
    } else if (trustScore < 60) {
      return 'Requires Reauth';
    } else {
      return 'Session Terminated';
    }
  }

  Color _getRiskColor(int trustScore) {
    if (trustScore < 20) {
      return Colors.green;
    } else if (trustScore < 40) {
      return Colors.orange;
    } else if (trustScore < 60) {
      return Colors.amber;
    } else {
      return Colors.red;
    }
  }

  Widget _buildUserStatusCard(Map<String, dynamic> user, int index) {
    final email = user['email']?.toString().trim() ?? 'Unknown';
    final location = user['location'] ?? 'Unknown';
    final ip = user['ip'] ?? 'Unknown';
    final trustScore = int.tryParse(user['trust_score']?.toString() ?? '0') ?? 0;
    final riskMode = _getRiskMode(trustScore);
    final riskColor = _getRiskColor(trustScore);

    // Count reauth attempts and sessions ended (for demo, using behavior_risk as reference)
    final behaviorRisk = int.tryParse(user['behavior_risk']?.toString() ?? '0') ?? 0;
    final reauthAttempts = (behaviorRisk * 0.6).toInt();
    final sessionsEnded = (behaviorRisk * 0.4).toInt();

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 12, horizontal: 24),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF0A1723),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: riskColor.withAlpha(102), width: 2),
        boxShadow: [
          BoxShadow(
            color: riskColor.withAlpha(25),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header with user email and risk status
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    email,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Risk Score: $trustScore',
                    style: TextStyle(
                      color: riskColor,
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(
                  color: riskColor.withAlpha(51),
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: riskColor, width: 1),
                ),
                child: Text(
                  riskMode,
                  style: TextStyle(
                    color: riskColor,
                    fontWeight: FontWeight.bold,
                    fontSize: 13,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          const Divider(color: Colors.white24, height: 1),
          const SizedBox(height: 16),

          // Location and IP info
          Row(
            children: [
              Expanded(
                child: _buildInfoColumn('Last Location', location),
              ),
              const SizedBox(width: 32),
              Expanded(
                child: _buildInfoColumn('Last IP', ip),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // Risk mode details based on score
          if (trustScore >= 20 && trustScore < 40)
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.orange.withAlpha(25),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  Icon(Icons.info_outline, color: Colors.orange, size: 20),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'Status: Under increased monitoring due to elevated risk indicators',
                      style: TextStyle(color: Colors.orange.shade200, fontSize: 12),
                    ),
                  ),
                ],
              ),
            ),
          if (trustScore >= 40 && trustScore < 60)
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.amber.withAlpha(25),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.security, color: Colors.amber, size: 20),
                      const SizedBox(width: 12),
                      Text(
                        'Reauth Status',
                        style: TextStyle(color: Colors.amber.shade200, fontWeight: FontWeight.bold, fontSize: 13),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Reauth Attempts: $reauthAttempts • Behavior Risk: $behaviorRisk',
                    style: TextStyle(color: Colors.amber.shade200, fontSize: 12),
                  ),
                ],
              ),
            ),
          if (trustScore >= 60)
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.red.withAlpha(25),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(Icons.block, color: Colors.red, size: 20),
                      const SizedBox(width: 12),
                      Text(
                        'Critical Risk - Sessions Ended',
                        style: TextStyle(color: Colors.red.shade200, fontWeight: FontWeight.bold, fontSize: 13),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Sessions Ended: $sessionsEnded • Behavior Risk: $behaviorRisk',
                    style: TextStyle(color: Colors.red.shade200, fontSize: 12),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildInfoColumn(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            color: Colors.white60,
            fontSize: 12,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          value,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 14,
            fontWeight: FontWeight.w500,
          ),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final double screenWidth = MediaQuery.of(context).size.width;

    return Scaffold(
      backgroundColor: const Color(0xFF001122),
      body: Row(
        children: [
          _buildSidebar(context, screenWidth),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Padding(
                  padding: const EdgeInsets.all(40.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Security Status Report',
                        style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.bold),
                      ),
                      const Text(
                        'User risk levels and access information',
                        style: TextStyle(color: Colors.white38, fontSize: 14),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: _loading
                      ? const Center(child: CircularProgressIndicator(color: Colors.white))
                      : _error != null
                          ? Center(
                              child: Text(
                                _error!,
                                style: const TextStyle(color: Colors.redAccent),
                              ),
                            )
                          : _userStatus.isEmpty
                              ? const Center(
                                  child: Text(
                                    'No user data available',
                                    style: TextStyle(color: Colors.white70),
                                  ),
                                )
                          : RefreshIndicator(
                              onRefresh: _loadUserStatus,
                              color: Colors.cyan,
                              backgroundColor: const Color(0xFF0A1723),
                              child: ListView.builder(
                                itemCount: _userStatus.length,
                                itemBuilder: (context, index) {
                                  return _buildUserStatusCard(_userStatus[index], index);
                                },
                              ),
                            ),
                )
              ],
            ),
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
          color: isSelected ? Colors.cyan.withAlpha(13) : Colors.transparent,
        ),
        child: Text(title, style: TextStyle(color: isSelected ? Colors.cyan : Colors.white60)),
      ),
    );
  }
}
