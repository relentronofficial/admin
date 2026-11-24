/**
 * Checks that the figures in an answer came from the data (pure). A figure the
 * lookups never returned is either the model's own arithmetic or a mistake, so
 * the chat loop makes it look again once, then labels what is left.
 */

// Lakh/crore and K/M forms are left alone (rounded on purpose).
const NUMBER = /\d[\d,]*(?:\.\d+)?(?!\s*(?:lakh|lac|crore|cr\b|k\b|m\b))/gi;

function numbersIn(text: string): number[] {
  return (text.match(NUMBER) ?? []).map((s) => Number(s.replace(/,/g, ''))).filter(Number.isFinite);
}

/** Dates, times and years are not figures. */
function withoutDates(text: string): string {
  return text
    .replace(/\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2})?)?/g, ' ')
    .replace(/\b\d{1,2}[:.]\d{2}\s*(?:am|pm)\b/gi, ' ')
    .replace(/\b\d{1,2}:\d{2}\b/g, ' ')
    .replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, ' ');
}

/** Figures in `answer` that appear in none of `sources`, as written. */
export function unsupportedNumbers(answer: string, sources: string[]): string[] {
  const known = new Set<number>();
  for (const s of sources) for (const x of numbersIn(s)) known.add(x);
  const list = [...known];
  const supported = (x: number, decimals: number) =>
    known.has(x) || list.some((k) => Math.abs(k - x) < 0.5 * 10 ** -decimals + 1e-9);
  const bad: string[] = [];
  for (const raw of withoutDates(answer).match(NUMBER) ?? []) {
    const text = raw.replace(/,+$/, '');
    const x = Number(text.replace(/,/g, ''));
    // Small whole numbers are list positions, days and counts of listed rows.
    if (!Number.isFinite(x) || (Number.isInteger(x) && (x <= 12 || (x >= 2000 && x <= 2100)))) continue;
    if (!supported(x, text.split('.')[1]?.length ?? 0) && !bad.includes(text)) bad.push(text);
  }
  return bad;
}
