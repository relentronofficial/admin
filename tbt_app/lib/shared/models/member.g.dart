// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'member.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

_$MemberImpl _$$MemberImplFromJson(Map<String, dynamic> json) => _$MemberImpl(
  id: json['id'] as String,
  name: json['name'] as String,
  email: json['email'] as String?,
  phone: json['phone'] as String,
  status:
      json['status'] == null
          ? MemberStatus.active
          : const _MemberStatusConverter().fromJson(json['status'] as String?),
  membershipPlan: json['membershipPlan'] as String? ?? 'free',
  avatarUrl: json['avatarUrl'] as String?,
  batchId: json['batchId'] as String?,
);

Map<String, dynamic> _$$MemberImplToJson(_$MemberImpl instance) =>
    <String, dynamic>{
      'id': instance.id,
      'name': instance.name,
      'email': instance.email,
      'phone': instance.phone,
      'status': const _MemberStatusConverter().toJson(instance.status),
      'membershipPlan': instance.membershipPlan,
      'avatarUrl': instance.avatarUrl,
      'batchId': instance.batchId,
    };
