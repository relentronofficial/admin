// WhatsApp-style chat text formatting, parsed into a small node tree that the
// chat views render. Pure (no React) so it can be unit-tested.
//
//   *bold*   **bold** (pasted markdown)   _italic_   ~strikethrough~
//   __underline__   `inline code`   ```monospace block```   "> " quote line
//
// Like WhatsApp, a marker only counts at a word edge: the opening marker must
// follow the start of the text, a space or punctuation and be followed by a
// non-space; the closing marker mirrors that. So snake_case_names, 2*3*4 and
// "a * b * c" stay as typed. Inline markers never span lines, and markers
// that fall inside a link are ignored so URLs stay intact.
// Copy of tbt-user-web/components/features/chat/chatFormatting.ts (the member
// site). Keep the two in sync.

export type FmtStyle = "bold" | "italic" | "strike" | "underline";

export type FmtNode =
  | { type: "text"; text: string }
  | { type: FmtStyle; children: FmtNode[] }
  | { type: "code"; text: string }
  | { type: "mono"; text: string }
  | { type: "quote"; children: FmtNode[] };

// http(s):// links and bare www. links. Kept in step with LinkifiedText's URL_RE.
const URL_RE = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;
const URL_TRAILING = /[.,!?;:'")\]}>*_~]+$/;

const INLINE_RULES: Array<{ type: FmtStyle | "code"; re: RegExp; len: number }> = [
  // Doubled markers first so "**x**" is not read as "*" + "*x*" + "*".
  { type: "bold", re: /\*\*(?=\S)([^\n]*?\S)\*\*/g, len: 2 },
  { type: "underline", re: /__(?=\S)([^\n]*?\S)__/g, len: 2 },
  { type: "code", re: /`(?=\S)([^`\n]*?\S)`/g, len: 1 },
  { type: "bold", re: /\*(?=\S)([^\n]*?\S)\*/g, len: 1 },
  { type: "italic", re: /_(?=\S)([^\n]*?\S)_/g, len: 1 },
  { type: "strike", re: /~(?=\S)([^\n]*?\S)~/g, len: 1 },
];

const WORD_CHAR = /[\p{L}\p{N}]/u;
const isEdge = (ch: string | undefined) => ch === undefined || !WORD_CHAR.test(ch);

function urlRanges(text: string): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (const m of text.matchAll(URL_RE)) {
    const start = m.index ?? 0;
    const trail = m[0].match(URL_TRAILING)?.[0] ?? "";
    out.push([start, start + m[0].length - trail.length]);
  }
  return out;
}

const inRanges = (i: number, ranges: Array<[number, number]>) => ranges.some(([s, e]) => i >= s && i < e);

function pushText(out: FmtNode[], text: string) {
  if (!text) return;
  const last = out[out.length - 1];
  if (last && last.type === "text") last.text += text;
  else out.push({ type: "text", text });
}

/** First valid match of `rule` at or after `from`, honouring word edges and links. */
function findMatch(text: string, rule: (typeof INLINE_RULES)[number], from: number, links: Array<[number, number]>) {
  rule.re.lastIndex = from;
  let m: RegExpExecArray | null;
  while ((m = rule.re.exec(text))) {
    const start = m.index;
    const end = start + m[0].length;
    const closeAt = end - rule.len;
    const ok =
      isEdge(text[start - 1]) &&
      isEdge(text[end]) &&
      // a single marker must not sit right against the same marker ("***")
      !(rule.len === 1 && (text[start - 1] === m[0][0] || text[end] === m[0][0])) &&
      !inRanges(start, links) &&
      !inRanges(closeAt, links);
    if (ok) return { start, end, inner: m[1]! };
    rule.re.lastIndex = start + 1;
  }
  return null;
}

function parseInline(text: string): FmtNode[] {
  const out: FmtNode[] = [];
  const links = urlRanges(text);
  let pos = 0;
  while (pos < text.length) {
    let best: { start: number; end: number; inner: string; rule: (typeof INLINE_RULES)[number] } | null = null;
    for (const rule of INLINE_RULES) {
      const m = findMatch(text, rule, pos, links);
      if (m && (!best || m.start < best.start)) best = { ...m, rule };
    }
    if (!best) break;
    pushText(out, text.slice(pos, best.start));
    if (best.rule.type === "code") out.push({ type: "code", text: best.inner });
    else out.push({ type: best.rule.type, children: parseInline(best.inner) });
    pos = best.end;
  }
  pushText(out, text.slice(pos));
  return out;
}

/** Lines starting with "> " become quote blocks; everything else is inline text. */
function parseLines(text: string): FmtNode[] {
  const out: FmtNode[] = [];
  const lines = text.split("\n");
  let i = 0;
  while (i < lines.length) {
    if (/^> /.test(lines[i]!)) {
      const quoted: string[] = [];
      while (i < lines.length && /^> /.test(lines[i]!)) quoted.push(lines[i++]!.slice(2));
      out.push({ type: "quote", children: parseInline(quoted.join("\n")) });
      continue;
    }
    // The quote is a block, so the line breaks on either side of it are implied.
    const plain: string[] = [];
    while (i < lines.length && !/^> /.test(lines[i]!)) plain.push(lines[i++]!);
    for (const n of parseInline(plain.join("\n"))) out.push(n);
  }
  return out;
}

/** Parses chat message text into formatting nodes. */
export function parseFormatting(text: string): FmtNode[] {
  const out: FmtNode[] = [];
  const MONO_RE = /```([\s\S]+?)```/g;
  let last = 0;
  for (const m of text.matchAll(MONO_RE)) {
    const start = m.index ?? 0;
    for (const n of parseLines(text.slice(last, start))) out.push(n);
    out.push({ type: "mono", text: m[1]! });
    last = start + m[0].length;
  }
  for (const n of parseLines(text.slice(last))) out.push(n);
  return out;
}

function plain(nodes: FmtNode[]): string {
  return nodes
    .map((n) => (n.type === "text" || n.type === "code" || n.type === "mono" ? n.text : plain(n.children)))
    .join("");
}

/** The text with formatting markers removed — for one-line previews (chat list, reply quotes). */
export function stripFormatting<T extends string | null | undefined>(text: T): T {
  return (text ? plain(parseFormatting(text)) : text) as T;
}

// ── Composer shortcuts (as in WhatsApp Web) ─────────────────────────────────
// Ctrl/⌘+B bold · Ctrl/⌘+I italic · Ctrl/⌘+U underline
// Ctrl/⌘+Shift+X strikethrough · Ctrl/⌘+Shift+M monospace

const SHORTCUT_MARKERS: Record<string, string> = { b: "*", i: "_", u: "__" };
const SHIFT_SHORTCUT_MARKERS: Record<string, string> = { x: "~", m: "```" };

/**
 * Wraps value[start, end) in `marker` (or unwraps it when it is already wrapped).
 * With nothing selected it inserts an empty pair and puts the caret inside.
 * Spaces at the edges of the selection stay outside the markers.
 */
export function toggleWrap(value: string, start: number, end: number, marker: string) {
  while (start < end && /\s/.test(value[start]!)) start++;
  while (end > start && /\s/.test(value[end - 1]!)) end--;
  const m = marker.length;
  if (start >= m && value.slice(start - m, start) === marker && value.slice(end, end + m) === marker) {
    return {
      value: value.slice(0, start - m) + value.slice(start, end) + value.slice(end + m),
      selStart: start - m,
      selEnd: end - m,
    };
  }
  return {
    value: value.slice(0, start) + marker + value.slice(start, end) + marker + value.slice(end),
    selStart: start + m,
    selEnd: end + m,
  };
}

/**
 * Call from a composer textarea's onKeyDown. Returns true (and calls `setValue`)
 * when the key was a formatting shortcut; the selection is restored afterwards.
 */
export function handleFormatShortcut(
  e: { key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean; preventDefault(): void; currentTarget: HTMLTextAreaElement | HTMLInputElement },
  setValue: (value: string) => void,
): boolean {
  if (!(e.ctrlKey || e.metaKey) || e.altKey) return false;
  const key = e.key.toLowerCase();
  const marker = e.shiftKey ? SHIFT_SHORTCUT_MARKERS[key] : SHORTCUT_MARKERS[key];
  if (!marker) return false;
  e.preventDefault();
  const el = e.currentTarget;
  const next = toggleWrap(el.value, el.selectionStart ?? el.value.length, el.selectionEnd ?? el.value.length, marker);
  setValue(next.value);
  requestAnimationFrame(() => {
    el.focus();
    el.setSelectionRange(next.selStart, next.selEnd);
  });
  return true;
}
