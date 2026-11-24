import type { NextConfig } from "next";

import { securityHeaders } from "./src/config/security";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  // Tesseract loads worker/WASM files and local traineddata from node_modules.
  // Keep them outside the Server Component bundle so those paths stay intact.
  serverExternalPackages: ["tesseract.js", "@tesseract.js-data/eng"],
  experimental: {
    serverActions: {
      // Poster uploads are capped at 4.2 MB by the poster service. Leave room
      // for multipart boundaries and form-field overhead.
      bodySizeLimit: "6mb",
    },
    // Next.js otherwise uses one page-data worker per CPU. That exhausts RAM
    // on small build agents, so the default is deliberately conservative.
    // Larger CI runners can raise it with NEXT_BUILD_CPUS.
    cpus: Math.max(1, Number.parseInt(process.env.NEXT_BUILD_CPUS ?? "2", 10) || 2),
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
