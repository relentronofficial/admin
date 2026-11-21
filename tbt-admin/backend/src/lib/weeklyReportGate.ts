// Mandatory weekly report — pure rules (no Prisma, no env, `now` passed in) so they can be
// unit-tested; see weeklyReportGate.test.ts.
//
// Rules (all times IST, fixed +05:30, weeks run Monday 00:00 → Sunday 23:59):
//   - A member "has submitted this week" when any Weekly Report (course_weekly_feedback,
//     any course) was submitted on or after this week's Monday 00:00.
//   - Friday and Saturday: members who haven't submitted see a reminder popup.
//   - Saturday 18:00: reminder notification (in-app + push + WhatsApp) to those who haven't.
//   - From Saturday 18:00, course videos lock until the report for that week is in. The
//     lock carries over into the next week: on Monday a member who skipped last week's
//     report is still locked until they submit one.
//   - Only members with at least one course enrollment are asked (the report form needs a
//     course). A member whose first enrollment came after a deadline isn't locked by it.

export const IST_OFFSET_MS = (5 * 60 + 30) * 60_000;
const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
/** Saturday 18:00 measured from Monday 00:00. */
const DEADLINE_OFFSET_MS = 5 * DAY_MS + 18 * 3_600_000;

/** Monday 00:00 IST of the week containing `now`, as a real instant. */
export function istWeekStart(now: Date): Date {
  const ist = new Date(now.getTime() + IST_OFFSET_MS); // wall-clock IST read via UTC getters
  const daysSinceMonday = (ist.getUTCDay() + 6) % 7;
  const mondayIst = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - daysSinceMonday * DAY_MS;
  return new Date(mondayIst - IST_OFFSET_MS);
}

/** IST weekday: 0 = Sunday … 5 = Friday, 6 = Saturday. */
export function istWeekday(now: Date): number {
  return new Date(now.getTime() + IST_OFFSET_MS).getUTCDay();
}

/** This week's deadline: Saturday 18:00 IST. */
export function weekDeadline(now: Date): Date {
  return new Date(istWeekStart(now).getTime() + DEADLINE_OFFSET_MS);
}

/** The most recent Saturday 18:00 IST that has already passed (≤ now). */
export function lastPassedDeadline(now: Date): Date {
  const thisWeek = weekDeadline(now);
  return now.getTime() >= thisWeek.getTime() ? thisWeek : new Date(thisWeek.getTime() - WEEK_MS);
}

export interface WeeklyReportInput {
  now: Date;
  /** Latest course_weekly_feedback.submitted_at for the member, or null. */
  lastSubmittedAt: Date | null;
  /** Earliest course_enrollments.enrolled_at for the member, or null when not enrolled. */
  firstEnrolledAt: Date | null;
}

export interface WeeklyReportStatus {
  /** Member is asked for weekly reports at all (has a course enrollment). */
  required: boolean;
  /** A report was submitted on or after this week's Monday. */
  submittedThisWeek: boolean;
  /** Friday/Saturday reminder popup should show. */
  showReminder: boolean;
  /** Course videos are locked until a report is submitted. */
  locked: boolean;
  weekStart: string;
  /** This week's Saturday 18:00 IST. */
  deadline: string;
}

export function computeWeeklyReportStatus({ now, lastSubmittedAt, firstEnrolledAt }: WeeklyReportInput): WeeklyReportStatus {
  const weekStart = istWeekStart(now);
  const deadline = weekDeadline(now);
  const required = firstEnrolledAt != null;
  const submittedThisWeek = !!lastSubmittedAt && lastSubmittedAt.getTime() >= weekStart.getTime();

  const passed = lastPassedDeadline(now);
  const dueWeekStart = new Date(passed.getTime() - DEADLINE_OFFSET_MS);
  const enrolledBeforeDeadline = !!firstEnrolledAt && firstEnrolledAt.getTime() < passed.getTime();
  const coveredDueWeek = !!lastSubmittedAt && lastSubmittedAt.getTime() >= dueWeekStart.getTime();
  const locked = required && enrolledBeforeDeadline && !coveredDueWeek;

  const day = istWeekday(now);
  const showReminder = required && !submittedThisWeek && (day === 5 || day === 6);

  return {
    required,
    submittedThisWeek,
    showReminder,
    locked,
    weekStart: weekStart.toISOString(),
    deadline: deadline.toISOString(),
  };
}
