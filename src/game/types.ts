import type { WordRarity } from "@/dictionary/LanguageWorld";

/** Save schema version. Saves from any other version are discarded on load. */
export const SAVE_VERSION = 1 as const;

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
  | "echo"
  | "pin"
  | "pinDaily"
  | "wordle"
  | "wordleDaily"
  | "pos"
  | "sense"
  | "inflect"
  | "synonym"
  | "antonym"
  | "blank"
  | "origin"
  | "homophone"
  | "pronounce"
  | "register"
  | "kind"
  | "kin"
  | "relay"
  | "double"
  | "trap"
  | "decoy"
  | "hunt";

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
  "pin",
  "pinDaily",
  "wordle",
  "wordleDaily",
  "pos",
  "sense",
  "inflect",
  "synonym",
  "antonym",
  "blank",
  "origin",
  "homophone",
  "pronounce",
  "register",
  "kind",
  "kin",
  "relay",
  "double",
  "trap",
  "decoy",
  "hunt",
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
  /** New id per fresh run; cloud merge only unions words within the same run. */
  runId: string;
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
  /** Consecutive valid words; drives the chain bonus in scoring. */
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
  /** Wordle: 4, 5, or 6 */
  wordleLength?: 4 | 5 | 6;
  wordleSecret?: string;
  wordleGuesses?: string[];
  /** Pin: 1 easy, 2 hard */
  pinLocks?: 1 | 2;
  pinSecret?: string;
  /** Indexes into pinSecret that are fixed */
  pinSlots?: number[];
  puzzleStatus?: "play" | "won" | "lost";
  /** Lockstep / Wordle: secret indexes opened by hints */
  puzzleRevealed?: number[];
  /** Field modes: later targets in a family, each `word\u001fclue` */
  clueQueue?: string[];
  /** Field modes: other spelling, other gloss, relay step, or "reopen" */
  clueNote?: string;
}

export interface GameSave {
  version: typeof SAVE_VERSION;
  activeMode: GameMode;
  started: boolean;
  settings: {
    soundEnabled: boolean;
    theme: ThemePreference;
    displayName?: string;
  };
  modes: Partial<Record<GameMode, ModeSave>>;
  /** Player-wide progress; survives mode resets. Synced via profiles.progress. */
  progress: PlayerProgress;
  /** Cloud rows to delete for this user before the next merge (reset / new game). */
  pendingRemoteDeletes?: PendingRemoteDeletes | null;
}

export interface PlayerProgress {
  /** UTC dates (YYYY-MM-DD) with at least one daily completed, sorted ascending. */
  dailyDays: string[];
  /** Achievement id -> ISO time unlocked. */
  achievements: Record<string, string>;
  /** Clue/Thread targets solved without any hint. */
  hintFreeSolves: number;
}

export interface PendingRemoteDeletes {
  userId: string;
  modes: GameMode[] | "all";
}

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
  rarity?: WordRarity;
  /** Field modes: share of points kept after hints (1 = no hints). */
  hintPenalty?: number;
  /** Decoy: two glosses, one of them matches the clue */
  choices?: [string, string];
  correctIndex?: number;
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
    case "pin":
      return "Lockstep";
    case "pinDaily":
      return "Daily Lock";
    case "wordle":
      return "Wordle";
    case "wordleDaily":
      return "Daily Wordle";
    case "pos":
      return "Part of Speech";
    case "sense":
      return "Other Sense";
    case "inflect":
      return "Inflection";
    case "synonym":
      return "Synonym";
    case "antonym":
      return "Antonym";
    case "blank":
      return "Blank Line";
    case "origin":
      return "Origin";
    case "homophone":
      return "Homophone";
    case "pronounce":
      return "Pronounce";
    case "register":
      return "Register";
    case "kind":
      return "Kind Of";
    case "kin":
      return "Kin";
    case "relay":
      return "Relay";
    case "double":
      return "Double Life";
    case "trap":
      return "Homophone Trap";
    case "decoy":
      return "Decoy Gloss";
    case "hunt":
      return "Register Hunt";
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
    case "pin":
      return "One or two letters fixed in place";
    case "pinDaily":
      return "UTC word · easy or hard pins";
    case "wordle":
      return "4, 5, or 6 letters · six guesses";
    case "wordleDaily":
      return "One shared word per length each UTC day";
    case "pos":
      return "Noun, verb, or adjective";
    case "sense":
      return "The less obvious meaning";
    case "inflect":
      return "Spell the plural or past form";
    case "synonym":
      return "Another word for it";
    case "antonym":
      return "Spell the opposite";
    case "blank":
      return "Fill the missing word";
    case "origin":
      return "Clue is the etymology";
    case "homophone":
      return "Type this spelling, not the twin";
    case "pronounce":
      return "Read the pronunciation";
    case "register":
      return "Usage tag plus a gloss";
    case "kind":
      return "A kind of something";
    case "kin":
      return "One family, clue by clue";
    case "relay":
      return "The clue type flips each word";
    case "double":
      return "Same spelling, other entry";
    case "trap":
      return "Reject the lookalike spelling";
    case "decoy":
      return "Pick the meaning that matches";
    case "hunt":
      return "Tagged words raise the combo";
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
    mode === "echo" ||
    mode === "pos" ||
    mode === "sense" ||
    mode === "inflect" ||
    mode === "synonym" ||
    mode === "antonym" ||
    mode === "blank" ||
    mode === "origin" ||
    mode === "homophone" ||
    mode === "pronounce" ||
    mode === "register" ||
    mode === "kind" ||
    mode === "kin" ||
    mode === "relay" ||
    mode === "double" ||
    mode === "trap" ||
    mode === "decoy" ||
    mode === "hunt"
  );
}

/** Timed round modes that reuse scrambleEndsAt / round active flags. */
export function modeIsWordle(mode: GameMode): boolean {
  return mode === "wordle" || mode === "wordleDaily";
}

export function modeIsPin(mode: GameMode): boolean {
  return mode === "pin" || mode === "pinDaily";
}

export function modeIsTimedRound(mode: GameMode): boolean {
  return mode === "scramble" || mode === "heat";
}

/** One board per UTC day. No replay until the date changes. */
export function modeIsDaily(mode: GameMode): boolean {
  return mode === "daily" || mode === "pinDaily" || mode === "wordleDaily";
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
