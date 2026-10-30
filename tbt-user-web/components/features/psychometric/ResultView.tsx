"use client";

import Link from "next/link";
import toast from "react-hot-toast";
import type { ResultResponse, RetestState } from "@/lib/api/services/psychometric.service";
import { useRequestPsychometricRetest } from "@/lib/hooks/usePsychometric";
import { clearAutosaves } from "@/lib/psychometric/assessmentFlow";

// The member's Psychometric result, ported from the former standalone
// result page (score, composites, category radar + bars, dimensions,
// recommendations, improvement areas, attempt history, retest).

const CAT_COLORS = ["#3B82F6", "#8B5CF6", "#F59E0B", "#EF4444", "#EC4899", "#10B981", "#F97316", "#06B6D4"];
const catColor = (i: number, n: number) => (n <= CAT_COLORS.length ? CAT_COLORS[i] : `hsl(${Math.round((i * 360) / n)}, 65%, 55%)`);
const LEVEL_STYLE: Record<string, { bg: string; fg: string }> = {
  Excellent: { bg: "#D1FAE5", fg: "#065F46" },
  Good: { bg: "#DBEAFE", fg: "#1E40AF" },
  Average: { bg: "#FEF3C7", fg: "#92400E" },
  "Needs Improvement": { bg: "#FEE2E2", fg: "#991B1B" },
};

const card = "rounded-2xl border p-5";
const cardStyle = { background: "var(--color-surface-raised)", borderColor: "var(--color-border-subtle)" } as const;
const muted = { color: "var(--color-text-subtle)" } as const;
const heading = "font-bold text-lg mb-3";
const accent = { color: "var(--color-accent)" } as const;

