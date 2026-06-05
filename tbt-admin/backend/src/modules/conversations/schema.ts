import { z } from 'zod';

export const sendAdminMessageSchema = z.object({
  body: z.string().min(1).max(5000),
});

export type SendAdminMessageBody = z.infer<typeof sendAdminMessageSchema>;
