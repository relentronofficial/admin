"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Socket } from "socket.io-client";
import { Coins } from "lucide-react";
import { useCoinBalance, invalidateCoinBalance } from "@/lib/hooks/useCoins";
import { useSiteConfig } from "@/lib/context/SiteConfigContext";
import { getSocket } from "@/lib/socket/client";
import { NAV_COUNTER_CLASS, NAV_COUNTER_STYLE } from "./TierAccessIndicator";

const COIN_GOLD = "#eab308"; // same gold as the TBT Coins icons in the support-call panel

/** Server pushes that can credit coins while the page is open (admin approvals, notices). */
const EARN_EVENTS = ["batch:day_approved", "notification"] as const;

function formatCoins(n: number) {
  return n >= 10_000
    ? new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(n)
    : n.toLocaleString();
}

/**
 * Navbar TBT Coins counter — the member's remaining (spendable) coins, shown
 * beside the streak in the same counter box. The number is only ever the
 * server's ledger balance (useCoinBalance); while loading or after a failed
 * request it shows "–" rather than a guessed or stale figure.
 */
export function CoinBalanceIndicator() {
  const { uiStrings } = useSiteConfig();
  const qc = useQueryClient();
  const { data: balance, isLoading, isError } = useCoinBalance();

  useEffect(() => {
    let socket: Socket | null = null;
    let active = true;
    const refresh = () => void invalidateCoinBalance(qc);
    // Same deferral as the Navbar's notification socket: keep socket.io off the first paint.
    const timer = setTimeout(() => {
      getSocket()
        .then((s) => {
          if (!active) return;
          socket = s;
          for (const e of EARN_EVENTS) s.on(e, refresh);
        })
        .catch(() => {});
    }, 4000);
    return () => {
      active = false;
      clearTimeout(timer);
      for (const e of EARN_EVENTS) socket?.off(e, refresh);
    };
  }, [qc]);

  const label = (uiStrings as any)?.tbtCoinsLabel ?? "TBT Coins";
  const known = !isLoading && !isError && typeof balance === "number";
  const value = known ? formatCoins(balance) : "–";
  const description = known
    ? `${label}: ${balance.toLocaleString()}`
    : isError
      ? (uiStrings as any)?.tbtCoinsUnavailable ?? `${label}: unavailable`
      : label;

  return (
    <div role="status" aria-label={description} title={description} className={NAV_COUNTER_CLASS} style={NAV_COUNTER_STYLE}>
      <Coins size={14} aria-hidden="true" className="flex-shrink-0" style={{ color: COIN_GOLD }} />
      <span className="text-foreground">{value}</span>
    </div>
  );
}
