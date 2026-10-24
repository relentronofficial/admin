// Course episode ordering — pure rules (no I/O), unit-tested in
// episodeOrdering.test.ts. DB orchestration: applyEpisodeOrder() in
// modules/courses/controller.ts.
//
// course_episodes."order" is ONE course-wide sequence (sequential unlocking,
// the member lesson list and progress all sort by it). Admins and members see
// episodes grouped by section, so the sequence must follow the sections:
//   sections by sort_order (ties: created_at, id), then unsectioned ("General");
//   within a group: current order (null last), then created_at, then id.
// Every reorder renumbers the whole course 0..n-1 in that canonical order, so
// positions stay unique and sequential. Episode ids and sections never change.

export interface OrderEpisode {
  id: string;
  sectionId: string | null;
  order: number | null;
  createdAt?: Date | string | null;
}

export interface OrderSection {
  id: string;
  sortOrder: number | null;
  createdAt?: Date | string | null;
}

export interface OrderChange {
  /** Drag-and-drop: the admin's list of episode ids, in the new order. */
  sequence?: string[];
  /** Edit Episode: put this episode at a 1-based position inside its own section. */
  move?: { episodeId: string; position: number };
  /** The episode just changed section: put it at the end of its (new) section. */
  toSectionEnd?: string;
}

const ts = (v: Date | string | null | undefined) => (v == null ? Number.POSITIVE_INFINITY : new Date(v).getTime());
const num = (v: number | null | undefined) => (v == null || !Number.isFinite(Number(v)) ? Number.POSITIVE_INFINITY : Number(v));
const byOrderThenAge = (a: OrderEpisode, b: OrderEpisode) =>
  num(a.order) - num(b.order) || ts(a.createdAt) - ts(b.createdAt) || a.id.localeCompare(b.id);

/** Sections in display order; unknown/deleted sections fall back to "General" (key null). */
function groupsInOrder(episodes: OrderEpisode[], sections: OrderSection[]): Map<string | null, OrderEpisode[]> {
  const sorted = [...sections].sort(
    (a, b) => num(a.sortOrder) - num(b.sortOrder) || ts(a.createdAt) - ts(b.createdAt) || a.id.localeCompare(b.id),
  );
  const groups = new Map<string | null, OrderEpisode[]>();
  for (const s of sorted) groups.set(s.id, []);
  groups.set(null, []);
  for (const e of episodes) {
    const key = e.sectionId && groups.has(e.sectionId) ? e.sectionId : null;
    groups.get(key)!.push(e);
  }
  return groups;
}

/** Final canonical sequence: [{ id, order }] with order = 0..n-1. */
export function planEpisodeOrder(
  episodes: OrderEpisode[],
  sections: OrderSection[],
  change: OrderChange = {},
): Array<{ id: string; order: number }> {
  const seqIdx = new Map((change.sequence ?? []).map((id, i) => [id, i]));
  const groups = groupsInOrder(episodes, sections);
  const out: Array<{ id: string; order: number }> = [];
  for (const list of groups.values()) {
    list.sort((a, b) => {
      if (seqIdx.size) {
        const ia = seqIdx.get(a.id) ?? Number.POSITIVE_INFINITY;
        const ib = seqIdx.get(b.id) ?? Number.POSITIVE_INFINITY;
        if (ia !== ib) return ia - ib;
      }
      return byOrderThenAge(a, b);
    });
    if (change.toSectionEnd) {
      const i = list.findIndex((e) => e.id === change.toSectionEnd);
      if (i >= 0) list.push(...list.splice(i, 1));
    }
    if (change.move) {
      const i = list.findIndex((e) => e.id === change.move!.episodeId);
      if (i >= 0) {
        const [ep] = list.splice(i, 1);
        const at = Math.min(Math.max(Math.trunc(change.move.position) - 1, 0), list.length);
        list.splice(at, 0, ep);
      }
    }
    for (const e of list) out.push({ id: e.id, order: out.length });
  }
  return out;
}

/** 1-based position of each episode inside its own section, in canonical order. */
export function sectionPositions(episodes: OrderEpisode[], sections: OrderSection[]): Map<string, number> {
  const pos = new Map<string, number>();
  const canonical = planEpisodeOrder(episodes, sections);
  const sectionOf = new Map(episodes.map((e) => [e.id, e.sectionId]));
  const known = new Set(sections.map((s) => s.id));
  const counters = new Map<string | null, number>();
  for (const { id } of canonical) {
    const s = sectionOf.get(id) ?? null;
    const key = s && known.has(s) ? s : null;
    const n = (counters.get(key) ?? 0) + 1;
    counters.set(key, n);
    pos.set(id, n);
  }
  return pos;
}

/** "Episode Order" input: a positive whole number. */
export function parseEpisodePosition(raw: unknown): { ok: true; value: number } | { ok: false; error: string } {
  const n = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 1) {
    return { ok: false, error: 'Episode Order must be a whole number of 1 or more' };
  }
  if (n > 100000) return { ok: false, error: 'Episode Order is too large' };
  return { ok: true, value: n };
}
