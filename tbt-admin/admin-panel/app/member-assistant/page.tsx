"use client";

import { useEffect, useState } from "react";
import { Loader2, Search, UserPlus, X } from "lucide-react";
import toast from "react-hot-toast";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useListMembers } from "@/lib/hooks/useMembers";
import {
  useAddHelpBotTester,
  useHelpBotOverview,
  useRemoveHelpBotTester,
  useReviewPoorAnswer,
  useSaveHelpBotSettings,
  type HelpBotAudience,
} from "@/lib/hooks/useHelpBotAdmin";

const CARD = "bg-[#181818] border border-[#2a2a2a] rounded-xl p-5";
const LABEL = "text-[11px] font-bold uppercase tracking-widest text-[#a0a0a0] font-rajdhani";
const INPUT = "bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg h-11 px-4 text-white outline-none focus:border-[#dc2626]";

const errorText = (e: any) => e?.response?.data?.error || e?.error || e?.message || "That didn't work. Please try again.";

/** One poor answer: publish a corrected Support FAQ for it, or dismiss it. */
function PoorAnswer({ p, categories }: { p: { id: string; question: string | null; answer: string; createdAt: string }; categories: Array<{ id: string; name: string }> }) {
  const review = useReviewPoorAnswer();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState(p.question ?? "");
  const [answer, setAnswer] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const run = (body: { action: "faq" | "dismiss"; question?: string; answer?: string; categoryId?: string | null }, done: string) =>
    review.mutate({ id: p.id, ...body }, { onSuccess: () => toast.success(done), onError: (e) => toast.error(errorText(e)) });

  return (
    <li className="rounded-lg bg-[#1a1a1a] p-4 text-sm">
      <p className="font-semibold text-[#f0f0f0] break-words">{p.question || "(question not found)"}</p>
      <p className="mt-1 whitespace-pre-wrap break-words text-[#a0a0a0]">{p.answer}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <p className="text-xs text-[#a0a0a0]">{new Date(p.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}</p>
        <button type="button" onClick={() => setOpen((o) => !o)} className="text-xs font-semibold text-[#dc2626] hover:underline">{open ? "Cancel" : "Write the right answer as an FAQ"}</button>
        <button type="button" disabled={review.isPending} onClick={() => run({ action: "dismiss" }, "Marked as looked at")} className="text-xs text-[#a0a0a0] hover:underline disabled:opacity-50">Dismiss</button>
      </div>
      {open && (
        <div className="mt-3 space-y-2">
          <input value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={500} placeholder="Question as members ask it" aria-label="FAQ question" className={`${INPUT} w-full`} />
          <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} maxLength={5000} rows={4} placeholder="The correct answer" aria-label="FAQ answer" className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-3 text-white outline-none focus:border-[#dc2626]" />
          <div className="flex flex-wrap items-center gap-2">
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label="Help topic" className={INPUT}>
              <option value="">No topic</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <button
              type="button"
              disabled={review.isPending || question.trim().length < 5 || answer.trim().length < 5}
              onClick={() => run({ action: "faq", question: question.trim(), answer: answer.trim(), categoryId: categoryId || null }, "Published in Support → Browse help topics")}
              className="h-11 px-4 rounded-lg bg-[#dc2626] hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-50"
            >
              {review.isPending ? <Loader2 size={16} className="animate-spin" /> : "Publish FAQ"}
            </button>
          </div>
          <p className="text-xs text-[#a0a0a0]">It goes live in Support → Browse help topics, and the assistant uses it from the next question.</p>
        </div>
      )}
    </li>
  );
}

export default function MemberAssistantPage() {
  const { data, isLoading, error } = useHelpBotOverview();
  const save = useSaveHelpBotSettings();
  const add = useAddHelpBotTester();
  const remove = useRemoveHelpBotTester();

  const [limit, setLimit] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (data) setLimit(String(data.dailyLimit));
  }, [data?.dailyLimit]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const id = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  const members = useListMembers({ page: 1, limit: 8, search: query }, { enabled: query.length >= 2 });
  const found: any[] = (members.data as any)?.data || [];
  const testerIds = new Set(data?.testers.map((t) => t.id));

  const run = async (p: Promise<unknown>, done: string) => {
    try {
      await p;
      toast.success(done);
    } catch (e) {
      toast.error(errorText(e));
    }
  };

  const setAudience = (audience: HelpBotAudience) => {
    if (!data || audience === data.audience) return;
    const question =
      audience === "all"
        ? "Open TBT Assistant to every active member now?"
        : "Open TBT Assistant only to the testers below? Everyone else gets a Coming Soon note.";
    if (window.confirm(question)) void run(save.mutateAsync({ audience, dailyLimit: data.dailyLimit }), "Saved");
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-[#f0f0f0] font-rajdhani uppercase tracking-wide">Member Assistant</h1>
          <p className="text-sm text-[#a0a0a0]">The chat members see in the web app: who can use it, and how it is doing.</p>
        </div>

        {isLoading ? (
          <div className={`${CARD} flex items-center gap-2 text-[#a0a0a0]`}><Loader2 size={16} className="animate-spin" /> Loading…</div>
        ) : !data ? (
          <div className={`${CARD} text-[#a0a0a0]`} role="alert">{errorText(error)}</div>
        ) : (
          <>
            {!data.ready && (
              <div className={`${CARD} text-amber-400 text-sm`} role="alert">The AI key is not set, so members only get answers from the help FAQs.</div>
            )}

            <section className={CARD}>
              <h2 className={LABEL}>Who can use it</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Who can use it">
                {([
                  ["testers", "Testers only", `${data.testers.length} member${data.testers.length === 1 ? "" : "s"} below`],
                  ["all", "Every active member", "No plan or role limit"],
                ] as const).map(([value, name, note]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={data.audience === value}
                    disabled={save.isPending}
                    onClick={() => setAudience(value)}
                    className={`text-left rounded-lg border p-4 transition-colors ${data.audience === value ? "border-[#dc2626] bg-[#dc2626]/10" : "border-[#2a2a2a] hover:border-[#444]"}`}
                  >
                    <span className="block font-semibold text-[#f0f0f0]">{name}</span>
                    <span className="text-sm text-[#a0a0a0]">{note}</span>
                  </button>
                ))}
              </div>
              <form
                className="mt-4 flex flex-wrap items-end gap-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(save.mutateAsync({ audience: data.audience, dailyLimit: Number(limit) }), "Saved");
                }}
              >
                <label className="block">
                  <span className={LABEL}>Questions per member per day</span>
                  <input type="number" min={1} max={500} required value={limit} onChange={(e) => setLimit(e.target.value)} className={`${INPUT} mt-1 block w-40`} />
                </label>
                <button type="submit" disabled={save.isPending || Number(limit) === data.dailyLimit} className="h-11 px-5 rounded-lg bg-[#dc2626] hover:bg-red-700 text-white font-semibold disabled:opacity-40">
                  Save limit
                </button>
              </form>
            </section>

            <section className={CARD}>
              <h2 className={LABEL}>Testers</h2>
              {data.testers.length === 0 && <p className="mt-3 text-sm text-[#a0a0a0]">No testers yet. Every member gets a Coming Soon note until you add one.</p>}
              <ul className="mt-3 space-y-2">
                {data.testers.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 rounded-lg bg-[#1a1a1a] px-4 py-2.5">
                    <span className="min-w-0 truncate text-[#f0f0f0]">
                      {t.name}
                      {t.status !== "active" && <span className="ml-2 text-xs text-amber-400">{t.status}: can&apos;t use it until active</span>}
                    </span>
                    <button type="button" aria-label={`Remove ${t.name}`} disabled={remove.isPending} onClick={() => void run(remove.mutateAsync(t.id), "Removed")} className="h-9 w-9 grid place-items-center rounded-lg text-[#a0a0a0] hover:text-white">
                      <X size={16} />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="relative mt-4 max-w-md">
                <Search size={16} className="absolute left-3 top-3.5 text-[#a0a0a0]" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a member to add" aria-label="Find a member to add" className={`${INPUT} w-full pl-9`} />
              </div>
              {query.length >= 2 && (
                <ul className="mt-2 max-w-md space-y-1">
                  {members.isLoading && <li className="text-sm text-[#a0a0a0]">Searching…</li>}
                  {!members.isLoading && found.length === 0 && <li className="text-sm text-[#a0a0a0]">No member found.</li>}
                  {found.map((m) => {
                    const name = [m.firstName, m.lastName].filter(Boolean).join(" ") || m.name;
                    return (
                      <li key={m.id} className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-[#1a1a1a]">
                        <span className="min-w-0 truncate text-sm text-[#f0f0f0]">{name} <span className="text-[#a0a0a0]">{m.phone}</span></span>
                        {testerIds.has(m.id) ? (
                          <span className="text-xs text-[#a0a0a0]">Added</span>
                        ) : (
                          <button type="button" disabled={add.isPending} onClick={() => void run(add.mutateAsync(m.id), `${name} added`)} className="h-9 px-3 inline-flex items-center gap-1.5 rounded-lg border border-[#333] text-sm text-[#f0f0f0] hover:border-[#dc2626]">
                            <UserPlus size={14} /> Add
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className={CARD}>
              <h2 className={LABEL}>Last 30 days</h2>
              <dl className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {([
                  ["Questions", data.stats.questions],
                  ["Members", data.stats.members],
                  ["Helpful", data.stats.up],
                  ["Not helpful", data.stats.down],
                  ["From FAQs (no AI)", data.stats.faq],
                  ["AI was down", data.stats.offline],
                  ["AI cost", `$${data.stats.costUsd.toFixed(2)}`],
                ] as const).map(([name, value]) => (
                  <div key={name}>
                    <dt className="text-sm text-[#a0a0a0]">{name}</dt>
                    <dd className="text-2xl font-semibold text-[#f0f0f0]">{typeof value === "number" ? value.toLocaleString("en-IN") : value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className={CARD}>
              <h2 className={LABEL}>Answers to improve</h2>
              <p className="mt-1 text-sm text-[#a0a0a0]">Rated not helpful, or given while the AI was down. Adding a help FAQ fixes the next one.</p>
              {data.poor.length === 0 ? (
                <p className="mt-3 text-sm text-[#a0a0a0]">None in the last 30 days.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {data.poor.map((p) => <PoorAnswer key={p.id} p={p} categories={data.faqCategories ?? []} />)}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
