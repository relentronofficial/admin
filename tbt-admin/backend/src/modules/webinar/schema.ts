import { z } from 'zod';

export const createWebinarSchema = z.object({
  title: z.string(),
  description: z.string(),
  hostId: z.string(),
  scheduledAt: z.string(),
  duration: z.number(),
  agoraChannelId: z.string(),
});

export const updateWebinarSchema = createWebinarSchema.partial();
