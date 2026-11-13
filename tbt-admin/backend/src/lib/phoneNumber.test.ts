import { describe, expect, it } from 'vitest';
import { normalizePhone, phoneDigitsForMessaging, phoneKey, phoneLookupVariants } from './phoneNumber.js';

describe('normalizePhone', () => {
  it('accepts complete numbers for many countries and returns E.164', () => {
    const cases: Array<[string, string, string]> = [
      ['+91 98765 43210', '+919876543210', 'IN'],
      ['+44 7400 123456', '+447400123456', 'GB'],
      ['+1 (202) 555-0147', '+12025550147', 'US'],
      ['+971 50 123 4567', '+971501234567', 'AE'],
      ['+65 9123 4567', '+6591234567', 'SG'],
      ['+61 412 345 678', '+61412345678', 'AU'],
      ['+94 77 123 4567', '+94771234567', 'LK'],
      ['+60 12-345 6789', '+60123456789', 'MY'],
      ['+49 1512 3456789', '+4915123456789', 'DE'],
      ['0044 7400 123456', '+447400123456', 'GB'], // 00 international prefix
      ['+44 7911 123456', '+447911123456', 'GG'], // +44 is shared: this range is Guernsey
    ];
    for (const [input, e164, country] of cases) {
      expect(normalizePhone(input), input).toMatchObject({ ok: true, e164, country });
    }
  });

  it('reads numbers without a country code as Indian (how existing members signed up)', () => {
    expect(normalizePhone('9876543210')).toMatchObject({ ok: true, e164: '+919876543210', country: 'IN' });
    expect(normalizePhone('919876543210')).toMatchObject({ ok: true, e164: '+919876543210' });
  });

  it('rejects incomplete numbers so they never reach OTP', () => {
    expect(normalizePhone('+44 7911')).toMatchObject({ ok: false, reason: 'too_short' });
    expect(normalizePhone('+1 202 555')).toMatchObject({ ok: false, reason: 'too_short' });
    expect(normalizePhone('98765')).toMatchObject({ ok: false, reason: 'too_short' });
    expect(normalizePhone('+65 9123')).toMatchObject({ ok: false, reason: 'too_short' });
  });

  it('rejects numbers that break the country rules, too-long numbers and empty input', () => {
    expect(normalizePhone('+91 00000 00000')).toMatchObject({ ok: false, reason: 'invalid' });
    expect(normalizePhone('+1 012 555 0147')).toMatchObject({ ok: false, reason: 'invalid' }); // US area codes never start with 0
    expect(normalizePhone('+44 0911 123456')).toMatchObject({ ok: false, reason: 'invalid' });
    expect(normalizePhone('+44 7911 1234567890')).toMatchObject({ ok: false, reason: 'too_long' });
    expect(normalizePhone('+999 1234567')).toMatchObject({ ok: false });
    expect(normalizePhone('')).toMatchObject({ ok: false, reason: 'required' });
    expect(normalizePhone(undefined)).toMatchObject({ ok: false, reason: 'required' });
    expect(normalizePhone('abc')).toMatchObject({ ok: false });
  });

  it('every rejection carries a readable message', () => {
    const r = normalizePhone('+44 7911');
    expect(r.ok === false && r.message).toMatch(/complete number/);
  });
});

describe('phoneKey', () => {
  it('maps every way an Indian number is written to one key', () => {
    expect(new Set(['9876543210', '919876543210', '+919876543210', '+91 98765-43210'].map(phoneKey))).toEqual(new Set(['+919876543210']));
  });
  it('keeps international numbers distinct and falls back to digits for unparseable values', () => {
    expect(phoneKey('+447911123456')).toBe('+447911123456');
    expect(phoneKey('12')).toBe('12');
  });
});

describe('phoneLookupVariants', () => {
  it('covers the legacy stored formats of an Indian number', () => {
    expect(phoneLookupVariants('+919876543210')).toEqual(expect.arrayContaining(['+919876543210', '919876543210', '9876543210']));
    expect(phoneLookupVariants('9876543210')).toEqual(expect.arrayContaining(['+919876543210', '919876543210', '9876543210']));
  });
  it('covers E.164 and digits for an international number, never an Indian reading', () => {
    const v = phoneLookupVariants('+447911123456');
    expect(v).toEqual(expect.arrayContaining(['+447911123456', '447911123456']));
    expect(v.some((x) => x.startsWith('91') || x.startsWith('+91'))).toBe(false);
  });
});

describe('phoneDigitsForMessaging', () => {
  it('never adds 91 to an international number, even a 10-digit E.164 one', () => {
    expect(phoneDigitsForMessaging('+6591234567')).toBe('6591234567'); // Singapore
    expect(phoneDigitsForMessaging('+447911123456')).toBe('447911123456');
  });
  it('keeps the legacy Indian behaviour for bare numbers', () => {
    expect(phoneDigitsForMessaging('9876543210')).toBe('919876543210');
    expect(phoneDigitsForMessaging('919876543210')).toBe('919876543210');
    expect(phoneDigitsForMessaging('+919876543210')).toBe('919876543210');
  });
});
