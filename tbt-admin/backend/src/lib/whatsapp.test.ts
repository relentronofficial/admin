import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// lib/whatsapp.ts account-failure alerts against a stubbed fetch: nothing is sent anywhere.

const envMock = vi.hoisted(() => ({
  env: {
    WABA_ACCESS_TOKEN: 'test-token',
    WABA_FROM_NUMBER: '9000000000',
    WABA_TEMPLATE_NAME: 'otp_template',
    WABA_TEMPLATE_LANGUAGE: 'en',
    WABA_API_BASE_URL: 'https://bsp.test',
  } as Record<string, any>,
}));
vi.mock('../config/env.js', () => envMock);

const { classifyBspAccountFailure, registerLowBalanceHandler, resetLowBalanceAlertForTests, sendOtpWhatsapp } =
  await import('./whatsapp.js');

const EXPIRED_BODY = '{"message":"Subscription is expired","error":"Forbidden","statusCode":403}';
const LOW_BALANCE_BODY = '{"code":"INSUFFICIENT_BALANCE","message":"Wallet balance is insufficient"}';

function respondWith(status: number, body: string) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status })));
}

let alerts: Array<{ status: number; reason: string }>;
beforeEach(() => {
  resetLowBalanceAlertForTests();
  alerts = [];
  registerLowBalanceHandler(({ status, reason }) => { alerts.push({ status, reason }); });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('classifyBspAccountFailure', () => {
  it('recognises the @zacx expired-subscription 403', () => {
    expect(classifyBspAccountFailure(403, EXPIRED_BODY)).toBe('subscription_expired');
  });

  it('keeps the existing low-balance signals', () => {
    expect(classifyBspAccountFailure(402, '')).toBe('low_balance');
    expect(classifyBspAccountFailure(400, LOW_BALANCE_BODY)).toBe('low_balance');
    expect(classifyBspAccountFailure(200, '{"status":"error","message":"Insufficient   balance"}')).toBe('low_balance');
  });

  it('ignores other failures, including a 403 for another reason and the phrase on a non-403', () => {
    expect(classifyBspAccountFailure(403, '{"message":"Invalid token","error":"Forbidden"}')).toBeNull();
    expect(classifyBspAccountFailure(400, '{"message":"Subscription is expired"}')).toBeNull();
    expect(classifyBspAccountFailure(500, 'Internal Server Error')).toBeNull();
  });
});

describe('sendOtpWhatsapp → admin alert', () => {
  it('raises one subscription_expired alert and still reports the send as failed (so SMS fallback runs)', async () => {
    respondWith(403, EXPIRED_BODY);
    expect(await sendOtpWhatsapp('9876543210', '123456')).toBe(false);
    await Promise.resolve();
    expect(alerts).toEqual([{ status: 403, reason: 'subscription_expired' }]);
  });

  it('raises a low_balance alert for HTTP 402, as before', async () => {
    respondWith(402, LOW_BALANCE_BODY);
    expect(await sendOtpWhatsapp('9876543210', '123456')).toBe(false);
    await Promise.resolve();
    expect(alerts).toEqual([{ status: 402, reason: 'low_balance' }]);
  });

  it('does not repeat the alert within the cooldown window', async () => {
    respondWith(403, EXPIRED_BODY);
    await sendOtpWhatsapp('9876543210', '111111');
    await sendOtpWhatsapp('9876543210', '222222');
    respondWith(402, LOW_BALANCE_BODY);
    await sendOtpWhatsapp('9876543210', '333333');
    await Promise.resolve();
    expect(alerts).toHaveLength(1);
  });

  it('raises no alert for an ordinary per-send failure or a success', async () => {
    respondWith(400, '{"message":"Invalid recipient"}');
    expect(await sendOtpWhatsapp('9876543210', '123456')).toBe(false);
    respondWith(200, '{"status":"success","data":{"messageId":"m-1"}}');
    expect(await sendOtpWhatsapp('9876543210', '123456')).toBe(true);
    await Promise.resolve();
    expect(alerts).toEqual([]);
  });
});
