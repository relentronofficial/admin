import { describe, it, expect } from "vitest";
import { splitLinks } from "./LinkifiedText";
import { parseFormatting, stripFormatting, toggleWrap } from "./chatFormatting";

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

const t = (text: string) => ({ type: "text", text });

describe("parseFormatting", () => {
  it("parses WhatsApp markers: *bold* _italic_ ~strike~ __underline__", () => {
    expect(parseFormatting("a *b* _i_ ~s~ __u__")).toEqual([
      t("a "),
      { type: "bold", children: [t("b")] },
      t(" "),
      { type: "italic", children: [t("i")] },
      t(" "),
      { type: "strike", children: [t("s")] },
      t(" "),
      { type: "underline", children: [t("u")] },
    ]);
  });

  it("keeps **markdown bold** working and nests styles", () => {
    expect(parseFormatting("**Step 1:** go")).toEqual([{ type: "bold", children: [t("Step 1:")] }, t(" go")]);
    expect(parseFormatting("*_both_*")).toEqual([
      { type: "bold", children: [{ type: "italic", children: [t("both")] }] },
    ]);
  });

  it("parses inline code and ``` blocks without formatting inside", () => {
    expect(parseFormatting("run `a*b*c` now")).toEqual([t("run "), { type: "code", text: "a*b*c" }, t(" now")]);
    expect(parseFormatting("```x *y*\nz```")).toEqual([{ type: "mono", text: "x *y*\nz" }]);
  });

  it("turns '> ' lines into a quote block", () => {
    expect(parseFormatting("> *hi*\nok")).toEqual([
      { type: "quote", children: [{ type: "bold", children: [t("hi")] }] },
      t("ok"),
    ]);
  });

  it("leaves markers inside words, spaced markers and maths as typed", () => {
    expect(parseFormatting("my_var_name")).toEqual([t("my_var_name")]);
    expect(parseFormatting("2*3*4")).toEqual([t("2*3*4")]);
    expect(parseFormatting("a * b * c")).toEqual([t("a * b * c")]);
    expect(parseFormatting("2 ** 3 = 8")).toEqual([t("2 ** 3 = 8")]);
    expect(parseFormatting("*not closed")).toEqual([t("*not closed")]);
  });

  it("does not span lines and does not break links", () => {
    expect(parseFormatting("*a\nb*")).toEqual([t("*a\nb*")]);
    expect(parseFormatting("see https://x.com/a_b_c ok")).toEqual([t("see https://x.com/a_b_c ok")]);
    expect(parseFormatting("*https://x.com*")).toEqual([{ type: "bold", children: [t("https://x.com")] }]);
  });

  it("stripFormatting removes markers for previews", () => {
    expect(stripFormatting("*Hi* _there_ ~old~")).toBe("Hi there old");
  });
});

describe("splitLinks with formatting", () => {
  it("does not swallow a closing marker into the link", () => {
    expect(links("*https://tbt.com/x*")).toEqual(["https://tbt.com/x"]);
  });
});

describe("toggleWrap (composer shortcuts)", () => {
  it("wraps the selection, keeping edge spaces outside", () => {
    expect(toggleWrap("say hello now", 4, 10, "*")).toEqual({ value: "say *hello* now", selStart: 5, selEnd: 10 });
  });
  it("unwraps an already wrapped selection", () => {
    expect(toggleWrap("say *hello* now", 5, 10, "*")).toEqual({ value: "say hello now", selStart: 4, selEnd: 9 });
  });
  it("inserts an empty pair at the caret", () => {
    expect(toggleWrap("ab", 1, 1, "__")).toEqual({ value: "a____b", selStart: 3, selEnd: 3 });
  });
});

describe("LinkifiedText rendering", () => {
  it("renders each style with the right element and keeps links clickable", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { LinkifiedText } = await import("./LinkifiedText");
    const html = renderToStaticMarkup(<LinkifiedText text={"*b* _i_ ~s~ __u__ `c` https://tbt.com"} />);
    expect(html).toContain("<strong");
    expect(html).toContain("<em");
    expect(html).toContain("<s ");
    expect(html).toContain("<u ");
    expect(html).toContain("<code");
    expect(html).toContain('href="https://tbt.com"');
    expect(html).not.toMatch(/[*~`]/);
    const noLinks = renderToStaticMarkup(<LinkifiedText text={"*see* https://tbt.com"} links={false} />);
    expect(noLinks).not.toContain("<a ");
    expect(noLinks).toContain("<strong");
  });
});
