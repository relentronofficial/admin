import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/api.dart';
import '../../../shared/api/dio_provider.dart';
import '../../../shared/models/batch.dart';

/// Extra task metadata the freezed [BatchTask] model doesn't carry.
/// Written by [BatchService.getBatchProgram] and read by the day screen so
/// we can render text / URL / file input variants without regenerating
/// freezed. Keyed by task id.
class BatchTaskMeta {
  const BatchTaskMeta({
    required this.proofType,
    this.description,
    this.deliverables,
    this.basePoints,
    this.bonusPoints,
    this.estimatedMinutes,
    this.contentUrl,
    this.responseValue,
  });

  final String proofType;
  final String? description;
  final String? deliverables;
  final int? basePoints;
  final int? bonusPoints;
  final int? estimatedMinutes;
  final String? contentUrl;
  final String? responseValue;
}

class BatchDayMeta {
  const BatchDayMeta({this.notes, this.resourceUrl});
  final String? notes;
  final String? resourceUrl;
}

class BatchService {
  BatchService(this._dio);
  final Dio _dio;

  /// Populated on every successful [getBatchProgram] call. Consumers read
  /// this after awaiting the program to know how each task expects proof.
  final Map<String, BatchTaskMeta> taskMeta = {};

  /// Per-day description + resource URL. Populated alongside [taskMeta].
  /// Same rationale — freezed `BatchDay` model doesn't carry these fields
  /// and codegen is currently blocked.
  final Map<int, BatchDayMeta> dayMeta = {};

  // ── GET /api/user-batch ──────────────────────────────────────────────────────
  // Returns null when the member has no batch assigned.

  Future<BatchProgram?> getBatchProgram() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(kUserBatch);
      final data = res.data?['data'] as Map<String, dynamic>?;
      if (data == null) return null;

      final batchJson = data['batch'] as Map<String, dynamic>?;
      if (batchJson == null) return null;

      final batch = BatchInfo(
        id: batchJson['id'] as String? ?? '',
        name: batchJson['name'] as String? ?? '',
        startDate: batchJson['startsAt'] as String?,
        xpPerDay: (batchJson['xpPerDay'] as int?) ?? 50,
        programName: data['programName'] as String?,
      );

      final totalDays = (data['totalDays'] as int?) ?? 90;

      // Build lookup: dayNumber → MemberDayProgress
      final progressList = (data['progress'] as List<dynamic>? ?? [])
          .cast<Map<String, dynamic>>();
      final progressByDay = <int, Map<String, dynamic>>{
        for (final p in progressList)
          (p['dayNumber'] as int? ?? 0): p,
      };

      // Build lookup: dayNumber → program tasks (from Task table)
      final programTasks = (data['programTasks'] as List<dynamic>? ?? [])
          .cast<Map<String, dynamic>>();
      final tasksByDay = <int, List<Map<String, dynamic>>>{};
      for (final t in programTasks) {
        final dn = t['dayNumber'] as int? ?? 0;
        tasksByDay.putIfAbsent(dn, () => []).add(t);
      }

      // Build lookup: taskId → submission (proofUrl, status, responseValue)
      final submissions = (data['mySubmissions'] as List<dynamic>? ?? [])
          .cast<Map<String, dynamic>>();
      final subByTaskId = <String, Map<String, dynamic>>{
        for (final s in submissions)
          (s['taskId'] as String? ?? ''): s,
      };

      // Refresh the taskMeta cache — one entry per task in the program.
      // UI reads this to know which input to render (text / url / file /
      // watch) and to prefill the previously-submitted value.
      taskMeta.clear();
      for (final t in programTasks) {
        final id = t['id'] as String? ?? '';
        if (id.isEmpty) continue;
        final sub = subByTaskId[id];
        taskMeta[id] = BatchTaskMeta(
          proofType: (t['proofType'] as String?) ?? 'watch',
          description: t['description'] as String?,
          deliverables: t['deliverables'] as String?,
          basePoints: (t['basePoints'] as num?)?.toInt(),
          bonusPoints: (t['bonusPoints'] as num?)?.toInt(),
          estimatedMinutes: (t['estimatedMinutes'] as num?)?.toInt(),
          contentUrl: t['contentUrl'] as String?,
          responseValue: sub?['responseValue'] as String?,
        );
      }

      // Merge raw BatchDay rows with progress + tasks
      final rawDays = (data['days'] as List<dynamic>? ?? [])
          .cast<Map<String, dynamic>>();

      // Refresh dayMeta cache with notes + resourceUrl from each day.
      dayMeta.clear();
      for (final d in rawDays) {
        final dn = d['dayNumber'] as int? ?? 0;
        if (dn <= 0) continue;
        dayMeta[dn] = BatchDayMeta(
          notes: d['notes'] as String?,
          resourceUrl: d['resourceUrl'] as String?,
        );
      }

