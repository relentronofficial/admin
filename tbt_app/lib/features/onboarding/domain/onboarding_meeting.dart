/// Plain (non-freezed) model, mirroring the onboarding_state.dart precedent
/// — no need to block on codegen for a straightforward response shape.
/// See ONBOARDING_LIVE_MEETING_SPECKIT.md.
library;

class OnboardingMeeting {
  const OnboardingMeeting({
    required this.id,
    required this.title,
    required this.description,
    required this.status,
    required this.scheduledAt,
    required this.durationMinutes,
    required this.hostAdminName,
    required this.cancelReason,
    this.participantCount,
  });

  final String id;
  final String title;
  final String? description;
  final String status; // scheduled | live | completed | cancelled
  final DateTime scheduledAt;
  final int durationMinutes;
  final String? hostAdminName;
  final String? cancelReason;
  final int? participantCount;

  bool get isJoinable => status == 'scheduled' || status == 'live';

  factory OnboardingMeeting.fromJson(Map<String, dynamic> json) => OnboardingMeeting(
        id: json['id'] as String,
        title: json['title'] as String? ?? 'Onboarding Verification Call',
        description: json['description'] as String?,
        status: json['status'] as String? ?? 'scheduled',
        scheduledAt: DateTime.parse(json['scheduledAt'] as String),
        durationMinutes: (json['durationMinutes'] as num?)?.toInt() ?? 30,
        hostAdminName: (json['hostAdmin'] as Map?)?['fullName'] as String?,
        cancelReason: json['cancelReason'] as String?,
        participantCount: (json['_count'] as Map?)?['participants'] as int?,
      );
}

class OnboardingMeetingJoinCreds {
  const OnboardingMeetingJoinCreds({
    required this.token,
    required this.wsUrl,
    required this.title,
    required this.startedAt,
  });

  final String token;
  final String wsUrl;
  final String title;

  /// Authoritative meeting start time from the backend — null before the
  /// meeting has actually started. Never derive duration from client
  /// connect time — see ONBOARDING_LIVE_MEETING_SPECKIT.md.
  final DateTime? startedAt;

  factory OnboardingMeetingJoinCreds.fromJson(Map<String, dynamic> json) => OnboardingMeetingJoinCreds(
        token: json['token'] as String,
        wsUrl: json['wsUrl'] as String,
        title: json['title'] as String? ?? 'Onboarding Verification Call',
        startedAt: json['startedAt'] != null ? DateTime.parse(json['startedAt'] as String) : null,
      );
}
