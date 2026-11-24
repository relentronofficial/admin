"use client";

/**
 * TBT Assistant — floating help chat (bottom-right on every platform page).
 * Answers stream from POST /api/help-bot/chat. Hidden when the backend says
 * the assistant is not enabled. History lives in sessionStorage (this tab only).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Send, X, RotateCcw } from "lucide-react";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";
import { usePodcastPlayer } from "@/lib/stores/usePodcastPlayer";
import { getHelpBotStatus, streamHelpBotChat, type HelpBotTurn } from "@/lib/api/services/helpBot.service";

const STORAGE_KEY = "tbt_help_bot_history";
const MAX_INPUT = 1500;

function BotAvatar({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="20" fill="var(--color-accent)" />
      <rect x="10" y="13" width="20" height="16" rx="6" fill="#fff" />
      <circle cx="16" cy="21" r="2.2" fill="var(--color-accent)" />
      <circle cx="24" cy="21" r="2.2" fill="var(--color-accent)" />
      <path d="M17 25.5c1.8 1.2 4.2 1.2 6 0" stroke="var(--color-accent)" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <line x1="20" y1="13" x2="20" y2="9" stroke="#fff" strokeWidth="1.6" />
      <circle cx="20" cy="8" r="1.8" fill="#fff" />
    </svg>
  );
}

// ── Tiny, safe Markdown: **bold**, lists, [label](/in-app-path) ──────────────

function inline(text: string, key: string, onNavigate: () => void): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      out.push(<strong key={`${key}-b${i++}`}>{m[1]}</strong>);
    } else {
      const href = m[3];
      // Only in-app paths become links; anything else stays plain text.
      if (/^\/(?!\/)[\w\-/?=&%.#]*$/.test(href)) {
        out.push(
          <Link key={`${key}-l${i++}`} href={href} onClick={onNavigate} className="underline font-medium" style={{ color: "var(--color-accent)" }}>
            {m[2]}
          </Link>,
        );
      } else {
        out.push(m[2]);
      }
    }
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Markdown({ text, onNavigate }: { text: string; onNavigate: () => void }) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r/g, "").split("\n");
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const k = `list-${blocks.length}`;
    const items = list.items.map((it, j) => <li key={`${k}-${j}`}>{inline(it, `${k}-${j}`, onNavigate)}</li>);
    blocks.push(list.ordered
      ? <ol key={k} className="list-decimal pl-5 space-y-1">{items}</ol>
      : <ul key={k} className="list-disc pl-5 space-y-1">{items}</ul>);
    list = null;
  };
  lines.forEach((raw, idx) => {
    const line = raw.replace(/^#{1,6}\s+/, "");
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const ul = /^\s*[-*•]\s+(.*)$/.exec(line);
    if (ol || ul) {
      const ordered = !!ol;
      if (!list || list.ordered !== ordered) { flush(); list = { ordered, items: [] }; }
      list.items.push((ol ?? ul)![1]);
      return;
    }
    flush();
    if (line.trim()) blocks.push(<p key={`p-${idx}`}>{inline(line, `p-${idx}`, onNavigate)}</p>);
  });
  flush();
  return <div className="space-y-2 break-words">{blocks}</div>;
}

// ── Widget ───────────────────────────────────────────────────────────────────

export function HelpBotWidget() {
  const pathname = usePathname() || "/";
  const { uiStrings } = useSiteConfig();
  const t = useCallback(
    (key: string, fallback: string) => ((uiStrings as unknown as Record<string, unknown> | null)?.[key] as string | undefined) || fallback,
    [uiStrings],
  );
  const podcastOpen = usePodcastPlayer((s) => !!s.episode);

  const { data: status } = useQuery({
    queryKey: ["help-bot", "status"],
    queryFn: getHelpBotStatus,
    staleTime: 10 * 60_000,
    retry: 1,
  });

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<HelpBotTurn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Restore / persist this tab's conversation.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setMessages(parsed.filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string"));
      }
    } catch { /* storage unavailable */ }
  }, []);
  useEffect(() => {
    if (busy) return;
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30))); } catch { /* ignore */ }
  }, [messages, busy]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, open]);
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const suggestions = useMemo(() => [
    t("helpBotSuggestion1", "How do I buy a course?"),
    t("helpBotSuggestion2", "Why are my videos locked?"),
    t("helpBotSuggestion3", "How do I book an expert support call?"),
    t("helpBotSuggestion4", "How do I submit my weekly report?"),
  ], [t]);

  const ask = useCallback(async (question: string, base?: HelpBotTurn[]) => {
    const q = question.trim().slice(0, MAX_INPUT);
    if (!q || busy) return;
    setError(null);
    setInput("");
    const history: HelpBotTurn[] = [...(base ?? messages), { role: "user", content: q }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setBusy(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let answer = "";
    let failed: string | null = null;
    const update = () => setMessages([...history, { role: "assistant", content: answer }]);
    try {
      await streamHelpBotChat(history, pathname, (ev) => {
        if (ev.t === "delta") { answer += ev.text; update(); }
        else if (ev.t === "reset") { answer = ""; update(); }
        else if (ev.t === "error") { failed = ev.message || ""; }
      }, ctrl.signal);
    } catch {
      if (!ctrl.signal.aborted) failed = "";
    }
    if (failed !== null || !answer.trim()) {
      // Drop the empty/failed answer; keep the question so they can retry.
      setMessages(answer.trim() ? [...history, { role: "assistant", content: answer }] : history);
      if (!ctrl.signal.aborted) setError(failed || t("helpBotError", "Sorry, I couldn't answer just now. Please try again."));
    }
    setBusy(false);
    abortRef.current = null;
  }, [busy, messages, pathname, t]);

  const retry = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    void ask(lastUser.content, messages.slice(0, messages.lastIndexOf(lastUser)));
  };

  const reset = () => {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    setBusy(false);
    try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  };

  if (!status?.enabled) return null;

  const bottom = podcastOpen ? "calc(6.5rem + env(safe-area-inset-bottom, 0px))" : "calc(1rem + env(safe-area-inset-bottom, 0px))";
  const title = t("helpBotTitle", "TBT Assistant");
  const lastIsUser = messages.length > 0 && messages[messages.length - 1].role === "user";

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t("helpBotOpenLabel", "Ask TBT Assistant")}
          className="fixed right-4 z-40 rounded-full shadow-lg transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2"
          style={{ bottom, boxShadow: "0 8px 28px rgba(0,0,0,0.35)" }}
        >
          <BotAvatar size={56} />
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label={title}
          className="fixed z-50 flex flex-col overflow-hidden inset-x-0 bottom-0 top-16 rounded-t-2xl sm:inset-auto sm:right-4 sm:top-auto sm:bottom-[var(--hb-bottom)] sm:w-[380px] sm:h-[min(600px,calc(100vh-7rem))] sm:rounded-2xl"
          style={{
            ["--hb-bottom" as string]: bottom,
            background: "var(--color-modal-bg)",
            border: "1px solid var(--color-border-medium)",
            boxShadow: "0 16px 48px rgba(0,0,0,0.45)",
            color: "var(--color-text-normal)",
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--color-border-medium)" }}>
            <BotAvatar size={36} />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">{title}</div>
              <div className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                {t("helpBotSubtitle", "Ask anything about the app")}
              </div>
            </div>
            {messages.length > 0 && (
              <button type="button" onClick={reset} aria-label={t("helpBotNewChat", "New chat")} title={t("helpBotNewChat", "New chat")}
                className="p-2 rounded-lg hover:opacity-80" style={{ color: "var(--color-text-secondary)" }}>
                <RotateCcw size={16} />
              </button>
            )}
            <button type="button" onClick={() => setOpen(false)} aria-label={t("helpBotClose", "Close")}
              className="p-2 rounded-lg hover:opacity-80" style={{ color: "var(--color-text-secondary)" }}>
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 text-sm leading-relaxed" aria-live="polite">
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="shrink-0"><BotAvatar size={28} /></div>
                  <div className="rounded-2xl rounded-tl-sm px-3 py-2" style={{ background: "var(--color-surface-overlay-md, rgba(127,127,127,0.12))" }}>
                    {t("helpBotGreeting", "Hi! I'm your TBT Assistant. Ask me how to use the app — courses, payments, mentorship, support calls, weekly reports and more.")}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pl-9">
                  {suggestions.map((s) => (
                    <button key={s} type="button" onClick={() => ask(s)}
                      className="text-xs rounded-full px-3 py-1.5 text-left hover:opacity-80"
                      style={{ border: "1px solid var(--color-accent)", color: "var(--color-accent)" }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-tr-sm px-3 py-2 whitespace-pre-wrap break-words"
                  style={{ background: "var(--color-accent)", color: "#fff" }}>
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={i} className="flex gap-2">
                <div className="shrink-0"><BotAvatar size={28} /></div>
                <div className="max-w-[85%] rounded-2xl rounded-tl-sm px-3 py-2"
                  style={{ background: "var(--color-surface-overlay-md, rgba(127,127,127,0.12))" }}>
                  {m.content
                    ? <Markdown text={m.content} onNavigate={() => { if (window.innerWidth < 640) setOpen(false); }} />
                    : (
                      <span className="inline-flex gap-1 py-1" aria-label={t("helpBotThinking", "Thinking")}>
                        <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "var(--color-text-secondary)" }} />
                        <span className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:120ms]" style={{ background: "var(--color-text-secondary)" }} />
                        <span className="w-1.5 h-1.5 rounded-full animate-bounce [animation-delay:240ms]" style={{ background: "var(--color-text-secondary)" }} />
                      </span>
                    )}
                </div>
              </div>
            ))}

            {error && (
              <div className="text-xs rounded-lg px-3 py-2 flex items-center justify-between gap-2"
                style={{ background: "color-mix(in srgb, var(--color-alert) 12%, transparent)", color: "var(--color-alert)" }}>
                <span>{error}</span>
                {lastIsUser && !busy && (
                  <button type="button" onClick={retry} className="underline shrink-0">{t("helpBotRetry", "Try again")}</button>
                )}
              </div>
            )}
          </div>

          {/* Composer */}
          <form
            onSubmit={(e) => { e.preventDefault(); void ask(input); }}
            className="flex items-end gap-2 px-3 py-3"
            style={{ borderTop: "1px solid var(--color-border-medium)" }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, MAX_INPUT))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void ask(input); }
              }}
              rows={1}
              placeholder={t("helpBotPlaceholder", "Type your question…")}
              aria-label={t("helpBotPlaceholder", "Type your question…")}
              className="flex-1 resize-none rounded-xl px-3 py-2 text-sm outline-none max-h-32"
              style={{ background: "var(--color-surface-overlay-xs, rgba(127,127,127,0.08))", border: "1px solid var(--color-border-medium)", color: "var(--color-text-normal)" }}
            />
            <button type="submit" disabled={busy || !input.trim()} aria-label={t("helpBotSend", "Send")}
              className="h-10 w-10 shrink-0 rounded-xl flex items-center justify-center disabled:opacity-40"
              style={{ background: "var(--color-accent)", color: "#fff" }}>
              <Send size={16} />
            </button>
          </form>
          <div className="px-4 -mt-1 text-[10px] text-center" style={{ color: "var(--color-text-subtle)", paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom, 0px))" }}>
            {t("helpBotDisclaimer", "AI answers can be wrong. For account or payment issues, raise a ticket in Support.")}
          </div>
        </div>
      )}
    </>
  );
}
