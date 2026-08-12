import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config — TBT_ADS_SPECKIT.md §15.
 *
 * The repo already declares `@playwright/test` for the Percy visual scripts, so
 * §15 says to extend it rather than add a second runner. Note that neither the
 * dependency nor the `percy/` specs those scripts reference are currently
 * installed/present in a clean checkout — `npm install` at the repo root is a
 * prerequisite for anything here.
 *
 * These specs drive a REAL user-web instance. They are environment-gated rather
 * than mocked: an ad overlay is the interaction of a portal, a media element, a
 * scroll lock and a countdown, and a mocked version of that would pass while the
 * real one is broken. See `e2e/ads.spec.ts` for what has to be true before they
 * do anything.
 */
export default defineConfig({
  testDir: "./e2e",
  // An ad's own timers run to 8s (load) and beyond; a 30s default turns a real
  // failure into an ambiguous timeout.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.TBT_E2E_BASE_URL ?? "http://localhost:3001",
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
