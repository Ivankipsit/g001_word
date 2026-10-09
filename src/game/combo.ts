import { EnglishWorld } from "@/dictionary/english";

/** Multiplier tiers x3–x10 */
const COMBO_MULTIPLIERS = [3, 4, 5, 6, 7, 8, 9, 10] as const;
export type ComboMultiplier = (typeof COMBO_MULTIPLIERS)[number];

export const COMBO_TIER_NAMES: Record<ComboMultiplier, string> = {
  3: "Spark",
  4: "Ember",
  5: "Blaze",
  6: "Inferno",
  7: "Nova",
  8: "Supernova",
  9: "Overdrive",
  10: "Lexicon Break",
};

/** Min words in window + refresh duration (ms) per tier */
export const COMBO_TIER_RULES: Record<
  ComboMultiplier,
  { minWords: number; windowMs: number }
> = {
  3: { minWords: 1, windowMs: 12_000 },
  4: { minWords: 2, windowMs: 11_000 },
  5: { minWords: 3, windowMs: 10_000 },
  6: { minWords: 4, windowMs: 9_000 },
  7: { minWords: 5, windowMs: 8_000 },
  8: { minWords: 6, windowMs: 7_000 },
  9: { minWords: 7, windowMs: 6_000 },
  10: { minWords: 8, windowMs: 5_000 },
};

export type WordQuality = "standard" | "good" | "great";

export function wordQuality(
  word: string,
  opts?: {
    keystoneApplied?: boolean;
    defineSolve?: boolean;
    ladderAdvance?: boolean;
  },
): WordQuality {
  const w = word.toLowerCase();
  const rarity = EnglishWorld.getRarity(w);
  if (
    opts?.defineSolve ||
    opts?.ladderAdvance ||
    rarity === "rare" ||
    rarity === "epic" ||
    rarity === "legendary"
  ) {
    return "great";
  }
  if (
    rarity === "uncommon" ||
    w.length >= 5 ||
    [...w.toUpperCase()].some((ch) => EnglishWorld.rareLetters.has(ch)) ||
    opts?.keystoneApplied
  ) {
    return "good";
  }
  return "standard";
}

function qualityTierBoost(q: WordQuality): number {
  if (q === "great") return 2;
  if (q === "good") return 1;
  return 0;
}

export interface ComboState {
  /** 0 = inactive; else 3–10 */
  comboTier: number;
  comboWordsInWindow: number;
  comboExpiresAt: number | null;
}

export function blankCombo(): ComboState {
  return {
    comboTier: 0,
    comboWordsInWindow: 0,
    comboExpiresAt: null,
  };
}

export function isComboAlive(state: ComboState, now = Date.now()): boolean {
  if (!state.comboTier || !state.comboExpiresAt) return false;
  return now < state.comboExpiresAt;
}

function clampTier(n: number): number {
  if (n < 3) return 3;
  if (n > 10) return 10;
  return n;
}

/**
 * Advance combo after a valid word. Returns new combo state + multiplier used
 * for this word (the tier AFTER advance).
 */
export function advanceCombo(
  prev: ComboState,
  quality: WordQuality,
  now = Date.now(),
): { next: ComboState; multiplier: number; tierUp: boolean; broke: boolean } {
  const alive = isComboAlive(prev, now);
  let words = alive ? prev.comboWordsInWindow + 1 : 1;
  let tier = alive && prev.comboTier >= 3 ? prev.comboTier : 0;

  if (!alive || tier < 3) {
    tier = 3;
    words = 1;
  } else {
    const boost = qualityTierBoost(quality);
    // Word count can unlock next tier; quality can jump extra steps
    const nextMult = (COMBO_MULTIPLIERS as readonly number[]).find(
      (m) => m > tier && words >= COMBO_TIER_RULES[m as ComboMultiplier].minWords,
    );
    if (nextMult) {
      tier = nextMult;
    }
    if (boost > 0) {
      tier = clampTier(tier + boost);
    }
  }

  tier = clampTier(tier);
  const mult = tier as ComboMultiplier;
  const windowMs = COMBO_TIER_RULES[mult].windowMs;
  const tierUp = !alive || tier > (prev.comboTier || 0);

  return {
    next: {
      comboTier: tier,
      comboWordsInWindow: words,
      comboExpiresAt: now + windowMs,
    },
    multiplier: tier,
    tierUp,
    broke: false,
  };
}

export function breakCombo(): ComboState {
  return blankCombo();
}

export function comboDisplayName(tier: number): string | null {
  if (tier < 3 || tier > 10) return null;
  return COMBO_TIER_NAMES[tier as ComboMultiplier];
}
