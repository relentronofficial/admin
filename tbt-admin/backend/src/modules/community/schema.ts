import { z } from 'zod';

export const createPostSchema = z.object({
  content: z.string(),
  mediaUrls: z.array(z.string()).optional(),
  type: z.enum(['Post', 'Announcement', 'Poll']),
});

export const updatePostPinSchema = z.object({
  isPinned: z.boolean(),
});
