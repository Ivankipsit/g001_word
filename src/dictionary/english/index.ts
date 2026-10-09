import type {
  DictionaryEntry,
  LanguageWorld,
  WordRarity,
} from "@/dictionary/LanguageWorld";
import { MIN_WORD_LENGTH } from "@/game/constants";

const RARITY: WordRarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

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
  for (const [raw, definition, rarityIdx] of entries) {
    const word = raw.toLowerCase();
    byWord.set(word, {
      word,
      definition,
      rarity: RARITY[rarityIdx] ?? "common",
    });
  }
  loaded = true;
  EnglishWorld.wordCount = byWord.size;
}

const DICTIONARY_URL = "/dictionary/english-words.json.gz";

/** Gzip magic, or the JSON array if a proxy already inflated the body. */
async function readDictionaryEntries(res: Response): Promise<RawEntry[]> {
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const gzipped = bytes.byteLength >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
  const stream = gzipped
    ? new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"))
    : new Blob([buf]).stream();
  return (await new Response(stream).json()) as RawEntry[];
}

/** Fetch full English lexicon from public/ (keeps it out of the JS bundle). */
export function loadEnglishDictionary(): Promise<void> {
  if (loaded && byWord.size > 0) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const res = await fetch(DICTIONARY_URL);
    if (!res.ok) {
      throw new Error(`Dictionary HTTP ${res.status}`);
    }
    ingest(await readDictionaryEntries(res));
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

  listWords(): Iterable<DictionaryEntry> {
    return byWord.values();
  },
};

export const activeWorld: LanguageWorld = EnglishWorld;
