import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/api.dart';
import '../../../core/exceptions/app_exception.dart';
import '../../../shared/api/dio_client.dart';
import '../../../shared/api/dio_provider.dart';

// ── Models ────────────────────────────────────────────────────────────────────

class TbtProgram {
  final String id;
  final String name;
  final String? description;
  final int durationDays;
  final int incubationDays;
  final String status;

  const TbtProgram({
    required this.id,
    required this.name,
    this.description,
    required this.durationDays,
    required this.incubationDays,
    required this.status,
  });

  factory TbtProgram.fromJson(Map<String, dynamic> j) => TbtProgram(
        id: j['id'] as String,
        name: j['name'] as String,
        description: j['description'] as String?,
        durationDays: j['durationDays'] as int? ?? 0,
        incubationDays: j['incubationDays'] as int? ?? 0,
        status: j['status'] as String? ?? 'active',
      );
}

class TbtProgramTask {
  final String id;
  final String title;
  final String? description;
  final int dayNumber;
  final int estimatedMinutes;
  final bool isMilestone;
  final String proofType;
  final int basePoints;

  const TbtProgramTask({
    required this.id,
    required this.title,
    this.description,
    required this.dayNumber,
    required this.estimatedMinutes,
    required this.isMilestone,
    required this.proofType,
    required this.basePoints,
  });

  factory TbtProgramTask.fromJson(Map<String, dynamic> j) => TbtProgramTask(
        id: j['id'] as String,
        title: j['title'] as String,
        description: j['description'] as String?,
        dayNumber: j['dayNumber'] as int? ?? 1,
        estimatedMinutes: j['estimatedMinutes'] as int? ?? 15,
        isMilestone: j['isMilestone'] as bool? ?? false,
        proofType: j['proofType'] as String? ?? 'watch',
        basePoints: j['basePoints'] as int? ?? 100,
      );

  int get weekNumber => ((dayNumber - 1) / 7).floor() + 1;
}

class TbtProgramDetail extends TbtProgram {
  final List<Map<String, String>> activeBatches;
  final List<TbtProgramTask> tasks;
  final bool isEnrolled;

  const TbtProgramDetail({
    required super.id,
    required super.name,
    super.description,
    required super.durationDays,
    required super.incubationDays,
    required super.status,
    required this.activeBatches,
    required this.tasks,
    required this.isEnrolled,
  });

  factory TbtProgramDetail.fromJson(Map<String, dynamic> j) =>
      TbtProgramDetail(
        id: j['id'] as String,
        name: j['name'] as String,
        description: j['description'] as String?,
        durationDays: j['durationDays'] as int? ?? 0,
        incubationDays: j['incubationDays'] as int? ?? 0,
        status: j['status'] as String? ?? 'active',
        activeBatches: (j['batches'] as List<dynamic>? ?? [])
            .map((b) => {
                  'id': b['id'] as String,
                  'name': b['name'] as String,
                })
            .toList(),
        tasks: (j['tasks'] as List<dynamic>? ?? [])
            .map((t) => TbtProgramTask.fromJson(t as Map<String, dynamic>))
            .toList(),
        isEnrolled: j['isEnrolled'] as bool? ?? false,
      );
}

// ── Service ───────────────────────────────────────────────────────────────────

class ProgramsFeatureService {
  const ProgramsFeatureService(this._dio);
  final Dio _dio;

  Future<List<TbtProgram>> listPrograms() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(kUserPrograms);
      final list = res.data?['data'] as List<dynamic>? ?? [];
      return list
          .map((e) => TbtProgram.fromJson(e as Map<String, dynamic>))
          .toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<TbtProgramDetail> getProgram(String id) async {
    try {
      final res =
          await _dio.get<Map<String, dynamic>>('$kUserPrograms/$id');
      final data = res.data?['data'] as Map<String, dynamic>?;
      if (data == null) throw const ServerException('Program not found');
      return TbtProgramDetail.fromJson(data);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> enrollInProgram(String id) async {
    try {
      await _dio.post<void>('$kUserPrograms/$id/enroll');
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }
}

final programsFeatureServiceProvider = Provider<ProgramsFeatureService>(
  (ref) => ProgramsFeatureService(ref.watch(dioProvider)),
);
