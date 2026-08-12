import { expect, test, type Page } from "@playwright/test";

/**
 * Ad overlay end-to-end coverage — TBT_ADS_SPECKIT.md §15 ("Web").
 *
 * ── Prerequisites, and why these skip instead of fail ──────────────────────
 *
 * These specs need three things that no checkout provides on its own:
 *
 *   1. a running user-web against a running backend  (TBT_E2E_BASE_URL)
 *   2. a signed-in member session                    (TBT_E2E_PHONE/_PASSWORD,
 *                                                      or TBT_E2E_STORAGE_STATE)
 *   3. an ACTIVE campaign that will actually be selected for that member —
 *      placement `app_launch`, trigger `app_launch`, frequency `unlimited`
 *
 * Without (3) the server correctly returns `showAd: false` and every assertion
 * here would fail for a reason that has nothing to do with the code. So the
 * suite skips loudly rather than reporting red on a healthy system — a test
 * that fails when the feature works trains people to ignore the suite.
 *
 * Set TBT_E2E_ADS=1 once the fixture campaign exists.
 */

const BASE_URL = process.env.TBT_E2E_BASE_URL;
const ENABLED = process.env.TBT_E2E_ADS === "1" && !!BASE_URL;

test.skip(
  !ENABLED,
  "Ad E2E requires TBT_E2E_ADS=1, TBT_E2E_BASE_URL, a member session, and a seeded active campaign — see the file header.",
);

/** The overlay is a portal on document.body with an explicit dialog role. */
const overlay = (page: Page) => page.getByRole("dialog");

async function signIn(page: Page) {
  const phone = process.env.TBT_E2E_PHONE;
  const password = process.env.TBT_E2E_PASSWORD;
  if (!phone || !password) return; // storageState path — already authenticated

  await page.goto("/login");
  await page.getByLabel(/phone/i).fill(phone);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in|login/i }).click();
  await page.waitForURL(/\/(tbt|dashboard)/, { timeout: 30_000 });
}

/**
 * Wait for the launch trigger (1.2s delay) plus selection. Deliberately not a
 * fixed sleep: on a slow CI box a sleep is either flaky or wastes 10s a test.
 */
async function waitForAd(page: Page) {
  await expect(overlay(page)).toBeVisible({ timeout: 20_000 });
}

test.beforeEach(async ({ page }) => {
  await signIn(page);
  await page.goto("/dashboard");
});

test("overlay renders fullscreen above the app chrome", async ({ page }) => {
  await waitForAd(page);

  const box = await overlay(page).boundingBox();
  const viewport = page.viewportSize();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(viewport!.width - 1);
  expect(box!.height).toBeGreaterThanOrEqual(viewport!.height - 1);

  // Portalled to body, not nested in the max-width container — otherwise it
  // would inherit the layout's stacking context and sit under the navbar.
  const parentIsBody = await overlay(page).evaluate((el) => el.parentElement === document.body);
  expect(parentIsBody).toBe(true);
});

test("locks page scroll while shown and restores the previous value", async ({ page }) => {
  const before = await page.evaluate(() => document.body.style.overflow);
  await waitForAd(page);

  await expect
    .poll(() => page.evaluate(() => document.body.style.overflow))
    .toBe("hidden");

  await dismissAd(page);

  // Restored to what it was, NOT hardcoded to "" — the podcast mini-player may
  // have set it.
  await expect
    .poll(() => page.evaluate(() => document.body.style.overflow))
    .toBe(before);
});

test("skip is gated behind a countdown and then works", async ({ page }) => {
  await waitForAd(page);

  const skip = page.getByRole("button", { name: /skip/i });
  await expect(skip).toBeVisible();

  // While locked the control shows a countdown and cannot be used.
  const initial = await skip.textContent();
  if (await skip.isDisabled()) {
    expect(initial).toMatch(/\d/);
    await expect(skip).toBeEnabled({ timeout: 30_000 });
    expect(await skip.textContent()).not.toBe(initial);
  }

  await skip.click();
  await expect(overlay(page)).toBeHidden();
});

test("Escape closes only when the campaign allows closing", async ({ page }) => {
  await waitForAd(page);

  const closeButton = page.getByRole("button", { name: /close/i });
  const closable = await closeButton.isVisible().catch(() => false);

  await page.keyboard.press("Escape");

  if (closable) {
    await expect(overlay(page)).toBeHidden();
  } else {
    // An unclosable ad must ignore Escape — otherwise it is a skip button with
    // extra steps, and the admin's gating means nothing.
    await expect(overlay(page)).toBeVisible();
  }
});

test("only one overlay can exist at a time", async ({ page }) => {
  await waitForAd(page);
  // Route changes fire the route_enter trigger; the display lock must hold.
  await page.goto("/tbt");
  await page.goto("/dashboard");
  await expect(overlay(page)).toHaveCount(1);
});

test("video ads autoplay muted when unmuted autoplay is refused", async ({ page }) => {
  await waitForAd(page);
  const video = overlay(page).locator("video");
  if ((await video.count()) === 0) test.skip(true, "fixture campaign is an image ad");

  // A rejected play() must never abort the flow — the ad still shows, muted.
  await expect
    .poll(() => video.evaluate((el: HTMLVideoElement) => el.muted || !el.paused))
    .toBe(true);
});

test("interrupted media pauses, and resumes only if it was playing", async ({ page }) => {
  // Start a podcast, then let the timed trigger fire an ad over it.
  await page.goto("/podcasts");
  const play = page.getByRole("button", { name: /play/i }).first();
  if ((await play.count()) === 0) test.skip(true, "no podcast fixture available");
  await play.click();

  const audioState = () =>
    page.evaluate(() => {
      const el = document.querySelector("audio") as HTMLAudioElement | null;
      return el ? { paused: el.paused, time: el.currentTime } : null;
    });

  await expect.poll(async () => (await audioState())?.paused).toBe(false);
  await waitForAd(page);

  // Criterion 22: app audio is paused BEFORE the ad's own media starts.
  const during = await audioState();
  expect(during?.paused).toBe(true);

  await dismissAd(page);

  // Criterion 19/20: it was playing, so it comes back — from where it stopped.
  const after = await audioState();
  expect(after?.paused).toBe(false);
  expect(after!.time).toBeGreaterThanOrEqual(during!.time - 1);
});

for (const [name, size] of Object.entries({
  "mobile portrait": { width: 375, height: 812 },
  "mobile landscape": { width: 812, height: 375 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 800 },
})) {
  test(`covers the viewport at ${name}`, async ({ page }) => {
    await page.setViewportSize(size);
    await waitForAd(page);
    const box = await overlay(page).boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(size.width - 1);
    expect(box!.height).toBeGreaterThanOrEqual(size.height - 1);
  });
}

/** Close by whichever control the fixture campaign actually offers. */
async function dismissAd(page: Page) {
  const close = page.getByRole("button", { name: /close/i });
  if (await close.isVisible().catch(() => false)) {
    await close.click();
  } else {
    const skip = page.getByRole("button", { name: /skip/i });
    await expect(skip).toBeEnabled({ timeout: 30_000 });
    await skip.click();
  }
  await expect(overlay(page)).toBeHidden();
}
