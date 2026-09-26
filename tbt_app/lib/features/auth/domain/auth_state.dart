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
  /// Returned by verifyOtp when the member already has an active session on
  /// another device. The client shows a confirmation sheet and calls
  /// completeLogin() to revoke the other session and proceed.
  sessionConflict,
}

@freezed
class AuthState with _$AuthState {
  const factory AuthState({
    @Default(AuthStep.idle) AuthStep step,
    Member? member,
    /// Held during session_conflict so the OTP screen can pass it to
    /// completeLogin() when the user confirms they want to continue here.
    String? pendingToken,
  }) = _AuthState;
}
