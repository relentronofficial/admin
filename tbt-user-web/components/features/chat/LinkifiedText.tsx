import type { ReactNode } from "react";

// http(s):// links and bare www. links. Trailing punctuation is trimmed off below.
const URL_RE = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;
const MENTION_RE = /(@[A-Za-z0-9_]+)/g;
const TRAILING_PUNCT = /[.,!?;:'")\]}>]+$/;

/** Splits text into plain chunks and links. Only http/https hrefs are ever produced. */
export function splitLinks(text: string): Array<{ text: string; href?: string }> {
  const out: Array<{ text: string; href?: string }> = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const start = m.index ?? 0;
    let url = m[0];
    // Keep a closing ")" that balances an opening "(" inside the URL (e.g. Wikipedia links).
    let trail = url.match(TRAILING_PUNCT)?.[0] ?? "";
    if (trail.startsWith(")") && (url.match(/\(/g)?.length ?? 0) > (url.slice(0, -trail.length).match(/\)/g)?.length ?? 0)) {
      trail = trail.slice(1);
    }
    if (trail) url = url.slice(0, -trail.length);
    if (!url) continue;
    if (start > last) out.push({ text: text.slice(last, start) });
    out.push({ text: url, href: /^https?:\/\//i.test(url) ? url : `https://${url}` });
    last = start + url.length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

function renderMentions(text: string, keyPrefix: string): ReactNode[] {
  return text.split(MENTION_RE).map((chunk, i) =>
    chunk.startsWith("@") && chunk.length > 1 ? (
      <span key={`${keyPrefix}-${i}`} className="font-semibold" style={{ color: "var(--color-accent)" }}>
        {chunk}
      </span>
    ) : (
      <span key={`${keyPrefix}-${i}`}>{chunk}</span>
    ),
  );
}

/**
 * Chat message text with clickable links (opened in a new tab). With `mentions`,
 * @-mention tokens are highlighted too (group chat).
 */
export function LinkifiedText({ text, mentions = false }: { text: string; mentions?: boolean }) {
  return (
    <>
      {splitLinks(text).map((part, i) =>
        part.href ? (
          <a
            key={i}
            href={part.href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="underline underline-offset-2 break-all"
            style={{ color: "var(--color-accent)" }}
            // Don't let the bubble's own click/long-press handlers swallow the link.
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            {part.text}
          </a>
        ) : mentions ? (
          renderMentions(part.text, String(i))
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}
