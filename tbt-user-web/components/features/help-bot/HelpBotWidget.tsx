"use client";

/**
 * TBT Assistant — floating help chat (bottom-right). Only members the
 * backend has opened it to can chat; the others get a "coming soon" note. Chats are kept on the server. Answers are text;
 * voice is made only when "Request voice" is pressed.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Copy, History, Loader2, Maximize2, Minimize2, Plus, Send, Sparkles, Square, ThumbsDown, ThumbsUp, Trash2, Volume2, X } from "lucide-react";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";
import { usePodcastPlayer } from "@/lib/stores/usePodcastPlayer";
import { playPcm, unlockAudio } from "@/lib/audio/pcmPlayer";
import { fetchHelpBotSpeech, getHelpBotStatus, helpBotService, streamHelpBotChat, type HelpBotMessage } from "@/lib/api/services/helpBot.service";
import { ActionCard, type T } from "./ActionCard";
import { useAiCreditWallet, useRefreshAiCredits } from "@/lib/hooks/useAiCredits";

const CHAT_KEY = "tbt_help_bot_chat"; // the open chat's id, for this tab
const UNSAVED = "unsaved-"; // an answer the server could not keep: nothing to rate or voice
/** Pages where a floating button would get in the way. */
const HIDDEN_ON = ["/live", "/onboarding", "/psychometric"];

const TOOL_LABELS: Record<string, string> = {
  getMyProgress: "your progress", getMyTasks: "your tasks", getMyCourses: "your courses", getMyLessons: "your lessons",
  getMyPoints: "your coins", getMyPayments: "your payments", getMySupportQuota: "your calls", getMyUpcomingCalls: "your calls",
  getCallSlots: "open slots", getMyTickets: "your tickets", getMyTicket: "your ticket", searchHelp: "help answers",
  searchCommunity: "community posts", searchLibrary: "the library", getUpcomingEvents: "events", getMyHabits: "your habits",
};
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

function suggestionsFor(path: string, t: T): string[] {
  if (/^\/(learning|courses)/.test(path)) return [t("helpBotSugCourse1", "Where did I stop in my course?"), t("helpBotSugCourse2", "Why is my next lesson locked?"), t("helpBotSugCourse3", "How do I get my certificate?")];
  if (/^\/(mentorship|batch-program)/.test(path)) return [t("helpBotSugMentor1", "What are my tasks today?"), t("helpBotSugMentor2", "How many expert calls do I have left?"), t("helpBotSugMentor3", "Book a sales call for me")];
  if (path.startsWith("/support")) return [t("helpBotSugSupport1", "What's the status of my tickets?"), t("helpBotSugSupport2", "I paid but my course isn't open")];
  if (path.startsWith("/community")) return [t("helpBotSugCommunity1", "Any posts about Instagram ads?"), t("helpBotSugCommunity2", "Any events coming up?"), t("helpBotSugCommunity3", "What should I do today?")];
  return [t("helpBotSugAny1", "What should I do today?"), t("helpBotSugAny2", "How many coins do I have?"), t("helpBotSugAny3", "Show my habits for today"), t("helpBotSugAny4", "Any events coming up?")];
}

export function HelpBotWidget() {
  const pathname = usePathname() || "/";
  const { data: status } = useQuery({
    queryKey: ["help-bot", "status"],
    queryFn: getHelpBotStatus,
    staleTime: 10 * 60_000,
    retry: 1,
  });
  const hidden = HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!status || hidden) return null;
  if (status.enabled) return <Chat pathname={pathname} />;
  return status.comingSoon ? <ComingSoon /> : null;
}

