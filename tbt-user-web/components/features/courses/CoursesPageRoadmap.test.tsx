import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import CoursesPageRoadmap from "./CoursesPageRoadmap";

const state = vi.hoisted(() => ({
  course: { data: undefined as any, isLoading: false, isError: false, refetch: vi.fn() },
  progress: { data: [] as any[], isLoading: false, isError: false, refetch: vi.fn() },
  push: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: state.push }) }));
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

  it("names the course in the popup and uses its real progress", () => {
    state.progress.data = [{ lessonId: "l1", completed: true }, { lessonId: "l2", completed: true }];
    state.course.data = { ...COURSE, lessons: COURSE.lessons.map((l) => ({ ...l, locked: false })) };
    render(<CoursesPageRoadmap courseId="c1" />);
    openPopup();
    expect(dialog().textContent).toContain("Growth Accelerator");
    const states = [...dialog().querySelectorAll("button[data-level-state]")].map((b) => b.getAttribute("data-level-state"));
    expect(states).toEqual(["completed", "current"]);
  });

  it("opening a level deep-links to that lesson on the course page", () => {
    render(<CoursesPageRoadmap courseId="c1" />);
    openPopup();
    fireEvent.click(dialog().querySelector('button[data-level-state="current"]')!);
    expect(state.push).toHaveBeenCalledWith("/learning/c1?lesson=l1");
  });

  it("shows a loading state while the course loads", () => {
    state.course = { ...state.course, data: undefined, isLoading: true };
    render(<CoursesPageRoadmap courseId="c1" />);
    openPopup();
    expect(dialog().querySelector('[aria-busy="true"]')).toBeTruthy();
  });

  it("shows an error state whose retry refetches course and progress", () => {
    state.course = { ...state.course, data: undefined, isError: true };
    render(<CoursesPageRoadmap courseId="c1" />);
    openPopup();
    fireEvent.click(within(dialog()).getByRole("button", { name: "Try again" }));
    expect(state.course.refetch).toHaveBeenCalled();
    expect(state.progress.refetch).toHaveBeenCalled();
  });
});
