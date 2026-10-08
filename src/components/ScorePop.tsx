"use client";

import { useEffect } from "react";
import { Alert, Chip, Snackbar, Stack, Typography, keyframes } from "@mui/material";
import type { ScorePopEvent } from "@/game/types";

const popIn = keyframes`
  0% { opacity: 0; transform: translateY(12px) scale(0.94); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
`;

interface ScorePopProps {
  event: ScorePopEvent | null;
  onDismiss: () => void;
}

/** Overlay toast — must not reflow the Play letter grid. */
export function ScorePop({ event, onDismiss }: ScorePopProps) {
  useEffect(() => {
    if (!event) return;
    const t = setTimeout(onDismiss, event.isFirstDiscovery ? 4200 : 1800);
    return () => clearTimeout(t);
  }, [event, onDismiss]);

  return (
    <Snackbar
      open={!!event}
      onClose={onDismiss}
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
        onClose={onDismiss}
        variant="filled"
        sx={{
          alignItems: "flex-start",
          maxWidth: 420,
          width: "100%",
          mx: "auto",
          animation: `${popIn} 280ms ease`,
          "& .MuiAlert-message": { width: "100%" },
        }}
      >
        {event && (
          <>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
              <Typography sx={{ fontWeight: 800 }}>
                {event.word === "hint"
                  ? "Hint"
                  : `${event.word.toUpperCase()} · +${event.total}`}
              </Typography>
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
            {event.definition && (
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
