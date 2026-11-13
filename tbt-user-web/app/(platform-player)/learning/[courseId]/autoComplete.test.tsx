import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, act, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense } from "react";

// The real course player page, real hooks and React Query. Only the HTTP client,
// the video element, the socket and the ad hooks are replaced. Watch time comes
// from the page's own 1-second tick while the (fake) player reports "playing".

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn(), patch: vi.fn() }));
vi.mock("@/lib/api/client", () => ({ default: api, apiClient: api, getServerNow: () => Date.now(), initApiClient: () => {} }));
const player = vi.hoisted(() => ({ props: null as any }));
vi.mock("@/components/features/video/VideoPlayer", () => ({
  VideoPlayer: (props: any) => { player.props = props; return <div data-testid="video" />; },
}));
vi.mock("@/components/features/video/PlyrPlayer", () => ({ PlyrPlayer: () => null }));
vi.mock("@/lib/socket/client", () => ({ getSocket: () => new Promise(() => {}) }));
vi.mock("@/lib/ads/useRegisterMedia", () => ({ useRegisterMedia: () => {}, useSuppressAds: () => {} }));
vi.mock("@/lib/context/SiteConfigContext", () => ({ useSiteConfig: () => ({ uiStrings: null, config: { taskTimerSeconds: 0 }, hiddenMenuKeys: [] }) }));
const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams("lesson=l1"),
  usePathname: () => "/learning/c1",
}));
const toast = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn(), dismiss: vi.fn(), loading: vi.fn() }));
vi.mock("react-hot-toast", () => ({ toast, default: toast, Toaster: () => null }));

import CourseDetailPage from "./page";

const DURATION = 10; // seconds; 90% = 9 s genuine
type Lesson = { id: string; title: string; order: number; isCompleted?: boolean; actualWatchedSecs?: number; locked?: boolean };
let lessons: Lesson[];
let progress: Array<{ lessonId: string; completed: boolean }>;
let completionPosts: any[];
let progressHandler: (body: any) => Promise<any>;

const courseData = () => ({
  id: "c1", title: "Growth Course", xpPerEpisode: 0, accessType: "lifetime", hasAccess: true, isEnrolled: true,
  lessons: lessons.map((l) => ({
    id: l.id, title: l.title, order: l.order, videoUrl: `https://cdn.example.com/${l.id}.mp4`, hlsUrl: null,
    durationSeconds: DURATION, resumeAtSeconds: 0, actualWatchedSecs: l.actualWatchedSecs ?? 0,
    isCompleted: !!l.isCompleted, locked: !!l.locked, hasQuiz: false, timerSeconds: 0, type: "video",
  })),
});

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn(); // not implemented in jsdom
  lessons = [
    { id: "l1", title: "Lesson One", order: 1, actualWatchedSecs: 4 },
    { id: "l2", title: "Lesson Two", order: 2, locked: true },
  ];
  progress = [];
  completionPosts = [];
  player.props = null;
  toast.error.mockClear();
  progressHandler = async (body) => {
    const done = body.isCompleted === true;
    if (done) {
      progress = [{ lessonId: "l1", completed: true }];
      lessons[0].isCompleted = true;
      lessons[1].locked = false;
    }
    return { success: true, data: { lessonId: "l1", completed: done || progress.some((p) => p.completed) } };
  };
  api.get.mockImplementation(async (url: string) => {
    if (url === "/api/user/courses/c1") return { success: true, data: courseData() };
    if (url === "/api/user/enrollments/c1/progress") return { success: true, data: progress };
    if (url.includes("lifelines")) return { success: true, data: { lifelineEnabled: false } };
    if (url.includes("timer/session")) return { success: true, data: null };
    return { success: true, data: null };
  });
  api.post.mockImplementation(async (url: string, body: any) => {
    if (url === "/api/user/enrollments/c1/progress/l1") {
      if (body?.isCompleted === true) completionPosts.push(body);
      return progressHandler(body ?? {});
    }
    return { success: true, data: null };
  });
});
afterEach(() => cleanup());

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const params: any = Promise.resolve({ courseId: "c1" });
  params.status = "fulfilled";
  params.value = { courseId: "c1" };
  return render(
    <QueryClientProvider client={qc}>
      <Suspense fallback={null}><CourseDetailPage params={params} /></Suspense>
    </QueryClientProvider>,
  );
}

