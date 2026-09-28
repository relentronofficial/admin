import { describe, it, expect } from 'vitest';
import { isLoginRevoked } from './sessionRevocation.js';

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
