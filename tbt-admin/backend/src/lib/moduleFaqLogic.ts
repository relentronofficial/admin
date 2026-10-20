// Pure rules for the admin-managed Modules page FAQ — no I/O, unit-tested.
// Answers are plain multiline text (the app has no rich-text editor); members
// see them rendered as text, never as HTML.

export const FAQ_QUESTION_MAX = 300;
export const FAQ_ANSWER_MAX = 5000;

const FULL_ACCESS_ROLES = new Set(['super_admin', 'admin']);

/** Creating, editing, publishing, reordering and deleting FAQs is Admin/Super Admin only. */
export function canManageModuleFaqs(role: string | null | undefined): boolean {
  return !!role && FULL_ACCESS_ROLES.has(role);
}

/**
 * Normalises submitted text: unifies line endings, drops control characters
 * (keeps newlines/tabs in multiline text), strips HTML tags so stored content
 * is always plain text, trims each line's trailing spaces and collapses runs
 * of blank lines. Single-line text has all whitespace runs collapsed.
 */
export function sanitizeFaqText(input: string, multiline: boolean): string {
  let s = input.replace(/\r\n?/g, '\n');
  // eslint-disable-next-line no-control-regex
  s = s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  s = s.replace(/<[^>]*>/g, '');
  if (!multiline) return s.replace(/\s+/g, ' ').trim();
  return s
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export type Validation<T> = { ok: true; value: T } | { ok: false; error: string };

export interface FaqInput {
  question: string;
  answer: string;
  isPublished: boolean;
}

/** Validates a create (no `current`) or a partial update merged over `current`. */
export function validateFaqInput(body: unknown, current?: FaqInput): Validation<FaqInput> {
  const b = (body ?? {}) as Record<string, unknown>;
  if (typeof b !== 'object' || Array.isArray(b)) return { ok: false, error: 'Invalid request body' };

  const rawQ = b.question ?? current?.question;
  const rawA = b.answer ?? current?.answer;
  if (typeof rawQ !== 'string') return { ok: false, error: 'Question is required' };
  if (typeof rawA !== 'string') return { ok: false, error: 'Answer is required' };
  const question = sanitizeFaqText(rawQ, false);
  const answer = sanitizeFaqText(rawA, true);
  if (!question) return { ok: false, error: 'Question is required' };
  if (!answer) return { ok: false, error: 'Answer is required' };
  if (question.length > FAQ_QUESTION_MAX) return { ok: false, error: `Question must be ${FAQ_QUESTION_MAX} characters or fewer` };
  if (answer.length > FAQ_ANSWER_MAX) return { ok: false, error: `Answer must be ${FAQ_ANSWER_MAX} characters or fewer` };

  const rawP = b.isPublished ?? current?.isPublished ?? false;
  if (typeof rawP !== 'boolean') return { ok: false, error: 'isPublished must be true or false' };
  return { ok: true, value: { question, answer, isPublished: rawP } };
}

/** A reorder must list every existing FAQ id exactly once. */
export function validateFaqReorder(existingIds: string[], ids: unknown): Validation<string[]> {
  if (!Array.isArray(ids) || ids.some((i) => typeof i !== 'string')) return { ok: false, error: 'ids must be an array of FAQ ids' };
  const list = ids as string[];
  if (new Set(list).size !== list.length) return { ok: false, error: 'ids contains duplicates' };
  const existing = new Set(existingIds);
  if (list.length !== existing.size || list.some((i) => !existing.has(i))) {
    return { ok: false, error: 'ids must contain every FAQ exactly once' };
  }
  return { ok: true, value: list };
}

export interface FaqRow {
  id: string;
  question: string;
  answer: string;
  is_published: boolean;
  sort_order: number;
  updated_at?: Date | string | null;
}

export function adminFaqDto(r: FaqRow) {
  return {
    id: r.id,
    question: r.question,
    answer: r.answer,
    isPublished: !!r.is_published,
    sortOrder: Number(r.sort_order),
    updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
  };
}

/** What members get: only id/question/answer, and only for published rows, in display order. */
export function publicFaqList(rows: FaqRow[]) {
  return rows
    .filter((r) => !!r.is_published)
    .sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
    .map((r) => ({ id: r.id, question: r.question, answer: r.answer }));
}
