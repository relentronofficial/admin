// Sample data for the /support-calls page (sessions list + Bookings modal,
// including coin-paid extra calls). Development only, never written anywhere.
//
// Enabled with NEXT_PUBLIC_SUPPORT_CALLS_DEMO=1 on `next dev`. The support-call
// hooks in useTbt.ts load this module through import() behind an inline
// NODE_ENV check, so a production build (Vercel) neither ships nor serves it,
// even if the variable is set there by mistake. Do not import it statically.
//
// Shapes mirror the backend DTOs in support-entitlements/controller.ts
// (adminSessionDto + listSupportSessionBookingsHandler). Session counters are
// derived from the bookings the same way the backend SQL does:
// activeBookings = status <> 'cancelled', pendingAttendance = status = 'booked'.
import type { SupportSession, SupportSessionBooking } from "@/lib/hooks/useTbt";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

type Member = { id: string; name: string; phone: string; email: string };
const MEMBERS: Member[] = [
  ["Karthik Subramanian", "karthik.subramanian"],
  ["Divya Krishnan", "divya.krishnan"],
  ["Arun Prakash", "arun.prakash"],
  ["Meena Lakshmi", "meena.lakshmi"],
  ["Senthil Kumar", "senthil.kumar"],
  ["Revathi Murugan", "revathi.murugan"],
  ["Vignesh Rajan", "vignesh.rajan"],
  ["Anitha Selvam", "anitha.selvam"],
  ["Prakash Natarajan", "prakash.natarajan"],
  ["Kavya Sundar", "kavya.sundar"],
  ["Harish Balaji", "harish.balaji"],
  ["Lavanya Iyer", "lavanya.iyer"],
].map(([name, handle], i) => ({
  id: `demo-member-${i + 1}`,
  name,
  phone: `+91 90000 ${String(10001 + i * 37).padStart(5, "0")}`,
  email: `${handle}@example.com`,
}));

type BookingSpec = {
  member: number;
  status: SupportSessionBooking["status"];
  bookedAgo: number; // ms before the session starts
  coinCost?: number;
  cancelledAgo?: number; // ms before now
};

type SessionSpec = Omit<SupportSession, "id" | "startsAt" | "hasMeetingUrl" | "activeBookings" | "pendingAttendance" | "seatsLeft"> & {
  id: string;
  startsIn: number; // ms from now (negative = in the past)
  bookings: BookingSpec[];
};

