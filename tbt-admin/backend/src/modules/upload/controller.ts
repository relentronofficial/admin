import type { FastifyReply, FastifyRequest } from 'fastify';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash } from 'crypto';
import { env } from '../../config/env.js';

export async function uploadImageHandler(req: FastifyRequest, reply: FastifyReply) {
  const { pathPrefix = 'uploads', filename = 'file' } = req.query as { pathPrefix?: string; filename?: string };
  const contentType = (req.headers['content-type'] || 'application/octet-stream').split(';')[0].trim();
  const body = req.body as Buffer;

  if (!env.BUNNY_STORAGE_HOSTNAME || !env.BUNNY_STORAGE_ZONE || !env.BUNNY_STORAGE_ACCESS_KEY || !env.BUNNY_CDN_URL) {
    return reply.status(503).send({
      success: false,
      error: { code: 'SERVICE_UNAVAILABLE', message: 'Bunny Storage not configured' },
    });
  }

  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '-');
  const key = `${pathPrefix}/${Date.now()}-${safeFilename}`;
  const uploadUrl = `https://${env.BUNNY_STORAGE_HOSTNAME}/${env.BUNNY_STORAGE_ZONE}/${key}`;

  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { AccessKey: env.BUNNY_STORAGE_ACCESS_KEY, 'Content-Type': contentType },
    body: new Uint8Array(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    req.log.error(`Bunny Storage upload failed [${res.status}]: ${text}`);
    return reply.status(502).send({
      success: false,
      error: { code: 'UPLOAD_ERROR', message: 'Bunny Storage upload failed' },
    });
  }

  return reply.send({ success: true, data: { publicUrl: `https://${env.BUNNY_CDN_URL}/${key}` }, error: null });
}

function getS3Client(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.CLOUDFLARE_R2_ACCESS_KEY_ID || '',
      secretAccessKey: env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '',
    },
  });
}

