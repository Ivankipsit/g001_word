"use client";

import { useState } from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import { PuzzleHint } from "@/components/PuzzleHint";
import { EnglishWorld } from "@/dictionary/english";
import { markGuess, WORDLE_GUESSES, type TileMark } from "@/game/puzzles";
import { useGameStore } from "@/game/store";
import { modeDisplayName } from "@/game/types";

const ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"] as const;
const NO_GUESSES: string[] = [];

const markColor: Record<TileMark, string> = {
  correct: "#3D8B5F",
  present: "#C4833A",
  absent: "#5C6570",
};

function Tile({ letter, mark }: { letter: string; mark?: TileMark }) {
  return (
    <Box
      sx={{
        width: { xs: 40, sm: 48 },
        height: { xs: 40, sm: 48 },
        display: "grid",
        placeItems: "center",
        borderRadius: 1,
        border: "2px solid",
        borderColor: mark ? markColor[mark] : "divider",
        bgcolor: mark ? markColor[mark] : "background.paper",
        color: mark ? "#fff" : "text.primary",
        fontWeight: 800,
        fontSize: "1.15rem",
        textTransform: "uppercase",
      }}
    >
      {letter}
    </Box>
  );
}

export function WordleScreen() {
  const mode = useGameStore((s) => s.mode);
  const secret = useGameStore((s) => s.wordleSecret ?? "");
  const guesses = useGameStore((s) => s.wordleGuesses) ?? NO_GUESSES;
  const status = useGameStore((s) => s.puzzleStatus ?? "play");
  const length = useGameStore((s) => s.wordleLength ?? secret.length);
  const submitWordleGuess = useGameStore((s) => s.submitWordleGuess);
  const leaveToModePicker = useGameStore((s) => s.leaveToModePicker);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const done = status !== "play";
  const best = new Map<string, TileMark>();
  for (const guess of guesses) {
    const marks = markGuess(guess, secret);
    for (let i = 0; i < guess.length; i++) {
      const prev = best.get(guess[i]!);
      const next = marks[i]!;
      if (prev === "correct" || (prev === "present" && next === "absent")) continue;
      best.set(guess[i]!, next);
    }
  }

  const commit = (word: string) => {
    const result = submitWordleGuess(word);
    if (!result.ok) {
      setError(result.reason ?? "Could not guess");
      return;
    }
    setDraft("");
    setError(null);
  };

  const typeLetter = (letter: string) => {
    if (done || draft.length >= length) return;
    setDraft((d) => d + letter.toLowerCase());
    setError(null);
  };

  return (
    <Box sx={{ px: { xs: 2, md: 3 }, pt: 2, pb: 2, maxWidth: 560, mx: "auto" }}>
      <Button onClick={() => leaveToModePicker()} sx={{ alignSelf: "flex-start", mb: 1 }}>
        Modes
      </Button>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5 }}>
        {modeDisplayName(mode)}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        {length} letters · {WORDLE_GUESSES} guesses
      </Typography>

      <PuzzleHint secret={secret} showPattern />

      <Stack spacing={0.75} sx={{ alignItems: "center", mb: 2 }}>
        {Array.from({ length: WORDLE_GUESSES }, (_, row) => {
          const guess = guesses[row] ?? (row === guesses.length && !done ? draft : "");
          const marks = guesses[row] ? markGuess(guesses[row], secret) : undefined;
          return (
            <Stack key={row} direction="row" spacing={0.5}>
              {Array.from({ length }, (_, col) => (
                <Tile
                  key={col}
                  letter={guess[col] ?? ""}
                  mark={marks?.[col]}
                />
              ))}
            </Stack>
          );
        })}
      </Stack>

      {error && (
        <Typography color="warning.main" sx={{ textAlign: "center", mb: 1, fontWeight: 700 }}>
          {error}
        </Typography>
      )}
      {done && (
        <Typography sx={{ textAlign: "center", mb: 1, fontWeight: 800 }}>
          {status === "won"
            ? secret
            : `The word was ${secret}`}
          {EnglishWorld.getDefinition(secret)
            ? ` — ${EnglishWorld.getDefinition(secret)}`
            : ""}
        </Typography>
      )}

      <Stack spacing={0.75} sx={{ alignItems: "center" }}>
        {ROWS.map((row) => (
          <Stack key={row} direction="row" spacing={0.5}>
            {row.split("").map((letter) => {
              const mark = best.get(letter.toLowerCase());
              return (
                <Button
                  key={letter}
                  onClick={() => typeLetter(letter)}
                  disabled={done}
                  sx={{
                    minWidth: { xs: 28, sm: 34 },
                    px: 0,
                    fontWeight: 800,
                    color: mark ? "#fff" : "text.primary",
                    bgcolor: mark ? markColor[mark] : "background.paper",
                  }}
                >
                  {letter}
                </Button>
              );
            })}
          </Stack>
        ))}
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" disabled={done || draft.length === 0} onClick={() => setDraft((d) => d.slice(0, -1))}>
            Delete
          </Button>
          <Button
            variant="contained"
            disabled={done || draft.length !== length}
            onClick={() => commit(draft)}
          >
            Guess
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}
