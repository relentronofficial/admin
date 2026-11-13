import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { Footer } from "./Footer";

const nav = { pathname: "/dashboard" };
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));
vi.mock("@/lib/context/SiteConfigContext", () => ({
  useSiteConfig: () => ({ config: { footerText: "© 2026 Tamil Business Tribe. All rights reserved." } }),
}));

afterEach(cleanup);

describe("Footer", () => {
  it("shows the copyright row on member pages", () => {
    nav.pathname = "/dashboard";
    render(<Footer />);
    expect(screen.getByText("© 2026 Tamil Business Tribe. All rights reserved.")).toBeTruthy();
  });

  it("renders nothing on /mentorship, which shows the copyright in its own footer", () => {
    nav.pathname = "/mentorship";
    const { container } = render(<Footer />);
    expect(container.innerHTML).toBe("");
  });

  it("still renders on /mentorship sub-pages", () => {
    nav.pathname = "/mentorship/intro/abc";
    render(<Footer />);
    expect(screen.getByRole("contentinfo")).toBeTruthy();
  });
});
