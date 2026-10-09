"use client";

import { useEffect } from "react";
import { Alert, Button, Chip, Snackbar, Stack, Typography, keyframes } from "@mui/material";
import type { ScorePopEvent } from "@/game/types";
import { useGameStore } from "@/game/store";
import { formatPoints } from "@/lib/points";
import { RARITY_COLOR } from "@/game/rarity";

const popIn = keyframes`
  0% { opacity: 0; transform: translateY(12px) scale(0.94); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
`;

const burst = keyframes`
  0% { opacity: 0; transform: scale(0.7); box-shadow: 0 0 0 0 rgba(212,160,23,0.9); }
  55% { opacity: 1; transform: scale(1.06); box-shadow: 0 0 0 18px rgba(212,160,23,0); }
  100% { opacity: 1; transform: scale(1); box-shadow: 0 0 24px 4px rgba(212,160,23,0.45); }
`;

const glow = keyframes`
  0%, 100% { box-shadow: 0 0 10px 1px rgba(155,89,182,0.45); }
  50% { box-shadow: 0 0 22px 6px rgba(155,89,182,0.7); }
`;

function celebrateSx(rarity: ScorePopEvent["rarity"]) {
  if (rarity === "legendary") {
    return {
      background: `linear-gradient(135deg, #8a6508 0%, ${RARITY_COLOR.legendary} 45%, #f3d36b 100%)`,
      color: "#1c1400",
      border: "2px solid #f3d36b",
      animation: `${burst} 700ms ease-out both`,
    };
  }
  if (rarity === "epic") {
    return {
      background: `linear-gradient(135deg, #5e2d79 0%, ${RARITY_COLOR.epic} 100%)`,
      color: "#fff",
      animation: `${popIn} 280ms ease, ${glow} 1.6s ease-in-out 280ms 2`,
    };
  }
  return { animation: `${popIn} 280ms ease` };
}

interface ScorePopProps {
  event: ScorePopEvent | null;
  onDismiss: () => void;
}

/** Overlay toast — must not reflow the Play letter grid. */
export function ScorePop({ event, onDismiss }: ScorePopProps) {
  const chooseDecoy = useGameStore((s) => s.chooseDecoy);
  const choosing = Boolean(event?.choices?.length);
  const special = event?.rarity === "legendary" || event?.rarity === "epic";
  useEffect(() => {
    if (!event || choosing) return;
    const ms = event.rarity === "legendary" ? 6500 : event.isFirstDiscovery ? 4200 : 1800;
    const t = setTimeout(onDismiss, ms);
    return () => clearTimeout(t);
  }, [event, onDismiss, choosing]);

  return (
    <Snackbar
      open={!!event}
      onClose={choosing ? undefined : onDismiss}
      anchorOrigin={{ vertical: "top", horizontal: "center" }}
      sx={{
        // Keep clear of letter tiles / bottom nav
        top: { xs: 12, sm: 16 },
        left: 0,
        right: 0,
        px: 2,
      }}
    >
      <Alert
        severity={event?.isFirstDiscovery ? "success" : "info"}
        onClose={choosing ? undefined : onDismiss}
        variant="filled"
        sx={{
          alignItems: "flex-start",
          maxWidth: 420,
          width: "100%",
          mx: "auto",
          ...celebrateSx(event?.rarity),
          "& .MuiAlert-message": { width: "100%" },
          "& .MuiAlert-icon, & .MuiAlert-action": special ? { color: "inherit" } : {},
          "@media (prefers-reduced-motion: reduce)": { animation: "none" },
        }}
      >
        {event && (
          <>
            {special && (
              <Typography
                variant="overline"
                sx={{ display: "block", fontWeight: 900, letterSpacing: 2, lineHeight: 1.4 }}
              >
                {event.rarity === "legendary" ? "Legendary find" : "Epic find"}
              </Typography>
            )}
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
              <Typography sx={{ fontWeight: 800 }}>
                {event.word === "hint"
                  ? "Hint"
                  : `${event.word.toUpperCase()} · +${formatPoints(event.total)}`}
              </Typography>
              {event.hintPenalty != null && (
                <Chip
                  size="small"
                  label={
                    event.hintPenalty === 0
                      ? "Word shown"
                      : `Hinted · ${Math.round(event.hintPenalty * 100)}% pts`
                  }
                  sx={{ fontWeight: 700, bgcolor: "rgba(0,0,0,0.18)", color: "inherit" }}
                />
              )}
              {event.comboName && (event.comboMultiplier ?? 0) >= 3 && (
                <Chip
                  size="small"
                  label={`${event.comboName} ×${event.comboMultiplier}`}
                  sx={{
                    fontWeight: 800,
                    bgcolor: "rgba(255,255,255,0.2)",
                    color: "inherit",
                  }}
                />
              )}
              {event.wordQuality === "great" && (
                <Chip size="small" label="Great" sx={{ fontWeight: 800 }} />
              )}
              {event.wordQuality === "good" && event.word !== "hint" && (
                <Chip size="small" label="Good" variant="outlined" sx={{ fontWeight: 700 }} />
              )}
            </Stack>
            {event.keystoneApplied && (event.keystoneBonus ?? 0) > 0 && (
              <Typography variant="body2" sx={{ mt: 0.25, fontWeight: 700 }}>
                Keystone bonus +{event.keystoneBonus}
              </Typography>
            )}
            {(event.masteryBonus ?? 0) > 0 && (
              <Typography variant="body2" sx={{ mt: 0.25, fontWeight: 700 }}>
                Mastery +{event.masteryBonus}
              </Typography>
            )}
            {choosing && event.choices && (
              <Stack spacing={0.75} sx={{ mt: 1 }}>
                {event.choices.map((choice, index) => (
                  <Button
                    key={choice}
                    variant="outlined"
                    onClick={() => chooseDecoy(index)}
                    sx={{
                      color: "inherit",
                      borderColor: "rgba(255,255,255,0.45)",
                      justifyContent: "flex-start",
                      textAlign: "left",
                    }}
                  >
                    {choice}
                  </Button>
                ))}
              </Stack>
            )}
            {event.definition && !choosing && (
              <Typography
                variant="body2"
                sx={{
                  mt: 0.5,
                  opacity: 0.95,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {event.word === "hint"
                  ? event.definition
                  : event.isFirstDiscovery
                    ? `First discovery — ${event.definition}`
                    : event.definition}
              </Typography>
            )}
          </>
        )}
      </Alert>
    </Snackbar>
  );
}
