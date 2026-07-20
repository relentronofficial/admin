import { z } from 'zod';

export const createPostSchema = z.object({
  memberId: z.string(),
  content: z.string().min(1),
  postType: z.enum(['post', 'announcement', 'poll']).default('post'),
  mediaUrls: z.array(z.string()).optional(),
  isPinned: z.boolean().optional(),
  isAnnouncement: z.boolean().optional(),
  isMentor: z.boolean().optional(),
  isApproved: z.boolean().optional(),
});

// Member-facing submit — memberId comes from the JWT cookie, not the
// body. Also cannot set moderation flags (defaults apply).
export const submitPostSchema = z.object({
  content: z.string().min(1).max(4000),
  mediaUrls: z.array(z.string().url()).max(4).optional(),
});

export const updatePostPinSchema = z.object({
  isPinned: z.boolean(),
});

export const approvePostSchema = z.object({
  isApproved: z.boolean(),
});