function ComingSoon() {
  const { uiStrings } = useSiteConfig();
  const t: T = (key, fallback) => ((uiStrings as unknown as Record<string, unknown> | null)?.[key] as string | undefined) || fallback;
  const podcastOpen = usePodcastPlayer((s) => !!s.episode);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const title = t("helpBotComingSoonTitle", "Coming Soon");
  return (
    <div className="fixed right-4 z-40 flex flex-col items-end gap-3" style={{ bottom: podcastOpen ? "calc(6.5rem + env(safe-area-inset-bottom, 0px))" : "calc(1rem + env(safe-area-inset-bottom, 0px))" }}>
      {open && (
        <div
          role="dialog"
          aria-label={title}
          className="relative w-[min(300px,calc(100vw-2rem))] rounded-2xl p-5 text-center"
          style={{ background: "var(--color-modal-bg)", border: "1px solid var(--color-border-medium)", boxShadow: "0 16px 48px rgba(0,0,0,0.45)", color: "var(--color-text-normal)" }}
        >
          <button type="button" onClick={() => setOpen(false)} aria-label={t("helpBotClose", "Close")} className="absolute right-2 top-2 h-9 w-9 grid place-items-center rounded-lg hover:opacity-70" style={{ color: "var(--color-text-secondary)" }}>
            <X size={16} />
          </button>
          <div className="flex justify-center"><BotAvatar size={44} /></div>
          <p className="mt-3 font-semibold">{title}</p>
          <p className="mt-1 text-sm" style={{ color: "var(--color-text-secondary)" }}>
            {t("helpBotComingSoonText", "Feature in progress. TBT Assistant will be here for you soon!")}
          </p>
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={t("helpBotOpenLabel", "Ask TBT Assistant")}
        className="rounded-full shadow-lg transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2"
        style={{ boxShadow: "0 8px 28px rgba(0,0,0,0.35)" }}
      >
        <BotAvatar size={56} />
      </button>
    </div>
  );
}

function Chat({ pathname }: { pathname: string }) {
  const qc = useQueryClient();
  const { uiStrings } = useSiteConfig();
  const t = useCallback<T>(
    (key, fallback) => ((uiStrings as unknown as Record<string, unknown> | null)?.[key] as string | undefined) || fallback,
    [uiStrings],
  );
  const podcastOpen = usePodcastPlayer((s) => !!s.episode);

  const [open, setOpen] = useState(false);
  const [wide, setWide] = useState(false);
  const [view, setView] = useState<"chat" | "history">("chat");
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<HelpBotMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState("");
  const [error, setError] = useState<string | null>(null);
  /** The member had too few AI credits for the last question. */
  const [needsCredits, setNeedsCredits] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState<{ id: string; loading: boolean } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const loadRef = useRef(0);
  const speakRef = useRef<AbortController | null>(null);
  // Answers already voiced here: playing one again costs nothing.
  const voicedRef = useRef(new Map<string, Blob>());
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const { data: wallet } = useAiCreditWallet(open);
  const refreshCredits = useRefreshAiCredits();
  const charging = !!wallet?.chargingEnabled;

  const { data: chats, isLoading: chatsLoading } = useQuery({
    queryKey: ["help-bot", "conversations"],
    queryFn: helpBotService.conversations,
    enabled: open && view === "history",
  });

  const remember = (id: string | null) => {
    setChatId(id);
    try {
      if (id) sessionStorage.setItem(CHAT_KEY, id);
      else sessionStorage.removeItem(CHAT_KEY);
    } catch { /* storage unavailable */ }
  };

  const stopSpeaking = () => {
    speakRef.current?.abort();
    speakRef.current = null;
    setSpeaking(null);
  };

  /** Leaves whatever is open, stopping its answer and voice. Returns this view's turn. */
  const leave = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    stopSpeaking();
    setBusy(false);
    setError(null);
    setNeedsCredits(false);
    setMessages([]);
    setView("chat");
    return ++loadRef.current;
  };

  async function openChat(id: string, quiet = false) {
    const turn = leave();
    setLoading(true);
    try {
      const m = await helpBotService.conversation(id);
      if (loadRef.current !== turn) return;
      setMessages(m);
      remember(id);
    } catch {
      if (loadRef.current !== turn) return;
      remember(null);
      if (!quiet) setError(t("helpBotOpenFailed", "Couldn't open this chat."));
    } finally {
      if (loadRef.current === turn) setLoading(false);
    }
  }

  const newChat = () => {
    leave();
    setLoading(false);
    remember(null);
  };

  // Carry on this tab's chat the first time the box opens.
  const restored = useRef(false);
  const openBox = () => {
    setOpen(true);
    if (restored.current) return;
    restored.current = true;
    let id: string | null = null;
    try { id = sessionStorage.getItem(CHAT_KEY); } catch { /* storage unavailable */ }
    if (id) void openChat(id, true);
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length, busy, open, view, error]);
  useEffect(() => {
    if (open && view === "chat") setTimeout(() => inputRef.current?.focus(), 50);
  }, [open, view]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  useEffect(() => () => {
    abortRef.current?.abort();
    speakRef.current?.abort();
  }, []);

  const suggestions = useMemo(() => suggestionsFor(pathname, t), [pathname, t]);

  async function ask(question: string) {
    const q = question.trim().slice(0, MAX_INPUT);
    if (!q || busy || loading) return;
    stopSpeaking();
    setError(null);
    setNeedsCredits(false);
    setInput("");
    setBusy(true);
    setStep("");
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setMessages((m) => {
      const last = m[m.length - 1];
      const retrying = last?.role === "user" && last.content === q;
      return [...(retrying ? m.slice(0, -1) : m), { id: `q-${Date.now()}`, role: "user", content: q }];
    });
    let answered = false;
    let failed = "";
    let noCredits = false;
    try {
      await streamHelpBotChat({ message: q, conversationId: chatId, page: pathname }, (ev) => {
        if (ctrl.signal.aborted) return;
        if (ev.t === "start") remember(ev.conversationId);
        else if (ev.t === "tool") setStep(TOOL_LABELS[ev.name] ? t(`helpBotStep_${ev.name}`, TOOL_LABELS[ev.name]) : "");
        else if (ev.t === "answer") {
          answered = true;
          setMessages((m) => [...m, { id: ev.messageId ?? `${UNSAVED}${Date.now()}`, role: "assistant", content: ev.text, actions: ev.actions, credits: ev.credits ?? null }]);
        } else {
          failed = ev.message;
          noCredits = ev.code === "AI_CREDITS_NEEDED";
        }
      }, ctrl.signal);
    } catch { /* reported below */ }
    if (abortRef.current !== ctrl) return; // another chat is open now
    abortRef.current = null;
    setBusy(false);
    if (noCredits) setNeedsCredits(true);
    else if (!answered && !ctrl.signal.aborted) setError(failed || t("helpBotError", "Sorry, I couldn't answer just now. Please try again."));
    if (charging || noCredits) refreshCredits();
    void qc.invalidateQueries({ queryKey: ["help-bot", "conversations"] });
  }

  async function removeChat(id: string) {
    if (!window.confirm(t("helpBotDeleteConfirm", "Delete this chat?"))) return;
    try {
      await helpBotService.remove(id);
      if (id === chatId) {
        newChat();
        setView("history");
      }
    } catch {
      window.alert(t("helpBotDeleteFailed", "This chat could not be deleted."));
    }
    void qc.invalidateQueries({ queryKey: ["help-bot", "conversations"] });
  }

  function rate(m: HelpBotMessage, value: 1 | -1) {
    const before = m.rating ?? null;
    const set = (r: 1 | -1 | null) => setMessages((all) => all.map((x) => (x.id === m.id ? { ...x, rating: r } : x)));
    const rating = before === value ? null : value;
    set(rating);
    helpBotService.rate(m.id, rating).catch(() => set(before));
  }

  async function copy(m: HelpBotMessage) {
    try {
      await navigator.clipboard.writeText(m.content);
      setCopied(m.id);
      setTimeout(() => setCopied(null), 1500);
    } catch { /* clipboard unavailable */ }
  }

  async function speak(id: string) {
    stopSpeaking();
    const abort = new AbortController();
    speakRef.current = abort;
    setError(null);
    setSpeaking({ id, loading: true });
    try {
      const voiced = voicedRef.current;
      const made = voiced.get(id);
      const chunks: Uint8Array<ArrayBuffer>[] = [];
      const body = made
        ? made.stream()
        : (await fetchHelpBotSpeech(id, abort.signal)).pipeThrough(
            new TransformStream<Uint8Array, Uint8Array>({
              transform(chunk, out) {
                chunks.push(new Uint8Array(chunk));
                out.enqueue(chunk);
              },
              // Only a clip that arrived whole is kept.
              flush() {
                if (!chunks.length) return;
                voiced.set(id, new Blob(chunks));
                if (voiced.size > 20) voiced.delete(voiced.keys().next().value!);
              },
            }),
          );
      await playPcm(body, abort.signal, () => {
        if (!abort.signal.aborted) setSpeaking({ id, loading: false });
      });
    } catch (e) {
      if (!abort.signal.aborted) setError((e as Error)?.message || t("helpBotVoiceFailed", "The voice could not be played."));
    } finally {
      if (speakRef.current === abort) stopSpeaking();
    }
  }

  const bottom = podcastOpen ? "calc(6.5rem + env(safe-area-inset-bottom, 0px))" : "calc(1rem + env(safe-area-inset-bottom, 0px))";
  const title = t("helpBotTitle", "TBT Assistant");
  const last = messages[messages.length - 1];
  const iconBtn = "h-9 w-9 shrink-0 grid place-items-center rounded-lg hover:opacity-70";
  const muted = { color: "var(--color-text-secondary)" };
  const bubble = { background: "var(--color-surface-overlay-md, rgba(127,127,127,0.12))" };

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={openBox}
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
          className={`fixed z-50 flex flex-col overflow-hidden inset-x-0 bottom-0 top-16 rounded-t-2xl sm:inset-auto sm:right-4 sm:top-auto sm:bottom-[var(--hb-bottom)] sm:rounded-2xl ${wide ? "sm:w-[min(720px,calc(100vw-2rem))] sm:h-[calc(100vh-7rem)]" : "sm:w-[390px] sm:h-[min(620px,calc(100vh-7rem))]"}`}
          style={{
            ["--hb-bottom" as string]: bottom,
            background: "var(--color-modal-bg)",
            border: "1px solid var(--color-border-medium)",
            boxShadow: "0 16px 48px rgba(0,0,0,0.45)",
            color: "var(--color-text-normal)",
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-0.5 px-3 py-2.5" style={{ borderBottom: "1px solid var(--color-border-medium)" }}>
            {view === "history" ? (
              <button type="button" onClick={() => setView("chat")} aria-label={t("helpBotBack", "Back to chat")} className={iconBtn} style={muted}><ArrowLeft size={18} /></button>
            ) : (
              <BotAvatar size={34} />
            )}
            <div className="flex-1 min-w-0 pl-2">
              <div className="font-semibold text-sm truncate">{view === "history" ? t("helpBotHistory", "Your chats") : title}</div>
              {view === "chat" && (
                charging && wallet ? (
                  <Link href="/ai-credits" onClick={() => { if (window.innerWidth < 640) setOpen(false); }} className="text-xs truncate inline-flex items-center gap-1 hover:underline" style={muted}>
                    <Sparkles size={11} /> {wallet.balance.toLocaleString("en-IN")} {t("aiCreditsUnit", "credits")}
                  </Link>
                ) : (
                  <div className="text-xs truncate" style={muted}>{t("helpBotSubtitle", "Ask anything about the app")}</div>
                )
              )}
            </div>
            {view === "chat" && (
              <button type="button" onClick={() => setView("history")} aria-label={t("helpBotHistory", "Your chats")} title={t("helpBotHistory", "Your chats")} className={iconBtn} style={muted}><History size={16} /></button>
            )}
            <button type="button" onClick={newChat} aria-label={t("helpBotNewChat", "New chat")} title={t("helpBotNewChat", "New chat")} className={iconBtn} style={muted}><Plus size={18} /></button>
            <span className="hidden sm:block">
              <button type="button" onClick={() => setWide((w) => !w)} aria-label={wide ? t("helpBotSmaller", "Smaller") : t("helpBotLarger", "Larger")} className={iconBtn} style={muted}>
                {wide ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>
            </span>
            <button type="button" onClick={() => setOpen(false)} aria-label={t("helpBotClose", "Close")} className={iconBtn} style={muted}><X size={18} /></button>
          </div>

          {view === "history" ? (
            <div className="flex-1 overflow-y-auto p-2 text-sm">
              {chatsLoading ? (
                <p className="p-4 text-center" style={muted}>{t("helpBotLoading", "Loading…")}</p>
              ) : !chats?.length ? (
                <p className="p-4 text-center" style={muted}>{t("helpBotNoChats", "Your chats appear here.")}</p>
              ) : (
                chats.map((c) => (
                  <div key={c.id} className="flex items-center rounded-lg" style={c.id === chatId ? bubble : undefined}>
                    <button type="button" onClick={() => void openChat(c.id)} className="flex-1 min-w-0 px-3 py-2.5 text-left">
                      <span className="block truncate">{c.title}</span>
                      <span className="text-xs" style={muted}>{new Date(c.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                    </button>
                    <button type="button" onClick={() => void removeChat(c.id)} aria-label={`${t("helpBotDelete", "Delete chat")}: ${c.title}`} className={iconBtn} style={muted}><Trash2 size={15} /></button>
                  </div>
                ))
              )}
            </div>
          ) : (
            <>
              {/* Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain px-4 py-4 space-y-3 text-sm leading-relaxed" aria-live="polite">
                {loading && <p className="text-center" style={muted}>{t("helpBotLoading", "Loading…")}</p>}
                {!loading && messages.length === 0 && (
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <div className="shrink-0"><BotAvatar size={28} /></div>
                      <div className="rounded-2xl rounded-tl-sm px-3 py-2" style={bubble}>
                        {t("helpBotGreeting", "Vanakkam! I'm your TBT Assistant. Ask me in Tamil, Tanglish or English: your courses, tasks, coins, calls, tickets, community and more.")}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 pl-9">
                      {suggestions.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => void ask(s)}
                          className="text-xs rounded-full px-3 py-2 text-left hover:opacity-80"
                          style={{ border: "1px solid var(--color-accent)", color: "var(--color-accent)" }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((m) => m.role === "user" ? (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-tr-sm px-3 py-2 whitespace-pre-wrap break-words" style={{ background: "var(--color-accent)", color: "#fff" }}>
                      {m.content}
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className="flex gap-2">
                    <div className="shrink-0"><BotAvatar size={28} /></div>
                    <div className="max-w-[88%] min-w-0">
                      <div className="rounded-2xl rounded-tl-sm px-3 py-2" style={bubble}>
                        <Markdown text={m.content} onNavigate={() => { if (window.innerWidth < 640) setOpen(false); }} />
                      </div>
                      {!m.id.startsWith(UNSAVED) && m.actions?.map((a, i) => (
                        <ActionCard
                          key={i}
                          action={a}
                          messageId={m.id}
                          index={i}
                          t={t}
                          onStatus={(s) => setMessages((all) => all.map((x) => (x.id === m.id ? { ...x, actions: x.actions?.map((y, j) => (j === i ? { ...y, status: s } : y)) } : x)))}
                        />
                      ))}
                      {!m.id.startsWith(UNSAVED) && (
                        <div className="mt-1 flex flex-wrap items-center gap-0.5" style={muted}>
                          <button
                            type="button"
                            onClick={() => {
                              if (speaking?.id === m.id) return stopSpeaking();
                              unlockAudio();
                              void speak(m.id);
                            }}
                            className="h-9 px-2 inline-flex items-center gap-1.5 rounded-lg text-xs hover:opacity-70"
                          >
                            {speaking?.id !== m.id ? (
                              <><Volume2 size={14} /> {voicedRef.current.has(m.id) ? t("helpBotPlayVoice", "Play voice") : t("helpBotRequestVoice", "Request voice")}</>
                            ) : speaking.loading ? (
                              <><Loader2 size={14} className="animate-spin" /> {t("helpBotVoicePreparing", "Preparing…")}</>
                            ) : (
                              <><Square size={12} /> {t("helpBotVoiceStop", "Stop")}</>
                            )}
                          </button>
                          <button type="button" onClick={() => void copy(m)} aria-label={t("helpBotCopy", "Copy")} className={iconBtn}>
                            {copied === m.id ? <Check size={14} /> : <Copy size={13} />}
                          </button>
                          <button type="button" onClick={() => rate(m, 1)} aria-pressed={m.rating === 1} aria-label={t("helpBotHelpful", "Helpful")} className={iconBtn} style={m.rating === 1 ? { color: "var(--color-success)" } : undefined}><ThumbsUp size={13} /></button>
                          <button type="button" onClick={() => rate(m, -1)} aria-pressed={m.rating === -1} aria-label={t("helpBotNotHelpful", "Not helpful")} className={iconBtn} style={m.rating === -1 ? { color: "var(--color-alert)" } : undefined}><ThumbsDown size={13} /></button>
                          {m.credits != null && m.credits > 0 && (
                            <span className="text-[11px] px-1 tabular-nums" title={t("aiCreditsUsedTitle", "AI credits this answer used")}>
                              −{m.credits} {t("aiCreditsUnit", "credits")}
                            </span>
                          )}
                          {m.rating === -1 && (
                            <button type="button" onClick={() => void ask(t("helpBotTalkToTeamText", "This didn't help. Please prepare a support ticket for the team."))} disabled={busy} className="h-9 px-2 text-xs underline disabled:opacity-50">
                              {t("helpBotTalkToTeam", "Talk to the team")}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {busy && (
                  <div className="flex items-center gap-2" style={muted} role="status">
                    <BotAvatar size={28} />
                    <Loader2 size={14} className="animate-spin" />
                    <span className="text-xs">{step ? `${t("helpBotChecking", "Checking")} ${step}…` : t("helpBotThinking", "Thinking…")}</span>
                  </div>
                )}

                {needsCredits && !busy && (
                  <div
                    role="alert"
                    className="rounded-xl px-3 py-3 space-y-2 text-sm"
                    style={{ border: "1px solid var(--color-accent)", background: "color-mix(in srgb, var(--color-accent) 8%, transparent)" }}
                  >
                    <p>{t("aiCreditsNeeded", "You need AI credits to ask TBT Assistant. Buy a pack to continue.")}</p>
                    {wallet && <p className="text-xs" style={muted}>{t("aiCreditsBalance", "Your balance")}: {wallet.balance.toLocaleString("en-IN")} {t("aiCreditsUnit", "credits")}</p>}
                    <Link
                      href="/ai-credits"
                      onClick={() => { if (window.innerWidth < 640) setOpen(false); }}
                      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-semibold"
                      style={{ background: "var(--color-accent)", color: "#fff" }}
                    >
                      <Sparkles size={13} /> {t("aiCreditsBuyTitle", "Buy credits")}
                    </Link>
                  </div>
                )}

                {error && (
                  <div
                    className="text-xs rounded-lg px-3 py-2 flex items-center justify-between gap-2"
                    role="alert"
                    style={{ background: "color-mix(in srgb, var(--color-alert) 12%, transparent)", color: "var(--color-alert)" }}
                  >
                    <span>{error}</span>
                    {last?.role === "user" && !busy && (
                      <button type="button" onClick={() => void ask(last.content)} className="underline shrink-0">{t("helpBotRetry", "Try again")}</button>
                    )}
                  </div>
                )}
              </div>

              {/* Composer */}
              <form onSubmit={(e) => { e.preventDefault(); void ask(input); }} className="flex items-end gap-2 px-3 py-3" style={{ borderTop: "1px solid var(--color-border-medium)" }}>
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value.slice(0, MAX_INPUT))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      void ask(input);
                    }
                  }}
                  rows={input.length > 45 || input.includes("\n") ? 3 : 1}
                  placeholder={t("helpBotPlaceholder", "Type your question…")}
                  aria-label={t("helpBotPlaceholder", "Type your question…")}
                  className="flex-1 min-w-0 resize-none rounded-xl px-3 py-2.5 text-base sm:text-sm outline-none max-h-32"
                  style={{ background: "var(--color-surface-overlay-xs, rgba(127,127,127,0.08))", border: "1px solid var(--color-border-medium)", color: "var(--color-text-normal)" }}
                />
                {busy ? (
                  <button type="button" onClick={() => abortRef.current?.abort()} aria-label={t("helpBotStop", "Stop")} className="h-11 w-11 shrink-0 rounded-xl grid place-items-center" style={{ border: "1px solid var(--color-border-medium)" }}>
                    <Square size={14} />
                  </button>
                ) : (
                  <button type="submit" disabled={!input.trim() || loading} aria-label={t("helpBotSend", "Send")} className="h-11 w-11 shrink-0 rounded-xl grid place-items-center disabled:opacity-40" style={{ background: "var(--color-accent)", color: "#fff" }}>
                    <Send size={16} />
                  </button>
                )}
              </form>
              <p className="px-4 -mt-1 text-[10px] text-center" style={{ color: "var(--color-text-subtle)", paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom, 0px))" }}>
                {t("helpBotDisclaimer", "AI answers can be wrong. Your question and the data needed to answer it go to an AI service. Chats are kept for 90 days.")}
              </p>
            </>
          )}
        </div>
      )}
    </>
  );
}