export async function getPresignedUrlHandler(request: FastifyRequest, reply: FastifyReply) {
  const { filename, contentType, bucket, pathPrefix } = request.body as {
    filename: string;
    contentType: string;
    bucket?: string;
    pathPrefix?: string;
  };

  if (!filename || !contentType) {
    return reply.status(400).send({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'Filename and contentType are required' },
    });
  }

  const targetBucket = bucket || 'avatars';
  const targetPrefix = pathPrefix || 'admins/photos';
  const key = `${targetPrefix}/${Date.now()}-${filename}`;

  // Supabase Storage fallback when R2 is not configured
  if (!env.CLOUDFLARE_R2_ACCESS_KEY_ID || !env.CLOUDFLARE_R2_SECRET_ACCESS_KEY) {
    try {
      const { data, error } = await (request.server as any).supabase.storage
        .from(targetBucket)
        .createSignedUploadUrl(key);

      if (error) {
        if (error.message.includes('not found') || error.message.includes('does not exist')) {
          const isPublic = targetBucket !== 'kyc-documents';
          await (request.server as any).supabase.storage.createBucket(targetBucket, { public: isPublic });
          const { data: retryData, error: retryError } = await (request.server as any).supabase.storage
            .from(targetBucket)
            .createSignedUploadUrl(key);

          if (retryError) throw retryError;

          const publicUrl = `${env.SUPABASE_URL}/storage/v1/object/public/${targetBucket}/${key}`;
          return reply.send({ success: true, data: { uploadUrl: retryData.signedUrl, publicUrl } });
        }
        throw error;
      }

      const publicUrl = `${env.SUPABASE_URL}/storage/v1/object/public/${targetBucket}/${key}`;
      return reply.send({ success: true, data: { uploadUrl: data.signedUrl, publicUrl } });
    } catch (err: any) {
      request.server.log.error(err);
      return reply.status(500).send({
        success: false,
        error: { code: 'UPLOAD_ERROR', message: err.message || 'Failed to generate upload URL' },
      });
    }
  }

  // Primary path: Cloudflare R2 presigned PUT, delivered via Bunny CDN
  const command = new PutObjectCommand({
    Bucket: env.CLOUDFLARE_R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  try {
    const s3 = getS3Client();
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
    const publicUrl = `https://${env.BUNNY_CDN_URL}/${key}`;

    return reply.send({ success: true, data: { uploadUrl, publicUrl } });
  } catch (err: any) {
    request.server.log.error(err);
    return reply.status(500).send({
      success: false,
      error: { code: 'UPLOAD_ERROR', message: 'Failed to generate R2 upload URL' },
    });
  }
}

export async function deleteBunnyVideoHandler(request: FastifyRequest, reply: FastifyReply) {
  const { videoId } = request.params as { videoId: string };

  if (!env.BUNNY_STREAM_API_KEY || !env.BUNNY_STREAM_LIBRARY_ID) {
    return reply.status(503).send({
      success: false,
      error: { code: 'SERVICE_UNAVAILABLE', message: 'Bunny Stream is not configured' },
    });
  }

  try {
    const res = await fetch(
      `https://video.bunnycdn.com/library/${env.BUNNY_STREAM_LIBRARY_ID}/videos/${videoId}`,
      {
        method: 'DELETE',
        headers: { AccessKey: env.BUNNY_STREAM_API_KEY },
      },
    );

    if (!res.ok && res.status !== 404) {
      const errText = await res.text();
      request.server.log.error(`Bunny Stream delete video failed: ${errText}`);
      return reply.status(502).send({
        success: false,
        error: { code: 'BUNNY_ERROR', message: 'Failed to delete video from Bunny Stream' },
      });
    }

    return reply.send({ success: true, data: null, error: null });
  } catch (err: any) {
    request.server.log.error(err);
    return reply.status(500).send({
      success: false,
      error: { code: 'BUNNY_ERROR', message: 'Bunny Stream request failed' },
    });
  }
}

export async function createBunnyVideoHandler(request: FastifyRequest, reply: FastifyReply) {
  const { title } = request.body as { title?: string };

  if (!env.BUNNY_STREAM_API_KEY || !env.BUNNY_STREAM_LIBRARY_ID) {
    return reply.status(503).send({
      success: false,
      error: { code: 'SERVICE_UNAVAILABLE', message: 'Bunny Stream is not configured' },
    });
  }

  const libraryId = env.BUNNY_STREAM_LIBRARY_ID;
  const apiKey = env.BUNNY_STREAM_API_KEY;

  // Step 1: Create video entry in Bunny Stream
  let videoId: string;
  try {
    const createRes = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos`, {
      method: 'POST',
      headers: {
        AccessKey: apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ title: title || 'Untitled' }),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      request.server.log.error(`Bunny Stream create video failed: ${errText}`);
      return reply.status(502).send({
        success: false,
        error: { code: 'BUNNY_ERROR', message: 'Failed to create video in Bunny Stream' },
      });
    }

    const videoData = (await createRes.json()) as { guid: string };
    videoId = videoData.guid;
  } catch (err: any) {
    request.server.log.error(err);
    return reply.status(500).send({
      success: false,
      error: { code: 'BUNNY_ERROR', message: 'Bunny Stream request failed' },
    });
  }

  // Step 2: Compute TUS auth signature for direct browser-to-Bunny upload
  // Formula: SHA256(libraryId + apiKey + expiryTimestamp + videoId)
  const expiry = Math.floor(Date.now() / 1000) + 3600;
  const signature = createHash('sha256')
    .update(libraryId + apiKey + expiry + videoId)
    .digest('hex');

  const embedUrl = `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}`;

  return reply.send({
    success: true,
    data: {
      videoId,
      tusUploadUrl: 'https://video.bunnycdn.com/tusupload',
      tusHeaders: {
        AuthorizationSignature: signature,
        AuthorizationExpire: expiry,
        VideoId: videoId,
        LibraryId: libraryId,
      },
      embedUrl,
    },
  });
}
