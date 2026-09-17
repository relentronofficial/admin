import type { NextConfig } from "next";
import path from "node:path";

const config: NextConfig = {
  turbopack: {
    root: path.resolve(process.cwd()),
  },
  experimental: {
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default config;
