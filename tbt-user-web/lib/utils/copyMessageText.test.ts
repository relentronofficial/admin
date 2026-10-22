import { afterEach, describe, expect, it, vi } from "vitest";
import { copyMessageText, noTextToCopyMessage } from "./copyMessageText";

const setClipboard = (writeText: ((t: string) => Promise<void>) | undefined) =>
  Object.defineProperty(navigator, "clipboard", { value: writeText ? { writeText } : undefined, configurable: true });

afterEach(() => {
  vi.restoreAllMocks();
  setClipboard(undefined);
});

describe("copyMessageText", () => {
  it("copies the exact message text, including line breaks and spacing", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard(writeText);
    const text = "Line one\n  Line two — ₹1,042 ✓";
    expect(await copyMessageText(text)).toBe("copied");
    expect(writeText).toHaveBeenCalledWith(text);
  });

  it("reports 'empty' (and copies nothing) for a message without text", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard(writeText);
    for (const body of [null, undefined, "", "   \n "]) expect(await copyMessageText(body)).toBe("empty");
    expect(writeText).not.toHaveBeenCalled();
  });

  it("falls back to the legacy copy when the Clipboard API is missing or refused", async () => {
    const exec = vi.fn().mockReturnValue(true);
    (document as any).execCommand = exec;
    setClipboard(undefined);
    expect(await copyMessageText("hello")).toBe("copied");
    setClipboard(vi.fn().mockRejectedValue(new Error("NotAllowedError")));
    expect(await copyMessageText("hello")).toBe("copied");
    expect(exec).toHaveBeenCalledWith("copy");
  });

  it("reports 'failed' — never a false success — when every copy path is refused", async () => {
    (document as any).execCommand = vi.fn().mockReturnValue(false);
    setClipboard(vi.fn().mockRejectedValue(new Error("NotAllowedError")));
    expect(await copyMessageText("hello")).toBe("failed");
  });
});

describe("noTextToCopyMessage", () => {
  it("explains why there is nothing to copy", () => {
    expect(noTextToCopyMessage("image")).toBe("This is an image — there's no text to copy");
    expect(noTextToCopyMessage("audio")).toBe("This voice note has no text to copy");
    expect(noTextToCopyMessage("file")).toBe("This file has no text to copy");
    expect(noTextToCopyMessage(null)).toBe("This message has no text to copy");
  });
});
