import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import SupportCallPanel from "./SupportCallPanel";
import type { SupportCallSession, SupportCallsView } from "@/lib/api/services/supportCalls.service";

const NOW = Date.parse("2026-10-20T04:30:00Z"); // Tue 20 Oct 2026, 10:00 IST

const state: {
  calls: { data?: SupportCallsView; isLoading: boolean; isError: boolean; isFetching: boolean; refetch: ReturnType<typeof vi.fn> };
  book: { mutateAsync: ReturnType<typeof vi.fn>; isPending: boolean };
  cancel: { mutateAsync: ReturnType<typeof vi.fn>; isPending: boolean };
  join: { mutateAsync: ReturnType<typeof vi.fn>; isPending: boolean };
  categories: string[];
} = {} as any;

vi.mock("@/lib/api/client", () => ({ getServerNow: () => NOW }));
vi.mock("react-hot-toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/hooks/useSupportCalls", () => ({
  useSupportCalls: (category: string) => {
    state.categories.push(category);
    return state.calls;
  },
  useBookSupportCall: () => state.book,
  useCancelSupportCallBooking: () => state.cancel,
  useJoinSupportCall: () => state.join,
}));

const session = (over: Partial<SupportCallSession>): SupportCallSession => ({
  id: "s",
  title: "Pricing clinic",
  description: "Bring your pricing questions.",
  hostName: "Coach K",
  startsAt: "2026-10-22T10:30:00Z",
  durationMinutes: 45,
  capacity: 1,
  seatsLeft: 1,
  myBooking: null,
  ...over,
});

function view(sessions: SupportCallSession[], quota = { allocated: 5, used: 1, reserved: 0, remaining: 4 }): SupportCallsView {
  return { category: "sales_support", quota, sessions, history: [] };
}

const SESSIONS = [
  session({ id: "thu-4pm", startsAt: "2026-10-22T10:30:00Z" }), // Thu 22, 4:00 PM IST
  session({ id: "thu-6pm", startsAt: "2026-10-22T12:30:00Z", seatsLeft: 0 }), // full
  session({ id: "fri-11am", startsAt: "2026-10-23T05:30:00Z", durationMinutes: 60, capacity: 5, seatsLeft: 3, title: "Group review" }),
];

function renderPanel(label = "☎ Sales Calls", category: any = "sales_support") {
  return render(<SupportCallPanel category={category} label={label} onClose={vi.fn()} />);
}
const dialog = () => screen.getByRole("dialog");
const dayButton = (day: number) =>
  within(screen.getByRole("grid", { name: "Choose a date" })).getAllByRole("button").find((b) => b.textContent === String(day))!;
const slotButtons = () => within(screen.getByRole("group", { name: "Available time slots" })).getAllByRole("button");

beforeEach(() => {
  state.calls = { data: view(SESSIONS), isLoading: false, isError: false, isFetching: false, refetch: vi.fn() };
  state.book = { mutateAsync: vi.fn().mockResolvedValue({ id: "b1", status: "booked" }), isPending: false };
  state.cancel = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false };
  state.join = { mutateAsync: vi.fn().mockResolvedValue("https://meet.example.test/x"), isPending: false };
  state.categories = [];
});
afterEach(cleanup);

