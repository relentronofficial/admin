"use client";

// Admin Assistant — ask questions about TBT's data. Read-only: answers come
// from backend lookups limited to what the signed-in admin may see.

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Bot, Loader2, MessageSquare, Plus, Send, Square, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

import { AnswerText } from "@/components/assistant/AnswerText";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  fetchAssistantConversation,
  streamAssistantChat,
  useAssistantConversations,
  useAssistantStatus,
  useDeleteAssistantConversation,
  type AssistantMessage,
} from "@/lib/hooks/useAssistant";

const TOOL_LABELS: Record<string, string> = {
  searchMembers: "Members",
  getMemberDetails: "Member details",
  getMemberProgress: "Member progress",
  listBatches: "Batches",
  getBatchSummary: "Batch summary",
  getPendingSubmissions: "Pending submissions",
  getInactiveMembers: "Inactive members",
  getAtRiskMembers: "At-risk members",
  getOverview: "Overview",
  getRevenueSummary: "Revenue",
  getCourseAnalytics: "Courses",
  getMemberBusinessRevenue: "Members' business revenue",
  getSupportTickets: "Support tickets",
  getSupportStats: "Support stats",
  getSupportCalls: "Support calls",
};
const label = (t: string) => TOOL_LABELS[t] ?? t;

/** Suggestions, shown only if the admin has the tool that answers them. */
const SUGGESTIONS: Array<[tool: string, text: string]> = [
  ["getRevenueSummary", "What is our revenue this month, by source?"],
  ["getBatchSummary", "How is the newest batch doing?"],
  ["getInactiveMembers", "Who has been inactive for 7 days?"],
  ["getCourseAnalytics", "Which courses have the lowest completion rate?"],
  ["getPendingSubmissions", "Which submissions are waiting for approval?"],
  ["getSupportTickets", "Which support tickets are overdue?"],
  ["getSupportCalls", "What support calls are scheduled today?"],
  ["getAtRiskMembers", "Which members are at high risk, and why?"],
];

