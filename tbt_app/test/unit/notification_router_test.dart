import 'package:flutter_test/flutter_test.dart';
import 'package:tbt_app/core/utils/notification_router.dart';

void main() {
  group('resolveNotificationRoute', () {
    // ── Batch ──────────────────────────────────────────────────────────────
    test('batch_day_approved with dayNumber', () {
      expect(
        resolveNotificationRoute(
          type: 'batch_day_approved',
          metadata: {'dayNumber': '7'},
        ),
        '/batch-program/7',
      );
    });

    test('batch_day_approved without metadata', () {
      expect(
        resolveNotificationRoute(type: 'batch_day_approved'),
        '/batch-program',
      );
    });

    // ── Course access ──────────────────────────────────────────────────────
    test('course_access with courseId', () {
      expect(
        resolveNotificationRoute(
          type: 'course_access',
          metadata: {'courseId': 'abc123'},
        ),
        '/learning/abc123',
      );
    });

    test('course_access_granted (plan alias) with courseId', () {
      expect(
        resolveNotificationRoute(
          type: 'course_access_granted',
          metadata: {'courseId': 'abc123'},
        ),
        '/learning/abc123',
      );
    });

    test('course_access without courseId falls back to /learning', () {
      expect(
        resolveNotificationRoute(type: 'course_access'),
        '/learning',
      );
    });

    // ── Course events ──────────────────────────────────────────────────────
    test('course_enroll routes to /learning/:courseId', () {
      expect(
        resolveNotificationRoute(
            type: 'course_enroll', metadata: {'courseId': 'c1'}),
        '/learning/c1',
      );
    });

    test('course_complete routes to /learning/:courseId', () {
      expect(
        resolveNotificationRoute(
            type: 'course_complete', metadata: {'courseId': 'c2'}),
        '/learning/c2',
      );
    });

    test('episode_complete routes to /learning/:courseId', () {
      expect(
        resolveNotificationRoute(
            type: 'episode_complete', metadata: {'courseId': 'c3'}),
        '/learning/c3',
      );
    });

    test('quiz_pass routes to /learning/:courseId', () {
      expect(
        resolveNotificationRoute(
            type: 'quiz_pass', metadata: {'courseId': 'c4'}),
        '/learning/c4',
      );
    });

    test('badge_award always routes to /learning/badges', () {
      expect(
        resolveNotificationRoute(type: 'badge_award'),
        '/learning/badges',
      );
    });

    // ── Messages ──────────────────────────────────────────────────────────
    test('message with conversationId', () {
      expect(
        resolveNotificationRoute(
          type: 'message',
          metadata: {'conversationId': 'conv99'},
        ),
        '/messages/conv99',
      );
    });

    test('new_message (plan alias) with conversationId', () {
      expect(
        resolveNotificationRoute(
          type: 'new_message',
          metadata: {'conversationId': 'conv99'},
        ),
        '/messages/conv99',
      );
    });

    test('message without conversationId falls back to /messages', () {
      expect(
        resolveNotificationRoute(type: 'message'),
        '/messages',
      );
    });

    // ── Live calls ────────────────────────────────────────────────────────
    test('live_call with workshopSlug and callId', () {
      expect(
        resolveNotificationRoute(
          type: 'live_call',
          metadata: {'workshopSlug': 'my-workshop', 'callId': 'call1'},
        ),
        '/live/my-workshop/call1',
      );
    });

    test('live_call accepts liveCallId as callId alias', () {
      expect(
        resolveNotificationRoute(
          type: 'live_call',
          metadata: {'workshopSlug': 'my-workshop', 'liveCallId': 'call2'},
        ),
        '/live/my-workshop/call2',
      );
    });

    test('webinar type routes same as live_call', () {
      expect(
        resolveNotificationRoute(
          type: 'webinar',
          metadata: {'workshopSlug': 'slug', 'callId': 'c1'},
        ),
        '/live/slug/c1',
      );
    });

    test('live_call_reminder (plan alias) routes to /live/:slug/:callId', () {
      expect(
        resolveNotificationRoute(
          type: 'live_call_reminder',
          metadata: {'workshopSlug': 'slug2', 'callId': 'c2'},
        ),
        '/live/slug2/c2',
      );
    });

    test('live_call falls back to /notifications when slug missing', () {
      expect(
        resolveNotificationRoute(
          type: 'live_call',
          metadata: {'callId': 'c1'}, // no workshopSlug
        ),
        '/notifications',
      );
    });

    test('live_call falls back to /notifications when both keys missing', () {
      expect(
        resolveNotificationRoute(type: 'live_call'),
        '/notifications',
      );
    });

    // ── Announcements ─────────────────────────────────────────────────────
    test('announcement routes to /notifications', () {
      expect(resolveNotificationRoute(type: 'announcement'), '/notifications');
    });

    test('new_announcement (plan alias) routes to /notifications', () {
      expect(
          resolveNotificationRoute(type: 'new_announcement'), '/notifications');
    });

    test('info routes to /notifications', () {
      expect(resolveNotificationRoute(type: 'info'), '/notifications');
    });

    test('system routes to /notifications', () {
      expect(resolveNotificationRoute(type: 'system'), '/notifications');
    });

    // ── Unknown / default ─────────────────────────────────────────────────
    test('unknown type falls back to /notifications', () {
      expect(
        resolveNotificationRoute(type: 'some_unknown_type'),
        '/notifications',
      );
    });

    test('null metadata does not throw', () {
      expect(
        () => resolveNotificationRoute(type: 'batch_day_approved'),
        returnsNormally,
      );
    });
  });
}
