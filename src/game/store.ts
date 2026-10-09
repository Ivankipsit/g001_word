"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { EnglishWorld } from "@/dictionary/english";
import { idbStorage } from "@/lib/idbStorage";
import { mergeModeSave, newRunId } from "@/game/saveMerge";
import { capPoints } from "@/lib/points";
import { achievementStats, newlyUnlocked } from "@/game/achievements";
import {
  blankProgress,
  dailyComplete,
  markDailyDone,
  mergeProgress,
  normalizeProgress,
} from "@/game/progress";
import {
  canFormWord,
  canFormWordFromSet,
  dailyBoardForDate,
  FORGE_START_SIZE,
  pickPlayableStartLetters,
  pickScrambleLetters,
  shuffleArray,
  utcDateString,
} from "@/game/letters";
import {
  LADDER_MAX,
  LADDER_MIN,
  pickDefinePuzzle,
  wordHasAffix,
} from "@/game/challenges";
import {
  advanceCombo,
  blankCombo,
  breakCombo,
  comboDisplayName,
  isComboAlive,
  wordQuality,
  type ComboState,
} from "@/game/combo";
import { computeOfflineEarnings } from "@/game/idle";
import { scoreWord } from "@/game/scoring";
import { wordRegister } from "@/dictionary/clues";
import {
  decoyChoices,
  fieldHasTarget,
  isFieldMode,
  nextFieldOpening,
} from "@/game/fieldModes";
import {
  correctSlots,
  formableSecret,
  nextHintSlot,
  pinBoardFor,
  WORDLE_GUESSES,
  type WordleLength,
} from "@/game/puzzles";
import {
  GENERATORS,
  generatorCost,
  letterShopItems,
  totalCps,
} from "@/game/shop";
import type {
  GameMode,
  GameSave,
  ModeSave,
  PendingRemoteDeletes,
  PlayerProgress,
  ScoreBreakdown,
  ScorePopEvent,
  ScreenId,
  ThemePreference,
} from "@/game/types";
import { MIN_WORD_LENGTH } from "@/game/constants";
import {
  ALL_MODES,
  HINT_COST_DEFINE_BASE,
  HINT_COST_DEFINE_STEP,
  HINT_COST_GENERAL,
  SAVE_VERSION,
  modeHasIdleShop,
  modeHasLetterShop,
  modeIsDaily,
  modeIsPin,
  modeIsTimedRound,
  modeIsWordle,
  modeRequiresKeyLetter,
  modeUsesLetterSet,
} from "@/game/types";

function blankModeSave(mode: GameMode): ModeSave {
  return {
    started: false,
    mode,
    runId: newRunId(),
    keystoneLetter: undefined,
    letters: [],
    letterLevels: {},
    coins: 0,
    totalScore: 0,
    discoveredWords: {},
    generators: {},
    chainCount: 0,
    lastTickAt: Date.now(),
    languageId: EnglishWorld.id,
    scrambleDurationSec: undefined,
    scrambleEndsAt: null,
    scrambleRoundActive: false,
    scrambleRoundWords: [],
    dailyDateUtc: undefined,
    defineTargetWord: undefined,
    defineHint: undefined,
    defineRevealed: undefined,
    hintReveals: undefined,
    ladderNextLength: undefined,
    affixId: undefined,
    affixMatch: undefined,
    comboTier: 0,
    comboWordsInWindow: 0,
    comboExpiresAt: null,
    heatPeakCombo: undefined,
    echoLastLetter: undefined,
    wordleLength: undefined,
    wordleSecret: undefined,
    wordleGuesses: undefined,
    pinLocks: undefined,
    pinSecret: undefined,
    pinSlots: undefined,
    puzzleStatus: undefined,
    puzzleRevealed: undefined,
    clueQueue: undefined,
    clueNote: undefined,
  };
}

function comboFromSave(s: ModeSave): ComboState {
  return {
    comboTier: s.comboTier ?? 0,
    comboWordsInWindow: s.comboWordsInWindow ?? 0,
    comboExpiresAt: s.comboExpiresAt ?? null,
  };
}

function blankRoot(): GameSave {
  return {
    version: SAVE_VERSION,
    activeMode: "forge",
    started: false,
    settings: { soundEnabled: true, theme: "system" },
    modes: {},
    progress: blankProgress(),
  };
}

/** Share of points kept on a clue target after this many hints (3 = word shown). */
const FIELD_HINT_KEEP = [1, 2 / 3, 1 / 3, 0] as const;
const FIELD_HINT_STEPS = 3;

/** A new clue target starts with no hints used. */
function withFreshHints(patch: Partial<ModeSave>): Partial<ModeSave> {
  if (patch.defineTargetWord === undefined) return patch;
  return { ...patch, hintReveals: 0, puzzleRevealed: [] };
}

function levelsFromLetters(letters: string[]): Record<string, number> {
  const levels: Record<string, number> = {};
  for (const L of letters) {
    const U = L.toUpperCase();
    if (!levels[U]) levels[U] = 1;
  }
  return levels;
}

export interface StartGameOptions {
  mode: GameMode;
  letters: string[];
  keystoneLetter?: string;
  scrambleDurationSec?: number;
  defineTargetWord?: string;
  defineHint?: string;
  ladderNextLength?: number;
  affixId?: string;
  affixMatch?: string;
  wordleLength?: WordleLength;
  wordleSecret?: string;
  pinLocks?: 1 | 2;
  pinSecret?: string;
  pinSlots?: number[];
  clueQueue?: string[];
  clueNote?: string;
}

interface GameStore extends ModeSave {
  version: typeof SAVE_VERSION;
  activeMode: GameMode;
  settings: GameSave["settings"];
  modes: Partial<Record<GameMode, ModeSave>>;

  screen: ScreenId;
  draft: string[];
  draftIndices: number[];
  lastScorePop: ScorePopEvent | null;
  lastOffline: { earned: number; cappedMs: number } | null;
  hydrated: boolean;
  /** Scramble results overlay after timer. */
  scrambleShowResults: boolean;
  /** Signed-in Supabase user (set by useCloudSync); not persisted. */
  cloudUserId: string | null;
  pendingRemoteDeletes: PendingRemoteDeletes | null;
  progress: PlayerProgress;
  /** Latest unlock to announce; not persisted. */
  lastAchievement: { id: string; title: string } | null;

