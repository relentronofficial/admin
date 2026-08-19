// Pure Dart — no Flutter imports. Unit-testable without a widget tree.

/// Maps a notification [type] and optional [metadata] to a Flutter route path.
///
/// Mirrors the logic in `tbt-admin/admin-panel/lib/utils/notificationRouter.ts`
/// adapted for user-facing (member) notifications.
///
/// Metadata may arrive as a [Map<String, dynamic>] from the socket payload or
/// from FCM data fields. Both sources are handled identically.
String resolveNotificationRoute({
  required String type,
  Map<String, dynamic>? metadata,
}) {
  final m = metadata ?? const <String, dynamic>{};

  switch (type) {
    // ── Batch / weekly checklist ────────────────────────────────────────────
    case 'batch_day_approved':
    case 'batch_day_reminder':
    case 'checklist_available':
    case 'checklist_submitted':
      final day = m['dayNumber'];
      if (day != null) return '/batch-program/$day';
      return '/batch-program';

    case 'weekly_pending_reminder':
      return '/batch-program';

    // ── Courses ──────────────────────────────────────────────────────────────
    case 'course_access':
    case 'course_access_granted': // plan alias
      final courseId = m['courseId'];
      if (courseId != null) return '/learning/$courseId';
      return '/learning';

    case 'course_enroll':
      final courseId = m['courseId'];
      if (courseId != null) return '/learning/$courseId';
      return '/learning';

    case 'episode_complete':
    case 'course_complete':
      final courseId = m['courseId'];
      if (courseId != null) return '/learning/$courseId';
      return '/learning';

    case 'quiz_pass':
      final courseId = m['courseId'];
      if (courseId != null) return '/learning/$courseId';
      return '/learning';

    case 'badge_award':
      return '/learning/badges';

    // ── Messages ─────────────────────────────────────────────────────────────
    case 'message':
    case 'new_message': // plan alias
      final convId = m['conversationId'];
      if (convId != null) return '/messages/$convId';
      return '/messages';

    // ── Live calls ───────────────────────────────────────────────────────────
    case 'live_call':
    case 'webinar':
    case 'live_call_reminder': // plan alias
      final slug = m['workshopSlug'] as String?;
      final callId = (m['callId'] ?? m['liveCallId']) as String?;
      if (slug != null && callId != null) return '/live/$slug/$callId';
      return '/notifications';

    // ── Announcements / system ────────────────────────────────────────────────
    case 'announcement':
    case 'new_announcement': // plan alias
    case 'info':
    case 'system':
      return '/notifications';

    default:
      return '/notifications';
  }
}
