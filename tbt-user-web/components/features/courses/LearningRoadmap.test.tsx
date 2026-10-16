import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import LearningRoadmap from "./LearningRoadmap";
import { buildRoadmapLevels } from "@/lib/utils/roadmapLevels";
import { buildSectionGroups } from "@/lib/utils/sectionProgress";

const sections = [
  { id: "s1", title: "Foundations", sortOrder: 1 },
  { id: "s2", title: "Growth", sortOrder: 2 },
  { id: "s3", title: "Scale", sortOrder: 3 },
];
const ORDER = ["a1", "a2", "b1", "c1"];
const SECTION: Record<string, string> = { a1: "s1", a2: "s1", b1: "s2", c1: "s3" };
function levelsFor(completed: string[]) {
  const lessons = ORDER.map((id, i) => ({
    id,
    title: `Lesson ${id}`,
    sectionId: SECTION[id],
    locked: ORDER.slice(0, i).some((p) => !completed.includes(p)),
  }));
  return buildRoadmapLevels(buildSectionGroups(lessons, sections, completed), completed);
}

let onOpen: ReturnType<typeof vi.fn<(lesson: any) => void>>;
const renderMap = (completed: string[] = []) => render(<LearningRoadmap levels={levelsFor(completed)} onOpenLesson={onOpen} />);
const openPanel = () => fireEvent.click(screen.getByRole("button", { name: /^Learning roadmap:/ }));
const level = (n: number) => screen.getAllByRole("button").find((b) => (b.getAttribute("aria-label") ?? "").startsWith(`Level ${n}:`))!;

beforeEach(() => {
  onOpen = vi.fn<(lesson: any) => void>();
});
afterEach(cleanup);

describe("LearningRoadmap", () => {
  it("shows a slim fixed edge tab with the level summary, closed by default", () => {
    renderMap(["a1", "a2"]);
    const btn = screen.getByRole("button", { name: "Learning roadmap: 1 of 3 levels completed" });
    expect(btn.className.split(" ")).toContain("fixed");
    const classes = btn.className.split(" ");
    expect(classes).toContain("left-0");
    // Fits inside the page side padding (px-4 = 16px, md:px-6 = 24px).
    expect(classes).toContain("w-4");
    expect(classes).toContain("md:w-[22px]");
    expect(btn.textContent).toContain("Roadmap · 1/3");
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens a panel with one diamond level per section, in order, on a winding path", () => {
    renderMap();
    openPanel();
    const dialog = screen.getByRole("dialog", { name: "Learning roadmap" });
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(3);
    expect(level(1).getAttribute("aria-label")).toMatch(/Level 1: Foundations/);
    expect(level(3).getAttribute("aria-label")).toMatch(/Level 3: Scale/);
    // n levels → n-1 curved connectors, no extra segments (no loops back).
    const paths = dialog.querySelectorAll("svg[data-roadmap-path] path");
    expect(paths).toHaveLength(2);
    paths.forEach((p) => expect(p.getAttribute("d")).toMatch(/^M [\d.]+ [\d.]+ C /));
    // Each connector goes strictly downward.
    paths.forEach((p) => {
      const nums = p.getAttribute("d")!.match(/-?[\d.]+/g)!.map(Number);
      expect(nums[nums.length - 1]).toBeGreaterThan(nums[1]);
    });
    // Diamond = rotated square.
    expect(level(1).querySelector(".rotate-45")).toBeTruthy();
  });

  it("only Level 1 is available initially", () => {
    renderMap();
    openPanel();
    expect(level(1).getAttribute("data-level-state")).toBe("current");
    expect((level(1) as HTMLButtonElement).disabled).toBe(false);
    for (const n of [2, 3]) {
      expect(level(n).getAttribute("data-level-state")).toBe("locked");
      expect((level(n) as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it("finishing a level unlocks the next one", () => {
    renderMap(["a1", "a2"]);
    openPanel();
    expect(level(1).getAttribute("data-level-state")).toBe("completed");
    expect(level(2).getAttribute("data-level-state")).toBe("current");
    expect(level(3).getAttribute("data-level-state")).toBe("locked");
  });

  it("clicking an open level opens its next unfinished lesson through the page", () => {
    renderMap(["a1"]);
    openPanel();
    fireEvent.click(level(1));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen.mock.calls[0][0].id).toBe("a2");
    expect(screen.queryByRole("dialog")).toBeNull(); // panel closes so the lesson is visible
  });

  it("clicking a locked level does nothing", () => {
    renderMap();
    openPanel();
    fireEvent.click(level(3));
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("Escape closes the panel", () => {
    renderMap();
    openPanel();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders nothing for a course without lessons", () => {
    const { container } = render(<LearningRoadmap levels={[]} onOpenLesson={onOpen} />);
    expect(container.innerHTML).toBe("");
  });
});
