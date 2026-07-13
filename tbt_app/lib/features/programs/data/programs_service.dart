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

class TbtProgramDetail extends TbtProgram {
  final List<Map<String, String>> activeBatches;

  const TbtProgramDetail({
    required super.id,
    required super.name,
    super.description,
    required super.durationDays,
    required super.incubationDays,
    required super.status,
    required this.activeBatches,
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
}

final programsFeatureServiceProvider = Provider<ProgramsFeatureService>(
  (ref) => ProgramsFeatureService(ref.watch(dioProvider)),
);
