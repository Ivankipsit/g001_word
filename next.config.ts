import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // SW is production-only; Next 16 build uses Turbopack (Serwist SW emits via webpack path).
  disable: process.env.NODE_ENV !== "production",
  // Gzip dictionary is ~13MB, above this precache cap. Runtime CacheFirst covers it.
  maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
});

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withSerwist(nextConfig);
