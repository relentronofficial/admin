// Admin-configurable Weekly Activity Graph — pure rules (no Prisma, no Fastify).
//
// Storage (startup DDL in plugins/prisma.ts, raw SQL, no Prisma models):
//   graph_weeks        per-program X-axis weeks: label, day range, order, active
//   graph_milestones   per-program Y-axis milestones: label, kind, order, active
//   member_graph_milestone_records  admin-recorded member achievements
//   tasks.graph_week_id / tasks.graph_milestone_id  optional stable links
//
// A program with no rows uses the built-in defaults below — exactly the graph
// members saw before this feature — until an admin first edits that program,
// at which point the defaults are written as real rows (ensureProgramGraphConfig).

export type MilestoneKind = 'activity' | 'revenue';

export interface GraphWeekRow {
  id: string;
  label: string;
  startDay: number;
  endDay: number;
  sortOrder: number;
  isActive: boolean;
}

export interface GraphMilestoneRow {
  id: string;
  label: string;
  kind: MilestoneKind;
  sortOrder: number;
  isActive: boolean;
}

/** What buildWeeklyGraph consumes. id null = a built-in default (not yet saved). */
export interface GraphConfigWeek { id: string | null; label: string; startDay: number; endDay: number }
export interface GraphConfigMilestone { id: string | null; label: string; kind: MilestoneKind }
export interface GraphConfig {
  source: 'program' | 'default';
  /** null = derive 7-day weeks from the member's program length (default behaviour) */
  weeks: GraphConfigWeek[] | null;
  /** Last day covered by any configured week, active or not (tasks in a disabled week stay hidden). */
  coveredUntilDay: number;
  milestones: GraphConfigMilestone[];
}

export const DEFAULT_GRAPH_MILESTONES: ReadonlyArray<{ label: string; kind: MilestoneKind }> = [
  { label: 'Ads', kind: 'activity' },
  { label: 'Website', kind: 'activity' },
  { label: 'Funnels', kind: 'activity' },
  { label: '1 lakh', kind: 'revenue' },
  { label: '1 crore', kind: 'revenue' },
];

export const MAX_LABEL_LENGTH = 60;
export const MAX_PROGRAM_DAY = 3650;

/** The default 7-day weeks for a program length: W1 = days 1–7, W2 = 8–14, … */
export function defaultWeeks(totalDays: number): Array<{ label: string; startDay: number; endDay: number }> {
  const days = Math.max(0, Math.floor(totalDays));
  const out: Array<{ label: string; startDay: number; endDay: number }> = [];
  for (let start = 1, n = 1; start <= days; start += 7, n++) {
    out.push({ label: `W${n}`, startDay: start, endDay: Math.min(start + 6, days) });
  }
  return out;
}

/** Turn stored rows into the graph config (active items only, in admin order). */
export function resolveGraphConfig(rows: { weeks: GraphWeekRow[]; milestones: GraphMilestoneRow[] }): GraphConfig {
  const byOrder = <T extends { sortOrder: number; label: string }>(a: T, b: T) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label);
  const weeks = rows.weeks.length
    ? [...rows.weeks].sort(byOrder).filter((w) => w.isActive).map((w) => ({ id: w.id, label: w.label, startDay: w.startDay, endDay: w.endDay }))
    : null;
  const milestones = rows.milestones.length
    ? [...rows.milestones].sort(byOrder).filter((m) => m.isActive).map((m) => ({ id: m.id, label: m.label, kind: m.kind }))
    : DEFAULT_GRAPH_MILESTONES.map((m) => ({ id: null, ...m }));
  return {
    source: rows.weeks.length || rows.milestones.length ? 'program' : 'default',
    weeks,
    coveredUntilDay: rows.weeks.reduce((max, w) => Math.max(max, w.endDay), 0),
    milestones,
  };
}

/**
 * Highest axis level task completion may reach: the activity milestones that
 * come before the first revenue milestone. Tasks never prove revenue, so a
 * point only reaches a revenue milestone (or anything above it) through an
 * admin-recorded achievement.
 */
export function taskProgressCap(milestones: Array<{ kind: MilestoneKind }>): number {
  let cap = 0;
  for (const m of milestones) {
    if (m.kind !== 'activity') break;
    cap += 1;
  }
  return cap;
}

const norm = (s: string | null | undefined) => (s ?? '').trim().toLowerCase().replace(/s$/, '');

/** Legacy link: a milestone task's free-text label matched to a configured milestone (case-insensitive, singular/plural). */
export function milestoneIndexForLabel(milestones: Array<{ label: string }>, label: string | null | undefined): number {
  const key = norm(label);
  if (!key) return -1;
  return milestones.findIndex((m) => norm(m.label) === key);
}

// ── Server-side validation of admin input ────────────────────────────────────

export type Validation<T> = { ok: true; value: T } | { ok: false; error: string };

function cleanLabel(raw: unknown): Validation<string> {
  if (typeof raw !== 'string') return { ok: false, error: 'Label is required' };
  const label = raw.trim().replace(/\s+/g, ' ');
  if (!label) return { ok: false, error: 'Label is required' };
  if (label.length > MAX_LABEL_LENGTH) return { ok: false, error: `Label must be at most ${MAX_LABEL_LENGTH} characters` };
  return { ok: true, value: label };
}

function cleanDay(raw: unknown, name: string): Validation<number> {
  const n = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > MAX_PROGRAM_DAY) {
    return { ok: false, error: `${name} must be a whole number between 1 and ${MAX_PROGRAM_DAY}` };
  }
  return { ok: true, value: n };
}

