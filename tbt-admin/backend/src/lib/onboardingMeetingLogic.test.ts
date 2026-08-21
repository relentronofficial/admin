import { describe, expect, it } from 'vitest';

import {
  canEditMeeting,
  canStartMeeting,
  canJoinMeeting,
  canEndMeeting,
  canCancelMeeting,
} from './onboardingMeetingLogic.js';

describe('canEditMeeting / canStartMeeting / canCancelMeeting', () => {
  it('all three only allow acting on a scheduled meeting', () => {
    for (const fn of [canEditMeeting, canStartMeeting, canCancelMeeting]) {
      expect(fn('scheduled')).toBe(true);
      expect(fn('live')).toBe(false);
      expect(fn('completed')).toBe(false);
      expect(fn('cancelled')).toBe(false);
    }
  });
});

describe('canJoinMeeting', () => {
  it('allows joining while scheduled (lazy room creation) or live', () => {
    expect(canJoinMeeting('scheduled')).toBe(true);
    expect(canJoinMeeting('live')).toBe(true);
  });

  it('blocks joining a completed or cancelled meeting', () => {
    expect(canJoinMeeting('completed')).toBe(false);
    expect(canJoinMeeting('cancelled')).toBe(false);
  });
});

describe('canEndMeeting', () => {
  it('only allows ending a meeting that has actually gone live', () => {
    expect(canEndMeeting('live')).toBe(true);
    expect(canEndMeeting('scheduled')).toBe(false);
    expect(canEndMeeting('completed')).toBe(false);
    expect(canEndMeeting('cancelled')).toBe(false);
  });
});