/** Open Lesson One through the focus dialog and start playback in the fake player. */
async function startWatching() {
  fireEvent.click(await screen.findByRole("button", { name: /Start Video/ }));
  await waitFor(() => expect(player.props).not.toBeNull());
  act(() => { player.props.onReady?.(DURATION); player.props.onPlay?.(); });
}
const wait = (ms: number) => act(() => new Promise((r) => setTimeout(r, ms)));
const completedBadge = () => screen.queryAllByText("Completed").length > 0;

describe("course lesson completes automatically at 90% genuine watch progress", () => {
  it("no Mark Complete button; incomplete before 90%; completes at 90% with the green tick, saved once", async () => {
    renderPage();
    await startWatching();
    expect(screen.queryByRole("button", { name: /Mark Complete/ })).toBeNull();

    // 4 s already watched + ~3 s now = 70%: still incomplete, nothing submitted.
    await wait(3200);
    expect(completionPosts).toHaveLength(0);
    expect(completedBadge()).toBe(false);
    expect(screen.queryByRole("button", { name: /Mark Complete/ })).toBeNull();

    const courseGets = () => api.get.mock.calls.filter(([u]) => u === "/api/user/courses/c1").length;
    const courseGetsBefore = courseGets();
    // Reaching 9 s genuine (90%) submits completion automatically — no click.
    await waitFor(() => expect(completionPosts).toHaveLength(1), { timeout: 6000 });
    expect(completionPosts[0]).toMatchObject({ isCompleted: true, videoDuration: DURATION });
    await waitFor(() => expect(completedBadge()).toBe(true));
    // Next lesson: the course is re-fetched, so the server unlock rule opens Lesson Two
    // (the existing end-of-video flow then advances — unchanged).
    await waitFor(() => expect(courseGets()).toBeGreaterThan(courseGetsBefore));
    expect(lessons[1].locked).toBe(false);

    // More player events after completion (more ticks, the video ending) never submit again.
    await wait(2200);
    act(() => { player.props.onProgress?.(DURATION); player.props.onEnded?.(); });
    await wait(300);
    expect(completionPosts).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /Mark Complete/ })).toBeNull();
  }, 20000);

  it("seeking adds no genuine watch time: jumping to the end does not complete the lesson", async () => {
    renderPage();
    await startWatching();
    act(() => { player.props.onPause?.(); player.props.onSeeked?.(); player.props.onProgress?.(9.5); });
    await wait(2200);
    expect(completionPosts).toHaveLength(0);
    expect(completedBadge()).toBe(false);
  }, 15000);

  it("a failed save never shows the lesson as completed", async () => {
    progressHandler = async (body) => {
      if (body.isCompleted) throw new Error("Network Error");
      return { success: true, data: { lessonId: "l1", completed: false } };
    };
    renderPage();
    await startWatching();
    await waitFor(() => expect(completionPosts).toHaveLength(1), { timeout: 9000 });
    await wait(500);
    expect(completedBadge()).toBe(false);
    expect(toast.error).toHaveBeenCalled();
    // No immediate retry storm while still playing (back-off).
    await wait(2200);
    expect(completionPosts).toHaveLength(1);
  }, 20000);

  it("a save the server refuses (completed: false) does not show the green tick", async () => {
    progressHandler = async () => ({ success: true, data: { lessonId: "l1", completed: false } });
    renderPage();
    await startWatching();
    await waitFor(() => expect(completionPosts).toHaveLength(1), { timeout: 9000 });
    await wait(500);
    expect(completedBadge()).toBe(false);
  }, 20000);

  it("after a refresh a completed lesson stays completed and is not submitted again", async () => {
    progress = [{ lessonId: "l1", completed: true }];
    lessons[0].isCompleted = true;
    lessons[0].actualWatchedSecs = DURATION;
    lessons[1].locked = false;
    renderPage();
    await waitFor(() => expect(player.props).not.toBeNull()); // completed lessons open without the focus dialog
    act(() => { player.props.onReady?.(DURATION); player.props.onPlay?.(); });
    await waitFor(() => expect(completedBadge()).toBe(true));
    await wait(1500);
    expect(completionPosts).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /Mark Complete/ })).toBeNull();
  }, 15000);
});
