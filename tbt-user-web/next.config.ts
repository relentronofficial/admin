import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/eiflix", destination: "/tbt", permanent: true },
      { source: "/eiflix/:path*", destination: "/tbt/:path*", permanent: true },
      { source: "/sign-in", destination: "/login", permanent: false },
      { source: "/sign-up", destination: "/login", permanent: false },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.r2.cloudflarestorage.com" },
      { protocol: "https", hostname: "**.cloudflare.com" },
      { protocol: "https", hostname: "b-cdn.net" },
      { protocol: "https", hostname: "**.bunnycdn.com" },
      { protocol: "https", hostname: "img.clerk.com" },
      { protocol: "https", hostname: "images.clerk.dev" },
      { protocol: "https", hostname: "uploadthing.com" },
      { protocol: "https", hostname: "**.b-cdn.net" },
      { protocol: "https", hostname: "**.supabase.co" },
    ],
    // Serve AVIF first (30-50% smaller than WebP at same quality), then WebP.
    // Vercel's image optimizer respects the browser's Accept header.
    formats: ["image/avif", "image/webp"],
    // Cache optimized images for 30 days (default is 60s which causes frequent re-optimization).
    // Safe because images are content-addressed via their URL (changing the source URL busts the cache).
    minimumCacheTTL: 2592000,
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
};

export default withSentryConfig(nextConfig, {
  org: "tamil-business-tribe",
  project: "tbt-user-web",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  sourcemaps: { deleteSourcemapsAfterUpload: true },
  disableLogger: true,
  automaticVercelMonitors: true,
});
