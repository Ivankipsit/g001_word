"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Badge,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  CircularProgress,
  Paper,
  Typography,
  useTheme,
} from "@mui/material";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import { StartScreen } from "@/components/StartScreen";
import { PlayScreen } from "@/components/PlayScreen";
import { LexiconScreen } from "@/components/LexiconScreen";
import { SettingsScreen } from "@/components/SettingsScreen";
import { ShopScreen } from "@/components/ShopScreen";
import { OfflineBanner } from "@/components/OfflineBanner";
import { useGameStore } from "@/game/store";
import { canAffordAnyShopItem } from "@/game/shop";
import type { GameMode, ScreenId } from "@/game/types";
import { modeHasIdleShop, modeHasLetterShop } from "@/game/types";
import { heroGradient, shellGradient } from "@/theme/theme";
import { useCloudSync } from "@/lib/supabase/useCloudSync";
import {
  isEnglishDictionaryReady,
  loadEnglishDictionary,
} from "@/dictionary/english";

const allScreens: { id: ScreenId; label: string; icon: ReactNode }[] = [
  { id: "play", label: "Play", icon: <PlayArrowRoundedIcon /> },
  { id: "shop", label: "Shop", icon: <StorefrontRoundedIcon /> },
  { id: "lexicon", label: "Lexicon", icon: <MenuBookRoundedIcon /> },
  { id: "settings", label: "Settings", icon: <SettingsRoundedIcon /> },
];

function modeHasShop(mode: GameMode) {
  return modeHasLetterShop(mode) || modeHasIdleShop(mode);
}

export function GameShell() {
  const theme = useTheme();
  const paletteMode = theme.palette.mode;
  const hydrated = useGameStore((s) => s.hydrated);
  const started = useGameStore((s) => s.started);
  const screen = useGameStore((s) => s.screen);
  const setScreen = useGameStore((s) => s.setScreen);
  const tickIdle = useGameStore((s) => s.tickIdle);
  const applyOfflineCatchUp = useGameStore((s) => s.applyOfflineCatchUp);
  const coins = useGameStore((s) => s.coins);
  const letters = useGameStore((s) => s.letters);
  const letterLevels = useGameStore((s) => s.letterLevels);
  const generators = useGameStore((s) => s.generators);
  const gameMode = useGameStore((s) => s.mode);
  const showShop = started && modeHasShop(gameMode);
  const [dictReady, setDictReady] = useState(isEnglishDictionaryReady());
  const [dictError, setDictError] = useState<string | null>(null);
  const navScreens = useMemo(
    () => (showShop ? allScreens : allScreens.filter((s) => s.id !== "shop")),
    [showShop],
  );
  const shopAffordable =
    showShop &&
    canAffordAnyShopItem(coins, letters, letterLevels, generators, gameMode);

  useCloudSync();

  useEffect(() => {
    let cancelled = false;
    loadEnglishDictionary()
      .then(() => {
        if (!cancelled) setDictReady(true);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setDictError(e instanceof Error ? e.message : "Failed to load lexicon");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated || !started) return;
    applyOfflineCatchUp();
  }, [hydrated, started, applyOfflineCatchUp]);

  useEffect(() => {
    if (!hydrated || !started) return;
    const id = window.setInterval(() => tickIdle(), 1000);
    return () => window.clearInterval(id);
  }, [hydrated, started, tickIdle]);

  useEffect(() => {
    if (showShop) return;
    if (screen === "shop") setScreen("play");
  }, [showShop, screen, setScreen]);

  if (!hydrated || !dictReady) {
    return (
      <Box
        sx={{
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: heroGradient(paletteMode),
          px: 2,
        }}
      >
        <Box sx={{ textAlign: "center" }}>
          <CircularProgress color="primary" sx={{ mb: 2 }} />
          <Typography color="text.secondary" sx={{ fontWeight: 700 }}>
            {dictError ? `Lexicon error: ${dictError}` : "Loading lexicon…"}
          </Typography>
        </Box>
      </Box>
    );
  }

  const onPlayTab = screen === "play" || (screen === "shop" && !showShop);
  const bg =
    !started && onPlayTab
      ? heroGradient(paletteMode)
      : shellGradient(paletteMode);

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        background: bg,
        pb: "72px",
      }}
    >
      <OfflineBanner />
      <Box
        sx={{
          flex: 1,
          overflow: "auto",
          maxWidth: 720,
          width: "100%",
          mx: "auto",
        }}
      >
        {onPlayTab && (started ? <PlayScreen /> : <StartScreen />)}
        {screen === "shop" && showShop && <ShopScreen />}
        {screen === "lexicon" && <LexiconScreen />}
        {screen === "settings" && <SettingsScreen />}
      </Box>

      <Paper
        elevation={8}
        sx={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          borderRadius: "16px 16px 0 0",
          overflow: "hidden",
          bgcolor: "background.paper",
        }}
      >
        <BottomNavigation
          showLabels
          value={screen === "shop" && !showShop ? "play" : screen}
          onChange={(_, v: ScreenId) => setScreen(v)}
          sx={{ height: 64, maxWidth: 720, mx: "auto" }}
        >
          {navScreens.map((s) => (
            <BottomNavigationAction
              key={s.id}
              label={s.label}
              value={s.id}
              icon={
                s.id === "shop" ? (
                  <Badge
                    color="secondary"
                    variant="dot"
                    invisible={!shopAffordable || screen === "shop"}
                    overlap="circular"
                  >
                    {s.icon}
                  </Badge>
                ) : (
                  s.icon
                )
              }
            />
          ))}
        </BottomNavigation>
      </Paper>
    </Box>
  );
}
