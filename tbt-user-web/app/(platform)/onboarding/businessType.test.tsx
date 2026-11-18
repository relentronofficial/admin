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
const state: { onboarding: any; saveHook: any; save: ReturnType<typeof vi.fn>; upload: ReturnType<typeof vi.fn> } = { onboarding: null, saveHook: null, save: vi.fn(), upload: vi.fn() };
vi.mock("@/lib/hooks/useOnboarding", () => ({
  useOnboardingState: () => state.onboarding,
  useOnboardingContent: () => stable.content,
  useOnboardingButtons: () => stable.empty,
  useSaveOnboardingProgress: () => state.saveHook,
  useUploadOnboardingDocument: () => stable.idle,
  useDeleteOnboardingDocument: () => stable.idle,
  useSubmitOnboarding: () => stable.idle,
  usePresignProfilePhoto: () => stable.idle,
  useUploadProfilePhoto: () => ({ mutateAsync: state.upload, isPending: false }),
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
  profilePhotoUrl: "https://cdn.example.com/asha.webp",
  // Every field is required (lib/onboarding/profileValidation.ts).
  lastName: "Kumar", dob: "1990-01-01", gender: "female", pincode: "600001",
  websiteUrl: "https://ashafoods.in", domainHostingDetails: "GoDaddy, renews 2027", businessAddress: "1 Main Road, Chennai",
  marketingChannels: ["Social Media"], marketingChannelName: "Asha Foods Instagram",
  currentChallenges: ["Getting leads", "Pricing", "Hiring"],
  hasWebsite: true, weeklyWebsiteOrders: 5,
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
  state.upload = vi.fn().mockResolvedValue({ data: { publicUrl: "https://cdn.example.com/new.jpg" } });
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

describe("onboarding profile photo (mandatory)", () => {
  const photoInput = () => document.getElementById("onboarding-profile-photo") as HTMLInputElement;
  const pick = (file: File) => fireEvent.change(photoInput(), { target: { files: [file] } });
  const jpeg = () => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2])], "me.jpg", { type: "image/jpeg" });

  it("shows a required Profile Photo label with a red asterisk", () => {
    openProfileStep({ ...COMPLETE_PROFILE, profilePhotoUrl: null });
    const label = screen.getByText(/^Profile Photo/);
    expect(label.textContent).toContain("*");
    expect(label.querySelector("span[aria-hidden]")?.getAttribute("style")).toMatch(/color-alert/);
    expect(screen.getByRole("button", { name: "Upload photo" })).toBeTruthy();
  });

  it("blocks Continue without a photo and shows 'Profile photo is required.'", async () => {
    Element.prototype.scrollIntoView = vi.fn(); // not implemented in jsdom
    openProfileStep({ ...COMPLETE_PROFILE, profilePhotoUrl: null });
    fireEvent.click(continueBtn());
    expect(await screen.findByText("Profile photo is required.")).toBeTruthy();
    expect(state.save).not.toHaveBeenCalled();
  });

  it.each([
    ["a non-image file", new File(["hello"], "notes.txt", { type: "text/plain" }), "Please choose a JPG, PNG, WebP or GIF photo."],
    ["an empty file", new File([], "empty.jpg", { type: "image/jpeg" }), "That file is empty. Please choose a photo."],
  ])("refuses %s before uploading", async (_label, file, message) => {
    openProfileStep({ ...COMPLETE_PROFILE, profilePhotoUrl: null });
    pick(file as File);
    expect(await screen.findByText(message as string)).toBeTruthy();
    expect(state.upload).not.toHaveBeenCalled();
  });

  it("uploads a photo, shows the preview, and then lets the member continue", async () => {
    openProfileStep({ ...COMPLETE_PROFILE, profilePhotoUrl: null });
    pick(jpeg());
    await waitFor(() => expect((screen.getByAltText("Profile") as HTMLImageElement).src).toBe("https://cdn.example.com/new.jpg"));
    expect(state.upload).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Change photo" })).toBeTruthy();
    fireEvent.click(continueBtn());
    await waitFor(() => expect(state.save).toHaveBeenCalledTimes(1));
    expect(state.save.mock.calls[0][0].profilePhotoUrl).toBe("https://cdn.example.com/new.jpg");
  });

  it("replaces an existing photo", async () => {
    openProfileStep(COMPLETE_PROFILE);
    expect((screen.getByAltText("Profile") as HTMLImageElement).src).toBe("https://cdn.example.com/asha.webp");
    pick(jpeg());
    await waitFor(() => expect((screen.getByAltText("Profile") as HTMLImageElement).src).toBe("https://cdn.example.com/new.jpg"));
  });

  it("a failed upload shows an error and keeps no photo", async () => {
    state.upload = vi.fn().mockRejectedValue(new Error("Upload failed – no storage service available"));
    openProfileStep({ ...COMPLETE_PROFILE, profilePhotoUrl: null });
    pick(jpeg());
    expect(await screen.findByText("Upload failed – no storage service available")).toBeTruthy();
    expect(screen.queryByAltText("Profile")).toBeNull();
  });
});

