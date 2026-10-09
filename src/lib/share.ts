import { EnglishWorld } from "@/dictionary/english";
import { DAILY_GOAL } from "@/game/letters";
import { markGuess, WORDLE_GUESSES, type TileMark } from "@/game/puzzles";
import { modeDisplayName, type GameMode, type ModeSave } from "@/game/types";
import { formatPoints } from "@/lib/points";

export interface SharePayload {
  title: string;
  text: string;
  url: string;
}

export type ShareResult = "shared" | "copied" | "cancelled" | "failed";

/** Native share sheet when available, otherwise copy text + link to the clipboard. */
export async function shareOrCopy(payload: SharePayload): Promise<ShareResult> {
  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share(payload);
      return "shared";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
    }
  }
  try {
    await navigator.clipboard.writeText(`${payload.text}\n${payload.url}`);
    return "copied";
  } catch {
    return "failed";
  }
}

export function appUrl(): string {
  return typeof window !== "undefined" ? window.location.origin : "";
}

export function invitePayload(displayName?: string): SharePayload {
  const name = displayName?.trim();
  return {
    title: "Word Forge",
    text: name
      ? `${name} invited you to Word Forge — forge words from letters, chase combos, and build your lexicon.`
      : "Play Word Forge with me — forge words from letters, chase combos, and build your lexicon.",
    url: appUrl(),
  };
}

const MARK_EMOJI: Record<TileMark, string> = {
  correct: "\u{1F7E9}",
  present: "\u{1F7E8}",
  absent: "\u2B1B",
};

/** Spoiler-free result for a finished daily. */
export function dailyResultPayload(mode: GameMode, save: ModeSave): SharePayload {
  const date = save.dailyDateUtc ?? "";
  const title = `${modeDisplayName(mode)} ${date}`;
  let body: string;
  if (mode === "wordleDaily" && save.wordleSecret) {
    const secret = save.wordleSecret;
    const guesses = save.wordleGuesses ?? [];
    const score = save.puzzleStatus === "won" ? guesses.length : "X";
    const grid = guesses
      .map((g) => markGuess(g, secret).map((m) => MARK_EMOJI[m]).join(""))
      .join("\n");
    body = `${title} · ${secret.length} letters · ${score}/${WORDLE_GUESSES}\n${grid}`;
  } else if (mode === "pinDaily") {
    const hints = save.hintReveals ?? 0;
    const outcome = save.puzzleStatus === "won" ? "Solved" : "Missed";
    const hintText = hints === 0 ? "no hints" : `${hints} ${hints === 1 ? "hint" : "hints"}`;
    body = `${title} · ${outcome} · ${hintText} · ${formatPoints(save.totalScore)} pts`;
  } else {
    const words = Object.keys(save.discoveredWords ?? {});
    let epic = 0;
    let legendary = 0;
    for (const w of words) {
      const r = EnglishWorld.getRarity(w);
      if (r === "epic") epic += 1;
      if (r === "legendary") legendary += 1;
    }
    const finds = [epic && `${epic} epic`, legendary && `${legendary} legendary`]
      .filter(Boolean)
      .join(" · ");
    body = `${title} · ${words.length}/${DAILY_GOAL} words · ${formatPoints(save.totalScore)} pts${finds ? ` · ${finds}` : ""}`;
  }
  return { title: "Word Forge daily", text: `${body}\nCan you beat it?`, url: appUrl() };
}

export function lexiconPayload(words: number, points: number): SharePayload {
  const noun = words === 1 ? "word" : "words";
  return {
    title: "My Word Forge lexicon",
    text: `I've forged ${words.toLocaleString()} ${noun} and ${formatPoints(points)} points in Word Forge. Can you beat it?`,
    url: appUrl(),
  };
}
