// Helpers for resources of type "link" (a web address instead of a file).

/** Trims, and adds https:// when the admin typed an address without a scheme. */
export function normalizeLink(value: string | null | undefined): string {
  const v = (value ?? "").trim();
  if (!v || /^[a-z][a-z0-9+.-]*:(?!\d)/i.test(v)) return v;
  return `https://${v.replace(/^\/+/, "")}`;
}

/** True for an http(s) address with a real host name. */
export function isWebLink(value: string | null | undefined): boolean {
  try {
    const u = new URL((value ?? "").trim());
    return (u.protocol === "https:" || u.protocol === "http:") && u.hostname.includes(".");
  } catch {
    return false;
  }
}
