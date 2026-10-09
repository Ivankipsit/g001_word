"use client";

import { Box, LinearProgress, Stack, Typography, keyframes } from "@mui/material";
import {
  COMBO_TIER_NAMES,
  COMBO_TIER_RULES,
  type ComboMultiplier,
} from "@/game/combo";

const pulse = keyframes`
  0% { transform: scale(1); }
  50% { transform: scale(1.04); }
  100% { transform: scale(1); }
`;

const flashIn = keyframes`
  0% { opacity: 0; transform: translateY(4px); }
  100% { opacity: 1; transform: translateY(0); }
`;

interface ComboMeterProps {
  tier: number;
  expiresAt: number | null;
  now: number;
  tierUpFlash?: boolean;
}

/** Compact active-only meter — hidden while combo is idle. */
export function ComboMeter({
  tier,
  expiresAt,
  now,
  tierUpFlash,
}: ComboMeterProps) {
  const active = tier >= 3 && expiresAt != null && now < expiresAt;
  if (!active) return null;

  const mult = tier as ComboMultiplier;
  const name = COMBO_TIER_NAMES[mult];
  const windowMs = COMBO_TIER_RULES[mult].windowMs;
  const left = Math.max(0, expiresAt! - now);
  const progress = Math.min(100, (left / windowMs) * 100);

  return (
    <Box
      sx={{
        mb: 1.25,
        px: 1,
        py: 0.75,
        borderRadius: 1.5,
        bgcolor: "rgba(196,131,58,0.1)",
        animation: tierUpFlash ? `${pulse} 420ms ease` : undefined,
      }}
    >
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center", mb: 0.5 }}
      >
        <Typography
          variant="caption"
          sx={{
            fontWeight: 800,
            animation: tierUpFlash ? `${flashIn} 280ms ease` : undefined,
          }}
        >
          {name} · ×{mult}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
          {(left / 1000).toFixed(1)}s
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={progress}
        color="secondary"
        sx={{
          height: 3,
          borderRadius: 1,
          bgcolor: "action.selected",
          "& .MuiLinearProgress-bar": {
            transition: "transform 200ms linear",
          },
        }}
      />
    </Box>
  );
}
