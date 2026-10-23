// Members list "Joined from / Joined to" filter — pure (no Prisma, no clock).
//
// The admin filter drawer sends plain dates from <input type="date">
// ("YYYY-MM-DD"). `new Date("2026-10-23")` is midnight UTC (05:30 IST), so used
// directly "Joined to 23 Oct" dropped everyone who joined after 05:30 IST that
// day, and "Joined from" skipped the first 5½ hours. A plain date therefore
// means a whole IST calendar day: from = start of that day (inclusive),
// to = start of the next day (exclusive). A full timestamp keeps its exact
// meaning; anything unparseable means "no bound".

const IST_OFFSET_MS = 330 * 60_000;
const DAY_MS = 24 * 60 * 60 * 1000;
const PLAIN_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Start of an IST calendar day ("YYYY-MM-DD"), or null when it is not a real date. */
function istDayStart(v: string): Date | null {
  const m = PLAIN_DATE.exec(v);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const utc = Date.UTC(y, mo - 1, d);
  const check = new Date(utc);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  return new Date(utc - IST_OFFSET_MS);
}

function parseTimestamp(v: string): Date | undefined {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Prisma createdAt bounds for the joined-date filter; {} when neither bound applies. */
export function memberJoinedRange(joinedFrom: unknown, joinedTo: unknown): { gte?: Date; lt?: Date; lte?: Date } {
  const range: { gte?: Date; lt?: Date; lte?: Date } = {};
  if (typeof joinedFrom === 'string' && joinedFrom.trim()) {
    const v = joinedFrom.trim();
    const day = PLAIN_DATE.test(v) ? istDayStart(v) : undefined;
    const gte = day === undefined ? parseTimestamp(v) : day ?? undefined;
    if (gte) range.gte = gte;
  }
  if (typeof joinedTo === 'string' && joinedTo.trim()) {
    const v = joinedTo.trim();
    if (PLAIN_DATE.test(v)) {
      const day = istDayStart(v);
      if (day) range.lt = new Date(day.getTime() + DAY_MS);
    } else {
      const lte = parseTimestamp(v);
      if (lte) range.lte = lte;
    }
  }
  return range;
}
