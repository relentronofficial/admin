// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'batch.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$BatchTaskImpl _$$BatchTaskImplFromJson(Map<String, dynamic> json) =>
    _$BatchTaskImpl(
      id: json['id'] as String,
      title: json['title'] as String,
      type:
          $enumDecodeNullable(_$BatchTaskTypeEnumMap, json['type']) ??
          BatchTaskType.watch,
      isCompleted: json['isCompleted'] as bool? ?? false,
      proofUrl: json['proofUrl'] as String?,
    );

Map<String, dynamic> _$$BatchTaskImplToJson(_$BatchTaskImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'title': instance.title,
      'type': _$BatchTaskTypeEnumMap[instance.type]!,
      'isCompleted': instance.isCompleted,
      'proofUrl': instance.proofUrl,
    };

const _$BatchTaskTypeEnumMap = {
  BatchTaskType.watch: 'watch',
  BatchTaskType.quiz: 'quiz',
  BatchTaskType.matching: 'matching',
  BatchTaskType.written: 'written',
  BatchTaskType.flashcard: 'flashcard',
};

_$BatchDayImpl _$$BatchDayImplFromJson(Map<String, dynamic> json) =>
    _$BatchDayImpl(
      dayNumber: (json['dayNumber'] as num).toInt(),
      status:
          $enumDecodeNullable(_$BatchDayStatusEnumMap, json['status']) ??
          BatchDayStatus.notStarted,
      category: json['category'] as String?,
      title: json['title'] as String?,
      tasks:
          (json['tasks'] as List<dynamic>?)
              ?.map((e) => BatchTask.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
    );

Map<String, dynamic> _$$BatchDayImplToJson(_$BatchDayImpl instance) =>
    <String, dynamic>{
      'dayNumber': instance.dayNumber,
      'status': _$BatchDayStatusEnumMap[instance.status]!,
      'category': instance.category,
      'title': instance.title,
      'tasks': instance.tasks,
    };

const _$BatchDayStatusEnumMap = {
  BatchDayStatus.notStarted: 'not_started',
  BatchDayStatus.inProgress: 'in_progress',
  BatchDayStatus.submitted: 'submitted',
  BatchDayStatus.approved: 'approved',
  BatchDayStatus.rejected: 'rejected',
};

_$BatchInfoImpl _$$BatchInfoImplFromJson(Map<String, dynamic> json) =>
    _$BatchInfoImpl(
      id: json['id'] as String,
      name: json['name'] as String,
      startDate: json['startDate'] as String?,
      xpPerDay: (json['xpPerDay'] as num?)?.toInt() ?? 50,
      programName: json['programName'] as String?,
    );

Map<String, dynamic> _$$BatchInfoImplToJson(_$BatchInfoImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'startDate': instance.startDate,
      'xpPerDay': instance.xpPerDay,
      'programName': instance.programName,
    };

_$BatchAttendanceImpl _$$BatchAttendanceImplFromJson(
  Map<String, dynamic> json,
) => _$BatchAttendanceImpl(
  dayNumber: (json['day_number'] as num).toInt(),
  status: json['status'] as String? ?? 'present',
  notes: json['notes'] as String?,
  markedAt: json['marked_at'] as String?,
);

Map<String, dynamic> _$$BatchAttendanceImplToJson(
  _$BatchAttendanceImpl instance,
) => <String, dynamic>{
  'day_number': instance.dayNumber,
  'status': instance.status,
  'notes': instance.notes,
  'marked_at': instance.markedAt,
};

_$BatchBreakImpl _$$BatchBreakImplFromJson(Map<String, dynamic> json) =>
    _$BatchBreakImpl(
      id: json['id'] as String,
      startDay: (json['start_day'] as num).toInt(),
      endDay: (json['end_day'] as num).toInt(),
      reason: json['reason'] as String?,
      status:
          $enumDecodeNullable(_$BatchBreakStatusEnumMap, json['status']) ??
          BatchBreakStatus.pending,
      adminNote: json['admin_note'] as String?,
      createdAt: json['created_at'] as String?,
    );

Map<String, dynamic> _$$BatchBreakImplToJson(_$BatchBreakImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'start_day': instance.startDay,
      'end_day': instance.endDay,
      'reason': instance.reason,
      'status': _$BatchBreakStatusEnumMap[instance.status]!,
      'admin_note': instance.adminNote,
      'created_at': instance.createdAt,
    };

const _$BatchBreakStatusEnumMap = {
  BatchBreakStatus.pending: 'pending',
  BatchBreakStatus.approved: 'approved',
  BatchBreakStatus.rejected: 'rejected',
};

_$BatchProgramImpl _$$BatchProgramImplFromJson(Map<String, dynamic> json) =>
    _$BatchProgramImpl(
      batch: BatchInfo.fromJson(json['batch'] as Map<String, dynamic>),
      totalDays: (json['totalDays'] as num).toInt(),
      days:
          (json['days'] as List<dynamic>?)
              ?.map((e) => BatchDay.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      attendance:
          (json['attendance'] as List<dynamic>?)
              ?.map((e) => BatchAttendance.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
      breaks:
          (json['breaks'] as List<dynamic>?)
              ?.map((e) => BatchBreak.fromJson(e as Map<String, dynamic>))
              .toList() ??
          const [],
    );

Map<String, dynamic> _$$BatchProgramImplToJson(_$BatchProgramImpl instance) =>
    <String, dynamic>{
      'batch': instance.batch,
      'totalDays': instance.totalDays,
      'days': instance.days,
      'attendance': instance.attendance,
      'breaks': instance.breaks,
    };
