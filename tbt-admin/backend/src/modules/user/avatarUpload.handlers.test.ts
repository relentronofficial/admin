import { beforeEach, describe, expect, it, vi } from 'vitest';

// POST /api/user/me/avatar/upload — the profile page photo goes through the
// backend (a direct browser PUT to R2 is rejected by the bucket's CORS, so the
// old presign flow never stored anything). Storage is mocked: Bunny via fetch,
// R2 via the S3 client. Nothing is uploaded.

const env = vi.hoisted(() => ({
  PROGRAM_TIMEZONE: 'Asia/Kolkata', MENTORSHIP_DEMO_MEMBER_ID: '', MENTORSHIP_DEMO_EMAIL: '',
  BUNNY_STORAGE_HOSTNAME: '', BUNNY_STORAGE_ZONE: '', BUNNY_STORAGE_ACCESS_KEY: '', BUNNY_CDN_URL: 'cdn.example.test',
  CLOUDFLARE_R2_ACCOUNT_ID: 'acct', CLOUDFLARE_R2_ACCESS_KEY_ID: 'key', CLOUDFLARE_R2_SECRET_ACCESS_KEY: 'secret', CLOUDFLARE_R2_BUCKET_NAME: 'bucket',
} as Record<string, string>));
vi.mock('../../config/env.js', () => ({ env }));
const s3Send = vi.hoisted(() => vi.fn());
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class { send = s3Send; },
  PutObjectCommand: class { constructor(public input: any) {} },
  GetObjectCommand: class { constructor(public input: any) {} },
}));
const invalidateCache = vi.hoisted(() => vi.fn(async () => {}));
vi.mock('../../lib/cache.js', async (orig) => ({ ...(await orig<any>()), invalidateCache }));

const user = await import('./controller.js');

const ME = '50000000-0000-4000-8000-0000000000c1';
let member: { id: string; profilePhotoUrl: string | null; firstName: string };
let updates: any[];
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);

async function upload(body: unknown, contentType: string, filename = 'my photo.jpg') {
  const res: { status: number; body?: any } = { status: 200 };
  const reply: any = { status(c: number) { res.status = c; return reply; }, code(c: number) { res.status = c; return reply; }, send(b: any) { res.body = b; return reply; } };
  const server = {
    redis: null,
    prisma: {
      member: { update: vi.fn(async ({ where, data }: any) => { updates.push({ where, data }); Object.assign(member, data); return member; }) },
    },
  };
  const req: any = { memberId: ME, query: { filename }, headers: { 'content-type': contentType }, body, server, log: { info() {}, warn() {}, error() {} } };
  await user.uploadAvatarHandler(req, reply);
  return res;
}

beforeEach(() => {
  member = { id: ME, profilePhotoUrl: 'https://cdn.example.test/members/old.jpg', firstName: 'Asha' };
  updates = [];
  s3Send.mockReset().mockResolvedValue({});
  invalidateCache.mockClear();
  Object.assign(env, { BUNNY_STORAGE_HOSTNAME: '', BUNNY_STORAGE_ZONE: '', BUNNY_STORAGE_ACCESS_KEY: '' });
  vi.unstubAllGlobals();
});

describe('POST /api/user/me/avatar/upload', () => {
  it('stores the image, saves only profilePhotoUrl on the member, refreshes /me and returns the URL', async () => {
    const r = await upload(JPEG, 'image/jpeg');
    expect(r.status).toBe(200);
    expect(s3Send).toHaveBeenCalledTimes(1);
    const put = s3Send.mock.calls[0][0].input;
    expect(put).toMatchObject({ Bucket: 'bucket', ContentType: 'image/jpeg', Body: JPEG });
    expect(put.Key).toMatch(new RegExp(`^members/${ME}/\\d+-my-photo\\.jpg$`)); // filename made path-safe
    expect(r.body).toEqual({ success: true, data: { avatarUrl: `https://cdn.example.test/${put.Key}` }, error: null });
    expect(updates).toEqual([{ where: { id: ME }, data: { profilePhotoUrl: r.body.data.avatarUrl } }]); // nothing else touched
    expect(member).toMatchObject({ profilePhotoUrl: r.body.data.avatarUrl, firstName: 'Asha' });
    expect(invalidateCache).toHaveBeenCalledWith(null, `me:${ME}`);
  });

  it('uses Bunny Storage first when configured, R2 only as a fallback', async () => {
    Object.assign(env, { BUNNY_STORAGE_HOSTNAME: 'storage.example.test', BUNNY_STORAGE_ZONE: 'zone', BUNNY_STORAGE_ACCESS_KEY: 'k' });
    const fetchMock = vi.fn(async () => ({ ok: true, status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    const r = await upload(JPEG, 'image/png', 'a.png');
    expect(r.status).toBe(200);
    expect((fetchMock.mock.calls[0] as any)[0]).toMatch(/^https:\/\/storage\.example\.test\/zone\/members\//);
    expect(r.body.data.avatarUrl).toMatch(/^https:\/\/cdn\.example\.test\/members\//);
    expect(s3Send).not.toHaveBeenCalled();

    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });
    const fallback = await upload(JPEG, 'image/png', 'b.png');
    expect(fallback.status).toBe(200);
    expect(s3Send).toHaveBeenCalledTimes(1);
  });

  it('a non-image file is rejected and nothing is stored or saved', async () => {
    const r = await upload(Buffer.from('%PDF-1.4'), 'application/pdf', 'doc.pdf');
    expect(r.status).toBe(400);
    expect(r.body.error.message).toBe('Please select an image file');
    expect(s3Send).not.toHaveBeenCalled();
    expect(updates).toHaveLength(0);
  });

  it('an empty body is rejected', async () => {
    const r = await upload(Buffer.alloc(0), 'image/jpeg');
    expect(r.status).toBe(400);
    expect(r.body.error.message).toBe('No file received');
    expect(s3Send).not.toHaveBeenCalled();
  });

  it('when storage fails the member gets a clear error and the old photo is kept', async () => {
    s3Send.mockRejectedValueOnce(new Error('R2 down'));
    const r = await upload(JPEG, 'image/jpeg');
    expect(r.status).toBe(502);
    expect(r.body).toMatchObject({ success: false, error: { message: 'Upload failed – no storage service available' } });
    expect(updates).toHaveLength(0);
    expect(member.profilePhotoUrl).toBe('https://cdn.example.test/members/old.jpg');
  });
});
