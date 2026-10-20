// Growth milestones on the Learning Roadmap — pure level logic.
//
// The member's batch-program milestones (Ads → Website → Funnels → 1 lakh →
// 1 crore by default; admins can rename/reorder them per program) from
// GET /api/user-batch/weekly-graph. Nothing here infers progress:
//   • a milestone is REACHED only when the backend says so (`reached`), i.e.
//     an admin-approved task linked to it, or an admin/mentor-recorded
//     achievement — never from the weekly graph's plotted height or task share;
//   • Milestone 1 is open; Milestone N opens only after every earlier milestone
//     is reached; the open milestone not reached yet is the CURRENT one;
//   • a milestone reached out of order (e.g. an achievement recorded early) is
//     shown as completed, but does not open anything after an earlier gap.
// Activity milestones open their linked batch-program day (or the batch
// program when no task is linked); revenue milestones have no destination.

import type { WeeklyGraph, WeeklyGraphMilestone } from "@/lib/api/services/batchProgram.service";

export type GrowthMilestoneState = "completed" | "current" | "locked";

export interface GrowthMilestoneLevel {
  id: string | null;
  number: number;
  title: string;
  kind: "activity" | "revenue";
  state: GrowthMilestoneState;
  /** Where clicking goes; null = no destination (locked, or a revenue milestone). */
  href: string | null;
  /** Revenue milestone that cannot be recorded yet (program milestone settings never saved). */
  notRecordable: boolean;
}

/** The backend's built-in defaults (weeklyGraphConfig.ts DEFAULT_GRAPH_MILESTONES). */
export const DEFAULT_GROWTH_MILESTONES: ReadonlyArray<{ label: string; kind: "activity" | "revenue" }> = [
  { label: "Ads", kind: "activity" },
  { label: "Website", kind: "activity" },
  { label: "Funnels", kind: "activity" },
  { label: "1 lakh", kind: "revenue" },
  { label: "1 crore", kind: "revenue" },
];

/** `graph` null = the member is not in a batch program. */
export function buildGrowthMilestones(graph: WeeklyGraph | null): { inBatch: boolean; levels: GrowthMilestoneLevel[] } {
  if (!graph) {
    return {
      inBatch: false,
      levels: DEFAULT_GROWTH_MILESTONES.map((m, i) => ({
        id: null, number: i + 1, title: m.label, kind: m.kind, state: "locked", href: null, notRecordable: false,
      })),
    };
  }
  const milestones: WeeklyGraphMilestone[] = graph.config?.milestones ?? DEFAULT_GROWTH_MILESTONES.map((m) => ({ id: null, ...m }));
  let allEarlierReached = true;
  const levels = milestones.map((m, i): GrowthMilestoneLevel => {
    const reached = m.reached === true;
    const state: GrowthMilestoneState = reached ? "completed" : allEarlierReached ? "current" : "locked";
    allEarlierReached = allEarlierReached && reached;
    const day = typeof m.dayNumber === "number" && m.dayNumber >= 1 ? m.dayNumber : null;
    const href = state === "locked" || m.kind !== "activity" ? null : day ? `/batch-program/${day}` : "/batch-program";
    return {
      id: m.id, number: i + 1, title: m.label, kind: m.kind, state, href,
      notRecordable: m.kind === "revenue" && m.id === null && !reached,
    };
  });
  return { inBatch: true, levels };
}
