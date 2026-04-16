import 'package:firebase_auth/firebase_auth.dart';

class AuthService {
  static const List<String> allowedAdminEmails = [
    'admin@email.com',
  ];

  static final FirebaseAuth _auth = FirebaseAuth.instance;

  static Future<UserCredential> signInWithEmailAndPassword({
    required String email,
    required String password,
  }) {
    return _auth.signInWithEmailAndPassword(email: email, password: password);
  }

  static bool isAdmin(User? user) {
    final normalizedEmail = user?.email?.trim().toLowerCase();
    return normalizedEmail != null && allowedAdminEmails.contains(normalizedEmail);
  }

  static Future<void> signOut() {
    return _auth.signOut();
  }

  static User? get currentUser => _auth.currentUser;
}
