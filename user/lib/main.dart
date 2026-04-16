import 'package:flutter/material.dart';
import 'userlogin.dart';

void main() {
  runApp(const SkyPortalApp());
}

class SkyPortalApp extends StatelessWidget {
  const SkyPortalApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'SkyPortal Employee Hub',
      theme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.light,
        fontFamily: 'Inter', // Modern, clean font feel
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF0EA5E9), // Sky Blue Seed
          primary: const Color(0xFF0EA5E9),
          secondary: const Color(0xFF2563EB),
        ),
        scaffoldBackgroundColor: const Color(0xFFF0F9FF),
      ),
      home: const UserLoginPage(),
    );
  }
}
