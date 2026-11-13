import { renderHook, waitFor, act, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ReactNode } from "react";

// A tiny socket stand-in: records handlers so the test can fire server events.
const socket = vi.hoisted(() => {
  const handlers = new Map<string, Set<(p: any) => void>>();
  return {
    handlers,
    on: (e: string, h: (p: any) => void) => { (handlers.get(e) ?? handlers.set(e, new Set()).get(e)!).add(h); },
    off: (e: string, h: (p: any) => void) => { handlers.get(e)?.delete(h); },
    fire: (e: string, p: any) => handlers.get(e)?.forEach((h) => h(p)),
  };
});
vi.mock("@/lib/socket/client", () => ({ getSocket: async () => socket }));

const list = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api/services/supportCalls.service", () => ({ supportCallsService: { list } }));

const { useSupportCalls } = await import("./useSupportCalls");

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  list.mockReset().mockResolvedValue({ data: { category: "one_to_one", sessions: [], history: [], quota: {} } });
  socket.handlers.clear();
});
afterEach(cleanup);

describe("useSupportCalls live availability", () => {
  it("refetches when the server reports a change in this category, and ignores other categories", async () => {
    renderHook(() => useSupportCalls("one_to_one"), { wrapper });
    await waitFor(() => expect(list).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(socket.handlers.get("support_calls:changed")?.size).toBe(1));

    act(() => socket.fire("support_calls:changed", { category: "tech_support" }));
    await new Promise((r) => setTimeout(r, 20));
    expect(list).toHaveBeenCalledTimes(1);

    act(() => socket.fire("support_calls:changed", { category: "one_to_one" }));
    await waitFor(() => expect(list).toHaveBeenCalledTimes(2));
  });

  it("stops listening when the panel closes", async () => {
    const { unmount } = renderHook(() => useSupportCalls("one_to_one"), { wrapper });
    await waitFor(() => expect(socket.handlers.get("support_calls:changed")?.size).toBe(1));
    unmount();
    expect(socket.handlers.get("support_calls:changed")?.size).toBe(0);
  });
});
