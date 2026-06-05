import { z } from 'zod';

export const verifyTokenSchema = z.object({
  token: z.string(),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string(),
});
