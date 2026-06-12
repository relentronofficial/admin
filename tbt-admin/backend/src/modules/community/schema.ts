import { z } from 'zod';

export const createPostSchema = z.object({
  memberId: z.string(),
  content: z.string().min(1),
  postType: z.enum(['post', 'announcement', 'poll']).default('post'),
  mediaUrls: z.array(z.string()).optional(),
  isPinned: z.boolean().optional(),
  isAnnouncement: z.boolean().optional(),
});

export const updatePostPinSchema = z.object({
  isPinned: z.boolean(),
});
