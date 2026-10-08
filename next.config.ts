import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // SW is production-only; Next 16 build uses Turbopack (Serwist SW emits via webpack path).
  disable: process.env.NODE_ENV !== "production",
  // Expanded dictionary chunk is ~5MB; keep it in the precache for offline play.
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