describe("onboarding profile: every field required, with No GST / No website exemptions", () => {
  const gstInput = () => screen.getByPlaceholderText("22AAAAA0000A1Z5") as HTMLInputElement;
  const noGstBox = () => screen.getByRole("checkbox", { name: "No GST" }) as HTMLInputElement;
  const noWebsiteBox = () => screen.getByRole("checkbox", { name: "No website" }) as HTMLInputElement;
  // A member who never saved the profile step (no brand name yet) starts with No GST unticked.
  const NEW_MEMBER = { ...COMPLETE_PROFILE, businessName: "", gstNumber: "" };
  const brandInput = () => screen.getByText("Brand Name *").parentElement!.querySelector("input")!;
  beforeEach(() => { Element.prototype.scrollIntoView = vi.fn(); });

  it("a blank form shows an error on every field and saves nothing", async () => {
    openProfileStep({ profilePhotoUrl: "https://cdn.example.com/asha.webp" });
    fireEvent.click(continueBtn());
    for (const msg of [
      "First name is required", "Last name is required", "Date of birth is required", "Please select your gender",
      "Pincode is required", "Brand name is required", "Business address is required", "Team size is required",
      "Website URL is required (or tick “No website”)", "Select at least one channel (or “None”)",
      "GST number is required (or tick “No GST”)", "Please enter your primary business obstacle",
    ]) expect(await screen.findByText(msg)).toBeTruthy();
    expect(state.save).not.toHaveBeenCalled();
  });

  it("GST is required by default; an invalid number is refused", async () => {
    openProfileStep(NEW_MEMBER);
    fireEvent.change(brandInput(), { target: { value: "Asha Foods" } });
    expect(noGstBox().checked).toBe(false);
    expect(screen.getByText("GST Number *")).toBeTruthy();
    fireEvent.click(continueBtn());
    expect(await screen.findByText("GST number is required (or tick “No GST”)")).toBeTruthy();
    fireEvent.change(gstInput(), { target: { value: "12345" } });
    fireEvent.click(continueBtn());
    expect(await screen.findByText(/valid 15-character GST number/)).toBeTruthy();
    expect(state.save).not.toHaveBeenCalled();
  });

  it("ticking No GST makes GST optional: field disabled and cleared, Continue saves an empty GST", async () => {
    openProfileStep(COMPLETE_PROFILE);
    fireEvent.click(noGstBox());
    expect(gstInput().disabled).toBe(true);
    expect(gstInput().value).toBe("");
    expect(screen.getByText("GST Number")).toBeTruthy(); // no asterisk
    fireEvent.click(continueBtn());
    await waitFor(() => expect(state.save).toHaveBeenCalledTimes(1));
    expect(state.save.mock.calls[0][0].gstNumber).toBe(""); // clears a previously saved GST
  });

  it("unticking No GST makes it required again", async () => {
    openProfileStep(NEW_MEMBER);
    fireEvent.change(brandInput(), { target: { value: "Asha Foods" } });
    fireEvent.click(noGstBox());
    fireEvent.click(noGstBox());
    expect(gstInput().disabled).toBe(false);
    fireEvent.click(continueBtn());
    expect(await screen.findByText("GST number is required (or tick “No GST”)")).toBeTruthy();
    expect(state.save).not.toHaveBeenCalled();
  });

  it("a valid GST is saved upper-cased", async () => {
    openProfileStep(NEW_MEMBER);
    fireEvent.change(brandInput(), { target: { value: "Asha Foods" } });
    fireEvent.change(gstInput(), { target: { value: "33abcde1234f1z5" } });
    fireEvent.click(continueBtn());
    await waitFor(() => expect(state.save).toHaveBeenCalledTimes(1));
    expect(state.save.mock.calls[0][0].gstNumber).toBe("33ABCDE1234F1Z5");
  });

  it("No website: website URL and domain & hosting become optional and are saved empty", async () => {
    openProfileStep({ ...COMPLETE_PROFILE, websiteUrl: "", domainHostingDetails: "", hasWebsite: undefined });
    fireEvent.click(continueBtn());
    expect(await screen.findByText("Website URL is required (or tick “No website”)")).toBeTruthy();
    fireEvent.click(noWebsiteBox());
    expect(screen.queryByText("Domain & Hosting Details *")).toBeNull();
    fireEvent.click(continueBtn());
    await waitFor(() => expect(state.save).toHaveBeenCalledTimes(1));
    expect(state.save.mock.calls[0][0]).toMatchObject({ websiteUrl: "", domainHostingDetails: "", hasWebsite: false });
  });

  it("a member saved earlier without GST, or with hasWebsite=false, keeps those exemptions", async () => {
    openProfileStep({ ...COMPLETE_PROFILE, gstNumber: null, hasWebsite: false, websiteUrl: null, domainHostingDetails: null });
    expect(noGstBox().checked).toBe(true);
    expect(noWebsiteBox().checked).toBe(true);
    fireEvent.click(continueBtn());
    await waitFor(() => expect(state.save).toHaveBeenCalledTimes(1));
  });
});
