import 'package:freezed_annotation/freezed_annotation.dart';

import '../../../shared/models/member.dart';

part 'auth_state.freezed.dart';

/// Tracks where the user is in the auth flow.
enum AuthStep {
  idle,
  loggingIn,
  otpSent,
  resetPassword,
  authenticated,
}

@freezed
class AuthState with _$AuthState {
  const factory AuthState({
    @Default(AuthStep.idle) AuthStep step,
    Member? member,
  }) = _AuthState;
}
