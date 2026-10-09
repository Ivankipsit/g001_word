"use client";

import { useMemo } from "react";
import { Box, LinearProgress, Stack, Typography } from "@mui/material";
import EmojiEventsRoundedIcon from "@mui/icons-material/EmojiEventsRounded";
import { ACHIEVEMENTS, achievementStats } from "@/game/achievements";
import { utcDateString } from "@/game/letters";
import { currentStreak } from "@/game/progress";
import { useGameStore } from "@/game/store";

export function AchievementsPanel() {
  const progress = useGameStore((s) => s.progress);
  const getModeSaves = useGameStore((s) => s.getModeSavesForSync);
  const today = utcDateString();

  // Settings is its own tab, so saves cannot change while this is mounted.
  const stats = useMemo(
    () => achievementStats(getModeSaves(), progress, today),
    [progress, today, getModeSaves],
  );
  const unlocked = ACHIEVEMENTS.filter((a) => progress.achievements[a.id]).length;
  const streak = currentStreak(progress.dailyDays, today);

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {unlocked} of {ACHIEVEMENTS.length} unlocked · current streak {streak}{" "}
        {streak === 1 ? "day" : "days"} · best {stats.bestStreak}
      </Typography>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", md: "1fr 1fr 1fr" },
          gap: 1,
        }}
      >
        {ACHIEVEMENTS.map((a) => {
          const done = Boolean(progress.achievements[a.id]);
          const value = Math.min(a.value(stats), a.goal);
          return (
            <Stack
              key={a.id}
              direction="row"
              spacing={1.25}
              sx={{
                alignItems: "center",
                p: 1.25,
                borderRadius: 2,
                border: "1.5px solid",
                borderColor: done ? "#D4A017" : "divider",
                bgcolor: done ? "rgba(212,160,23,0.1)" : "background.paper",
                opacity: done ? 1 : 0.75,
              }}
            >
              <EmojiEventsRoundedIcon sx={{ color: done ? "#D4A017" : "text.disabled" }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 800 }} noWrap>
                  {a.title}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                  {a.description}
                </Typography>
                {!done && a.goal > 1 && (
                  <LinearProgress
                    variant="determinate"
                    value={(value / a.goal) * 100}
                    aria-label={`${value} of ${a.goal}`}
                    sx={{ mt: 0.5, height: 4, borderRadius: 2 }}
                  />
                )}
              </Box>
            </Stack>
          );
        })}
      </Box>
    </Box>
  );
}
