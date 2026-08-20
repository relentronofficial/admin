import 'package:freezed_annotation/freezed_annotation.dart';

part 'batch.freezed.dart';
part 'batch.g.dart';

enum BatchDayStatus {
  @JsonValue('not_started') notStarted,
  @JsonValue('in_progress') inProgress,
  @JsonValue('submitted') submitted,
  @JsonValue('approved') approved,
  @JsonValue('rejected') rejected,
}

enum BatchTaskType {
  @JsonValue('watch') watch,
  @JsonValue('quiz') quiz,
  @JsonValue('matching') matching,
  @JsonValue('written') written,
  @JsonValue('flashcard') flashcard,
}

// ── Task item within a batch day ──────────────────────────────────────────────

@freezed
class BatchTask with _$BatchTask {
  const factory BatchTask({
    required String id,
    required String title,
    @Default(BatchTaskType.watch) BatchTaskType type,
    @Default(false) bool isCompleted,
    String? proofUrl,
    @Default(true) bool isRequired,
  }) = _BatchTask;

  factory BatchTask.fromJson(Map<String, dynamic> json) =>
      _$BatchTaskFromJson(json);
}

// ── Single day in the program ─────────────────────────────────────────────────
// status is merged from MemberDayProgress at the service layer

@freezed
class BatchDay with _$BatchDay {
  const factory BatchDay({
    required int dayNumber,
    @Default(BatchDayStatus.notStarted) BatchDayStatus status,
    String? category,
    String? title,
    @Default([]) List<BatchTask> tasks,
  }) = _BatchDay;

  factory BatchDay.fromJson(Map<String, dynamic> json) =>
      _$BatchDayFromJson(json);
}

// ── Batch metadata (from batch object in GET /api/user-batch) ─────────────────

@freezed
class BatchInfo with _$BatchInfo {
  const factory BatchInfo({
    required String id,
    required String name,
    String? startDate,
    @Default(50) int xpPerDay,
    String? programName,
  }) = _BatchInfo;

  factory BatchInfo.fromJson(Map<String, dynamic> json) =>
      _$BatchInfoFromJson(json);
}

// ── Attendance record (raw SQL snake_case keys) ───────────────────────────────

@freezed
class BatchAttendance with _$BatchAttendance {
  const factory BatchAttendance({
    @JsonKey(name: 'day_number') required int dayNumber,
    @Default('present') String status,
    String? notes,
    @JsonKey(name: 'marked_at') String? markedAt,
  }) = _BatchAttendance;

  factory BatchAttendance.fromJson(Map<String, dynamic> json) =>
      _$BatchAttendanceFromJson(json);
}

// ── Break request (raw SQL snake_case keys) ───────────────────────────────────

enum BatchBreakStatus {
  @JsonValue('pending') pending,
  @JsonValue('approved') approved,
  @JsonValue('rejected') rejected,
}

@freezed
class BatchBreak with _$BatchBreak {
  const factory BatchBreak({
    required String id,
    @JsonKey(name: 'start_day') required int startDay,
    @JsonKey(name: 'end_day') required int endDay,
    String? reason,
    @Default(BatchBreakStatus.pending) BatchBreakStatus status,
    @JsonKey(name: 'admin_note') String? adminNote,
    @JsonKey(name: 'created_at') String? createdAt,
  }) = _BatchBreak;

  factory BatchBreak.fromJson(Map<String, dynamic> json) =>
      _$BatchBreakFromJson(json);
}

// ── Full program (built by service from merged API response) ──────────────────

@freezed
class BatchProgram with _$BatchProgram {
  const factory BatchProgram({
    required BatchInfo batch,
    required int totalDays,
    @Default([]) List<BatchDay> days,
    @Default([]) List<BatchAttendance> attendance,
    @Default([]) List<BatchBreak> breaks,
  }) = _BatchProgram;

  factory BatchProgram.fromJson(Map<String, dynamic> json) =>
      _$BatchProgramFromJson(json);
}
