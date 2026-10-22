import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import ModulesFaqButton from "./ModulesFaq";

const state: {
  faqs: { data?: Array<{ id: string; question: string; answer: string; category?: string | null }>; isLoading: boolean; isError: boolean; isFetching: boolean; refetch: ReturnType<typeof vi.fn> };
  enabledCalls: boolean[];
} = {} as any;

vi.mock("@/lib/context/SiteConfigContext", () => ({ useSiteConfig: () => ({ uiStrings: null }) }));
vi.mock("@/lib/hooks/useModuleFaqs", () => ({
  useModuleFaqs: (enabled: boolean) => {
    state.enabledCalls.push(enabled);
    return state.faqs;
  },
}));

const FAQS = [
  { id: "f1", question: "How do modules unlock?", answer: "Finish each lesson.\nThe next one unlocks automatically." },
  { id: "f2", question: "Can I rewatch a lesson?", answer: "Yes, any time." },
];

beforeEach(() => {
  state.faqs = { data: FAQS, isLoading: false, isError: false, isFetching: false, refetch: vi.fn() };
  state.enabledCalls = [];
});
afterEach(cleanup);

const open = () => {
  render(<ModulesFaqButton />);
  fireEvent.click(screen.getByRole("button", { name: /FAQ/ }));
  return screen.getByRole("dialog");
};

describe("ModulesFaqButton", () => {
  it("renders the FAQ button and does not fetch until it is opened", () => {
    render(<ModulesFaqButton />);
    expect(screen.getByRole("button", { name: /FAQ/ }).getAttribute("aria-haspopup")).toBe("dialog");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(state.enabledCalls).toEqual([]);
  });

  it("opens the FAQ with the published questions in server order, answers collapsed", () => {
    const dialog = open();
    const questions = within(dialog).getAllByRole("button", { expanded: false });
    expect(questions.map((b) => b.textContent)).toEqual(["How do modules unlock?", "Can I rewatch a lesson?"]);
    expect(within(dialog).queryByText(/Finish each lesson/)).toBeNull();
  });

  it("expands and collapses each answer independently, keeping line breaks", () => {
    const dialog = open();
    const q1 = within(dialog).getByRole("button", { name: "How do modules unlock?" });
    const q2 = within(dialog).getByRole("button", { name: "Can I rewatch a lesson?" });
    fireEvent.click(q1);
    expect(q1.getAttribute("aria-expanded")).toBe("true");
    const answer = within(dialog).getByRole("region", { name: "How do modules unlock?" });
    expect(answer.textContent).toBe("Finish each lesson.\nThe next one unlocks automatically.");
    expect(answer.className).toContain("whitespace-pre-line");
    fireEvent.click(q2);
    expect(within(dialog).getByText("Yes, any time.")).toBeTruthy();
    fireEvent.click(q1);
    expect(q1.getAttribute("aria-expanded")).toBe("false");
    expect(within(dialog).queryByText(/Finish each lesson/)).toBeNull();
    expect(within(dialog).getByText("Yes, any time.")).toBeTruthy();
  });

  it("renders answer text as text, never as HTML", () => {
    state.faqs.data = [{ id: "x", question: "Q?", answer: "<img src=x onerror=alert(1)>" }];
    const dialog = open();
    fireEvent.click(within(dialog).getByRole("button", { name: "Q?" }));
    expect(dialog.querySelector("img")).toBeNull();
    expect(within(dialog).getByText("<img src=x onerror=alert(1)>")).toBeTruthy();
  });

  it("shows a loading state", () => {
    state.faqs = { ...state.faqs, data: undefined, isLoading: true };
    const dialog = open();
    expect(dialog.querySelector('[aria-busy="true"]')).toBeTruthy();
  });

  it("shows an error state with Retry", () => {
    state.faqs = { ...state.faqs, data: undefined, isError: true };
    const dialog = open();
    expect(within(dialog).getByRole("alert").textContent).toMatch(/couldn't load the FAQs/);
    fireEvent.click(within(dialog).getByRole("button", { name: "Retry" }));
    expect(state.faqs.refetch).toHaveBeenCalled();
  });

  it("shows a helpful empty state when nothing is published", () => {
    state.faqs.data = [];
    const dialog = open();
    expect(within(dialog).getByText("No FAQs yet")).toBeTruthy();
    expect(within(dialog).queryAllByRole("button", { expanded: false })).toHaveLength(0);
  });

  it("closes with the close button and with Escape", () => {
    let dialog = open();
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /FAQ/ }));
    dialog = screen.getByRole("dialog");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("ModulesFaqButton — FAQ categories", () => {
  const sectionsOf = (dialog: HTMLElement) =>
    [...dialog.querySelectorAll("section[data-faq-section]")].map((sec) => ({
      key: sec.getAttribute("data-faq-section"),
      heading: sec.querySelector("h3")?.textContent,
      questions: [...sec.querySelectorAll("li button")].map((b) => b.textContent),
    }));

  it("groups FAQs under Ecommerce, Service and CoachX (in that order), with older ones under General", () => {
    state.faqs.data = [
      { id: "a", question: "Coaching calls?", answer: "x", category: "coachx" },
      { id: "b", question: "Store setup?", answer: "x", category: "ecommerce" },
      { id: "c", question: "Old question?", answer: "x", category: null },
      { id: "d", question: "Pricing a service?", answer: "x", category: "service" },
      { id: "e", question: "Payment gateway?", answer: "x", category: "ecommerce" },
    ];
    expect(sectionsOf(open())).toEqual([
      { key: "ecommerce", heading: "Ecommerce", questions: ["Store setup?", "Payment gateway?"] },
      { key: "service", heading: "Service", questions: ["Pricing a service?"] },
      { key: "coachx", heading: "CoachX", questions: ["Coaching calls?"] },
      { key: "general", heading: "General", questions: ["Old question?"] },
    ]);
  });

  it("hides empty sections", () => {
    state.faqs.data = [{ id: "a", question: "Only service?", answer: "x", category: "service" }];
    expect(sectionsOf(open()).map((s) => s.heading)).toEqual(["Service"]);
  });

  it("older FAQs without any category keep the original single list (no headings)", () => {
    const dialog = open(); // default FAQS have no category
    expect(dialog.querySelectorAll("section[data-faq-section]")).toHaveLength(0);
    expect(within(dialog).getAllByRole("button", { expanded: false }).map((b) => b.textContent)).toEqual(["How do modules unlock?", "Can I rewatch a lesson?"]);
  });

  it("an FAQ in a section still expands to its answer", () => {
    state.faqs.data = [{ id: "a", question: "Store setup?", answer: "Use the store builder.", category: "ecommerce" }];
    const dialog = open();
    fireEvent.click(within(dialog).getByRole("button", { name: "Store setup?" }));
    expect(within(dialog).getByText("Use the store builder.")).toBeTruthy();
  });
});
