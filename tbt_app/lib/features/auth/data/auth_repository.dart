import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/api/services/auth_service.dart';

// Thin pass-through. Caching, biometrics, or offline logic go here later.
class AuthRepository {
  const AuthRepository(AuthService service) : _service = service;
  // ignore: unused_field
  final AuthService _service;
}

final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => AuthRepository(ref.watch(authServiceProvider)),
);
