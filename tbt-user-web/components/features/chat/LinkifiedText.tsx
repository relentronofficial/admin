import type { ReactNode } from "react";
import { parseFormatting, type FmtNode } from "./chatFormatting";

// http(s):// links and bare www. links. Trailing punctuation is trimmed off below.
const URL_RE = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;
const MENTION_RE = /(@[A-Za-z0-9_]+)/g;
const TRAILING_PUNCT = /[.,!?;:'")\]}>*_~]+$/;
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
 * Chat message text with WhatsApp-style formatting (*bold*, _italic_, ~strike~,
 * __underline__, `code`, ```mono```, "> " quotes — see chatFormatting.ts). Links are
 * clickable (opened in a new tab), and with `mentions` @-mention tokens are highlighted
 * too (group chat).
 */
export function LinkifiedText({
  text,
  mentions = false,
  links = true,
}: {
  text: string;
  mentions?: boolean;
  /** false inside an element that is itself a link (e.g. a starred-message row). */
  links?: boolean;
}) {
  return <>{renderNodes(parseFormatting(text), mentions, links, "f")}</>;
}

const MONO_STYLE = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  fontSize: "0.9em",
} as const;

function renderNodes(nodes: FmtNode[], mentions: boolean, links: boolean, key: string): ReactNode[] {
  return nodes.map((n, i) => {
    const k = `${key}-${i}`;
    switch (n.type) {
      case "text":
        return links ? (
          <LinksAndMentions key={k} text={n.text} mentions={mentions} />
        ) : mentions ? (
          <span key={k}>{renderMentions(n.text, k)}</span>
        ) : (
          <span key={k}>{n.text}</span>
        );
      case "bold":
        return <strong key={k} className="font-semibold">{renderNodes(n.children, mentions, links, k)}</strong>;
      case "italic":
        return <em key={k} className="italic">{renderNodes(n.children, mentions, links, k)}</em>;
      case "strike":
        return <s key={k} className="line-through">{renderNodes(n.children, mentions, links, k)}</s>;
      case "underline":
        return <u key={k} className="underline underline-offset-2">{renderNodes(n.children, mentions, links, k)}</u>;
      case "code":
        return (
          <code
            key={k}
            className="px-1 py-px rounded"
            style={{ ...MONO_STYLE, background: "var(--color-surface-overlay)" }}
          >
            {n.text}
          </code>
        );
      case "mono":
        return <span key={k} style={MONO_STYLE}>{n.text}</span>;
      case "quote":
        return (
          <span
            key={k}
            className="block pl-2 my-0.5 opacity-80"
            style={{ borderLeft: "3px solid var(--color-accent)" }}
          >
            {renderNodes(n.children, mentions, links, k)}
          </span>
        );
    }
  });
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
