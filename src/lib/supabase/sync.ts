import type { SupabaseClient } from "@supabase/supabase-js";
import type { GameMode, GameSave, ModeSave, ThemePreference } from "@/game/types";
import { ALL_MODES, SAVE_VERSION } from "@/game/types";

export interface RemoteGameSaveRow {
  user_id: string;
  mode: GameMode;
  save: ModeSave;
  save_version: number;
  updated_at: string;
}

function normalizeModeSave(save: ModeSave, mode: GameMode): ModeSave {
  return {
    started: Boolean(save.started),
    mode: save.mode ?? mode,
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
  };
}

/** Last-write-wins merge per mode. Returns modes map to apply locally. */
export async function syncAllModesLastWriteWins(
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

  const remoteByMode = new Map<GameMode, { save: ModeSave; updatedAt: number }>();
  for (const row of data ?? []) {
    const mode = (row.mode as GameMode) ?? "forge";
    if (!ALL_MODES.includes(mode)) continue;
    remoteByMode.set(mode, {
      save: normalizeModeSave(row.save as ModeSave, mode),
      updatedAt: new Date(row.updated_at).getTime(),
    });
  }

  const merged: Partial<Record<GameMode, ModeSave>> = {};
  const pushed: GameMode[] = [];
  const pulled: GameMode[] = [];

  for (const mode of ALL_MODES) {
    const local = localModes[mode];
    const remote = remoteByMode.get(mode);
    const localTs = local?.lastTickAt ?? 0;
    const remoteTs = remote?.updatedAt ?? 0;

    if (!local && !remote) continue;

    if (!remote && local) {
      await pushModeSave(client, userId, mode, local);
      merged[mode] = local;
      pushed.push(mode);
      continue;
    }

    if (remote && !local) {
      merged[mode] = remote.save;
      pulled.push(mode);
      continue;
    }

    if (remote && local) {
      if (remoteTs > localTs) {
        merged[mode] = remote.save;
        pulled.push(mode);
      } else if (localTs > remoteTs) {
        await pushModeSave(client, userId, mode, local);
        merged[mode] = local;
        pushed.push(mode);
      } else {
        merged[mode] = local;
      }
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

export async function pushAllModeSaves(
  client: SupabaseClient,
  userId: string,
  modes: Partial<Record<GameMode, ModeSave>>,
): Promise<void> {
  for (const mode of ALL_MODES) {
    const save = modes[mode];
    if (!save) continue;
    await pushModeSave(client, userId, mode, save);
  }
}

/** @deprecated Prefer syncAllModesLastWriteWins — kept for narrow call sites. */
export async function syncSaveLastWriteWins(
  client: SupabaseClient,
  userId: string,
  local: GameSave,
): Promise<{ save: GameSave; source: "local" | "remote" | "unchanged" }> {
  const result = await syncAllModesLastWriteWins(client, userId, local.modes);
  const changed =
    result.pushed.length > 0 || result.pulled.length > 0 ? "local" : "unchanged";
  const source =
    result.pulled.length > 0 && result.pushed.length === 0
      ? "remote"
      : result.pushed.length > 0
        ? "local"
        : changed;
  return {
    save: {
      ...local,
      version: SAVE_VERSION,
      modes: result.modes,
    },
    source,
  };
}

export async function pushSave(
  client: SupabaseClient,
  userId: string,
  save: GameSave,
): Promise<void> {
  await pushAllModeSaves(client, userId, save.modes);
}

export async function upsertProfileTheme(
  client: SupabaseClient,
  userId: string,
  theme: ThemePreference,
  displayName?: string | null,
): Promise<void> {
  const { error } = await client.from("profiles").upsert(
    {
      id: userId,
      theme,
      display_name: displayName ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) throw error;
}