  setScreen: (screen: ScreenId) => void;
  dismissAchievement: () => void;
  /** Merge cloud progress into local (union; never drops local unlocks). */
  applyRemoteProgress: (remote: PlayerProgress) => void;
  setHydrated: (v: boolean) => void;
  setCloudUserId: (id: string | null) => void;
  setDisplayName: (name: string) => void;
  /** Drop the entries a finished cloud delete handled; keeps anything queued since. */
  clearPendingRemoteDeletes: (handled: PendingRemoteDeletes) => void;
  startGame: (opts: StartGameOptions) => void;
  /** Stash active mode and return to mode picker — does not wipe other modes. */
  leaveToModePicker: () => void;
  /** Wipe all modes; keep theme. */
  resetGame: () => void;
  /** Load an existing mode save (or stay on picker if none). */
  resumeMode: (mode: GameMode) => boolean;
  toggleSound: () => void;
  setTheme: (theme: ThemePreference) => void;
  applyRemoteModes: (
    modes: Partial<Record<GameMode, ModeSave>>,
    activeMode?: GameMode,
    settings?: GameSave["settings"],
  ) => void;
  getPersistedSave: () => GameSave;
  getModeSavesForSync: () => Partial<Record<GameMode, ModeSave>>;
  toggleDraftLetter: (letterIndex: number) => void;
  clearDraft: () => void;
  backspaceDraft: () => void;
  submitWord: () => {
    ok: boolean;
    reason?: string;
    breakdown?: ScoreBreakdown;
  };
  buyLetter: (letter: string) => { ok: boolean; reason?: string };
  buyGenerator: (id: string) => { ok: boolean; reason?: string };
  buyHint: () => { ok: boolean; reason?: string; reveal?: string };
  /**
   * Lockstep / Wordle: meaning, a letter, another, the word.
   * Clue and Thread modes: a letter, another, the word (each costs points on that target).
   */
  revealPuzzleHint: () => {
    ok: boolean;
    reason?: string;
    kind?: "meaning" | "letter" | "word";
  };
  shuffleLetters: () => void;
  tickIdle: () => void;
  tickCombo: () => void;
  applyOfflineCatchUp: () => void;
  dismissScorePop: () => void;
  dismissOffline: () => void;
  endScrambleRound: () => void;
  dismissScrambleResults: () => void;
  submitWordleGuess: (guess: string) => { ok: boolean; reason?: string };
  submitPin: (attempt: string) => { ok: boolean; reason?: string };
  chooseDecoy: (index: number) => void;
  startScrambleRound: (durationSec?: number) => void;
  ensureDailyBoard: () => void;
  /** Wipe one mode save; return to picker. Daily: reset progress, keep board. */
  clearModeSave: (mode: GameMode) => void;
}

function extractModeSave(s: ModeSave): ModeSave {
  return {
    started: s.started,
    mode: s.mode,
    runId: s.runId,
    keystoneLetter: s.keystoneLetter,
    letters: s.letters,
    letterLevels: s.letterLevels ?? {},
    coins: s.coins,
    totalScore: s.totalScore,
    discoveredWords: s.discoveredWords,
    generators: s.generators,
    chainCount: s.chainCount,
    lastTickAt: s.lastTickAt,
    languageId: s.languageId,
    scrambleDurationSec: s.scrambleDurationSec,
    scrambleEndsAt: s.scrambleEndsAt,
    scrambleRoundActive: s.scrambleRoundActive,
    scrambleRoundWords: s.scrambleRoundWords,
    dailyDateUtc: s.dailyDateUtc,
    defineTargetWord: s.defineTargetWord,
    defineHint: s.defineHint,
    defineRevealed: s.defineRevealed,
    hintReveals: s.hintReveals,
    ladderNextLength: s.ladderNextLength,
    affixId: s.affixId,
    affixMatch: s.affixMatch,
    comboTier: s.comboTier ?? 0,
    comboWordsInWindow: s.comboWordsInWindow ?? 0,
    comboExpiresAt: s.comboExpiresAt ?? null,
    heatPeakCombo: s.heatPeakCombo,
    echoLastLetter: s.echoLastLetter ?? null,
    wordleLength: s.wordleLength,
    wordleSecret: s.wordleSecret,
    wordleGuesses: s.wordleGuesses,
    pinLocks: s.pinLocks,
    pinSecret: s.pinSecret,
    pinSlots: s.pinSlots,
    puzzleStatus: s.puzzleStatus,
    puzzleRevealed: s.puzzleRevealed,
    clueQueue: s.clueQueue,
    clueNote: s.clueNote,
  };
}

function stashActive(get: () => GameStore): Partial<Record<GameMode, ModeSave>> {
  const s = get();
  const modes = { ...s.modes };
  if (s.started || s.letters.length > 0 || s.coins > 0 || Object.keys(s.discoveredWords).length > 0) {
    modes[s.mode] = extractModeSave(s);
  }
  return modes;
}

function applyModeFields(modeSave: ModeSave) {
  return {
    ...extractModeSave(modeSave),
    draft: [] as string[],
    draftIndices: [] as number[],
    lastScorePop: null as ScorePopEvent | null,
    scrambleShowResults: Boolean(
      modeIsTimedRound(modeSave.mode) &&
        modeSave.started &&
        !modeSave.scrambleRoundActive &&
        (modeSave.scrambleRoundWords?.length ?? 0) > 0,
    ),
  };
}

function toPersisted(s: GameStore): GameSave {
  const modes = stashActive(() => s);
  return {
    version: SAVE_VERSION,
    activeMode: s.activeMode,
    started: s.started,
    settings: s.settings,
    modes,
    progress: s.progress,
    pendingRemoteDeletes: s.pendingRemoteDeletes,
  };
}

/** Register Hunt has no single target; a hint picks an unfound tagged word. */
function pickHuntTarget(s: ModeSave): string | null {
  let pick: string | null = null;
  let seen = 0;
  for (const entry of EnglishWorld.listWords()) {
    const w = entry.word;
    if (w.length < EnglishWorld.minWordLength || w.length > 8) continue;
    if (s.discoveredWords[w] || !canFormWordFromSet(w, s.letters) || !wordRegister(w)) continue;
    seen += 1;
    // Reservoir sample so the pick is not biased toward early letters.
    if (Math.random() * seen < 1) pick = w;
  }
  return pick;
}

function revealFieldHint(
  get: () => GameStore,
  set: (patch: Partial<GameStore>) => void,
): { ok: boolean; reason?: string; kind?: "letter" | "word" } {
  const state = get();
  if (state.clueNote === "pending") return { ok: false, reason: "Choose a meaning first" };
  let secret = state.defineTargetWord?.toLowerCase();
  let step = state.hintReveals ?? 0;
  let revealed = state.puzzleRevealed ?? [];
  if (state.mode === "hunt" && (!secret || state.discoveredWords[secret])) {
    secret = pickHuntTarget(state) ?? undefined;
    step = 0;
    revealed = [];
  }
  if (!secret) return { ok: false, reason: "No word to hint" };
  if (step >= FIELD_HINT_STEPS) return { ok: false, reason: "No hints left" };

  const idx = step < FIELD_HINT_STEPS - 1 ? nextHintSlot(secret, revealed) : null;
  const patch: Partial<ModeSave> =
    idx == null
      ? {
          hintReveals: FIELD_HINT_STEPS,
          puzzleRevealed: secret.split("").map((_, i) => i),
        }
      : { hintReveals: step + 1, puzzleRevealed: [...revealed, idx] };
  if (state.mode === "hunt") patch.defineTargetWord = secret;
  set({ ...patch, lastTickAt: Date.now() });
  return { ok: true, kind: idx == null ? "word" : "letter" };
}

