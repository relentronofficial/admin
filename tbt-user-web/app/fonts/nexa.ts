import localFont from "next/font/local";

// Nexa — the app's only typeface. Files were converted from the licensed Nexa
// family to WOFF2. 400 is Nexa Book: the family's "Nexa-Regular.ttf" is an
// italic design despite its name. Nexa has no 500/600 weights, so per the CSS
// font-matching rules font-medium renders with Book (400) and font-semibold
// with Bold (700). No Tamil glyphs: Tamil text falls back to the system font.
export const nexa = localFont({
  src: [
    { path: "./Nexa-Book.woff2", weight: "400", style: "normal" },
    { path: "./Nexa-BookItalic.woff2", weight: "400", style: "italic" },
    { path: "./Nexa-Bold.woff2", weight: "700", style: "normal" },
    { path: "./Nexa-XBold.woff2", weight: "800", style: "normal" },
    { path: "./Nexa-Black.woff2", weight: "900", style: "normal" },
  ],
  variable: "--font-nexa",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
});

// Nexa's current files have proportional digits, so ticking timers would
// jitter. The legacy Nexa Bold/Light builds draw the same digits and carry a
// `tnum` feature; Tailwind's `font-mono` uses this family with "tnum" on.
// Not preloaded: only countdown/timer UI uses it.
export const nexaTabular = localFont({
  src: [
    { path: "./NexaTabular-Light.woff2", weight: "300", style: "normal" },
    { path: "./NexaTabular-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-nexa-tabular",
  display: "swap",
  preload: false,
  fallback: ["ui-monospace", "monospace"],
});
