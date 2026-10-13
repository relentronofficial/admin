import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { RefreshButton } from "./RefreshButton";

export const dynamic = "force-dynamic";

const GITHUB_OWNER = process.env.GITHUB_OWNER || "relentronofficial";
const GITHUB_REPO = process.env.GITHUB_REPO || "admin";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// ── GitHub API helpers ─────────────────────────────────────────────────────

async function ghFetch<T>(path: string): Promise<T | null> {
  if (!GITHUB_TOKEN) return null;
  try {
    const res = await fetch(`https://api.github.com${path}`, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      next: { revalidate: 0 },
    });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

interface GHIssue {
  number: number;
  title: string;
  html_url: string;
  body: string | null;
  labels: { name: string; color: string }[];
  created_at: string;
  updated_at: string;
}

interface GHRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  html_url: string;
  created_at: string;
  head_branch: string;
  head_commit: { message: string };
  run_attempt: number;
}

async function fetchTaskQueue(): Promise<GHIssue[]> {
  const labels = ["devops:pending", "devops:active", "devops:review", "devops:blocked"];
  const all: GHIssue[] = [];
  for (const label of labels) {
    const issues = await ghFetch<GHIssue[]>(
      `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues?labels=${encodeURIComponent(label)}&state=open&per_page=20`
    );
    if (issues) all.push(...issues);
  }
  return all;
}

async function fetchRecentRuns(): Promise<GHRun[]> {
  const data = await ghFetch<{ workflow_runs: GHRun[] }>(
    `/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/runs?per_page=8`
  );
  return data?.workflow_runs ?? [];
}

