import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { EpisodeResourcesSection, getResourceKind, isDownloadableUrl } from "./EpisodeResourcesSection";

const res = (id: string, fileType: string, fileUrl: string | null, title = `Res ${id}`) => ({
  id, title, fileType, fileUrl, description: null, downloadLabel: null, fileTypeIconUrl: null,
});

const renderSection = (resources: ReturnType<typeof res>[]) =>
  render(<EpisodeResourcesSection resources={resources} heading="Resources" defaultDownloadLabel="Download" />);

describe("getResourceKind", () => {
  it("uses the admin-set fileType", () => {
    expect(getResourceKind({ fileType: "image", fileUrl: "https://x/a" })).toBe("image");
    expect(getResourceKind({ fileType: "video", fileUrl: "https://x/a" })).toBe("video");
    expect(getResourceKind({ fileType: "audio", fileUrl: "https://x/a" })).toBe("audio");
    expect(getResourceKind({ fileType: "pdf", fileUrl: "https://x/a.pdf" })).toBe("file");
  });

  it("falls back to the URL extension when the type was left at its default", () => {
    expect(getResourceKind({ fileType: "pdf", fileUrl: "https://cdn/x/photo.WEBP?v=2" })).toBe("image");
    expect(getResourceKind({ fileType: "other", fileUrl: "https://cdn/x/clip.mp4" })).toBe("video");
  });
});

describe("EpisodeResourcesSection", () => {
  it("renders an image resource inline", () => {
    renderSection([res("1", "image", "https://cdn/a.png", "Diagram")]);
    const img = screen.getByRole("img", { name: "Diagram" });
    expect(img.getAttribute("src")).toBe("https://cdn/a.png");
  });

  it("renders a video resource with a playable <video>", () => {
    const { container } = renderSection([res("1", "video", "https://cdn/a.mp4")]);
    const video = container.querySelector("video");
    expect(video?.getAttribute("src")).toBe("https://cdn/a.mp4");
    expect(video?.hasAttribute("controls")).toBe(true);
  });

  it("renders every resource passed in, in order, with a download link each", () => {
    renderSection([
      res("1", "image", "https://cdn/a.png"),
      res("2", "video", "https://cdn/b.mp4"),
      res("3", "pdf", "https://cdn/c.pdf"),
    ]);
    const items = screen.getAllByTestId("episode-resource");
    expect(items.map((i) => i.getAttribute("data-kind"))).toEqual(["image", "video", "file"]);
    expect(screen.getByText("Resources (3)")).toBeTruthy();
    expect(screen.getAllByRole("link", { name: /Download/ })).toHaveLength(3);
  });

  it("renders nothing when the episode has no resources", () => {
    const { container } = renderSection([]);
    expect(container.innerHTML).toBe("");
  });

  it("skips resources with no file URL and hides the section if none remain", () => {
    const { container } = renderSection([res("1", "image", null)]);
    expect(container.innerHTML).toBe("");
  });

  it("shows a resource saved with a local file:// path as unavailable, not as a dead download link", () => {
    renderSection([res("1", "pdf", "file:///C:/Users/DELL/Downloads/Invoice-AMWAPMNM-0001.pdf", "Invoice")]);
    expect(screen.getByText("Resources (1)")).toBeTruthy();
    expect(screen.getByText("Invoice")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByTestId("episode-resource-unavailable").textContent).toBe("File unavailable");
  });

  it("keeps valid resources downloadable next to an invalid one", () => {
    renderSection([res("1", "pdf", "file:///C:/x.pdf"), res("2", "pdf", "https://cdn/c.pdf")]);
    const links = screen.getAllByRole("link", { name: /Download/ });
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("href")).toBe("https://cdn/c.pdf");
  });
});

describe("isDownloadableUrl", () => {
  it("accepts http(s) and rejects local paths", () => {
    expect(isDownloadableUrl("https://cdn/a.pdf")).toBe(true);
    expect(isDownloadableUrl("file:///C:/a.pdf")).toBe(false);
    expect(isDownloadableUrl("C:\\a.pdf")).toBe(false);
    expect(isDownloadableUrl(null)).toBe(false);
  });
});