      final builtDays = rawDays.map((d) {
        final dn = d['dayNumber'] as int? ?? 0;
        final prog = progressByDay[dn];
        final status = _parseStatus(prog?['status'] as String?);

        final completedTaskIds =
            (prog?['completedTaskIds'] as List<dynamic>? ?? [])
                .cast<String>()
                .toSet();

        final dayTasks = (tasksByDay[dn] ?? []).map((t) {
          final taskId = t['id'] as String? ?? '';
          final sub = subByTaskId[taskId];
          return BatchTask(
            id: taskId,
            title: t['title'] as String? ?? '',
            type: _parseTaskType(t['proofType'] as String?),
            isCompleted: completedTaskIds.contains(taskId),
            proofUrl: sub?['proofUrl'] as String?,
          );
        }).toList();

        return BatchDay(
          dayNumber: dn,
          status: status,
          category: d['category'] as String?,
          title: d['title'] as String?,
          tasks: dayTasks,
        );
      }).toList();

      // Fill gaps: days not yet created by admin still appear in the calendar
      final existingNums = builtDays.map((d) => d.dayNumber).toSet();
      for (var i = 1; i <= totalDays; i++) {
        if (!existingNums.contains(i)) {
          builtDays.add(BatchDay(dayNumber: i));
        }
      }
      builtDays.sort((a, b) => a.dayNumber.compareTo(b.dayNumber));

      final attendance = (data['attendance'] as List<dynamic>? ?? [])
          .cast<Map<String, dynamic>>()
          .map(BatchAttendance.fromJson)
          .toList();

      final breaks = (data['breaks'] as List<dynamic>? ?? [])
          .cast<Map<String, dynamic>>()
          .map(BatchBreak.fromJson)
          .toList();

      return BatchProgram(
        batch: batch,
        totalDays: totalDays,
        days: builtDays,
        attendance: attendance,
        breaks: breaks,
      );
    } on DioException catch (e) {
      throw Exception(
          e.response?.data?['error'] ?? 'Failed to load batch program');
    }
  }

  // ── PUT /api/user-batch/:dayNumber ────────────────────────────────────────────

  Future<void> saveDraft(
    int dayNumber, {
    String? journalEntry,
    String? journalFileUrl,
    List<String>? completedTaskIds,
    Map<String, Map<String, String?>>? taskSubmissions,
  }) async {
    try {
      await _dio.put<void>(
        '$kUserBatch/$dayNumber',
        data: {
          if (journalEntry != null) 'journalEntry': journalEntry,
          if (journalFileUrl != null) 'journalFileUrl': journalFileUrl,
          if (completedTaskIds != null) 'completedTaskIds': completedTaskIds,
          if (taskSubmissions != null) 'taskSubmissions': taskSubmissions,
        },
      );
    } on DioException catch (e) {
      throw Exception(e.response?.data?['error'] ?? 'Failed to save draft');
    }
  }

  // ── POST /api/user-batch/:dayNumber/submit ────────────────────────────────────

  Future<void> submitDay(int dayNumber) async {
    try {
      await _dio.post<void>('$kUserBatch/$dayNumber/submit');
    } on DioException catch (e) {
      throw Exception(e.response?.data?['error'] ?? 'Failed to submit day');
    }
  }

  // ── POST /api/user-batch/attendance ───────────────────────────────────────────

  Future<void> markAttendance(int dayNumber, {String? notes}) async {
    try {
      await _dio.post<void>(
        kUserBatchAttendance,
        data: {
          'dayNumber': dayNumber,
          if (notes != null && notes.isNotEmpty) 'notes': notes,
        },
      );
    } on DioException catch (e) {
      throw Exception(
          e.response?.data?['error'] ?? 'Failed to mark attendance');
    }
  }

  // ── POST /api/user-batch/break ────────────────────────────────────────────────

  Future<void> requestBreak({
    required int startDay,
    required int endDay,
    String? reason,
  }) async {
    try {
      await _dio.post<void>(
        '$kUserBatch/break',
        data: {
          'startDay': startDay,
          'endDay': endDay,
          if (reason != null && reason.isNotEmpty) 'reason': reason,
        },
      );
    } on DioException catch (e) {
      throw Exception(
          e.response?.data?['error'] ?? 'Failed to request break');
    }
  }

  // ── GET /api/user-batch/certificate ──────────────────────────────────────────
  // Streams the batch attendance/completion certificate PDF via Dio (cookies
  // attached). Caller writes to app cache then hands off to open_filex.

  Future<List<int>> downloadCertificate() async {
    try {
      final res = await _dio.get<List<int>>(
        '$kUserBatch/certificate',
        options: Options(
          responseType: ResponseType.bytes,
          headers: {'Accept': 'application/pdf'},
        ),
      );
      return res.data ?? const [];
    } on DioException catch (e) {
      throw Exception(
          e.response?.data?['error'] ?? 'Failed to download certificate');
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  static BatchDayStatus _parseStatus(String? s) {
    switch (s) {
      case 'in_progress':
        return BatchDayStatus.inProgress;
      case 'submitted':
        return BatchDayStatus.submitted;
      case 'approved':
        return BatchDayStatus.approved;
      case 'rejected':
        return BatchDayStatus.rejected;
      default:
        return BatchDayStatus.notStarted;
    }
  }

  static BatchTaskType _parseTaskType(String? t) {
    switch (t) {
      case 'quiz':
        return BatchTaskType.quiz;
      case 'matching':
        return BatchTaskType.matching;
      case 'written':
        return BatchTaskType.written;
      case 'flashcard':
        return BatchTaskType.flashcard;
      default:
        return BatchTaskType.watch;
    }
  }
}

final batchServiceProvider = Provider<BatchService>(
  (ref) => BatchService(ref.watch(dioProvider)),
);
