import { describe, it, expect } from "vitest";
import { splitBold, splitLinks } from "./LinkifiedText";

const links = (t: string) => splitLinks(t).filter((p) => p.href).map((p) => p.href);

describe("splitLinks", () => {
  it("links http(s) URLs and leaves the rest as text", () => {
    const parts = splitLinks("Join here: https://meet.google.com/abc-def now");
    expect(parts).toEqual([
      { text: "Join here: " },
      { text: "https://meet.google.com/abc-def", href: "https://meet.google.com/abc-def" },
      { text: " now" },
    ]);
  });

  it("trims trailing punctuation off the link", () => {
    expect(links("See https://tbt.com/x. Thanks!")).toEqual(["https://tbt.com/x"]);
    expect(links("(see https://tbt.com/x)")).toEqual(["https://tbt.com/x"]);
  });

  it("keeps a balanced closing parenthesis", () => {
    expect(links("https://en.wikipedia.org/wiki/Foo_(bar)")).toEqual(["https://en.wikipedia.org/wiki/Foo_(bar)"]);
  });

  it("adds https:// to bare www. links", () => {
    expect(links("go to www.tbt.com/a, ok")).toEqual(["https://www.tbt.com/a"]);
  });

  it("never links other schemes", () => {
    expect(links("javascript:alert(1) and mailto:x@y.com")).toEqual([]);
  });

  it("keeps query strings and handles text with no links", () => {
    expect(links("http://a.com?x=1&y=2")).toEqual(["http://a.com?x=1&y=2"]);
    expect(splitLinks("hello @ram")).toEqual([{ text: "hello @ram" }]);
  });
});

describe("splitBold", () => {
  it("renders **text** as bold without the asterisks", () => {
    expect(splitBold("This is **important** news")).toEqual([
      { text: "This is " },
      { text: "important", bold: true },
      { text: " news" },
    ]);
  });

  it("handles several bold runs, multi-word runs and line breaks", () => {
    expect(splitBold("**Step 1:** do this\n**Step 2:** then that")).toEqual([
      { text: "Step 1:", bold: true },
      { text: " do this\n" },
      { text: "Step 2:", bold: true },
      { text: " then that" },
    ]);
  });

  it("leaves unmatched or spaced asterisks as typed", () => {
    expect(splitBold("2 ** 3 = 8")).toEqual([{ text: "2 ** 3 = 8" }]);
    expect(splitBold("**not closed")).toEqual([{ text: "**not closed" }]);
    expect(splitBold("** spaced **")).toEqual([{ text: "** spaced **" }]);
  });
});
