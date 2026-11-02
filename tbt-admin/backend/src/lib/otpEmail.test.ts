import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// lib/otpEmail.ts against a stubbed Resend SDK: nothing is sent anywhere.

const envMock = vi.hoisted(() => ({ env: {} as Record<string, any> }));
vi.mock('../config/env.js', () => envMock);
const resend = vi.hoisted(() => ({
  calls: [] as Array<Record<string, any>>,
  result: { data: { id: 'email-1' }, error: null } as { data?: unknown; error?: any },
  throws: null as Error | null,
  keys: [] as string[],
}));
vi.mock('resend', () => ({
  Resend: class {
    constructor(key: string) { resend.keys.push(key); }
    emails = {
      send: async (msg: Record<string, any>) => {
        resend.calls.push(msg);
        if (resend.throws) throw resend.throws;
        return resend.result;
      },
    };
  },
}));

const { sendOtpEmail, resetOtpEmailClientForTests, DEFAULT_OTP_EMAIL_FROM } = await import('./otpEmail.js');

let consoleLines: string[];
beforeEach(() => {
  envMock.env = { RESEND_API_KEY: 're_test_key' };
  Object.assign(resend, { calls: [], result: { data: { id: 'email-1' }, error: null }, throws: null, keys: [] });
  resetOtpEmailClientForTests();
  consoleLines = [];
  for (const level of ['log', 'warn', 'error', 'info'] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => { consoleLines.push(args.map(String).join(' ')); });
  }
});
afterEach(() => vi.restoreAllMocks());

describe('sendOtpEmail', () => {
  it('sends the OTP to the address with the 5-minute expiry; true when Resend accepts it', async () => {
    expect(await sendOtpEmail('priya@example.com', '482913')).toBe(true);
    expect(resend.keys).toEqual(['re_test_key']);
    expect(resend.calls).toHaveLength(1);
    const m = resend.calls[0];
    expect(m).toMatchObject({ from: DEFAULT_OTP_EMAIL_FROM, to: 'priya@example.com', subject: 'Your TBT verification code' });
    expect(m.text).toContain('482913');
    expect(m.text).toContain('5 minutes');
    expect(m.html).toContain('482913');
  });

  it('uses OTP_EMAIL_FROM when set', async () => {
    envMock.env.OTP_EMAIL_FROM = 'TBT <otp@mail.example.org>';
    await sendOtpEmail('a@b.co', '111222');
    expect(resend.calls[0].from).toBe('TBT <otp@mail.example.org>');
  });

  it('no RESEND_API_KEY: nothing is sent, false', async () => {
    envMock.env = {};
    resetOtpEmailClientForTests();
    expect(await sendOtpEmail('a@b.co', '111222')).toBe(false);
    expect(resend.calls).toHaveLength(0);
  });

  it('Resend returns an error (e.g. unverified domain): false, and the OTP is not logged', async () => {
    resend.result = { data: null, error: { name: 'validation_error', message: 'The example.com domain is not verified.' } };
    expect(await sendOtpEmail('a@b.co', '654321')).toBe(false);
    expect(consoleLines.join('\n')).toContain('domain is not verified');
    expect(consoleLines.join('\n')).not.toContain('654321');
  });

  it('network error: false, and the OTP is not logged', async () => {
    resend.throws = new Error('fetch failed');
    expect(await sendOtpEmail('a@b.co', '654321')).toBe(false);
    expect(consoleLines.join('\n')).toContain('fetch failed');
    expect(consoleLines.join('\n')).not.toContain('654321');
  });
});
