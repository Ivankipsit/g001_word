import { DAILY_GOAL } from "@/game/letters";
import type { GameMode, ModeSave, PlayerProgress } from "@/game/types";

const MAX_DAILY_DAYS = 400;

export function blankProgress(): PlayerProgress {
  return { dailyDays: [], achievements: {}, hintFreeSolves: 0 };
}

/** Accepts anything from storage or the cloud and returns a valid progress object. */
export function normalizeProgress(raw: unknown): PlayerProgress {
  const p = (raw && typeof raw === "object" ? raw : {}) as Partial<PlayerProgress>;
  const days = Array.isArray(p.dailyDays)
    ? p.dailyDays.filter((d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d))
    : [];
  const achievements: Record<string, string> = {};
  if (p.achievements && typeof p.achievements === "object") {
    for (const [id, at] of Object.entries(p.achievements)) {
      if (typeof at === "string") achievements[id] = at;
    }
  }
  return {
    dailyDays: [...new Set(days)].sort().slice(-MAX_DAILY_DAYS),
    achievements,
    hintFreeSolves:
      typeof p.hintFreeSolves === "number" && p.hintFreeSolves > 0
        ? Math.floor(p.hintFreeSolves)
        : 0,
  };
}

/** Union of days, earliest unlock per achievement, larger counter. */
export function mergeProgress(a: PlayerProgress, b: PlayerProgress): PlayerProgress {
  const achievements = { ...a.achievements };
  for (const [id, at] of Object.entries(b.achievements)) {
    const prev = achievements[id];
    if (!prev || at < prev) achievements[id] = at;
  }
  return {
    dailyDays: [...new Set([...a.dailyDays, ...b.dailyDays])].sort().slice(-MAX_DAILY_DAYS),
    achievements,
    hintFreeSolves: Math.max(a.hintFreeSolves, b.hintFreeSolves),
  };
}

/** Daily modes: Lock / Wordle when the puzzle ends, Dawn Glyph at DAILY_GOAL words. */
export function dailyComplete(mode: GameMode, save: ModeSave | undefined, today: string): boolean {
  if (!save?.started || save.dailyDateUtc !== today) return false;
  if (mode === "pinDaily" || mode === "wordleDaily") {
    return save.puzzleStatus === "won" || save.puzzleStatus === "lost";
  }
  if (mode === "daily") {
    return Object.keys(save.discoveredWords ?? {}).length >= DAILY_GOAL;
  }
  return false;
}

export function markDailyDone(progress: PlayerProgress, today: string): PlayerProgress {
  if (progress.dailyDays.includes(today)) return progress;
  return {
    ...progress,
    dailyDays: [...progress.dailyDays, today].sort().slice(-MAX_DAILY_DAYS),
  };
}

function previousDay(dateUtc: string): string {
  const t = Date.parse(`${dateUtc}T00:00:00Z`) - 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** Consecutive days ending today, or yesterday when today is not done yet. */
export function currentStreak(dailyDays: string[], today: string): number {
  const days = new Set(dailyDays);
  let day = days.has(today) ? today : previousDay(today);
  let streak = 0;
  while (days.has(day)) {
    streak += 1;
    day = previousDay(day);
  }
  return streak;
}

/** Longest run of consecutive days ever. */
export function bestStreak(dailyDays: string[]): number {
  const sorted = [...new Set(dailyDays)].sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const day of sorted) {
    run = prev && previousDay(day) === prev ? run + 1 : 1;
    if (run > best) best = run;
    prev = day;
  }
  return best;
}
