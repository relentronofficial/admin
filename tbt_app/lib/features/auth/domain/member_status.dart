/// Mirrors the `MemberStatus` DB enum: active|inactive|paused|suspended|pending.
enum MemberStatus {
  active,
  inactive,
  paused,
  suspended,
  pending;
}

/// Hand-rolled string converter — avoids requiring a part file on this enum.
class MemberStatusConverter {
  const MemberStatusConverter._();

  static MemberStatus fromJson(String? value) => switch (value) {
        'inactive' => MemberStatus.inactive,
        'paused' => MemberStatus.paused,
        'suspended' => MemberStatus.suspended,
        'pending' => MemberStatus.pending,
        _ => MemberStatus.active,
      };

  static String toJson(MemberStatus s) => s.name;
}
