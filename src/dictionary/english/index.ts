import type {
  DictionaryEntry,
  LanguageWorld,
  WordRarity,
} from "@/dictionary/LanguageWorld";
import { MIN_WORD_LENGTH } from "@/game/constants";

const RARITY: WordRarity[] = ["common", "uncommon", "rare", "epic"];

type RawEntry = [string, string, number];

const byWord = new Map<string, DictionaryEntry>();

const ALPHABET = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
  "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
] as const;

const LETTER_WEIGHTS: Record<string, number> = {
  A: 12, E: 14, I: 11, O: 11, U: 8,
  R: 9, S: 10, T: 10, N: 9, L: 8, D: 7, C: 6, M: 6, H: 6, P: 5, B: 5, G: 5, F: 4, W: 4, Y: 4,
  V: 3, K: 3, J: 2, X: 1, Q: 1, Z: 1,
};

const RARE_LETTERS = new Set(["J", "K", "Q", "V", "X", "Z"]);

let loadPromise: Promise<void> | null = null;
let loaded = false;

function ingest(entries: RawEntry[]) {
  byWord.clear();
  for (const [word, definition, rarityIdx] of entries) {
    byWord.set(word.toLowerCase(), {
      word: word.toLowerCase(),
      definition,
      rarity: RARITY[rarityIdx] ?? "common",
    });
  }
  loaded = true;
  EnglishWorld.wordCount = byWord.size;
}

/** Fetch full English lexicon from public/ (keeps it out of the JS bundle). */
export function loadEnglishDictionary(): Promise<void> {
  if (loaded && byWord.size > 0) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const res = await fetch("/dictionary/english-words.json");
    if (!res.ok) {
      throw new Error(`Dictionary HTTP ${res.status}`);
    }
    const entries = (await res.json()) as RawEntry[];
    ingest(entries);
  })().catch((err) => {
    loadPromise = null;
    throw err;
  });
  return loadPromise;
}

export function isEnglishDictionaryReady(): boolean {
  return loaded && byWord.size > 0;
}

export const EnglishWorld: LanguageWorld = {
  id: "en",
  displayName: "English",
  alphabet: ALPHABET,
  letterWeights: LETTER_WEIGHTS,
  rareLetters: RARE_LETTERS,
  minWordLength: MIN_WORD_LENGTH,
  wordCount: 0,

  isValidWord(word: string): boolean {
    const w = word.trim().toLowerCase();
    if (w.length < this.minWordLength) return false;
    return byWord.has(w);
  },

  getDefinition(word: string): string | null {
    return byWord.get(word.trim().toLowerCase())?.definition ?? null;
  },

  getRarity(word: string): WordRarity | null {
    return byWord.get(word.trim().toLowerCase())?.rarity ?? null;
  },

  getEntry(word: string): DictionaryEntry | null {
    return byWord.get(word.trim().toLowerCase()) ?? null;
  },

  listWords(): Iterable<DictionaryEntry> {
    return byWord.values();
  },
};

export const activeWorld: LanguageWorld = EnglishWorld;
