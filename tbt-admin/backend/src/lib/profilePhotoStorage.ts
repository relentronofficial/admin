// Stores a validated profile photo: Bunny Storage first, Cloudflare R2 as the
// fallback. Shared by the onboarding upload (signed-in member) and the sign-up
// upload (before the account exists). Returns the public URL, or undefined when
// no storage service accepted the file.

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { env } from '../config/env.js';
import type { ProfilePhotoType } from './onboardingLogic.js';

type Log = { warn: (msg: string) => void; error: (msg: string) => void };

export async function storeProfilePhoto(
  log: Log,
  key: string,
  body: Buffer,
  photoType: ProfilePhotoType,
): Promise<string | undefined> {
  let publicUrl: string | undefined;

  // Primary: Bunny Storage
  if (env.BUNNY_STORAGE_HOSTNAME && env.BUNNY_STORAGE_ZONE && env.BUNNY_STORAGE_ACCESS_KEY && env.BUNNY_CDN_URL) {
    try {
      const res = await fetch(`https://${env.BUNNY_STORAGE_HOSTNAME}/${env.BUNNY_STORAGE_ZONE}/${key}`, {
        method: 'PUT',
        headers: { AccessKey: env.BUNNY_STORAGE_ACCESS_KEY, 'Content-Type': `image/${photoType}` },
        body: new Uint8Array(body),
      });
      if (res.ok) {
        publicUrl = `https://${env.BUNNY_CDN_URL}/${key}`;
      } else {
        log.warn(`Bunny profile photo upload [${res.status}] – trying R2`);
      }
    } catch (e: any) {
      log.warn(`Bunny profile photo upload error – trying R2: ${e.message}`);
    }
  }

  // Fallback: R2
  if (!publicUrl && env.CLOUDFLARE_R2_ACCOUNT_ID && env.CLOUDFLARE_R2_ACCESS_KEY_ID && env.CLOUDFLARE_R2_SECRET_ACCESS_KEY && env.CLOUDFLARE_R2_BUCKET_NAME) {
    try {
      const s3 = new S3Client({
        region: 'auto',
        endpoint: `https://${env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId: env.CLOUDFLARE_R2_ACCESS_KEY_ID, secretAccessKey: env.CLOUDFLARE_R2_SECRET_ACCESS_KEY },
      });
      await s3.send(new PutObjectCommand({ Bucket: env.CLOUDFLARE_R2_BUCKET_NAME, Key: key, Body: body, ContentType: `image/${photoType}` }));
      publicUrl = env.BUNNY_CDN_URL ? `https://${env.BUNNY_CDN_URL}/${key}` : `https://${env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.CLOUDFLARE_R2_BUCKET_NAME}/${key}`;
    } catch (e: any) {
      log.error(`R2 profile photo upload failed: ${e.message}`);
    }
  }

  return publicUrl;
}
