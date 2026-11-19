import { describe, it, expect } from "vitest";
import { splitLinks } from "./LinkifiedText";

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
