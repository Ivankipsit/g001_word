"use client";

import { useEffect, useRef } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  deleteModeSaves,
  fetchProfile,
  pushModeSave,
  syncAllModesMerge,
  upsertProfile,
} from "@/lib/supabase/sync";
import { useGameStore } from "@/game/store";
import { ALL_MODES, type GameMode, type ModeSave } from "@/game/types";

const FLUSH_INTERVAL_MS = 5_000;
/** Coin/tick-only changes (idle income) push at most this often. */
const IDLE_PUSH_MS = 60_000;

interface PushedMark {
  sig: string;
  tick: number;
  at: number;
}

/** Changes that matter for progress; excludes coins and lastTickAt, which move every idle tick. */
function progressSignature(s: ModeSave): string {
  let gens = 0;
  for (const n of Object.values(s.generators ?? {})) gens += n;
  let levels = 0;
  for (const n of Object.values(s.letterLevels ?? {})) levels += n;
  return [
    s.runId ?? "",
    s.started ? 1 : 0,
    Object.keys(s.discoveredWords ?? {}).length,
    s.totalScore,
    s.letters.length,
    gens,
    levels,
    s.puzzleStatus ?? "",
    s.wordleGuesses?.length ?? 0,
    s.scrambleRoundActive ? 1 : 0,
    s.dailyDateUtc ?? "",
  ].join("|");
}

/**
 * When signed in: apply queued cloud deletes, merge remote/local per mode, then
 * push only modes that changed. Guests (no session / no env) stay local-only.
 */
export function useCloudSync() {
  const hydrated = useGameStore((s) => s.hydrated);
  const theme = useGameStore((s) => s.settings.theme);
  const displayName = useGameStore((s) => s.settings.displayName);
  const progress = useGameStore((s) => s.progress);
  const userIdRef = useRef<string | null>(null);
  const busyRef = useRef(false);
  const mergedRef = useRef(false);
  const pushedRef = useRef(new Map<GameMode, PushedMark>());

  useEffect(() => {
    if (!hydrated || !isSupabaseConfigured()) return;
    const client = getSupabaseBrowserClient();
    if (!client) return;

    let cancelled = false;
    const store = useGameStore.getState;

    const markPushed = (mode: GameMode, save: ModeSave) => {
      pushedRef.current.set(mode, {
        sig: progressSignature(save),
        tick: save.lastTickAt,
        at: Date.now(),
      });
    };

    const exclusive = async (fn: () => Promise<void>) => {
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        await fn();
      } catch (err) {
        console.warn("[word-forge] cloud sync failed", err);
      } finally {
        busyRef.current = false;
      }
    };

    const flushDeletes = async (uid: string) => {
      const pending = store().pendingRemoteDeletes;
      if (!pending || pending.userId !== uid) return;
      if (pending.modes === "all") {
        await deleteModeSaves(client, uid, "all");
        pushedRef.current.clear();
      } else {
        // A mode restarted since the delete was queued is overwritten by its next push instead.
        const local = store().getModeSavesForSync();
        await deleteModeSaves(
          client,
          uid,
          pending.modes.filter((m) => !local[m]),
        );
        for (const m of pending.modes) pushedRef.current.delete(m);
      }
      store().clearPendingRemoteDeletes(pending);
    };

    const pushDirty = async (uid: string, force = false) => {
      const modes = store().getModeSavesForSync();
      const now = Date.now();
      for (const mode of ALL_MODES) {
        const save = modes[mode];
        if (!save) continue;
        const mark = pushedRef.current.get(mode);
        const progressed = !mark || mark.sig !== progressSignature(save);
        const ticked =
          !!mark && mark.tick !== save.lastTickAt && (force || now - mark.at >= IDLE_PUSH_MS);
        if (!progressed && !ticked) continue;
        await pushModeSave(client, uid, mode, save);
        markPushed(mode, save);
      }
    };

    const mergeForUser = (uid: string) =>
      exclusive(async () => {
        await flushDeletes(uid);
        const result = await syncAllModesMerge(client, uid, store().getModeSavesForSync());
        if (cancelled) return;
        if (result.pulled.length > 0) {
          const root = store().getPersistedSave();
          store().applyRemoteModes(result.modes, root.activeMode, root.settings);
        }
        for (const mode of ALL_MODES) {
          const save = result.modes[mode];
          if (save) markPushed(mode, save);
        }

        mergedRef.current = true;
        // Profile sync failing (e.g. schema not migrated yet) must not block save sync.
        try {
          const profile = await fetchProfile(client, uid);
          if (cancelled) return;
          if (!store().settings.displayName && profile.displayName) {
            store().setDisplayName(profile.displayName);
          }
          if (profile.progress) store().applyRemoteProgress(profile.progress);
          const { settings, progress } = store();
          await upsertProfile(client, uid, settings.theme, settings.displayName, progress);
        } catch (err) {
          console.warn("[word-forge] profile sync failed", err);
        }
      });

    const flush = (force = false) => {
      const uid = userIdRef.current;
      if (!uid) return;
      if (!mergedRef.current) {
        void mergeForUser(uid);
        return;
      }
      void exclusive(async () => {
        await flushDeletes(uid);
        await pushDirty(uid, force);
      });
    };

    const onUser = (uid: string | null) => {
      const prev = userIdRef.current;
      userIdRef.current = uid;
      store().setCloudUserId(uid);
      if (!uid) {
        mergedRef.current = false;
        pushedRef.current.clear();
        return;
      }
      if (uid !== prev) {
        mergedRef.current = false;
        pushedRef.current.clear();
      }
      if (!mergedRef.current) void mergeForUser(uid);
    };

    client.auth.getSession().then(({ data }) => {
      if (!cancelled) onUser(data.session?.user?.id ?? null);
    });

    const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
      onUser(session?.user?.id ?? null);
    });

    const interval = window.setInterval(() => {
      if (navigator.onLine) flush();
    }, FLUSH_INTERVAL_MS);
    const onOnline = () => flush();
    const onHide = () => {
      if (document.visibilityState === "hidden") flush(true);
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onHide);

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      window.clearInterval(interval);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated || !mergedRef.current) return;
    const uid = userIdRef.current;
    const client = getSupabaseBrowserClient();
    if (!uid || !client) return;
    const t = window.setTimeout(() => {
      void upsertProfile(client, uid, theme, displayName, progress).catch(() => {});
    }, 800);
    return () => window.clearTimeout(t);
  }, [hydrated, theme, displayName, progress]);
}
