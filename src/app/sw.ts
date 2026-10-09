import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { CacheFirst, ExpirationPlugin, Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: WorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ url }) =>
        url.pathname === "/dictionary/english-words.json.gz" ||
        url.pathname === "/dictionary/english-clues.json.gz",
      handler: new CacheFirst({
        // Bump on every dictionary rebuild; CacheFirst never revalidates.
        cacheName: "word-forge-lexicon-v5",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 2,
            maxAgeSeconds: 60 * 60 * 24 * 45,
          }),
        ],
      }),
    },
    ...defaultCache,
  ],
});

serwist.addEventListeners();
