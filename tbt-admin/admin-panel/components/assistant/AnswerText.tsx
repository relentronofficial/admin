import type { ReactNode } from "react";

// The assistant's answer: paragraphs, **bold**, lists, headings and simple
// tables. Links, images and HTML are deliberately shown as plain text.

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith("**") && p.endsWith("**") && p.length > 4 ? (
      <strong key={i} className="font-bold text-white">{p.slice(2, -2)}</strong>
    ) : (
      p
    ),
  );
}

const isRow = (l: string) => /^\s*\|.*\|\s*$/.test(l);
const isRule = (l: string) => /^\s*\|[\s:|-]+\|\s*$/.test(l) && l.includes("-");
const cells = (l: string) => l.trim().slice(1, -1).split("|").map((c) => c.trim());
const BULLET = /^\s*[-*•]\s+/;
const NUMBER = /^\s*\d+[.)]\s+/;

export function AnswerText({ text }: { text: string }) {
  const lines = text.split("\n");
  const out: ReactNode[] = [];
  for (let i = 0; i < lines.length; ) {
    const l = lines[i];
    if (!l.trim()) {
      i++;
    } else if (isRow(l) && i + 1 < lines.length && isRule(lines[i + 1])) {
      const head = cells(l);
      const rows: string[][] = [];
      const key = i;
      for (i += 2; i < lines.length && isRow(lines[i]); i++) rows.push(cells(lines[i]));
      out.push(
        <div key={key} className="overflow-x-auto rounded-lg border border-[#2a2a2a]">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#1a1a1a] text-[#a0a0a0]">
              <tr>{head.map((c, j) => <th key={j} className="px-3 py-2 font-semibold whitespace-nowrap">{inline(c)}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r, k) => (
                <tr key={k} className="border-t border-[#2a2a2a]">
                  {head.map((_, j) => <td key={j} className="px-3 py-2 align-top">{inline(r[j] ?? "")}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
    } else if (BULLET.test(l) || NUMBER.test(l)) {
      const re = BULLET.test(l) ? BULLET : NUMBER;
      const items: string[] = [];
      const key = i;
      for (; i < lines.length && re.test(lines[i]); i++) items.push(lines[i].replace(re, ""));
      const List = re === BULLET ? "ul" : "ol";
      out.push(
        <List key={key} className={`pl-5 space-y-1 ${re === BULLET ? "list-disc" : "list-decimal"}`}>
          {items.map((t, k) => <li key={k}>{inline(t)}</li>)}
        </List>,
      );
    } else {
      const heading = /^#{1,4}\s+(.*)/.exec(l);
      out.push(
        <p key={i} className={heading ? "font-bold text-white" : "whitespace-pre-wrap"}>{inline(heading ? heading[1] : l)}</p>,
      );
      i++;
    }
  }
  return <div className="space-y-2.5 text-sm leading-relaxed text-[#e0e0e0] break-words">{out}</div>;
}
