import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import OnboardingPage from "./page";

// Step 2/8 "Choose your mentorship": Continue saves the selection through the
// real API hook contract, advances only on success, stays put (selection kept)
// with a readable message on failure, and never sends two saves at once.

const toastError = vi.fn();
vi.mock("react-hot-toast", () => ({ default: { error: (...a: any[]) => toastError(...a), success: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

const OPTIONS = [
  { moduleName: "Introduction", displayName: "Introduction", tagline: null, description: null, iconUrl: null, accentColor: null },
  { moduleName: "Product", displayName: "Product Mastery", tagline: null, description: null, iconUrl: null, accentColor: null },
  { moduleName: "Service", displayName: "Service Excellence", tagline: null, description: null, iconUrl: null, accentColor: null },
  { moduleName: "Coaching", displayName: "Business Coaching", tagline: null, description: null, iconUrl: null, accentColor: null },
];

const state: { modules: any; update: { mutateAsync: ReturnType<typeof vi.fn>; isPending: boolean } } = {} as any;
const idle = { mutateAsync: vi.fn(), isPending: false };
vi.mock("@/lib/hooks/useMentorship", () => ({
  useMentorshipModules: () => state.modules,
  useUpdateMentorshipModules: () => state.update,
}));
vi.mock("@/lib/hooks/useOnboarding", () => ({
  useOnboardingState: () => ({ data: { verificationStatus: "awaiting_kyc", profile: {}, documents: [], onboardingReviewNote: null }, isLoading: false }),
  useOnboardingContent: () => ({ data: [], isLoading: false }),
  useOnboardingButtons: () => ({ data: [] }),
  useSaveOnboardingProgress: () => idle,
  useUploadOnboardingDocument: () => idle,
  useDeleteOnboardingDocument: () => idle,
  useSubmitOnboarding: () => idle,
  usePresignProfilePhoto: () => idle,
  useUploadProfilePhoto: () => idle,
}));
vi.mock("@/lib/hooks/useOnboardingMeetings", () => ({ useMyOnboardingMeetings: () => ({ data: [] }) }));
vi.mock("@/lib/hooks/useUser", () => ({
  usePsychometricQuestions: () => ({ data: [], isLoading: false }),
  useMyPsychometricResult: () => ({ data: null, isLoading: false }),
  useSubmitPsychometric: () => idle,
}));
vi.mock("@/lib/api/client", () => {
  const empty = () => Promise.resolve({ data: [] });
  return { default: { get: vi.fn(empty), post: vi.fn(empty), put: vi.fn(empty) }, getServerNow: () => Date.now() };
});

function modules(selection: string[] | null) {
  return {
    data: { selection, effective: selection ?? [], selectionRequired: selection === null, options: OPTIONS },
    isLoading: false, isError: false, refetch: vi.fn(),
  };
}

const progress = () => screen.getByText(/^\d+ \/ \d+$/).textContent;
const continueBtn = () => screen.getByRole("button", { name: /Continue|Saving/ }) as HTMLButtonElement;
const option = (name: RegExp) => screen.getByRole("button", { name }) as HTMLButtonElement;

function openMentorshipStep() {
  render(<OnboardingPage />);
  fireEvent.click(continueBtn()); // Welcome → Mentorship
  expect(screen.getByText("Choose your mentorship")).toBeTruthy();
}

beforeEach(() => {
  state.modules = modules(null);
  state.update = { mutateAsync: vi.fn(async (m: string[]) => ({ selection: m })), isPending: false };
  toastError.mockClear();
});
afterEach(cleanup);

describe("Onboarding — Choose your mentorship (step 2)", () => {
  it.each([
    [/Product Mastery/, "Product"],
    [/Service Excellence/, "Service"],
    [/Business Coaching/, "Coaching"],
  ])("saves %s as %j and advances to the next step on success", async (label, moduleName) => {
    openMentorshipStep();
    const at = progress();
    fireEvent.click(option(label));
    fireEvent.click(continueBtn());
    await waitFor(() => expect(state.update.mutateAsync).toHaveBeenCalledWith([moduleName]));
    await waitFor(() => expect(screen.queryByText("Choose your mentorship")).toBeNull());
    expect(progress()).not.toBe(at);
  });

  it("on a server error, stays on the step, keeps the selection and shows the server's message", async () => {
    state.update.mutateAsync.mockRejectedValueOnce(new Error("We couldn't save your mentorship selection right now. Please try again in a moment."));
    openMentorshipStep();
    fireEvent.click(option(/Product Mastery/));
    fireEvent.click(continueBtn());
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("We couldn't save your mentorship selection right now. Please try again in a moment.", { id: "mentorship-save" }),
    );
    expect(screen.getByText("Choose your mentorship")).toBeTruthy();
    expect(option(/Product Mastery/).getAttribute("aria-pressed")).toBe("true");
    // Retry from the same step works.
    fireEvent.click(continueBtn());
    await waitFor(() => expect(screen.queryByText("Choose your mentorship")).toBeNull());
    expect(state.update.mutateAsync).toHaveBeenCalledTimes(2);
  });

  it("sends only one save when Continue is clicked twice quickly", async () => {
    let resolve!: (v: unknown) => void;
    state.update.mutateAsync.mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
    openMentorshipStep();
    fireEvent.click(option(/Product Mastery/));
    fireEvent.click(continueBtn());
    fireEvent.click(continueBtn());
    expect(state.update.mutateAsync).toHaveBeenCalledTimes(1);
    resolve({ selection: ["Product"] });
    await waitFor(() => expect(screen.queryByText("Choose your mentorship")).toBeNull());
  });

  it("does not offer Introduction; Product Mastery, Service Excellence and Business Coaching are offered", () => {
    openMentorshipStep();
    expect(screen.queryByRole("button", { name: /^Introduction/ })).toBeNull();
    expect(screen.queryByText("Introduction")).toBeNull();
    for (const label of [/Product Mastery/, /Service Excellence/, /Business Coaching/]) expect(option(label)).toBeTruthy();
  });

  it("Continue is disabled until a module is selected", () => {
    openMentorshipStep();
    expect(continueBtn().disabled).toBe(true);
    fireEvent.click(option(/Service Excellence/));
    expect(continueBtn().disabled).toBe(false);
  });

  it("a saved selection is shown again after a refresh and Back/Continue keeps it without re-saving", async () => {
    state.modules = modules(["Product", "Coaching"]);
    openMentorshipStep();
    expect(option(/Product Mastery/).getAttribute("aria-pressed")).toBe("true");
    expect(option(/Business Coaching/).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(continueBtn());
    await waitFor(() => expect(screen.queryByText("Choose your mentorship")).toBeNull());
    expect(state.update.mutateAsync).not.toHaveBeenCalled(); // unchanged → no write
    fireEvent.click(screen.getByRole("button", { name: /Back/ }));
    expect(screen.getByText("Choose your mentorship")).toBeTruthy();
    expect(option(/Product Mastery/).getAttribute("aria-pressed")).toBe("true");
  });
});
