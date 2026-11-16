import { describe, it, expect } from 'vitest';
import { isLoginRevoked, classifyLoginSessions } from './sessionRevocation.js';

describe('classifyLoginSessions', () => {
  const row = (id: string, tokenHash: string | null, deviceId: string | null) => ({ id, tokenHash, deviceId });
  const ids = (rows: { id: string }[]) => rows.map((r) => r.id);

  it('a device-tracking row with no token is never a conflict', () => {
    const r = classifyLoginSessions([row('a', null, 'dev-1')], 'dev-2', new Map());
    expect(ids(r.conflicts)).toEqual([]);
    expect(ids(r.stale)).toEqual(['a']);
  });

  it("the device that is logging in is not 'another device'", () => {
    const r = classifyLoginSessions([row('a', 'h1', 'dev-1')], 'dev-1', new Map([['h1', true]]));
    expect(ids(r.conflicts)).toEqual([]);
    expect(ids(r.stale)).toEqual(['a']);
  });

  it('a row whose refresh token is gone (logged out / expired) is not a conflict', () => {
    const r = classifyLoginSessions([row('a', 'h1', 'dev-1')], 'dev-2', new Map([['h1', false]]));
    expect(ids(r.conflicts)).toEqual([]);
  });

  it('a live session on another device is a conflict', () => {
    const r = classifyLoginSessions([row('a', 'h1', 'dev-1')], 'dev-2', new Map([['h1', true]]));
    expect(ids(r.conflicts)).toEqual(['a']);
    expect(ids(r.stale)).toEqual([]);
  });

  it('unknown liveness (Redis down) keeps the row as a conflict', () => {
    const r = classifyLoginSessions([row('a', 'h1', 'dev-1')], undefined, new Map());
    expect(ids(r.conflicts)).toEqual(['a']);
  });

  it('no device id on the login request never matches a row with no device id', () => {
    const r = classifyLoginSessions([row('a', 'h1', null)], undefined, new Map([['h1', true]]));
    expect(ids(r.conflicts)).toEqual(['a']);
  });
});

describe('isLoginRevoked', () => {
  it('returns skip when loginId is undefined (pre-migration token, no claim)', () => {
    expect(isLoginRevoked(undefined, 'abc123')).toBe('skip');
    expect(isLoginRevoked(undefined, 'REVOKED')).toBe('skip');
    expect(isLoginRevoked(undefined, null)).toBe('skip');
  });

  it('returns skip when activeLoginId is null (Redis unavailable — fail open)', () => {
    expect(isLoginRevoked('abc123', null)).toBe('skip');
  });

  it('returns pass when loginId matches activeLoginId exactly', () => {
    expect(isLoginRevoked('abc123', 'abc123')).toBe('pass');
    const hex = 'f3a8c21d9e0b4567';
    expect(isLoginRevoked(hex, hex)).toBe('pass');
  });

  it('returns revoked when loginId does not match activeLoginId', () => {
    expect(isLoginRevoked('abc123', 'xyz789')).toBe('revoked');
    expect(isLoginRevoked('device_a', 'device_b')).toBe('revoked');
  });

  it('returns revoked for the REVOKED sentinel (revokeAllForMember in flight)', () => {
    expect(isLoginRevoked('abc123', 'REVOKED')).toBe('revoked');
  });

  it('returns revoked when activeLoginId is a different non-null string', () => {
    expect(isLoginRevoked('old', 'new')).toBe('revoked');
  });
});
