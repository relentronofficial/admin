abstract class AppException implements Exception {
  const AppException(this.message);
  final String message;

  @override
  String toString() => '$runtimeType: $message';
}

/// No network connectivity or connection timed out.
class NetworkException extends AppException {
  const NetworkException([super.message = 'No internet connection']);
}

/// 401 after refresh attempt failed — user must re-login.
class UnauthorizedException extends AppException {
  const UnauthorizedException(
      [super.message = 'Session expired. Please log in again.']);
}

/// 403 — member does not have access to the requested resource.
class ForbiddenException extends AppException {
  const ForbiddenException(
      [super.message = 'You do not have access to this content.']);
}

/// 422 — request body failed server-side validation.
/// [fieldErrors] maps field names to their error messages.
class ValidationException extends AppException {
  const ValidationException(super.message, {this.fieldErrors = const {}});
  final Map<String, String> fieldErrors;
}

/// 5xx — unexpected server error.
class ServerException extends AppException {
  const ServerException(
      [super.message = 'Something went wrong. Please try again.']);
}
