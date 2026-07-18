import { z } from 'zod';

// Categories match the DB CHECK constraint on saved_ai_content.category
// exactly — if this ever drifts the DB insert will 500, so keep them
// in lock-step with the startup SQL in plugins/prisma.ts.
export const SAVED_CATEGORIES = [
  'social_media',
  'advertisement',
  'business',
  'personal',
  'video_script',
  'email',
  'other',
] as const;

export const generateContentSchema = z.object({
  message: z.string().optional(),
  conversationId: z.string().uuid().optional(),
  inputType: z.enum(['text', 'voice', 'image']).optional(),
  contentType: z.string().optional(),
  tone: z.string().optional(),
  language: z.string().optional(),
  length: z.string().optional(),
  // image is passed as base64 in the JSON body (no multipart in this
  // route — the Flutter/user-web clients already resize + encode
  // locally). Cap 2 MB decoded, matching the co-worker's spec.
  imageBase64: z.string().optional(),
  imageMimeType: z.string().optional(),
});

export const renameConversationSchema = z.object({
  title: z.string().min(1).max(120),
});

export const saveContentSchema = z.object({
  conversationId: z.string().uuid().optional().nullable(),
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  category: z.enum(SAVED_CATEGORIES).default('other'),
});

export const updateSavedContentSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
  category: z.enum(SAVED_CATEGORIES).optional(),
});
