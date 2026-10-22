// Copy a chat message's text to the clipboard. Used by the Copy action in
// direct conversations and in group chats.
//
// Returns what actually happened so callers never report a false success:
//   "copied" — the text is on the clipboard
//   "empty"  — the message has no text (e.g. an image-only message)
//   "failed" — the browser refused clipboard access

export type CopyResult = "copied" | "empty" | "failed";

/** Last-resort copy for browsers/contexts without the async Clipboard API (e.g. non-HTTPS). */
function legacyCopy(text: string): boolean {
  if (typeof document === "undefined") return false;
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.top = "-1000px";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(area);
  return ok;
}

export async function copyMessageText(body: string | null | undefined): Promise<CopyResult> {
  const text = typeof body === "string" ? body : "";
  if (!text.trim()) return "empty";
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return "copied";
    } catch {
      // Permission denied or not focused — try the legacy path before giving up.
    }
  }
  return legacyCopy(text) ? "copied" : "failed";
}

/** User-facing note for a message with nothing to copy. */
export function noTextToCopyMessage(mediaType: string | null | undefined): string {
  if (mediaType === "image") return "This is an image — there's no text to copy";
  if (mediaType) return `This ${mediaType === "audio" ? "voice note" : mediaType} has no text to copy`;
  return "This message has no text to copy";
}