describe("SupportCallPanel — slot booking", () => {
  it.each([
    ["☎ Sales Calls", "sales_support"],
    ["⚙ Tech Calls", "tech_support"],
    ["▶ Content Calls", "content_support"],
    ["📢 Marketing Calls", "ad_support"],
    ["♟ Mentor 1-On-1", "one_to_one"],
    ["👥 Live Group Q&A", "group_call"],
  ])("%s loads its own category", (label, category) => {
    renderPanel(label, category);
    expect(within(dialog()).getByRole("heading", { level: 2 }).textContent).toBe(label);
    expect(state.categories.every((c) => c === category)).toBe(true);
  });

  it("only dates with bookable slots are selectable; past dates are disabled", () => {
    renderPanel();
    expect((dayButton(22) as HTMLButtonElement).disabled).toBe(false);
    expect((dayButton(23) as HTMLButtonElement).disabled).toBe(false);
    expect((dayButton(24) as HTMLButtonElement).disabled).toBe(true); // nothing published
    expect((dayButton(19) as HTMLButtonElement).disabled).toBe(true); // past
    expect(dayButton(19).getAttribute("data-day-state")).toBe("past");
    expect(dayButton(22).getAttribute("data-day-state")).toBe("selected"); // first open date auto-selected
  });

  it("shows the selected date's real slots with start–end times and states", () => {
    renderPanel();
    const slots = slotButtons();
    expect(slots).toHaveLength(2);
    expect(slots[0].textContent).toMatch(/4:00\s*pm\s*–\s*4:45\s*pm/i);
    expect((slots[0] as HTMLButtonElement).disabled).toBe(false);
    expect(slots[1].textContent).toMatch(/Full/);
    expect((slots[1] as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(dayButton(23));
    const fri = slotButtons();
    expect(fri).toHaveLength(1);
    expect(fri[0].textContent).toMatch(/11:00\s*am\s*–\s*12:00\s*pm/i);
    expect(fri[0].textContent).toMatch(/3 of 5 seats left/);
  });

  it("selecting a slot shows the summary and Confirm Booking books it through the API", async () => {
    renderPanel();
    fireEvent.click(slotButtons()[0]);
    expect(slotButtons()[0].getAttribute("data-slot-state")).toBe("selected");
    const summary = screen.getByText("Booking summary").parentElement!;
    expect(summary.textContent).toMatch(/☎ Sales Calls/);
    expect(summary.textContent).toMatch(/Thursday, 22 October 2026/);
    expect(summary.textContent).toMatch(/4:00\s*pm\s*–\s*4:45\s*pm IST \(45 min\)/i);
    expect(summary.textContent).toMatch(/Coach K/);
    fireEvent.click(screen.getByRole("button", { name: /Confirm Booking/ }));
    await waitFor(() => expect(state.book.mutateAsync).toHaveBeenCalledWith("thu-4pm"));
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/Booked!/));
  });

  it("shows the server's reason when a booking is rejected (e.g. slot just filled)", async () => {
    state.book.mutateAsync.mockRejectedValueOnce(new Error("This session is full."));
    renderPanel();
    fireEvent.click(slotButtons()[0]);
    fireEvent.click(screen.getByRole("button", { name: /Confirm Booking/ }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("This session is full."));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("disables Confirm while the booking request is in flight (no double submit)", () => {
    state.book.isPending = true;
    renderPanel();
    fireEvent.click(slotButtons()[0]);
    const confirm = screen.getByRole("button", { name: /Confirm Booking/ });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(confirm);
    expect(state.book.mutateAsync).not.toHaveBeenCalled();
  });

  it("lists my bookings with Cancel and shows Join only when the server allows it", () => {
    state.calls.data = view([
      session({ id: "mine", myBooking: { id: "b1", status: "booked", canCancel: true, canJoin: false, joinMessage: "The join link opens 10 minutes before the call." } }),
      session({ id: "live", startsAt: "2026-10-20T04:25:00Z", myBooking: { id: "b2", status: "booked", canCancel: false, canJoin: true, joinMessage: null } }),
    ], { allocated: 5, used: 1, reserved: 2, remaining: 2 });
    renderPanel();
    expect(screen.getByText("📅 2 Booked")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Cancel booking" })).toBeTruthy();
    expect(screen.getByText("The join link opens 10 minutes before the call.")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /Join call/ })).toHaveLength(1);
    expect(screen.getByText("● Live now")).toBeTruthy();
  });

  it("cancel asks for confirmation, then calls the API", async () => {
    state.calls.data = view([session({ id: "mine", myBooking: { id: "b1", status: "booked", canCancel: true, canJoin: false, joinMessage: null } })]);
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: "Cancel booking" }));
    fireEvent.click(screen.getByRole("button", { name: /Yes, cancel/ }));
    await waitFor(() => expect(state.cancel.mutateAsync).toHaveBeenCalledWith("b1"));
  });

  it("explains the cancellation cutoff when cancelling is no longer allowed", () => {
    state.calls.data = view([session({ id: "mine", myBooking: { id: "b1", status: "booked", canCancel: false, canJoin: false, joinMessage: null } })]);
    renderPanel();
    expect(screen.queryByRole("button", { name: "Cancel booking" })).toBeNull();
    expect(screen.getByText("Cancellation closes 2 hours before the call.")).toBeTruthy();
  });

  it("with no published slots, keeps the calendar and shows a helpful message", () => {
    state.calls.data = view([]);
    renderPanel();
    expect(screen.getByRole("grid", { name: "Choose a date" })).toBeTruthy();
    expect(within(screen.getByRole("grid", { name: "Choose a date" })).getAllByRole("button").every((b) => (b as HTMLButtonElement).disabled)).toBe(true);
    expect(screen.getByText("No available slots right now. Please check again later.")).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Available time slots" })).toBeNull();
  });

  it("a 0/0 category cannot be booked", () => {
    state.calls.data = view(SESSIONS, { allocated: 0, used: 0, reserved: 0, remaining: 0 });
    renderPanel("♟ Mentor 1-On-1", "one_to_one");
    expect(screen.getAllByText("Not included in your plan").length).toBeGreaterThan(0);
    expect((dayButton(22) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: /Confirm Booking/ })).toBeNull();
  });

  it("a 0/0 category says 'not included' even when no slots are open", () => {
    state.calls.data = view([], { allocated: 0, used: 0, reserved: 0, remaining: 0 });
    renderPanel("♟ Mentor 1-On-1", "one_to_one");
    expect(screen.getByText("This call type isn't included in your plan.")).toBeTruthy();
    expect(screen.queryByText("No available slots right now. Please check again later.")).toBeNull();
  });

  it("no remaining quota blocks new bookings", () => {
    state.calls.data = view(SESSIONS, { allocated: 2, used: 1, reserved: 1, remaining: 0 });
    renderPanel();
    expect(screen.getByText("You have no calls left to book in this category.")).toBeTruthy();
    expect((dayButton(22) as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows a loading state", () => {
    state.calls = { ...state.calls, data: undefined, isLoading: true };
    renderPanel();
    expect(dialog().querySelector('[aria-busy="true"]')).toBeTruthy();
  });

  it("shows an error state with Retry", () => {
    state.calls = { ...state.calls, data: undefined, isError: true };
    renderPanel();
    expect(screen.getByText("Couldn't load available slots.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(state.calls.refetch).toHaveBeenCalled();
  });
});
