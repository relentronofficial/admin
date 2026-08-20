/// Plain (non-freezed) models for the self-onboarding wizard — mirrors the
/// [BatchTaskMeta] precedent in batch_program: simple data classes are fine
/// here, no need to block on codegen for a straightforward response shape.
/// See SELF_ONBOARDING_SPECKIT.md §10.1.
library;

class OnboardingDocument {
  const OnboardingDocument({
    required this.id,
    required this.documentType,
    required this.documentUrl,
    required this.status,
  });

  final String id;
  final String documentType;
  final String documentUrl;
  final String status;

  factory OnboardingDocument.fromJson(Map<String, dynamic> json) => OnboardingDocument(
        id: json['id'] as String,
        documentType: json['documentType'] as String,
        documentUrl: json['documentUrl'] as String,
        status: json['status'] as String,
      );
}

class OnboardingWizardState {
  const OnboardingWizardState({
    required this.status,
    required this.verificationStatus,
    required this.onboardingCompleted,
    required this.onboardingSubmittedAt,
    required this.onboardingReviewNote,
    required this.profile,
    required this.documents,
  });

  final String status;
  final String verificationStatus;
  final bool onboardingCompleted;
  final String? onboardingSubmittedAt;
  final String? onboardingReviewNote;
  final Map<String, dynamic> profile;
  final List<OnboardingDocument> documents;

  factory OnboardingWizardState.fromJson(Map<String, dynamic> json) => OnboardingWizardState(
        status: json['status'] as String,
        verificationStatus: json['verificationStatus'] as String,
        onboardingCompleted: json['onboardingCompleted'] as bool? ?? false,
        onboardingSubmittedAt: json['onboardingSubmittedAt'] as String?,
        onboardingReviewNote: json['onboardingReviewNote'] as String?,
        profile: Map<String, dynamic>.from(json['profile'] as Map? ?? {}),
        documents: ((json['documents'] as List?) ?? [])
            .map((d) => OnboardingDocument.fromJson(d as Map<String, dynamic>))
            .toList(),
      );
}

class OnboardingContentStep {
  const OnboardingContentStep({
    required this.id,
    required this.stepKey,
    required this.title,
    this.textBody,
    this.videoUrl,
    this.audioUrl,
    this.imageUrl,
    this.lottieUrl,
    this.quizData,
    this.isActive,
  });

  final String id;
  final String stepKey;
  final String title;
  final String? textBody;
  final String? videoUrl;
  final String? audioUrl;
  final String? imageUrl;
  final String? lottieUrl;
  final Map<String, dynamic>? quizData;
  final bool? isActive;

  factory OnboardingContentStep.fromJson(Map<String, dynamic> json) => OnboardingContentStep(
        id: json['id'] as String,
        stepKey: json['stepKey'] as String,
        title: json['title'] as String,
        textBody: json['textBody'] as String?,
        videoUrl: json['videoUrl'] as String?,
        audioUrl: json['audioUrl'] as String?,
        imageUrl: json['imageUrl'] as String?,
        lottieUrl: json['lottieUrl'] as String?,
        quizData: json['quizData'] != null
            ? Map<String, dynamic>.from(json['quizData'] as Map)
            : null,
        isActive: json['isActive'] as bool?,
      );
}
