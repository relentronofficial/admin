import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { Navbar } from "./Navbar";
import { SiteConfigContext } from "@/lib/context/SiteConfigContext";
import type { NavItem } from "@/types";

// Isolate the Navbar from network/socket/router — this test only checks which nav
// links it renders and in what order, given the admin's nav config.
vi.mock("next/navigation", () => ({
  usePathname: () => "/courses",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn(), clear: vi.fn() }) }));
vi.mock("@/lib/hooks/useDashboard", () => ({
  useNotificationUnreadCount: () => ({ data: 0 }),
  useConversationUnreadCount: () => ({ data: 0 }),
  useNotifications: () => ({ data: { data: [] }, isLoading: false }),
  useMarkNotificationRead: () => ({ mutate: vi.fn() }),
  useMarkAllNotificationsRead: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/lib/hooks/useUser", () => ({ useMe: () => ({ data: null }) }));
vi.mock("@/lib/socket/client", () => ({ getSocket: () => new Promise(() => {}) }));
vi.mock("./StreakButton", () => ({ StreakButton: () => null }));
vi.mock("@/lib/api/client", () => ({ default: { post: vi.fn() } }));

const nav: NavItem[] = [
  { id: "home-id", label: "Home", href: "/tbt", order: 0, isVisible: true },
  { id: "mentorship-id", label: "Mentorship", href: "/courses", order: 1, isVisible: true },
];

function renderNavbar(navOrder: string[] | null, hiddenMenuKeys: string[] = []) {
  return render(
    <SiteConfigContext.Provider
      value={{
        config: null,
        nav,
        rightIcons: { notifications: false, messages: false, profile: false },
        hiddenMenuKeys,
        hiddenHrefs: [],
        navOrder,
        uiStrings: null,
        isLoading: false,
      }}
    >
      <Navbar />
    </SiteConfigContext.Provider>,
  );
}

const desktopLabels = (c: HTMLElement) =>
  Array.from(c.querySelectorAll("header nav a")).map((a) => a.textContent?.trim());

describe("Navbar — admin-controlled order", () => {
  it("renders exactly Community | Mentorship | Ebooks | Home | Podcasts from the saved order", () => {
    const { container } = renderNavbar(["section:community", "mentorship-id", "section:ebooks", "home-id", "section:podcasts"]);
    expect(desktopLabels(container)).toEqual(["Community", "Mentorship", "Ebooks", "Home", "Podcasts"]);
  });

  it("uses the same order in the mobile drawer (Support stays after the separator)", () => {
    const { container } = renderNavbar(["section:community", "mentorship-id", "section:ebooks", "home-id", "section:podcasts"]);
    const drawer = Array.from(container.querySelectorAll("nav")).find((n) => !n.closest("header"))!;
    const labels = Array.from(drawer.querySelectorAll("a")).map((a) => a.textContent?.trim());
    expect(labels).toEqual(["Community", "Mentorship", "Ebooks", "Home", "Podcasts", "Support"]);
  });

  it("keeps today's order when the admin has not saved one", () => {
    const { container } = renderNavbar(null);
    expect(desktopLabels(container)).toEqual(["Home", "Mentorship", "Community", "Ebooks", "Podcasts"]);
  });

  it("still respects visibility within the saved order", () => {
    const { container } = renderNavbar(["section:community", "mentorship-id", "section:ebooks", "home-id", "section:podcasts"], ["ebooks"]);
    expect(desktopLabels(container)).toEqual(["Community", "Mentorship", "Home", "Podcasts"]);
  });
});
