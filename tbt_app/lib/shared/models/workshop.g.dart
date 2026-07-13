// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'workshop.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$WorkshopImpl _$$WorkshopImplFromJson(Map<String, dynamic> json) =>
    _$WorkshopImpl(
      id: json['id'] as String,
      slug: json['slug'] as String,
      title: json['title'] as String,
      description: json['description'] as String?,
      thumbnailUrl: json['thumbnailUrl'] as String?,
      deliveryMode: $enumDecode(_$DeliveryModeEnumMap, json['deliveryMode']),
      deliveryModeLabel: json['deliveryModeLabel'] as String?,
      locked: json['locked'] as bool? ?? false,
      enrollmentStatus: json['enrollmentStatus'] as String?,
      challengeCount: (json['challengeCount'] as num?)?.toInt() ?? 0,
      batchIds:
          (json['batchIds'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList(),
    );

Map<String, dynamic> _$$WorkshopImplToJson(_$WorkshopImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'slug': instance.slug,
      'title': instance.title,
      'description': instance.description,
      'thumbnailUrl': instance.thumbnailUrl,
      'deliveryMode': _$DeliveryModeEnumMap[instance.deliveryMode]!,
      'deliveryModeLabel': instance.deliveryModeLabel,
      'locked': instance.locked,
      'enrollmentStatus': instance.enrollmentStatus,
      'challengeCount': instance.challengeCount,
      'batchIds': instance.batchIds,
    };

const _$DeliveryModeEnumMap = {
  DeliveryMode.online: 'online',
  DeliveryMode.offline: 'offline',
  DeliveryMode.hybrid: 'hybrid',
};

_$WorkshopProgressImpl _$$WorkshopProgressImplFromJson(
  Map<String, dynamic> json,
) => _$WorkshopProgressImpl(
  label: json['label'] as String?,
  percentage: (json['percentage'] as num?)?.toInt() ?? 0,
  completedCount: (json['completedCount'] as num?)?.toInt() ?? 0,
  totalCount: (json['totalCount'] as num?)?.toInt() ?? 0,
);

Map<String, dynamic> _$$WorkshopProgressImplToJson(
  _$WorkshopProgressImpl instance,
) => <String, dynamic>{
  'label': instance.label,
  'percentage': instance.percentage,
  'completedCount': instance.completedCount,
  'totalCount': instance.totalCount,
};

_$FlowEpisodeImpl _$$FlowEpisodeImplFromJson(Map<String, dynamic> json) =>
    _$FlowEpisodeImpl(
      id: json['id'] as String,
      order: (json['order'] as num?)?.toInt() ?? 0,
      title: json['title'] as String,
      type: json['type'] as String? ?? 'video',
      isCompleted: json['isCompleted'] as bool? ?? false,
      isLocked: json['isLocked'] as bool? ?? false,
      durationSeconds: (json['durationSeconds'] as num?)?.toInt(),
      durationLabel: json['durationLabel'] as String?,
    );

Map<String, dynamic> _$$FlowEpisodeImplToJson(_$FlowEpisodeImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'order': instance.order,
      'title': instance.title,
      'type': instance.type,
      'isCompleted': instance.isCompleted,
      'isLocked': instance.isLocked,
      'durationSeconds': instance.durationSeconds,
      'durationLabel': instance.durationLabel,
    };

_$FlowItemImpl _$$FlowItemImplFromJson(Map<String, dynamic> json) =>
    _$FlowItemImpl(
      id: json['id'] as String,
      order: (json['order'] as num?)?.toInt() ?? 0,
      type: json['type'] as String? ?? 'custom',
      title: json['title'] as String?,
      label: json['label'] as String?,
      description: json['description'] as String?,
      isCompleted: json['isCompleted'] as bool? ?? false,
      challengeNumber: (json['challengeNumber'] as num?)?.toInt(),
      numberLabel: json['numberLabel'] as String?,
      numberColor: json['numberColor'] as String?,
      progressPercent: (json['progressPercent'] as num?)?.toInt() ?? 0,
      episodes:
          (json['episodes'] as List<dynamic>?)
              ?.map((e) => FlowEpisode.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      liveCallId: json['liveCallId'] as String?,
      labelColor: json['labelColor'] as String?,
      scheduledAt: json['scheduledAt'] as String?,
      status: json['status'] as String?,
      isUnlocked: json['isUnlocked'] as bool? ?? false,
      recordingAvailable: json['recordingAvailable'] as bool? ?? false,
      recordingLabel: json['recordingLabel'] as String?,
      prerequisiteNote: json['prerequisiteNote'] as String?,
      externalMeetingUrl: json['externalMeetingUrl'] as String?,
      externalMeetingProvider: json['externalMeetingProvider'] as String?,
      aiSummary: json['aiSummary'] as String?,
    );

Map<String, dynamic> _$$FlowItemImplToJson(_$FlowItemImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'order': instance.order,
      'type': instance.type,
      'title': instance.title,
      'label': instance.label,
      'description': instance.description,
      'isCompleted': instance.isCompleted,
      'challengeNumber': instance.challengeNumber,
      'numberLabel': instance.numberLabel,
      'numberColor': instance.numberColor,
      'progressPercent': instance.progressPercent,
      'episodes': instance.episodes,
      'liveCallId': instance.liveCallId,
      'labelColor': instance.labelColor,
      'scheduledAt': instance.scheduledAt,
      'status': instance.status,
      'isUnlocked': instance.isUnlocked,
      'recordingAvailable': instance.recordingAvailable,
      'recordingLabel': instance.recordingLabel,
      'prerequisiteNote': instance.prerequisiteNote,
      'externalMeetingUrl': instance.externalMeetingUrl,
      'externalMeetingProvider': instance.externalMeetingProvider,
      'aiSummary': instance.aiSummary,
    };

_$QaAuthorImpl _$$QaAuthorImplFromJson(Map<String, dynamic> json) =>
    _$QaAuthorImpl(
      name: json['name'] as String,
      avatarUrl: json['avatarUrl'] as String?,
    );

Map<String, dynamic> _$$QaAuthorImplToJson(_$QaAuthorImpl instance) =>
    <String, dynamic>{'name': instance.name, 'avatarUrl': instance.avatarUrl};

_$QaReplyImpl _$$QaReplyImplFromJson(Map<String, dynamic> json) =>
    _$QaReplyImpl(
      id: json['id'] as String,
      author: QaAuthor.fromJson(json['author'] as Map<String, dynamic>),
      timeAgo: json['timeAgo'] as String,
      replyText: json['replyText'] as String,
    );

Map<String, dynamic> _$$QaReplyImplToJson(_$QaReplyImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'author': instance.author,
      'timeAgo': instance.timeAgo,
      'replyText': instance.replyText,
    };

_$QaPostImpl _$$QaPostImplFromJson(Map<String, dynamic> json) => _$QaPostImpl(
  id: json['id'] as String,
  author: QaAuthor.fromJson(json['author'] as Map<String, dynamic>),
  timeAgo: json['timeAgo'] as String,
  questionText: json['questionText'] as String,
  replyLabel: json['replyLabel'] as String? ?? 'Reply',
  replies:
      (json['replies'] as List<dynamic>?)
          ?.map((e) => QaReply.fromJson(e as Map<String, dynamic>))
          .toList() ??
      const [],
);

Map<String, dynamic> _$$QaPostImplToJson(_$QaPostImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'author': instance.author,
      'timeAgo': instance.timeAgo,
      'questionText': instance.questionText,
      'replyLabel': instance.replyLabel,
      'replies': instance.replies,
    };

_$WorkshopQaDataImpl _$$WorkshopQaDataImplFromJson(Map<String, dynamic> json) =>
    _$WorkshopQaDataImpl(
      heading: json['heading'] as String? ?? 'Do you have any questions?',
      promptText: json['promptText'] as String? ?? '',
      inputPlaceholder:
          json['inputPlaceholder'] as String? ?? 'Type your question here...',
      submitLabel: json['submitLabel'] as String? ?? 'Ask Now',
      communityHeading:
          json['communityHeading'] as String? ?? 'Community Questions',
      posts:
          (json['posts'] as List<dynamic>?)
              ?.map((e) => QaPost.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
    );

Map<String, dynamic> _$$WorkshopQaDataImplToJson(
  _$WorkshopQaDataImpl instance,
) => <String, dynamic>{
  'heading': instance.heading,
  'promptText': instance.promptText,
  'inputPlaceholder': instance.inputPlaceholder,
  'submitLabel': instance.submitLabel,
  'communityHeading': instance.communityHeading,
  'posts': instance.posts,
};

_$AssignmentSubmissionImpl _$$AssignmentSubmissionImplFromJson(
  Map<String, dynamic> json,
) => _$AssignmentSubmissionImpl(
  isSubmitted: json['isSubmitted'] as bool? ?? false,
  submittedAt: json['submittedAt'] as String?,
  answerText: json['answerText'] as String?,
  imageUrl: json['imageUrl'] as String?,
  fileUrl: json['fileUrl'] as String?,
  videoId: json['videoId'] as String?,
  videoUrl: json['videoUrl'] as String?,
);

Map<String, dynamic> _$$AssignmentSubmissionImplToJson(
  _$AssignmentSubmissionImpl instance,
) => <String, dynamic>{
  'isSubmitted': instance.isSubmitted,
  'submittedAt': instance.submittedAt,
  'answerText': instance.answerText,
  'imageUrl': instance.imageUrl,
  'fileUrl': instance.fileUrl,
  'videoId': instance.videoId,
  'videoUrl': instance.videoUrl,
};

_$WorkshopAssignmentImpl _$$WorkshopAssignmentImplFromJson(
  Map<String, dynamic> json,
) => _$WorkshopAssignmentImpl(
  id: json['id'] as String,
  title: json['title'] as String,
  assignmentType: json['assignmentType'] as String? ?? 'qa',
  questionText: json['questionText'] as String?,
  canEdit: json['canEdit'] as bool? ?? true,
  ctaLabel: json['ctaLabel'] as String? ?? 'Answer',
  submitLabel: json['submitLabel'] as String? ?? 'Submit',
  cancelLabel: json['cancelLabel'] as String? ?? 'Cancel',
  submission:
      json['submission'] == null
          ? null
          : AssignmentSubmission.fromJson(
            json['submission'] as Map<String, dynamic>,
          ),
);

Map<String, dynamic> _$$WorkshopAssignmentImplToJson(
  _$WorkshopAssignmentImpl instance,
) => <String, dynamic>{
  'id': instance.id,
  'title': instance.title,
  'assignmentType': instance.assignmentType,
  'questionText': instance.questionText,
  'canEdit': instance.canEdit,
  'ctaLabel': instance.ctaLabel,
  'submitLabel': instance.submitLabel,
  'cancelLabel': instance.cancelLabel,
  'submission': instance.submission,
};

_$AssignmentGroupImpl _$$AssignmentGroupImplFromJson(
  Map<String, dynamic> json,
) => _$AssignmentGroupImpl(
  challengeLabel: json['challengeLabel'] as String,
  challengeTitle: json['challengeTitle'] as String,
  assignments:
      (json['assignments'] as List<dynamic>?)
          ?.map((e) => WorkshopAssignment.fromJson(e as Map<String, dynamic>))
          .toList() ??
      const [],
);

Map<String, dynamic> _$$AssignmentGroupImplToJson(
  _$AssignmentGroupImpl instance,
) => <String, dynamic>{
  'challengeLabel': instance.challengeLabel,
  'challengeTitle': instance.challengeTitle,
  'assignments': instance.assignments,
};

_$WorkshopDetailImpl _$$WorkshopDetailImplFromJson(Map<String, dynamic> json) =>
    _$WorkshopDetailImpl(
      id: json['id'] as String,
      title: json['title'] as String,
      description: json['description'] as String?,
      thumbnailUrl: json['thumbnailUrl'] as String?,
      enrollmentStatus: json['enrollmentStatus'] as String?,
      backLabel: json['backLabel'] as String?,
      backUrl: json['backUrl'] as String?,
      workshopFlowLabel: json['workshopFlowLabel'] as String?,
      learningProgress:
          json['learningProgress'] == null
              ? null
              : WorkshopProgress.fromJson(
                json['learningProgress'] as Map<String, dynamic>,
              ),
      certificate: json['certificate'] as Map<String, dynamic>?,
    );

Map<String, dynamic> _$$WorkshopDetailImplToJson(
  _$WorkshopDetailImpl instance,
) => <String, dynamic>{
  'id': instance.id,
  'title': instance.title,
  'description': instance.description,
  'thumbnailUrl': instance.thumbnailUrl,
  'enrollmentStatus': instance.enrollmentStatus,
  'backLabel': instance.backLabel,
  'backUrl': instance.backUrl,
  'workshopFlowLabel': instance.workshopFlowLabel,
  'learningProgress': instance.learningProgress,
  'certificate': instance.certificate,
};
