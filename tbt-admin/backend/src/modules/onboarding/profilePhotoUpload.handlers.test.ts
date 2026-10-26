import { beforeEach, describe, expect, it, vi } from 'vitest';

// POST /api/onboarding/photo/upload — the onboarding profile photo goes through
// the backend (a direct browser PUT to R2 is rejected by the bucket's CORS).
// Storage is mocked: Bunny via fetch, R2 via the S3 client. Nothing is uploaded.

const env = vi.hoisted(() => ({
  BUNNY_STORAGE_HOSTNAME: '', BUNNY_STORAGE_ZONE: '', BUNNY_STORAGE_ACCESS_KEY: '', BUNNY_CDN_URL: 'cdn.example.test',
  CLOUDFLARE_R2_ACCOUNT_ID: 'acct', CLOUDFLARE_R2_ACCESS_KEY_ID: 'key', CLOUDFLARE_R2_SECRET_ACCESS_KEY: 'secret', CLOUDFLARE_R2_BUCKET_NAME: 'bucket',
} as Record<string, string>));
vi.mock('../../config/env.js', () => ({ env }));
const s3Send = vi.hoisted(() => vi.fn());
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class { send = s3Send; },
  PutObjectCommand: class { constructor(public input: any) {} },
}));

const onboarding = await import('./controller.js');

const ME = '50000000-0000-4000-8000-0000000000b1';
let member: { id: string; verificationStatus: string; profilePhotoUrl: string | null } | null;
let updates: any[];
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);

async function upload(body: unknown, contentType: string, filename = 'my photo.jpg') {
  const res: { status: number; body?: any } = { status: 200 };
  const reply: any = { status(c: number) { res.status = c; return reply; }, send(b: any) { res.body = b; return reply; } };
  const server = {
    prisma: {
      member: {
        findUnique: vi.fn(async () => (member ? { verificationStatus: member.verificationStatus } : null)),
        update: vi.fn(async ({ where, data }: any) => { updates.push({ where, data }); Object.assign(member!, data); return member; }),
      },
    },
  };
  const req: any = { memberId: ME, query: { filename }, headers: { 'content-type': contentType }, body, server, log: { info() {}, warn() {}, error() {} } };
  await onboarding.uploadProfilePhotoHandler(req, reply);
  return res;
}

beforeEach(() => {
  member = { id: ME, verificationStatus: 'awaiting_kyc', profilePhotoUrl: null };
  updates = [];
  s3Send.mockReset().mockResolvedValue({});
  Object.assign(env, { BUNNY_STORAGE_HOSTNAME: '', BUNNY_STORAGE_ZONE: '', BUNNY_STORAGE_ACCESS_KEY: '' });
  vi.unstubAllGlobals();
});

describe('POST /api/onboarding/photo/upload', () => {
  it('uploads an image to storage, saves it on the member and returns the public URL', async () => {
    const r = await upload(JPEG, 'image/jpeg');
    expect(r.status).toBe(201);
    expect(s3Send).toHaveBeenCalledTimes(1);
    const put = s3Send.mock.calls[0][0].input;
    expect(put).toMatchObject({ Bucket: 'bucket', ContentType: 'image/jpeg', Body: JPEG });
    expect(put.Key).toMatch(new RegExp(`^members/${ME}/\\d+-my-photo\\.jpg$`)); // filename made path-safe
    expect(r.body).toEqual({ success: true, data: { publicUrl: `https://cdn.example.test/${put.Key}` }, error: null });
    expect(updates).toEqual([{ where: { id: ME }, data: { profilePhotoUrl: r.body.data.publicUrl } }]);
    expect(member!.profilePhotoUrl).toBe(r.body.data.publicUrl); // persisted, so a refresh still shows it
  });

  it('uses Bunny Storage first when configured, R2 only as a fallback', async () => {
    Object.assign(env, { BUNNY_STORAGE_HOSTNAME: 'storage.example.test', BUNNY_STORAGE_ZONE: 'zone', BUNNY_STORAGE_ACCESS_KEY: 'k' });
    const fetchMock = vi.fn(async () => ({ ok: true, status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    const r = await upload(JPEG, 'image/png', 'a.png');
    expect(r.status).toBe(201);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0] as any)[0]).toMatch(/^https:\/\/storage\.example\.test\/zone\/members\//);
    expect(s3Send).not.toHaveBeenCalled();

    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });
    const fallback = await upload(JPEG, 'image/png', 'b.png');
    expect(fallback.status).toBe(201);
    expect(s3Send).toHaveBeenCalledTimes(1);
  });

  it('a non-image file is rejected and nothing is stored or saved', async () => {
    const r = await upload(Buffer.from('%PDF-1.4'), 'application/pdf', 'doc.pdf');
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('Please choose an image file');
    expect(s3Send).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
  });

  it('an empty body is rejected', async () => {
    const r = await upload(Buffer.alloc(0), 'image/jpeg');
    expect(r.status).toBe(400);
    expect(r.body.error).toBe('No file received');
    expect(s3Send).not.toHaveBeenCalled();
  });

  it('after submission (under review) the photo cannot be changed', async () => {
    member!.verificationStatus = 'under_review';
    const r = await upload(JPEG, 'image/jpeg');
    expect(r.status).toBe(403);
    expect(s3Send).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
  });

  it('when storage fails the member gets an error and no URL is saved', async () => {
    s3Send.mockRejectedValueOnce(new Error('R2 down'));
    const r = await upload(JPEG, 'image/jpeg');
    expect(r.status).toBe(502);
    expect(r.body.success).toBe(false);
    expect(updates).toHaveLength(0);
    expect(member!.profilePhotoUrl).toBeNull();
  });

  it('an unknown member gets 404', async () => {
    member = null;
    const r = await upload(JPEG, 'image/jpeg');
    expect(r.status).toBe(404);
    expect(s3Send).not.toHaveBeenCalled();
  });
});
