import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import LearningError from "./error";

vi.mock("next/navigation", () => ({ useParams: () => ({ courseId: "c1" }) }));

function setup() {
  const qc = new QueryClient();
  const invalidate = vi.spyOn(qc, "invalidateQueries").mockResolvedValue(undefined);
  const reset = vi.fn();
  const err = Object.assign(new Error("boom"), { digest: "d123" });
  render(<QueryClientProvider client={qc}><LearningError error={err} reset={reset} /></QueryClientProvider>);
  return { invalidate, reset };
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("learning page error boundary", () => {
  it("logs the error and shows a lesson-level message, not a home redirect", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    setup();
    expect(screen.getByText("This lesson couldn't load")).toBeTruthy();
    expect(log).toHaveBeenCalledWith("[LearningError]", expect.objectContaining({ courseId: "c1", message: "boom", digest: "d123" }));
    expect(screen.getByRole("link", { name: "My courses" }).getAttribute("href")).toBe("/learning");
  });

  it("Try again refetches this course's data, then resets", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { invalidate, reset } = setup();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(reset).toHaveBeenCalledTimes(1));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["courses", "c1"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["user", "progress", "c1"] });
  });

  it("stops offering endless retries after two attempts", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { reset } = setup();
    for (let i = 1; i <= 2; i++) {
      fireEvent.click(screen.getByRole("button", { name: "Try again" }));
      await waitFor(() => expect(reset).toHaveBeenCalledTimes(i));
    }
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
    expect(screen.getByRole("button", { name: "Reload page" })).toBeTruthy();
  });
});
