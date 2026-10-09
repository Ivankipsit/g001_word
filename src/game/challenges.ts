import { EnglishWorld } from "@/dictionary/english";
import {
  FORGE_START_SIZE,
  countFormableWordsFromSet,
  pickUniqueStartLetters,
  pickWeightedLetter,
} from "@/game/letters";

const FALLBACK_DEFS = new Set([
  "A familiar English word.",
  "A somewhat uncommon English word.",
  "A rarer English word worth learning.",
  "A rare or lengthy English word — excellent!",
]);

/** Common affixes for Affix mode (prefix or suffix). */
export const AFFIX_OPTIONS = [
  { id: "un", label: "UN-", kind: "prefix" as const, match: "un" },
  { id: "re", label: "RE-", kind: "prefix" as const, match: "re" },
  { id: "pre", label: "PRE-", kind: "prefix" as const, match: "pre" },
  { id: "dis", label: "DIS-", kind: "prefix" as const, match: "dis" },
  { id: "ing", label: "-ING", kind: "suffix" as const, match: "ing" },
  { id: "ed", label: "-ED", kind: "suffix" as const, match: "ed" },
  { id: "ly", label: "-LY", kind: "suffix" as const, match: "ly" },
  { id: "ness", label: "-NESS", kind: "suffix" as const, match: "ness" },
  { id: "ful", label: "-FUL", kind: "suffix" as const, match: "ful" },
  { id: "less", label: "-LESS", kind: "suffix" as const, match: "less" },
] as const;

export type AffixOption = (typeof AFFIX_OPTIONS)[number];

export const LADDER_MIN = 3;
export const LADDER_MAX = 8;

const RARE_PICKS = ["J", "K", "Q", "V", "X", "Z"] as const;

export function wordHasAffix(word: string, affixMatch: string): boolean {
  const w = word.toLowerCase();
  const a = affixMatch.toLowerCase();
  return w.includes(a);
}

export function pickAffixStartLetters(
  affixMatch: string,
  count = FORGE_START_SIZE,
): string[] {
  const need = new Set(affixMatch.toUpperCase().split(""));
  const base = [...need];
  for (let attempt = 0; attempt < 60; attempt++) {
    const rest = pickUniqueStartLetters(count + 4).filter((L) => !need.has(L));
    const letters = [...base, ...rest].slice(0, count);
    // Ensure we kept affix letters
    for (const L of need) {
      if (!letters.includes(L) && letters.length < count) letters.push(L);
    }
    const n = countFormableWordsFromSet(letters, EnglishWorld, {
      limit: 30,
    });
    const owned = new Set(letters.map((L) => L.toLowerCase()));
    let affixHits = 0;
    for (const entry of EnglishWorld.listWords()) {
      if (entry.word.length < 3) continue;
      if (!wordHasAffix(entry.word, affixMatch)) continue;
      let ok = true;
      for (let i = 0; i < entry.word.length; i++) {
        if (!owned.has(entry.word[i]!)) {
          ok = false;
          break;
        }
      }
      if (ok) {
        affixHits += 1;
        if (affixHits >= 5) return letters.slice(0, count);
      }
    }
    if (n >= 5 && affixHits >= 2) return letters.slice(0, count);
  }
  return [...base, "E", "A", "R", "T", "S"].filter(
    (L, i, arr) => arr.indexOf(L) === i,
  ).slice(0, count);
}

export function pickRareStartLetters(
  rare: string,
  count = FORGE_START_SIZE,
): string[] {
  const R = rare.toUpperCase();
  for (let attempt = 0; attempt < 80; attempt++) {
    const rest = pickUniqueStartLetters(count + 3).filter((L) => L !== R);
    const letters = [R, ...rest].slice(0, count);
    while (letters.length < count) {
      const L = pickWeightedLetter();
      if (!letters.includes(L)) letters.push(L);
    }
    const owned = new Set(letters.map((L) => L.toLowerCase()));
    const rare = R.toLowerCase();
    let hits = 0;
    for (const entry of EnglishWorld.listWords()) {
      if (entry.word.length < 3 || !entry.word.includes(rare)) continue;
      let ok = true;
      for (let i = 0; i < entry.word.length; i++) {
        if (!owned.has(entry.word[i]!)) {
          ok = false;
          break;
        }
      }
      if (ok) {
        hits += 1;
        if (hits >= 8) return letters;
      }
    }
  }
  return [R, "E", "A", "R", "T"].filter((L, i, a) => a.indexOf(L) === i).slice(
    0,
    count,
  );
}

export function randomRareLetter(): string {
  return RARE_PICKS[Math.floor(Math.random() * RARE_PICKS.length)]!;
}

export interface DefinePuzzle {
  target: string;
  definition: string;
  letters: string[];
}

const GENERIC = /familiar English|somewhat uncommon|rarer English|lengthy English/i;

/**
 * Pick a definition puzzle: real-ish definition + letter tiles from the word
 * (unique letters of the target, padded with fillers if short).
 */
export function pickDefinePuzzle(exclude: Set<string> = new Set()): DefinePuzzle {
  const candidates: DefinePuzzle[] = [];
  for (const entry of EnglishWorld.listWords()) {
    const w = entry.word;
    if (w.length < 4 || w.length > 8) continue;
    if (exclude.has(w)) continue;
    if (!entry.definition || GENERIC.test(entry.definition)) continue;
    if (FALLBACK_DEFS.has(entry.definition)) continue;
    const unique = [...new Set(w.toUpperCase().split(""))];
    let letters = [...unique];
    while (letters.length < Math.min(7, unique.length + 2)) {
      const L = pickWeightedLetter();
      if (!letters.includes(L)) letters.push(L);
    }
    // Shuffle copy
    letters = letters
      .map((L) => ({ L, r: Math.random() }))
      .sort((a, b) => a.r - b.r)
      .map((x) => x.L);
    candidates.push({
      target: w,
      definition: entry.definition,
      letters,
    });
    if (candidates.length >= 80) break;
  }
  if (candidates.length === 0) {
    return {
      target: "rate",
      definition: "A measure, speed, or price.",
      letters: ["R", "A", "T", "E", "S", "L"],
    };
  }
  return candidates[Math.floor(Math.random() * candidates.length)]!;
}
