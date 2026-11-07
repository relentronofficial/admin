// Resource file links must be web URLs. A browser-local path such as
// file:///C:/Users/.../x.pdf (what the address bar shows for a PDF opened from
// disk) works only on the admin's own computer; for every member the Download
// button is dead. Only http(s) links are accepted.

/** True for an absolute http:// or https:// URL. */
export function isWebUrl(value: unknown): boolean {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const u = new URL(value.trim());
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Error message for a resource body whose link fields are not web URLs, or
 * null when they are fine. Only fields present in the body are checked;
 * an empty optional field (previewUrl) is allowed.
 */
export function resourceUrlError(body: Record<string, unknown>, required: string[] = ['fileUrl'], optional: string[] = ['previewUrl']): string | null {
  for (const f of required) {
    if (body[f] === undefined) continue;
    if (!isWebUrl(body[f])) return `${f} must be an http(s) link. Upload the file with the upload button, or paste a public https:// URL; a local file path (file://, C:\\...) can't be opened by members.`;
  }
  for (const f of optional) {
    const v = body[f];
    if (v === undefined || v === null || v === '') continue;
    if (!isWebUrl(v)) return `${f} must be an http(s) link, or left empty.`;
  }
  return null;
}

/**
 * Public CDN URL for a storage key, with each path segment percent-encoded so a
 * filename containing spaces, #, ? or % still points at the stored object.
 * The key itself (what R2 stores) is unchanged; the CDN decodes the path.
 */
export function cdnObjectUrl(cdnBase: string | undefined, key: string): string {
  const base = (cdnBase ?? '').trim();
  const origin = (base.startsWith('http') ? base : `https://${base}`).replace(/\/+$/, '');
  return `${origin}/${key.split('/').map(encodeURIComponent).join('/')}`;
}
