import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MentorshipModuleSelector, MentorshipModuleOptions } from "./MentorshipModulePicker";

// ── Hook mocks: the server is the source of truth for the saved selection ──
const state: Record<string, any> = {};
const mutate = vi.fn();

vi.mock("@/lib/hooks/useMentorship", () => ({
  useMentorshipModules: () => state.modules,
  useUpdateMentorshipModules: () => ({ mutate, isPending: false }),
}));
vi.mock("@/lib/context/SiteConfigContext", () => ({ useSiteConfig: () => ({ uiStrings: null }) }));
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn(), error: vi.fn() } }));

const OPTIONS = [
  { moduleName: "Product", displayName: "E-commerce Mentorship", tagline: null, description: null, iconUrl: null, accentColor: null },
  { moduleName: "Service", displayName: "Services Mentorship", tagline: null, description: null, iconUrl: null, accentColor: null },
  { moduleName: "Coaching", displayName: "CoachX Mentorship", tagline: null, description: null, iconUrl: null, accentColor: null },
];

const loaded = (selection: string[] | null, options = OPTIONS) => ({
  data: { selection, effective: selection ?? [], selectionRequired: selection === null, options },
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
});

const pressed = (name: string) => screen.getByRole("button", { name }).getAttribute("aria-pressed");

beforeEach(() => {
  mutate.mockReset();
});
afterEach(cleanup);

describe("MentorshipModuleSelector", () => {
  it("pre-selects the selection saved on the server (refresh / other device)", () => {
    state.modules = loaded(["Coaching"]);
    render(<MentorshipModuleSelector />);
    expect(pressed("CoachX Mentorship")).toBe("true");
    expect(pressed("Services Mentorship")).toBe("false");
    expect(pressed("E-commerce Mentorship")).toBe("false");
  });

  it("saves exactly the chosen modules", () => {
    state.modules = loaded(null);
    render(<MentorshipModuleSelector />);
    fireEvent.click(screen.getByRole("button", { name: "Services Mentorship" }));
    fireEvent.click(screen.getByRole("button", { name: "Save selection" }));
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0][0]).toEqual(["Service"]);
  });

  it("supports changing a selection to multiple modules", () => {
    state.modules = loaded(["Service"]);
    render(<MentorshipModuleSelector />);
    fireEvent.click(screen.getByRole("button", { name: "Services Mentorship" })); // deselect
    fireEvent.click(screen.getByRole("button", { name: "CoachX Mentorship" }));
    fireEvent.click(screen.getByRole("button", { name: "E-commerce Mentorship" }));
    fireEvent.click(screen.getByRole("button", { name: "Save selection" }));
    expect(mutate.mock.calls[0][0]).toEqual(["Product", "Coaching"]);
  });

  it("will not save an empty selection", () => {
    state.modules = loaded(null);
    render(<MentorshipModuleSelector />);
    const save = screen.getByRole("button", { name: "Save selection" });
    expect(save.hasAttribute("disabled")).toBe(true);
    fireEvent.click(save);
    expect(mutate).not.toHaveBeenCalled();
  });

  it("drops a saved module the admin has disabled", () => {
    state.modules = loaded(["Service"], OPTIONS.filter((o) => o.moduleName !== "Service"));
    render(<MentorshipModuleSelector />);
    expect(screen.queryByRole("button", { name: "Services Mentorship" })).toBeNull();
    expect(screen.getByRole("button", { name: "Save selection" }).hasAttribute("disabled")).toBe(true);
  });

  it("shows a retry on API failure instead of any modules", () => {
    const refetch = vi.fn();
    state.modules = { data: undefined, isLoading: false, isError: true, refetch };
    render(<MentorshipModuleSelector />);
    expect(screen.queryByRole("button", { name: "Services Mentorship" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalled();
  });

  it("shows an empty state when no modules are offered", () => {
    state.modules = loaded(null, []);
    render(<MentorshipModuleSelector />);
    expect(screen.getByText("No mentorship modules are available right now.")).toBeTruthy();
  });
});

describe("MentorshipModuleOptions", () => {
  it("keeps the configured order regardless of click order", () => {
    const onChange = vi.fn();
    render(<MentorshipModuleOptions options={OPTIONS} value={["Coaching"]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "E-commerce Mentorship" }));
    expect(onChange).toHaveBeenCalledWith(["Product", "Coaching"]);
  });
});
