"use client";

import { useMemo } from "react";
import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
  validatePhoneNumberLength,
  type CountryCode,
} from "libphonenumber-js/max";

// International phone field for the auth screens: a country-code picker (every
// country, from libphonenumber's metadata) plus the national number, validated
// with the same libphonenumber rules the backend uses (lib/phoneNumber.ts).
//
// A full international number that the browser autofills or the user pastes
// ("+44 7400 123456", "0044…") switches the picker to that country instead of
// being stripped and truncated into a wrong Indian number.

export interface PhoneValue {
  country: CountryCode;
  /** National number digits, without the country code. */
  national: string;
}

export const DEFAULT_PHONE: PhoneValue = { country: "IN", national: "" };

export type PhoneStatus = "empty" | "incomplete" | "too_long" | "invalid" | "valid";

export function phoneStatus(v: PhoneValue): PhoneStatus {
  if (!v.national) return "empty";
  const issue = validatePhoneNumberLength(v.national, v.country);
  if (issue === "TOO_SHORT" || issue === "NOT_A_NUMBER") return "incomplete";
  if (issue === "TOO_LONG") return "too_long";
  return isValidPhoneNumber(v.national, v.country) ? "valid" : "invalid";
}

/** E.164 ("+447400123456") for a valid number, otherwise null. */
export function phoneToE164(v: PhoneValue): string | null {
  if (phoneStatus(v) !== "valid") return null;
  return parsePhoneNumberFromString(v.national, v.country)?.number ?? null;
}

export function phoneStatusMessage(status: PhoneStatus): string | null {
  switch (status) {
    case "empty": return "Phone number is required";
    case "incomplete": return "This phone number is incomplete — please enter the full number";
    case "too_long": return "This phone number is too long for the selected country";
    case "invalid": return "Please enter a valid phone number for the selected country";
    default: return null;
  }
}

/** International display of a valid number, e.g. "+44 7400 123456". */
export function formatPhoneInternational(v: PhoneValue): string {
  const p = parsePhoneNumberFromString(v.national, v.country);
  return p ? p.formatInternational() : `+${getCountryCallingCode(v.country)} ${v.national}`;
}

/** Read whatever was typed, pasted or autofilled into a PhoneValue. */
export function readPhoneInput(text: string, current: CountryCode): PhoneValue {
  const trimmed = text.trim();
  if (trimmed.startsWith("+") || trimmed.startsWith("00")) {
    const intl = trimmed.startsWith("00") ? `+${trimmed.slice(2)}` : trimmed;
    const typer = new AsYouType();
    typer.input(intl);
    const country = typer.getCountry();
    const national = typer.getNumber()?.nationalNumber;
    if (country && national) return { country, national };
    // Country not known yet (e.g. only "+4" so far): keep the digits as typed.
    return { country: current, national: intl.replace(/\D/g, "") };
  }
  let digits = trimmed.replace(/\D/g, "");
  // An Indian number pasted with its code but no "+" (91XXXXXXXXXX).
  if (current === "IN" && digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  // A national trunk prefix ("07400…" in the UK) is handled by libphonenumber itself.
  return { country: current, national: digits };
}

interface Props {
  value: PhoneValue;
  onChange: (v: PhoneValue) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  id?: string;
  autoFocus?: boolean;
}

export function PhoneInput({ value, onChange, onFocus, onBlur, placeholder = "Mobile number", id, autoFocus }: Props) {
  const countries = useMemo(() => {
    let names: Intl.DisplayNames | null = null;
    try { names = new Intl.DisplayNames(["en"], { type: "region" }); } catch { names = null; }
    return getCountries()
      .map((code) => ({ code, name: names?.of(code) ?? code, dial: getCountryCallingCode(code) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const display = value.national ? new AsYouType(value.country).input(value.national) : "";

  return (
    <div className="flex items-center w-full">
      <select
        aria-label="Country code"
        value={value.country}
        onChange={(e) => onChange({ country: e.target.value as CountryCode, national: value.national })}
        onFocus={onFocus}
        onBlur={onBlur}
        className="bg-transparent text-white text-[13px] font-medium pl-4 pr-1 py-[12px] outline-none cursor-pointer max-w-[96px]"
        style={{ colorScheme: "dark" }}
      >
        {countries.map((c) => (
          <option key={c.code} value={c.code} style={{ background: "#111", color: "#fff" }}>
            {c.code} +{c.dial} — {c.name}
          </option>
        ))}
      </select>
      <input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        aria-label="Phone number"
        autoFocus={autoFocus}
        value={display}
        onChange={(e) => onChange(readPhoneInput(e.target.value, value.country))}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        className="w-full bg-transparent pl-2 pr-4 py-[12px] text-white text-[13px] placeholder-white/20 outline-none"
        style={{ caretColor: "#dc2626" }}
      />
    </div>
  );
}
