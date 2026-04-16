import 'package:flutter/material.dart';
import 'userdashboard.dart';

class LeaveAndAttPage extends StatelessWidget {
  const LeaveAndAttPage({super.key});

  String _formatTime(DateTime? time) {
    if (time == null) return 'N/A';
    final hour = time.hour == 0 ? 12 : (time.hour > 12 ? time.hour - 12 : time.hour);
    final minute = time.minute.toString().padLeft(2, '0');
    final period = time.hour >= 12 ? 'PM' : 'AM';
    return '$hour:$minute $period';
  }

  String _formatDuration(Duration? duration) {
    if (duration == null) return '0h 0m';
    int hours = duration.inHours;
    int minutes = duration.inMinutes.remainder(60);
    return '${hours}h ${minutes}m';
  }

  @override
  Widget build(BuildContext context) {
    String clockInStr = _formatTime(AppState.clockInTime);
    String clockOutStr = _formatTime(AppState.clockOutTime);

    return Scaffold(
      backgroundColor: const Color(0xFFF0F9FF),
      appBar: AppBar(
        title: const Text('Leave & Attendance', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        elevation: 0,
        foregroundColor: const Color(0xFF0369A1),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(32),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 20),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Clock Status', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: const Color(0xFF0EA5E9).withOpacity(0.1),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          'Total Today: ${AppState.calculateTotalWorkHours()}',
                          style: const TextStyle(color: Color(0xFF0EA5E9), fontWeight: FontWeight.bold, fontSize: 12),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  Row(
                    children: [
                      Icon(
                        AppState.isClockedIn ? Icons.check_circle_rounded : Icons.cancel_rounded,
                        color: AppState.isClockedIn ? Colors.green : Colors.grey,
                        size: 48,
                      ),
                      const SizedBox(width: 16),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            AppState.isClockedIn ? 'CLOCKED IN' : 'CLOCKED OUT',
                            style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.w900,
                              color: AppState.isClockedIn ? Colors.green : Colors.grey,
                            ),
                          ),
                          Text(
                            AppState.isClockedIn ? 'Started at: $clockInStr' : 'Last Session Ended: $clockOutStr',
                            style: const TextStyle(color: Colors.blueGrey, fontSize: 13),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  const Divider(),
                  const SizedBox(height: 24),
                  const Text('Login & Logout History', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Color(0xFF64748B))),
                  const SizedBox(height: 16),
                  if (AppState.attendanceLogs.isEmpty && !AppState.isClockedIn)
                    const Center(child: Text('No attendance records found today', style: TextStyle(color: Colors.grey, fontSize: 13)))
                  else
                    ...[
                      if (AppState.isClockedIn)
                         _attendanceRow(AppState.clockInTime, null),
                      ...AppState.attendanceLogs.reversed.map((log) => _attendanceRow(log['in'], log['out'])),
                    ],
                ],
              ),
            ),
            const SizedBox(height: 32),
            _buildLeaveBalance(),
          ],
        ),
      ),
    );
  }

  Widget _attendanceRow(DateTime? login, DateTime? logout) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('LOGIN', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 1)),
              const SizedBox(height: 4),
              Text(_formatTime(login), style: const TextStyle(color: Color(0xFF1E293B), fontWeight: FontWeight.bold, fontSize: 15)),
            ],
          ),
          Container(
            height: 30,
            width: 1,
            color: const Color(0xFFE2E8F0),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              const Text('LOGOUT', style: TextStyle(color: Color(0xFF94A3B8), fontSize: 10, fontWeight: FontWeight.w800, letterSpacing: 1)),
              const SizedBox(height: 4),
              Text(
                logout == null ? "ACTIVE" : _formatTime(logout),
                style: TextStyle(
                  color: logout == null ? const Color(0xFF10B981) : const Color(0xFF1E293B),
                  fontWeight: FontWeight.bold,
                  fontSize: 15,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildLeaveBalance() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 20),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Leave Balance', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 24),
          _leaveRow('Annual Leave', 14, 20),
          const Divider(),
          _leaveRow('Sick Leave', 8, 10),
          const Divider(),
          _leaveRow('Casual Leave', 2, 5),
        ],
      ),
    );
  }

  Widget _leaveRow(String label, int used, int total) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontWeight: FontWeight.w600)),
          Text('$used / $total Days', style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF0EA5E9))),
        ],
      ),
    );
  }
}
