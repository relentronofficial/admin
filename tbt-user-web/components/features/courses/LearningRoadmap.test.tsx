import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import LearningRoadmap, { levelPoint, roadSegment } from "./LearningRoadmap";
import { buildRoadmapLevels } from "@/lib/utils/roadmapLevels";
import { buildSectionGroups } from "@/lib/utils/sectionProgress";

const player = vi.hoisted(() => ({ episode: null as any }));
vi.mock("@/lib/stores/usePodcastPlayer", () => ({
  usePodcastPlayer: (sel: (s: any) => any) => sel(player),
}));

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
const openPopup = () => fireEvent.click(trigger());
const dialog = () => screen.getByRole("dialog", { name: "Learning Roadmap" });
const level = (n: number) => within(dialog()).getAllByRole("button").find((b) => (b.getAttribute("aria-label") ?? "").startsWith(`Level ${n}:`))!;

beforeEach(() => {
  onOpen = vi.fn<(lesson: any) => void>();
  player.episode = null;
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

describe("LearningRoadmap — winding level map", () => {
  it("renders one round node per level, in order, alternating left and right lanes", () => {
    renderMap();
    openPopup();
    const nodes = [1, 2, 3].map(level);
    nodes.forEach((n) => expect(n.className.split(" ")).toContain("rounded-full"));
    expect(nodes.map((n) => n.style.left)).toEqual([0, 1, 2].map((i) => `calc(${levelPoint(i).x}% - 30px)`));
    expect(levelPoint(0).x).toBeLessThan(50);
    expect(levelPoint(1).x).toBeGreaterThan(50);
    expect(levelPoint(2).x).toBeLessThan(50);
    expect(level(1).getAttribute("aria-label")).toMatch(/^Level 1: Foundations/);
    expect(level(3).getAttribute("aria-label")).toMatch(/^Level 3: Scale/);
  });

  it("draws a smooth S-curve road that always runs downward (no loops)", () => {
    renderMap();
    openPopup();
    const road = dialog().querySelectorAll("svg[data-roadmap-path] path[data-road-state]");
    expect(road).toHaveLength(2); // n levels → n-1 connectors
    for (let i = 0; i < 2; i++) {
      expect(road[i].getAttribute("d")).toBe(roadSegment(i));
      expect(road[i].getAttribute("d")).toMatch(/^M [\d.]+ [\d.]+ C /);
      expect(levelPoint(i + 1).y).toBeGreaterThan(levelPoint(i).y);
    }
  });

  it("marks the current level", () => {
    renderMap(["a1", "a2"]);
    openPopup();
    expect(level(2).getAttribute("aria-current")).toBe("step");
    expect(level(2).className).toContain("tbt-roadmap-node-current");
    expect(dialog().textContent).toContain("You are here");
  });

  it("only Level 1 is open initially; later levels are locked", () => {
    renderMap();
    openPopup();
    expect(level(1).getAttribute("data-level-state")).toBe("current");
    for (const n of [2, 3]) {
      expect(level(n).getAttribute("data-level-state")).toBe("locked");
      expect(level(n).getAttribute("aria-disabled")).toBe("true");
    }
  });

  it("clicking an open level navigates to its next lesson and closes the popup", () => {
    renderMap(["a1"]);
    openPopup();
    fireEvent.click(level(1));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen.mock.calls[0][0].id).toBe("a2");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("clicking a locked level does nothing", () => {
    renderMap();
    openPopup();
    fireEvent.click(level(3));
    expect(onOpen).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeTruthy();
  });

  it("completed levels show as completed; finishing a level unlocks the next", () => {
    renderMap(["a1", "a2"]);
    openPopup();
    expect(level(1).getAttribute("data-level-state")).toBe("completed");
    expect(level(2).getAttribute("data-level-state")).toBe("current");
    expect(level(3).getAttribute("data-level-state")).toBe("locked");
  });
});

describe("LearningRoadmap — states", () => {
  it("shows a loading state", () => {
    render(<LearningRoadmap levels={[]} onOpenLesson={onOpen} status="loading" />);
    openPopup();
    expect(dialog().querySelector('[aria-busy="true"]')).toBeTruthy();
  });

  it("shows an error state with retry", () => {
    const retry = vi.fn();
    render(<LearningRoadmap levels={[]} onOpenLesson={onOpen} status="error" onRetry={retry} />);
    openPopup();
    expect(dialog().textContent).toContain("Couldn't load your roadmap.");
    fireEvent.click(within(dialog()).getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalled();
  });

  it("shows an empty state for a course without levels", () => {
    render(<LearningRoadmap levels={[]} onOpenLesson={onOpen} />);
    openPopup();
    expect(dialog().textContent).toContain("No levels yet");
  });
});

describe("LearningRoadmap — all configured levels (Ads → 1 Crore)", () => {
  const MILESTONES = ["Ads", "Website", "Funnels", "1 Lakh", "1 Crore"];
  const msSections = MILESTONES.map((title, i) => ({ id: `m${i + 1}`, title, sortOrder: i + 1 }));
  // Two lessons per chapter, in course order; server sequential lock as in production.
  const msOrder = MILESTONES.flatMap((_, i) => [`m${i + 1}a`, `m${i + 1}b`]);
  const msLevels = (completed: string[], withLessons = MILESTONES.length) => {
    const lessons = msOrder
      .filter((id) => Number(id.slice(1, -1)) <= withLessons)
      .map((id, i, all) => ({
        id,
        title: `Lesson ${id}`,
        sectionId: `m${id.slice(1, -1)}`,
        locked: all.slice(0, i).some((p) => !completed.includes(p)),
      }));
    return buildRoadmapLevels(buildSectionGroups(lessons, msSections, completed), completed, msSections);
  };
  const renderMs = (completed: string[], withLessons?: number) =>
    render(<LearningRoadmap levels={msLevels(completed, withLessons)} onOpenLesson={onOpen} title="Growth Path" />);
  const states = () => [1, 2, 3, 4, 5].map((n) => level(n).getAttribute("data-level-state"));

  it("renders all five named levels in order, then the Finish marker — locked ones included", () => {
    renderMs([]);
    openPopup();
    const nodes = [...dialog().querySelectorAll("button[data-level-state]")];
    expect(nodes).toHaveLength(5);
    MILESTONES.forEach((name, i) => expect(level(i + 1).getAttribute("aria-label")).toContain(`Level ${i + 1}: ${name} —`));
    const text = dialog().textContent!;
    for (const name of MILESTONES) expect(text).toContain(name);
    expect(text.indexOf("1 Crore")).toBeLessThan(text.lastIndexOf("Finish"));
    expect(text).toContain("Start");
    expect(states()).toEqual(["current", "locked", "locked", "locked", "locked"]);
  });

  it("locked levels are visible but not clickable", () => {
    renderMs([]);
    openPopup();
    for (const n of [2, 3, 4, 5]) {
      expect(level(n).getAttribute("aria-disabled")).toBe("true");
      expect(level(n).textContent).toBe(""); // lock icon, no number
      fireEvent.click(level(n));
    }
    expect(onOpen).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeTruthy();
  });

  it("completing a level (all its lessons) unlocks only the next one; a started level does not", () => {
    renderMs(["m1a"]); // Ads opened/half done → still current
    openPopup();
    expect(states()).toEqual(["current", "locked", "locked", "locked", "locked"]);
    cleanup();
    renderMs(["m1a", "m1b"]); // Ads completed
    openPopup();
    expect(states()).toEqual(["completed", "current", "locked", "locked", "locked"]);
    fireEvent.click(level(2));
    expect(onOpen.mock.calls[0][0].id).toBe("m2a");
    cleanup();
    renderMs(["m1a", "m1b", "m2a", "m2b"]); // Website completed
    openPopup();
    expect(states()).toEqual(["completed", "completed", "current", "locked", "locked"]);
    expect(dialog().textContent).toContain("2 of 5 levels completed");
  });

  it("chapters with no lessons yet still show, as locked levels", () => {
    renderMs(["m1a", "m1b"], 1); // only Ads has lessons, and it is done
    openPopup();
    expect(states()).toEqual(["completed", "locked", "locked", "locked", "locked"]);
    expect(level(2).getAttribute("aria-label")).toContain("no lessons yet");
    expect(dialog().textContent).toContain("No lessons yet");
    fireEvent.click(level(2));
    expect(onOpen).not.toHaveBeenCalled();
  });
});
