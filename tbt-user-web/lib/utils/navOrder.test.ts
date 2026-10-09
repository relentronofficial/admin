import { describe, it, expect } from "vitest";
import { buildNavMenu } from "./navOrder";

const HOME = { id: "home-id", href: "/tbt", label: "Home" };
const MENTORSHIP = { id: "mentorship-id", href: "/courses", label: "Mentorship" };
const labels = (entries: { label: string }[]) => entries.map((e) => e.label);

describe("buildNavMenu", () => {
  it("keeps the default order when no order is saved (nav items, then sections)", () => {
    expect(labels(buildNavMenu({ nav: [HOME, MENTORSHIP], hiddenMenuKeys: [], navOrder: null })))
      .toEqual(["Home", "Mentorship", "Community", "Ebooks", "Podcasts"]);
  });

  it("applies the admin's combined order across nav items and sections", () => {
    const navOrder = ["section:community", "mentorship-id", "section:ebooks", "home-id", "section:podcasts"];
    expect(labels(buildNavMenu({ nav: [HOME, MENTORSHIP], hiddenMenuKeys: [], navOrder })))
      .toEqual(["Community", "Mentorship", "Ebooks", "Home", "Podcasts"]);
  });

  it("drops hidden sections and hidden nav items without disturbing the order", () => {
    const navOrder = ["section:community", "mentorship-id", "section:ebooks", "home-id", "section:podcasts"];
    expect(labels(buildNavMenu({ nav: [MENTORSHIP], hiddenMenuKeys: ["ebooks"], navOrder })))
      .toEqual(["Community", "Mentorship", "Podcasts"]);
  });

  it("appends entries missing from the saved order in their default position", () => {
    const NEW = { id: "new-id", href: "/workshops", label: "Workshops" };
    const navOrder = ["section:podcasts", "home-id"];
    expect(labels(buildNavMenu({ nav: [HOME, NEW], hiddenMenuKeys: [], navOrder })))
      .toEqual(["Podcasts", "Home", "Workshops", "Community", "Ebooks"]);
  });

  it("ignores unknown tokens in the saved order", () => {
    const navOrder = ["deleted-id", "section:bogus", "home-id"];
    expect(labels(buildNavMenu({ nav: [HOME], hiddenMenuKeys: ["community", "ebooks", "podcasts"], navOrder })))
      .toEqual(["Home"]);
  });
});
