import { EnglishWorld } from "@/dictionary/english";

export const WORDLE_GUESSES = 6;
export type WordleLength = 4 | 5 | 6;
export type TileMark = "correct" | "present" | "absent";

const byLength = new Map<number, string[]>();

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

function wordsOfLength(length: number): string[] {
  const cached = byLength.get(length);
  if (cached) return cached;
  const list: string[] = [];
  for (const entry of EnglishWorld.listWords()) {
    if (entry.word.length === length) list.push(entry.word);
  }
  byLength.set(length, list);
  return list;
}

export function dailyWord(dateUtc: string, length: WordleLength): string | null {
  const list = wordsOfLength(length);
  if (list.length === 0) return null;
  return list[fnv1a(`wordle:${dateUtc}:${length}`) % list.length]!;
}

export function randomWordOfLength(length: WordleLength): string | null {
  const list = wordsOfLength(length);
  if (list.length === 0) return null;
  return list[Math.floor(Math.random() * list.length)]!;
}

export function markGuess(guess: string, secret: string): TileMark[] {
  const marks: TileMark[] = Array.from({ length: guess.length }, () => "absent");
  const leftover = new Map<string, number>();
  for (let i = 0; i < secret.length; i++) {
    if (guess[i] === secret[i]) marks[i] = "correct";
    else leftover.set(secret[i]!, (leftover.get(secret[i]!) ?? 0) + 1);
  }
  for (let i = 0; i < guess.length; i++) {
    if (marks[i] === "correct") continue;
    const n = leftover.get(guess[i]!) ?? 0;
    if (n > 0) {
      marks[i] = "present";
      leftover.set(guess[i]!, n - 1);
    }
  }
  return marks;
}

/** Distinct pin indexes. Hard boards need at least 5 letters. */
function choosePinSlots(secret: string, locks: 1 | 2, seed: number): number[] {
  const count = Math.min(locks, secret.length);
  const order = secret.split("").map((_, i) => i);
  let x = seed >>> 0;
  for (let i = order.length - 1; i > 0; i--) {
    x = lcgNext(x);
    const j = x % (i + 1);
    const a = order[i]!;
    order[i] = order[j]!;
    order[j] = a;
  }
  return order.slice(0, count).sort((a, b) => a - b);
}

function inPinRange(length: number, locks: 1 | 2): boolean {
  if (locks === 2) return length >= 5 && length <= 8;
  return length >= 4 && length <= 7;
}

export function dailyPinSecret(dateUtc: string, locks: 1 | 2): string | null {
  let count = 0;
  for (const entry of EnglishWorld.listWords()) {
    if (inPinRange(entry.word.length, locks)) count += 1;
  }
  if (count === 0) return null;
  const target = fnv1a(`pin:${dateUtc}:${locks}`) % count;
  let index = 0;
  for (const entry of EnglishWorld.listWords()) {
    if (!inPinRange(entry.word.length, locks)) continue;
    if (index === target) return entry.word;
    index += 1;
  }
  return null;
}

export function formableSecret(
  letters: string[],
  locks: 1 | 2,
  exclude: Set<string>,
): string | null {
  const allowed = new Set(letters.map((L) => L.toLowerCase()));
  const pool: string[] = [];
  for (const entry of EnglishWorld.listWords()) {
    const w = entry.word;
    if (!inPinRange(w.length, locks) || exclude.has(w)) continue;
    let ok = true;
    for (let i = 0; i < w.length; i++) {
      if (!allowed.has(w[i]!)) {
        ok = false;
        break;
      }
    }
    if (ok) pool.push(w);
  }
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)]!;
}

export function pinBoardFor(secret: string, locks: 1 | 2, seedKey: string) {
  const slots = choosePinSlots(secret, locks, fnv1a(seedKey));
  const locked = new Set(slots);
  const pool: string[] = [];
  for (let i = 0; i < secret.length; i++) {
    if (!locked.has(i)) pool.push(secret[i]!.toUpperCase());
  }
  return { slots, pool };
}

/** Indexes already shown as green in earlier Wordle guesses. */
export function correctSlots(guesses: string[], secret: string): number[] {
  const found = new Set<number>();
  for (const guess of guesses) {
    const marks = markGuess(guess, secret);
    for (let i = 0; i < marks.length; i++) {
      if (marks[i] === "correct") found.add(i);
    }
  }
  return [...found];
}

/** Next secret index to open. Prefers a letter that is not already visible. */
export function nextHintSlot(secret: string, known: number[]): number | null {
  const taken = new Set(known);
  const hidden: number[] = [];
  for (let i = 0; i < secret.length; i++) {
    if (!taken.has(i)) hidden.push(i);
  }
  if (hidden.length === 0) return null;
  const shown = new Set<string>();
  for (const i of taken) {
    const ch = secret[i];
    if (ch) shown.add(ch);
  }
  const fresh = hidden.filter((i) => !shown.has(secret[i]!));
  const pool = fresh.length > 0 ? fresh : hidden;
  return pool[Math.floor(Math.random() * pool.length)]!;
}
