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
      // Poster uploads are capped at 5 MB by the poster service. Leave room
      // for multipart boundaries and form-field overhead.
      bodySizeLimit: "6mb",
    },
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
