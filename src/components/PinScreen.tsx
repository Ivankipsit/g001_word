"use client";

import { useMemo, useState } from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import { PuzzleHint } from "@/components/PuzzleHint";
import { EnglishWorld } from "@/dictionary/english";
import { LetterTile } from "@/components/LetterTile";
import { useGameStore } from "@/game/store";
import { modeDisplayName } from "@/game/types";

const NO_SLOTS: number[] = [];

export function PinScreen() {
  const mode = useGameStore((s) => s.mode);
  const secret = useGameStore((s) => s.pinSecret ?? "");
  const slots = useGameStore((s) => s.pinSlots) ?? NO_SLOTS;
  const letters = useGameStore((s) => s.letters);
  const locks = useGameStore((s) => s.pinLocks ?? 1);
  const status = useGameStore((s) => s.puzzleStatus ?? "play");
  const submitPin = useGameStore((s) => s.submitPin);
  const leaveToModePicker = useGameStore((s) => s.leaveToModePicker);
  const locked = useMemo(() => new Set(slots), [slots]);
  const [filled, setFilled] = useState<Record<number, string>>({});
  const [error, setError] = useState<string | null>(null);

  const freeReuse = mode === "pin";
  const used = new Map<string, number>();
  for (const ch of Object.values(filled)) {
    const k = ch.toUpperCase();
    used.set(k, (used.get(k) ?? 0) + 1);
  }

  const nextOpen = secret.split("").findIndex((_, i) => !locked.has(i) && !filled[i]);
  const done = status !== "play";

  const place = (letter: string) => {
    if (done || nextOpen < 0) return;
    setFilled((prev) => ({ ...prev, [nextOpen]: letter.toUpperCase() }));
    setError(null);
  };

  const undo = () => {
    const open = secret
      .split("")
      .map((_, i) => i)
      .filter((i) => !locked.has(i) && filled[i]);
    const last = open[open.length - 1];
    if (last == null) return;
    setFilled((prev) => {
      const next = { ...prev };
      delete next[last];
      return next;
    });
  };

  const attempt = secret
    .split("")
    .map((ch, i) => (locked.has(i) ? ch : (filled[i] ?? "").toLowerCase()))
    .join("");

  const ready = secret.length > 0 && attempt.length === secret.length && !attempt.includes("");

  return (
    <Box sx={{ px: { xs: 2, md: 3 }, pt: 2, pb: 2, maxWidth: 640, mx: "auto" }}>
      <Button onClick={() => leaveToModePicker()} sx={{ alignSelf: "flex-start", mb: 1 }}>
        Modes
      </Button>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5 }}>
        {modeDisplayName(mode)}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        {locks === 1 ? "One letter is fixed." : "Two letters are fixed."} Fill the rest.
      </Typography>

      <PuzzleHint secret={secret} />

      <Stack direction="row" spacing={0.75} sx={{ justifyContent: "center", mb: 2, flexWrap: "wrap" }}>
        {secret.split("").map((ch, i) => (
          <LetterTile
            key={i}
            letter={locked.has(i) ? ch.toUpperCase() : (filled[i] ?? "")}
            keystone={locked.has(i)}
            size="sm"
          />
        ))}
      </Stack>

      {error && (
        <Typography color="warning.main" sx={{ textAlign: "center", mb: 1, fontWeight: 700 }}>
          {error}
        </Typography>
      )}
      {done && (
        <Typography sx={{ textAlign: "center", mb: 1, fontWeight: 800 }}>
          {secret}
          {EnglishWorld.getDefinition(secret)
            ? ` — ${EnglishWorld.getDefinition(secret)}`
            : ""}
        </Typography>
      )}

      <Stack direction="row" spacing={0.75} sx={{ justifyContent: "center", flexWrap: "wrap", mb: 2 }}>
        {letters.map((letter, i) => {
          const usedCount = used.get(letter.toUpperCase()) ?? 0;
          const owned = letters.filter((L) => L.toUpperCase() === letter.toUpperCase()).length;
          return (
            <LetterTile
              key={`${letter}-${i}`}
              letter={letter}
              disabled={done || (!freeReuse && usedCount >= owned)}
              onClick={() => place(letter)}
              size="sm"
            />
          );
        })}
      </Stack>

      <Stack direction="row" spacing={1} sx={{ justifyContent: "center" }}>
        <Button variant="outlined" disabled={done} onClick={undo}>
          Undo
        </Button>
        <Button
          variant="contained"
          disabled={done || !ready}
          onClick={() => {
            const result = submitPin(attempt);
            if (!result.ok) setError(result.reason ?? "Not the locked word");
            else setFilled({});
          }}
        >
          Submit
        </Button>
      </Stack>
    </Box>
  );
}
