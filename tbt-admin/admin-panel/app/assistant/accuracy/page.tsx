"use client";

// Accuracy test for the AI Assistant (super admin). Asks every test question
// for real and compares each answer with the database. Each question costs a
// little AI credit, so nothing runs until a button is pressed.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Loader2, Play, Square, XCircle } from "lucide-react";
import toast from "react-hot-toast";

import { AnswerText } from "@/components/assistant/AnswerText";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  runAccuracyCase,
  runAssistantSelfTest,
  useAccuracyCases,
  useAssistantStatus,
  type AccuracyResult,
} from "@/lib/hooks/useAssistant";

type Row = AccuracyResult | { error: string } | "running";
const done = (r?: Row): r is AccuracyResult => !!r && typeof r === "object" && "pass" in r;

export default function AssistantAccuracyPage() {
  const { data: status, isLoading: statusLoading } = useAssistantStatus();
  const { data: cases = [], isLoading, isError } = useAccuracyCases(!!status?.canTest);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [running, setRunning] = useState(false);
  const [checking, setChecking] = useState(false);
  const [onlyFailed, setOnlyFailed] = useState(false);
  const stop = useRef(false);
  useEffect(() => {
    stop.current = false;
    return () => {
      stop.current = true;
    };
  }, []);

  const runAll = async (ids: string[]) => {
    stop.current = false;
    setRunning(true);
    const queue = [...ids];
    const worker = async () => {
      for (let id = queue.shift(); id && !stop.current; id = queue.shift()) {
        const key = id;
        setRows((r) => ({ ...r, [key]: "running" }));
        let result: Row;
        try {
          result = await runAccuracyCase(key);
        } catch (e: any) {
          const m = e?.response?.data?.error ?? e?.error ?? e?.message;
          result = { error: typeof m === "string" ? m : "Could not run this question." };
        }
        setRows((r) => ({ ...r, [key]: result }));
      }
    };
    await Promise.all([worker(), worker()]);
    setRunning(false);
  };

  const checkData = async () => {
    setChecking(true);
    try {
      const r = await runAssistantSelfTest();
      if (r.failed.length) toast.error(`Not working: ${r.failed.join(", ")}`);
      else toast.success(`All ${r.datasets} data sets work`);
    } catch {
      toast.error("The data check could not be run.");
    } finally {
      setChecking(false);
    }
  };

  const results = cases.map((c) => rows[c.id]).filter(done);
  const passed = results.filter((r) => r.pass).length;
  const failedIds = cases.filter((c) => { const r = rows[c.id]; return r && r !== "running" && !(done(r) && r.pass); }).map((c) => c.id);
  const cost = results.reduce((s, r) => s + r.costUsd, 0);
  const avg = results.length ? results.reduce((s, r) => s + r.ms, 0) / results.length / 1000 : 0;
  const shown = onlyFailed ? cases.filter((c) => failedIds.includes(c.id)) : cases;

  const btn = "inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-widest font-rajdhani disabled:opacity-40";

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 max-w-5xl mx-auto text-[#f0f0f0]">
        <Link href="/assistant" className="inline-flex items-center gap-1.5 text-xs text-[#a0a0a0] hover:text-white mb-3">
          <ArrowLeft size={14} /> AI Assistant
        </Link>
        <h1 className="text-xl font-bold font-rajdhani uppercase tracking-widest">Accuracy test</h1>
        <p className="text-sm text-[#a0a0a0] mt-1">
          Asks every test question for real and compares the answer with the database. Each question uses a little AI credit.
        </p>

        {statusLoading || isLoading ? (
          <Loader2 className="animate-spin mt-8 text-[#606060]" />
        ) : !status?.canTest ? (
          <p className="mt-8 text-sm text-[#a0a0a0]">Only super admins can run this test.</p>
        ) : isError ? (
          <p className="mt-8 text-sm text-[#a0a0a0]">The test questions could not be loaded. Please reload the page.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 mt-4">
              {running ? (
                <button onClick={() => { stop.current = true; }} className={`${btn} bg-[#2a2a2a] hover:bg-[#333]`}>
                  <Square size={14} /> Stop
                </button>
              ) : (
                <button onClick={() => runAll(cases.map((c) => c.id))} className={`${btn} bg-[#dc2626] hover:bg-red-700 text-white`}>
                  <Play size={14} /> Run all {cases.length}
                </button>
              )}
              <button disabled={running || !failedIds.length} onClick={() => runAll(failedIds)} className={`${btn} bg-[#2a2a2a] hover:bg-[#333]`}>
                Run failed again
              </button>
              <button disabled={checking} onClick={checkData} className={`${btn} bg-[#2a2a2a] hover:bg-[#333]`}>
                {checking && <Loader2 size={14} className="animate-spin" />} Check data sets
              </button>
              <label className="inline-flex items-center gap-2 text-xs text-[#a0a0a0] ml-auto">
                <input type="checkbox" checked={onlyFailed} onChange={(e) => setOnlyFailed(e.target.checked)} /> Failed only
              </label>
            </div>

            {results.length > 0 && (
              <p className="mt-4 text-sm" aria-live="polite">
                <strong>{Math.round((passed / results.length) * 1000) / 10}% correct</strong> ({passed} of {results.length}) · {avg.toFixed(1)} s each · ${cost.toFixed(3)} in total · {results.filter((r) => r.hard).length} used the stronger model
              </p>
            )}

            <div className="mt-4 space-y-2">
              {shown.map((c) => {
                const r = rows[c.id];
                return (
                  <details key={c.id} className="rounded-xl border border-[#2a2a2a] bg-[#181818]">
                    <summary className="flex items-center gap-3 p-3 cursor-pointer text-sm list-none">
                      <span className="w-5 flex-shrink-0">
                        {r === "running" ? <Loader2 size={16} className="animate-spin" />
                          : done(r) && r.pass ? <CheckCircle2 size={16} className="text-green-500" aria-label="Correct" />
                            : r ? <XCircle size={16} className="text-red-500" aria-label="Failed" /> : null}
                      </span>
                      <span className="flex-1 min-w-0">{c.question}</span>
                      {done(r) && <span className="text-xs text-[#606060] whitespace-nowrap">{(r.ms / 1000).toFixed(1)} s</span>}
                    </summary>
                    <div className="px-3 pb-3 text-sm space-y-2 border-t border-[#2a2a2a] pt-3">
                      {!r || r === "running" ? (
                        <p className="text-[#606060]">Not run yet.</p>
                      ) : !done(r) ? (
                        <p className="text-red-400">{r.error}</p>
                      ) : (
                        <>
                          <p className="text-xs text-[#a0a0a0]">Right answer: {r.expected.join(", ")}</p>
                          {r.missing.length > 0 && <p className="text-xs text-red-400">Missing from the answer: {r.missing.join(", ")}</p>}
                          <AnswerText text={r.answer} />
                          <p className="text-xs text-[#606060]">
                            {r.tools.join(", ") || "no lookups"} · ${r.costUsd.toFixed(4)}{r.hard ? " · stronger model" : ""}
                          </p>
                        </>
                      )}
                    </div>
                  </details>
                );
              })}
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
