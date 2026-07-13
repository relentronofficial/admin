import 'package:freezed_annotation/freezed_annotation.dart';

import '../../features/auth/domain/member_status.dart';

part 'member.freezed.dart';
part 'member.g.dart';

@freezed
class Member with _$Member {
  const factory Member({
    required String id,
    required String name,
    String? email,
    required String phone,
    @Default(MemberStatus.active) @_MemberStatusConverter() MemberStatus status,
    @Default('free') String membershipPlan,
    String? avatarUrl,
    String? batchId,
  }) = _Member;

  factory Member.fromJson(Map<String, dynamic> json) => _$MemberFromJson(json);
}

// JsonConverter used by json_serializable — decodes 'active' → MemberStatus.active.
class _MemberStatusConverter
    implements JsonConverter<MemberStatus, String?> {
  const _MemberStatusConverter();

  @override
  MemberStatus fromJson(String? json) => MemberStatusConverter.fromJson(json);

  @override
  String toJson(MemberStatus s) => MemberStatusConverter.toJson(s);
}
