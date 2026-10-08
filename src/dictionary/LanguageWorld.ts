/**
 * LanguageWorld — seam for future multi-language support.
 * English implements this in v1; other languages can plug in later.
 */

export type WordRarity = "common" | "uncommon" | "rare" | "epic";

export interface DictionaryEntry {
  word: string;
  definition: string;
  rarity: WordRarity;
}

export interface LanguageWorld {
  /** Stable id, e.g. "en" */
  id: string;
  displayName: string;
  /** Uppercase A–Z (or language alphabet) */
  alphabet: readonly string[];
  /** Weighted random pick for start letters (higher = more common) */
  letterWeights: Readonly<Record<string, number>>;
  /** Letters that grant rare-letter scoring bonuses */
  rareLetters: ReadonlySet<string>;
  minWordLength: number;
  isValidWord(word: string): boolean;
  getDefinition(word: string): string | null;
  getRarity(word: string): WordRarity | null;
  getEntry(word: string): DictionaryEntry | null;
  /** Iterate all dictionary entries (for playability checks). */
  listWords(): Iterable<DictionaryEntry>;
  /** Approximate dictionary size for UI */
  wordCount: number;
}
