"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarCheck, CalendarX, CheckCircle2, LifeBuoy, Loader2, Sun } from "lucide-react";
import { useMe } from "@/lib/hooks/useUser";
import { useBookSupportCall, useCancelSupportCallBooking } from "@/lib/hooks/useSupportCalls";
import { supportKeys } from "@/lib/hooks/useSupport";
import { supportService } from "@/lib/api/services/support.service";
import { helpBotService, type HelpBotAction, type HelpBotActionStatus } from "@/lib/api/services/helpBot.service";

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

  const view = {
    ticket: { Icon: LifeBuoy, title: t("helpBotTicketTitle", "Raise a support ticket"), link: "/support/tickets" },
    book_call: { Icon: CalendarCheck, title: t("helpBotBookTitle", "Book this call"), link: "/mentorship" },
    cancel_call: { Icon: CalendarX, title: t("helpBotCancelCallTitle", "Cancel this call"), link: "/mentorship" },
    habit: { Icon: Sun, title: t("helpBotHabitTitle", "Update today's habit"), link: "/dashboard" },
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
    } else {
      await helpBotService.saveHabit(action.habitId, action.done);
      void qc.invalidateQueries({ queryKey: ["help-bot", "habits"] });
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
              {busy && <Loader2 size={14} className="animate-spin" />} {t("helpBotConfirm", "Confirm")}
            </button>
          )}
          <button type="button" onClick={dismiss} disabled={busy} className="h-10 px-3 rounded-lg text-sm disabled:opacity-50" style={{ border: "1px solid var(--color-border-medium)" }}>
            {t("helpBotNotNow", "Not now")}
          </button>
        </div>
      ) : (
        <p className="mt-2 text-xs inline-flex items-center gap-1.5" style={{ color: action.status === "done" ? "var(--color-success)" : "var(--color-text-secondary)" }}>
          {action.status === "done" && <CheckCircle2 size={14} />}
          {action.status === "done"
            ? t("helpBotDone", "Done")
            : action.status === "dismissed"
              ? t("helpBotDismissed", "Not done")
              : t("helpBotCheck", "Started. Check whether it went through:")}
          {action.status !== "dismissed" && <Link href={view.link} className="underline">{t("helpBotView", "View")}</Link>}
        </p>
      )}
    </div>
  );
}
