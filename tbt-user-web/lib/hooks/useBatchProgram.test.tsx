import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useUseProgramLifeline } from "./useBatchProgram";

// The response interceptor unwraps response.data, so a mocked post resolves with the
// backend's { success, data, error } envelope directly.
const postMock = vi.fn();
vi.mock("@/lib/api/client", () => ({ default: { post: (...args: unknown[]) => postMock(...args) } }));

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const body = { batchId: "b1", episodeId: "e1", context: "episode" as const };

describe("useUseProgramLifeline — backend contract", () => {
  beforeEach(() => postMock.mockReset());

  it("resolves with the lifeline counts on success", async () => {
    postMock.mockResolvedValue({ success: true, data: { lifelinesRemaining: 2, lifelinesTotal: 3, lifelinesUsed: 1 }, error: null });
    const { result } = renderHook(() => useUseProgramLifeline(), { wrapper });
    await expect(result.current.mutateAsync(body)).resolves.toEqual({ lifelinesRemaining: 2, lifelinesTotal: 3, lifelinesUsed: 1 });
  });

  it("rejects with code 'exhausted' when the backend answers HTTP 200 + success:false", async () => {
    // Before the fix this resolved with null, and the caller crashed reading
    // null.lifelinesRemaining — the coin dialog never opened.
    postMock.mockResolvedValue({ success: false, data: null, error: "exhausted", coinsRequired: 50 });
    const { result } = renderHook(() => useUseProgramLifeline(), { wrapper });
    await expect(result.current.mutateAsync(body)).rejects.toMatchObject({ code: "exhausted" });
  });
});
