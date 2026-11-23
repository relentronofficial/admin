import type { ReactNode } from "react";
import { parseFormatting, type FmtNode } from "@/lib/utils/chatFormatting";

// Chat message text with WhatsApp-style formatting (*bold*, _italic_, ~strike~,
// __underline__, `code`, ```mono```, "> " quotes), rendered the same way the
// member site does. http(s) and www. links open in a new tab.

const URL_RE = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;
const TRAILING_PUNCT = /[.,!?;:'")\]}>*_~]+$/;
const MONO_STYLE = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", fontSize: "0.9em" } as const;

function linkify(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const start = m.index ?? 0;
    const url = m[0].slice(0, m[0].length - (m[0].match(TRAILING_PUNCT)?.[0].length ?? 0));
    if (!url) continue;
    if (start > last) out.push(text.slice(last, start));
    out.push(
      <a
        key={`${key}-${start}`}
        href={/^https?:\/\//i.test(url) ? url : `https://${url}`}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="underline underline-offset-2 break-all text-[#f87171]"
        onClick={(e) => e.stopPropagation()}
      >
        {url}
      </a>,
    );
    last = start + url.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function render(nodes: FmtNode[], key: string): ReactNode[] {
  return nodes.map((n, i) => {
    const k = `${key}-${i}`;
    switch (n.type) {
      case "text":
        return <span key={k}>{linkify(n.text, k)}</span>;
      case "bold":
        return <strong key={k} className="font-semibold">{render(n.children, k)}</strong>;
      case "italic":
        return <em key={k} className="italic">{render(n.children, k)}</em>;
      case "strike":
        return <s key={k} className="line-through">{render(n.children, k)}</s>;
      case "underline":
        return <u key={k} className="underline underline-offset-2">{render(n.children, k)}</u>;
      case "code":
        return <code key={k} className="px-1 py-px rounded bg-white/10" style={MONO_STYLE}>{n.text}</code>;
      case "mono":
        return <span key={k} style={MONO_STYLE}>{n.text}</span>;
      case "quote":
        return (
          <span key={k} className="block pl-2 my-0.5 opacity-80 border-l-[3px] border-[#dc2626]">
            {render(n.children, k)}
          </span>
        );
    }
  });
}

export function FormattedText({ text }: { text: string }) {
  return <>{render(parseFormatting(text), "f")}</>;
}
