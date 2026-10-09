import type { DiscoveredWord, ModeSave } from "@/game/types";

export function newRunId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function unionWords(
  a: Record<string, DiscoveredWord>,
  b: Record<string, DiscoveredWord>,
): Record<string, DiscoveredWord> {
  const out: Record<string, DiscoveredWord> = { ...a };
  for (const [word, meta] of Object.entries(b)) {
    const prev = out[word];
    if (!prev) {
      out[word] = meta;
      continue;
    }
    out[word] = {
      discoveredAt: Math.min(prev.discoveredAt, meta.discoveredAt),
      bestScore: Math.max(prev.bestScore, meta.bestScore),
      timesFound: Math.max(prev.timesFound, meta.timesFound),
    };
  }
  return out;
}

/**
 * Same run: newer save wins for run state, discovered words are unioned and the
 * higher total score is kept. Different runs: the newer save wins outright.
 */
export function mergeModeSave(local: ModeSave, remote: ModeSave): ModeSave {
  const remoteNewer = (remote.lastTickAt ?? 0) > (local.lastTickAt ?? 0);
  const newer = remoteNewer ? remote : local;
  const older = remoteNewer ? local : remote;
  if (local.runId !== remote.runId) return newer;
  return {
    ...newer,
    discoveredWords: unionWords(newer.discoveredWords ?? {}, older.discoveredWords ?? {}),
    totalScore: Math.max(newer.totalScore ?? 0, older.totalScore ?? 0),
  };
}

/** Cheap equality for sync decisions; avoids deep-comparing large word maps. */
export function sameModeSave(a: ModeSave, b: ModeSave): boolean {
  return (
    a.runId === b.runId &&
    (a.lastTickAt ?? 0) === (b.lastTickAt ?? 0) &&
    (a.totalScore ?? 0) === (b.totalScore ?? 0) &&
    Object.keys(a.discoveredWords ?? {}).length ===
      Object.keys(b.discoveredWords ?? {}).length
  );
}