export interface WeekInput { label: string; startDay: number; endDay: number; isActive: boolean }
export interface MilestoneInput { label: string; kind: MilestoneKind; isActive: boolean }

/** Full validation for create; for update, missing fields are taken from `current`. */
export function validateWeekInput(body: any, current?: WeekInput): Validation<WeekInput> {
  const b = body ?? {};
  const label = cleanLabel(b.label ?? current?.label);
  if (!label.ok) return label;
  const startDay = cleanDay(b.startDay ?? current?.startDay, 'Start day');
  if (!startDay.ok) return startDay;
  const endDay = cleanDay(b.endDay ?? current?.endDay, 'End day');
  if (!endDay.ok) return endDay;
  if (endDay.value < startDay.value) return { ok: false, error: 'End day must be on or after the start day' };
  const isActive = b.isActive ?? current?.isActive ?? true;
  if (typeof isActive !== 'boolean') return { ok: false, error: 'isActive must be true or false' };
  return { ok: true, value: { label: label.value, startDay: startDay.value, endDay: endDay.value, isActive } };
}

export function validateMilestoneInput(body: any, current?: MilestoneInput): Validation<MilestoneInput> {
  const b = body ?? {};
  const label = cleanLabel(b.label ?? current?.label);
  if (!label.ok) return label;
  const kind = b.kind ?? current?.kind ?? 'activity';
  if (kind !== 'activity' && kind !== 'revenue') return { ok: false, error: "Kind must be 'activity' or 'revenue'" };
  const isActive = b.isActive ?? current?.isActive ?? true;
  if (typeof isActive !== 'boolean') return { ok: false, error: 'isActive must be true or false' };
  return { ok: true, value: { label: label.value, kind, isActive } };
}

/** Another item (excluding `exceptId`) already uses this label, case-insensitively. */
export function hasDuplicateLabel(items: Array<{ id: string; label: string }>, label: string, exceptId?: string): boolean {
  const key = label.trim().toLowerCase();
  return items.some((i) => i.id !== exceptId && i.label.trim().toLowerCase() === key);
}

/** An active week (excluding `exceptId`) whose day range overlaps [startDay, endDay]. */
export function findOverlappingWeek(
  weeks: Array<{ id: string; label: string; startDay: number; endDay: number; isActive: boolean }>,
  range: { startDay: number; endDay: number; isActive: boolean },
  exceptId?: string,
): { id: string; label: string } | null {
  if (!range.isActive) return null;
  const hit = weeks.find((w) => w.id !== exceptId && w.isActive && w.startDay <= range.endDay && range.startDay <= w.endDay);
  return hit ? { id: hit.id, label: hit.label } : null;
}

/** A reorder must list exactly the program's existing ids, each once. */
export function validateReorder(existingIds: string[], ids: unknown): Validation<string[]> {
  if (!Array.isArray(ids) || ids.some((i) => typeof i !== 'string')) return { ok: false, error: 'ids must be an array of ids' };
  const list = ids as string[];
  if (new Set(list).size !== list.length) return { ok: false, error: 'ids contains duplicates' };
  const existing = new Set(existingIds);
  if (list.length !== existing.size || list.some((i) => !existing.has(i))) {
    return { ok: false, error: 'ids must contain every item of this program exactly once' };
  }
  return { ok: true, value: list };
}

export interface ActivityInput { title: string; weekId: string | null; milestoneId: string | null; isRequired: boolean; isActive: boolean }

export function validateActivityInput(body: any, current?: ActivityInput): Validation<ActivityInput> {
  const b = body ?? {};
  const rawTitle = b.title ?? current?.title;
  if (typeof rawTitle !== 'string' || !rawTitle.trim()) return { ok: false, error: 'Title is required' };
  const title = rawTitle.trim().replace(/\s+/g, ' ');
  if (title.length > 200) return { ok: false, error: 'Title must be at most 200 characters' };
  const weekId = b.weekId !== undefined ? b.weekId : current?.weekId ?? null;
  const milestoneId = b.milestoneId !== undefined ? b.milestoneId : current?.milestoneId ?? null;
  for (const [name, v] of [['weekId', weekId], ['milestoneId', milestoneId]] as const) {
    if (v !== null && (typeof v !== 'string' || !/^[0-9a-f-]{36}$/i.test(v))) return { ok: false, error: `${name} must be an id or null` };
  }
  const isRequired = b.isRequired ?? current?.isRequired ?? true;
  const isActive = b.isActive ?? current?.isActive ?? true;
  if (typeof isRequired !== 'boolean' || typeof isActive !== 'boolean') return { ok: false, error: 'isRequired and isActive must be true or false' };
  return { ok: true, value: { title, weekId, milestoneId, isRequired, isActive } };
}

// ── Who may change what (admin roles: super_admin, admin, account_manager, mentor, moderator) ──

const CONFIG_EDITOR_ROLES = new Set(['super_admin', 'admin']);
const PROGRESS_RECORDER_ROLES = new Set(['super_admin', 'admin', 'mentor']);

/** Weeks, milestones and activities: Admin and Super Admin only. */
export function canEditGraphConfig(role: string | null | undefined): boolean {
  return !!role && CONFIG_EDITOR_ROLES.has(role);
}

/** Recording a member's milestone achievement: Admin, Super Admin and Mentor. */
export function canRecordGraphProgress(role: string | null | undefined): boolean {
  return !!role && PROGRESS_RECORDER_ROLES.has(role);
}
