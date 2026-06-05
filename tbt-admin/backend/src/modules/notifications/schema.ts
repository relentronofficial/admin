import { z } from 'zod';

export const sendNotificationSchema = z.object({
  memberId: z.string(),
  title: z.string(),
  body: z.string(),
  type: z.enum(['system', 'course', 'task', 'community', 'webinar']),
  metadata: z.any().optional(),
});

export const broadcastNotificationSchema = sendNotificationSchema.omit({ memberId: true });
