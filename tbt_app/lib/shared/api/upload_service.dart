import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:image_picker/image_picker.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod_annotation/riverpod_annotation.dart';

import '../../core/constants/api.dart';
import 'dio_client.dart';
import 'dio_provider.dart';

part 'upload_service.g.dart';

// ── Result types ──────────────────────────────────────────────────────────────

class UploadResult {
  const UploadResult({required this.publicUrl, required this.filename});
  final String publicUrl;
  final String filename;
}

// ── Service ───────────────────────────────────────────────────────────────────

class UploadService {
  const UploadService(this._dio);
  final Dio _dio;

  /// Requests a presigned R2 URL from the backend.
  Future<({String uploadUrl, String publicUrl})> getPresignedUrl({
    required String filename,
    required String contentType,
    required String bucket,
    required String pathPrefix,
  }) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        kUploadPresignedUrl,
        data: {
          'filename': filename,
          'contentType': contentType,
          'bucket': bucket,
          'pathPrefix': pathPrefix,
        },
      );
      final data = res.data ?? {};
      return (
        uploadUrl: (data['uploadUrl'] as String?) ?? '',
        publicUrl: (data['publicUrl'] as String?) ?? '',
      );
    } on DioException catch (e) {
      throw mapDioError(e);
    }
  }

  /// PUTs [bytes] directly to the R2 presigned URL — bypasses the app's Dio
  /// instance (and its auth interceptors) by using a fresh, bare [Dio].
  Future<void> uploadToR2({
    required String uploadUrl,
    required Uint8List bytes,
    required String contentType,
  }) async {
    final r2 = Dio();
    try {
      await r2.put<dynamic>(
        uploadUrl,
        data: Stream.fromIterable([bytes]),
        options: Options(
          sendTimeout: const Duration(minutes: 5),
          headers: {
            'Content-Type': contentType,
            'Content-Length': bytes.length,
          },
        ),
      );
    } on DioException catch (e) {
      throw mapDioError(e);
    } finally {
      r2.close();
    }
  }

  /// Full pick → presign → upload flow.
  ///
  /// Pass `allowedTypes: ['image']` to open the image gallery via
  /// [ImagePicker]; any other list (e.g. `['pdf', 'doc']` or `['*']`) opens
  /// the system file picker via [FilePicker].
  ///
  /// Returns `null` if the user cancelled the picker.
  Future<UploadResult?> pickAndUpload({
    required String bucket,
    required String pathPrefix,
    List<String> allowedTypes = const ['*'],
  }) async {
    final bool imagesOnly =
        allowedTypes.length == 1 && allowedTypes.first == 'image';

    String filename;
    String contentType;
    Uint8List bytes;

    if (imagesOnly) {
      final picked = await ImagePicker().pickImage(
        source: ImageSource.gallery,
        imageQuality: 90,
      );
      if (picked == null) return null;
      filename = picked.name;
      contentType = guessContentType(filename);
      bytes = await picked.readAsBytes();
    } else {
      final extensions = allowedTypes.contains('*') ? null : allowedTypes;
      final result = await FilePicker.platform.pickFiles(
        type: extensions == null ? FileType.any : FileType.custom,
        allowedExtensions: extensions,
        allowMultiple: false,
      );
      if (result == null || result.files.isEmpty) return null;
      final file = result.files.single;
      filename = file.name;
      contentType = guessContentType(filename);
      bytes = file.bytes ?? await file.xFile.readAsBytes();
    }

    final (:uploadUrl, :publicUrl) = await getPresignedUrl(
      filename: filename,
      contentType: contentType,
      bucket: bucket,
      pathPrefix: pathPrefix,
    );
    await uploadToR2(
        uploadUrl: uploadUrl, bytes: bytes, contentType: contentType);
    return UploadResult(publicUrl: publicUrl, filename: filename);
  }

  /// Maps a file extension to a MIME type.
  static String guessContentType(String filename) {
    final ext = filename.split('.').last.toLowerCase();
    return switch (ext) {
      'jpg' || 'jpeg' => 'image/jpeg',
      'png' => 'image/png',
      'webp' => 'image/webp',
      'gif' => 'image/gif',
      'pdf' => 'application/pdf',
      'mp4' => 'video/mp4',
      'mov' => 'video/quicktime',
      'doc' => 'application/msword',
      'docx' =>
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls' => 'application/vnd.ms-excel',
      'xlsx' =>
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'zip' => 'application/zip',
      _ => 'application/octet-stream',
    };
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

@riverpod
UploadService uploadService(Ref ref) => UploadService(ref.watch(dioProvider));
