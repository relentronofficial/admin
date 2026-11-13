import { render, screen, fireEvent, cleanup, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import OnboardingPage from "./page";

// Onboarding education steps with a required video: Continue unlocks only once
// the video is watched (≥ 80 % or ended), the watched state is saved through
// the real API hook contract, and every video step can be completed — the
// first one and the ones after it.
//
// Videos are Bunny Stream iframes. Bunny's player follows the player.js
// protocol: it sends nothing until the page subscribes (postMessage
// "addEventListener"), and its events arrive as JSON *strings* from
// https://iframe.mediadelivery.net. The fake player below behaves exactly so.

vi.mock("react-hot-toast", () => ({ default: { error: vi.fn(), success: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

const BUNNY = "https://iframe.mediadelivery.net";
const STEPS = [
  { id: "c1", stepKey: "intro", title: "Welcome video", textBody: null, videoUrl: `${BUNNY}/embed/111/aaa`, audioUrl: null, ctaLabel: null, sortOrder: 0 },
  { id: "c2", stepKey: "rules", title: "Community rules", textBody: null, videoUrl: `${BUNNY}/embed/111/bbb`, audioUrl: null, ctaLabel: null, sortOrder: 1 },
];

const state: { profile: Record<string, unknown>; save: ReturnType<typeof vi.fn>; saveHook: any; onboarding: any; content: any } =
  { profile: {}, save: vi.fn(), saveHook: null, onboarding: null, content: null };
vi.mock("@/lib/hooks/useOnboarding", () => ({
  useOnboardingState: () => state.onboarding,
  useOnboardingContent: () => state.content,
  useOnboardingButtons: () => stable.buttons,
  useSaveOnboardingProgress: () => state.saveHook,
  useUploadOnboardingDocument: () => stable.idle,
  useDeleteOnboardingDocument: () => stable.idle,
  useSubmitOnboarding: () => stable.idle,
  usePresignProfilePhoto: () => stable.idle,
}));
// No mentorship modules → no mentorship step: Welcome → the video steps.
// Hook results are stable objects, as React Query returns them.
const stable = vi.hoisted(() => ({
  mentorship: { data: { selection: [], effective: [], selectionRequired: false, options: [] }, isLoading: false, isError: false, refetch: () => {} },
  idle: { mutateAsync: () => Promise.resolve({}), isPending: false },
  meetings: { data: [] },
  buttons: { data: [] },
  questions: { data: [], isLoading: false },
  result: { data: null, isLoading: false },
}));
vi.mock("@/lib/hooks/useMentorship", () => ({
  useMentorshipModules: () => stable.mentorship,
  useUpdateMentorshipModules: () => stable.idle,
}));
vi.mock("@/lib/hooks/useOnboardingMeetings", () => ({ useMyOnboardingMeetings: () => stable.meetings }));
vi.mock("@/lib/hooks/useUser", () => ({
  usePsychometricQuestions: () => stable.questions,
  useMyPsychometricResult: () => stable.result,
  useSubmitPsychometric: () => stable.idle,
}));
vi.mock("@/lib/api/client", () => {
  const empty = () => Promise.resolve({ data: [] });
  return { default: { get: vi.fn(empty), post: vi.fn(empty), put: vi.fn(empty) }, getServerNow: () => Date.now() };
});

const continueBtn = () => screen.getByRole("button", { name: /^Continue$/ }) as HTMLButtonElement;
const heading = (t: string) => screen.getByText(t);

/** A fake Bunny player in the step's iframe: sends events only after being subscribed. */
function bunnyPlayer() {
  const iframe = document.querySelector("iframe") as HTMLIFrameElement;
  const subscribed = new Set<string>();
  vi.spyOn(iframe.contentWindow!, "postMessage").mockImplementation((msg: any) => {
    const m = typeof msg === "string" ? JSON.parse(msg) : msg;
    if (m?.context === "player.js" && m.method === "addEventListener") subscribed.add(m.value);
  });
  const send = (event: string, value?: unknown) => {
    if (!subscribed.has(event)) return; // Bunny never sends an event nobody subscribed to
    act(() => {
      window.dispatchEvent(new MessageEvent("message", {
        origin: BUNNY,
        data: JSON.stringify({ context: "player.js", version: "0.0.11", event, value }),
      }));
    });
  };
  return {
    load: () => fireEvent.load(iframe),
    ready: () => act(() => { window.dispatchEvent(new MessageEvent("message", { origin: BUNNY, data: JSON.stringify({ context: "player.js", event: "ready" }) })); }),
    play: (seconds: number, duration = 100) => send("timeupdate", { seconds, duration }),
    end: () => send("ended"),
    subscribed,
  };
}

function setProfile(profile: Record<string, unknown>) {
  state.profile = profile;
  state.onboarding = { data: { verificationStatus: "awaiting_kyc", profile, documents: [], onboardingReviewNote: null }, isLoading: false };
}
beforeEach(() => {
  setProfile({});
  state.save = vi.fn().mockResolvedValue({});
  state.saveHook = { mutateAsync: state.save, isPending: false };
  state.content = { data: STEPS, isLoading: false };
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("onboarding video steps", () => {
  it("Continue stays locked until the video is watched, then unlocks and saves the watched step", async () => {
    render(<OnboardingPage />);
    fireEvent.click(continueBtn()); // Welcome → first video step
    expect(heading("Welcome video")).toBeTruthy();
    expect(continueBtn().disabled).toBe(true);

    const player = bunnyPlayer();
    player.load();
    expect([...player.subscribed].sort()).toEqual(["ended", "timeupdate"]);

    player.play(30); // 30 % watched: still locked
    expect(continueBtn().disabled).toBe(true);
    expect(state.save).not.toHaveBeenCalled();

    player.play(80); // 80 % watched: unlocked
    await waitFor(() => expect(continueBtn().disabled).toBe(false));
    expect(state.save).toHaveBeenCalledWith({ watchedVideoSteps: ["intro"] });

    fireEvent.click(continueBtn());
    expect(heading("Community rules")).toBeTruthy();
  });

  it("the second video step can also be completed after the first one was watched", async () => {
    render(<OnboardingPage />);
    fireEvent.click(continueBtn());
    const first = bunnyPlayer();
    first.load();
    first.end();
    await waitFor(() => expect(continueBtn().disabled).toBe(false));
    fireEvent.click(continueBtn()); // → second video step

    expect(heading("Community rules")).toBeTruthy();
    expect(continueBtn().disabled).toBe(true); // its own video is not watched yet
    const second = bunnyPlayer();
    second.load();
    second.play(90);
    await waitFor(() => expect(continueBtn().disabled).toBe(false));
    expect(state.save).toHaveBeenLastCalledWith({ watchedVideoSteps: ["intro", "rules"] });
  });

  it("subscribes again when the player reports ready (player reloaded)", async () => {
    render(<OnboardingPage />);
    fireEvent.click(continueBtn());
    const player = bunnyPlayer();
    player.ready();
    expect([...player.subscribed].sort()).toEqual(["ended", "timeupdate"]);
    player.end();
    await waitFor(() => expect(continueBtn().disabled).toBe(false));
  });

  it("a video watched in an earlier session stays watched (progress persists)", () => {
    setProfile({ watchedVideoSteps: ["intro"] });
    render(<OnboardingPage />);
    fireEvent.click(continueBtn());
    expect(heading("Welcome video")).toBeTruthy();
    expect(continueBtn().disabled).toBe(false);
    fireEvent.click(continueBtn());
    expect(continueBtn().disabled).toBe(true); // the unwatched second video is still required
  });

  it("ignores messages from other origins", () => {
    render(<OnboardingPage />);
    fireEvent.click(continueBtn());
    bunnyPlayer().load();
    act(() => {
      window.dispatchEvent(new MessageEvent("message", {
        origin: "https://evil.example",
        data: JSON.stringify({ context: "player.js", event: "ended" }),
      }));
    });
    expect(continueBtn().disabled).toBe(true);
    expect(state.save).not.toHaveBeenCalled();
  });
});
