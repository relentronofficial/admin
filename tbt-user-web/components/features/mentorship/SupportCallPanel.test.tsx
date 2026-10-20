import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import SupportCallPanel from "./SupportCallPanel";
import type { SupportCallCoinInfo, SupportCallSession, SupportCallsView } from "@/lib/api/services/supportCalls.service";
import { toast } from "react-hot-toast";

const NOW = Date.parse("2026-10-20T04:30:00Z"); // Tue 20 Oct 2026, 10:00 IST

const state: {
  calls: { data?: SupportCallsView; isLoading: boolean; isError: boolean; isFetching: boolean; refetch: ReturnType<typeof vi.fn> };
  book: { mutateAsync: ReturnType<typeof vi.fn>; isPending: boolean };
  cancel: { mutateAsync: ReturnType<typeof vi.fn>; isPending: boolean };
  join: { mutateAsync: ReturnType<typeof vi.fn>; isPending: boolean };
  categories: string[];
  packages: { data?: any; isLoading: boolean; isError: boolean; refetch: ReturnType<typeof vi.fn> };
  purchase: { state: any; busy: boolean; buy: ReturnType<typeof vi.fn>; reset: ReturnType<typeof vi.fn> };
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
vi.mock("@/lib/hooks/useCoins", () => ({
  useCoinPackages: () => state.packages,
  useCoinPurchase: () => state.purchase,
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

function view(
  sessions: SupportCallSession[],
  quota: SupportCallsView["quota"] = { allocated: 5, used: 1, reserved: 0, remaining: 4 },
  coin?: SupportCallCoinInfo,
): SupportCallsView {
  return { category: "sales_support", quota, sessions, history: [], coin };
}

const confirmation = (over: Record<string, unknown> = {}) => ({
  id: "b1a2c3d4-0000-4000-8000-000000000000", sessionId: "thu-4pm", status: "booked", bookedAt: "2026-10-20T04:30:00Z",
  category: "sales_support", title: "Pricing clinic", startsAt: "2026-10-22T10:30:00Z", durationMinutes: 45, hostName: "Coach K",
  paidWithCoins: false, coinsSpent: 0, coinBalance: null, ...over,
});

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
  state.book = { mutateAsync: vi.fn().mockResolvedValue(confirmation()), isPending: false };
  state.cancel = { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false };
  state.join = { mutateAsync: vi.fn().mockResolvedValue("https://meet.example.test/x"), isPending: false };
  state.categories = [];
  state.packages = {
    data: { packages: [{ id: "p1", label: "Starter", coins: 500, priceInr: 199 }, { id: "p2", label: "Pro", coins: 1200, priceInr: 399 }], purchaseAvailable: true },
    isLoading: false, isError: false, refetch: vi.fn(),
  };
  state.purchase = { state: { status: "idle" }, busy: false, buy: vi.fn(), reset: vi.fn() };
  vi.mocked(toast.success).mockClear();
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
    expect(summary.textContent).toMatch(/1 included call from your plan/);
    fireEvent.click(screen.getByRole("button", { name: /Confirm Booking/ }));
    await waitFor(() => expect(state.book.mutateAsync).toHaveBeenCalledWith({ sessionId: "thu-4pm" }));
    // The confirmation shows what the server committed: status, call, time, reference.
    const status = await screen.findByRole("status");
    expect(status.textContent).toMatch(/Booking confirmed/);
    expect(status.textContent).toMatch(/StatusBooked/);
    expect(status.textContent).toMatch(/Pricing clinic/);
    expect(status.textContent).toMatch(/4:00\s*pm\s*–\s*4:45\s*pm IST/i);
    expect(status.textContent).toMatch(/1 included call/);
    expect(status.textContent).toMatch(/B1A2C3D4/);
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

describe("SupportCallPanel — extra calls with TBT coins", () => {
  const exhausted = { allocated: 2, used: 1, reserved: 1, remaining: 0, included: 2, unlocked: 0 };
  const coin = (over: Partial<SupportCallCoinInfo> = {}): SupportCallCoinInfo => ({
    cost: 120, balance: 300, purchaseAvailable: true, action: "unlock_with_coins", lockedReason: null, ...over,
  });

  it("without a coin price, an exhausted category stays locked", () => {
    state.calls.data = view(SESSIONS, exhausted, coin({ cost: null, action: "locked", lockedReason: "quota_exhausted" }));
    renderPanel();
    expect(screen.getByText("You have no calls left to book in this category.")).toBeTruthy();
    expect(screen.queryByTestId("coin-unlock-banner")).toBeNull();
    expect((dayButton(22) as HTMLButtonElement).disabled).toBe(true);
  });

  it("a category not in the plan stays locked even with coins", () => {
    state.calls.data = view(SESSIONS, { allocated: 0, used: 0, reserved: 0, remaining: 0, included: 0, unlocked: 0 }, coin({ action: "locked", lockedReason: "not_included" }));
    renderPanel();
    expect(screen.queryByTestId("coin-unlock-banner")).toBeNull();
    expect((dayButton(22) as HTMLButtonElement).disabled).toBe(true);
  });

  it("with enough coins: shows the price, and books only after an explicit unlock confirmation at that price", async () => {
    state.calls.data = view(SESSIONS, exhausted, coin());
    state.book.mutateAsync.mockResolvedValueOnce(confirmation({ paidWithCoins: true, coinsSpent: 120, coinBalance: 180 }));
    renderPanel();
    expect(screen.getByTestId("coin-unlock-banner").textContent).toMatch(/120 TBT coins/);
    expect(state.book.mutateAsync).not.toHaveBeenCalled();
    fireEvent.click(slotButtons()[0]);
    const summary = screen.getByText("Booking summary").parentElement!;
    expect(summary.textContent).toMatch(/120 TBT coins \(extra call\)/);
    expect(summary.textContent).toMatch(/300 coins → 180 after booking/);
    expect(screen.queryByRole("button", { name: /Confirm Booking/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Unlock with 120 TBT Coins" }));
    await waitFor(() =>
      expect(state.book.mutateAsync).toHaveBeenCalledWith({ sessionId: "thu-4pm", payWithCoins: true, expectedCoinCost: 120 }),
    );
    const status = await screen.findByRole("status");
    expect(status.textContent).toMatch(/120 TBT coins · balance now 180/);
  });

  it("disables the unlock button while the request is in flight", () => {
    state.calls.data = view(SESSIONS, exhausted, coin());
    state.book.isPending = true;
    renderPanel();
    fireEvent.click(slotButtons()[0]);
    const btn = screen.getByRole("button", { name: /Unlock with 120 TBT Coins/ }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(state.book.mutateAsync).not.toHaveBeenCalled();
  });

  it("shows the server reason when the price changed or coins ran out", async () => {
    state.calls.data = view(SESSIONS, exhausted, coin());
    state.book.mutateAsync.mockRejectedValueOnce(new Error("The price for an extra call is now 150 TBT coins. Please review and confirm again."));
    renderPanel();
    fireEvent.click(slotButtons()[0]);
    fireEvent.click(screen.getByRole("button", { name: "Unlock with 120 TBT Coins" }));
    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/now 150 TBT coins/));
  });

  it("with too few coins: offers Purchase TBT Coins and never books or spends", () => {
    state.calls.data = view(SESSIONS, exhausted, coin({ balance: 50, action: "purchase_coins" }));
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /Purchase TBT Coins/ }));
    expect(screen.getByTestId("coin-purchase").textContent).toMatch(/You need 70 more coins/);
    fireEvent.click(slotButtons()[0]);
    // The confirm step shows the shortfall + purchase, not an unlock button.
    expect(screen.queryByRole("button", { name: /Unlock with/ })).toBeNull();
    const boxes = screen.getAllByTestId("coin-purchase");
    fireEvent.click(within(boxes[boxes.length - 1]).getByRole("radio", { name: /1,200 coins/ }));
    fireEvent.click(within(boxes[boxes.length - 1]).getByRole("button", { name: "Pay ₹399" }));
    expect(state.purchase.buy).toHaveBeenCalledWith({ id: "p2", label: "Pro", coins: 1200, priceInr: 399 });
    expect(state.book.mutateAsync).not.toHaveBeenCalled();
  });

  it.each([
    [{ status: "success", coinsAdded: 500, balance: 550 }, /500 TBT coins added.*New balance: 550.*Nothing has been booked or spent/],
    [{ status: "failed", message: "Card declined" }, /Payment failed: Card declined/],
    [{ status: "cancelled" }, /Payment cancelled. You were not charged./],
    [{ status: "pending", message: "Payment received. We're still confirming it." }, /still confirming/],
  ])("shows the real payment result (%o)", (purchaseState, text) => {
    state.calls.data = view(SESSIONS, exhausted, coin({ balance: 50, action: "purchase_coins" }));
    state.purchase.state = purchaseState;
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /Purchase TBT Coins/ }));
    expect(screen.getByTestId("coin-purchase").textContent).toMatch(text);
    expect(state.book.mutateAsync).not.toHaveBeenCalled();
  });

  it("blocks repeated purchase clicks while a payment is in progress", () => {
    state.calls.data = view(SESSIONS, exhausted, coin({ balance: 50, action: "purchase_coins" }));
    state.purchase = { ...state.purchase, state: { status: "working", step: "checkout" }, busy: true };
    renderPanel();
    fireEvent.click(screen.getByRole("button", { name: /Purchase TBT Coins/ }));
    const box = screen.getByTestId("coin-purchase");
    expect(box.textContent).toMatch(/Complete the payment in the Razorpay window/);
    const pay = within(box).getAllByRole("button").find((b) => /Pay|Choose/.test(b.textContent ?? "")) as HTMLButtonElement;
    expect(pay.disabled).toBe(true);
  });

  it("a paid booking shows its coins and says the refund on cancel", async () => {
    state.calls.data = view(
      [session({ id: "mine", myBooking: { id: "b9", status: "booked", coinCost: 120, canCancel: true, canJoin: false, joinMessage: null } })],
      { ...exhausted, unlocked: 1 },
      coin(),
    );
    state.cancel.mutateAsync.mockResolvedValueOnce({ id: "b9", status: "cancelled", coinsRefunded: 120 });
    renderPanel();
    expect(screen.getByText("🪙 1 unlocked with coins")).toBeTruthy();
    expect(screen.getAllByText("120 coins").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Cancel booking" }));
    expect(screen.getByText("Your 120 coins will be refunded.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Yes, cancel/ }));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Booking cancelled — 120 TBT coins refunded"));
  });

  it("call history marks completed, cancelled and refunded paid calls", () => {
    state.calls.data = {
      ...view([], exhausted, coin()),
      history: [
        { bookingId: "h1", title: "Done call", startsAt: "2026-10-10T10:30:00Z", durationMinutes: 45, status: "attended", coinCost: null },
        { bookingId: "h2", title: "Paid then cancelled", startsAt: "2026-10-11T10:30:00Z", durationMinutes: 45, status: "cancelled", coinCost: 120 },
        { bookingId: "h3", title: "Pending call", startsAt: "2026-10-25T10:30:00Z", durationMinutes: 45, status: "booked", coinCost: null },
      ],
    };
    renderPanel();
    const items = screen.getAllByRole("listitem").map((li) => li.textContent);
    expect(items[0]).toMatch(/Done call.*Completed/);
    expect(items[1]).toMatch(/120 coins refunded.*Cancelled/);
    expect(items[2]).toMatch(/Pending call.*Booked/);
  });
});
