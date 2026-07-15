import 'package:freezed_annotation/freezed_annotation.dart';

part 'workshop.freezed.dart';
part 'workshop.g.dart';

// Only three valid values — never 'recorded'.
enum DeliveryMode {
  @JsonValue('online') online,
  @JsonValue('offline') offline,
  @JsonValue('hybrid') hybrid,
}

@freezed
class Workshop with _$Workshop {
  const factory Workshop({
    required String id,
    required String slug,
    required String title,
    String? description,
    String? thumbnailUrl,
    required DeliveryMode deliveryMode,
    String? deliveryModeLabel,
    @Default(false) bool locked,
    String? enrollmentStatus,
    @Default(0) int challengeCount,
    List<String>? batchIds,
  }) = _Workshop;

  factory Workshop.fromJson(Map<String, dynamic> json) =>
      _$WorkshopFromJson(json);
}

// ── Workshop progress (inside WorkshopDetail) ──────────────────────────────────

@freezed
class WorkshopProgress with _$WorkshopProgress {
  const factory WorkshopProgress({
    String? label,
    @Default(0) int percentage,
    @Default(0) int completedCount,
    @Default(0) int totalCount,
  }) = _WorkshopProgress;

  factory WorkshopProgress.fromJson(Map<String, dynamic> json) =>
      _$WorkshopProgressFromJson(json);
}

// ── Workshop flow item (GET /api/user/workshops/:slug/flow) ───────────────────

@freezed
class FlowEpisode with _$FlowEpisode {
  const factory FlowEpisode({
    required String id,
    @Default(0) int order,
    required String title,
    @Default('video') String type,
    @Default(false) bool isCompleted,
    @Default(false) bool isLocked,
    int? durationSeconds,
    String? durationLabel,
  }) = _FlowEpisode;

  factory FlowEpisode.fromJson(Map<String, dynamic> json) =>
      _$FlowEpisodeFromJson(json);
}

// Single model covering challenge / live_call / custom types.
@freezed
class FlowItem with _$FlowItem {
  const factory FlowItem({
    required String id,
    @Default(0) int order,
    @Default('custom') String type,
    // Shared
    String? title,
    String? label,
    String? description,
    @Default(false) bool isCompleted,
    // Challenge-specific
    int? challengeNumber,
    String? numberLabel,
    String? numberColor,
    @Default(0) int progressPercent,
    @Default([]) List<FlowEpisode> episodes,
    // Live-call-specific
    String? liveCallId,
    String? labelColor,
    String? scheduledAt,
    String? status,
    @Default(false) bool isUnlocked,
    @Default(false) bool recordingAvailable,
    String? recordingLabel,
    String? prerequisiteNote,
    String? externalMeetingUrl,
    String? externalMeetingProvider,
    String? aiSummary,
  }) = _FlowItem;

  factory FlowItem.fromJson(Map<String, dynamic> json) =>
      _$FlowItemFromJson(json);
}

// ── Workshop Q&A (GET /api/user/workshops/:slug/qa) ────────────────────────────

@freezed
class QaAuthor with _$QaAuthor {
  const factory QaAuthor({
    required String name,
    String? avatarUrl,
  }) = _QaAuthor;

  factory QaAuthor.fromJson(Map<String, dynamic> json) =>
      _$QaAuthorFromJson(json);
}

@freezed
class QaReply with _$QaReply {
  const factory QaReply({
    required String id,
    required QaAuthor author,
    required String timeAgo,
    required String replyText,
  }) = _QaReply;

  factory QaReply.fromJson(Map<String, dynamic> json) =>
      _$QaReplyFromJson(json);
}

@freezed
class QaPost with _$QaPost {
  const factory QaPost({
    required String id,
    required QaAuthor author,
    required String timeAgo,
    required String questionText,
    @Default('Reply') String replyLabel,
    @Default([]) List<QaReply> replies,
  }) = _QaPost;

  factory QaPost.fromJson(Map<String, dynamic> json) =>
      _$QaPostFromJson(json);
}

@freezed
class WorkshopQaData with _$WorkshopQaData {
  const factory WorkshopQaData({
    @Default('Do you have any questions?') String heading,
    @Default('') String promptText,
    @Default('Type your question here...') String inputPlaceholder,
    @Default('Ask Now') String submitLabel,
    @Default('Community Questions') String communityHeading,
    @Default([]) List<QaPost> posts,
  }) = _WorkshopQaData;

  factory WorkshopQaData.fromJson(Map<String, dynamic> json) =>
      _$WorkshopQaDataFromJson(json);
}

// ── Workshop assignments (GET /api/user/workshops/:slug/assignments) ───────────

@freezed
class AssignmentSubmission with _$AssignmentSubmission {
  const factory AssignmentSubmission({
    @Default(false) bool isSubmitted,
    String? submittedAt,
    String? answerText,
    String? imageUrl,
    String? fileUrl,
    String? videoId,
    String? videoUrl,
  }) = _AssignmentSubmission;

  factory AssignmentSubmission.fromJson(Map<String, dynamic> json) =>
      _$AssignmentSubmissionFromJson(json);
}

@freezed
class WorkshopAssignment with _$WorkshopAssignment {
  const factory WorkshopAssignment({
    required String id,
    required String title,
    @Default('qa') String assignmentType,
    String? questionText,
    @Default(true) bool canEdit,
    @Default('Answer') String ctaLabel,
    @Default('Submit') String submitLabel,
    @Default('Cancel') String cancelLabel,
    AssignmentSubmission? submission,
  }) = _WorkshopAssignment;

  factory WorkshopAssignment.fromJson(Map<String, dynamic> json) =>
      _$WorkshopAssignmentFromJson(json);
}

@freezed
class AssignmentGroup with _$AssignmentGroup {
  const factory AssignmentGroup({
    required String challengeLabel,
    required String challengeTitle,
    @Default([]) List<WorkshopAssignment> assignments,
  }) = _AssignmentGroup;

  factory AssignmentGroup.fromJson(Map<String, dynamic> json) =>
      _$AssignmentGroupFromJson(json);
}

// ── Workshop detail (GET /api/user/workshops/:slug/detail) ─────────────────────

@freezed
class WorkshopDetail with _$WorkshopDetail {
  const factory WorkshopDetail({
    required String id,
    required String title,
    String? description,
    String? thumbnailUrl,
    String? enrollmentStatus,
    String? backLabel,
    String? backUrl,
    String? workshopFlowLabel,
    WorkshopProgress? learningProgress,
    // Kept as map — fields consumed directly in CC-26+
    @JsonKey(name: 'certificate') Map<String, dynamic>? certificate,
    // Raw pass-through: backend returns `sidebar.tabs: [{ id, label, order }]`
    // (see backend workshop detail handler). Used to override the default
    // tab labels (Q&A, Assignments, etc.) at render time.
    @JsonKey(name: 'sidebar') Map<String, dynamic>? sidebar,
  }) = _WorkshopDetail;

  factory WorkshopDetail.fromJson(Map<String, dynamic> json) =>
      _$WorkshopDetailFromJson(json);
}
