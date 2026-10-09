"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Alert,
  Badge,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  CircularProgress,
  Paper,
  Snackbar,
  Typography,
  useTheme,
} from "@mui/material";
import EmojiEventsRoundedIcon from "@mui/icons-material/EmojiEventsRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import StorefrontRoundedIcon from "@mui/icons-material/StorefrontRounded";
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import { StartScreen } from "@/components/StartScreen";
import { PlayScreen } from "@/components/PlayScreen";
import { PinScreen } from "@/components/PinScreen";
import { WordleScreen } from "@/components/WordleScreen";
import { LexiconScreen } from "@/components/LexiconScreen";
import { SettingsScreen } from "@/components/SettingsScreen";
import { ShopScreen } from "@/components/ShopScreen";
import { OfflineBanner } from "@/components/OfflineBanner";
import { useGameStore } from "@/game/store";
import { canAffordAnyShopItem } from "@/game/shop";
import type { GameMode, ScreenId } from "@/game/types";
import { modeHasIdleShop, modeHasLetterShop, modeIsPin, modeIsWordle } from "@/game/types";
import { heroGradient, shellGradient, shellMaxWidth } from "@/theme/theme";
import { useCloudSync } from "@/lib/supabase/useCloudSync";
import { loadEnglishClues } from "@/dictionary/clues";
import { loadEnglishDictionary } from "@/dictionary/english";

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
  const lastAchievement = useGameStore((s) => s.lastAchievement);
  const dismissAchievement = useGameStore((s) => s.dismissAchievement);
  const showShop = started && modeHasShop(gameMode);
  const [dictReady, setDictReady] = useState(false);
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
    Promise.all([loadEnglishDictionary(), loadEnglishClues().catch(() => undefined)])
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
          {dictError ? null : <CircularProgress color="primary" sx={{ mb: 2 }} />}
          <Typography color="text.secondary" sx={{ fontWeight: 700 }}>
            {dictError ? `Lexicon error: ${dictError}` : "Loading lexicon…"}
          </Typography>
        </Box>
      </Box>
    );
  }

  const onPlayTab = screen === "play" || (screen === "shop" && !showShop);
  /** Lexicon scrolls its own list inside the viewport instead of the page. */
  const fitViewport = screen === "lexicon";
  const bg =
    !started && onPlayTab
      ? heroGradient(paletteMode)
      : shellGradient(paletteMode);

  return (
    <Box
      sx={{
        ...(fitViewport ? { height: "100dvh", overflow: "hidden" } : { minHeight: "100dvh" }),
        boxSizing: "border-box",
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
          minHeight: 0,
          overflow: "auto",
          maxWidth: shellMaxWidth,
          width: "100%",
          mx: "auto",
          ...(fitViewport && { display: "flex", flexDirection: "column" }),
        }}
      >
        {onPlayTab &&
          (started ? (
            modeIsWordle(gameMode) ? (
              <WordleScreen />
            ) : modeIsPin(gameMode) ? (
              <PinScreen />
            ) : (
              <PlayScreen />
            )
          ) : (
            <StartScreen />
          ))}
        {screen === "shop" && showShop && <ShopScreen />}
        {screen === "lexicon" && <LexiconScreen />}
        {screen === "settings" && <SettingsScreen />}
      </Box>

      <Snackbar
        open={!!lastAchievement}
        autoHideDuration={4000}
        onClose={(_, reason) => {
          if (reason !== "clickaway") dismissAchievement();
        }}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        sx={{ bottom: { xs: 88, sm: 88 } }}
      >
        <Alert
          icon={<EmojiEventsRoundedIcon sx={{ color: "#D4A017" }} />}
          onClose={dismissAchievement}
          variant="filled"
          severity="info"
          sx={{ fontWeight: 700, bgcolor: "grey.900", color: "#fff" }}
        >
          Achievement: {lastAchievement?.title}
        </Alert>
      </Snackbar>

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
          sx={{ height: 64, maxWidth: shellMaxWidth, mx: "auto", width: "100%" }}
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
