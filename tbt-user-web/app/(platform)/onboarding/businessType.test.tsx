import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import OnboardingPage from "./page";

// Profile step "Business Type *": offers exactly Product-based, Service-based,
// Coaching; the chosen value is saved, and a legacy value (Both/Other) already
// on the member is saved back unchanged.

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
  firstName: "Asha", city: "Chennai", state: "Tamil Nadu", businessName: "Asha Foods", productServiceType: "Product-based",
  instagramLink: "https://instagram.com/asha", annualTurnover: "0-10L", revenueGoalAfterTbt: "50L", goalAfter90Days: "Grow",
  businessStartedFrom: "2020", teamSize: "1-5", instagramStats: "1k", facebookStats: "500", gstNumber: "33ABCDE1234F1Z5",
  preferredSessionMode: "online", hasMarketingTeam: false, hasVideoEditing: false,
};

const continueBtn = () => screen.getByRole("button", { name: /^Continue$/ });
const businessTypeSelect = () =>
  screen.getByText("Business Type *").parentElement!.querySelector("select") as HTMLSelectElement;

function openProfileStep(profile: Record<string, unknown>) {
  state.onboarding = { data: { verificationStatus: "awaiting_kyc", profile, documents: [], onboardingReviewNote: null }, isLoading: false };
  render(<OnboardingPage />);
  fireEvent.click(continueBtn()); // Welcome → Profile
}

beforeEach(() => {
  state.save = vi.fn().mockResolvedValue({});
  state.saveHook = { mutateAsync: state.save, isPending: false };
});
afterEach(cleanup);

describe("onboarding Business Type", () => {
  it("offers exactly Product-based, Service-based, Coaching", () => {
    openProfileStep(COMPLETE_PROFILE);
    const choices = Array.from(businessTypeSelect().options).filter((o) => !o.disabled).map((o) => o.value);
    expect(choices).toEqual(["Product-based", "Service-based", "Coaching"]);
  });

  it.each(["Product-based", "Service-based", "Coaching"])("selecting %s saves it", async (type) => {
    openProfileStep({ ...COMPLETE_PROFILE, productServiceType: null });
    fireEvent.change(businessTypeSelect(), { target: { value: type } });
    fireEvent.click(continueBtn());
    await waitFor(() => expect(state.save).toHaveBeenCalledTimes(1));
    expect(state.save.mock.calls[0][0].productServiceType).toBe(type);
  });

  it.each(["Both", "Other"])("a member already saved as %s keeps that value", async (legacy) => {
    openProfileStep({ ...COMPLETE_PROFILE, productServiceType: legacy });
    fireEvent.click(continueBtn());
    await waitFor(() => expect(state.save).toHaveBeenCalledTimes(1));
    expect(state.save.mock.calls[0][0].productServiceType).toBe(legacy);
  });
});
