import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import LearningRoadmap, { levelPoint, roadSegment } from "./LearningRoadmap";
import { buildRoadmapLevels } from "@/lib/utils/roadmapLevels";
import { buildSectionGroups } from "@/lib/utils/sectionProgress";

const player = vi.hoisted(() => ({ episode: null as any }));
vi.mock("@/lib/stores/usePodcastPlayer", () => ({
  usePodcastPlayer: (sel: (s: any) => any) => sel(player),
}));
const growth = vi.hoisted(() => ({
  query: { data: null as any, isLoading: false, isError: false, refetch: () => {} },
  push: (_: string) => {},
}));
vi.mock("@/lib/hooks/useBatchProgram", () => ({ useMyWeeklyGraph: () => growth.query }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: (h: string) => growth.push(h) }) }));

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
const renderMap = (completed: string[] = [], extra: Record<string, any> = {}) =>
  render(<LearningRoadmap levels={levelsFor(completed)} onOpenLesson={onOpen} title="Growth Accelerator" {...extra} />);
const trigger = () => screen.getByRole("button", { name: /^Learning roadmap:/ });
const tab = (name: string) => screen.getByRole("tab", { name });
/** Open the roadmap popup (it shows the Growth milestones view). */
const openPopup = () => fireEvent.click(trigger());
const openGrowth = () => fireEvent.click(trigger()); // Growth milestones is the default tab
const dialog = () => screen.getByRole("dialog", { name: "Learning Roadmap" });
const level = (n: number) => within(dialog()).getAllByRole("button").find((b) => (b.getAttribute("aria-label") ?? "").startsWith(`Level ${n}:`))!;

beforeEach(() => {
  onOpen = vi.fn<(lesson: any) => void>();
  player.episode = null;
  growth.query = { data: null, isLoading: false, isError: false, refetch: vi.fn() };
  growth.push = vi.fn();
});
afterEach(cleanup);

