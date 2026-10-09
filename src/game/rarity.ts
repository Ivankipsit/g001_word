import type { WordRarity } from "@/dictionary/LanguageWorld";

export const RARITIES: WordRarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

export const RARITY_LABEL: Record<WordRarity, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
};

/** Fixed hues; the theme palette has no blue/purple/gold slots that fit. */
export const RARITY_COLOR: Record<WordRarity, string> = {
  common: "#9E9E9E",
  uncommon: "#4CAF50",
  rare: "#4A90D9",
  epic: "#9B59B6",
  legendary: "#D4A017",
};

export const RARITY_SCORE_BONUS: Record<WordRarity, number> = {
  common: 0,
  uncommon: 5,
  rare: 15,
  epic: 30,
  legendary: 50,
};
