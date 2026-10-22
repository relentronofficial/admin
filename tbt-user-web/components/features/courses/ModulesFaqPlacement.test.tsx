import { render, screen, cleanup, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import CoursesPage from "@/app/(platform)/courses/page";

// The FAQ button sits on the same row as each Modules heading — heading first
// (left), FAQ last (right) — in every personalised state of /courses, and the
// rest of the page renders exactly as before.

const state: { meta: any; courses: any[] } = { meta: {}, courses: [] };

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/lib/context/SiteConfigContext", () => ({ useSiteConfig: () => ({ uiStrings: null }) }));
vi.mock("@/components/features/mentorship/MentorshipDashboard", () => ({ default: () => <div data-testid="mentorship-dashboard" /> }));
vi.mock("@/components/features/courses/CoursesPageRoadmap", () => ({ default: () => null }));
vi.mock("@/components/features/batch/WeeklyActivityGraph", () => ({ default: () => <div data-testid="weekly-activity-graph" /> }));
vi.mock("@/lib/hooks/useDashboard", () => ({ useWatchHistory: () => ({ data: { data: [] } }) }));
vi.mock("@/lib/hooks/useModuleFaqs", () => ({ useModuleFaqs: () => ({ data: [], isLoading: false, isError: false }) }));
vi.mock("@/lib/hooks/useCourses", () => ({
  useMyEnrollments: () => ({ data: [] }),
  useCourses: () => ({ data: { data: state.courses, meta: state.meta }, isLoading: false, isError: false, refetch: vi.fn() }),
}));

const course = (id: string, module: string) => ({ id, title: `Course ${id}`, module, slug: id, thumbnailUrl: null, price: 0, locked: false, episodeCount: 1 });

function expectFaqRightOf(headingText: string | RegExp) {
  const row = screen.getByTestId("modules-heading-row");
  const heading = within(row).getByRole("heading", { name: headingText });
  const faq = within(row).getByRole("button", { name: /FAQ/ });
  // Heading comes first, FAQ button after it, in a wrapping justify-between flex row.
  expect(heading.compareDocumentPosition(faq) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(row.className).toMatch(/justify-between/);
  expect(row.className).toMatch(/flex-wrap/);
}

beforeEach(() => {
  state.meta = {};
  state.courses = [];
});
afterEach(cleanup);

describe("Modules page FAQ placement", () => {
  it("direct access: FAQ at the far right of the 'Modules' heading row", () => {
    state.meta = { personalizationState: "direct", memberBusinessType: "Retail" };
    state.courses = [course("c1", "Product")];
    render(<CoursesPage />);
    expectFaqRightOf("Modules");
    // The existing filter badge still shows, and the FAQ comes after it.
    const row = screen.getByTestId("modules-heading-row");
    expect(row.textContent).toMatch(/Filtered for:Retail.*FAQ/);
    expect(screen.getByText("Course c1")).toBeTruthy();
  });

  it("multi-module program: FAQ beside 'Your Program Modules'", () => {
    state.meta = {
      personalizationState: "program", allowedModules: ["Product", "Service"], programName: "eComm Mastery",
      moduleConfigs: [{ moduleName: "Product", displayName: "E-commerce" }, { moduleName: "Service", displayName: "Service" }],
    };
    state.courses = [course("c1", "Product"), course("c2", "Service")];
    render(<CoursesPage />);
    expectFaqRightOf("Your Program Modules");
    // Module tabs and the course grid are unchanged.
    expect(screen.getByRole("button", { name: "E-commerce" })).toBeTruthy();
    expect(screen.getByText("Course c1")).toBeTruthy();
  });

  it("single module: FAQ on the module hero's heading row", () => {
    state.meta = {
      personalizationState: "program", allowedModules: ["Product"], programName: "eComm Mastery",
      moduleConfigs: [{ moduleName: "Product", displayName: "E-commerce", tagline: null, description: null, bannerUrl: null, iconUrl: null, accentColor: null, sortOrder: 1 }],
    };
    state.courses = [course("c1", "Product")];
    render(<CoursesPage />);
    expectFaqRightOf("E-commerce");
    expect(screen.getByText("Course c1")).toBeTruthy();
  });

  it("exactly one FAQ button per page", () => {
    state.meta = { personalizationState: "direct" };
    state.courses = [course("c1", "Product")];
    render(<CoursesPage />);
    expect(screen.getAllByRole("button", { name: /FAQ/ })).toHaveLength(1);
  });

  it("no standalone Weekly Activity Graph below the Mentorship Dashboard", () => {
    state.meta = { personalizationState: "direct" };
    state.courses = [course("c1", "Product")];
    render(<CoursesPage />);
    expect(screen.getByTestId("mentorship-dashboard")).toBeTruthy();
    expect(screen.queryByTestId("weekly-activity-graph")).toBeNull();
  });
});
