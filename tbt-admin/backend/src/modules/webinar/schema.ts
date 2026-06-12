import { z } from 'zod';

export const createWebinarSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  hostId: z.string().optional(),
  scheduledAt: z.string(),
  durationMinutes: z.number().int().optional(),
  maxAttendees: z.number().int().optional(),
  meetingUrl: z.string().optional(),
  recordingUrl: z.string().optional(),
});

export const updateWebinarSchema = createWebinarSchema.partial();
