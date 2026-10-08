import { EnglishWorld } from "@/dictionary/english";
import type { ScoreBreakdown } from "@/game/types";

/**
 * Base ≈ length²; bonuses for first discovery, rare letters, chains,
 * Keystone, mastery. Combo multiplier applied to totalBeforeCombo.
 */
export function scoreWord(
  word: string,
  opts: {
    isFirstDiscovery: boolean;
    chainCount: number;
    keystoneLetter?: string | null;
    letterLevels?: Record<string, number>;
    comboMultiplier?: number;
  },
): ScoreBreakdown {
  const w = word.trim().toLowerCase();
  const len = w.length;
  const base = len * len;

  let rareLetterBonus = 0;
  for (const ch of w.toUpperCase()) {
    if (EnglishWorld.rareLetters.has(ch)) {
      rareLetterBonus += 8;
    }
  }

  const rarity = EnglishWorld.getRarity(w);
  if (rarity === "uncommon") rareLetterBonus += 5;
  if (rarity === "rare") rareLetterBonus += 15;
  if (rarity === "epic") rareLetterBonus += 30;

  const firstDiscoveryBonus = opts.isFirstDiscovery
    ? Math.max(12, Math.floor(base * 0.5))
    : 0;

  const chainDepth = Math.max(0, opts.chainCount - 1);
  const chainBonus =
    chainDepth > 0 ? Math.floor(base * Math.min(chainDepth, 8) * 0.15) : 0;

  const key = opts.keystoneLetter?.toUpperCase();
  const hasKey = Boolean(key && w.toUpperCase().includes(key));
  const keystoneApplied = hasKey;
  const keystoneBonus = keystoneApplied ? base : 0;

  let masteryBonus = 0;
  const levels = opts.letterLevels ?? {};
  for (const ch of w.toUpperCase()) {
    const level = levels[ch] ?? 1;
    if (level > 1) masteryBonus += (level - 1) * 4;
  }

  const totalBeforeCombo =
    base +
    firstDiscoveryBonus +
    rareLetterBonus +
    chainBonus +
    keystoneBonus +
    masteryBonus;

  const comboMultiplier = Math.max(1, opts.comboMultiplier ?? 1);
  const total = Math.floor(totalBeforeCombo * comboMultiplier);

  return {
    base,
    firstDiscoveryBonus,
    rareLetterBonus,
    chainBonus,
    keystoneBonus,
    masteryBonus,
    comboMultiplier,
    totalBeforeCombo,
    total,
    isFirstDiscovery: opts.isFirstDiscovery,
    chainCount: opts.chainCount,
    keystoneApplied,
  };
}
