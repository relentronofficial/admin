"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Brain, CalendarCheck, CalendarX, CheckCircle2, ClipboardCopy, IndianRupee, LifeBuoy, Loader2, Star, Sun } from "lucide-react";
import { useMe } from "@/lib/hooks/useUser";
import { useBookSupportCall, useCancelSupportCallBooking } from "@/lib/hooks/useSupportCalls";
import { supportKeys } from "@/lib/hooks/useSupport";
import { supportService } from "@/lib/api/services/support.service";
import { helpBotService, type HelpBotAction, type HelpBotActionStatus } from "@/lib/api/services/helpBot.service";
import { mentorshipService } from "@/lib/api/services/mentorship.service";
import { coursesService } from "@/lib/api/services/courses.service";
import { weeklyGraphQueryKey } from "@/lib/hooks/useBatchProgram";

export type T = (key: string, fallback: string) => string;

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** Something the assistant prepared. Only Confirm here makes it happen. */
export function ActionCard({
  action, messageId, index, onStatus, t,
}: {
  action: HelpBotAction;
  messageId: string;
  index: number;
  onStatus: (status: HelpBotActionStatus) => void;
  t: T;
}) {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const bookCall = useBookSupportCall();
  const cancelCall = useCancelSupportCallBooking();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState(action.type === "ticket" ? action.message : "");
  const [draft, setDraft] = useState(action.type === "task_draft" ? action.text : "");

  const view = {
    ticket: { Icon: LifeBuoy, title: t("helpBotTicketTitle", "Raise a support ticket"), link: "/support/tickets" },
    book_call: { Icon: CalendarCheck, title: t("helpBotBookTitle", "Book this call"), link: "/mentorship" },
    cancel_call: { Icon: CalendarX, title: t("helpBotCancelCallTitle", "Cancel this call"), link: "/mentorship" },
    habit: { Icon: Sun, title: t("helpBotHabitTitle", "Update today's habit"), link: "/dashboard" },
    revenue: { Icon: IndianRupee, title: t("helpBotRevenueTitle", "Save this week's revenue"), link: "/mentorship" },
    task_draft: { Icon: ClipboardCopy, title: t("helpBotDraftTitle", "Draft for your task"), link: action.type === "task_draft" ? action.link : "/batch-program" },
    lesson_rating: { Icon: Star, title: t("helpBotRatingTitle", "Rate this lesson"), link: action.type === "lesson_rating" ? `/learning/${action.courseId}?lesson=${action.lessonId}` : "/learning" },
    memory: { Icon: Brain, title: t("helpBotMemoryTitle", "Remember this about you"), link: "/community" },
  }[action.type];

  const person = me as unknown as { name?: string; firstName?: string; lastName?: string; email?: string; phone?: string } | undefined;
  const name = person?.name || [person?.firstName, person?.lastName].filter(Boolean).join(" ");
  const needsForm = action.type === "ticket" && !!person && (!person.email || !name);

  async function run() {
    if (action.type === "ticket") {
      await supportService.submitTicket({
        name,
        email: person!.email!,
        ...(person?.phone ? { phone: person.phone } : {}),
        subject: action.subject,
        message: message.trim(),
        categoryId: action.categoryId,
        priority: action.priority,
      });
      void qc.invalidateQueries({ queryKey: supportKeys.tickets });
    } else if (action.type === "book_call") {
      await bookCall.mutateAsync({ sessionId: action.sessionId, expectedStartsAt: action.startsAt });
    } else if (action.type === "cancel_call") {
      await cancelCall.mutateAsync(action.bookingId);
    } else if (action.type === "habit") {
      await helpBotService.saveHabit(action.habitId, action.done);
      void qc.invalidateQueries({ queryKey: ["help-bot", "habits"] });
    } else if (action.type === "revenue") {
      // Only revenue and orders change; everything else saved for this week is sent back as it is.
      const current = (await mentorshipService.getRevenue()).data;
      if (current?.dailyRevenue?.some((v) => v != null)) {
        throw new Error(t("helpBotRevenueDaily", "You entered day-by-day figures this week. Please update them on the Mentorship page."));
      }
      const { weekNumber: _w, year: _y, updatedAt: _u, totalAllTime: _t, ...keep } = current ?? ({} as Partial<NonNullable<typeof current>>);
      await mentorshipService.upsertRevenue({ ...keep, revenueGenerated: action.revenue, ...(action.orders != null ? { numberOfOrders: action.orders } : {}) });
      void qc.invalidateQueries({ queryKey: ["user", "mentorship-revenue"] });
      void qc.invalidateQueries({ queryKey: ["user", "mentorship-stats"] });
      void qc.invalidateQueries({ queryKey: weeklyGraphQueryKey });
    } else if (action.type === "task_draft") {
      await navigator.clipboard.writeText(draft);
    } else if (action.type === "lesson_rating") {
      await coursesService.saveLessonFeedback(action.courseId, action.lessonId, { rating: action.rating, ...(action.feedback ? { feedbackText: action.feedback } : {}) });
      void qc.invalidateQueries({ queryKey: ["lesson-feedback", action.courseId] });
    } else {
      await helpBotService.addMemory(action.note);
      void qc.invalidateQueries({ queryKey: ["help-bot", "prefs"] });
    }
  }

  async function confirm() {
    if (busy) return;
    setBusy(true);
    setError(null);
    let claimed = false;
    try {
      // Claimed first, so a double tap or another tab cannot do it twice.
      await helpBotService.moveAction(messageId, index, "working");
      claimed = true;
      await run();
    } catch (e) {
      setError((e as Error)?.message || t("helpBotActionFailed", "That didn't work. Please try again."));
      if (claimed) await helpBotService.moveAction(messageId, index, "pending").catch(() => undefined);
      setBusy(false);
      return;
    }
    // It happened; failing to note that must not look like a failure.
    await helpBotService.moveAction(messageId, index, "done").catch(() => undefined);
    setBusy(false);
    onStatus("done");
  }

  async function dismiss() {
    setBusy(true);
    try {
      await helpBotService.moveAction(messageId, index, "dismissed");
      onStatus("dismissed");
    } catch {
      setError(t("helpBotActionFailed", "That didn't work. Please try again."));
    }
    setBusy(false);
  }

  const open = action.status === "pending";
  return (
    <div className="mt-2 rounded-xl p-3 text-sm" style={{ border: "1px solid var(--color-border-medium)", background: "var(--color-bg-surface)" }}>
      <div className="flex items-center gap-2 font-semibold">
        <view.Icon size={16} style={{ color: "var(--color-accent)" }} /> {view.title}
      </div>
      <div className="mt-1.5 space-y-1 break-words" style={{ color: "var(--color-text-secondary)" }}>
        {action.type === "ticket" && (
          <>
            <p className="font-medium" style={{ color: "var(--color-text-normal)" }}>{action.subject}</p>
            {open ? (
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={1500}
                rows={4}
                disabled={busy}
                aria-label={t("helpBotTicketMessage", "Ticket message")}
                className="w-full resize-none rounded-lg px-2 py-1.5 text-base sm:text-sm"
                style={{ background: "transparent", border: "1px solid var(--color-border-medium)", color: "var(--color-text-normal)" }}
              />
            ) : (
              <p className="whitespace-pre-wrap">{action.message}</p>
            )}
            {action.categoryName && <p className="text-xs">{action.categoryName}</p>}
          </>
        )}
        {(action.type === "book_call" || action.type === "cancel_call") && (
          <p>
            {action.title}
            <br />
            {when(action.startsAt)} IST
            {action.type === "book_call" && ` · ${action.minutes} min${action.host ? ` · ${action.host}` : ""}`}
          </p>
        )}
        {action.type === "habit" && (
          <p>{action.question} → <b>{action.done ? t("helpBotHabitYes", "Yes") : t("helpBotHabitNo", "Not yet")}</b></p>
        )}
        {action.type === "revenue" && (
          <p>
            {action.week}: <b style={{ color: "var(--color-text-normal)" }}>₹{action.revenue.toLocaleString("en-IN")}</b>
            {action.orders != null && <> · {action.orders.toLocaleString("en-IN")} {t("helpBotRevenueOrders", "orders")}</>}
            <br />
            <span className="text-xs">{t("helpBotRevenueNote", "Saved in Mentorship → Your Revenue Stats. Your other figures stay as they are.")}</span>
          </p>
        )}
        {action.type === "task_draft" && (
          <>
            <p className="font-medium" style={{ color: "var(--color-text-normal)" }}>{action.taskTitle}</p>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={3000}
              rows={6}
              aria-label={t("helpBotDraftLabel", "Draft answer")}
              className="w-full resize-y rounded-lg px-2 py-1.5 text-base sm:text-sm"
              style={{ background: "transparent", border: "1px solid var(--color-border-medium)", color: "var(--color-text-normal)" }}
            />
            <p className="text-xs">{t("helpBotDraftNote", "Only a draft: copy it, check it, and submit it yourself on the task.")}</p>
          </>
        )}
        {action.type === "lesson_rating" && (
          <p>
            {action.lessonTitle} → <b style={{ color: "var(--color-text-normal)" }}>{action.rating}/10</b>
            {action.feedback && <><br /><span className="whitespace-pre-wrap">{action.feedback}</span></>}
          </p>
        )}
        {action.type === "memory" && (
          <p>
            “{action.note}”
            <br />
            <span className="text-xs">{t("helpBotMemoryNote", "You can edit or delete it any time in Assistant settings.")}</span>
          </p>
        )}
      </div>
      {error && <p role="alert" className="mt-2 text-xs" style={{ color: "var(--color-alert)" }}>{error}</p>}
      {open ? (
        <div className="mt-3 flex gap-2">
          {needsForm ? (
            // A ticket needs an email the profile doesn't have; the form asks for it.
            <Link href="/support/new" className="h-10 flex-1 rounded-lg text-sm font-semibold inline-flex items-center justify-center" style={{ background: "var(--color-accent)", color: "#fff" }}>
              {t("helpBotTicketForm", "Open the support form")}
            </Link>
          ) : (
            <button
              type="button"
              onClick={confirm}
              disabled={busy || (action.type === "ticket" && (!person || !message.trim()))}
              className="h-10 flex-1 rounded-lg text-sm font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
              style={{ background: "var(--color-accent)", color: "#fff" }}
            >
              {busy && <Loader2 size={14} className="animate-spin" />} {action.type === "task_draft" ? t("helpBotDraftCopy", "Copy draft") : t("helpBotConfirm", "Confirm")}
            </button>
          )}
          {action.type === "task_draft" && (
            <Link href={action.link} className="h-10 px-3 rounded-lg text-sm inline-flex items-center" style={{ border: "1px solid var(--color-border-medium)" }}>
              {t("helpBotDraftOpen", "Open task")}
            </Link>
          )}
          <button type="button" onClick={dismiss} disabled={busy} className="h-10 px-3 rounded-lg text-sm disabled:opacity-50" style={{ border: "1px solid var(--color-border-medium)" }}>
            {t("helpBotNotNow", "Not now")}
          </button>
        </div>
      ) : (
        <p className="mt-2 text-xs inline-flex items-center gap-1.5" style={{ color: action.status === "done" ? "var(--color-success)" : "var(--color-text-secondary)" }}>
          {action.status === "done" && <CheckCircle2 size={14} />}
          {action.status === "done"
            ? action.type === "task_draft" ? t("helpBotDraftCopied", "Copied. Paste it in the task and submit.") : t("helpBotDone", "Done")
            : action.status === "dismissed"
              ? t("helpBotDismissed", "Not done")
              : t("helpBotCheck", "Started. Check whether it went through:")}
          {action.status !== "dismissed" && <Link href={view.link} className="underline">{t("helpBotView", "View")}</Link>}
        </p>
      )}
    </div>
  );
}
