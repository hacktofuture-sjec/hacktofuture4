import 'dart:async';
import 'package:flutter/material.dart';
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
  bool _loading = false;
  String? _error;
  Timer? _refreshTimer;
  int _selectedIndex = 0;
  int _selectedUserTabIndex = 0;

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
    final behaviorRisk = event['behavior_risk']?.toString() ?? '0';
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
              _buildBadge('Behavior: $behaviorRisk'),
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
    } else if (_selectedIndex == 1) {
      return _buildUserMonitoringContent();
    } else if (_selectedIndex == 2) {
      return _buildReportsContent();
    } else if (_selectedIndex == 3) {
      return _buildSettingsContent();
    }

    return const Center(
      child: Text(
        'Page not found',
        style: TextStyle(color: Colors.white70, fontSize: 22),
      ),
    );
  }

  Widget _buildUserMonitoringContent() {
    // Extract unique users by email
    final uniqueEmails = <String>{'Unknown'};
    for (var event in _events) {
      final email = event['email'] ?? 'Unknown';
      uniqueEmails.add(email);
    }
    final userList = uniqueEmails.toList()..sort();

    return Column(
      children: [
        Container(
          height: 60,
          color: const Color(0xFF05111E),
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            itemCount: userList.length,
            itemBuilder: (context, index) {
              final isSelected = _selectedUserTabIndex == index;
              return Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                child: Material(
                  color: Colors.transparent,
                  child: InkWell(
                    onTap: () => setState(() => _selectedUserTabIndex = index),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      decoration: BoxDecoration(
                        color: isSelected ? Colors.cyan.withAlpha(102) : const Color(0xFF0A192F),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: isSelected ? Colors.cyan : Colors.white24,
                        ),
                      ),
                      child: Center(
                        child: Text(
                          userList[index],
                          style: TextStyle(
                            color: isSelected ? Colors.cyan : Colors.white70,
                            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                            fontSize: 12,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
        ),
        Expanded(
          child: _buildUserActivityContent(userList[_selectedUserTabIndex]),
        ),
      ],
    );
  }

  Widget _buildUserActivityContent(String selectedEmail) {
    // Filter events for selected user
    final userEvents = _events
        .where((e) => (e['email'] ?? 'Unknown') == selectedEmail)
        .toList();

    if (userEvents.isEmpty) {
      return Center(
        child: Text(
          'No activity for $selectedEmail',
          style: const TextStyle(color: Colors.white70),
        ),
      );
    }

    // Count login attempts
    final loginAttempts = userEvents
        .where((e) => (e['event'] ?? '').toString().toLowerCase().contains('login'))
        .length;

    // Get latest location and IP
    final latestEvent = userEvents.isNotEmpty ? userEvents.first : null;
    final location = latestEvent?['location'] ?? 'Unknown';
    final ip = latestEvent?['ip'] ?? 'Unknown';
    final trustScore = latestEvent?['trust_score']?.toString() ?? 'N/A';

    return SingleChildScrollView(
      padding: const EdgeInsets.all(40),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(32),
            decoration: BoxDecoration(color: const Color(0xFF0A192F), borderRadius: BorderRadius.circular(4)),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  selectedEmail,
                  style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 24),
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Login Attempts', style: TextStyle(color: Colors.white70, fontSize: 12)),
                          Text('$loginAttempts', style: const TextStyle(color: Colors.cyan, fontSize: 28, fontWeight: FontWeight.bold)),
                        ],
                      ),
                    ),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text('Trust Score', style: TextStyle(color: Colors.white70, fontSize: 12)),
                          Text(trustScore, style: const TextStyle(color: Colors.green, fontSize: 28, fontWeight: FontWeight.bold)),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),
                const Text('Last Location', style: TextStyle(color: Colors.white70, fontSize: 12)),
                Text(location, style: const TextStyle(color: Colors.white, fontSize: 14)),
                const SizedBox(height: 8),
                const Text('Last IP', style: TextStyle(color: Colors.white70, fontSize: 12)),
                Text(ip, style: const TextStyle(color: Colors.white, fontSize: 14)),
              ],
            ),
          ),
          const SizedBox(height: 32),
          const Text(
            'Activity History',
            style: TextStyle(color: Colors.white70, fontSize: 18, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 16),
          ...userEvents.map((event) {
            final eventType = event['event'] ?? 'UNKNOWN';
            final eventLocation = event['location'] ?? 'Unknown';
            final eventTime = event['created_at'] ?? 'Unknown time';
            final eventTrust = event['trust_score']?.toString() ?? 'N/A';

            final isHighRisk = (int.tryParse(eventTrust) ?? 0) < 60;
            return Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: isHighRisk ? Colors.red.withAlpha(26) : const Color(0xFF0A192F),
                borderRadius: BorderRadius.circular(4),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.login_rounded,
                    color: isHighRisk ? Colors.red : Colors.cyan,
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          eventType.toUpperCase(),
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 12,
                          ),
                        ),
                        Text(
                          '$eventLocation • Score: $eventTrust',
                          style: const TextStyle(color: Colors.white70, fontSize: 11),
                        ),
                      ],
                    ),
                  ),
                  Text(
                    eventTime.toString().split('.')[0].substring(11),
                    style: const TextStyle(color: Colors.white54, fontSize: 11),
                  ),
                ],
              ),
            );
          }).toList(),
        ],
      ),
    );
  }

  Widget _buildReportsContent() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(40),
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
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(color: const Color(0xFF0A192F), borderRadius: BorderRadius.circular(4)),
            child: const Text(
              '• 3 suspicious login attempts detected\n• 2 successful authentications\n• 1 password change event',
              style: TextStyle(color: Colors.white70, height: 2),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMetricCard(String title, String value, IconData icon, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(color: const Color(0xFF0A192F), borderRadius: BorderRadius.circular(4)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: color, size: 24),
            const SizedBox(height: 12),
            Text(title, style: const TextStyle(color: Colors.white70, fontSize: 12)),
            const SizedBox(height: 8),
            Text(value, style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.bold)),
          ],
        ),
      ),
    );
  }

  Widget _buildSettingsContent() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(40),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildSettingItem(
            Icons.security,
            'Security Protocols',
            'Configure advanced firewall rules',
          ),
          _buildSettingItem(
            Icons.notifications_active,
            'Alert Thresholds',
            'Set sensitivity for threat detection',
          ),
          _buildSettingItem(
            Icons.storage,
            'Database Sync',
            'Sync with central security hub',
          ),
          const SizedBox(height: 32),
          ElevatedButton(
            onPressed: () {},
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.green,
              padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 16),
            ),
            child: const Text('Save Settings'),
          ),
        ],
      ),
    );
  }

  Widget _buildSettingItem(IconData icon, String title, String description) {
    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: const Color(0xFF0A192F), borderRadius: BorderRadius.circular(4)),
      child: Row(
        children: [
          Icon(icon, color: Colors.cyan, size: 28),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                Text(description, style: const TextStyle(color: Colors.white70, fontSize: 12)),
              ],
            ),
          ),
          Switch(value: true, onChanged: (_) {}),
        ],
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
                        Text(
                          _selectedIndex == 0
                              ? 'Live Event Stream'
                              : _selectedIndex == 1
                                  ? 'User Monitoring'
                                  : _selectedIndex == 2
                                      ? 'Reports'
                                      : 'Settings',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 28,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Row(
                          children: [
                            if (_selectedIndex == 0)
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
