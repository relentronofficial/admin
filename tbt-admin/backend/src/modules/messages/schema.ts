import { z } from 'zod';

export const sendMessageSchema = z.object({
  memberId: z.string().uuid(),
  subject:  z.string().min(1).max(200),
  body:     z.string().min(1).max(5000),
});

export type SendMessageBody = z.infer<typeof sendMessageSchema>;
