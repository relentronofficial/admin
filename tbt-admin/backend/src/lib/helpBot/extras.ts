/**
 * TBT Assistant (members) — pure helpers, no I/O. Unit-tested in extras.test.ts.
 *  - follow-up suggestions the model adds after its answer
 *  - what page the member is on
 *  - the abuse guard (spam, repeats, huge pastes, attempts to change the rules)
 *  - the daily nudge card (from data, no AI)
 *  - each member's own assistant settings
 */
import { z } from 'zod';

// ── Follow-up suggestions ────────────────────────────────────────────────────

export const FOLLOW_UPS_TAG = 'FOLLOWUPS:';
export const MAX_FOLLOW_UPS = 3;

/** Takes the model's last "FOLLOWUPS: a | b | c" line out of the answer. */
export function splitFollowUps(raw: string): { text: string; followUps: string[] } {
  const lines = raw.replace(/\r/g, '').split('\n');
  const followUps: string[] = [];
  const kept = lines.filter((line) => {
    const m = /^\s*(?:[*_`>-]\s*)*FOLLOWUPS:\s*(.*)$/i.exec(line);
    if (!m) return true;
    for (const part of m[1].split('|')) {
      const q = part.replace(/[*_`]/g, '').trim();
      if (q.length >= 3 && q.length <= 90 && followUps.length < MAX_FOLLOW_UPS && !followUps.includes(q)) followUps.push(q);
    }
    return false;
  });
  return { text: kept.join('\n').replace(/\n{3,}/g, '\n\n').trim(), followUps };
}

// ── Page the member is on ────────────────────────────────────────────────────

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

export type PageRef =
  | { kind: 'lesson'; courseId: string; lessonId: string | null }
  | { kind: 'course'; courseId: string }
  | { kind: 'batch_day'; day: number }
  | { kind: 'other' };

/** What the page path (with its ?query) points at. Anything odd is "other". */
export function parsePage(page: unknown): PageRef {
  if (typeof page !== 'string' || page.length > 300) return { kind: 'other' };
  const [path, query = ''] = page.split('?');
  const lesson = new URLSearchParams(query).get('lesson');
  const lessonId = lesson && new RegExp(`^${UUID}$`, 'i').test(lesson) ? lesson : null;
  let m = new RegExp(`^/learning/(${UUID})(?:/(${UUID}))?/?$`, 'i').exec(path);
  if (m) return { kind: 'lesson', courseId: m[1], lessonId: m[2] ?? lessonId };
  m = new RegExp(`^/courses/(${UUID})/?$`, 'i').exec(path);
  if (m) return { kind: 'course', courseId: m[1] };
  m = /^\/batch-program\/(\d{1,4})\/?$/.exec(path);
  if (m) return { kind: 'batch_day', day: Number(m[1]) };
  return { kind: 'other' };
}

// ── Abuse guard ──────────────────────────────────────────────────────────────

export type GuardResult =
  | { ok: true; suspicious: boolean }
  | { ok: false; reason: 'repeat' | 'spam' | 'paste'; reply: string };

const normal = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

const RULE_CHANGE = [
  /\bignore\b.{0,40}\b(instructions?|rules?|prompt)\b/i,
  /\b(system|developer)\s+(prompt|message|mode)\b/i,
  /\b(reveal|show|print|repeat)\b.{0,30}\b(your|the)\s+(instructions?|rules?|prompt)\b/i,
  /\bjail\s*break\b/i,
  /\byou\s+are\s+now\b/i,
  /\bpretend\s+(to\s+be|you\s+are)\b/i,
];

/**
 * Checks a question before any AI call. A blocked question is answered with
 * `reply` and costs nothing. `recent` = this member's questions in the last 10 minutes.
 */
export function guardQuestion(question: string, recent: string[]): GuardResult {
  const q = normal(question);
  if (q && recent.filter((r) => normal(r) === q).length >= 2) {
    return { ok: false, reason: 'repeat', reply: 'You have asked this a few times already: my answer above stays the same. Try asking it another way, or [raise a ticket](/support/new) and the team will help.' };
  }
  const letters = (question.match(/\p{L}/gu) ?? []).length;
  if (/(.)\1{24,}/su.test(question) || (question.length > 40 && letters / question.length < 0.25)) {
    return { ok: false, reason: 'spam', reply: 'I could not read that as a question. Please type your question in a few words.' };
  }
  if (question.split('\n').length > 40 || (question.match(/https?:\/\//g) ?? []).length > 3) {
    return { ok: false, reason: 'paste', reply: 'That is too much pasted text for me. Please ask your question in a few lines.' };
  }
  return { ok: true, suspicious: RULE_CHANGE.some((r) => r.test(question)) };
}

/** ISO week (Monday start) of an instant, in IST — the week "Your Revenue Stats" saves to. */
export function isoWeekIst(at: Date): { week: number; year: number } {
  const ist = new Date(at.getTime() + 5.5 * 3600_000);
  const d = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3);
  const jan4 = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  jan4.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + 3);
  return { week: 1 + Math.round((d.getTime() - jan4.getTime()) / (7 * 86_400_000)), year: d.getUTCFullYear() };
}