/** Small SVG radar (0–100 per axis) — the old page used Chart.js. */
function Radar({ labels, values }: { labels: string[]; values: number[] }) {
  const n = labels.length;
  if (n < 3) return <p className="text-sm" style={muted}>Not enough categories for a radar chart.</p>;
  const size = 300;
  const c = size / 2;
  const r = c - 56;
  const pt = (i: number, v: number) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return [c + (r * v * Math.cos(a)) / 100, c + (r * v * Math.sin(a)) / 100];
  };
  const poly = (v: (i: number) => number) => labels.map((_, i) => pt(i, v(i)).join(",")).join(" ");
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-sm mx-auto" role="img" aria-label="Category scores radar chart">
      {[20, 40, 60, 80, 100].map((g) => (
        <polygon key={g} points={poly(() => g)} fill="none" stroke="var(--color-border-medium)" strokeWidth={1} />
      ))}
      {labels.map((_, i) => {
        const [x, y] = pt(i, 100);
        return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="var(--color-border-subtle)" />;
      })}
      <polygon points={poly((i) => values[i] || 0)} fill="color-mix(in srgb, var(--color-accent) 20%, transparent)" stroke="var(--color-accent)" strokeWidth={2} />
      {labels.map((l, i) => {
        const [x, y] = pt(i, values[i] || 0);
        const [lx, ly] = pt(i, 122);
        return (
          <g key={l}>
            <circle cx={x} cy={y} r={4} fill="#F59E0B" stroke="#fff" strokeWidth={1.5} />
            <text x={lx} y={ly} fontSize={10} textAnchor="middle" dominantBaseline="middle" fill="var(--color-text-normal)">{l}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Bars({ entries }: { entries: [string, number][] }) {
  return (
    <div className="space-y-3">
      {entries.map(([name, pct], i) => (
        <div key={name}>
          <div className="flex justify-between text-sm mb-1"><span className="font-medium">{name}</span><span style={muted}>{pct}%</span></div>
          <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "var(--color-progress-track)" }}>
            <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: catColor(i, entries.length), transition: "width .6s ease" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Retest({ retest }: { retest: RetestState }) {
  const request = useRequestPsychometricRetest();
  const status = retest.status || "none";
  let message: { text: string; color: string } | null = null;
  if (status === "pending") message = { text: "⏳ Waiting for admin approval.", color: "var(--color-text-subtle)" };
  else if (status === "approved") message = { text: "✅ Retest approved. You can start now.", color: "var(--color-success, #10B981)" };
  else if (retest.canRequest && status === "rejected") message = { text: `❌ Your previous retest request was rejected${retest.rejectionNote ? `: ${retest.rejectionNote}` : "."}`, color: "var(--color-accent)" };
  const show = status === "pending" || status === "approved" || retest.canRequest;
  if (!show) return null;

  const ask = async () => {
    try {
      const res = await request.mutateAsync(undefined);
      toast.success(res.message || "Retest request sent for approval.");
    } catch (e) {
      toast.error((e as Error).message || "Could not send request.");
    }
  };
  return (
    <div className={`${card} text-center`} style={cardStyle}>
      <h3 className="font-bold text-lg mb-1" style={accent}>Need to Retake?</h3>
      <p className="text-sm mb-4" style={muted}>If you wish to retake this assessment, you can request approval from the administrator.</p>
      {message && <p className="text-sm font-semibold mb-3" style={{ color: message.color }}>{message.text}</p>}
      <div className="flex justify-center gap-3 flex-wrap">
        {status === "approved" ? (
          // Start fresh at question 1: drop any autosaved answers from earlier attempts.
          <Link href="/psychometric/assessment" onClick={() => clearAutosaves(window.localStorage)}
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "var(--color-accent)" }}>
            Start Retest
          </Link>
        ) : retest.canRequest ? (
          <button onClick={ask} disabled={request.isPending} className="px-5 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-60" style={{ background: "var(--color-accent)" }}>
            {request.isPending ? "Sending…" : status === "rejected" ? "Request Again" : "Request Retest"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function ResultView({ data }: { data: ResultResponse }) {
  const r = data.data;
  const label = (r.userId && typeof r.userId.sharedUserID === "object" && r.userId.sharedUserID?.label) || "Your Assessment";
  const level = LEVEL_STYLE[r.level] ?? LEVEL_STYLE.Average;
  const cats = Object.entries(r.categoryPercentages || {}).map(([k, v]) => [k, Number(v)] as [string, number]);
  const dims = Object.entries(r.dimensionPercentages || {}).map(([k, v]) => [k, Number(v)] as [string, number]);
  const composites = ([
    ["Aptitude", r.aptitudeScore], ["Personality", r.personalityScore],
    ["Business Mindset", r.businessMindsetScore], ["Financial Awareness", r.financialAwarenessScore],
  ] as [string, number | undefined][]).filter(([, v]) => v != null);
  const recs = r.recommendations?.length ? r.recommendations : (r.recommendedBusiness || []).map((business) => ({ business, explanation: "" }));
  const pctLabel = (d: string) => (r.dimensionPercentages?.[d] != null ? ` (${r.dimensionPercentages[d]}%)` : "");

  return (
    <div className="space-y-6">
      <div className={`${card} text-center`} style={cardStyle}>
        <p className="text-sm font-semibold mb-2" style={{ color: "var(--color-success, #10B981)" }}>✅ Assessment Completed Successfully</p>
        <h2 className="text-2xl font-extrabold mb-1" style={accent}>{label} Results</h2>
        <span className="inline-block text-xs font-bold uppercase tracking-wide mb-2 px-3 py-1 rounded-full" style={{ background: "color-mix(in srgb, var(--color-accent) 10%, transparent)", ...accent }}>
          Attempt {data.attemptNumber || 1}
        </span>
        <p className="mb-6" style={muted}>{r.userId?.name}</p>
        <div className="flex flex-col items-center gap-2 mb-4">
          <div className="relative w-36 h-36 rounded-full flex items-center justify-center"
            style={{ background: `conic-gradient(var(--color-accent) ${r.percentage * 3.6}deg, var(--color-progress-track) 0deg)` }}>
            <div className="absolute inset-3 rounded-full" style={{ background: "var(--color-surface-raised)" }} />
            <span className="relative text-3xl font-extrabold" style={{ color: "var(--color-text-primary)" }}>{r.percentage}%</span>
          </div>
          <p className="text-xs uppercase tracking-wide font-semibold" style={muted}>{label} Score</p>
          <p className="font-semibold text-lg mt-1">Total: {r.totalMarks} / {r.maxScore}</p>
          <span className="px-4 py-1.5 rounded-full text-base font-semibold" style={{ background: level.bg, color: level.fg }}>{r.level}</span>
        </div>
        <p className="text-sm max-w-xl mx-auto mb-5" style={muted}>{r.explanation}</p>
        {(r.correctCount != null || r.wrongCount != null || r.skippedCount != null) && (
          <div className="flex flex-wrap justify-center gap-6 text-sm">
            <span><b style={{ color: "#10B981" }}>{r.correctCount ?? 0}</b> <span style={muted}>Correct</span></span>
            <span><b style={{ color: "#EF4444" }}>{r.wrongCount ?? 0}</b> <span style={muted}>Wrong</span></span>
            <span><b style={muted}>{r.skippedCount ?? 0}</b> <span style={muted}>Skipped</span></span>
          </div>
        )}
      </div>

      {composites.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {composites.map(([l, v]) => (
            <div key={l} className={`${card} text-center`} style={cardStyle}>
              <p className="text-2xl font-extrabold" style={accent}>{v}%</p>
              <p className="text-xs font-semibold mt-1" style={muted}>{l}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className={card} style={cardStyle}><h3 className="font-bold mb-4" style={accent}>Category Radar</h3><Radar labels={cats.map(([k]) => k)} values={cats.map(([, v]) => v)} /></div>
        <div className={card} style={cardStyle}><h3 className="font-bold mb-4" style={accent}>Category Breakdown</h3><Bars entries={cats} /></div>
      </div>

      {dims.length > 0 && (
        <div className={card} style={cardStyle}><h3 className="font-bold mb-4" style={accent}>Dimension Breakdown</h3><Bars entries={dims} /></div>
      )}

      {(r.strongDimensions?.length || r.weakDimensions?.length) ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className={card} style={cardStyle}>
            <h3 className={heading} style={{ color: "#10B981" }}>Strong Dimensions</h3>
            <div className="flex flex-wrap gap-2">{r.strongDimensions.map((d) => <span key={d} className="px-3 py-1 rounded-full text-sm font-semibold" style={{ background: "#D1FAE5", color: "#065F46" }}>{d}{pctLabel(d)}</span>)}</div>
          </div>
          <div className={card} style={cardStyle}>
            <h3 className={heading} style={{ color: "#EF4444" }}>Weak Dimensions</h3>
            <div className="flex flex-wrap gap-2">{r.weakDimensions.map((d) => <span key={d} className="px-3 py-1 rounded-full text-sm font-semibold" style={{ background: "#FEE2E2", color: "#991B1B" }}>{d}{pctLabel(d)}</span>)}</div>
          </div>
        </div>
      ) : null}

      <div className={card} style={cardStyle}>
        <h3 className={heading} style={accent}>Top Business Recommendations</h3>
        <div className="space-y-3">
          {recs.map((rec) => (
            <div key={rec.business} className="rounded-lg p-4" style={{ background: "color-mix(in srgb, var(--color-accent) 6%, transparent)", border: "1px solid color-mix(in srgb, var(--color-accent) 20%, transparent)" }}>
              <p className="font-bold text-sm mb-1" style={accent}>{rec.business}</p>
              {rec.explanation && <p className="text-sm" style={muted}>{rec.explanation}</p>}
            </div>
          ))}
        </div>
      </div>

      {r.improvementAreas?.length > 0 && (
        <div className={card} style={cardStyle}>
          <h3 className={heading} style={accent}>Areas to Strengthen</h3>
          <div className="space-y-4">
            {r.improvementAreas.map((a) => (
              <div key={a.category} className="rounded-lg p-4" style={{ background: "#FEF3C7", border: "1px solid #FDE68A" }}>
                <p className="font-bold text-sm mb-1" style={{ color: "#92400E" }}>{a.category} ({a.score}%)</p>
                <p className="text-sm" style={{ color: "#78350F" }}>{a.suggestion}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {data.history?.length > 1 && (
        <div className={card} style={cardStyle}>
          <h3 className={heading} style={accent}>Previous Attempts</h3>
          <div className="space-y-2">
            {data.history.map((h) => (
              <div key={h._id} className="flex items-center justify-between gap-3 text-sm border-b pb-2" style={{ borderColor: "var(--color-border-subtle)" }}>
                <span className="font-semibold">Attempt {h.attemptNumber || 1}</span>
                <span style={muted}>{new Date(h.createdAt).toLocaleDateString()}</span>
                <span className="font-bold">{h.percentage}%</span>
                <span className="text-xs" style={muted}>{h.level}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <Retest retest={data.retest} />
    </div>
  );
}
