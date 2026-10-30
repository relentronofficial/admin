import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  ADMIN_AUDIENCE,
  BRIDGE_TOKEN_TTL_SECONDS,
  canUsePsychometric,
  resolveUpstreamPath,
  signBridgeToken,
} from './psychometricBridge.js';

const part = (t: string, i: number) => JSON.parse(Buffer.from(t.split('.')[i], 'base64url').toString());

describe('canUsePsychometric', () => {
  it('allows only admin and super_admin', () => {
    expect(canUsePsychometric('super_admin')).toBe(true);
    expect(canUsePsychometric('admin')).toBe(true);
    for (const r of ['mentor', 'moderator', 'account_manager', '', null, undefined]) expect(canUsePsychometric(r)).toBe(false);
  });
});

describe('resolveUpstreamPath', () => {
  it.each([
    '/admin/dashboard',
    '/admin/users',
    '/admin/users/generate-candidate-id',
    '/admin/questions/reorder',
    '/admin/results/user/64f1c2',
    '/admin/export/pdf',
    '/admin/tts/questions/64f1c2/preview-explanation',
    '/admin/notifications/unread-count',
    '/admin/retest-requests/64f1c2/approve',
  ])('allows %s', (p) => {
    expect(resolveUpstreamPath(p)).toBe(p);
  });

  it.each([
    '/admin/login',
    '/admin/logout',
    '/admin/change-password',
    '/admin/profile',
    '/admin',
    '/admin/',
    '/user/login',
    '/assessment/start',
    '/admin/users/../login',
    '/admin/users/..',
    '/admin/users%2F..%2Flogin',
    '/admin/users/a.b',
    '//evil.example/admin/users',
    '/admin/unknown-section',
  ])('rejects %s', (p) => {
    expect(resolveUpstreamPath(p)).toBeNull();
  });
});

describe('signBridgeToken', () => {
  it('is a standard HS256 JWT with issuer, audience, subject and a short expiry', () => {
    const t = signBridgeToken('k', ADMIN_AUDIENCE, { sub: 'admin-1', name: 'Ravi' }, 1_000_000);
    expect(part(t, 0)).toEqual({ alg: 'HS256', typ: 'JWT' });
    expect(part(t, 1)).toEqual({
      sub: 'admin-1', name: 'Ravi', iss: 'tbt-backend', aud: 'psychometric-admin', iat: 1_000_000, exp: 1_000_000 + BRIDGE_TOKEN_TTL_SECONDS,
    });
    expect(BRIDGE_TOKEN_TTL_SECONDS).toBeLessThanOrEqual(600);
  });

  it('signature is HMAC-SHA256 over header.payload with the shared key', () => {
    const t = signBridgeToken('shared-key', ADMIN_AUDIENCE, { sub: 'a' });
    const [h, p, s] = t.split('.');
    expect(s).toBe(createHmac('sha256', 'shared-key').update(`${h}.${p}`).digest('base64url'));
    expect(s).not.toBe(createHmac('sha256', 'other-key').update(`${h}.${p}`).digest('base64url'));
  });

  it('claims cannot override issuer, audience or expiry', () => {
    const t = signBridgeToken('k', ADMIN_AUDIENCE, { sub: 'a', iss: 'evil', aud: 'x', exp: '9999999999' }, 100);
    expect(part(t, 1)).toMatchObject({ iss: 'tbt-backend', aud: 'psychometric-admin', exp: 100 + BRIDGE_TOKEN_TTL_SECONDS });
  });
});