/** Record a finished daily and any new achievements after a scoring action. */
function settleProgress(
  get: () => GameStore,
  set: (patch: Partial<GameStore>) => void,
) {
  const s = get();
  const today = utcDateString();
  const modes = stashActive(get);
  let progress = s.progress;
  for (const m of ["daily", "pinDaily", "wordleDaily"] as const) {
    if (dailyComplete(m, modes[m], today)) progress = markDailyDone(progress, today);
  }
  const unlocked = newlyUnlocked(achievementStats(modes, progress, today), progress);
  if (unlocked.length > 0) {
    const at = new Date().toISOString();
    const achievements = { ...progress.achievements };
    for (const a of unlocked) achievements[a.id] = at;
    progress = { ...progress, achievements };
  }
  if (progress === s.progress) return;
  const last = unlocked[unlocked.length - 1];
  set({
    progress,
    lastAchievement: last ? { id: last.id, title: last.title } : s.lastAchievement,
  });
}

function queueRemoteDelete(
  s: GameStore,
  target: GameMode | "all",
): PendingRemoteDeletes | null {
  const uid = s.cloudUserId;
  if (!uid) return s.pendingRemoteDeletes;
  const prev = s.pendingRemoteDeletes;
  if (target === "all") return { userId: uid, modes: "all" };
  if (prev && prev.userId === uid) {
    if (prev.modes === "all") return prev;
    return {
      userId: uid,
      modes: prev.modes.includes(target) ? prev.modes : [...prev.modes, target],
    };
  }
  return { userId: uid, modes: [target] };
}

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      ...blankModeSave("forge"),
      version: SAVE_VERSION,
      activeMode: "forge",
      settings: { soundEnabled: true, theme: "system" },
      modes: {},
      screen: "play",
      draft: [],
      draftIndices: [],
      lastScorePop: null,
      lastOffline: null,
      hydrated: false,
      scrambleShowResults: false,
      cloudUserId: null,
      pendingRemoteDeletes: null,
      progress: blankProgress(),
      lastAchievement: null,

      setScreen: (screen) => set({ screen }),
      dismissAchievement: () => set({ lastAchievement: null }),
      applyRemoteProgress: (remote) => {
        set((s) => ({ progress: mergeProgress(s.progress, normalizeProgress(remote)) }));
        settleProgress(get, set);
      },
      setHydrated: (v) => set({ hydrated: v }),
      setCloudUserId: (id) => set({ cloudUserId: id }),
      setDisplayName: (name) =>
        set((s) => ({
          settings: { ...s.settings, displayName: name.slice(0, 32) },
        })),
      clearPendingRemoteDeletes: (handled) => {
        const cur = get().pendingRemoteDeletes;
        if (!cur || cur.userId !== handled.userId) return;
        if (handled.modes === "all") {
          set({ pendingRemoteDeletes: null });
          return;
        }
        if (cur.modes === "all") return;
        const done = handled.modes;
        const rest = cur.modes.filter((m) => !done.includes(m));
        set({
          pendingRemoteDeletes: rest.length > 0 ? { userId: cur.userId, modes: rest } : null,
        });
      },

      startGame: ({
        mode,
        letters,
        keystoneLetter,
        scrambleDurationSec,
        defineTargetWord,
        defineHint,
        ladderNextLength,
        affixId,
        affixMatch,
        wordleLength,
        wordleSecret,
        pinLocks,
        pinSecret,
        pinSlots,
        clueQueue,
        clueNote,
      }) => {
        const modes = stashActive(get);
        if (modeIsDaily(mode)) {
          const existing = modes[mode];
          if (existing?.started && existing.dailyDateUtc === utcDateString()) {
            set({
              ...applyModeFields(existing),
              modes,
              activeMode: mode,
              started: true,
              settings: get().settings,
              screen: "play",
              version: SAVE_VERSION,
            });
            return;
          }
        }
        const upper = letters.map((l) => l.toUpperCase());
        const noShopLevels =
          mode === "scramble" ||
          mode === "define" ||
          mode === "ladder" ||
          mode === "affix" ||
          mode === "heat" ||
          mode === "echo" ||
          modeIsWordle(mode) ||
          modeIsPin(mode) ||
          isFieldMode(mode);
        const letterLevels = noShopLevels ? {} : levelsFromLetters(upper);
        const duration =
          scrambleDurationSec ?? (mode === "heat" ? 90 : 180);
        const now = Date.now();
        const timed = modeIsTimedRound(mode);
        const sessionCoins =
          mode === "scramble" ||
          mode === "define" ||
          mode === "ladder" ||
          mode === "heat" ||
          mode === "echo" ||
          modeIsWordle(mode) ||
          modeIsPin(mode) ||
          isFieldMode(mode)
            ? 0
            : 25;

        const next: ModeSave = {
          ...blankModeSave(mode),
          started: true,
          mode,
          runId: newRunId(),
          keystoneLetter:
            mode === "keystone" ||
            mode === "daily" ||
            mode === "rare"
              ? (keystoneLetter ?? upper[0] ?? "E").toUpperCase()
              : undefined,
          letters: upper,
          letterLevels,
          coins: sessionCoins,
          totalScore: 0,
          discoveredWords: {},
          generators: {},
          chainCount: 0,
          lastTickAt: now,
          languageId: EnglishWorld.id,
          scrambleDurationSec: timed ? duration : undefined,
          scrambleEndsAt: timed ? now + duration * 1000 : null,
          scrambleRoundActive: timed,
          scrambleRoundWords: timed ? [] : undefined,
          defineTargetWord:
            mode === "define" || isFieldMode(mode)
              ? defineTargetWord?.toLowerCase()
              : undefined,
          defineHint: mode === "define" || isFieldMode(mode) ? defineHint : undefined,
          clueQueue: isFieldMode(mode) ? (clueQueue ?? []) : undefined,
          clueNote: isFieldMode(mode) ? clueNote : undefined,
          ladderNextLength:
            mode === "ladder" ? (ladderNextLength ?? LADDER_MIN) : undefined,
          affixId: mode === "affix" ? affixId : undefined,
          affixMatch: mode === "affix" ? affixMatch?.toLowerCase() : undefined,
          defineRevealed: mode === "define" ? [] : undefined,
          hintReveals: 0,
          heatPeakCombo: mode === "heat" ? 0 : undefined,
          echoLastLetter: mode === "echo" ? null : undefined,
          wordleLength: modeIsWordle(mode) ? wordleLength : undefined,
          wordleSecret: modeIsWordle(mode) ? wordleSecret?.toLowerCase() : undefined,
          wordleGuesses: modeIsWordle(mode) ? [] : undefined,
          pinLocks: modeIsPin(mode) ? pinLocks : undefined,
          pinSecret: modeIsPin(mode) ? pinSecret?.toLowerCase() : undefined,
          pinSlots: modeIsPin(mode) ? pinSlots : undefined,
          puzzleStatus: modeIsWordle(mode) || modeIsPin(mode) ? "play" : undefined,
          puzzleRevealed:
            modeIsWordle(mode) || modeIsPin(mode) || isFieldMode(mode) ? [] : undefined,
          dailyDateUtc:
            mode === "daily" || mode === "pinDaily" || mode === "wordleDaily"
              ? utcDateString()
              : undefined,
          ...blankCombo(),
        };

        // Resume coins/score if continuing same scramble/daily career? Fresh startGame = new run for that mode.
        modes[mode] = next;

        set({
          ...applyModeFields(next),
          activeMode: mode,
          started: true,
          modes,
          lastOffline: null,
          screen: "play",
          version: SAVE_VERSION,
          scrambleShowResults: false,
        });
      },

      leaveToModePicker: () => {
        const modes = stashActive(get);
        set({
          ...blankModeSave(get().activeMode),
          modes,
          started: false,
          activeMode: get().activeMode,
          settings: get().settings,
          draft: [],
          draftIndices: [],
          lastScorePop: null,
          lastOffline: null,
          scrambleShowResults: false,
          screen: "play",
          version: SAVE_VERSION,
        });
      },

      resetGame: () => {
        const { theme, displayName } = get().settings;
        set({
          ...blankModeSave("forge"),
          version: SAVE_VERSION,
          activeMode: "forge",
          started: false,
          settings: { soundEnabled: true, theme, displayName },
          modes: {},
          pendingRemoteDeletes: queueRemoteDelete(get(), "all"),
          screen: "play",
          draft: [],
          draftIndices: [],
          lastScorePop: null,
          lastOffline: null,
          scrambleShowResults: false,
          hydrated: true,
        });
      },

      resumeMode: (mode) => {
        const modes = stashActive(get);
        let save = modes[mode];
        if (!save?.started) return false;

        if (mode === "daily" || mode === "pinDaily" || mode === "wordleDaily") {
          const today = utcDateString();
          if (save.dailyDateUtc !== today) {
            // New UTC day — do not resume stale board
            return false;
          }
        }

        if (
          modeIsTimedRound(mode) &&
          save.scrambleRoundActive &&
          save.scrambleEndsAt
        ) {
          if (Date.now() >= save.scrambleEndsAt) {
            save = {
              ...save,
              scrambleRoundActive: false,
              scrambleEndsAt: null,
              chainCount: 0,
            };
            modes[mode] = save;
          }
        }

        set({
          ...applyModeFields(save),
          activeMode: mode,
          started: true,
          modes,
          lastOffline: null,
          screen: "play",
          version: SAVE_VERSION,
        });
        return true;
      },

      toggleSound: () =>
        set((s) => ({
          settings: { ...s.settings, soundEnabled: !s.settings.soundEnabled },
        })),

      setTheme: (theme) =>
        set((s) => ({
          settings: { ...s.settings, theme },
          lastTickAt: Date.now(),
        })),

      applyRemoteModes: (remoteModes, activeMode, settings) => {
        const localModes = stashActive(get);
        const merged: Partial<Record<GameMode, ModeSave>> = { ...localModes };
        for (const mode of ALL_MODES) {
          const remote = remoteModes[mode];
          const local = localModes[mode];
          if (!remote && !local) continue;
          if (!remote) {
            merged[mode] = local;
            continue;
          }
          if (!local) {
            merged[mode] = remote;
            continue;
          }
          merged[mode] = mergeModeSave(local, remote);
        }
        const nextActive = activeMode ?? get().activeMode;
        const activeSave = merged[nextActive];
        const nextSettings = settings ?? get().settings;
        if (activeSave?.started) {
          set({
            ...applyModeFields(activeSave),
            activeMode: nextActive,
            started: true,
            modes: merged,
            settings: nextSettings,
            lastOffline: null,
            hydrated: true,
            version: SAVE_VERSION,
          });
        } else {
          set({
            ...blankModeSave(nextActive),
            activeMode: nextActive,
            started: false,
            modes: merged,
            settings: nextSettings,
            draft: [],
            draftIndices: [],
            lastScorePop: null,
            lastOffline: null,
            scrambleShowResults: false,
            hydrated: true,
            version: SAVE_VERSION,
          });
        }
        settleProgress(get, set);
      },

      getPersistedSave: () => toPersisted(get()),

      getModeSavesForSync: () => stashActive(get),

      toggleDraftLetter: (letterIndex) => {
        const { draftIndices, letters, draft, mode } = get();
        if (letterIndex < 0 || letterIndex >= letters.length) return;

        if (modeUsesLetterSet(mode)) {
          // Free reuse: always append; selected state is cosmetic count.
          set({
            draftIndices: [...draftIndices, letterIndex],
            draft: [...draft, letters[letterIndex]!],
          });
          return;
        }

        const pos = draftIndices.indexOf(letterIndex);
        if (pos >= 0) {
          const nextIdx = [...draftIndices];
          const nextDraft = [...draft];
          nextIdx.splice(pos, 1);
          nextDraft.splice(pos, 1);
          set({ draftIndices: nextIdx, draft: nextDraft });
          return;
        }
        set({
          draftIndices: [...draftIndices, letterIndex],
          draft: [...draft, letters[letterIndex]!],
        });
      },

      clearDraft: () => {
        set({
          draft: [],
          draftIndices: [],
          chainCount: 0,
          ...breakCombo(),
        });
      },

      backspaceDraft: () => {
        const { draft, draftIndices } = get();
        if (draft.length === 0) return;
        set({
          draft: draft.slice(0, -1),
          draftIndices: draftIndices.slice(0, -1),
        });
      },

      tickCombo: () => {
        const state = get();
        if (!state.started) return;
        if (!isComboAlive(comboFromSave(state))) {
          if (state.comboTier) set({ ...breakCombo(), chainCount: 0 });
        }
      },

      clearModeSave: (mode) => {
        const modes = stashActive(get);
        const nextModes = { ...modes };
        delete nextModes[mode];
        set({
          ...blankModeSave(get().activeMode),
          modes: nextModes,
          pendingRemoteDeletes: queueRemoteDelete(get(), mode),
          started: false,
          activeMode: mode,
          settings: get().settings,
          draft: [],
          draftIndices: [],
          lastScorePop: null,
          scrambleShowResults: false,
          screen: "play",
          version: SAVE_VERSION,
        });
      },

      submitWord: () => {
        const state = get();
        if (
          modeIsTimedRound(state.mode) &&
          !state.scrambleRoundActive
        ) {
          return {
            ok: false,
            reason:
              state.mode === "heat"
                ? "Round over — start a new Heat Wave"
                : "Round over — start a new Scramble",
          };
        }
        if (
          modeIsTimedRound(state.mode) &&
          state.scrambleEndsAt &&
          Date.now() >= state.scrambleEndsAt
        ) {
          get().endScrambleRound();
          return { ok: false, reason: "Time's up!" };
        }

        const word = state.draft.join("").toLowerCase();
        if (state.mode === "decoy" && state.clueNote === "pending") {
          return { ok: false, reason: "Choose which meaning matches" };
        }
        if (
          (state.mode === "homophone" || state.mode === "trap") &&
          state.clueNote &&
          word === state.clueNote.toLowerCase()
        ) {
          set({ chainCount: 0, ...breakCombo() });
          return { ok: false, reason: "That's the other spelling" };
        }
        if (word.length < MIN_WORD_LENGTH) {
          return {
            ok: false,
            reason: `Need at least ${MIN_WORD_LENGTH} letters`,
          };
        }

        const formOk = modeUsesLetterSet(state.mode)
          ? canFormWordFromSet(word, state.letters)
          : canFormWord(word, state.letters);
        if (!formOk) {
          return { ok: false, reason: "Not enough letters" };
        }

        if (
          modeRequiresKeyLetter(state.mode) &&
          state.keystoneLetter &&
          !word.toUpperCase().includes(state.keystoneLetter.toUpperCase())
        ) {
          return {
            ok: false,
            reason: `Must include ${state.mode === "rare" ? "rare" : "Keystone"} ${state.keystoneLetter}`,
          };
        }

        if (
          (state.mode === "define" || fieldHasTarget(state.mode)) &&
          state.defineTargetWord &&
          word !== state.defineTargetWord
        ) {
          set({ chainCount: 0, ...breakCombo() });
          return { ok: false, reason: "Not the word for this clue" };
        }

        if (state.mode === "ladder") {
          const need = state.ladderNextLength ?? LADDER_MIN;
          if (word.length !== need) {
            return {
              ok: false,
              reason: `Ladder needs a ${need}-letter word`,
            };
          }
        }

        if (state.mode === "affix" && state.affixMatch) {
          if (!wordHasAffix(word, state.affixMatch)) {
            return {
              ok: false,
              reason: `Must include “${state.affixMatch.toUpperCase()}”`,
            };
          }
        }

        if (state.mode === "echo" && state.echoLastLetter) {
          if (word[0]?.toUpperCase() !== state.echoLastLetter.toUpperCase()) {
            set({ chainCount: 0, ...breakCombo() });
            return {
              ok: false,
              reason: `Must start with ${state.echoLastLetter}`,
            };
          }
        }

        if (!EnglishWorld.isValidWord(word)) {
          set({ chainCount: 0, ...breakCombo() });
          return { ok: false, reason: "Not in the lexicon" };
        }

        const reopen =
          (state.mode === "double" || state.mode === "decoy") &&
          state.clueNote === "reopen" &&
          word === state.defineTargetWord;
        // One find per word per mode.
        if (state.discoveredWords[word] && !reopen) {
          return { ok: false, reason: "Already found in this mode" };
        }
        if (
          modeIsTimedRound(state.mode) &&
          state.scrambleRoundWords?.includes(word)
        ) {
          return { ok: false, reason: "Already found this round" };
        }

        const ladderAdvance =
          state.mode === "ladder" &&
          word.length === (state.ladderNextLength ?? LADDER_MIN);
        const keystoneLetter =
          state.mode === "keystone" ||
          state.mode === "daily" ||
          state.mode === "rare"
            ? state.keystoneLetter
            : undefined;

        // Preview keystone for quality before scoring
        const keyAppliedPreview = Boolean(
          keystoneLetter &&
            word.toUpperCase().includes(keystoneLetter.toUpperCase()),
        );
        const quality = wordQuality(word, {
          keystoneApplied: keyAppliedPreview,
          defineSolve:
            state.mode === "define" ||
            (fieldHasTarget(state.mode) && word === state.defineTargetWord) ||
            (state.mode === "hunt" && Boolean(wordRegister(word))),
          ladderAdvance,
        });

        const field = isFieldMode(state.mode);
        const hintedTarget =
          field && Boolean(state.defineTargetWord) && word === state.defineTargetWord;
        const hintsUsed = hintedTarget ? Math.min(state.hintReveals ?? 0, FIELD_HINT_STEPS) : 0;
        const keep = FIELD_HINT_KEEP[hintsUsed]!;
        const wordShown = hintsUsed >= FIELD_HINT_STEPS;

        const comboResult = wordShown
          ? { next: breakCombo(), multiplier: 1, tierUp: false }
          : advanceCombo(comboFromSave(state), quality);
        const nextChain = wordShown ? 0 : (comboResult.next.comboWordsInWindow || 1);
        const scored = scoreWord(word, {
          isFirstDiscovery: true,
          chainCount: Math.max(1, nextChain),
          keystoneLetter,
          letterLevels: state.letterLevels,
          comboMultiplier: comboResult.multiplier,
        });
        const breakdown =
          keep === 1 ? scored : { ...scored, total: Math.round(scored.total * keep) };

        const discoveredWords = {
          ...state.discoveredWords,
          [word]: {
            discoveredAt: Date.now(),
            bestScore: breakdown.total,
            timesFound: 1,
          },
        };

        const pop: ScorePopEvent = {
          id: `${Date.now()}-${word}`,
          word,
          total: breakdown.total,
          rarity: EnglishWorld.getRarity(word) ?? undefined,
          hintPenalty: hintedTarget && hintsUsed > 0 ? keep : undefined,
          isFirstDiscovery: true,
          definition:
            state.mode === "define"
              ? (state.defineHint ?? EnglishWorld.getDefinition(word))
              : EnglishWorld.getDefinition(word),
          keystoneApplied: breakdown.keystoneApplied,
          keystoneBonus: breakdown.keystoneBonus,
          masteryBonus: breakdown.masteryBonus,
          comboMultiplier: comboResult.multiplier,
          comboName: comboDisplayName(comboResult.multiplier),
          tierUp: comboResult.tierUp,
          wordQuality: quality,
        };
        const trapBonus =
          state.mode === "trap" && state.clueNote && state.clueNote !== "reopen"
            ? Math.round(20 * keep)
            : 0;
        if (trapBonus) pop.total += trapBonus;

        let ladderNextLength = state.ladderNextLength;
        if (state.mode === "ladder") {
          const cur = state.ladderNextLength ?? LADDER_MIN;
          ladderNextLength = cur >= LADDER_MAX ? LADDER_MIN : cur + 1;
        }

        let definePatch: Partial<ModeSave> = {};
        if (state.mode === "define") {
          const exclude = new Set(Object.keys(discoveredWords));
          const nextPuzzle = pickDefinePuzzle(exclude);
          definePatch = {
            defineTargetWord: nextPuzzle.target,
            defineHint: nextPuzzle.definition,
            letters: nextPuzzle.letters,
            defineRevealed: [],
            hintReveals: 0,
          };
        } else if (state.mode === "decoy" && state.clueNote && state.clueNote !== "reopen") {
          const choice = decoyChoices(state.defineHint ?? "", state.clueNote);
          if (choice) {
            pop.choices = choice.choices;
            pop.correctIndex = choice.correctIndex;
            definePatch = { clueNote: "pending" };
          }
        } else if (isFieldMode(state.mode) && state.mode !== "hunt") {
          const next = nextFieldOpening(
            state.mode,
            {
              target: state.defineTargetWord ?? "",
              note: state.clueNote ?? "",
              queue: state.clueQueue ?? [],
              letters: state.letters,
            },
            new Set(Object.keys(discoveredWords)),
          );
          if (next) definePatch = withFreshHints(next);
        } else if (state.mode === "hunt" && hintedTarget) {
          definePatch = { defineTargetWord: undefined, hintReveals: 0, puzzleRevealed: [] };
        }

        const heatPeak = Math.max(
          state.heatPeakCombo ?? 0,
          comboResult.multiplier,
        );

        const solvedClueClean = fieldHasTarget(state.mode) && hintedTarget && hintsUsed === 0;
        if (solvedClueClean) {
          set({
            progress: { ...state.progress, hintFreeSolves: state.progress.hintFreeSolves + 1 },
          });
        }

        set({
          coins: field ? state.coins : state.coins + breakdown.total + trapBonus,
          totalScore: capPoints(state.totalScore + breakdown.total + trapBonus),
          discoveredWords,
          chainCount: nextChain,
          draft: [],
          draftIndices: [],
          lastScorePop: pop,
          lastTickAt: Date.now(),
          scrambleRoundWords:
            modeIsTimedRound(state.mode)
              ? [...(state.scrambleRoundWords ?? []), word]
              : state.scrambleRoundWords,
          ladderNextLength,
          heatPeakCombo: state.mode === "heat" ? heatPeak : state.heatPeakCombo,
          echoLastLetter:
            state.mode === "echo"
              ? word[word.length - 1]!.toUpperCase()
              : state.echoLastLetter,
          ...comboResult.next,
          ...definePatch,
        });
        settleProgress(get, set);

        return { ok: true, breakdown };
      },

      chooseDecoy: (index) => {
        const state = get();
        const pop = state.lastScorePop;
        if (state.mode !== "decoy" || !pop?.choices || pop.correctIndex == null) return;
        if (index !== pop.correctIndex) {
          const missed = pop.choices[pop.correctIndex] ?? "";
          set({
            defineHint: missed,
            clueNote: "reopen",
            hintReveals: 0,
            puzzleRevealed: [],
            lastScorePop: null,
            draft: [],
            draftIndices: [],
            chainCount: 0,
            ...breakCombo(),
          });
          return;
        }
        const next = nextFieldOpening(
          "decoy",
          {
            target: state.defineTargetWord ?? "",
            note: "",
            queue: [],
            letters: state.letters,
          },
          new Set(Object.keys(state.discoveredWords)),
        );
        set({
          lastScorePop: null,
          draft: [],
          draftIndices: [],
          ...(next ? withFreshHints(next) : {}),
        });
      },

      buyLetter: (letter) => {
        const L = letter.toUpperCase();
        const state = get();
        if (!modeHasLetterShop(state.mode)) {
          return { ok: false, reason: "No letter shop in this mode" };
        }
        const poolOnly = state.mode === "daily" ? state.letters : undefined;
        if (poolOnly && !poolOnly.map((x) => x.toUpperCase()).includes(L)) {
          return { ok: false, reason: "Not on today's board" };
        }
        const items = letterShopItems(state.letters, state.letterLevels, {
          poolOnly,
        });
        const item = items.find((i) => i.letter === L);
        if (!item) return { ok: false, reason: "Unknown letter" };
        if (item.level >= item.maxLevel) {
          return { ok: false, reason: "Max mastery" };
        }
        if (state.coins < item.cost) return { ok: false, reason: "Not enough coins" };

        const nextLevel = item.level + 1;
        const letters =
          item.level === 0 ? [...state.letters, L] : state.letters;
        set({
          coins: state.coins - item.cost,
          letters,
          letterLevels: { ...state.letterLevels, [L]: nextLevel },
          lastTickAt: Date.now(),
        });
        return { ok: true };
      },

      buyGenerator: (id) => {
        const state = get();
        if (!modeHasIdleShop(state.mode)) {
          return { ok: false, reason: "No idle shop in this mode" };
        }
        const item = GENERATORS.find((g) => g.id === id);
        if (!item) return { ok: false, reason: "Unknown generator" };
        const owned = state.generators[id] ?? 0;
        if (item.maxOwned != null && owned >= item.maxOwned) {
          return { ok: false, reason: "Max owned" };
        }
        const cost = generatorCost(item, owned);
        if (state.coins < cost) return { ok: false, reason: "Not enough coins" };
        set({
          coins: state.coins - cost,
          generators: { ...state.generators, [id]: owned + 1 },
          lastTickAt: Date.now(),
        });
        return { ok: true };
      },

      revealPuzzleHint: () => {
        const state = get();
        if (!state.started) return { ok: false, reason: "Start a puzzle first" };
        if (isFieldMode(state.mode)) return revealFieldHint(get, set);
        const puzzle = modeIsPin(state.mode) || modeIsWordle(state.mode);
        if (!puzzle) return { ok: false, reason: "No hints in this mode" };
        if (state.puzzleStatus && state.puzzleStatus !== "play") {
          return { ok: false, reason: "This puzzle is finished" };
        }
        const step = state.hintReveals ?? 0;
        if (step >= 4) return { ok: false, reason: "No hints left" };
        const secret = (
          modeIsWordle(state.mode) ? state.wordleSecret : state.pinSecret
        )?.toLowerCase();
        if (!secret) return { ok: false, reason: "No secret word" };

        const commit = (patch: Partial<ModeSave>, kind: "meaning" | "letter" | "word") => {
          const next = {
            ...extractModeSave(state),
            ...patch,
            lastTickAt: Date.now(),
          };
          set({
            ...patch,
            lastTickAt: next.lastTickAt,
            modes: { ...state.modes, [state.mode]: next },
          });
          return { ok: true as const, kind };
        };

        if (step === 0) return commit({ hintReveals: 1 }, "meaning");

        const known = modeIsPin(state.mode)
          ? [...(state.pinSlots ?? []), ...(state.puzzleRevealed ?? [])]
          : [
              ...(state.puzzleRevealed ?? []),
              ...correctSlots(state.wordleGuesses ?? [], secret),
            ];

        if (step === 1 || step === 2) {
          const idx = nextHintSlot(secret, known);
          if (idx == null) {
            return commit(
              {
                hintReveals: 4,
                puzzleRevealed: secret.split("").map((_, i) => i),
                pinSlots: modeIsPin(state.mode)
                  ? secret.split("").map((_, i) => i)
                  : state.pinSlots,
              },
              "word",
            );
          }
          const puzzleRevealed = [...(state.puzzleRevealed ?? []), idx];
          const pinSlots = modeIsPin(state.mode)
            ? [...new Set([...(state.pinSlots ?? []), idx])].sort((a, b) => a - b)
            : state.pinSlots;
          let letters = state.letters;
          if (state.mode === "pinDaily") {
            const drop = secret[idx]!.toUpperCase();
            const at = letters.findIndex((L) => L.toUpperCase() === drop);
            if (at >= 0) letters = letters.filter((_, i) => i !== at);
          }
          return commit(
            { hintReveals: step + 1, puzzleRevealed, pinSlots, letters },
            "letter",
          );
        }

        const all = secret.split("").map((_, i) => i);
        let letters = state.letters;
        if (state.mode === "pinDaily") {
          const locked = new Set(state.pinSlots ?? []);
          for (const i of all) {
            if (locked.has(i)) continue;
            const drop = secret[i]!.toUpperCase();
            const at = letters.findIndex((L) => L.toUpperCase() === drop);
            if (at >= 0) letters = letters.filter((_, n) => n !== at);
          }
        }
        return commit(
          {
            hintReveals: 4,
            puzzleRevealed: all,
            pinSlots: modeIsPin(state.mode) ? all : state.pinSlots,
            letters,
          },
          "word",
        );
      },

      buyHint: () => {
        const state = get();
        if (!state.started) return { ok: false, reason: "Start a mode first" };

        if (state.mode === "define" && state.defineTargetWord) {
          const target = state.defineTargetWord;
          const revealed = [...(state.defineRevealed ?? [])];
          const nextIdx = revealed.length;
          if (nextIdx >= target.length) {
            return { ok: false, reason: "All letters revealed" };
          }
          const cost =
            HINT_COST_DEFINE_BASE +
            (state.hintReveals ?? 0) * HINT_COST_DEFINE_STEP;
          if (state.coins < cost) {
            return { ok: false, reason: `Need ${cost} coins` };
          }
          const ch = target[nextIdx]!;
          revealed.push(ch);
          // Append revealed letter to draft if building in order
          const draft = [...state.draft];
          const draftIndices = [...state.draftIndices];
          if (draft.length === nextIdx) {
            const letterIdx = state.letters.findIndex(
              (L, i) =>
                L.toUpperCase() === ch.toUpperCase() &&
                !draftIndices.includes(i),
            );
            if (letterIdx >= 0) {
              draft.push(state.letters[letterIdx]!);
              draftIndices.push(letterIdx);
            } else {
              draft.push(ch.toUpperCase());
              draftIndices.push(-1);
            }
          }
          set({
            coins: state.coins - cost,
            defineRevealed: revealed,
            hintReveals: (state.hintReveals ?? 0) + 1,
            draft,
            draftIndices,
            lastTickAt: Date.now(),
          });
          return { ok: true, reveal: ch.toUpperCase() };
        }

        if (state.coins < HINT_COST_GENERAL) {
          return { ok: false, reason: `Need ${HINT_COST_GENERAL} coins` };
        }
        const candidates: string[] = [];
        for (const entry of EnglishWorld.listWords()) {
          const w = entry.word;
          if (w.length < EnglishWorld.minWordLength) continue;
          if (state.discoveredWords[w]) continue;
          if (state.mode === "affix" && state.affixMatch) {
            if (!wordHasAffix(w, state.affixMatch)) continue;
          }
          if (
            modeRequiresKeyLetter(state.mode) &&
            state.keystoneLetter &&
            !w.toUpperCase().includes(state.keystoneLetter.toUpperCase())
          ) {
            continue;
          }
          if (state.mode === "ladder") {
            if (w.length !== (state.ladderNextLength ?? LADDER_MIN)) continue;
          }
          const formOk = modeUsesLetterSet(state.mode)
            ? canFormWordFromSet(w, state.letters)
            : canFormWord(w, state.letters);
          if (!formOk) continue;
          candidates.push(w);
          if (candidates.length >= 80) break;
        }
        if (candidates.length === 0) {
          return { ok: false, reason: "No hintable words left" };
        }
        const pick = candidates[Math.floor(Math.random() * candidates.length)]!;
        const letter = pick[Math.floor(Math.random() * pick.length)]!.toUpperCase();
        set({
          coins: state.coins - HINT_COST_GENERAL,
          lastTickAt: Date.now(),
          lastScorePop: {
            id: `hint-${Date.now()}`,
            word: "hint",
            total: 0,
            isFirstDiscovery: false,
            definition: `Hint: a findable word contains “${letter}”`,
          },
        });
        return { ok: true, reveal: letter };
      },

      shuffleLetters: () => {
        const state = get();
        if (state.letters.length < 2) return;
        const letters = shuffleArray(state.letters);
        const modes = { ...state.modes };
        if (state.started) {
          modes[state.mode] = {
            ...extractModeSave(state),
            letters,
            lastTickAt: Date.now(),
          };
        }
        set({
          letters,
          draft: [],
          draftIndices: [],
          lastTickAt: Date.now(),
          modes,
        });
      },

      tickIdle: () => {
        const state = get();
        if (!state.started || !modeHasIdleShop(state.mode)) return;
        const now = Date.now();
        const elapsed = Math.max(0, now - state.lastTickAt);
        if (elapsed < 250) return;
        const cps = totalCps(state.generators);
        if (cps <= 0) {
          set({ lastTickAt: now });
          return;
        }
        const liveEarned = Math.floor(cps * (elapsed / 1000));
        if (liveEarned <= 0) return;
        const msConsumed = (liveEarned / cps) * 1000;
        set({
          coins: state.coins + liveEarned,
          lastTickAt: state.lastTickAt + msConsumed,
        });
      },

      applyOfflineCatchUp: () => {
        const state = get();
        if (!state.started || !modeHasIdleShop(state.mode)) return;
        const result = computeOfflineEarnings(
          state.generators,
          state.lastTickAt,
          Date.now(),
        );
        if (result.earned > 0) {
          set({
            coins: state.coins + result.earned,
            lastTickAt: Date.now(),
            lastOffline: {
              earned: result.earned,
              cappedMs: result.cappedMs,
            },
          });
        } else {
          set({ lastTickAt: Date.now() });
        }
      },

      dismissScorePop: () => set({ lastScorePop: null }),
      dismissOffline: () => set({ lastOffline: null }),

      endScrambleRound: () => {
        const state = get();
        if (!modeIsTimedRound(state.mode) || !state.scrambleRoundActive) return;
        set({
          scrambleRoundActive: false,
          scrambleEndsAt: null,
          chainCount: 0,
          draft: [],
          draftIndices: [],
          scrambleShowResults: true,
          lastTickAt: Date.now(),
          ...breakCombo(),
        });
      },

      dismissScrambleResults: () => set({ scrambleShowResults: false }),

      startScrambleRound: (durationSec) => {
        const state = get();
        if (!modeIsTimedRound(state.mode)) return;
        const duration =
          durationSec ??
          state.scrambleDurationSec ??
          (state.mode === "heat" ? 90 : 180);
        const now = Date.now();
        const letters =
          state.mode === "scramble"
            ? pickScrambleLetters()
            : pickPlayableStartLetters(FORGE_START_SIZE);
        set({
          letters,
          scrambleDurationSec: duration,
          scrambleEndsAt: now + duration * 1000,
          scrambleRoundActive: true,
          scrambleRoundWords: [],
          chainCount: 0,
          draft: [],
          draftIndices: [],
          scrambleShowResults: false,
          lastScorePop: null,
          lastTickAt: now,
          heatPeakCombo: state.mode === "heat" ? 0 : state.heatPeakCombo,
          echoLastLetter: state.mode === "echo" ? null : state.echoLastLetter,
          ...blankCombo(),
        });
      },

      submitWordleGuess: (guess) => {
        const state = get();
        if (!modeIsWordle(state.mode) || !state.wordleSecret) {
          return { ok: false, reason: "No Wordle board" };
        }
        if (state.puzzleStatus !== "play") {
          return { ok: false, reason: "Puzzle finished" };
        }
        const word = guess.trim().toLowerCase();
        const secret = state.wordleSecret;
        if (word.length !== secret.length) {
          return { ok: false, reason: `Need ${secret.length} letters` };
        }
        if (!EnglishWorld.isValidWord(word)) {
          return { ok: false, reason: "Not in the lexicon" };
        }
        const guesses = state.wordleGuesses ?? [];
        if (guesses.includes(word)) {
          return { ok: false, reason: "Already guessed" };
        }
        const nextGuesses = [...guesses, word];
        const won = word === secret;
        const lost = !won && nextGuesses.length >= WORDLE_GUESSES;
        const scored = won
          ? scoreWord(word, {
              isFirstDiscovery: true,
              chainCount: 1,
              letterLevels: {},
            })
          : null;
        set({
          wordleGuesses: nextGuesses,
          puzzleStatus: won ? "won" : lost ? "lost" : "play",
          totalScore: capPoints(state.totalScore + (scored?.total ?? 0)),
          discoveredWords: won
            ? {
                ...state.discoveredWords,
                [word]: {
                  discoveredAt: Date.now(),
                  bestScore: scored?.total ?? 0,
                  timesFound: 1,
                },
              }
            : state.discoveredWords,
          lastTickAt: Date.now(),
        });
        if (won || lost) settleProgress(get, set);
        return { ok: true };
      },

      submitPin: (attempt) => {
        const state = get();
        if (!modeIsPin(state.mode) || !state.pinSecret) {
          return { ok: false, reason: "No locked word" };
        }
        if (state.puzzleStatus !== "play") {
          return { ok: false, reason: "Puzzle finished" };
        }
        const word = attempt.trim().toLowerCase();
        const secret = state.pinSecret;
        const slots = state.pinSlots ?? [];
        for (const index of slots) {
          if (word[index] !== secret[index]) {
            return { ok: false, reason: "A locked letter moved" };
          }
        }
        if (word !== secret) {
          return { ok: false, reason: "Not the locked word" };
        }
        const scored = scoreWord(word, {
          isFirstDiscovery: !state.discoveredWords[word],
          chainCount: 1,
          letterLevels: state.letterLevels,
        });
        const discoveredWords = {
          ...state.discoveredWords,
          [word]: {
            discoveredAt: state.discoveredWords[word]?.discoveredAt ?? Date.now(),
            bestScore: Math.max(state.discoveredWords[word]?.bestScore ?? 0, scored.total),
            timesFound: (state.discoveredWords[word]?.timesFound ?? 0) + 1,
          },
        };
        if (state.mode === "pinDaily") {
          set({
            puzzleStatus: "won",
            totalScore: capPoints(state.totalScore + scored.total),
            discoveredWords,
            lastTickAt: Date.now(),
          });
          settleProgress(get, set);
          return { ok: true };
        }
        const locks = state.pinLocks ?? 1;
        const nextSecret = formableSecret(
          state.letters,
          locks,
          new Set(Object.keys(discoveredWords)),
        );
        if (!nextSecret) {
          set({
            puzzleStatus: "won",
            totalScore: capPoints(state.totalScore + scored.total),
            discoveredWords,
            lastTickAt: Date.now(),
          });
          return { ok: true };
        }
        const board = pinBoardFor(nextSecret, locks, `${nextSecret}:${Date.now()}`);
        set({
          pinSecret: nextSecret,
          pinSlots: board.slots,
          totalScore: capPoints(state.totalScore + scored.total),
          discoveredWords,
          puzzleStatus: "play",
          lastTickAt: Date.now(),
        });
        return { ok: true };
      },

      ensureDailyBoard: () => {
        const state = get();
        if (state.mode !== "daily" || !state.started) return;
        const today = utcDateString();
        const board = dailyBoardForDate(today);
        const sameDay = state.dailyDateUtc === today;
        const sameKey = state.keystoneLetter === board.keyLetter;
        // Compare as a set (sorted) so a player shuffle does not look like a new board.
        const sameLetterSet =
          [...state.letters].map((L) => L.toUpperCase()).sort().join("") ===
          [...board.letters].map((L) => L.toUpperCase()).sort().join("");
        if (sameDay && sameKey && sameLetterSet) return;

        // New UTC day or board formula update — adopt today's deterministic board.
        // Same day: keep score/lexicon and only refresh the letters.
        if (sameDay) {
          set({
            keystoneLetter: board.keyLetter,
            letters: board.letters,
            letterLevels: levelsFromLetters(board.letters),
            draft: [],
            draftIndices: [],
            lastScorePop: null,
          });
          return;
        }

        set({
          runId: newRunId(),
          dailyDateUtc: today,
          keystoneLetter: board.keyLetter,
          letters: board.letters,
          letterLevels: levelsFromLetters(board.letters),
          coins: 25,
          totalScore: 0,
          discoveredWords: {},
          generators: {},
          chainCount: 0,
          draft: [],
          draftIndices: [],
          lastScorePop: null,
          lastTickAt: Date.now(),
        });
      },
    }),
    {
      name: "word-forge-save",
      version: SAVE_VERSION,
      storage: createJSONStorage(() => idbStorage),
      partialize: (s): GameSave => toPersisted(s as GameStore),
      merge: (persisted, current) => {
        const p = persisted as Partial<GameSave> | undefined;
        if (!p || typeof p !== "object" || !p.modes) return current;

        const root: GameSave = {
          version: SAVE_VERSION,
          activeMode: p.activeMode ?? "forge",
          started: Boolean(p.started),
          settings: {
            soundEnabled: p.settings?.soundEnabled ?? true,
            theme: p.settings?.theme ?? "system",
            displayName: p.settings?.displayName,
          },
          modes: p.modes,
          progress: normalizeProgress(p.progress),
          pendingRemoteDeletes: p.pendingRemoteDeletes ?? null,
        };

        const active =
          root.modes[root.activeMode] ?? blankModeSave(root.activeMode);
        return {
          ...current,
          ...applyModeFields(
            root.started ? active : blankModeSave(root.activeMode),
          ),
          version: SAVE_VERSION,
          activeMode: root.activeMode,
          started: root.started && active.started,
          settings: root.settings,
          modes: root.modes,
          progress: root.progress,
          pendingRemoteDeletes: root.pendingRemoteDeletes ?? null,
          hydrated: current.hydrated,
        };
      },
      // Only called when the stored version differs; start fresh instead of upgrading.
      migrate: () => blankRoot(),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);
