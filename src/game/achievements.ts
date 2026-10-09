import { EnglishWorld } from "@/dictionary/english";
import { bestStreak, dailyComplete } from "@/game/progress";
import type { GameMode, ModeSave, PlayerProgress } from "@/game/types";

export interface AchievementStats {
  uniqueWords: number;
  legendaryWords: number;
  bestStreak: number;
  trifectaToday: boolean;
  hintFreeSolves: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  goal: number;
  value: (s: AchievementStats) => number;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "legendary-1",
    title: "Golden find",
    description: "Find a legendary word",
    goal: 1,
    value: (s) => s.legendaryWords,
  },
  {
    id: "legendary-10",
    title: "Legendary hunter",
    description: "Find 10 legendary words",
    goal: 10,
    value: (s) => s.legendaryWords,
  },
  {
    id: "words-100",
    title: "Wordsmith",
    description: "100 words in your Lexicon",
    goal: 100,
    value: (s) => s.uniqueWords,
  },
  {
    id: "words-1000",
    title: "Lexicographer",
    description: "1,000 words in your Lexicon",
    goal: 1_000,
    value: (s) => s.uniqueWords,
  },
  {
    id: "words-10000",
    title: "Living dictionary",
    description: "10,000 words in your Lexicon",
    goal: 10_000,
    value: (s) => s.uniqueWords,
  },
  {
    id: "streak-3",
    title: "Warming up",
    description: "3-day daily streak",
    goal: 3,
    value: (s) => s.bestStreak,
  },
  {
    id: "streak-7",
    title: "Week of words",
    description: "7-day daily streak",
    goal: 7,
    value: (s) => s.bestStreak,
  },
  {
    id: "streak-30",
    title: "Dawn keeper",
    description: "30-day daily streak",
    goal: 30,
    value: (s) => s.bestStreak,
  },
  {
    id: "trifecta",
    title: "Daily trifecta",
    description: "Complete all three dailies on one day",
    goal: 1,
    value: (s) => (s.trifectaToday ? 1 : 0),
  },
  {
    id: "hintfree-25",
    title: "No help needed",
    description: "Solve 25 clues without a hint",
    goal: 25,
    value: (s) => s.hintFreeSolves,
  },
];

export function achievementStats(
  modes: Partial<Record<GameMode, ModeSave>>,
  progress: PlayerProgress,
  today: string,
): AchievementStats {
  const words = new Set<string>();
  for (const save of Object.values(modes)) {
    if (!save) continue;
    for (const w of Object.keys(save.discoveredWords ?? {})) words.add(w);
  }
  let legendaryWords = 0;
  for (const w of words) {
    if (EnglishWorld.getRarity(w) === "legendary") legendaryWords += 1;
  }
  return {
    uniqueWords: words.size,
    legendaryWords,
    bestStreak: bestStreak(progress.dailyDays),
    trifectaToday:
      dailyComplete("daily", modes.daily, today) &&
      dailyComplete("pinDaily", modes.pinDaily, today) &&
      dailyComplete("wordleDaily", modes.wordleDaily, today),
    hintFreeSolves: progress.hintFreeSolves,
  };
}

/** Achievements reached by these stats that are not yet in progress. */
export function newlyUnlocked(stats: AchievementStats, progress: PlayerProgress): Achievement[] {
  return ACHIEVEMENTS.filter(
    (a) => !progress.achievements[a.id] && a.value(stats) >= a.goal,
  );
}
