import type { SupabaseClient } from "@supabase/supabase-js";
import type { GameMode, ModeSave, PlayerProgress, ThemePreference } from "@/game/types";
import { ALL_MODES, SAVE_VERSION } from "@/game/types";
import { mergeModeSave, sameModeSave } from "@/game/saveMerge";
import { normalizeProgress } from "@/game/progress";

function normalizeModeSave(save: ModeSave, mode: GameMode): ModeSave {
  return {
    started: Boolean(save.started),
    mode: save.mode ?? mode,
    runId: save.runId,
    keystoneLetter: save.keystoneLetter,
    letters: Array.isArray(save.letters) ? save.letters : [],
    letterLevels: save.letterLevels ?? {},
    coins: typeof save.coins === "number" ? save.coins : 0,
    totalScore: typeof save.totalScore === "number" ? save.totalScore : 0,
    discoveredWords: save.discoveredWords ?? {},
    generators: save.generators ?? {},
    chainCount: typeof save.chainCount === "number" ? save.chainCount : 0,
    lastTickAt: typeof save.lastTickAt === "number" ? save.lastTickAt : 0,
    languageId: save.languageId ?? "en",
    scrambleDurationSec: save.scrambleDurationSec,
    scrambleEndsAt: save.scrambleEndsAt,
    scrambleRoundActive: save.scrambleRoundActive,
    scrambleRoundWords: save.scrambleRoundWords,
    dailyDateUtc: save.dailyDateUtc,
    defineTargetWord: save.defineTargetWord,
    defineHint: save.defineHint,
    defineRevealed: save.defineRevealed,
    hintReveals: save.hintReveals,
    ladderNextLength: save.ladderNextLength,
    affixId: save.affixId,
    affixMatch: save.affixMatch,
    comboTier: save.comboTier ?? 0,
    comboWordsInWindow: save.comboWordsInWindow ?? 0,
    comboExpiresAt: save.comboExpiresAt ?? null,
    heatPeakCombo: save.heatPeakCombo,
    echoLastLetter: save.echoLastLetter ?? null,
    wordleLength: save.wordleLength,
    wordleSecret: save.wordleSecret,
    wordleGuesses: save.wordleGuesses,
    pinLocks: save.pinLocks,
    pinSecret: save.pinSecret,
    pinSlots: save.pinSlots,
    puzzleStatus: save.puzzleStatus,
    puzzleRevealed: save.puzzleRevealed,
    clueQueue: save.clueQueue,
    clueNote: save.clueNote,
  };
}

/**
 * Per-mode merge: same run unions discovered words (newer save wins for run
 * state); different runs take the newer save. Returns modes to apply locally.
 */
export async function syncAllModesMerge(
  client: SupabaseClient,
  userId: string,
  localModes: Partial<Record<GameMode, ModeSave>>,
): Promise<{
  modes: Partial<Record<GameMode, ModeSave>>;
  pushed: GameMode[];
  pulled: GameMode[];
}> {
  const { data, error } = await client
    .from("game_saves")
    .select("mode, save, save_version, updated_at")
    .eq("user_id", userId);

  if (error) throw error;

  const remoteByMode = new Map<GameMode, ModeSave>();
  for (const row of data ?? []) {
    const mode = row.mode as GameMode;
    if (!ALL_MODES.includes(mode)) continue;
    // Rows from another save version are replaced by the local save on the next push.
    if (row.save_version !== SAVE_VERSION || !(row.save as ModeSave)?.runId) continue;
    const save = normalizeModeSave(row.save as ModeSave, mode);
    if (!save.lastTickAt) save.lastTickAt = new Date(row.updated_at).getTime();
    remoteByMode.set(mode, save);
  }

  const merged: Partial<Record<GameMode, ModeSave>> = {};
  const pushed: GameMode[] = [];
  const pulled: GameMode[] = [];

  for (const mode of ALL_MODES) {
    const local = localModes[mode];
    const remote = remoteByMode.get(mode);
    if (!local && !remote) continue;

    if (!remote && local) {
      await pushModeSave(client, userId, mode, local);
      merged[mode] = local;
      pushed.push(mode);
      continue;
    }

    if (remote && !local) {
      merged[mode] = remote;
      pulled.push(mode);
      continue;
    }

    if (remote && local) {
      const next = mergeModeSave(local, remote);
      merged[mode] = next;
      if (!sameModeSave(next, remote)) {
        await pushModeSave(client, userId, mode, next);
        pushed.push(mode);
      }
      if (!sameModeSave(next, local)) pulled.push(mode);
    }
  }

  return { modes: merged, pushed, pulled };
}

export async function pushModeSave(
  client: SupabaseClient,
  userId: string,
  mode: GameMode,
  save: ModeSave,
): Promise<void> {
  const updatedAt = new Date(save.lastTickAt || Date.now()).toISOString();
  const payload = normalizeModeSave({ ...save, mode }, mode);
  const { error } = await client.from("game_saves").upsert(
    {
      user_id: userId,
      mode,
      save: payload,
      save_version: SAVE_VERSION,
      updated_at: updatedAt,
    },
    { onConflict: "user_id,mode" },
  );
  if (error) throw error;
}

export async function deleteModeSaves(
  client: SupabaseClient,
  userId: string,
  modes: GameMode[] | "all",
): Promise<void> {
  let query = client.from("game_saves").delete().eq("user_id", userId);
  if (modes !== "all") {
    if (modes.length === 0) return;
    query = query.in("mode", modes);
  }
  const { error } = await query;
  if (error) throw error;
}

export async function fetchProfile(
  client: SupabaseClient,
  userId: string,
): Promise<{ displayName: string | null; progress: PlayerProgress | null }> {
  const { data, error } = await client
    .from("profiles")
    .select("display_name, progress")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return {
    displayName: (data?.display_name as string | null | undefined) ?? null,
    progress: data?.progress ? normalizeProgress(data.progress) : null,
  };
}

export async function upsertProfile(
  client: SupabaseClient,
  userId: string,
  theme: ThemePreference,
  displayName?: string | null,
  progress?: PlayerProgress,
): Promise<void> {
  const row: Record<string, unknown> = {
    id: userId,
    theme,
    updated_at: new Date().toISOString(),
  };
  if (displayName) row.display_name = displayName;
  if (progress) row.progress = progress;
  const { error } = await client.from("profiles").upsert(row, { onConflict: "id" });
  if (error) throw error;
}
