import { EnglishWorld } from "@/dictionary/english";
import type { LanguageWorld } from "@/dictionary/LanguageWorld";

const MIN_FORMABLE = 5;
const RANDOM_ATTEMPTS = 80;
export const FORGE_START_SIZE = 5;
export const SCRAMBLE_LETTER_COUNT = 6;
export const DAILY_LETTER_COUNT = 7;
export const MIN_FORMABLE_WORDS = MIN_FORMABLE;
export const MAX_LETTER_LEVEL = 10;

/** Weighted random letter using LanguageWorld weights. */
export function pickWeightedLetter(
  weights: Readonly<Record<string, number>> = EnglishWorld.letterWeights,
): string {
  const entries = Object.entries(weights);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let roll = Math.random() * total;
  for (const [letter, w] of entries) {
    roll -= w;
    if (roll <= 0) return letter;
  }
  return entries[entries.length - 1]?.[0] ?? "E";
}

export function pickRandomStartLetters(count = 5): string[] {
  return Array.from({ length: count }, () => pickWeightedLetter());
}

/** Unique weighted letters (no duplicates). */
export function pickUniqueStartLetters(count = 5): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  let guard = 0;
  while (out.length < count && guard < 200) {
    guard += 1;
    const L = pickWeightedLetter();
    if (seen.has(L)) continue;
    seen.add(L);
    out.push(L);
  }
  // Fill from alphabet if weights clustered
  for (const L of EnglishWorld.alphabet) {
    if (out.length >= count) break;
    if (!seen.has(L)) {
      seen.add(L);
      out.push(L);
    }
  }
  return out.slice(0, count);
}

/** Can `word` be formed from the multiset of owned letters? */
export function canFormWord(word: string, letters: string[]): boolean {
  const pool = new Map<string, number>();
  for (const L of letters) {
    const key = L.toUpperCase();
    pool.set(key, (pool.get(key) ?? 0) + 1);
  }
  for (const ch of word.toUpperCase()) {
    const n = pool.get(ch) ?? 0;
    if (n <= 0) return false;
    pool.set(ch, n - 1);
  }
  return true;
}

/**
 * Set-pool rule: every letter in the word must appear in the unlocked set
 * (letters may be reused freely — no multiset consumption).
 */
export function canFormWordFromSet(word: string, letters: string[]): boolean {
  const set = new Set(letters.map((L) => L.toUpperCase()));
  if (set.size === 0) return false;
  for (const ch of word.toUpperCase()) {
    if (!set.has(ch)) return false;
  }
  return true;
}

/**
 * Count dictionary words formable from a multiset pick
 * (length ≤ letters.length).
 */
