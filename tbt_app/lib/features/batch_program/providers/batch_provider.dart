import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../../shared/models/batch.dart';
import '../../../shared/providers/socket_provider.dart';
import '../../../shared/socket/socket_events.dart';
import '../data/batch_service.dart';

part 'batch_provider.g.dart';

// ── Full program — keepAlive (calendar, day screen, program screen all share it)

@Riverpod(keepAlive: true)
Future<BatchProgram?> batchProgram(Ref ref) =>
    ref.read(batchServiceProvider).getBatchProgram();

// ── Single day — derived from the cached program; auto-dispose

@riverpod
Future<BatchDay?> batchDay(Ref ref, int dayNumber) async {
  final program = await ref.watch(batchProgramProvider.future);
  if (program == null) return null;
  try {
    return program.days.firstWhere((d) => d.dayNumber == dayNumber);
  } on StateError {
    return null;
  }
}

// ── Batch day approved event (keepAlive) ──────────────────────────────────────

/// Holds the most recent `batch:day_approved` socket payload.
/// Screens listen to this to show the XP SnackBar.
class BatchDayApprovedEvent {
  final int dayNumber;
  final String batchId;
  final int xpAwarded;

  const BatchDayApprovedEvent({
    required this.dayNumber,
    required this.batchId,
    required this.xpAwarded,
  });
}

@Riverpod(keepAlive: true)
class BatchDayApprovedNotifier extends _$BatchDayApprovedNotifier {
  @override
  BatchDayApprovedEvent? build() {
    final socket = ref.read(socketNotifierProvider.notifier);
    void handler(dynamic data) {
      try {
        final map = (data as Map<dynamic, dynamic>).cast<String, dynamic>();
        state = BatchDayApprovedEvent(
          dayNumber: (map['dayNumber'] as num?)?.toInt() ?? 0,
          batchId: map['batchId'] as String? ?? '',
          xpAwarded: (map['xpAwarded'] as num?)?.toInt() ?? 0,
        );
        ref.invalidate(batchProgramProvider);
      } catch (_) {
        // Malformed payload — ignore.
      }
    }
    socket.on(kSocketBatchDayApproved, handler);
    ref.onDispose(() => socket.off(kSocketBatchDayApproved, handler));
    return null;
  }
}

// ── Batch day rejected event (keepAlive) ──────────────────────────────────────

class BatchDayRejectedEvent {
  final int dayNumber;
  final String reviewNote;

  const BatchDayRejectedEvent({
    required this.dayNumber,
    required this.reviewNote,
  });
}

@Riverpod(keepAlive: true)
class BatchDayRejectedNotifier extends _$BatchDayRejectedNotifier {
  @override
  BatchDayRejectedEvent? build() {
    final socket = ref.read(socketNotifierProvider.notifier);
    void handler(dynamic data) {
      try {
        final map = (data as Map<dynamic, dynamic>).cast<String, dynamic>();
        state = BatchDayRejectedEvent(
          dayNumber: (map['dayNumber'] as num?)?.toInt() ?? 0,
          reviewNote: map['reviewNote'] as String? ?? '',
        );
        ref.invalidate(batchProgramProvider);
      } catch (_) {}
    }
    socket.on(kSocketBatchDayRejected, handler);
    ref.onDispose(() => socket.off(kSocketBatchDayRejected, handler));
    return null;
  }
}

// ── Batch program completed event (keepAlive) ─────────────────────────────────

class BatchCompletedEvent {
  final int totalDays;

  const BatchCompletedEvent({required this.totalDays});
}

@Riverpod(keepAlive: true)
class BatchCompletedNotifier extends _$BatchCompletedNotifier {
  @override
  BatchCompletedEvent? build() {
    final socket = ref.read(socketNotifierProvider.notifier);
    void handler(dynamic data) {
      try {
        final map = (data as Map<dynamic, dynamic>).cast<String, dynamic>();
        state = BatchCompletedEvent(
          totalDays: (map['totalDays'] as num?)?.toInt() ?? 0,
        );
        ref.invalidate(batchProgramProvider);
      } catch (_) {}
    }
    socket.on(kSocketBatchCompleted, handler);
    ref.onDispose(() => socket.off(kSocketBatchCompleted, handler));
    return null;
  }
}
