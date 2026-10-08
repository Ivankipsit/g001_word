/** Versioned save schema — bump SAVE_VERSION and migrate when changing. */
export const SAVE_VERSION = 5 as const;

export type ScreenId = "play" | "shop" | "lexicon" | "settings";

export type GameMode =
  | "forge"
  | "keystone"
  | "scramble"
  | "daily"
  | "define"
  | "ladder"
  | "affix"
  | "rare"
  | "heat"
  | "echo";

export const ALL_MODES: GameMode[] = [
  "forge",
  "keystone",
  "scramble",
  "daily",
  "define",
  "ladder",
  "affix",
  "rare",
  "heat",
  "echo",
];

export type ThemePreference = "system" | "light" | "dark";

export interface DiscoveredWord {
  discoveredAt: number;
  bestScore: number;
  timesFound: number;
}

/** Per-mode progress blob (local map + one Supabase row per mode). */
export interface ModeSave {
  started: boolean;
  mode: GameMode;
  /** Uppercase A–Z when mode uses a key / rare letter */
  keystoneLetter?: string;
  /**
   * Letter pool. Most modes: unique letters (free reuse).
   * Scramble: multiset tiles for the round.
   */
  letters: string[];
  /** Mastery level per letter (1+ when owned). */
  letterLevels: Record<string, number>;
  coins: number;
  totalScore: number;
  discoveredWords: Record<string, DiscoveredWord>;
  /** Generator id → owned count */
  generators: Record<string, number>;
  /** @deprecated Prefer combo meter; kept for migrate */
  chainCount: number;
  lastTickAt: number;
  languageId: string;
  scrambleDurationSec?: number;
  scrambleEndsAt?: number | null;
  scrambleRoundActive?: boolean;
  scrambleRoundWords?: string[];
  dailyDateUtc?: string;
  defineTargetWord?: string;
  defineHint?: string;
  /** Define: letters revealed via hints (lowercase positions filled) */
  defineRevealed?: string[];
  /** Define: hints used on current puzzle */
  hintReveals?: number;
  ladderNextLength?: number;
  affixId?: string;
  affixMatch?: string;
  /** Combo meter: 0 inactive, else 3–10 */
  comboTier?: number;
  comboWordsInWindow?: number;
  comboExpiresAt?: number | null;
  /** Heat Wave: peak combo multiplier reached this round */
  heatPeakCombo?: number;
  /** Echo: last letter of previous word (uppercase); null until first word */
  echoLastLetter?: string | null;
}

export interface GameSaveV5 {
  version: typeof SAVE_VERSION;
  activeMode: GameMode;
  started: boolean;
  settings: {
    soundEnabled: boolean;
    theme: ThemePreference;
  };
  modes: Partial<Record<GameMode, ModeSave>>;
}

export type GameSave = GameSaveV5;

export interface ScoreBreakdown {
  base: number;
  firstDiscoveryBonus: number;
  rareLetterBonus: number;
  chainBonus: number;
  keystoneBonus: number;
  masteryBonus: number;
  comboMultiplier: number;
  totalBeforeCombo: number;
  total: number;
  isFirstDiscovery: boolean;
  chainCount: number;
  keystoneApplied: boolean;
}

export interface ShopItem {
  id: string;
  kind: "letter" | "generator";
  name: string;
  description: string;
  baseCost: number;
  letter?: string;
  cps?: number;
  maxOwned?: number;
}

export interface ScorePopEvent {
  id: string;
  word: string;
  total: number;
  isFirstDiscovery: boolean;
  definition: string | null;
  keystoneApplied?: boolean;
  keystoneBonus?: number;
  masteryBonus?: number;
  comboMultiplier?: number;
  comboName?: string | null;
  tierUp?: boolean;
  wordQuality?: "standard" | "good" | "great";
}

export function modeDisplayName(mode: GameMode): string {
  switch (mode) {
    case "forge":
      return "Word Forge";
    case "keystone":
      return "Keystone";
    case "scramble":
      return "Blitz Rack";
    case "daily":
      return "Dawn Glyph";
    case "define":
      return "Cipher Clue";
    case "ladder":
      return "Rung Rush";
    case "affix":
      return "Affix Arc";
    case "rare":
      return "Rarefire";
    case "heat":
      return "Heat Wave";
    case "echo":
      return "Echo";
  }
}

export function modeBlurb(mode: GameMode): string {
  switch (mode) {
    case "forge":
      return "Classic idle craft";
    case "keystone":
      return "Bonus letter focus";
    case "scramble":
      return "Timed 6-letter rush";
    case "daily":
      return "Daily UTC Keystone";
    case "define":
      return "Build the word from the meaning";
    case "ladder":
      return "Climb 3→8 letter lengths";
    case "affix":
      return "Prefix/suffix locked";
    case "rare":
      return "Must burn a rare letter";
    case "heat":
      return "90s — push combo as high as you can";
    case "echo":
      return "Next word starts with the last letter";
  }
}

export function modeUsesLetterSet(mode: GameMode): boolean {
  return (
    mode === "forge" ||
    mode === "keystone" ||
    mode === "daily" ||
    mode === "define" ||
    mode === "ladder" ||
    mode === "affix" ||
    mode === "rare" ||
    mode === "heat" ||
    mode === "echo"
  );
}

/** Timed round modes that reuse scrambleEndsAt / round active flags. */
export function modeIsTimedRound(mode: GameMode): boolean {
  return mode === "scramble" || mode === "heat";
}

export function modeHasLetterShop(mode: GameMode): boolean {
  return mode === "forge" || mode === "keystone" || mode === "daily" || mode === "rare";
}

export function modeHasIdleShop(mode: GameMode): boolean {
  return mode === "forge" || mode === "keystone" || mode === "daily" || mode === "rare";
}

export function modeRequiresKeyLetter(mode: GameMode): boolean {
  return mode === "daily" || mode === "rare";
}

export function modeKeyLetterBonusOnly(mode: GameMode): boolean {
  return mode === "keystone";
}

export const HINT_COST_DEFINE_BASE = 15;
export const HINT_COST_DEFINE_STEP = 5;
export const HINT_COST_GENERAL = 25;