export function countFormableWords(
  letters: string[],
  world: LanguageWorld = EnglishWorld,
): number {
  if (letters.length === 0) return 0;
  const pool = new Map<string, number>();
  for (const L of letters) {
    const key = L.toLowerCase();
    pool.set(key, (pool.get(key) ?? 0) + 1);
  }
  const allowed = new Set(pool.keys());
  const maxLen = letters.length;

  let count = 0;
  for (const entry of world.listWords()) {
    const w = entry.word;
    if (w.length < world.minWordLength || w.length > maxLen) continue;
    let ok = true;
    for (let i = 0; i < w.length; i++) {
      if (!allowed.has(w[i]!)) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    if (canFormFromPool(w, pool)) count += 1;
  }
  return count;
}

/**
 * Count dictionary words using only letters from the set (free reuse).
 * Caps scan by skipping words with foreign letters.
 */
export function countFormableWordsFromSet(
  letters: string[],
  world: LanguageWorld = EnglishWorld,
  opts?: { mustInclude?: string; limit?: number },
): number {
  if (letters.length === 0) return 0;
  const allowed = new Set(letters.map((L) => L.toLowerCase()));
  const must = opts?.mustInclude?.toLowerCase();
  const limit = opts?.limit ?? 500;
  let count = 0;
  for (const entry of world.listWords()) {
    const w = entry.word;
    if (w.length < world.minWordLength) continue;
    if (must && !w.includes(must)) continue;
    let ok = true;
    for (let i = 0; i < w.length; i++) {
      if (!allowed.has(w[i]!)) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    count += 1;
    if (count >= limit) return count;
  }
  return count;
}

/** Starter pack for Keystone: keystone letter + unique playable fillers. */
export function pickKeystoneStartLetters(
  keystone: string,
  count = FORGE_START_SIZE,
  world: LanguageWorld = EnglishWorld,
): string[] {
  const K = keystone.toUpperCase();
  const fillers = count - 1;
  for (let attempt = 0; attempt < RANDOM_ATTEMPTS; attempt++) {
    const rest = pickUniqueStartLetters(Math.max(0, fillers + 4))
      .filter((L) => L !== K)
      .slice(0, Math.max(0, fillers));
    const letters = [K, ...rest];
    if (
      letters.length === count &&
      countFormableWordsFromSet(letters, world, { limit: MIN_FORMABLE }) >=
        MIN_FORMABLE
    ) {
      return letters;
    }
  }
  const fallback = [K, "E", "A", "R", "T"].filter(
    (L, i, arr) => arr.indexOf(L) === i,
  );
  while (fallback.length < count) {
    const L = pickWeightedLetter();
    if (!fallback.includes(L)) fallback.push(L);
  }
  return fallback.slice(0, count);
}

function canFormFromPool(word: string, pool: Map<string, number>): boolean {
  const used = new Map<string, number>();
  for (let i = 0; i < word.length; i++) {
    const ch = word[i]!;
    const need = (used.get(ch) ?? 0) + 1;
    if ((pool.get(ch) ?? 0) < need) return false;
    used.set(ch, need);
  }
  return true;
}

/** Re-roll unique starts until ≥ minFormable words (or best effort). */
export function pickPlayableStartLetters(
  count = 5,
  minFormable = MIN_FORMABLE,
  maxAttempts = RANDOM_ATTEMPTS,
  world: LanguageWorld = EnglishWorld,
): string[] {
  let best: string[] = pickUniqueStartLetters(count);
  let bestCount = countFormableWordsFromSet(best, world, {
    limit: minFormable + 20,
  });

  for (let i = 0; i < maxAttempts; i++) {
    const candidate = pickUniqueStartLetters(count);
    const n = countFormableWordsFromSet(candidate, world, {
      limit: minFormable + 20,
    });
    if (n > bestCount) {
      best = candidate;
      bestCount = n;
    }
    if (n >= minFormable) return candidate;
  }
  return best;
}

/**
 * Scramble: exactly `count` letters; no letter more than twice (0–2 copies).
 */
export function pickScrambleLetters(
  count = SCRAMBLE_LETTER_COUNT,
  world: LanguageWorld = EnglishWorld,
): string[] {
  let best: string[] = [];
  let bestCount = -1;

  for (let attempt = 0; attempt < RANDOM_ATTEMPTS; attempt++) {
    const counts = new Map<string, number>();
    const letters: string[] = [];
    let guard = 0;
    while (letters.length < count && guard < 300) {
      guard += 1;
      const L = pickWeightedLetter();
      if ((counts.get(L) ?? 0) >= 2) continue;
      counts.set(L, (counts.get(L) ?? 0) + 1);
      letters.push(L);
    }
    if (letters.length < count) continue;
    const n = countFormableWords(letters, world);
    if (n > bestCount) {
      best = letters;
      bestCount = n;
    }
    if (n >= MIN_FORMABLE) return letters;
  }
  return best.length === count
    ? best
    : ["E", "A", "R", "T", "S", "L"].slice(0, count);
}

function fnv1a(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function lcgNext(x: number): number {
  return (Math.imul(x, 1664525) + 1013904223) >>> 0;
}

/** UTC calendar day as YYYY-MM-DD. */
export function utcDateString(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** Ms until next UTC midnight. */
export function msUntilNextUtcDay(now = new Date()): number {
  const next = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
  );
  return Math.max(0, next - now.getTime());
}

export function formatCountdown(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

export interface DailyBoard {
  dateUtc: string;
  keyLetter: string;
  letters: string[];
}

const VOWELS = new Set(["A", "E", "I", "O", "U"]);
/** Prefer these when building daily packs (more playable words). */
const DAILY_POOL = [
  "A", "E", "I", "O", "U",
  "R", "S", "T", "N", "L", "D", "C", "M", "H", "P", "B", "G", "F", "W", "Y",
  "V", "K",
] as const;
const MIN_DAILY_VOWELS = 2;
const MIN_DAILY_FORMABLE = 40;
/** Dawn Glyph counts as completed at this many words; every board has at least this many. */
export const DAILY_GOAL = MIN_DAILY_FORMABLE;
const MAX_DAILY_RARE = 2;

function vowelCount(letters: string[]): number {
  return letters.filter((L) => VOWELS.has(L.toUpperCase())).length;
}

function rareLetterCount(letters: string[]): number {
  return letters.filter((L) => EnglishWorld.rareLetters.has(L.toUpperCase()))
    .length;
}

/**
 * Deterministic Daily Keystone board for a UTC date (same for all players).
 * 7 unique letters including 1 key letter; words must include the key.
 * Rules: ≥2 vowels, ≤2 rare letters, ≥40 formable words with key.
 */
export function dailyBoardForDate(
  dateUtc: string = utcDateString(),
  world: LanguageWorld = EnglishWorld,
): DailyBoard {
  const pool = DAILY_POOL;
  for (let salt = 0; salt < 128; salt++) {
    let x = fnv1a(`word-forge-daily-v2:${dateUtc}:${salt}`);
    const letters: string[] = [];
    while (letters.length < DAILY_LETTER_COUNT) {
      const L = pool[x % pool.length]!;
      x = lcgNext(x);
      if (!letters.includes(L)) letters.push(L);
    }
    if (vowelCount(letters) < MIN_DAILY_VOWELS) continue;
    if (rareLetterCount(letters) > MAX_DAILY_RARE) continue;

    // Prefer Keystone as a vowel for fairness
    const vowelsIn = letters.filter((L) => VOWELS.has(L));
    const keyIdx =
      fnv1a(`word-forge-daily-key-v2:${dateUtc}:${salt}`) % vowelsIn.length;
    const keyLetter = vowelsIn[keyIdx] ?? letters[0]!;

    const ordered = [
      keyLetter,
      ...letters.filter((L) => L !== keyLetter),
    ];
    const n = countFormableWordsFromSet(ordered, world, {
      mustInclude: keyLetter,
      limit: MIN_DAILY_FORMABLE,
    });
    if (n >= MIN_DAILY_FORMABLE) {
      return { dateUtc, keyLetter, letters: ordered };
    }
  }

  // Deterministic playable fallback (always ≥2 vowels)
  const letters = ["E", "A", "R", "T", "S", "N", "L"];
  return {
    dateUtc,
    keyLetter: "E",
    letters,
  };
}

/** Tip when the pick is under the playability gate. */
export function playabilityTip(letters: string[], formable: number): string {
  if (formable >= MIN_FORMABLE) return "";
  const hasVowel = letters.some((L) => "AEIOU".includes(L.toUpperCase()));
  if (!hasVowel) return "Add a vowel — words need them.";
  if (letters.length < 5) return "Try a 5th letter, or tap Random.";
  return "Try Random for a more playable set.";
}

export function letterCost(letter: string, levelOrOwned: number): number {
  const rare = EnglishWorld.rareLetters.has(letter.toUpperCase());
  const base = rare ? 80 : letter.match(/[AEIOU]/i) ? 40 : 55;
  return Math.floor(base * Math.pow(1.35, levelOrOwned));
}

export function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}
