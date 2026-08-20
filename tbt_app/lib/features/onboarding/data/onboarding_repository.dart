import 'package:dio/dio.dart';

import '../../../core/constants/api.dart';
import '../../../shared/api/dio_client.dart';
import '../domain/onboarding_state.dart';

/// Mirrors [BatchService]'s shape — thin Dio wrapper, no extra abstraction.
/// The presign call hits our own `/api/onboarding/documents/presign`
/// endpoint (which forces bucket/pathPrefix server-side), NOT the generic
/// `UploadService.getPresignedUrl` — see SELF_ONBOARDING_SPECKIT.md §5.3/§10.4.
class OnboardingRepository {
  OnboardingRepository(this._dio);
  final Dio _dio;

  Future<OnboardingWizardState> getState() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(kOnboarding);
      final data = res.data?['data'] as Map<String, dynamic>? ?? {};
      return OnboardingWizardState.fromJson(data);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<List<OnboardingContentStep>> getContent() async {
    try {
      final res = await _dio.get<Map<String, dynamic>>(kOnboardingContent);
      final data = (res.data?['data'] as List?) ?? [];
      return data.map((c) => OnboardingContentStep.fromJson(c as Map<String, dynamic>)).toList();
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<Map<String, dynamic>> saveProgress(Map<String, dynamic> profile) async {
    try {
      final res = await _dio.patch<Map<String, dynamic>>(kOnboarding, data: profile);
      return res.data?['data'] as Map<String, dynamic>? ?? {};
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<({String uploadUrl, String publicUrl})> presignDocument({
    required String filename,
    required String contentType,
    required String documentType,
  }) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        kOnboardingDocumentsPresign,
        data: {'filename': filename, 'contentType': contentType, 'documentType': documentType},
      );
      final data = res.data?['data'] as Map<String, dynamic>? ?? {};
      return (
        uploadUrl: (data['uploadUrl'] as String?) ?? '',
        publicUrl: (data['publicUrl'] as String?) ?? '',
      );
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<OnboardingDocument> registerDocument({
    required String documentType,
    required String documentUrl,
  }) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        kOnboardingDocuments,
        data: {'documentType': documentType, 'documentUrl': documentUrl},
      );
      final data = res.data?['data'] as Map<String, dynamic>? ?? {};
      return OnboardingDocument.fromJson(data);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> deleteDocument(String id) async {
    try {
      await _dio.delete<void>('$kOnboardingDocuments/$id');
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  Future<void> submit() async {
    try {
      await _dio.post<Map<String, dynamic>>(kOnboardingSubmit);
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }
}
