import 'package:flutter/material.dart';

class ProfilePage extends StatelessWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF0F9FF),
      appBar: AppBar(
        title: const Text('My Profile', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        elevation: 0,
        foregroundColor: const Color(0xFF0369A1),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(32),
        child: Column(
          children: [
            const CircleAvatar(
              radius: 64,
              backgroundColor: Color(0xFF0EA5E9),
              child: CircleAvatar(
                radius: 60,
                backgroundImage: NetworkImage('https://i.pravatar.cc/150?u=user1'),
              ),
            ),
            const SizedBox(height: 24),
            const Text(
              'user1',
              style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: Color(0xFF0F172A)),
            ),
            const Text(
              'UI/UX Designer • SkyPortal Tech',
              style: TextStyle(fontSize: 16, color: Color(0xFF0EA5E9), fontWeight: FontWeight.w500),
            ),
            const SizedBox(height: 48),
            _buildProfileInfo('Email', 'user1@skyportal.com', Icons.email_rounded),
            _buildProfileInfo('Employee ID', 'SP-2023-042', Icons.badge_rounded),
            _buildProfileInfo('Department', 'Design & Creative', Icons.business_rounded),
            _buildProfileInfo('Location', 'Remote / Dubai', Icons.location_on_rounded),
          ],
        ),
      ),
    );
  }

  Widget _buildProfileInfo(String label, String value, IconData icon) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 10),
        ],
      ),
      child: Row(
        children: [
          Icon(icon, color: const Color(0xFF0EA5E9)),
          const SizedBox(width: 16),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: const TextStyle(color: Colors.grey, fontSize: 12, fontWeight: FontWeight.w500)),
              Text(value, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF1E293B))),
            ],
          ),
        ],
      ),
    );
  }
}
