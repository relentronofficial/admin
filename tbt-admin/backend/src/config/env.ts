import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(8000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),
  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string(),
  SUPABASE_SERVICE_KEY: z.string(),
  CLERK_SECRET_KEY: z.string(),
  CLERK_PUBLISHABLE_KEY: z.string(),
  CLERK_JWKS_URL: z.string().url().optional().or(z.literal('')),
  CLERK_JWT_PUBLIC_KEY: z.string().optional().or(z.literal('')),
  UPSTASH_REDIS_URL: z.string().url().optional().or(z.literal('')),
  UPSTASH_REDIS_TOKEN: z.string().optional().or(z.literal('')),
  CLOUDFLARE_R2_ACCOUNT_ID: z.string().optional().or(z.literal('')),
  CLOUDFLARE_R2_ACCESS_KEY_ID: z.string().optional().or(z.literal('')),
  CLOUDFLARE_R2_SECRET_ACCESS_KEY: z.string().optional().or(z.literal('')),
  CLOUDFLARE_R2_BUCKET_NAME: z.string().optional().or(z.literal('')),
  BUNNY_CDN_URL: z.string().optional().or(z.literal('')),
  BUNNY_STORAGE_HOSTNAME: z.string().optional().or(z.literal('')),
  BUNNY_STORAGE_ZONE: z.string().optional().or(z.literal('')),
  BUNNY_STORAGE_ACCESS_KEY: z.string().optional().or(z.literal('')),
  BUNNY_STREAM_API_KEY: z.string().optional().or(z.literal('')),
  BUNNY_STREAM_LIBRARY_ID: z.string().optional().or(z.literal('')),
  AGORA_APP_ID: z.string().optional().or(z.literal('')),
  AGORA_APP_CERTIFICATE: z.string().optional().or(z.literal('')),
  FIREBASE_PROJECT_ID: z.string().optional().or(z.literal('')),
  FIREBASE_PRIVATE_KEY: z.string().optional().or(z.literal('')),
  FIREBASE_CLIENT_EMAIL: z.string().email().optional().or(z.literal('')),
  RESEND_API_KEY: z.string().optional().or(z.literal('')),
  TWILIO_ACCOUNT_SID: z.string().optional().or(z.literal('')),
  TWILIO_AUTH_TOKEN: z.string().optional().or(z.literal('')),
  TWILIO_PHONE_NUMBER: z.string().optional().or(z.literal('')),
  SENTRY_DSN: z.string().url().optional().or(z.literal('')),
  BETTER_STACK_SOURCE_TOKEN: z.string().optional().or(z.literal('')),
  USER_WEB_URL: z.string().url().default('http://localhost:3001'),
  ADMIN_WEB_URL: z.string().url().default('http://localhost:3000'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
  console.error('❌ Invalid environment variables:', _env.error.format());
  process.exit(1);
}

export const env = _env.data;
