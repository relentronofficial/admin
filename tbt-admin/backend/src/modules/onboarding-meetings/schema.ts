import { z } from 'zod';

// Admin-authored create/update — mirrors the create/edit fields listed in
// ONBOARDING_LIVE_MEETING_SPECKIT.md. `participantMemberIds` covers any
// additional members invited beyond the onboarding subject themselves (e.g.
// a co-founder); `participantAdminIds` covers any staff beyond the host.
export const createOnboardingMeetingSchema = z.object({
  memberId: z.string().uuid(),
  hostAdminId: z.string().uuid().optional(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  scheduledAt: z.string().min(1),
  durationMinutes: z.number().int().min(5).max(240).optional(),
  participantMemberIds: z.array(z.string().uuid()).optional(),
  participantAdminIds: z.array(z.string().uuid()).optional(),
});

export const updateOnboardingMeetingSchema = z.object({
  hostAdminId: z.string().uuid().nullable().optional(),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  scheduledAt: z.string().min(1).optional(),
  durationMinutes: z.number().int().min(5).max(240).optional(),
  participantMemberIds: z.array(z.string().uuid()).optional(),
  participantAdminIds: z.array(z.string().uuid()).optional(),
});

export const cancelOnboardingMeetingSchema = z.object({
  reason: z.string().min(1),
});