export default function AssistantPage() {
  const { getToken } = useAuth();
  const qc = useQueryClient();
  const { data: status, isLoading, isError, refetch } = useAssistantStatus();
  const { data: conversations = [] } = useAssistantConversations();
  const del = useDeleteAssistantConversation();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);
  const [step, setStep] = useState("");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const openRef = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, busy, error]);

  function reset() {
    abortRef.current?.abort();
    openRef.current++;
    setOpening(false);
    setActiveId(null);
    setMessages([]);
    setError(null);
  }

  async function open(id: string) {
    if (busy) return;
    const n = ++openRef.current;
    setActiveId(id);
    setMessages([]);
    setError(null);
    setOpening(true);
    try {
      const m = await fetchAssistantConversation(id);
      if (openRef.current === n) setMessages(m);
    } catch (e) {
      if (openRef.current === n) setError((e as { message?: string })?.message ?? "Couldn't open this chat.");
    } finally {
      if (openRef.current === n) setOpening(false);
    }
  }

  async function ask(text: string) {
    const q = text.trim();
    if (!q || busy || opening) return;
    const abort = new AbortController();
    abortRef.current = abort;
    setBusy(true);
    setError(null);
    setStep("Thinking…");
    setInput("");
    setMessages((m) => [...m, { id: `q-${Date.now()}`, role: "user", content: q }]);
    try {
      const token = await getToken();
      await streamAssistantChat(
        token,
        { message: q, conversationId: activeId },
        (ev) => {
          if (abort.signal.aborted) return;
          if (ev.t === "start") setActiveId(ev.conversationId);
          else if (ev.t === "tool") setStep(`Looking up ${label(ev.name).toLowerCase()}…`);
          else if (ev.t === "answer")
            setMessages((m) => [...m, { id: `a-${Date.now()}`, role: "assistant", content: ev.text, tools: ev.tools }]);
          else setError(ev.message);
        },
        abort.signal,
      );
    } catch {
      if (!abort.signal.aborted) setError("Could not reach the assistant. Check your connection and try again.");
    } finally {
      if (abortRef.current === abort) setBusy(false);
      qc.invalidateQueries({ queryKey: ["admin-assistant", "conversations"] });
    }
  }

  function remove(id: string) {
    if (!confirm("Delete this chat?")) return;
    del.mutate(id, {
      onSuccess: () => {
        if (id === activeId) reset();
        toast.success("Chat deleted");
      },
      onError: () => toast.error("Delete failed"),
    });
  }

  const off = status && !status.enabled;
  const suggestions = SUGGESTIONS.filter(([t]) => status?.tools.includes(t)).slice(0, 4);

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row gap-4 h-[calc(100vh-130px)] min-h-[480px]">
        <aside className="md:w-60 flex-shrink-0 flex flex-col rounded-xl border border-[#2a2a2a] bg-[#181818] max-h-40 md:max-h-none">
          <div className="p-3 border-b border-[#2a2a2a]">
            <button
              onClick={reset}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-[#dc2626] hover:bg-red-700 text-white text-xs font-bold uppercase tracking-widest font-rajdhani"
            >
              <Plus size={14} /> New chat
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {conversations.length === 0 && <p className="p-2 text-xs text-[#606060]">Your chats appear here.</p>}
            {conversations.map((c) => (
              <div
                key={c.id}
                className={`group flex items-center gap-1 rounded-lg ${c.id === activeId ? "bg-[#2a2a2a]" : "hover:bg-[#1f1f1f]"}`}
              >
                <button
                  onClick={() => open(c.id)}
                  disabled={busy}
                  className="flex-1 min-w-0 flex items-center gap-2 px-2 py-2 text-left text-sm text-[#d0d0d0] disabled:opacity-60"
                >
                  <MessageSquare size={13} className="flex-shrink-0 text-[#606060]" />
                  <span className="truncate">{c.title}</span>
                </button>
                <button
                  onClick={() => remove(c.id)}
                  disabled={busy}
                  aria-label={`Delete chat: ${c.title}`}
                  className="p-2 text-[#606060] hover:text-red-400 md:opacity-0 group-hover:opacity-100 focus:opacity-100"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </aside>

        <section className="flex-1 min-w-0 min-h-0 flex flex-col rounded-xl border border-[#2a2a2a] bg-[#141414]">
          <header className="px-4 py-3 border-b border-[#2a2a2a] flex items-center gap-2">
            <Bot size={18} className="text-[#dc2626]" />
            <h1 className="text-sm font-bold uppercase tracking-widest font-rajdhani text-[#f0f0f0]">Admin Assistant</h1>
            <span className="text-xs text-[#606060]">Read-only</span>
          </header>

          <div className="flex-1 overflow-y-auto p-4 space-y-4" aria-live="polite">
            {isLoading || opening ? (
              <div className="flex items-center justify-center py-10 text-sm text-[#606060]">
                <Loader2 size={16} className="animate-spin mr-2" /> Loading…
              </div>
            ) : isError ? (
              <p className="py-10 text-center text-sm text-[#a0a0a0]">
                Couldn&apos;t load the assistant.{" "}
                <button onClick={() => refetch()} className="text-[#dc2626] underline">Retry</button>
              </p>
            ) : off ? (
              <p className="py-10 text-center text-sm text-amber-400">
                {status?.keyInvalid
                  ? "The assistant is off: the saved value is not an OpenRouter key (it should start with sk-or-)."
                  : "The assistant isn't set up yet: the OpenRouter key has not been added to the backend."}
              </p>
            ) : messages.length === 0 && !error ? (
              <div className="py-8 max-w-xl mx-auto text-center">
                <Bot size={30} className="mx-auto text-[#606060] mb-3" />
                <p className="text-sm text-[#d0d0d0]">Ask about members, batches, courses, revenue or support.</p>
                <p className="text-xs text-[#606060] mt-1">In English, Tamil or Tanglish.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-5">
                  {suggestions.map(([, s]) => (
                    <button
                      key={s}
                      onClick={() => ask(s)}
                      className="p-3 rounded-lg border border-[#2a2a2a] bg-[#181818] hover:border-[#dc2626] text-left text-sm text-[#d0d0d0]"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) =>
                m.role === "user" ? (
                  <div key={m.id} className="flex justify-end">
                    <p className="max-w-[85%] rounded-xl bg-[#dc2626] px-4 py-2.5 text-sm text-white whitespace-pre-wrap break-words">{m.content}</p>
                  </div>
                ) : (
                  <div key={m.id} className="max-w-[95%] rounded-xl border border-[#2a2a2a] bg-[#181818] px-4 py-3">
                    <AnswerText text={m.content} />
                    {!!m.tools?.length && (
                      <p className="mt-2.5 text-[11px] text-[#808080]">Source: {m.tools.map(label).join(", ")}</p>
                    )}
                  </div>
                ),
              )
            )}
            {busy && (
              <p className="flex items-center gap-2 text-sm text-[#a0a0a0]">
                <Loader2 size={14} className="animate-spin" /> {step}
              </p>
            )}
            {error && (
              <p className="flex items-start gap-2 text-sm text-amber-400">
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" /> {error}
              </p>
            )}
            <div ref={endRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask(input);
            }}
            className="p-3 border-t border-[#2a2a2a]"
          >
            <div className="flex items-end gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    ask(input);
                  }
                }}
                rows={2}
                maxLength={2000}
                disabled={!status?.enabled}
                aria-label="Your question"
                placeholder="Ask a question…"
                className="flex-1 min-w-0 resize-none rounded-lg border border-[#2a2a2a] bg-[#1a1a1a] px-4 py-2.5 text-sm text-white outline-none focus:border-[#dc2626] disabled:opacity-50"
              />
              {busy ? (
                <button
                  type="button"
                  onClick={() => {
                    abortRef.current?.abort();
                    setBusy(false);
                  }}
                  aria-label="Stop"
                  className="h-11 w-11 flex-shrink-0 grid place-items-center rounded-lg border border-[#333] text-[#f0f0f0] hover:bg-[#1a1a1a]"
                >
                  <Square size={15} />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim() || !status?.enabled || opening}
                  aria-label="Send"
                  className="h-11 w-11 flex-shrink-0 grid place-items-center rounded-lg bg-[#dc2626] hover:bg-red-700 text-white disabled:opacity-40"
                >
                  <Send size={15} />
                </button>
              )}
            </div>
            <p className="mt-1.5 text-[11px] text-[#606060]">
              AI can make mistakes. Check important figures on their own page. Questions and the data used to answer them are
              sent to the AI service.
            </p>
          </form>
        </section>
      </div>
    </DashboardLayout>
  );
}
