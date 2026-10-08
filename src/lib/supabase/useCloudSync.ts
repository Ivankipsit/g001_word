"use client";

import { useEffect, useRef } from "react";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  pushAllModeSaves,
  syncAllModesLastWriteWins,
  upsertProfileTheme,
} from "@/lib/supabase/sync";
import { useGameStore } from "@/game/store";

/**
 * When signed in: merge remote/local per mode on session, then push on changes.
 * Guests (no session / no env) stay local-only.
 */
export function useCloudSync() {
  const hydrated = useGameStore((s) => s.hydrated);
  const lastTickAt = useGameStore((s) => s.lastTickAt);
  const theme = useGameStore((s) => s.settings.theme);
  const applyRemoteModes = useGameStore((s) => s.applyRemoteModes);
  const getModeSavesForSync = useGameStore((s) => s.getModeSavesForSync);
  const getPersistedSave = useGameStore((s) => s.getPersistedSave);
  const userIdRef = useRef<string | null>(null);
  const syncingRef = useRef(false);
  const mergedRef = useRef(false);

  useEffect(() => {
    if (!hydrated || !isSupabaseConfigured()) return;
    const client = getSupabaseBrowserClient();
    if (!client) return;

    let cancelled = false;

    const mergeForUser = async (userId: string) => {
      if (syncingRef.current) return;
      syncingRef.current = true;
      try {
        const localModes = getModeSavesForSync();
        const result = await syncAllModesLastWriteWins(client, userId, localModes);
        if (cancelled) return;
        if (result.pulled.length > 0) {
          const root = getPersistedSave();
          applyRemoteModes(result.modes, root.activeMode, root.settings);
        }
        await upsertProfileTheme(client, userId, getPersistedSave().settings.theme);
        mergedRef.current = true;
      } catch (err) {
        console.warn("[word-forge] cloud sync merge failed", err);
      } finally {
        syncingRef.current = false;
      }
    };

    client.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id ?? null;
      userIdRef.current = uid;
      if (uid) void mergeForUser(uid);
    });

    const { data: sub } = client.auth.onAuthStateChange((event, session) => {
      const uid = session?.user?.id ?? null;
      userIdRef.current = uid;
      if (!uid) {
        mergedRef.current = false;
        return;
      }
      if (
        event === "SIGNED_IN" ||
        event === "INITIAL_SESSION" ||
        event === "TOKEN_REFRESHED"
      ) {
        void mergeForUser(uid);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [hydrated, applyRemoteModes, getModeSavesForSync, getPersistedSave]);

  useEffect(() => {
    if (!hydrated || !mergedRef.current) return;
    const uid = userIdRef.current;
    const client = getSupabaseBrowserClient();
    if (!uid || !client) return;

    const t = window.setTimeout(() => {
      const modes = getModeSavesForSync();
      void pushAllModeSaves(client, uid, modes).catch((err) =>
        console.warn("[word-forge] cloud push failed", err),
      );
      void upsertProfileTheme(client, uid, theme).catch(() => {});
    }, 800);

    return () => window.clearTimeout(t);
  }, [hydrated, lastTickAt, theme, getModeSavesForSync]);
}
