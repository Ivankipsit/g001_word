"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { EnglishWorld } from "@/dictionary/english";
import {
  canFormWord,
  canFormWordFromSet,
  dailyBoardForDate,
  FORGE_START_SIZE,
  pickPlayableStartLetters,
  pickScrambleLetters,
  shuffleArray,
  uniqueLettersWithLevels,
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
  modeIsTimedRound,
  modeRequiresKeyLetter,
  modeUsesLetterSet,
} from "@/game/types";

function blankModeSave(mode: GameMode): ModeSave {
  return {
    started: false,
    mode,
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
  };
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

  setScreen: (screen: ScreenId) => void;
  setHydrated: (v: boolean) => void;
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
  shuffleLetters: () => void;
  tickIdle: () => void;
  tickCombo: () => void;
  applyOfflineCatchUp: () => void;
  dismissScorePop: () => void;
  dismissOffline: () => void;
  endScrambleRound: () => void;
  dismissScrambleResults: () => void;
  startScrambleRound: (durationSec?: number) => void;
  ensureDailyBoard: () => void;
  /** Wipe one mode save; return to picker. Daily: reset progress, keep board. */
  clearModeSave: (mode: GameMode) => void;
}

function extractModeSave(s: ModeSave): ModeSave {
  return {
    started: s.started,
    mode: s.mode,
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
  };
}

function migrateV2ToV3(p: Record<string, unknown>): GameSave {
  const mode = (p.mode as GameMode) ?? "forge";
  const rawLetters = Array.isArray(p.letters) ? (p.letters as string[]) : [];
  const { letters, letterLevels } = uniqueLettersWithLevels(rawLetters);
  const modeSave: ModeSave = {
    started: Boolean(p.started),
    mode: mode === "keystone" ? "keystone" : "forge",
    keystoneLetter:
      typeof p.keystoneLetter === "string" ? p.keystoneLetter : undefined,
    letters,
    letterLevels,
    coins: typeof p.coins === "number" ? p.coins : 0,
    totalScore: typeof p.totalScore === "number" ? p.totalScore : 0,
    discoveredWords:
      (p.discoveredWords as ModeSave["discoveredWords"]) ?? {},
    generators: (p.generators as Record<string, number>) ?? {},
    chainCount: typeof p.chainCount === "number" ? p.chainCount : 0,
    lastTickAt: typeof p.lastTickAt === "number" ? p.lastTickAt : Date.now(),
    languageId:
      typeof p.languageId === "string" ? p.languageId : EnglishWorld.id,
  };
  const settings = (p.settings as GameSave["settings"]) ?? {
    soundEnabled: true,
    theme: "system" as ThemePreference,
  };
  return {
    version: SAVE_VERSION,
    activeMode: modeSave.mode,
    started: modeSave.started,
    settings: {
      soundEnabled: settings.soundEnabled ?? true,
      theme: settings.theme ?? "system",
    },
    modes: { [modeSave.mode]: modeSave },
  };
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

      setScreen: (screen) => set({ screen }),
      setHydrated: (v) => set({ hydrated: v }),

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
      }) => {
        const modes = stashActive(get);
        const upper = letters.map((l) => l.toUpperCase());
        const noShopLevels =
          mode === "scramble" ||
          mode === "define" ||
          mode === "ladder" ||
          mode === "affix" ||
          mode === "heat" ||
          mode === "echo";
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
          mode === "echo"
            ? 0
            : 25;

        const next: ModeSave = {
          ...blankModeSave(mode),
          started: true,
          mode,
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
          dailyDateUtc: mode === "daily" ? utcDateString() : undefined,
          defineTargetWord:
            mode === "define" ? defineTargetWord?.toLowerCase() : undefined,
          defineHint: mode === "define" ? defineHint : undefined,
          ladderNextLength:
            mode === "ladder" ? (ladderNextLength ?? LADDER_MIN) : undefined,
          affixId: mode === "affix" ? affixId : undefined,
          affixMatch: mode === "affix" ? affixMatch?.toLowerCase() : undefined,
          defineRevealed: mode === "define" ? [] : undefined,
          hintReveals: 0,
          heatPeakCombo: mode === "heat" ? 0 : undefined,
          echoLastLetter: mode === "echo" ? null : undefined,
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
        const theme = get().settings.theme;
        set({
          ...blankModeSave("forge"),
          version: SAVE_VERSION,
          activeMode: "forge",
          started: false,
          settings: { soundEnabled: true, theme },
          modes: {},
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

        if (mode === "daily") {
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
          merged[mode] =
            (remote.lastTickAt ?? 0) > (local.lastTickAt ?? 0) ? remote : local;
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

        if (state.mode === "define" && state.defineTargetWord) {
          if (word !== state.defineTargetWord) {
            set({ chainCount: 0, ...breakCombo() });
            return { ok: false, reason: "Not the word for this clue" };
          }
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

        // One find per word per mode.
        if (state.discoveredWords[word]) {
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
          defineSolve: state.mode === "define",
          ladderAdvance,
        });

        const comboResult = advanceCombo(comboFromSave(state), quality);
        const nextChain = (comboResult.next.comboWordsInWindow || 1);
        const breakdown = scoreWord(word, {
          isFirstDiscovery: true,
          chainCount: nextChain,
          keystoneLetter,
          letterLevels: state.letterLevels,
          comboMultiplier: comboResult.multiplier,
        });

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
        }

        const heatPeak = Math.max(
          state.heatPeakCombo ?? 0,
          comboResult.multiplier,
        );

        set({
          coins: state.coins + breakdown.total,
          totalScore: state.totalScore + breakdown.total,
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

        return { ok: true, breakdown };
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
        // Preserve score/lexicon only when same day but letters were regenerated (v2 fix).
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
      partialize: (s): GameSave => toPersisted(s as GameStore),
      merge: (persisted, current) => {
        const p = persisted as Partial<GameSave> | undefined;
        if (!p || typeof p !== "object") return current;

        const ver = typeof p.version === "number" ? p.version : 0;
        const root: GameSave =
          ver >= 3 && p.modes
            ? {
                version: SAVE_VERSION,
                activeMode: (p.activeMode as GameMode) ?? "forge",
                started: Boolean(p.started),
                settings: {
                  soundEnabled: p.settings?.soundEnabled ?? true,
                  theme: p.settings?.theme ?? "system",
                },
                modes: p.modes ?? {},
              }
            : migrateV2ToV3(p as Record<string, unknown>);

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
          hydrated: current.hydrated,
        };
      },
      migrate: (persisted, fromVersion) => {
        const p = persisted as Record<string, unknown> | undefined;
        if (!p || typeof p !== "object") return blankRoot();
        const ver = typeof p.version === "number" ? p.version : fromVersion;
        if (ver >= 3 && p.modes) {
          return {
            ...(p as unknown as GameSave),
            version: SAVE_VERSION,
          };
        }
        // v1/v2 flat → per-mode map
        if ("letters" in p || "mode" in p) {
          return migrateV2ToV3(p);
        }
        return blankRoot();
      },
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    },
  ),
);
