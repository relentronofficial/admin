import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent, cleanup } from "@testing-library/react";

let me: any = { id: "m1", status: "active" };
let params = new URLSearchParams();
vi.mock("@/lib/hooks/useUser", () => ({ useMe: () => ({ data: me }) }));
vi.mock("@/lib/context/SiteConfigContext", () => ({ useSiteConfig: () => ({ uiStrings: {} }) }));
vi.mock("next/navigation", () => ({ useSearchParams: () => params }));
vi.mock("@/lib/ads/useRegisterMedia", () => ({ useSuppressAds: () => {} }));

import { OnboardingTour, START_TOUR_EVENT } from "./OnboardingTour";

/** Adds a visible navbar target (jsdom has no layout, so give it a size). */
function addTarget(name: string) {
  const el = document.createElement("div");
  el.setAttribute("data-tour", name);
  el.getBoundingClientRect = () => ({ left: 10, top: 10, width: 40, height: 30, right: 50, bottom: 40, x: 10, y: 10, toJSON() {} }) as DOMRect;
  document.body.appendChild(el);
}

const stepLabel = () => screen.getByText(/Step \d+ \/ \d+/).textContent;

describe("OnboardingTour", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    me = { id: "m1", status: "active" };
    params = new URLSearchParams();
    document.querySelectorAll("[data-tour]").forEach((el) => el.remove());
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("auto-starts for an active member and only includes steps whose element is on screen", () => {
    ["notifications", "messages", "profile"].forEach(addTarget);
    render(<OnboardingTour />);
    act(() => { vi.advanceTimersByTime(1600); });
    // welcome + 3 visible targets + done
    expect(stepLabel()).toBe("Step 1 / 5");
    fireEvent.click(screen.getByText("Show me around"));
    expect(screen.getByText("Notifications")).toBeTruthy();
    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByText("Messages and groups")).toBeTruthy();
  });

  it("remembers completion per member and does not auto-start again", () => {
    render(<OnboardingTour />);
    act(() => { vi.advanceTimersByTime(1600); });
    fireEvent.click(screen.getByText("Skip tour", { selector: "button.text-sm" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(localStorage.getItem("tbt_tour_done_v1:m1")).toBeTruthy();
    cleanup();
    render(<OnboardingTour />);
    act(() => { vi.advanceTimersByTime(1600); });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does not auto-start for a pending member", () => {
    me = { id: "m1", status: "pending" };
    render(<OnboardingTour />);
    act(() => { vi.advanceTimersByTime(1600); });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("can be replayed with the start event, and forced with ?tour=1", () => {
    localStorage.setItem("tbt_tour_done_v1:m1", "x");
    render(<OnboardingTour />);
    act(() => { vi.advanceTimersByTime(1600); });
    expect(screen.queryByRole("dialog")).toBeNull();
    act(() => { window.dispatchEvent(new Event(START_TOUR_EVENT)); });
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();

    cleanup();
    params = new URLSearchParams("tour=1");
    render(<OnboardingTour />);
    act(() => { vi.advanceTimersByTime(1600); });
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("ends on the last step with Get started", () => {
    render(<OnboardingTour />);
    act(() => { vi.advanceTimersByTime(1600); });
    expect(stepLabel()).toBe("Step 1 / 2"); // no targets: welcome + done
    fireEvent.click(screen.getByText("Show me around"));
    fireEvent.click(screen.getByText("Get started"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