const SPECS: SessionSpec[] = [
  {
    id: "demo-session-live-qa",
    category: "group_call",
    title: "Live Group Q&A: Festive-season Meta Ads",
    description: "Bring your current ad account numbers. We review budgets, creatives and audiences for Diwali campaigns.",
    hostAdminId: null,
    hostName: "Priya Raman",
    startsIn: -15 * MIN,
    durationMinutes: 60,
    capacity: 25,
    status: "scheduled",
    meetingUrl: "https://meet.google.com/abc-defg-hij",
    bookings: [
      { member: 0, status: "booked", bookedAgo: 3 * DAY },
      { member: 1, status: "booked", bookedAgo: 2 * DAY, coinCost: 100 },
      { member: 2, status: "attended", bookedAgo: 2 * DAY },
      { member: 3, status: "cancelled", bookedAgo: 4 * DAY, cancelledAgo: 1 * DAY },
    ],
  },
  {
    id: "demo-session-1on1-funnel",
    category: "one_to_one",
    title: "Funnel teardown with your mentor",
    description: "A private 1:1 review of your landing page, lead magnet and follow-up sequence.",
    hostAdminId: null,
    hostName: "Ramesh Venkatesan",
    startsIn: 1 * DAY + 3 * HOUR,
    durationMinutes: 45,
    capacity: 1,
    status: "scheduled",
    meetingUrl: "https://zoom.us/j/9876543210",
    bookings: [{ member: 4, status: "booked", bookedAgo: 2 * DAY, coinCost: 250 }],
  },
  {
    id: "demo-session-tech-website",
    category: "tech_support",
    title: "Website and payment gateway setup clinic",
    description: "Domain, hosting, Razorpay checkout and WhatsApp button setup. Bring your login details.",
    hostAdminId: null,
    hostName: "Suresh Babu",
    startsIn: 3 * DAY + 2 * HOUR,
    durationMinutes: 40,
    capacity: 6,
    status: "scheduled",
    meetingUrl: null,
    bookings: [
      { member: 5, status: "booked", bookedAgo: 1 * DAY },
      { member: 6, status: "booked", bookedAgo: 20 * HOUR, coinCost: 120 },
    ],
  },
  {
    id: "demo-session-sales-objections",
    category: "sales_support",
    title: "Handling price objections on sales calls",
    description: "Role-play common objections from Tamil Nadu SME buyers and practise closing scripts.",
    hostAdminId: null,
    hostName: "Deepa Chandrasekar",
    startsIn: 5 * DAY + 5 * HOUR,
    durationMinutes: 45,
    capacity: 8,
    status: "scheduled",
    meetingUrl: "https://meet.google.com/klm-nopq-rst",
    bookings: [],
  },
  {
    id: "demo-session-1on1-cancelled",
    category: "one_to_one",
    title: "Pricing strategy 1:1 (rescheduled)",
    description: "Cancelled by the mentor. The member's paid booking was refunded in coins.",
    hostAdminId: null,
    hostName: "Ramesh Venkatesan",
    startsIn: 2 * DAY,
    durationMinutes: 30,
    capacity: 1,
    status: "cancelled",
    meetingUrl: "https://zoom.us/j/1234509876",
    bookings: [{ member: 7, status: "cancelled", bookedAgo: 3 * DAY, coinCost: 250, cancelledAgo: 6 * HOUR }],
  },
  {
    id: "demo-session-marketing-reels",
    category: "ad_support",
    title: "Reels that sell: hooks and calls to action",
    description: "Review of members' last three reels with fixes for the first 3 seconds and the CTA.",
    hostAdminId: null,
    hostName: "Priya Raman",
    startsIn: -1 * DAY,
    durationMinutes: 45,
    capacity: 12,
    status: "scheduled",
    meetingUrl: "https://meet.google.com/uvw-xyza-bcd",
    bookings: [
      { member: 8, status: "booked", bookedAgo: 2 * DAY },
      { member: 9, status: "booked", bookedAgo: 1 * DAY, coinCost: 100 },
      { member: 10, status: "attended", bookedAgo: 3 * DAY },
    ],
  },
  {
    id: "demo-session-content-calendar",
    category: "content_support",
    title: "Building a 30-day content calendar",
    description: "Plan a month of posts around offers, festivals and customer stories.",
    hostAdminId: null,
    hostName: "Nithya Shankar",
    startsIn: -4 * DAY,
    durationMinutes: 50,
    capacity: 10,
    status: "scheduled",
    meetingUrl: "https://meet.google.com/efg-hijk-lmn",
    bookings: [
      { member: 11, status: "attended", bookedAgo: 3 * DAY },
      { member: 0, status: "attended", bookedAgo: 2 * DAY, coinCost: 80 },
      { member: 3, status: "no_show", bookedAgo: 2 * DAY },
      { member: 5, status: "cancelled", bookedAgo: 3 * DAY, coinCost: 80, cancelledAgo: 5 * DAY },
    ],
  },
  {
    id: "demo-session-group-gst",
    category: "group_call",
    title: "GST and invoicing basics for online sellers",
    description: "Open Q&A with a practising chartered accountant.",
    hostAdminId: null,
    hostName: null,
    startsIn: -9 * DAY,
    durationMinutes: 60,
    capacity: 30,
    status: "scheduled",
    meetingUrl: null,
    bookings: [
      { member: 2, status: "attended", bookedAgo: 4 * DAY },
      { member: 6, status: "no_show", bookedAgo: 3 * DAY },
    ],
  },
];

function bookingsFor(spec: SessionSpec, now: number): SupportSessionBooking[] {
  const startsAt = now + spec.startsIn;
  return spec.bookings.map((b, i) => {
    const m = MEMBERS[b.member];
    return {
      id: `${spec.id}-booking-${i + 1}`,
      status: b.status,
      bookedAt: new Date(startsAt - b.bookedAgo).toISOString(),
      cancelledAt: b.status === "cancelled" ? new Date(now - (b.cancelledAgo ?? HOUR)).toISOString() : null,
      memberId: m.id,
      memberName: m.name,
      phone: m.phone,
      email: m.email,
      coinCost: b.coinCost ?? null,
    };
  });
}

function toSession(spec: SessionSpec, now: number): SupportSession {
  const { bookings, startsIn, ...rest } = spec;
  const active = bookings.filter((b) => b.status !== "cancelled").length;
  return {
    ...rest,
    startsAt: new Date(now + startsIn).toISOString(),
    hasMeetingUrl: !!spec.meetingUrl?.trim(),
    activeBookings: active,
    pendingAttendance: bookings.filter((b) => b.status === "booked").length,
    seatsLeft: Math.max(0, spec.capacity - active),
  };
}

/** Same category/scope filtering and ordering as listSupportSessionsHandler. */
export function demoSupportSessions(params: { category?: string; scope?: "upcoming" | "past" | "all" }): SupportSession[] {
  const now = Date.now();
  const scope = params.scope ?? "upcoming";
  const ended = (s: SessionSpec) => now + s.startsIn + s.durationMinutes * MIN <= now;
  return SPECS.filter((s) => !params.category || s.category === params.category)
    .filter((s) => (scope === "upcoming" ? !ended(s) : scope === "past" ? ended(s) : true))
    .sort((a, b) => (scope === "past" ? b.startsIn - a.startsIn : a.startsIn - b.startsIn))
    .map((s) => toSession(s, now));
}

export function demoSupportSessionBookings(sessionId: string): SupportSessionBooking[] {
  const spec = SPECS.find((s) => s.id === sessionId);
  return spec ? bookingsFor(spec, Date.now()) : [];
}
