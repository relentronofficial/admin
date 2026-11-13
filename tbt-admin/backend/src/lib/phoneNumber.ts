// International phone numbers for member auth — pure (no I/O).
//
// Uses libphonenumber-js with the full ("max") metadata, i.e. Google's
// libphonenumber rules for every country's numbering plan, so a number is only
// accepted when it is a real, complete number for its country.
//
// Canonical form is E.164 ("+447911123456"): new sign-ups are stored that way,
// and OTP / rate-limit keys are always derived from it, so "9876543210",
// "919876543210" and "+919876543210" are the same phone everywhere.
//
// Backward compatibility: existing members were stored as typed — mostly a
// bare 10-digit Indian number — so a number without "+" is read as Indian
// (also "91" + 10 digits), and lookups try every stored format.

import { parsePhoneNumberFromString, validatePhoneNumberLength, type CountryCode } from 'libphonenumber-js/max';

export type PhoneCheck =
  | { ok: true; e164: string; country: string | null; nationalNumber: string }
  | { ok: false; reason: 'required' | 'too_short' | 'too_long' | 'invalid_country' | 'invalid'; message: string };

const DEFAULT_COUNTRY: CountryCode = 'IN';

const MESSAGES: Record<Exclude<PhoneCheck, { ok: true }>['reason'], string> = {
  required: 'Phone number is required.',
  too_short: 'This phone number is too short — please enter the complete number.',
  too_long: 'This phone number is too long for the selected country.',
  invalid_country: 'Please choose a valid country code.',
  invalid: 'Please enter a valid phone number for the selected country.',
};

const fail = (reason: Exclude<PhoneCheck, { ok: true }>['reason']): PhoneCheck => ({ ok: false, reason, message: MESSAGES[reason] });

/** Bring the many ways a number gets typed into a form libphonenumber can parse. */
function prepare(raw: string): string {
  let s = raw.trim().replace(/[\s().-]/g, '');
  if (s.startsWith('00')) s = `+${s.slice(2)}`; // international dialling prefix
  if (!s.startsWith('+')) {
    const digits = s.replace(/\D/g, '');
    // Legacy Indian format stored without "+": 91 + 10-digit mobile.
    if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
    return digits;
  }
  return `+${s.slice(1).replace(/\D/g, '')}`;
}

/**
 * Validate and normalize a phone number. Numbers in international format
 * ("+…" / "00…") use their own country code; anything else is read for
 * `defaultCountry` (India), matching how existing members signed up.
 */
export function normalizePhone(raw: unknown, defaultCountry: CountryCode = DEFAULT_COUNTRY): PhoneCheck {
  if (typeof raw !== 'string' || !raw.trim()) return fail('required');
  const text = prepare(raw);
  if (!text || text === '+') return fail('required');
  const country = text.startsWith('+') ? undefined : defaultCountry;

  const lengthIssue = validatePhoneNumberLength(text, country);
  if (lengthIssue === 'TOO_SHORT' || lengthIssue === 'NOT_A_NUMBER') return fail('too_short');
  if (lengthIssue === 'TOO_LONG') return fail('too_long');
  if (lengthIssue === 'INVALID_COUNTRY') return fail('invalid_country');

  const parsed = parsePhoneNumberFromString(text, country);
  if (!parsed) return fail('invalid');
  if (!parsed.isValid()) return lengthIssue === 'INVALID_LENGTH' ? fail('too_short') : fail('invalid');
  return { ok: true, e164: parsed.number, country: parsed.country ?? null, nationalNumber: parsed.nationalNumber };
}

/**
 * Stable key for OTP storage and rate limits: E.164 when the number parses,
 * otherwise its digits (never throws, so an odd legacy value still works).
 */
export function phoneKey(raw: string): string {
  const n = normalizePhone(raw);
  return n.ok ? n.e164 : raw.replace(/\D/g, '');
}

/**
 * Every format a member's phone may be stored in (legacy rows hold whatever
 * was typed, new rows hold E.164), for `phone IN (...)` lookups.
 */
export function phoneLookupVariants(raw: string): string[] {
  const variants = new Set<string>();
  const trimmed = (raw ?? '').trim();
  if (trimmed) variants.add(trimmed);
  const digits = trimmed.replace(/\D/g, '');
  if (digits) variants.add(digits);
  const n = normalizePhone(trimmed);
  if (n.ok) {
    variants.add(n.e164);
    variants.add(n.e164.slice(1));
    if (n.country === 'IN') variants.add(n.nationalNumber);
  }
  return [...variants];
}

/**
 * Digits to send a WhatsApp/SMS to. A number in international format keeps
 * its own country code (a 10-digit E.164 like Singapore's "+6591234567" must
 * never get "91" added); a bare 10-digit number is a legacy Indian mobile.
 */
export function phoneDigitsForMessaging(raw: string): string {
  const trimmed = (raw ?? '').trim();
  if (trimmed.startsWith('+') || trimmed.startsWith('00')) {
    const n = normalizePhone(trimmed);
    return n.ok ? n.e164.slice(1) : trimmed.replace(/\D/g, '').replace(/^00/, '');
  }
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  return digits;
}
