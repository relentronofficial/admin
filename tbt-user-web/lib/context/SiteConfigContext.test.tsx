import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SiteConfigProvider, useSiteConfig } from "./SiteConfigContext";
import type { SiteConfig } from "@/types";

const THEME = {
  accentColor: "#00c4cc",
  alertColor: "#ff3d8b",
  successColor: "#22c55e",
  bgPrimary: "#000000",
  bgSurface: "#111111",
};

const baseConfig = {
  siteName: "TBT",
  theme: THEME,
  coursesBannerUrl: null,
} as unknown as SiteConfig;

function BannerProbe() {
  const { config } = useSiteConfig();
  return <div data-testid="banner">{config?.coursesBannerUrl ?? "none"}</div>;
}

function renderWithServerConfig(initialConfig: SiteConfig) {
  return render(
    <SiteConfigProvider
      initialConfig={initialConfig}
      initialNav={{ items: [], rightIcons: { notifications: true, messages: true, profile: true } }}
      initialUiStrings={{} as any}
    >
      <BannerProbe />
    </SiteConfigProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SiteConfigProvider live refresh", () => {
  it("replaces a stale server-rendered config with the live admin banner", async () => {
    const liveUrl = "https://cdn.example.net/site/coursesBannerUrl/123-banner.webp";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { ...baseConfig, coursesBannerUrl: liveUrl } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    renderWithServerConfig(baseConfig);
    expect(screen.getByTestId("banner").textContent).toBe("none");

    await waitFor(() => expect(screen.getByTestId("banner").textContent).toBe(liveUrl));
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/pub/config/site"),
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("keeps the server-rendered config when the live fetch fails", async () => {
    const serverUrl = "https://cdn.example.net/site/coursesBannerUrl/old.webp";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    renderWithServerConfig({ ...baseConfig, coursesBannerUrl: serverUrl } as SiteConfig);

    await new Promise((r) => setTimeout(r, 0));
    expect(screen.getByTestId("banner").textContent).toBe(serverUrl);
  });
});
