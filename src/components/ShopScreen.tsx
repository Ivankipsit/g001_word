"use client";

import { useState } from "react";
import {
  Box,
  Button,
  Chip,
  Grid,
  ListItem,
  ListItemText,
  Stack,
  Tab,
  Tabs,
  Typography,
  Alert,
} from "@mui/material";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import LockRoundedIcon from "@mui/icons-material/LockRounded";
import TrendingUpRoundedIcon from "@mui/icons-material/TrendingUpRounded";
import { useGameStore } from "@/game/store";
import {
  GENERATORS,
  generatorCost,
  letterShopItems,
  totalCps,
} from "@/game/shop";
import { formatCps } from "@/game/idle";
import { EnglishWorld } from "@/dictionary/english";
import { modeHasIdleShop, modeHasLetterShop } from "@/game/types";

type ShopTab = "generators" | "letters";

export function ShopScreen() {
  const coins = useGameStore((s) => s.coins);
  const letters = useGameStore((s) => s.letters);
  const letterLevels = useGameStore((s) => s.letterLevels);
  const generators = useGameStore((s) => s.generators);
  const mode = useGameStore((s) => s.mode);
  const buyLetter = useGameStore((s) => s.buyLetter);
  const buyGenerator = useGameStore((s) => s.buyGenerator);
  const hasIdle = modeHasIdleShop(mode);
  const hasLetters = modeHasLetterShop(mode);
  const [tab, setTab] = useState<ShopTab>(hasIdle ? "generators" : "letters");

  const poolOnly = mode === "daily" ? letters : undefined;
  const letterItems = letterShopItems(letters, letterLevels, { poolOnly });
  const cps = totalCps(generators);

  const ownedLetters = letterItems
    .filter((i) => i.owned)
    .sort((a, b) => b.level - a.level || a.cost - b.cost);
  const lockedLetters = letterItems
    .filter((i) => !i.owned)
    .sort((a, b) => a.cost - b.cost);

  if (!hasIdle && !hasLetters) {
    return (
      <Box sx={{ px: { xs: 2, md: 3 }, pt: 2, pb: 2 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, mb: 2 }}>
          Shop
        </Typography>
        <Alert severity="info">
          This mode has no Shop. Generators and letter mastery are for Forge,
          Keystone, Daily, and Rare Rush.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ px: { xs: 2, md: 3 }, pt: 2, pb: 2 }}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        sx={{ mb: 1.5, justifyContent: "space-between", alignItems: { xs: "flex-start", sm: "center" } }}
      >
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          Shop
        </Typography>
        <Stack direction="row" spacing={1}>
          <Chip label={`${Math.floor(coins)} ✦`} color="secondary" />
          {hasIdle && (
            <Chip label={`${formatCps(cps)}/s`} variant="outlined" size="small" />
          )}
        </Stack>
      </Stack>

      <Tabs
        value={hasIdle && hasLetters ? tab : hasIdle ? "generators" : "letters"}
        onChange={(_, v: ShopTab) => setTab(v)}
        variant="fullWidth"
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 2,
          mb: 1.5,
          bgcolor: "background.paper",
          borderBottom: 1,
          borderColor: "divider",
          borderRadius: "12px 12px 0 0",
        }}
      >
        {hasIdle && <Tab label="Generators" value="generators" />}
        {hasLetters && <Tab label="Letters" value="letters" />}
      </Tabs>

      {hasIdle && tab === "generators" && (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Earn coins while you play and offline (up to 8 hours).
          </Typography>
          <Grid container spacing={1}>
            {GENERATORS.map((g) => {
              const owned = generators[g.id] ?? 0;
              const cost = generatorCost(g, owned);
              const maxed = g.maxOwned != null && owned >= g.maxOwned;
              const canBuy = !maxed && coins >= cost;
              return (
                <Grid key={g.id} size={{ xs: 12, md: 6 }}>
                <ListItem
                  component="div"
                  sx={{
                    height: "100%",
                    bgcolor: "background.paper",
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: "divider",
                    flexWrap: "wrap",
                    gap: 1,
                  }}
                  secondaryAction={
                    <Button
                      variant="contained"
                      size="small"
                      disabled={!canBuy}
                      onClick={() => buyGenerator(g.id)}
                      sx={{ minWidth: 88 }}
                    >
                      {maxed ? "Max" : `${cost} ✦`}
                    </Button>
                  }
                >
                  <ListItemText
                    primary={
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: "center" }}
                      >
                        <AutoAwesomeRoundedIcon fontSize="small" color="primary" />
                        <span>
                          {g.name} · ×{owned}
                        </span>
                      </Stack>
                    }
                    secondary={`${g.description} · ${formatCps(g.cps ?? 0)}/s each`}
                    sx={{ pr: 10 }}
                  />
                </ListItem>
                </Grid>
              );
            })}
          </Grid>
        </Box>
      )}

      {hasLetters && (tab === "letters" || !hasIdle) && (
        <Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Unlock adds a letter to your pool once. Further buys raise{" "}
            <strong>mastery</strong> — bonus score when that letter appears in a
            word. Duplicate tiles are not sold.
            {mode === "daily" ? " Daily: upgrade only today's seven letters." : ""}
          </Typography>

          {ownedLetters.length > 0 && (
            <>
              <Typography
                variant="overline"
                sx={{ fontWeight: 800, color: "text.secondary" }}
              >
                Owned · mastery
              </Typography>
              <Grid container spacing={1} sx={{ mb: 2.5, mt: 0.5 }}>
                {ownedLetters.map((item) => {
                  const maxed = item.level >= item.maxLevel;
                  const canBuy = !maxed && coins >= item.cost;
                  const rare = item.letter
                    ? EnglishWorld.rareLetters.has(item.letter)
                    : false;
                  return (
                    <Grid key={item.id} size={{ xs: 6, sm: 4, md: 3, lg: 2 }}>
                    <Box
                      sx={{
                        height: "100%",
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: "background.paper",
                        border: "2px solid",
                        borderColor: rare ? "secondary.main" : "primary.light",
                      }}
                    >
                      <Stack
                        direction="row"
                        sx={{
                          justifyContent: "space-between",
                          alignItems: "center",
                          mb: 0.5,
                        }}
                      >
                        <Typography sx={{ fontWeight: 900, fontSize: "1.35rem" }}>
                          {item.letter}
                          {rare ? " ★" : ""}
                        </Typography>
                        <Chip
                          size="small"
                          icon={<TrendingUpRoundedIcon />}
                          label={`Lv ${item.level}`}
                          color="primary"
                          sx={{ fontWeight: 800 }}
                        />
                      </Stack>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block", mb: 1 }}
                      >
                        +{(item.level - 1) * 4} mastery / use
                        {item.level < item.maxLevel
                          ? ` → Lv ${item.level + 1}`
                          : " · max"}
                      </Typography>
                      <Button
                        fullWidth
                        size="small"
                        variant={canBuy ? "contained" : "outlined"}
                        disabled={!canBuy}
                        onClick={() => item.letter && buyLetter(item.letter)}
                      >
                        {maxed ? "Maxed" : `Upgrade · ${item.cost} ✦`}
                      </Button>
                    </Box>
                    </Grid>
                  );
                })}
              </Grid>
            </>
          )}

          {mode !== "daily" && lockedLetters.length > 0 && (
            <>
              <Typography
                variant="overline"
                sx={{ fontWeight: 800, color: "text.secondary" }}
              >
                Locked
              </Typography>
              <Grid container spacing={1} sx={{ mt: 0.5 }}>
                {lockedLetters.map((item) => {
                  const canBuy = coins >= item.cost;
                  const rare = item.letter
                    ? EnglishWorld.rareLetters.has(item.letter)
                    : false;
                  return (
                    <Grid key={item.id} size={{ xs: 6, sm: 4, md: 3, lg: 2 }}>
                    <Box
                      sx={{
                        height: "100%",
                        p: 1.5,
                        borderRadius: 2,
                        bgcolor: "action.hover",
                        border: "1px dashed",
                        borderColor: rare ? "secondary.main" : "divider",
                        opacity: canBuy ? 1 : 0.85,
                      }}
                    >
                      <Stack
                        direction="row"
                        spacing={0.5}
                        sx={{ alignItems: "center", mb: 0.75 }}
                      >
                        <LockRoundedIcon fontSize="small" color="disabled" />
                        <Typography sx={{ fontWeight: 800 }}>
                          {item.letter}
                          {rare ? " ★" : ""}
                        </Typography>
                      </Stack>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block", mb: 1 }}
                      >
                        Unlock into pool
                      </Typography>
                      <Button
                        fullWidth
                        size="small"
                        variant={canBuy ? "contained" : "outlined"}
                        color="secondary"
                        disabled={!canBuy}
                        onClick={() => item.letter && buyLetter(item.letter)}
                      >
                        Unlock · {item.cost} ✦
                      </Button>
                    </Box>
                    </Grid>
                  );
                })}
              </Grid>
            </>
          )}
        </Box>
      )}
    </Box>
  );
}
