import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import CoursesPageRoadmap from "./CoursesPageRoadmap";

const state = vi.hoisted(() => ({ course: undefined as any, progress: [] as any[], push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: state.push }) }));
vi.mock("@/lib/hooks/useCourses", () => ({
  useCourse: () => ({ data: state.course }),
  useLessonProgress: () => ({ data: state.progress }),
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
  state.course = COURSE;
  state.progress = [];
  state.push.mockReset();
});
afterEach(cleanup);

describe("CoursesPageRoadmap (/courses)", () => {
  it("shows the roadmap tab for the given course", () => {
    render(<CoursesPageRoadmap courseId="c1" />);
    expect(screen.getByRole("button", { name: "Learning roadmap: 0 of 2 levels completed" })).toBeTruthy();
  });

  it("names the course in the panel and uses its real progress", () => {
    state.progress = [{ lessonId: "l1", completed: true }, { lessonId: "l2", completed: true }];
    state.course = { ...COURSE, lessons: COURSE.lessons.map((l) => ({ ...l, locked: false })) };
    render(<CoursesPageRoadmap courseId="c1" />);
    fireEvent.click(screen.getByRole("button", { name: /^Learning roadmap:/ }));
    expect(screen.getByRole("dialog").textContent).toContain("Growth Accelerator");
    const states = [...document.querySelectorAll("button[data-level-state]")].map((b) => b.getAttribute("data-level-state"));
    expect(states).toEqual(["completed", "current"]);
  });

  it("opening a level deep-links to that lesson on the course page", () => {
    render(<CoursesPageRoadmap courseId="c1" />);
    fireEvent.click(screen.getByRole("button", { name: /^Learning roadmap:/ }));
    fireEvent.click(document.querySelector('button[data-level-state="current"]')!);
    expect(state.push).toHaveBeenCalledWith("/learning/c1?lesson=l1");
  });

  it("renders nothing until the course has loaded", () => {
    state.course = undefined;
    const { container } = render(<CoursesPageRoadmap courseId="c1" />);
    expect(container.innerHTML).toBe("");
  });
});
