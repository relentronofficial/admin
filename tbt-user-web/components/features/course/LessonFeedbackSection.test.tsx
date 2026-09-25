import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LessonFeedbackSection } from "./LessonFeedbackSection";

// Isolates the component's own state/effect logic from the real mutation
// hook (network + TanStack Query internals) — this test targets the prefill
// race condition, not the save request itself.
const mutateMock = vi.fn();
vi.mock("@/lib/hooks/useCourses", () => ({
  useSaveLessonFeedback: () => ({ mutate: mutateMock, isPending: false }),
}));
vi.mock("@/lib/hooks/useCourseReports", () => ({
  useSubmitEpisodeFeedback: () => ({ mutate: vi.fn(), isPending: false }),
}));

const PLACEHOLDER = "Share your feedback about this video...";

function getTextarea() {
  return screen.getByPlaceholderText(PLACEHOLDER) as HTMLTextAreaElement;
}

describe("LessonFeedbackSection — prefill race condition", () => {
  beforeEach(() => {
    mutateMock.mockReset();
  });

  it("does NOT overwrite in-progress user input when saved feedback arrives late", async () => {
    const user = userEvent.setup();

    // 1-3: mounts while the member's saved feedback is still loading/unavailable.
    const { rerender } = render(
      <LessonFeedbackSection lessonId="lesson-1" courseId="course-1" existing={undefined} />
    );
    expect(screen.getByText("Submit Feedback")).toBeTruthy();

    // 4: the user starts editing before the fetch resolves.
    await user.type(getTextarea(), "My own opinion");
    await user.click(screen.getByLabelText("Rate 7 out of 10"));
    expect(getTextarea().value).toBe("My own opinion");
    expect(screen.getByText("7/10")).toBeTruthy();

    // 5: the member's previously-saved feedback for this lesson arrives late
    // (simulates the `useLessonFeedback` query resolving after this
    // component already mounted and the user already started typing).
    rerender(
      <LessonFeedbackSection
        lessonId="lesson-1"
        courseId="course-1"
        existing={{ rating: 3, feedbackText: "Old saved feedback", liked: true }}
      />
    );

    // 6: the late-arriving data must NOT clobber what the user already typed/selected.
    expect(getTextarea().value).toBe("My own opinion");
    expect(screen.getByText("7/10")).toBeTruthy();
    expect(screen.queryByText("3/10")).toBeNull();
    // still neither liked nor disliked — user never touched it
    expect(screen.getByLabelText("Like this lesson").getAttribute("aria-pressed")).toBe("false");
  });

  it("prefills correctly when existing feedback is present from the very first render", () => {
    render(
      <LessonFeedbackSection
        lessonId="lesson-2"
        courseId="course-1"
        existing={{ rating: 5, feedbackText: "Great lesson", liked: true }}
      />
    );

    expect(getTextarea().value).toBe("Great lesson");
    expect(screen.getByText("5/10")).toBeTruthy();
    expect(screen.getByLabelText("Like this lesson").getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText("Update Feedback")).toBeTruthy();
  });

  it("prefills correctly when existing feedback arrives late and the user has NOT edited yet", () => {
    // 7 (second half): the exact scenario the bug broke — a cold page
    // load/refresh where the fetch resolves after mount, but the user
    // hasn't touched the form. Without the fix (effect keyed only to
    // `lessonId`, which never changes here), this would still show an
    // empty form after `existing` arrives.
    const { rerender } = render(
      <LessonFeedbackSection lessonId="lesson-3" courseId="course-1" existing={undefined} />
    );
    expect(getTextarea().value).toBe("");

    rerender(
      <LessonFeedbackSection
        lessonId="lesson-3"
        courseId="course-1"
        existing={{ rating: 9, feedbackText: "Loved it", liked: false }}
      />
    );

    expect(getTextarea().value).toBe("Loved it");
    expect(screen.getByText("9/10")).toBeTruthy();
    expect(screen.getByText("Update Feedback")).toBeTruthy();
  });
});
