/**
 * Small server-side helper for direct buffer uploads to R2 (with a
 * Bunny Storage fast-path when configured — same fallback order as
 * `modules/upload/controller.ts`).
 *
 * The upload controller already does presigned-URL flows for admin
 * panel file pickers; this helper is the "buffer in hand, need a URL
 * back" case that server-side handlers hit — currently AI Content
 * Buddy image attachments, but the podcasts / ebooks / support merges
 * will use it too.
 */

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { env } from '../config/env.js';

let s3Singleton: S3Client | null = null;
function getS3(): S3Client {
  if (s3Singleton) return s3Singleton;
  s3Singleton = new S3Client({
    region: 'auto',
    endpoint: `https://${env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.CLOUDFLARE_R2_ACCESS_KEY_ID || '',
      secretAccessKey: env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '',
    },
  });
  return s3Singleton;
}

export interface UploadArgs {
  /** Logical bucket / folder prefix — e.g. "ai-content", "podcast/covers". */
  bucket: string;
  /** Object key WITHIN the R2 bucket (path + filename, no leading slash). */
  key: string;
  body: Buffer | Uint8Array;
  contentType: string;
}

/**
 * Upload a byte buffer and return a public URL. Tries Bunny Storage
 * first (fastest), falls back to R2. Throws if neither is configured
 * or both fail.
 */
export async function uploadBufferToR2(args: UploadArgs): Promise<string> {
  const { bucket, key, body, contentType } = args;
  // Namespace the key by bucket so the flat R2 bucket doesn't collide
  // across features (all our uploads share one R2 bucket; the "bucket"
  // arg is a virtual folder prefix, matching the upload controller
  // convention).
  const fullKey = `${bucket}/${key}`;

  // Primary: Bunny Storage
  if (
    env.BUNNY_STORAGE_HOSTNAME &&
    env.BUNNY_STORAGE_ZONE &&
    env.BUNNY_STORAGE_ACCESS_KEY &&
    env.BUNNY_CDN_URL
  ) {
    const url = `https://${env.BUNNY_STORAGE_HOSTNAME}/${env.BUNNY_STORAGE_ZONE}/${fullKey}`;
    const res = await fetch(url, {
      method: 'PUT',
      headers: { AccessKey: env.BUNNY_STORAGE_ACCESS_KEY, 'Content-Type': contentType },
      body: new Uint8Array(body),
    });
    if (res.ok) {
      return `https://${env.BUNNY_CDN_URL}/${fullKey}`;
    }
    // fall through to R2
  }

  // Fallback: R2
  if (
    env.CLOUDFLARE_R2_ACCOUNT_ID &&
    env.CLOUDFLARE_R2_ACCESS_KEY_ID &&
    env.CLOUDFLARE_R2_SECRET_ACCESS_KEY &&
    env.CLOUDFLARE_R2_BUCKET_NAME
  ) {
    await getS3().send(
      new PutObjectCommand({
        Bucket: env.CLOUDFLARE_R2_BUCKET_NAME,
        Key: fullKey,
        Body: body,
        ContentType: contentType,
      }),
    );
    return env.BUNNY_CDN_URL
      ? `https://${env.BUNNY_CDN_URL}/${fullKey}`
      : `https://${env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.CLOUDFLARE_R2_BUCKET_NAME}/${fullKey}`;
  }

  throw new Error('No storage service configured (Bunny Storage or R2 required).');
}
