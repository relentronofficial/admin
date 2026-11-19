import type { ReactNode } from "react";

// http(s):// links and bare www. links. Trailing punctuation is trimmed off below.
const URL_RE = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;
const MENTION_RE = /(@[A-Za-z0-9_]+)/g;
const TRAILING_PUNCT = /[.,!?;:'")\]}>]+$/;
// Markdown bold: **text** (as pasted from ChatGPT/Claude). The inner text must not start
// or end with a space, so a lone "**" or "2 ** 3" stays as typed.
const BOLD_RE = /\*\*(?=\S)([\s\S]*?\S)\*\*/g;

/** Splits text into plain and bold chunks; the ** markers are removed from bold chunks. */
export function splitBold(text: string): Array<{ text: string; bold?: boolean }> {
  const out: Array<{ text: string; bold?: boolean }> = [];
  let last = 0;
  for (const m of text.matchAll(BOLD_RE)) {
    const start = m.index ?? 0;
    if (start > last) out.push({ text: text.slice(last, start) });
    out.push({ text: m[1]!, bold: true });
    last = start + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

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
 * Chat message text: **bold** markdown is rendered bold, links are clickable (opened in
 * a new tab), and with `mentions` @-mention tokens are highlighted too (group chat).
 */
export function LinkifiedText({ text, mentions = false }: { text: string; mentions?: boolean }) {
  return (
    <>
      {splitBold(text).map((chunk, b) =>
        chunk.bold ? (
          <strong key={b} className="font-semibold">
            <LinksAndMentions text={chunk.text} mentions={mentions} />
          </strong>
        ) : (
          <LinksAndMentions key={b} text={chunk.text} mentions={mentions} />
        ),
      )}
    </>
  );
}

function LinksAndMentions({ text, mentions }: { text: string; mentions: boolean }) {
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
