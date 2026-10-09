/** Highest score any total can reach; shown as "999m". */
export const POINTS_CAP = 999_999_999;

export function capPoints(n: number): number {
  return Math.min(POINTS_CAP, Math.max(0, Math.floor(n)));
}

/** Whole-unit compact form: 999, 1k, 10k, 100k, 1m, 10m, 100m, 999m. */
export function formatPoints(n: number): string {
  const v = capPoints(n);
  if (v < 1_000) return String(v);
  if (v < 1_000_000) return `${Math.floor(v / 1_000)}k`;
  return `${Math.floor(v / 1_000_000)}m`;
}

export function formatPointsFull(n: number): string {
  return capPoints(n).toLocaleString();
}
