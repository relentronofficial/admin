import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { useState } from "react";
import { PhoneInput, DEFAULT_PHONE, phoneStatus, phoneToE164, readPhoneInput, type PhoneValue } from "./PhoneInput";

afterEach(cleanup);

function Harness({ onValue }: { onValue: (v: PhoneValue) => void }) {
  const [v, setV] = useState<PhoneValue>(DEFAULT_PHONE);
  return <PhoneInput value={v} onChange={(n) => { setV(n); onValue(n); }} />;
}

describe("readPhoneInput (typing, pasting, autofill)", () => {
  it("an autofilled international number switches the country instead of truncating it", () => {
    expect(readPhoneInput("+44 7400 123456", "IN")).toEqual({ country: "GB", national: "7400123456" });
    expect(readPhoneInput("+1 (202) 555-0147", "IN")).toEqual({ country: "US", national: "2025550147" });
    expect(readPhoneInput("+65 9123 4567", "IN")).toEqual({ country: "SG", national: "91234567" });
    expect(readPhoneInput("0044 7400 123456", "IN")).toEqual({ country: "GB", national: "7400123456" });
  });

  it("national digits stay in the selected country; nothing is cut off", () => {
    expect(readPhoneInput("98765 43210", "IN")).toEqual({ country: "IN", national: "9876543210" });
    expect(readPhoneInput("919876543210", "IN")).toEqual({ country: "IN", national: "9876543210" });
    expect(readPhoneInput("7400123456789", "GB").national).toBe("7400123456789"); // too long is reported, not silently truncated
  });
});

describe("phoneStatus / phoneToE164", () => {
  it("incomplete numbers are never valid and give no E.164", () => {
    expect(phoneStatus({ country: "GB", national: "7400" })).toBe("incomplete");
    expect(phoneToE164({ country: "GB", national: "7400" })).toBeNull();
    expect(phoneStatus({ country: "IN", national: "98765" })).toBe("incomplete");
    expect(phoneStatus({ country: "IN", national: "" })).toBe("empty");
  });

  it("complete numbers follow each country's rules", () => {
    expect(phoneToE164({ country: "IN", national: "9876543210" })).toBe("+919876543210");
    expect(phoneToE164({ country: "GB", national: "07400123456" })).toBe("+447400123456"); // trunk 0 handled
    expect(phoneToE164({ country: "AE", national: "501234567" })).toBe("+971501234567");
    expect(phoneStatus({ country: "US", national: "0125550147" })).toBe("invalid");
    expect(phoneStatus({ country: "GB", national: "74001234567890" })).toBe("too_long");
  });
});

describe("PhoneInput", () => {
  it("offers every country with its calling code, India by default", () => {
    render(<Harness onValue={() => {}} />);
    const select = screen.getByLabelText("Country code") as HTMLSelectElement;
    expect(select.value).toBe("IN");
    expect(select.options.length).toBeGreaterThan(200);
    expect([...select.options].some((o) => o.textContent?.startsWith("GB +44"))).toBe(true);
  });

  it("an autofilled +44 number moves the picker to the UK and keeps every digit", () => {
    let last: PhoneValue = DEFAULT_PHONE;
    render(<Harness onValue={(v) => (last = v)} />);
    fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "+447400123456" } });
    expect((screen.getByLabelText("Country code") as HTMLSelectElement).value).toBe("GB");
    expect(last).toEqual({ country: "GB", national: "7400123456" });
    expect(phoneToE164(last)).toBe("+447400123456");
  });

  it("changing the country keeps the typed number and re-validates it for that country", () => {
    let last: PhoneValue = DEFAULT_PHONE;
    render(<Harness onValue={(v) => (last = v)} />);
    fireEvent.change(screen.getByLabelText("Phone number"), { target: { value: "501234567" } });
    expect(phoneStatus(last)).not.toBe("valid"); // not an Indian number
    fireEvent.change(screen.getByLabelText("Country code"), { target: { value: "AE" } });
    expect(phoneToE164(last)).toBe("+971501234567");
  });
});
