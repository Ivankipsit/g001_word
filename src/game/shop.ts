import type { GameMode, ShopItem } from "@/game/types";
import { modeHasIdleShop, modeHasLetterShop } from "@/game/types";
import { letterCost, MAX_LETTER_LEVEL } from "@/game/letters";

export const GENERATORS: ShopItem[] = [
  {
    id: "gen_scribe",
    kind: "generator",
    name: "Scribe Quill",
    description: "Gently scratches out a coin now and then.",
    baseCost: 50,
    cps: 0.2,
    maxOwned: 25,
  },
  {
    id: "gen_press",
    kind: "generator",
    name: "Word Press",
    description: "Stamps letters into spare change.",
    baseCost: 220,
    cps: 1.2,
    maxOwned: 20,
  },
  {
    id: "gen_library",
    kind: "generator",
    name: "Idle Library",
    description: "Shelves whisper coins while you rest.",
    baseCost: 900,
    cps: 6,
    maxOwned: 15,
  },
  {
    id: "gen_forge",
    kind: "generator",
    name: "Lexicon Forge",
    description: "The heart of Word Forge — steady wealth.",
    baseCost: 3500,
    cps: 28,
    maxOwned: 10,
  },
];

export function generatorCost(item: ShopItem, owned: number): number {
  return Math.floor(item.baseCost * Math.pow(1.45, owned));
}

export function totalCps(generators: Record<string, number>): number {
  let cps = 0;
  for (const item of GENERATORS) {
    const n = generators[item.id] ?? 0;
    cps += n * (item.cps ?? 0);
  }
  return cps;
}

export interface LetterShopEntry extends ShopItem {
  cost: number;
  /** 0 = locked; 1+ = mastery level */
  level: number;
  owned: boolean;
  maxLevel: number;
}

/**
 * Letter shop: first purchase unlocks into the pool; further buys raise mastery
 * (score bonus when the letter appears in a word). Not extra tile copies.
 */
export function letterShopItems(
  ownedLetters: string[],
  letterLevels: Record<string, number>,
  opts?: { /** Daily: only these letters can be upgraded; no new unlocks */ poolOnly?: string[] },
): LetterShopEntry[] {
  const owned = new Set(ownedLetters.map((L) => L.toUpperCase()));
  const alphabet = opts?.poolOnly
    ? opts.poolOnly.map((L) => L.toUpperCase())
    : "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  return alphabet.map((letter) => {
    const level = owned.has(letter) ? (letterLevels[letter] ?? 1) : 0;
    const cost = letterCost(letter, level);
    return {
      id: `letter_${letter}`,
      kind: "letter" as const,
      name: `Letter ${letter}`,
      description:
        level === 0
          ? `Unlock ${letter} for your letter pool.`
          : `Raise ${letter} mastery to Lv ${level + 1} (+score when used).`,
      baseCost: letterCost(letter, 0),
      letter,
      cost,
      level,
      owned: level > 0,
      maxLevel: MAX_LETTER_LEVEL,
      maxOwned: MAX_LETTER_LEVEL,
    };
  });
}

/** True when the player can buy at least one available shop item. */
export function canAffordAnyShopItem(
  coins: number,
  ownedLetters: string[],
  letterLevels: Record<string, number>,
  generators: Record<string, number>,
  mode: GameMode,
): boolean {
  if (modeHasIdleShop(mode)) {
    for (const g of GENERATORS) {
      const owned = generators[g.id] ?? 0;
      if (g.maxOwned != null && owned >= g.maxOwned) continue;
      if (coins >= generatorCost(g, owned)) return true;
    }
  }
  if (modeHasLetterShop(mode)) {
    const poolOnly = mode === "daily" ? ownedLetters : undefined;
    for (const item of letterShopItems(ownedLetters, letterLevels, { poolOnly })) {
      if (item.level >= item.maxLevel) continue;
      if (coins >= item.cost) return true;
    }
  }
  return false;
}
