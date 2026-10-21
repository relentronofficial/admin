import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import CoursesPageRoadmap from "./CoursesPageRoadmap";

const state = vi.hoisted(() => ({
  course: { data: undefined as any, isLoading: false, isError: false, refetch: vi.fn() },
  progress: { data: [] as any[], isLoading: false, isError: false, refetch: vi.fn() },
  push: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: state.push }) }));
vi.mock("@/lib/hooks/useBatchProgram", () => ({ useMyWeeklyGraph: () => ({ data: null, isLoading: false, isError: false, refetch: vi.fn() }) }));
vi.mock("@/lib/hooks/useCourses", () => ({
  useCourse: () => state.course,
  useLessonProgress: () => state.progress,
}));

const COURSE = {
  id: "c1",
  title: "Growth Accelerator",
  sections: [{ id: "s1", title: "Foundations", sortOrder: 1 }, { id: "s2", title: "Growth", sortOrder: 2 }],
  lessons: [
    { id: "l1", title: "Intro", sectionId: "s1", locked: false },
    { id: "l2", title: "Basics", sectionId: "s1", locked: true },
    { id: "l3", title: "Funnels", sectionId: "s2", locked: true },
  ],
};

beforeEach(() => {
  state.course = { data: COURSE, isLoading: false, isError: false, refetch: vi.fn() };
  state.progress = { data: [], isLoading: false, isError: false, refetch: vi.fn() };
  state.push.mockReset();
});
afterEach(cleanup);

const openPopup = () => fireEvent.click(screen.getByRole("button", { name: /^Learning roadmap:/ }));
const dialog = () => screen.getByRole("dialog", { name: "Learning Roadmap" });

describe("CoursesPageRoadmap (/courses)", () => {
  it("shows the roadmap trigger for the given course", () => {
    render(<CoursesPageRoadmap courseId="c1" />);
    expect(screen.getByRole("button", { name: "Learning roadmap: 0 of 2 levels completed" })).toBeTruthy();
  });

  it("names the course in the popup header with its real progress", () => {
    state.progress.data = [{ lessonId: "l1", completed: true }, { lessonId: "l2", completed: true }];
    state.course.data = { ...COURSE, lessons: COURSE.lessons.map((l) => ({ ...l, locked: false })) };
    render(<CoursesPageRoadmap courseId="c1" />);
    openPopup();
    expect(dialog().textContent).toContain("Growth Accelerator");
    expect(dialog().textContent).toContain("1 of 2 levels completed");
    expect(within(dialog()).queryByRole("tab", { name: "This course" })).toBeNull();
  });
});