// ── Daily nudge (no AI) ──────────────────────────────────────────────────────

export interface NudgeInput {
  weeklyReport: { required: boolean; submittedThisWeek: boolean; locked: boolean; showReminder: boolean } | null;
  nextLesson: { title: string; course: string; link: string } | null;
  pendingTasksToday: number;
  currentDay: number | null;
  callsToday: Array<{ title: string; starts: string }>;
  unreadNotifications: number;
  habitsLeft: number;
  revenueDue: boolean;
}

export type Nudge =
  | { kind: 'weekly_report'; locked: boolean; href: string }
  | { kind: 'call_today'; title: string; starts: string; href: string }
  | { kind: 'tasks'; count: number; day: number; href: string }
  | { kind: 'lesson'; title: string; course: string; href: string }
  | { kind: 'revenue'; href: string }
  | { kind: 'habits'; count: number; href: string }
  | { kind: 'notifications'; count: number; href: string };

/** At most `max` things to do today, most urgent first. */
export function buildNudges(i: NudgeInput, max = 3): Nudge[] {
  const out: Nudge[] = [];
  const w = i.weeklyReport;
  if (w?.required && !w.submittedThisWeek && (w.locked || w.showReminder)) out.push({ kind: 'weekly_report', locked: w.locked, href: '/learning' });
  for (const c of i.callsToday.slice(0, 1)) out.push({ kind: 'call_today', title: c.title, starts: c.starts, href: '/mentorship' });
  if (i.pendingTasksToday > 0 && i.currentDay) out.push({ kind: 'tasks', count: i.pendingTasksToday, day: i.currentDay, href: `/batch-program/${i.currentDay}` });
  if (i.nextLesson) out.push({ kind: 'lesson', title: i.nextLesson.title, course: i.nextLesson.course, href: i.nextLesson.link });
  if (i.revenueDue) out.push({ kind: 'revenue', href: '/mentorship' });
  if (i.habitsLeft > 0) out.push({ kind: 'habits', count: i.habitsLeft, href: '/dashboard' });
  if (i.unreadNotifications > 0) out.push({ kind: 'notifications', count: i.unreadNotifications, href: '/notifications' });
  return out.slice(0, max);
}

// ── Member's own assistant settings ──────────────────────────────────────────

export const VOICE_LANGS = ['tanglish', 'tamil', 'english'] as const;
export const VOICE_NAMES = ['Zephyr', 'Kore', 'Puck', 'Charon'] as const;
export const VOICE_PACES = ['slow', 'normal', 'fast'] as const;
export const MEMORY_MAX = 800;

export const prefsSchema = z.object({
  memory: z.string().trim().max(MEMORY_MAX, `Keep it under ${MEMORY_MAX} characters.`).nullable(),
  voiceLang: z.enum(VOICE_LANGS),
  voiceName: z.enum(VOICE_NAMES),
  voicePace: z.enum(VOICE_PACES),
  dailyCreditCap: z.number().int().min(1).max(100_000).nullable(),
});
export type HelpBotPrefs = z.infer<typeof prefsSchema>;

export const DEFAULT_PREFS: HelpBotPrefs = { memory: null, voiceLang: 'tanglish', voiceName: 'Zephyr', voicePace: 'normal', dailyCreditCap: null };

export function mapPrefs(r: any): HelpBotPrefs {
  if (!r) return { ...DEFAULT_PREFS };
  const pick = <T extends readonly string[]>(list: T, v: unknown, d: T[number]) => (list.includes(v as string) ? (v as T[number]) : d);
  return {
    memory: typeof r.memory === 'string' && r.memory.trim() ? r.memory : null,
    voiceLang: pick(VOICE_LANGS, r.voice_lang, 'tanglish'),
    voiceName: pick(VOICE_NAMES, r.voice_name, 'Zephyr'),
    voicePace: pick(VOICE_PACES, r.voice_pace, 'normal'),
    dailyCreditCap: r.daily_credit_cap == null ? null : Number(r.daily_credit_cap),
  };
}

/** Adds one note to the memory, newest last, dropping the oldest notes when it gets too long. */
export function appendMemory(memory: string | null, note: string): string {
  const lines = (memory ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  const add = note.replace(/\s+/g, ' ').trim().slice(0, 200);
  if (add && !lines.includes(add)) lines.push(add);
  while (lines.join('\n').length > MEMORY_MAX && lines.length > 1) lines.shift();
  return lines.join('\n').slice(0, MEMORY_MAX);
}

/** True when today's answers already used the member's own daily credit cap. */
export function overDailyCap(usedToday: number, cap: number | null): boolean {
  return cap != null && usedToday >= cap;
}
