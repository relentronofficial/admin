import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

// The green "Completed" tick reads the progress query; each lesson's `locked` flag
// reads the course query. Both must refresh whenever the server records a new
// completion — whichever progress post produced it — or the next lesson stays
// locked next to a completed one until a reload.

const svc = vi.hoisted(() => ({ markLessonComplete: vi.fn() }));
vi.mock("@/lib/api/services/courses.service", () => ({ coursesService: svc }));
vi.mock("./useCoins", () => ({ invalidateCoinBalance: vi.fn() }));

import { useMarkLessonComplete } from "./useCourses";

const COURSE = "course-1";
const LESSON = "lesson-02";
let qc: QueryClient;
let invalidated: string[];
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;

const post = async (vars: Record<string, unknown>) => {
  const { result } = renderHook(() => useMarkLessonComplete(COURSE), { wrapper });
  await act(async () => { await result.current.mutateAsync({ lessonId: LESSON, ...vars } as any); });
};
const courseRefreshed = () => invalidated.includes(JSON.stringify(["courses", COURSE]));

beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  invalidated = [];
  const orig = qc.invalidateQueries.bind(qc);
  qc.invalidateQueries = ((filters: any) => { invalidated.push(JSON.stringify(filters?.queryKey)); return orig(filters); }) as any;
  svc.markLessonComplete.mockReset();
});

describe("useMarkLessonComplete — lock state follows the server's completion", () => {
  it("a heartbeat that crosses the server threshold refreshes the course (lock) query", async () => {
    qc.setQueryData(["user", "progress", COURSE], [{ lessonId: LESSON, completed: false }]);
    svc.markLessonComplete.mockResolvedValue({ success: true, data: { completed: true } });
    await post({ watchedSeconds: 420, deltaSeconds: 30 }); // no isCompleted flag
    expect(courseRefreshed()).toBe(true);
  });

  it("an explicit completion refreshes the course query (unchanged behaviour)", async () => {
    svc.markLessonComplete.mockResolvedValue({ success: true, data: { completed: true } });
    await post({ watchedSeconds: 439, isCompleted: true, optimistic: false });
    expect(courseRefreshed()).toBe(true);
  });

  it("an ordinary heartbeat on an incomplete lesson does not refetch the course", async () => {
    qc.setQueryData(["user", "progress", COURSE], [{ lessonId: LESSON, completed: false }]);
    svc.markLessonComplete.mockResolvedValue({ success: true, data: { completed: false } });
    await post({ watchedSeconds: 60, deltaSeconds: 30 });
    expect(courseRefreshed()).toBe(false);
    expect(invalidated).toContain(JSON.stringify(["user", "progress", COURSE]));
  });

  it("heartbeats while rewatching an already-completed lesson do not refetch the course", async () => {
    qc.setQueryData(["user", "progress", COURSE], [{ lessonId: LESSON, completed: true }]);
    svc.markLessonComplete.mockResolvedValue({ success: true, data: { completed: true } });
    await post({ watchedSeconds: 100, deltaSeconds: 30 });
    expect(courseRefreshed()).toBe(false);
  });

  it("a failed save refreshes nothing and surfaces the error to the caller", async () => {
    svc.markLessonComplete.mockRejectedValue(new Error("Network Error"));
    const { result } = renderHook(() => useMarkLessonComplete(COURSE), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync({ lessonId: LESSON, isCompleted: true, optimistic: false } as any)).rejects.toThrow("Network Error");
    });
    expect(courseRefreshed()).toBe(false);
  });
});
