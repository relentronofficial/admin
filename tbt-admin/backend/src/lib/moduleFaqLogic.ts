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
  /** Optional Bunny Stream video (embed URL + video id); null = no video. */
  videoUrl?: string | null;
  bunnyVideoId?: string | null;
  /** FAQ category (section in the member FAQ popup); null only for older FAQs created before categories. */
  category?: FaqCategory | null;
  /** Optional thumbnail image (public https URL of the uploaded image); null = none. */
  thumbnailUrl?: string | null;
}

/** FAQ categories, in the order members see them. */
export const FAQ_CATEGORIES = ['ecommerce', 'service', 'coachx'] as const;
export type FaqCategory = (typeof FAQ_CATEGORIES)[number];
const isFaqCategory = (v: unknown): v is FaqCategory => typeof v === 'string' && (FAQ_CATEGORIES as readonly string[]).includes(v);

export const FAQ_VIDEO_URL_MAX = 1000;
export const FAQ_BATCH_MAX = 20;
const BUNNY_VIDEO_ID = /^[A-Za-z0-9-]{1,100}$/;

/**
 * Optional video fields. Omitted → keep `current` (update) / none (create);
 * null or '' → no video. A video URL must be an https URL; the Bunny id is
 * kept only alongside a URL.
 */
function validateFaqVideo(b: Record<string, unknown>, current?: FaqInput): Validation<{ videoUrl: string | null; bunnyVideoId: string | null }> {
  const rawUrl = 'videoUrl' in b ? b.videoUrl : current?.videoUrl ?? null;
  const rawId = 'bunnyVideoId' in b ? b.bunnyVideoId : 'videoUrl' in b ? null : current?.bunnyVideoId ?? null;
  if (rawUrl === null || rawUrl === undefined || rawUrl === '') return { ok: true, value: { videoUrl: null, bunnyVideoId: null } };
  if (typeof rawUrl !== 'string' || rawUrl.length > FAQ_VIDEO_URL_MAX) return { ok: false, error: 'Video URL is invalid' };
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { ok: false, error: 'Video URL is invalid' };
  }
  if (parsed.protocol !== 'https:') return { ok: false, error: 'Video URL must use https' };
  if (rawId !== null && rawId !== undefined && rawId !== '' && (typeof rawId !== 'string' || !BUNNY_VIDEO_ID.test(rawId))) {
    return { ok: false, error: 'Video id is invalid' };
  }
  return { ok: true, value: { videoUrl: parsed.toString(), bunnyVideoId: typeof rawId === 'string' && rawId ? rawId : null } };
}

/**
 * Optional thumbnail. Omitted → keep `current` (update) / none (create);
 * null or '' → no thumbnail. Must be an https URL (the uploaded image's public URL).
 */
function validateFaqThumbnail(b: Record<string, unknown>, current?: FaqInput): Validation<string | null> {
  const raw = 'thumbnailUrl' in b ? b.thumbnailUrl : current?.thumbnailUrl ?? null;
  if (raw === null || raw === undefined || raw === '') return { ok: true, value: null };
  if (typeof raw !== 'string' || raw.length > FAQ_VIDEO_URL_MAX) return { ok: false, error: 'Thumbnail URL is invalid' };
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return { ok: false, error: 'Thumbnail URL is invalid' };
  }
  if (parsed.protocol !== 'https:') return { ok: false, error: 'Thumbnail URL must use https' };
  return { ok: true, value: parsed.toString() };
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
  const video = validateFaqVideo(b, current);
  if (!video.ok) return video;
  const thumbnail = validateFaqThumbnail(b, current);
  if (!thumbnail.ok) return thumbnail;

  // Category: required for a new FAQ; on update, omitted keeps the current one
  // (older FAQs may have none until an admin picks one).
  let category: FaqCategory | null;
  if ('category' in b) {
    if (!isFaqCategory(b.category)) return { ok: false, error: 'Choose a category: Ecommerce, Service or CoachX' };
    category = b.category;
  } else if (current) {
    category = current.category ?? null;
  } else {
    return { ok: false, error: 'Category is required' };
  }
  return { ok: true, value: { question, answer, isPublished: rawP, ...video.value, category, thumbnailUrl: thumbnail.value } };
}

/**
 * Several new FAQs saved together: { items: [{ question, answer, isPublished?, videoUrl?, bunnyVideoId? }] }.
 * Every item must be valid — the error names the entry, and nothing is saved otherwise.
 */
export function validateFaqBatch(body: unknown): Validation<FaqInput[]> {
  const items = (body as { items?: unknown } | null)?.items;
  if (!Array.isArray(items) || items.length === 0) return { ok: false, error: 'Add at least one question' };
  if (items.length > FAQ_BATCH_MAX) return { ok: false, error: `Save at most ${FAQ_BATCH_MAX} questions at a time` };
  const out: FaqInput[] = [];
  for (let i = 0; i < items.length; i++) {
    const v = validateFaqInput(items[i]);
    if (!v.ok) return { ok: false, error: `Question ${i + 1}: ${v.error}` };
    out.push(v.value);
  }
  return { ok: true, value: out };
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
  video_url?: string | null;
  bunny_video_id?: string | null;
  category?: string | null;
  thumbnail_url?: string | null;
}

export function adminFaqDto(r: FaqRow) {
  return {
    id: r.id,
    question: r.question,
    answer: r.answer,
    isPublished: !!r.is_published,
    sortOrder: Number(r.sort_order),
    updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
    videoUrl: r.video_url ?? null,
    bunnyVideoId: r.bunny_video_id ?? null,
    category: isFaqCategory(r.category) ? r.category : null,
    thumbnailUrl: r.thumbnail_url ?? null,
  };
}

/** What members get: published rows in display order, including optional video. */
export function publicFaqList(rows: FaqRow[]) {
  return rows
    .filter((r) => !!r.is_published)
    .sort((a, b) => Number(a.sort_order) - Number(b.sort_order))
    .map((r) => ({
      id: r.id,
      question: r.question,
      answer: r.answer,
      videoUrl: r.video_url ?? null,
      bunnyVideoId: r.bunny_video_id ?? null,
      category: isFaqCategory(r.category) ? r.category : null,
    }));
}
