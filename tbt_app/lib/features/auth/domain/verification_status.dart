/// Mirrors the `VerificationStatus` DB enum:
/// awaiting_kyc|under_review|verified|rejected|changes_requested.
/// See SELF_ONBOARDING_SPECKIT.md §3.1 / §6.
enum VerificationStatus {
  awaitingKyc,
  underReview,
  verified,
  rejected,
  changesRequested;
}

/// Hand-rolled string converter — mirrors [MemberStatusConverter]'s pattern,
/// avoids requiring a part file on this enum.
class VerificationStatusConverter {
  const VerificationStatusConverter._();

  static VerificationStatus fromJson(String? value) => switch (value) {
        'under_review' => VerificationStatus.underReview,
        'verified' => VerificationStatus.verified,
        'rejected' => VerificationStatus.rejected,
        'changes_requested' => VerificationStatus.changesRequested,
        _ => VerificationStatus.awaitingKyc,
      };

  static String toJson(VerificationStatus s) => switch (s) {
        VerificationStatus.awaitingKyc => 'awaiting_kyc',
        VerificationStatus.underReview => 'under_review',
        VerificationStatus.verified => 'verified',
        VerificationStatus.rejected => 'rejected',
        VerificationStatus.changesRequested => 'changes_requested',
      };
}
