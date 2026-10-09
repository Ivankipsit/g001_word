"use client";

import { useState } from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import LightbulbOutlinedIcon from "@mui/icons-material/LightbulbOutlined";
import { EnglishWorld } from "@/dictionary/english";
import { useGameStore } from "@/game/store";

const PUZZLE_HINTS = ["Meaning", "A letter", "Another letter", "The word"] as const;
/** Clue modes already show a meaning; each step lowers the points for this target. */
const FIELD_HINTS = ["A letter · −33%", "Another letter · −67%", "The word · 0 pts"] as const;
const NO_SLOTS: number[] = [];

export function PuzzleHint({
  secret,
  showPattern,
  ladder = "puzzle",
}: {
  secret: string;
  showPattern?: boolean;
  /** "field": Clue and Thread modes (letter, letter, word). */
  ladder?: "puzzle" | "field";
}) {
  const hintReveals = useGameStore((s) => s.hintReveals ?? 0);
  const revealed = useGameStore((s) => s.puzzleRevealed) ?? NO_SLOTS;
  const status = useGameStore((s) => s.puzzleStatus ?? "play");
  const revealPuzzleHint = useGameStore((s) => s.revealPuzzleHint);
  const [error, setError] = useState<string | null>(null);

  const field = ladder === "field";
  const labels = field ? FIELD_HINTS : PUZZLE_HINTS;
  const steps = labels.length;
  if (status !== "play") return null;
  // Register Hunt picks its hint word on the first press.
  if (!secret && !field) return null;

  const step = secret ? hintReveals : 0;
  const wordOut = Boolean(secret) && step >= steps;
  const patternFrom = field ? 1 : 2;
  const meaning = !field && step >= 1 ? EnglishWorld.getDefinition(secret) : null;
  const placed = revealed
    .map((i) => secret[i]?.toUpperCase())
    .filter((ch): ch is string => Boolean(ch));

  return (
    <Stack spacing={1.25} sx={{ mb: 2 }}>
      {!field && step >= 1 && (
        <Box
          sx={{
            px: 1.5,
            py: 1.25,
            borderRadius: 2,
            bgcolor: "action.hover",
          }}
        >
          <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.2 }}>
            Meaning
          </Typography>
          <Typography variant="body2">
            {meaning || "No short meaning is stored for this word."}
          </Typography>
        </Box>
      )}

      {secret && showPattern && step >= patternFrom && (
        <Stack direction="row" spacing={0.5} sx={{ justifyContent: "center" }}>
          {secret.split("").map((ch, i) => {
            const open = wordOut || revealed.includes(i);
            return (
              <Box
                key={i}
                sx={{
                  width: { xs: 36, sm: 42 },
                  height: { xs: 36, sm: 42 },
                  display: "grid",
                  placeItems: "center",
                  borderRadius: 1,
                  border: "2px solid",
                  borderColor: open ? "#D4A017" : "divider",
                  bgcolor: open ? "rgba(212,160,23,0.16)" : "background.paper",
                  fontWeight: 800,
                  textTransform: "uppercase",
                }}
              >
                {open ? ch : ""}
              </Box>
            );
          })}
        </Stack>
      )}

      {!field && step >= 2 && !wordOut && placed.length > 0 && (
        <Typography variant="body2" sx={{ textAlign: "center", fontWeight: 700 }}>
          Placed: {placed.join(" · ")}
        </Typography>
      )}

      {wordOut && (
        <Typography sx={{ textAlign: "center", fontWeight: 800 }}>
          The word is {secret.toUpperCase()}
        </Typography>
      )}

      {error && (
        <Typography color="warning.main" sx={{ textAlign: "center", fontWeight: 700 }}>
          {error}
        </Typography>
      )}

      {step < steps && (
        <Button
          variant="outlined"
          color="secondary"
          size={field ? "small" : "medium"}
          startIcon={<LightbulbOutlinedIcon />}
          onClick={() => {
            const result = revealPuzzleHint();
            setError(result.ok ? null : (result.reason ?? "Hint unavailable"));
          }}
          sx={{ alignSelf: "center" }}
        >
          Hint · {labels[step]}
        </Button>
      )}
    </Stack>
  );
}