describe("LearningRoadmap — trigger (unchanged)", () => {
  it("is a circular map button fixed to the bottom-right, closed by default", () => {
    renderMap(["a1", "a2"]);
    const btn = screen.getByRole("button", { name: "Learning roadmap: 1 of 3 levels completed" }) as HTMLButtonElement;
    const classes = btn.className.split(" ");
    for (const c of ["fixed", "w-12", "h-12", "rounded-full", "tbt-roadmap-fab"]) expect(classes).toContain(c);
    const css = document.querySelector("style")!.textContent!;
    expect(css).toContain("right: calc(1rem + env(safe-area-inset-right, 0px));");
    expect(css).toContain("bottom: calc(var(--tbt-roadmap-fab-offset, 1rem) + env(safe-area-inset-bottom, 0px));");
    expect(btn.style.left).toBe("");
    expect(btn.querySelector("svg")).toBeTruthy();
    expect(btn.getAttribute("title")).toBe("Learning Roadmap");
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("glows only while closed; animations are off for reduced motion and CSS stays scoped", () => {
    renderMap();
    expect(trigger().getAttribute("data-glow")).toBe("true");
    const css = document.querySelector("style")!.textContent!;
    expect(css).toContain('.tbt-roadmap-fab[data-glow="true"] { animation: none; }');
    expect(css).toContain(".tbt-roadmap-node-current { animation: none; }");
    expect(css.indexOf("prefers-reduced-motion")).toBeLessThan(css.indexOf('.tbt-roadmap-fab[data-glow="true"] { animation: none; }'));
    expect(css).not.toMatch(/(^|\})\s*(button|div|\*|body)\s*\{/);
    openPopup();
    expect(trigger().getAttribute("data-glow")).toBe("false");
  });

  it("moves above the podcast mini-player when it is showing", () => {
    player.episode = { id: "ep1" };
    renderMap();
    expect((trigger() as HTMLButtonElement).style.getPropertyValue("--tbt-roadmap-fab-offset")).toBe("6rem");
  });
});

describe("LearningRoadmap — popup", () => {
  it("opens a modal popup (not a side panel) with heading, course, progress and legend", () => {
    renderMap(["a1", "a2"]);
    openPopup();
    const d = dialog();
    expect(d.getAttribute("aria-modal")).toBe("true");
    expect(d.parentElement!.parentElement).toBe(document.body); // portalled overlay
    expect(within(d).getByRole("heading", { name: /Learning Roadmap/ })).toBeTruthy();
    expect(d.textContent).toContain("Growth Accelerator");
    expect(d.textContent).toContain("1 of 3 levels completed");
    expect(within(d).getByRole("progressbar").getAttribute("aria-valuenow")).toBe("1");
    const legend = within(d).getByRole("list", { name: "Legend" }).textContent!;
    expect(legend).toContain("Completed");
    expect(legend).toContain("Current / unlocked");
    expect(legend).toContain("Locked");
  });

  it("closes with the close button, Escape and a backdrop click, returning focus to the trigger", () => {
    renderMap();
    openPopup();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close roadmap" }));
    fireEvent.click(screen.getByRole("button", { name: "Close roadmap" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger());

    openPopup();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();

    openPopup();
    fireEvent.mouseDown(dialog().parentElement!);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("locks page scroll while open and restores it on close", () => {
    renderMap();
    openPopup();
    expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(document.body.style.overflow).toBe("");
  });

  it("keeps Tab focus inside the popup", () => {
    renderMap();
    openPopup();
    const focusables = [...dialog().querySelectorAll<HTMLElement>("button:not([disabled])")];
    focusables[focusables.length - 1].focus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(document.activeElement).toBe(focusables[0]);
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(focusables[focusables.length - 1]);
  });
});

describe("LearningRoadmap — Growth milestones tab", () => {
  const LABELS = ["Ads", "Website", "Funnels", "1 lakh", "1 crore"];
  const graph = (reached: boolean[] = [], over: Record<string, any> = {}) => ({
    totalDays: 28, currentDay: 10, currentWeek: 2, hasActivities: true,
    weeks: [{ weekNumber: 1, progressLevel: 3, completionPercent: 100 }],
    summary: { total: 0, completed: 0, completionPercent: null },
    config: {
      source: "program",
      milestones: LABELS.map((label, i) => ({
        id: `m${i + 1}`, label, kind: i < 3 ? "activity" : "revenue",
        reached: !!reached[i], dayNumber: i === 0 ? 3 : i === 1 ? 9 : null, ...over,
      })),
    },
  });
  const milestone = (n: number) =>
    within(dialog()).getAllByRole("button").find((b) => (b.getAttribute("aria-label") ?? "").startsWith(`Milestone ${n}:`))!;
  const mStates = () => [1, 2, 3, 4, 5].map((n) => milestone(n).getAttribute("data-level-state"));

  it('shows only the "Growth milestones" tab — no "This course" tab; the header is unchanged', () => {
    growth.query.data = graph();
    renderMap(["a1", "a2"]);
    openGrowth();
    expect(within(dialog()).getAllByRole("tab").map((t) => t.textContent)).toEqual(["Growth milestones"]);
    expect(tab("Growth milestones").getAttribute("aria-selected")).toBe("true");
    expect(within(dialog()).queryByRole("tab", { name: "This course" })).toBeNull();
    expect(dialog().textContent).not.toContain("This course");
    expect(within(dialog()).getByRole("heading", { name: /Learning Roadmap/ })).toBeTruthy();
    expect(dialog().textContent).toContain("1 of 3 levels completed"); // header still shows course progress
  });

  it("shows all five milestones in configured order on the winding path, with Start and Finish", () => {
    growth.query.data = graph();
    renderMap();
    openGrowth();
    const list = within(dialog()).getByRole("list", { name: "Growth milestones" });
    expect(list.querySelectorAll("button[data-level-state]")).toHaveLength(5);
    LABELS.forEach((label, i) => {
      expect(milestone(i + 1).getAttribute("aria-label")).toContain(`Milestone ${i + 1}: ${label} —`);
      expect(milestone(i + 1).style.left).toBe(`calc(${levelPoint(i).x}% - 30px)`);
    });
    expect(dialog().querySelectorAll("svg[data-roadmap-path] path[data-road-state]")).toHaveLength(4);
    expect(dialog().textContent).toContain("Start");
    expect(dialog().textContent).toContain("Finish");
    expect(dialog().textContent).toContain("0 of 5 milestones reached");
  });

  it("only milestone 1 is open at first, even when the week graph plots high; locked ones don't navigate", () => {
    growth.query.data = graph();
    renderMap();
    openGrowth();
    expect(mStates()).toEqual(["current", "locked", "locked", "locked", "locked"]);
    for (const n of [2, 3, 4, 5]) {
      expect(milestone(n).getAttribute("aria-disabled")).toBe("true");
      fireEvent.click(milestone(n));
    }
    expect(growth.push).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeTruthy();
  });

  it("an open activity milestone opens its linked batch-program day and closes the popup", () => {
    growth.query.data = graph([true]);
    renderMap();
    openGrowth();
    expect(mStates()).toEqual(["completed", "current", "locked", "locked", "locked"]);
    fireEvent.click(milestone(2));
    expect(growth.push).toHaveBeenCalledWith("/batch-program/9");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("with no linked task, an open activity milestone opens the batch program", () => {
    growth.query.data = graph([true, true]);
    renderMap();
    openGrowth();
    fireEvent.click(milestone(3));
    expect(growth.push).toHaveBeenCalledWith("/batch-program");
  });

  it("revenue milestones show status only — no destination even when open", () => {
    growth.query.data = graph([true, true, true]);
    renderMap();
    openGrowth();
    expect(milestone(4).getAttribute("data-level-state")).toBe("current");
    expect(milestone(4).getAttribute("aria-disabled")).toBe("true");
    expect(milestone(4).getAttribute("aria-label")).toContain("achievement status only");
    expect(dialog().textContent).toContain("Recorded by your mentor when achieved");
    fireEvent.click(milestone(4));
    expect(growth.push).not.toHaveBeenCalled();
  });

  it("unsaved program settings: revenue milestones say they are not set up, never reached", () => {
    growth.query.data = graph([true, true, true], { id: null });
    renderMap();
    openGrowth();
    expect(dialog().textContent).toContain("Not set up for your program yet");
    expect(milestone(4).getAttribute("data-level-state")).not.toBe("completed");
  });

  it("not in a batch: the six default milestones, all locked, with a join message", () => {
    const DEFAULT_LABELS = ["Ads", "Website", "Funnels", "1 lakh", "5 Lakhs", "1 crore"];
    growth.query.data = null;
    renderMap(["a1"]);
    openGrowth();
    expect(dialog().textContent).toContain("Join a batch program to unlock");
    expect(DEFAULT_LABELS.map((_, i) => milestone(i + 1).getAttribute("data-level-state"))).toEqual(DEFAULT_LABELS.map(() => "locked"));
    DEFAULT_LABELS.forEach((label, i) => expect(milestone(i + 1).getAttribute("aria-label")).toContain(label));
  });

  it("loading and error (with retry) states", () => {
    growth.query = { data: undefined, isLoading: true, isError: false, refetch: vi.fn() };
    renderMap();
    openGrowth();
    expect(dialog().querySelector('[aria-busy="true"]')).toBeTruthy();
    cleanup();
    const refetch = vi.fn();
    growth.query = { data: undefined, isLoading: false, isError: true, refetch };
    renderMap();
    openGrowth();
    fireEvent.click(within(dialog()).getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalled();
  });

});
