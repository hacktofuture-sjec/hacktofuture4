import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'Mytask.dart';
import 'Profile.dart';
import 'leaveandatt.dart';
import 'userlogin.dart';

// Simple global state for the demo
class AppState {
  static String currentUserEmail = ''; // Store logged-in user's email
  static String get currentUserName {
    final email = currentUserEmail.trim();
    if (email.isEmpty) return 'Guest';
    if (email.contains('@')) {
      final name = email.split('@').first;
      return name.isEmpty ? email : name;
    }
    return email;
  }

  static bool isClockedIn = true; // Set to true by default as requested
  static DateTime? clockInTime;
  static DateTime? clockOutTime;
  static List<Map<String, dynamic>> attendanceLogs = [];
  static List<Map<String, dynamic>> tasks = [
    {
      'title': 'Update SkyPortal UI Components',
      'deadline': 'Today, 5:00 PM',
      'priority': 'High',
      'color': Colors.redAccent,
      'status': 'To Do',
    },
    {
      'title': 'Team Sync - Sprint Review',
      'deadline': 'Tomorrow, 10:00 AM',
      'priority': 'Medium',
      'color': Colors.blueAccent,
      'status': 'In Progress',
    },
  ];

  static String calculateTotalWorkHours() {
    Duration total = Duration.zero;
    for (var log in attendanceLogs) {
      if (log['duration'] != null) {
        total += log['duration'] as Duration;
      }
    }
    // If currently clocked in, add time from clockIn until now
    if (isClockedIn && clockInTime != null) {
      total += DateTime.now().difference(clockInTime!);
    }

    int hours = total.inHours;
    int minutes = total.inMinutes.remainder(60);
    return '${hours}h ${minutes}m';
  }
}

// Interaction tracking for risk assessment
class InteractionTracker {
  static int tabSwitches = 0;
  static int buttonClicks = 0;
  static int keystrokes = 0;
  static int totalInteractions = 0;
  static DateTime? sessionStart;
  static List<DateTime> interactionTimestamps = [];
  static List<Map<String, dynamic>> liveEvents = [];

  static void startSession() {
    sessionStart = DateTime.now();
    tabSwitches = 0;
    buttonClicks = 0;
    keystrokes = 0;
    totalInteractions = 0;
    interactionTimestamps = [];
    liveEvents = [];
  }

  static void trackTabSwitch() {
    tabSwitches++;
    totalInteractions++;
    interactionTimestamps.add(DateTime.now());
    _tryRecordBurstEvent(isKeystroke: false);
  }

  static void trackButtonClick() {
    buttonClicks++;
    totalInteractions++;
    interactionTimestamps.add(DateTime.now());
    _tryRecordBurstEvent(isKeystroke: false);
  }

  static void trackKeystroke() {
    keystrokes++;
    totalInteractions++;
    interactionTimestamps.add(DateTime.now());
    _tryRecordBurstEvent(isKeystroke: true);
  }

  static void recordLiveEvent(String message) {
    liveEvents.insert(0, {'message': message, 'time': DateTime.now()});
    if (liveEvents.length > 6) liveEvents.removeLast();
  }

  static int recentInteractionCount({
    Duration window = const Duration(seconds: 10),
  }) {
    final now = DateTime.now();
    interactionTimestamps = interactionTimestamps
        .where((t) => now.difference(t) <= window)
        .toList();
    return interactionTimestamps.length;
  }

  static bool hasHighInteractionBurst() {
    return recentInteractionCount() > 10;
  }

  static void _tryRecordBurstEvent({bool isKeystroke = false}) {
    if (hasHighInteractionBurst()) {
      final burstCount = recentInteractionCount();
      final lastMessage = liveEvents.isNotEmpty ? liveEvents.first['message'] : '';
      final newMessage = isKeystroke
          ? 'Live keystroke burst: $burstCount interactions in 10 seconds.'
          : 'High interaction burst: $burstCount interactions in 10 seconds.';
      if (lastMessage != newMessage) {
        recordLiveEvent(newMessage);
        // Send data to backend only during bursts
        _sendInteractionDataToBackend();
      }
    }
  }

