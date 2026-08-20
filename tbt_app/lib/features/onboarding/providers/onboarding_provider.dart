import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../shared/api/dio_provider.dart';
import '../data/onboarding_repository.dart';
import '../data/onboarding_meetings_repository.dart';
import '../domain/onboarding_state.dart';
import '../domain/onboarding_meeting.dart';

// Plain (non-generated) providers — mirrors the batchServiceProvider /
// uploadServiceProvider manual-Provider precedent, keeps this feature free
// of extra build_runner surface beyond the Member model change it already
// needed. See SELF_ONBOARDING_SPECKIT.md §10.2.

final onboardingRepositoryProvider = Provider<OnboardingRepository>(
  (ref) => OnboardingRepository(ref.watch(dioProvider)),
);

final onboardingStateProvider = FutureProvider.autoDispose<OnboardingWizardState>(
  (ref) => ref.watch(onboardingRepositoryProvider).getState(),
);

final onboardingContentProvider = FutureProvider.autoDispose<List<OnboardingContentStep>>(
  (ref) => ref.watch(onboardingRepositoryProvider).getContent(),
);

final onboardingMeetingsRepositoryProvider = Provider<OnboardingMeetingsRepository>(
  (ref) => OnboardingMeetingsRepository(ref.watch(dioProvider)),
);

final onboardingMeetingsProvider = FutureProvider.autoDispose<List<OnboardingMeeting>>(
  (ref) => ref.watch(onboardingMeetingsRepositoryProvider).listMine(),
);
