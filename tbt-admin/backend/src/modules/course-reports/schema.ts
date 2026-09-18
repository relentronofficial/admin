import { z } from 'zod';

export const createOrSendReportSchema = z.object({
  memberId: z.string().uuid(),
  courseId: z.string().uuid(),
  remarks: z.string().max(2000).optional().nullable(),
  force: z.boolean().optional(),
});

export const updateRemarksSchema = z.object({
  remarks: z.string().max(2000).nullable(),
});

export const feedbackStatusSchema = z.enum(['new', 'reviewed']);

export const updateFeedbackStatusSchema = z.object({
  status: feedbackStatusSchema,
});

export const submitFeedbackSchema = z.object({
  courseId: z.string().uuid(),
  feedback: z.string().min(1).max(4000),
  remarks: z.string().max(2000).optional().nullable(),
});

export const submitEpisodeFeedbackSchema = z.object({
  courseId: z.string().uuid(),
  episodeId: z.string().uuid(),
  feedback: z.string().trim().min(1, 'Feedback is required').max(4000),
});