  static Future<void> _sendInteractionDataToBackend() async {
    final interactionData = getInteractionData();
    try {
      final response = await http.post(
        Uri.parse('$backendBaseUrl/session'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'email': AppState.currentUserEmail.isEmpty ? 'anonymous_user' : AppState.currentUserEmail,
          'device': 'user_dashboard',
          'event': 'user_interaction_burst',
          'keystroke_interval': 0,
          'interaction_data': interactionData,
        }),
      );

      if (response.statusCode != 200) {
        print('Failed to send interaction burst data: ${response.body}');
      }
    } catch (e) {
      print('Error sending interaction burst data: $e');
    }
  }

  static bool isExcessiveInteraction() {
    if (sessionStart == null) return false;

    final sessionDuration = DateTime.now().difference(sessionStart!).inMinutes;
    if (sessionDuration < 1) return false; // Need at least 1 minute of data

    final total = tabSwitches + buttonClicks + keystrokes;
    final interactionsPerMinute = total / sessionDuration;

    // Consider excessive if more than 50 interactions per minute
    return interactionsPerMinute > 50;
  }

  static Map<String, dynamic> getInteractionData() {
    final sessionDuration = sessionStart != null
        ? DateTime.now().difference(sessionStart!).inMinutes
        : 0;
    return {
      'tab_switches': tabSwitches,
      'button_clicks': buttonClicks,
      'keystrokes': keystrokes,
      'total_interactions': totalInteractions,
      'high_interaction_in_10s': hasHighInteractionBurst(),
      'session_duration_minutes': sessionDuration,
      'excessive_interaction': isExcessiveInteraction(),
      'interactions_per_minute': sessionDuration > 0
          ? (tabSwitches + buttonClicks + keystrokes) / sessionDuration
          : 0,
      'latest_live_event': liveEvents.isNotEmpty
          ? liveEvents.first['message']
          : null,
    };
  }
}

const String backendBaseUrl =
    'http://127.0.0.1:5000'; // Use 10.0.2.2 on Android emulator if needed.

class DashboardPage extends StatefulWidget {
  const DashboardPage({super.key});

  @override
  State<DashboardPage> createState() => _DashboardPageState();
}

