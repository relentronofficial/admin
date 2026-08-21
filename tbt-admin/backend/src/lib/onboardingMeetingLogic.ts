// Pure state-machine helpers for onboarding live meetings. Zero imports of
// config/env.ts or Prisma at module scope so this is unit-testable with no
// .env / database present — mirrors onboardingLogic.ts's approach.
// Design reference: ONBOARDING_LIVE_MEETING_SPECKIT.md.

export type OnboardingMeetingStatus = 'scheduled' | 'live' | 'completed' | 'cancelled';

/** Admin can edit schedule/host/participants/title/description only before
 * the meeting has actually started. */
export function canEditMeeting(status: OnboardingMeetingStatus): boolean {
  return status === 'scheduled';
}

/** Admin can manually flip a scheduled meeting to live without joining
 * (e.g. to open the room for the member ahead of the host). */
export function canStartMeeting(status: OnboardingMeetingStatus): boolean {
  return status === 'scheduled';
}

/** Members and staff may request a join token while the meeting is
 * scheduled (room is created lazily on first LiveKit connect) or already
 * live. Not once it's completed or cancelled. */
export function canJoinMeeting(status: OnboardingMeetingStatus): boolean {
  return status === 'scheduled' || status === 'live';
}

/** Admin can only end a meeting that has actually gone live. */
export function canEndMeeting(status: OnboardingMeetingStatus): boolean {
  return status === 'live';
}

/** Cancelling only makes sense before the meeting has started. */
export function canCancelMeeting(status: OnboardingMeetingStatus): boolean {
  return status === 'scheduled';
}
