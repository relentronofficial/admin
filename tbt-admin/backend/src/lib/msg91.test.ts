import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// lib/msg91.ts against a stubbed fetch: nothing is sent anywhere.

const envMock = vi.hoisted(() => ({
  env: { MSG91_AUTH_KEY: 'test-auth-key', MSG91_TEMPLATE_ID: 'flow-1', MSG91_SENDER_ID: 'TBTSND' } as Record<string, any>,
}));
vi.mock('../config/env.js', () => envMock);

const { sendOtp, msg91RequestId } = await import('./msg91.js');

const PHONE = '9876543210';
const OTP = '482913';

let lines: string[];
function respondWith(status: number, body: string) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status })));
}
beforeEach(() => {
  lines = [];
  const capture = (...args: unknown[]) => { lines.push(args.map(String).join(' ')); };
  vi.spyOn(console, 'info').mockImplementation(capture);
  vi.spyOn(console, 'error').mockImplementation(capture);
  vi.spyOn(console, 'warn').mockImplementation(capture);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Nothing sensitive in any log line: OTP, phone (any form) or auth key. */
function expectNoSecretsLogged() {
  const all = lines.join('\n');
  expect(all).not.toContain(OTP);
  expect(all).not.toContain(PHONE);
  expect(all).not.toContain('test-auth-key');
}

describe('msg91RequestId', () => {
  it('reads the request id from a success response', () => {
    expect(msg91RequestId({ type: 'success', message: '3567686b6b4b383235323831' })).toBe('3567686b6b4b383235323831');
  });

  it('rejects anything that is not an opaque id', () => {
    expect(msg91RequestId({ type: 'success' })).toBeNull();
    expect(msg91RequestId({ type: 'success', message: 42 })).toBeNull();
    expect(msg91RequestId({ type: 'success', message: 'Message sent to 919876543210' })).toBeNull();
    expect(msg91RequestId({ type: 'success', message: '919876543210' })).toBeNull(); // all digits: could be a number
    expect(msg91RequestId(null)).toBeNull();
  });
});

describe('sendOtp', () => {
  it('logs the request id on success and returns true', async () => {
    respondWith(200, '{"type":"success","message":"3567686b6b4b383235323831"}');
    expect(await sendOtp(PHONE, OTP)).toBe(true);
    expect(lines).toEqual(['[MSG91] accepted request_id=3567686b6b4b383235323831']);
    expectNoSecretsLogged();
  });

  it('still succeeds, without an id, for a success body that has none or is not JSON', async () => {
    respondWith(200, '{"type":"success"}');
    expect(await sendOtp(PHONE, OTP)).toBe(true);
    respondWith(200, 'OK');
    expect(await sendOtp(PHONE, OTP)).toBe(true);
    expect(lines).toEqual(['[MSG91] accepted (no request id in response)', '[MSG91] accepted (no request id in response)']);
    expectNoSecretsLogged();
  });

  it('keeps returning false for an HTTP 200 error body and for a non-2xx status', async () => {
    respondWith(200, '{"type":"error","message":"Insufficient balance"}');
    expect(await sendOtp(PHONE, OTP)).toBe(false);
    respondWith(401, '{"type":"error","message":"Unauthorized"}');
    expect(await sendOtp(PHONE, OTP)).toBe(false);
    expect(lines.some((l) => l.includes('accepted'))).toBe(false);
    expectNoSecretsLogged();
  });

  it('skips without a request when credentials are missing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const saved = envMock.env;
    envMock.env = { ...saved, MSG91_AUTH_KEY: '' };
    try {
      expect(await sendOtp(PHONE, OTP)).toBe(false);
    } finally {
      envMock.env = saved;
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
