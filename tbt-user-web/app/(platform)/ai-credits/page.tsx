"use client";

import { useCallback } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";
import { useAiCreditHistory, useAiCreditPacks, useAiCreditPurchase, useAiCreditWallet } from "@/lib/hooks/useAiCredits";
import type { AiCreditEntry } from "@/lib/api/services/aiCredits.service";

const fmt = (n: number) => n.toLocaleString("en-IN");
const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

export default function AiCreditsPage() {
  const { uiStrings } = useSiteConfig();
  const t = useCallback(
    (key: string, fallback: string) => ((uiStrings as unknown as Record<string, unknown> | null)?.[key] as string | undefined) || fallback,
    [uiStrings],
  );
  const wallet = useAiCreditWallet();
  const packs = useAiCreditPacks();
  const history = useAiCreditHistory();
  const { state, busy, buy, reset } = useAiCreditPurchase();

  const sourceLabel: Record<AiCreditEntry["source"], string> = {
    purchase: t("aiCreditsBought", "Bought credits"),
    usage: t("aiCreditsUsed", "TBT Assistant answer"),
    refund: t("aiCreditsRefund", "Refund"),
    grant: t("aiCreditsGift", "Free credits"),
    adjust: t("aiCreditsAdjust", "Adjustment by TBT"),
  };
  const entries = history.data?.pages.flatMap((p) => p.items) ?? [];
  const list = packs.data?.packs ?? [];
  const canBuy = packs.data?.purchaseAvailable !== false;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("aiCreditsTitle", "AI Credits")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("aiCreditsSubtitle", "Credits pay for TBT Assistant answers. Each answer uses credits for the work it needed; simple answers use fewer.")}
        </p>
      </div>

      {/* Balance */}
      <section className="p-5 rounded-2xl border border-border bg-card flex items-center gap-4">
        <span className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ background: "color-mix(in srgb, var(--color-accent) 15%, transparent)", color: "var(--color-accent)" }}>
          <Sparkles size={22} />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{t("aiCreditsBalance", "Your balance")}</p>
          {wallet.isLoading ? (
            <Loader2 size={18} className="animate-spin text-muted-foreground mt-1" />
          ) : wallet.isError || !wallet.data ? (
            <p className="text-sm text-muted-foreground">{t("aiCreditsLoadError", "Couldn't load your credits. Please refresh.")}</p>
          ) : (
            <p className="text-2xl font-bold text-foreground tabular-nums">
              {fmt(wallet.data.balance)} <span className="text-sm font-medium text-muted-foreground">{t("aiCreditsUnit", "credits")}</span>
            </p>
          )}
        </div>
      </section>

      {/* Purchase result */}
      {state.status !== "idle" && state.status !== "working" && (
        <div
          role="status"
          className="p-4 rounded-xl border text-sm flex items-start justify-between gap-3"
          style={{
            borderColor: state.status === "success" ? "var(--color-success)" : state.status === "failed" ? "var(--color-alert)" : "var(--color-border-subtle)",
          }}
        >
          <p className="text-foreground">
            {state.status === "success"
              ? `${fmt(state.creditsAdded)} ${t("aiCreditsAdded", "credits added. New balance:")} ${fmt(state.balance)}`
              : state.status === "cancelled"
                ? t("aiCreditsCancelled", "Payment cancelled. Nothing was charged.")
                : state.message}
          </p>
          <button type="button" onClick={reset} className="text-xs text-muted-foreground hover:text-foreground shrink-0">
            {t("aiCreditsDismiss", "Close")}
          </button>
        </div>
      )}

      {/* Packs */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-foreground">{t("aiCreditsBuyTitle", "Buy credits")}</h2>
        {packs.isLoading ? (
          <Loader2 size={18} className="animate-spin text-muted-foreground" />
        ) : !canBuy || list.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("aiCreditsNoPacks", "Credits aren't on sale right now. Please check back soon.")}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            {list.map((p) => (
              <div key={p.id} className="p-4 rounded-2xl border border-border bg-card flex flex-col gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{p.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                    {fmt(p.credits)} {t("aiCreditsUnit", "credits")}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void buy(p)}
                  className="mt-auto h-10 rounded-lg text-sm font-semibold text-white disabled:opacity-50 inline-flex items-center justify-center gap-2"
                  style={{ background: "var(--color-accent)" }}
                >
                  {busy && state.status === "working" && <Loader2 size={14} className="animate-spin" />}
                  {t("aiCreditsPay", "Pay")} {inr(p.priceInr)}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* History */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold text-foreground">{t("aiCreditsHistory", "History")}</h2>
        <div className="rounded-2xl border border-border bg-card divide-y divide-border">
          {history.isLoading ? (
            <div className="p-4"><Loader2 size={16} className="animate-spin text-muted-foreground" /></div>
          ) : entries.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">{t("aiCreditsNoHistory", "Nothing yet.")}</p>
          ) : (
            entries.map((e) => (
              <div key={e.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-foreground">{sourceLabel[e.source] ?? e.source}</p>
                  <p className="text-xs text-muted-foreground">{when(e.createdAt)}</p>
                </div>
                <span
                  className="text-sm font-semibold tabular-nums shrink-0"
                  style={{ color: e.delta > 0 ? "var(--color-success)" : "var(--color-text-secondary)" }}
                >
                  {e.delta > 0 ? "+" : "−"}{fmt(Math.abs(e.delta))}
                </span>
              </div>
            ))
          )}
        </div>
        {history.hasNextPage && (
          <button
            type="button"
            onClick={() => void history.fetchNextPage()}
            disabled={history.isFetchingNextPage}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            {history.isFetchingNextPage ? <Loader2 size={14} className="animate-spin inline" /> : t("aiCreditsMore", "Show older")}
          </button>
        )}
      </section>
    </div>
  );
}