class _DashboardPageState extends State<DashboardPage> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    // Automatically clock in and start timer when the dashboard loads (login)
    if (AppState.clockInTime == null) {
      AppState.clockInTime = DateTime.now();
      AppState.isClockedIn = true;
    }

    if (InteractionTracker.sessionStart == null) {
      InteractionTracker.startSession();
    }

    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _refresh() => setState(() {});

  Future<void> _sendInteractionData() async {
    final interactionData = InteractionTracker.getInteractionData();

    try {
      final response = await http.post(
        Uri.parse('$backendBaseUrl/session'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'email': AppState.currentUserEmail.isEmpty ? 'anonymous_user' : AppState.currentUserEmail,
          'device': 'user_dashboard',
          'event': 'user_interaction_update',
          'keystroke_interval': 0,
          'interaction_data': interactionData,
        }),
      );

      if (response.statusCode != 200) {
        print('Failed to send interaction data: ${response.body}');
      }
    } catch (e) {
      print('Error sending interaction data: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF0F9FF),
      body: Row(
        children: [
          _Sidebar(
            onNavigate: _refresh,
            onTabSwitch: () {
              InteractionTracker.trackTabSwitch();
            },
          ),
          Expanded(
            child: Column(
              children: [
                _TopBar(
                  onClockToggle: _refresh,
                  onButtonClick: () {
                    InteractionTracker.trackButtonClick();
                  },
                ),
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(32),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Welcome back, ${AppState.currentUserName}!',
                              style: const TextStyle(
                                color: Color(0xFF0369A1),
                                fontSize: 34,
                                fontWeight: FontWeight.w900,
                                letterSpacing: -0.5,
                              ),
                            ),
                            const SizedBox(height: 8),
                            const Text(
                              ' SkyPortal Employee Hub ',
                              style: TextStyle(color: Color(0xFF0EA5E9), fontSize: 16, fontWeight: FontWeight.w500),
                            ),
                          ],
                        ),
                        const SizedBox(height: 40),
                        const _EmployeeStatsGrid(),
                        const SizedBox(height: 40),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(
                              flex: 2,
                              child: _MyTasksSection(
                                onViewAll: _refresh,
                                onButtonClick: () {
                                  InteractionTracker.trackButtonClick();
                                  _sendInteractionData();
                                },
                              ),
                            ),
                            const SizedBox(width: 32),
                            const Expanded(
                              flex: 1,
                              child: _AttendanceSection(),
                            ),
                          ],
                        ),
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
}

class _Sidebar extends StatelessWidget {
  final VoidCallback onNavigate;
  final VoidCallback onTabSwitch;
  const _Sidebar({required this.onNavigate, required this.onTabSwitch});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 280,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFF0EA5E9), Color(0xFF2563EB)],
        ),
      ),
      padding: const EdgeInsets.symmetric(vertical: 32),
      child: Column(
        children: [
          const Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.auto_awesome_mosaic_rounded,
                color: Colors.white,
                size: 32,
              ),
              SizedBox(width: 12),
              Text(
                'SKYPORTAL',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w900,
                  fontSize: 20,
                  letterSpacing: 2,
                ),
              ),
            ],
          ),
          const SizedBox(height: 64),
          _buildSidebarItem(context, Icons.home_rounded, 'My Dashboard', isSelected: true, destination: const DashboardPage()),
          _buildSidebarItem(context, Icons.assignment_rounded, 'My Tasks', destination: const MyTaskPage()),
          _buildSidebarItem(context, Icons.event_note_rounded, 'Leave & Attendance', destination: const LeaveAndAttPage()),
          _buildSidebarItem(context, Icons.badge_rounded, 'My Profile', destination: const ProfilePage()),
          const Spacer(),
          const _UserCard(),
        ],
      ),
    );
  }

  Widget _buildSidebarItem(
    BuildContext context,
    IconData icon,
    String title, {
    bool isSelected = false,
    Widget? destination,
  }) {
    return InkWell(
      onTap: () {
        if (destination != null && !isSelected) {
          onTabSwitch(); // Track tab switch
          Navigator.push(
            context,
            MaterialPageRoute(builder: (context) => destination),
          ).then((_) => onNavigate());
        }
      },
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: isSelected ? Colors.white.withAlpha(51) : Colors.transparent,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          children: [
            Icon(
              icon,
              color: isSelected ? Colors.white : Colors.white70,
              size: 22,
            ),
            const SizedBox(width: 16),
            Text(
              title,
              style: TextStyle(
                color: isSelected ? Colors.white : Colors.white70,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                fontSize: 15,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TopBar extends StatefulWidget {
  final VoidCallback onClockToggle;
  final VoidCallback onButtonClick;
  const _TopBar({required this.onClockToggle, required this.onButtonClick});

  @override
  State<_TopBar> createState() => _TopBarState();
}

class _TopBarState extends State<_TopBar> {
  void _logout() {
    // Record out time
    AppState.clockOutTime = DateTime.now();
    AppState.isClockedIn = false;
    
    // Calculate session duration and add to logs
    if (AppState.clockInTime != null) {
      Duration duration = AppState.clockOutTime!.difference(AppState.clockInTime!);
      AppState.attendanceLogs.add({
        'in': AppState.clockInTime,
        'out': AppState.clockOutTime,
        'duration': duration,
      });
    }

    // Reset clockInTime for next potential session
    AppState.clockInTime = null; 

    // Navigate to login page
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (context) => const UserLoginPage()),
      (route) => false,
    );
  }

  String _formatTime(DateTime? time) {
    if (time == null) return '--:--';
    final hour = time.hour == 0 ? 12 : (time.hour > 12 ? time.hour - 12 : time.hour);
    final minute = time.minute.toString().padLeft(2, '0');
    final period = time.hour >= 12 ? 'PM' : 'AM';
    return '$hour:$minute $period';
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 85,
      padding: const EdgeInsets.symmetric(horizontal: 32),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border(bottom: BorderSide(color: Colors.blue.withAlpha(25))),
        boxShadow: [
          BoxShadow(color: Colors.blue.withAlpha(12), blurRadius: 10, offset: const Offset(0, 4)),
        ],
      ),
      child: Row(
        children: [
          const Text(
            'Employee Portal',
            style: TextStyle(
              color: Color(0xFF64748B),
              fontWeight: FontWeight.w700,
              letterSpacing: 1,
            ),
          ),
          const Spacer(),
          const Text(
            'System Active',
            style: TextStyle(color: Color(0xFF10B981), fontWeight: FontWeight.bold, fontSize: 13),
          ),
          const SizedBox(width: 12),
          const Icon(Icons.circle, color: Color(0xFF10B981), size: 12),
          const SizedBox(width: 32),
          IconButton(
            icon: const Icon(Icons.logout_rounded, color: Color(0xFFEF4444)),
            tooltip: 'Logout & Clock Out',
            onPressed: _logout,
          ),
          const SizedBox(width: 16),
          CircleAvatar(
            radius: 22,
            backgroundColor: const Color(0xFF0EA5E9),
            child: CircleAvatar(
              radius: 20,
              backgroundImage: NetworkImage(
                'https://i.pravatar.cc/150?u=${Uri.encodeComponent(AppState.currentUserEmail.isEmpty ? 'anonymous_user' : AppState.currentUserEmail)}',
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _EmployeeStatsGrid extends StatelessWidget {
  const _EmployeeStatsGrid();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(child: _StatCard(title: 'Work Hours', value: AppState.calculateTotalWorkHours(), subText: 'Auto-tracking active', icon: Icons.access_time_filled_rounded, color: const Color(0xFF0EA5E9))),
        const SizedBox(width: 24),
        Expanded(
          child: _StatCard(
            title: 'Tasks Done',
            value:
                '${AppState.tasks.where((t) => t['status'] == 'Done').length}/${AppState.tasks.length}',
            subText: 'Completion rate',
            icon: Icons.task_alt_rounded,
            color: const Color(0xFF10B981),
          ),
        ),
        const SizedBox(width: 24),
        const Expanded(
          child: _StatCard(
            title: 'Team Ranking',
            value: '#4',
            subText: 'Top Performer',
            icon: Icons.emoji_events_rounded,
            color: Color(0xFFF59E0B),
          ),
        ),
        const SizedBox(width: 24),
        const Expanded(
          child: _StatCard(
            title: 'Leave Bal.',
            value: '14 Days',
            subText: 'Annual Leave',
            icon: Icons.beach_access_rounded,
            color: Color(0xFF6366F1),
          ),
        ),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  final String title;
  final String value;
  final String subText;
  final IconData icon;
  final Color color;

  const _StatCard({
    required this.title,
    required this.value,
    required this.subText,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(color: color.withAlpha(20), blurRadius: 15, offset: const Offset(0, 8)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: color.withAlpha(25), borderRadius: BorderRadius.circular(16)),
            child: Icon(icon, color: color, size: 26),
          ),
          const SizedBox(height: 24),
          Text(
            title,
            style: const TextStyle(
              color: Color(0xFF64748B),
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(
              color: Color(0xFF0F172A),
              fontSize: 26,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            subText,
            style: TextStyle(
              color: color,
              fontSize: 11,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }
}

class _MyTasksSection extends StatelessWidget {
  final VoidCallback onViewAll;
  final VoidCallback onButtonClick;
  const _MyTasksSection({required this.onViewAll, required this.onButtonClick});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(32),
        boxShadow: [
          BoxShadow(color: Colors.black.withAlpha(5), blurRadius: 20, offset: const Offset(0, 10)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Row(
                children: [
                  Icon(
                    Icons.playlist_add_check_rounded,
                    color: Color(0xFF0EA5E9),
                  ),
                  SizedBox(width: 12),
                  Text(
                    'My Tasks',
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF0F172A),
                    ),
                  ),
                ],
              ),
              TextButton(
                onPressed: () {
                  onButtonClick(); // Track button click
                  Navigator.push(
                    context,
                    MaterialPageRoute(builder: (context) => const MyTaskPage()),
                  ).then((_) => onViewAll());
                },
                child: const Text('View All'),
              ),
            ],
          ),
          const SizedBox(height: 32),
          if (AppState.tasks.isEmpty)
            const Center(
              child: Text(
                'No tasks added yet.',
                style: TextStyle(color: Colors.grey),
              ),
            )
          else
            ...AppState.tasks
                .take(3)
                .map(
                  (task) => _TaskItem(
                    title: task['title'],
                    deadline: task['deadline'],
                    priority: task['priority'],
                    color: task['color'],
                    isDone: task['status'] == 'Done',
                  ),
                ),
        ],
      ),
    );
  }
}

class _TaskItem extends StatelessWidget {
  final String title;
  final String deadline;
  final String priority;
  final Color color;
  final bool isDone;

  const _TaskItem({
    required this.title,
    required this.deadline,
    required this.priority,
    required this.color,
    required this.isDone,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Row(
          children: [
            Icon(
              isDone
                  ? Icons.check_circle_rounded
                  : Icons.radio_button_unchecked_rounded,
              color: isDone ? Colors.green : Colors.grey,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 15,
                      color: const Color(0xFF1E293B),
                      decoration: isDone ? TextDecoration.lineThrough : null,
                    ),
                  ),
                  Text(
                    deadline,
                    style: const TextStyle(
                      color: Color(0xFF94A3B8),
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(color: color.withAlpha(25), borderRadius: BorderRadius.circular(8)),
              child: Text(priority, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }
}

class _AttendanceSection extends StatelessWidget {
  const _AttendanceSection();

  String _formatTime(DateTime? time) {
    if (time == null) return '--:--';
    final hour = time.hour == 0
        ? 12
        : (time.hour > 12 ? time.hour - 12 : time.hour);
    final minute = time.minute.toString().padLeft(2, '0');
    final period = time.hour >= 12 ? 'PM' : 'AM';
    return '$hour:$minute $period';
  }

  @override
  Widget build(BuildContext context) {
    String clockInStr = _formatTime(AppState.clockInTime);

    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: const Color(0xFF0F172A),
            borderRadius: BorderRadius.circular(24),
          ),
          child: Column(
            children: [
              const SizedBox(height: 16),
              const Text(
                'Work Session Active',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 18),
              ),
              const SizedBox(height: 16),
              _buildTimeRow('Started At', clockInStr, Icons.login_rounded, Colors.greenAccent),
              const SizedBox(height: 20),
              const Text(
                'Timer started automatically on login.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white70, fontSize: 11, fontStyle: FontStyle.italic),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Personal Schedule',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
              ),
              const SizedBox(height: 16),
              _buildScheduleItem('Team Standup', '10:30 AM', Colors.blue),
              _buildScheduleItem('Project Review', '02:00 PM', Colors.purple),
              _buildScheduleItem('Client Call', '04:30 PM', Colors.orange),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildTimeRow(
    String label,
    String time,
    IconData icon,
    Color iconColor,
  ) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Row(
          children: [
            Icon(icon, color: iconColor, size: 16),
            const SizedBox(width: 8),
            Text(
              label,
              style: const TextStyle(color: Colors.white70, fontSize: 12),
            ),
          ],
        ),
        Text(
          time,
          style: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.bold,
            fontSize: 13,
          ),
        ),
      ],
    );
  }

  Widget _buildScheduleItem(String name, String time, Color color) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        children: [
          Container(
            width: 4,
            height: 16,
            decoration: BoxDecoration(
              color: color,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(width: 12),
          Text(
            name,
            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
          ),
          const Spacer(),
          Text(
            time,
            style: const TextStyle(color: Colors.black45, fontSize: 11),
          ),
        ],
      ),
    );
  }
}

class _UserCard extends StatelessWidget {
  const _UserCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withAlpha(38),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 18,
            backgroundImage: NetworkImage(
              'https://i.pravatar.cc/150?u=${Uri.encodeComponent(AppState.currentUserEmail.isEmpty ? 'anonymous_user' : AppState.currentUserEmail)}',
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(AppState.currentUserName, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                const Text('UI/UX Designer', style: TextStyle(color: Colors.white70, fontSize: 11)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