async function checkServiceHealth(url: string): Promise<"up" | "down" | "unknown"> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000), next: { revalidate: 0 } });
    return res.ok ? "up" : "down";
  } catch {
    return "down";
  }
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StatusPill({ status }: { status: "up" | "down" | "unknown" | "unconfigured" }) {
  const styles: Record<string, string> = {
    up: "bg-green-500/20 text-green-400 border border-green-500/30",
    down: "bg-red-500/20 text-red-400 border border-red-500/30",
    unknown: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
    unconfigured: "bg-[#2a2a2a] text-[#606060] border border-[#333]",
  };
  const labels: Record<string, string> = { up: "UP", down: "DOWN", unknown: "UNKNOWN", unconfigured: "—" };
  return (
    <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function getTaskLabelStatus(labels: { name: string }[]): {
  label: string;
  color: string;
} {
  const statusMap: Record<string, { label: string; color: string }> = {
    "devops:pending": { label: "Pending", color: "text-yellow-400 bg-yellow-400/10" },
    "devops:active": { label: "Active", color: "text-blue-400 bg-blue-400/10" },
    "devops:review": { label: "In Review", color: "text-purple-400 bg-purple-400/10" },
    "devops:blocked": { label: "Blocked", color: "text-red-400 bg-red-400/10" },
  };
  for (const l of labels) {
    if (statusMap[l.name]) return statusMap[l.name];
  }
  return { label: "Unknown", color: "text-[#606060] bg-[#2a2a2a]" };
}

function getPriority(labels: { name: string }[]): string {
  const p = labels.find(l => l.name.startsWith("priority:"));
  return p ? p.name.split(":")[1] : "medium";
}

function getScope(labels: { name: string }[]): string[] {
  return labels.filter(l => l.name.startsWith("scope:")).map(l => l.name.split(":")[1]);
}

function runStatusColor(status: string, conclusion: string | null) {
  if (status === "in_progress") return "text-blue-400";
  if (conclusion === "success") return "text-green-400";
  if (conclusion === "failure") return "text-red-400";
  if (conclusion === "cancelled") return "text-[#606060]";
  return "text-yellow-400";
}

function runStatusLabel(status: string, conclusion: string | null) {
  if (status === "in_progress") return "Running";
  if (conclusion === "success") return "Passed";
  if (conclusion === "failure") return "Failed";
  if (conclusion === "cancelled") return "Cancelled";
  if (conclusion === "skipped") return "Skipped";
  return status;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Page ──────────────────────────────────────────────────────────────────

export default async function DevOpsPage() {
  const configured = !!GITHUB_TOKEN;

  // Parallel fetches
  const [tasks, runs, backendHealth, userWebHealth] = await Promise.all([
    fetchTaskQueue(),
    fetchRecentRuns(),
    checkServiceHealth("https://tbt-backend-464464507912.asia-south1.run.app/api/pub/config/site"),
    checkServiceHealth("https://app.tamilbusinesstribe.com"),
  ]);

  const activeTasks = tasks.filter(t => t.labels.some(l => l.name === "devops:active"));
  const pendingTasks = tasks.filter(t => t.labels.some(l => l.name === "devops:pending"));
  const reviewTasks = tasks.filter(t => t.labels.some(l => l.name === "devops:review"));
  const blockedTasks = tasks.filter(t => t.labels.some(l => l.name === "devops:blocked"));

  const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const sortedPending = [...pendingTasks].sort(
    (a, b) => (priorityOrder[getPriority(a.labels)] ?? 2) - (priorityOrder[getPriority(b.labels)] ?? 2)
  );

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6 max-w-6xl">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#f0f0f0] font-rajdhani uppercase tracking-widest">
              Dev Control
            </h1>
            <p className="text-[#606060] text-sm mt-0.5">Autonomous development dashboard · TBT Platform</p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={`https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/issues/new?labels=devops%3Apending&template=devops_task.md`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#dc2626] text-white text-sm font-bold px-4 py-2 rounded-lg hover:bg-red-700 transition-colors font-rajdhani uppercase tracking-wider"
            >
              + New Task
            </a>
            <RefreshButton />
          </div>
        </div>

        {/* Config notice */}
        {!configured && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 text-sm text-yellow-400">
            <strong>GitHub not connected.</strong> Add{" "}
            <code className="bg-yellow-500/10 px-1 rounded">GITHUB_TOKEN</code>,{" "}
            <code className="bg-yellow-500/10 px-1 rounded">GITHUB_OWNER</code>, and{" "}
            <code className="bg-yellow-500/10 px-1 rounded">GITHUB_REPO</code> to the Vercel admin panel environment
            variables to enable live data.
          </div>
        )}

        {/* System Health */}
        <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-5">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani mb-4">
            System Health
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { name: "Backend (Prod)", status: backendHealth },
              { name: "User Web", status: userWebHealth },
              { name: "Admin Panel", status: "up" as const },
              { name: "GitHub Actions", status: configured ? (runs[0]?.conclusion === "failure" ? "down" : "up") : "unconfigured" },
            ].map(svc => (
              <div key={svc.name} className="bg-[#141414] rounded-lg p-3 flex items-center justify-between gap-2">
                <span className="text-[#a0a0a0] text-xs truncate">{svc.name}</span>
                <StatusPill status={svc.status as "up" | "down" | "unknown" | "unconfigured"} />
              </div>
            ))}
          </div>
        </div>

        {/* Queue summary */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Pending", count: pendingTasks.length, color: "text-yellow-400" },
            { label: "Active", count: activeTasks.length, color: "text-blue-400" },
            { label: "In Review", count: reviewTasks.length, color: "text-purple-400" },
            { label: "Blocked", count: blockedTasks.length, color: "text-red-400" },
          ].map(s => (
            <div key={s.label} className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-4 text-center">
              <div className={`text-3xl font-bold font-rajdhani ${s.color}`}>{s.count}</div>
              <div className="text-[11px] uppercase tracking-widest text-[#606060] font-rajdhani mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Task Queue */}
          <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a]">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani">
                Task Queue
              </h2>
              {configured && (
                <a
                  href={`https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/issues?labels=devops%3Apending`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#606060] hover:text-[#a0a0a0] text-xs"
                >
                  View all ↗
                </a>
              )}
            </div>
            <div className="divide-y divide-[#2a2a2a]">
              {!configured && (
                <div className="px-5 py-8 text-center text-[#606060] text-sm">
                  Connect GitHub to see tasks
                </div>
              )}
              {configured && tasks.length === 0 && (
                <div className="px-5 py-8 text-center text-[#606060] text-sm">
                  No active tasks. Create a GitHub Issue to get started.
                </div>
              )}
              {[...activeTasks, ...sortedPending, ...reviewTasks, ...blockedTasks]
                .slice(0, 8)
                .map(issue => {
                  const st = getTaskLabelStatus(issue.labels);
                  const priority = getPriority(issue.labels);
                  const scope = getScope(issue.labels);
                  const priorityColors: Record<string, string> = {
                    critical: "text-red-400",
                    high: "text-orange-400",
                    medium: "text-yellow-400",
                    low: "text-[#606060]",
                  };
                  return (
                    <a
                      key={issue.number}
                      href={issue.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block px-5 py-3.5 hover:bg-[#1a1a1a] transition-colors group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-[#f0f0f0] text-sm font-medium truncate group-hover:text-white">
                            {issue.title}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[10px] uppercase tracking-wider font-bold ${priorityColors[priority] ?? "text-[#606060]"}`}>
                              {priority}
                            </span>
                            {scope.map(s => (
                              <span key={s} className="text-[10px] bg-[#2a2a2a] text-[#a0a0a0] px-1.5 py-0.5 rounded">
                                {s}
                              </span>
                            ))}
                            <span className="text-[#606060] text-[10px]">#{issue.number}</span>
                          </div>
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded whitespace-nowrap ${st.color}`}>
                          {st.label}
                        </span>
                      </div>
                    </a>
                  );
                })}
            </div>
          </div>

          {/* Recent Deployments */}
          <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a]">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani">
                Recent Deployments
              </h2>
              {configured && (
                <a
                  href={`https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/actions`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#606060] hover:text-[#a0a0a0] text-xs"
                >
                  View all ↗
                </a>
              )}
            </div>
            <div className="divide-y divide-[#2a2a2a]">
              {!configured && (
                <div className="px-5 py-8 text-center text-[#606060] text-sm">
                  Connect GitHub to see deployments
                </div>
              )}
              {configured && runs.length === 0 && (
                <div className="px-5 py-8 text-center text-[#606060] text-sm">
                  No recent runs found
                </div>
              )}
              {runs.map(run => (
                <a
                  key={run.id}
                  href={run.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-5 py-3.5 hover:bg-[#1a1a1a] transition-colors group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[#f0f0f0] text-sm font-medium truncate group-hover:text-white">
                        {run.head_commit?.message?.split("\n")[0] ?? run.name}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] bg-[#2a2a2a] text-[#a0a0a0] px-1.5 py-0.5 rounded">
                          {run.head_branch}
                        </span>
                        <span className="text-[#606060] text-[10px]">{timeAgo(run.created_at)}</span>
                      </div>
                    </div>
                    <span className={`text-xs font-bold ${runStatusColor(run.status, run.conclusion)}`}>
                      {runStatusLabel(run.status, run.conclusion)}
                    </span>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Reference */}
        <div className="bg-[#181818] border border-[#2a2a2a] rounded-xl p-5">
          <h2 className="text-[11px] font-bold uppercase tracking-widest text-[#606060] font-rajdhani mb-4">
            Quick Reference — Submit a Task
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[#a0a0a0] mb-2">Create a GitHub Issue with these labels:</p>
              <ul className="space-y-1 text-[#606060] text-xs">
                <li><code className="text-yellow-400">devops:pending</code> — Add to task queue</li>
                <li><code className="text-orange-400">priority:high</code> / <code className="text-yellow-400">priority:medium</code></li>
                <li><code className="text-purple-400">scope:user-web</code> / <code className="text-purple-400">scope:admin</code> / <code className="text-purple-400">scope:backend</code></li>
              </ul>
            </div>
            <div>
              <p className="text-[#a0a0a0] mb-2">Claude Code commands:</p>
              <ul className="space-y-1 text-[#606060] text-xs font-mono">
                <li>node automation/task-intake.mjs</li>
                <li>node automation/health-check.mjs</li>
                <li>gh issue list --label devops:pending</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
