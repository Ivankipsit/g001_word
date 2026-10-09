import { EnglishWorld } from "@/dictionary/english";
import type { DictionaryEntry } from "@/dictionary/LanguageWorld";

let pool: DictionaryEntry[] | null = null;
let poolSize = -1;

/** Glosses like "simple past and past participle of revalue" or "plural of fox". */
const INFLECTION_GLOSS =
  /\b(participle|plural|singular|past tense|simple past|comparative|superlative|form|spelling|indicative)\s+(form\s+)?of\b/i;

/** Names, places, and pointer glosses make poor words of the day. */
const NAME_GLOSS =
  /\b(surname|given name|transliteration|ellipsis of|abbreviation of|an? (\w+ ){0,2}(city|town|village|river|county|municipality|province|region|country)\b)/i;

const INFLECTION_ENDINGS: [string, string][] = [
  ["ies", "y"],
  ["es", ""],
  ["s", ""],
  ["ied", "y"],
  ["ed", "e"],
  ["ed", ""],
  ["ing", "e"],
  ["ing", ""],
  ["ers", ""],
  ["er", ""],
];

/** Plurals and verb forms copy the base word's gloss, so prefer the base word. */
function hasBaseForm(word: string): boolean {
  for (const [end, add] of INFLECTION_ENDINGS) {
    if (!word.endsWith(end)) continue;
    const base = word.slice(0, -end.length) + add;
    if (base.length >= 3 && EnglishWorld.isValidWord(base)) return true;
  }
  return false;
}

/**
 * Rare-tier words (real but seldom used), 5–10 letters, with a real gloss.
 * Epic and legendary are mostly inflections and obscure forms, so they are skipped.
 */
function candidates(): DictionaryEntry[] {
  if (pool && poolSize === EnglishWorld.wordCount) return pool;
  const list: DictionaryEntry[] = [];
  for (const entry of EnglishWorld.listWords()) {
    if (entry.word.length < 5 || entry.word.length > 10) continue;
    if (entry.rarity !== "rare") continue;
    if (!entry.definition || entry.definition.length < 12) continue;
    if (INFLECTION_GLOSS.test(entry.definition) || NAME_GLOSS.test(entry.definition)) continue;
    if (hasBaseForm(entry.word)) continue;
    list.push(entry);
  }
  pool = list;
  poolSize = EnglishWorld.wordCount;
  return list;
}

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Same word for every player on a UTC date. */
export function wordOfDay(dateUtc: string): DictionaryEntry | null {
  const list = candidates();
  if (list.length === 0) return null;
  return list[hash(`word-of-day:${dateUtc}`) % list.length]!;
}
