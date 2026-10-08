"use client";

import { useMemo, useState } from "react";
import {
  Box,
  Chip,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { EnglishWorld } from "@/dictionary/english";
import { useGameStore } from "@/game/store";
import type { DiscoveredWord } from "@/game/types";

const rarityColor: Record<string, "default" | "success" | "warning" | "secondary"> = {
  common: "default",
  uncommon: "success",
  rare: "warning",
  epic: "secondary",
};

export function LexiconScreen() {
  const started = useGameStore((s) => s.started);
  const discoveredWords = useGameStore((s) => s.discoveredWords);
  const modes = useGameStore((s) => s.modes);
  const [query, setQuery] = useState("");

  const lexicon = useMemo(() => {
    if (started) return discoveredWords;
    const merged: Record<string, DiscoveredWord> = {};
    for (const save of Object.values(modes)) {
      if (!save?.discoveredWords) continue;
      for (const [word, meta] of Object.entries(save.discoveredWords)) {
        const prev = merged[word];
        if (!prev || meta.discoveredAt > prev.discoveredAt) {
          merged[word] = meta;
        } else if (meta.bestScore > prev.bestScore) {
          merged[word] = { ...prev, bestScore: meta.bestScore };
        }
      }
    }
    return merged;
  }, [started, discoveredWords, modes]);

  const entries = useMemo(() => {
    const q = query.trim().toLowerCase();
    return Object.entries(lexicon)
      .map(([word, meta]) => ({
        word,
        ...meta,
        definition: EnglishWorld.getDefinition(word) ?? "—",
        rarity: EnglishWorld.getRarity(word) ?? "common",
      }))
      .filter((e) => !q || e.word.includes(q) || e.definition.toLowerCase().includes(q))
      .sort((a, b) => b.discoveredAt - a.discoveredAt);
  }, [lexicon, query]);

  const count = Object.keys(lexicon).length;

  return (
    <Box sx={{ px: 2, pt: 2, pb: 2 }}>
      <Stack
        direction="row"
        sx={{ mb: 1.5, justifyContent: "space-between", alignItems: "center" }}
      >
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          Lexicon
        </Typography>
        <Chip
          label={`${count} / ${EnglishWorld.wordCount.toLocaleString()}`}
          color="primary"
          variant="outlined"
        />
      </Stack>

      <TextField
        fullWidth
        size="small"
        placeholder="Search discovered words…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
        sx={{ mb: 2, bgcolor: "background.paper", borderRadius: 2 }}
      />

      {entries.length === 0 ? (
        <Typography color="text.secondary" sx={{ textAlign: "center", mt: 6 }}>
          {count === 0
            ? "Discover words in any mode — definitions appear on first find."
            : "No matches."}
        </Typography>
      ) : (
        <List disablePadding>
          {entries.map((e) => (
            <ListItem
              key={e.word}
              sx={{
                bgcolor: "background.paper",
                borderRadius: 2,
                mb: 1,
                border: "1px solid",
                borderColor: "divider",
                alignItems: "flex-start",
              }}
            >
              <ListItemText
                primary={
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ alignItems: "center", flexWrap: "wrap" }}
                  >
                    <Typography component="span" sx={{ fontWeight: 800 }}>
                      {e.word}
                    </Typography>
                    <Chip
                      label={e.rarity}
                      size="small"
                      color={rarityColor[e.rarity] ?? "default"}
                    />
                    <Chip label={`best ${e.bestScore}`} size="small" variant="outlined" />
                  </Stack>
                }
                secondary={e.definition}
                slotProps={{
                  secondary: { sx: { mt: 0.5 } },
                }}
              />
            </ListItem>
          ))}
        </List>
      )}
    </Box>
  );
}
