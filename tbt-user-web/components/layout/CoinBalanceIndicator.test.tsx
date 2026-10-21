import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { CoinBalanceIndicator } from "./CoinBalanceIndicator";
import { useSpendCoins } from "@/lib/hooks/useBatchProgram";

// Navbar TBT Coins counter with a REAL QueryClient and the real hooks: the
// number shown is whatever GET /api/user/coins/balance returns (the server
// ledger). The client never subtracts or adds, so after a spend the counter
// shows the server's new figure. Failures show "–", never a made-up 0.

const api = vi.hoisted(() => ({
  balance: vi.fn(),
  post: vi.fn(),
  socketHandlers: new Map<string, Set<(...a: any[]) => void>>(),
}));

vi.mock("@/lib/api/services/coins.service", () => ({
  coinsService: { balance: api.balance, packages: vi.fn(), createOrder: vi.fn(), verify: vi.fn() },
}));
vi.mock("@/lib/api/client", () => ({ default: { post: api.post, get: vi.fn() } }));
vi.mock("@/lib/context/SiteConfigContext", () => ({ useSiteConfig: () => ({ uiStrings: {} }) }));
vi.mock("@/lib/hooks/useMentorship", () => ({ useMentorshipStats: () => ({ data: undefined }) }));
vi.mock("@/lib/socket/client", () => ({
  getSocket: async () => ({
    on: (e: string, h: any) => { if (!api.socketHandlers.has(e)) api.socketHandlers.set(e, new Set()); api.socketHandlers.get(e)!.add(h); },
    off: (e: string, h: any) => { api.socketHandlers.get(e)?.delete(h); },
  }),
}));

const ok = (balance: number) => Promise.resolve({ success: true, data: { balance }, error: null });

let qc: QueryClient;
const wrap = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
const counter = () => screen.getByRole("status", { name: /^TBT Coins/ });

function SpendButton() {
  const spend = useSpendCoins();
  return <button onClick={() => spend.mutate({ amount: 50 })}>spend</button>;
}

beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  api.balance.mockReset();
  api.post.mockReset();
  api.socketHandlers.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("CoinBalanceIndicator", () => {
  it("shows the server's remaining balance with the coin icon", async () => {
    api.balance.mockReturnValue(ok(1234));
    render(<CoinBalanceIndicator />, { wrapper: wrap });
    await waitFor(() => expect(counter().textContent).toContain("1,234"));
    expect(counter().getAttribute("aria-label")).toBe("TBT Coins: 1,234");
    expect(counter().querySelector("svg")).not.toBeNull();
  });

  it('shows "–" while loading, not a number', () => {
    api.balance.mockReturnValue(new Promise(() => {}));
    render(<CoinBalanceIndicator />, { wrapper: wrap });
    expect(counter().textContent).toContain("–");
    expect(counter().textContent).not.toMatch(/\d/);
  });

  it('shows "–" and "unavailable" when the API fails — never a fabricated 0', async () => {
    api.balance.mockRejectedValue(new Error("503"));
    render(<CoinBalanceIndicator />, { wrapper: wrap });
    // useCoinBalance retries once (~1 s) before reporting the error.
    await waitFor(() => expect(counter().getAttribute("aria-label")).toBe("TBT Coins: unavailable"), { timeout: 4000 });
    expect(counter().textContent).toContain("–");
    expect(counter().textContent).not.toMatch(/\d/);
  });

  it("after spending coins, shows the server's new balance (refetched, not computed client-side)", async () => {
    api.balance.mockReturnValueOnce(ok(200));
    api.post.mockResolvedValue({ data: { remainingCoins: 150 } });
    render(<><CoinBalanceIndicator /><SpendButton /></>, { wrapper: wrap });
    await waitFor(() => expect(counter().textContent).toContain("200"));

    // The server — not the client — decides the new balance; return a value a
    // client-side "200 - 50" could never produce, to prove it is refetched.
    api.balance.mockReturnValueOnce(ok(137));
    await act(async () => { screen.getByText("spend").click(); });
    await waitFor(() => expect(counter().textContent).toContain("137"));
    expect(api.post).toHaveBeenCalledWith("/api/user-batch/spend-coins", { amount: 50, taskId: undefined, dayNumber: undefined });
    expect(api.balance).toHaveBeenCalledTimes(2);
  });

  it("a failed refresh after a spend shows \"–\" rather than the old (now wrong) balance", async () => {
    api.balance.mockReturnValueOnce(ok(200));
    api.post.mockResolvedValue({ data: { remainingCoins: 150 } });
    render(<><CoinBalanceIndicator /><SpendButton /></>, { wrapper: wrap });
    await waitFor(() => expect(counter().textContent).toContain("200"));
    api.balance.mockRejectedValue(new Error("network"));
    await act(async () => { screen.getByText("spend").click(); });
    await waitFor(() => expect(counter().textContent).toContain("–"), { timeout: 4000 });
    expect(counter().textContent).not.toContain("200");
  });

  it("refreshes when the server pushes an earning (batch day approved)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    api.balance.mockReturnValueOnce(ok(100));
    render(<CoinBalanceIndicator />, { wrapper: wrap });
    await waitFor(() => expect(counter().textContent).toContain("100"));
    await act(async () => { await vi.advanceTimersByTimeAsync(4000); }); // deferred socket hookup
    await waitFor(() => expect(api.socketHandlers.get("batch:day_approved")?.size).toBe(1));

    api.balance.mockReturnValueOnce(ok(150));
    await act(async () => { api.socketHandlers.get("batch:day_approved")!.forEach((h) => h({ xpAwarded: 50 })); });
    await waitFor(() => expect(counter().textContent).toContain("150"));
  });

  it("removes its socket listeners on unmount", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    api.balance.mockReturnValue(ok(1));
    const { unmount } = render(<CoinBalanceIndicator />, { wrapper: wrap });
    await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    await waitFor(() => expect(api.socketHandlers.get("notification")?.size).toBe(1));
    unmount();
    expect(api.socketHandlers.get("notification")?.size).toBe(0);
    expect(api.socketHandlers.get("batch:day_approved")?.size).toBe(0);
  });

  it("two mounted counters share one request", async () => {
    api.balance.mockReturnValue(ok(42));
    render(<><CoinBalanceIndicator /><CoinBalanceIndicator /></>, { wrapper: wrap });
    await waitFor(() => expect(screen.getAllByRole("status", { name: "TBT Coins: 42" })).toHaveLength(2));
    expect(api.balance).toHaveBeenCalledTimes(1);
  });

  it("keeps large balances compact so the navbar fits on mobile", async () => {
    api.balance.mockReturnValue(ok(25_400));
    render(<CoinBalanceIndicator />, { wrapper: wrap });
    await waitFor(() => expect(counter().getAttribute("aria-label")).toBe("TBT Coins: 25,400"));
    expect(counter().textContent).toMatch(/25(\.4)?K/i);
  });
});
