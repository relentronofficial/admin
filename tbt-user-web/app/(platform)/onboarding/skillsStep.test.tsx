import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import OnboardingPage from "./page";

// Skills step: all six ratings show with their saved value, a tapped segment
// sets 1–10, and Continue saves every rating — including untouched sliders,
// which show (and therefore save) 1.

vi.mock("react-hot-toast", () => ({ default: { error: vi.fn(), success: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

const stable = vi.hoisted(() => ({
  mentorship: { data: { selection: [], effective: [], selectionRequired: false, options: [] }, isLoading: false, isError: false, refetch: () => {} },
  idle: { mutateAsync: () => Promise.resolve({}), isPending: false },
  empty: { data: [] },
  questions: { data: [], isLoading: false },
  result: { data: null, isLoading: false },
  content: { data: [], isLoading: false },
}));
const state: { onboarding: any; saveHook: any; save: ReturnType<typeof vi.fn> } = { onboarding: null, saveHook: null, save: vi.fn() };
vi.mock("@/lib/hooks/useOnboarding", () => ({
  useOnboardingState: () => state.onboarding,
  useOnboardingContent: () => stable.content,
  useOnboardingButtons: () => stable.empty,
  useSaveOnboardingProgress: () => state.saveHook,
  useUploadOnboardingDocument: () => stable.idle,
  useDeleteOnboardingDocument: () => stable.idle,
  useSubmitOnboarding: () => stable.idle,
  usePresignProfilePhoto: () => stable.idle,
  useUploadProfilePhoto: () => stable.idle,
}));
vi.mock("@/lib/hooks/useMentorship", () => ({
  useMentorshipModules: () => stable.mentorship,
  useUpdateMentorshipModules: () => stable.idle,
}));
vi.mock("@/lib/hooks/useOnboardingMeetings", () => ({ useMyOnboardingMeetings: () => stable.empty }));
vi.mock("@/lib/hooks/useUser", () => ({
  usePsychometricQuestions: () => stable.questions,
  useMyPsychometricResult: () => stable.result,
  useSubmitPsychometric: () => stable.idle,
}));
vi.mock("@/lib/api/client", () => {
  const empty = () => Promise.resolve({ data: [] });
  return { default: { get: vi.fn(empty), post: vi.fn(empty), put: vi.fn(empty) }, getServerNow: () => Date.now() };
});

// A profile that passes the profile step's validation.
const COMPLETE_PROFILE = {
  firstName: "Asha", city: "Chennai", state: "Tamil Nadu", businessName: "Asha Foods", productServiceType: "Product",
  instagramLink: "https://instagram.com/asha", annualTurnover: "0-10L", revenueGoalAfterTbt: "50L", goalAfter90Days: "Grow",
  businessStartedFrom: "2020", teamSize: "1-5", instagramStats: "1k", facebookStats: "500", gstNumber: "33ABCDE1234F1Z5",
  preferredSessionMode: "online", hasMarketingTeam: false, hasVideoEditing: false,
};
const SKILLS = ["Business Foundation", "Content Creation", "Sales Funnels", "Paid Ads", "Sales & Closing", "Overall Marketing"];
const KEYS = ["skillBusinessFoundation", "skillContent", "skillFunnels", "skillAds", "skillSales", "skillOverallMarketing"];

const continueBtn = () => screen.getByRole("button", { name: /^Continue$/ });
const slider = (label: string) => screen.getByText(label).closest('[class~="space-y-2.5"]') as HTMLElement;
const shownValue = (label: string) => slider(label).querySelector(".tabular-nums")!.textContent;

async function openSkillsStep(profile: Record<string, unknown>) {
  state.onboarding = { data: { verificationStatus: "awaiting_kyc", profile, documents: [], onboardingReviewNote: null }, isLoading: false };
  render(<OnboardingPage />);
  fireEvent.click(continueBtn()); // Welcome → Profile
  fireEvent.click(continueBtn()); // Profile → Skills (saves the profile step)
  await waitFor(() => expect(screen.getByText("Rate your skills")).toBeTruthy());
  state.save.mockClear();
}

beforeEach(() => {
  state.save = vi.fn().mockResolvedValue({});
  state.saveHook = { mutateAsync: state.save, isPending: false };
});
afterEach(cleanup);

describe("onboarding skills step", () => {
  it("shows all six ratings in order with a 1–10 slider each", async () => {
    await openSkillsStep(COMPLETE_PROFILE);
    const labels = SKILLS.map((l) => screen.getByText(l));
    for (let i = 1; i < labels.length; i++) {
      expect(labels[i - 1].compareDocumentPosition(labels[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
    for (const l of SKILLS) expect(slider(l).querySelectorAll("button")).toHaveLength(10);
  });

  it("restores saved ratings and saves every rating on Continue (untouched = shown value)", async () => {
    await openSkillsStep({ ...COMPLETE_PROFILE, skillSales: 4, skillContent: 9 });
    expect(shownValue("Sales & Closing")).toBe("4");
    expect(shownValue("Content Creation")).toBe("9");
    expect(shownValue("Paid Ads")).toBe("1");

    fireEvent.click(slider("Paid Ads").querySelectorAll("button")[6]); // 7/10
    fireEvent.click(slider("Overall Marketing").querySelectorAll("button")[9]); // 10/10
    expect(shownValue("Paid Ads")).toBe("7");

    fireEvent.click(continueBtn());
    await waitFor(() => expect(state.save).toHaveBeenCalledTimes(1));
    const body = state.save.mock.calls[0][0];
    expect(Object.fromEntries(KEYS.map((k) => [k, body[k]]))).toEqual({
      skillBusinessFoundation: 1, skillContent: 9, skillFunnels: 1, skillAds: 7, skillSales: 4, skillOverallMarketing: 10,
    });
  });
});
