import { totalCps } from "@/game/shop";

/** Max offline catch-up window (8 hours). */
const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000;

export interface IdleCatchUp {
  elapsedMs: number;
  cappedMs: number;
  earned: number;
  cps: number;
}

/**
 * Compute offline earnings from lastTickAt → now, capped at OFFLINE_CAP_MS.
 */
export function computeOfflineEarnings(
  generators: Record<string, number>,
  lastTickAt: number,
  now = Date.now(),
): IdleCatchUp {
  const cps = totalCps(generators);
  const elapsedMs = Math.max(0, now - lastTickAt);
  const cappedMs = Math.min(elapsedMs, OFFLINE_CAP_MS);
  const earned = Math.floor(cps * (cappedMs / 1000));
  return { elapsedMs, cappedMs, earned, cps };
}

export function formatCps(cps: number): string {
  if (cps >= 10) return cps.toFixed(1);
  if (cps >= 1) return cps.toFixed(2);
  return cps.toFixed(2);
}
