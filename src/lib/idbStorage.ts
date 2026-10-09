import { del, get, set } from "idb-keyval";
import type { StateStorage } from "zustand/middleware";

function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

/** IndexedDB-backed storage for zustand persist (localStorage caps out near 5 MB). No-op during SSR. */
export const idbStorage: StateStorage = {
  getItem: async (name) => {
    if (!hasIndexedDb()) return null;
    return (await get<string>(name)) ?? null;
  },
  setItem: async (name, value) => {
    if (!hasIndexedDb()) return;
    try {
      await set(name, value);
    } catch (err) {
      console.warn("[word-forge] save failed", err);
    }
  },
  removeItem: async (name) => {
    if (!hasIndexedDb()) return;
    await del(name);
  },
};
