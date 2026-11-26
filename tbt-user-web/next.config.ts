import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// The Fastify backend. Browsers reach it through this app's own origin (the
// rewrites below), so the auth cookies it sets are first-party. See
// lib/api/base.ts for why calling its run.app origin directly broke sign-in.
const BACKEND_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

const nextConfig: NextConfig = {
  output: "standalone",
  async rewrites() {
    return [
      // REST API — this app has no /api routes of its own.
      { source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` },
      // Socket.IO (HTTP polling + WebSocket upgrade; Next proxies both).
      { source: "/socket.io", destination: `${BACKEND_URL}/socket.io` },
      { source: "/socket.io/:path*", destination: `${BACKEND_URL}/socket.io/:path*` },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=()" }, // mic for this site only (voice notes), never for embedded frames
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: "/eiflix", destination: "/discover", permanent: true },
      { source: "/eiflix/:path*", destination: "/discover/:path*", permanent: true },
      { source: "/tbt", destination: "/discover", permanent: true },
      { source: "/tbt/:path*", destination: "/discover/:path*", permanent: true },
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
    // Proxied API calls (rewrites above) default to a 30 s timeout; AI and
    // report endpoints can take longer.
    proxyTimeout: 120_000,
  },
};

export default withSentryConfig(nextConfig, {
  org: "tamil-business-tribe",
  project: "tbt-user-web",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  sourcemaps: { deleteSourcemapsAfterUpload: true },
  disableLogger: true,
  automaticVercelMonitors: false,
});
