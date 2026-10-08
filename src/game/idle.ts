import { totalCps } from "@/game/shop";

/** Max offline catch-up window (8 hours). */
export const OFFLINE_CAP_MS = 8 * 60 * 60 * 1000;

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

export function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

export function formatCps(cps: number): string {
  if (cps >= 10) return cps.toFixed(1);
  if (cps >= 1) return cps.toFixed(2);
  return cps.toFixed(2);
}
