import 'dart:typed_data';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/constants/api.dart';
import '../../../shared/api/dio_provider.dart';
import '../../../shared/api/upload_service.dart';
import '../../../shared/providers/me_provider.dart';

/// Updates [firstName] / [lastName] via PATCH /api/user/me.
/// Splits [name] on first space so it works as a single-field form.
Future<void> updateProfileName(WidgetRef ref, String name) async {
  final parts = name.trim().split(' ');
  final firstName = parts.first;
  final lastName = parts.length > 1 ? parts.sublist(1).join(' ') : null;

  final body = <String, dynamic>{'firstName': firstName};
  if (lastName != null) body['lastName'] = lastName;

  await ref.read(dioProvider).patch<dynamic>(kUserMe, data: body);
  ref.invalidate(meNotifierProvider);
}

/// PATCHes an arbitrary field bag against /api/user/me. Only non-empty
/// entries are sent so existing values aren't accidentally cleared.
Future<void> updateProfileFields(
    WidgetRef ref, Map<String, String?> fields) async {
  final body = <String, dynamic>{};
  fields.forEach((k, v) {
    if (v != null && v.isNotEmpty) body[k] = v;
  });
  if (body.isEmpty) return;
  await ref.read(dioProvider).patch<dynamic>(kUserMe, data: body);
  ref.invalidate(meNotifierProvider);
}

/// Fetches the raw member JSON via GET /api/user/me. Used to pre-fill the
/// extended edit form with fields not currently exposed in [Member].
Future<Map<String, dynamic>> fetchRawProfile(WidgetRef ref) async {
  final res = await ref.read(dioProvider).get<Map<String, dynamic>>(kUserMe);
  return (res.data?['data'] as Map<String, dynamic>?) ?? {};
}

/// Uploads [bytes] to R2 and patches the member's avatarUrl.
Future<String> uploadAvatar(
  WidgetRef ref,
  Uint8List bytes,
  String filename,
  String contentType,
) async {
  final svc = ref.read(uploadServiceProvider);
  final (:uploadUrl, :publicUrl) = await svc.getPresignedUrl(
    filename: filename,
    contentType: contentType,
    bucket: 'member-avatars',
    pathPrefix: 'avatars',
  );
  await svc.uploadToR2(
      uploadUrl: uploadUrl, bytes: bytes, contentType: contentType);

  await ref.read(dioProvider).patch<dynamic>(
    '$kUserMe/avatar',
    data: {'avatarUrl': publicUrl},
  );
  ref.invalidate(meNotifierProvider);
  return publicUrl;
}
