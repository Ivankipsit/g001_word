"use client";

import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
  Snackbar,
  Alert,
  Tooltip,
} from "@mui/material";
import BackspaceRoundedIcon from "@mui/icons-material/BackspaceRounded";
import ClearAllRoundedIcon from "@mui/icons-material/ClearAllRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import VpnKeyRoundedIcon from "@mui/icons-material/VpnKeyRounded";
import ShuffleRoundedIcon from "@mui/icons-material/ShuffleRounded";
import TimerRoundedIcon from "@mui/icons-material/TimerRounded";
import AppsRoundedIcon from "@mui/icons-material/AppsRounded";
import LightbulbRoundedIcon from "@mui/icons-material/LightbulbRounded";
import { LetterTile } from "@/components/LetterTile";
import { ScorePop } from "@/components/ScorePop";
import { ComboMeter } from "@/components/ComboMeter";
import { useGameStore } from "@/game/store";
import { totalCps } from "@/game/shop";
import { formatCps } from "@/game/idle";
import {
  formatCountdown,
  msUntilNextUtcDay,
} from "@/game/letters";
import { MIN_WORD_LENGTH } from "@/game/constants";
import {
  HINT_COST_DEFINE_BASE,
  HINT_COST_DEFINE_STEP,
  HINT_COST_GENERAL,
  modeDisplayName,
  modeHasIdleShop,
  modeIsTimedRound,
} from "@/game/types";

export function PlayScreen() {
  const letters = useGameStore((s) => s.letters);
  const letterLevels = useGameStore((s) => s.letterLevels);
  const draft = useGameStore((s) => s.draft);
  const draftIndices = useGameStore((s) => s.draftIndices);
  const coins = useGameStore((s) => s.coins);
  const generators = useGameStore((s) => s.generators);
  const mode = useGameStore((s) => s.mode);
  const keystoneLetter = useGameStore((s) => s.keystoneLetter);
  const defineHint = useGameStore((s) => s.defineHint);
  const hintReveals = useGameStore((s) => s.hintReveals);
  const ladderNextLength = useGameStore((s) => s.ladderNextLength);
  const affixMatch = useGameStore((s) => s.affixMatch);
  const heatPeakCombo = useGameStore((s) => s.heatPeakCombo);
  const echoLastLetter = useGameStore((s) => s.echoLastLetter);
  const comboTier = useGameStore((s) => s.comboTier);
  const comboExpiresAt = useGameStore((s) => s.comboExpiresAt);
  const lastScorePop = useGameStore((s) => s.lastScorePop);
  const lastOffline = useGameStore((s) => s.lastOffline);
  const scrambleEndsAt = useGameStore((s) => s.scrambleEndsAt);
  const scrambleRoundActive = useGameStore((s) => s.scrambleRoundActive);
  const scrambleRoundWords = useGameStore((s) => s.scrambleRoundWords);
  const scrambleShowResults = useGameStore((s) => s.scrambleShowResults);
  const totalScore = useGameStore((s) => s.totalScore);
  const toggleDraftLetter = useGameStore((s) => s.toggleDraftLetter);
  const clearDraft = useGameStore((s) => s.clearDraft);
  const backspaceDraft = useGameStore((s) => s.backspaceDraft);
  const submitWord = useGameStore((s) => s.submitWord);
  const buyHint = useGameStore((s) => s.buyHint);
  const shuffleLetters = useGameStore((s) => s.shuffleLetters);
  const dismissScorePop = useGameStore((s) => s.dismissScorePop);
  const dismissOffline = useGameStore((s) => s.dismissOffline);
  const endScrambleRound = useGameStore((s) => s.endScrambleRound);
  const dismissScrambleResults = useGameStore((s) => s.dismissScrambleResults);
  const startScrambleRound = useGameStore((s) => s.startScrambleRound);
  const ensureDailyBoard = useGameStore((s) => s.ensureDailyBoard);
  const leaveToModePicker = useGameStore((s) => s.leaveToModePicker);
  const tickCombo = useGameStore((s) => s.tickCombo);

  const [error, setError] = useState<string | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [scrambleLeft, setScrambleLeft] = useState(0);
  const [dailyLeft, setDailyLeft] = useState(msUntilNextUtcDay());
  const [now, setNow] = useState(() => Date.now());
  const [tierFlash, setTierFlash] = useState(false);
  const cps = totalCps(generators);
  const title = modeDisplayName(mode);
  const hintCost =
    mode === "define"
      ? HINT_COST_DEFINE_BASE + (hintReveals ?? 0) * HINT_COST_DEFINE_STEP
      : HINT_COST_GENERAL;
  const key = keystoneLetter?.toUpperCase() ?? "";
  const showKeyOutline =
    mode === "keystone" || mode === "daily" || mode === "rare";
  const draftHasKeystone =
    showKeyOutline &&
    Boolean(key) &&
    draft.some((L) => L.toUpperCase() === key);

  const confirmLeave = () => {
    if (modeIsTimedRound(mode) && scrambleRoundActive) {
      endScrambleRound();
    }
    leaveToModePicker();
    setLeaveOpen(false);
  };

  useEffect(() => {
    if (!modeIsTimedRound(mode) || !scrambleRoundActive || !scrambleEndsAt)
      return;
    const tick = () => {
      const left = Math.max(0, scrambleEndsAt - Date.now());
      setScrambleLeft(left);
      if (left <= 0) endScrambleRound();
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [mode, scrambleRoundActive, scrambleEndsAt, endScrambleRound]);

  useEffect(() => {
    if (mode !== "daily") return;
    ensureDailyBoard();
    const id = window.setInterval(() => {
      setDailyLeft(msUntilNextUtcDay());
      ensureDailyBoard();
    }, 1000);
    return () => window.clearInterval(id);
  }, [mode, ensureDailyBoard]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now());
      tickCombo();
    }, 200);
    return () => window.clearInterval(id);
  }, [tickCombo]);

  useEffect(() => {
    if (!lastScorePop?.tierUp) return;
    setTierFlash(true);
    const t = window.setTimeout(() => setTierFlash(false), 450);
    return () => window.clearTimeout(t);
  }, [lastScorePop?.id, lastScorePop?.tierUp]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        backspaceDraft();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [backspaceDraft]);

  const onSubmit = () => {
    const result = submitWord();
    if (!result.ok) setError(result.reason ?? "Could not submit");
  };

  const onHint = () => {
    const result = buyHint();
    if (!result.ok) setError(result.reason ?? "Hint unavailable");
  };

  const draftCountForIndex = (i: number) =>
    draftIndices.filter((x) => x === i).length;

  return (
    <Box sx={{ px: 2, pt: 2, pb: 1 }}>
      <Stack
        direction="row"
        spacing={1}
        sx={{
          mb: 1.5,
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 1,
        }}
      >
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Tooltip title="Modes — leave this run (progress saved)">
            <IconButton
              aria-label="Leave to mode picker"
              onClick={() => setLeaveOpen(true)}
              size="small"
              sx={{
                border: "1px solid",
                borderColor: "divider",
                bgcolor: "background.paper",
              }}
            >
              <AppsRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            {title}
          </Typography>
          {(mode === "keystone" || mode === "daily" || mode === "rare") &&
            keystoneLetter && (
              <Chip
                icon={<VpnKeyRoundedIcon />}
                label={
                  mode === "rare"
                    ? `Rare ${keystoneLetter}`
                    : `Keystone ${keystoneLetter}`
                }
                size="small"
                sx={{
                  fontWeight: 800,
                  bgcolor: "rgba(212,160,23,0.2)",
                  border: "1.5px solid #D4A017",
                  color: "text.primary",
                  "& .MuiChip-icon": { color: "#D4A017" },
                }}
              />
            )}
          {mode === "ladder" && (
            <Chip
              label={`Need ${ladderNextLength ?? 3} letters`}
              color="primary"
              size="small"
              sx={{ fontWeight: 800 }}
            />
          )}
          {mode === "affix" && affixMatch && (
            <Chip
              label={`Affix ·${affixMatch.toUpperCase()}·`}
              color="secondary"
              size="small"
              sx={{ fontWeight: 800 }}
            />
          )}
          {mode === "echo" && (
            <Chip
              label={
                echoLastLetter
                  ? `Next starts with ${echoLastLetter}`
                  : "Any first word"
              }
              color="secondary"
              size="small"
              sx={{ fontWeight: 800 }}
            />
          )}
          {mode === "heat" && scrambleRoundActive && (
            <Chip
              label={`Peak ×${heatPeakCombo ?? 0}`}
              size="small"
              sx={{ fontWeight: 800 }}
            />
          )}
        </Stack>
        <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
          {modeIsTimedRound(mode) && scrambleRoundActive && (
            <Chip
              icon={<TimerRoundedIcon />}
              label={formatCountdown(scrambleLeft)}
              color={scrambleLeft < 15000 ? "error" : "secondary"}
              sx={{ fontWeight: 800 }}
            />
          )}
          {mode === "daily" && (
            <Chip
              label={`Next ${formatCountdown(dailyLeft)}`}
              size="small"
              variant="outlined"
            />
          )}
          <Chip label={`${Math.floor(coins)} ✦`} color="secondary" />
          {modeHasIdleShop(mode) && cps > 0 && (
            <Chip label={`${formatCps(cps)}/s`} variant="outlined" size="small" />
          )}
        </Stack>
      </Stack>

      <ComboMeter
        tier={comboTier ?? 0}
        expiresAt={comboExpiresAt ?? null}
        now={now}
        tierUpFlash={tierFlash}
      />

      {mode === "define" && defineHint && (
        <Alert severity="info" sx={{ mb: 1.5 }} icon={false}>
          <Typography
            variant="caption"
            sx={{ fontWeight: 800, display: "block", mb: 0.5 }}
          >
            Clue
          </Typography>
          <Typography variant="body2">{defineHint}</Typography>
        </Alert>
      )}

      {mode === "daily" && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Words must include Keystone {keystoneLetter} (gold outline). Letters are
          generated from today&apos;s UTC date so every player gets the same board —
          at least two vowels, keyed for playability. Resets at UTC midnight.
        </Typography>
      )}

      {mode === "ladder" && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Submit a word with exactly {ladderNextLength ?? 3} letters, then the rung
          climbs. After 8, it loops back to 3.
        </Typography>
      )}

      {mode === "affix" && affixMatch && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Every word must include “{affixMatch.toUpperCase()}”.
        </Typography>
      )}

      {mode === "rare" && keystoneLetter && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Every word must include rare letter {keystoneLetter} (gold outline).
        </Typography>
      )}

      {mode === "heat" && scrambleRoundActive && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          90 seconds — stack combo tiers as high as you can. Peak multiplier this
          round: ×{heatPeakCombo ?? 0}.
        </Typography>
      )}

      {mode === "echo" && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {echoLastLetter
            ? `Your next word must start with ${echoLastLetter}.`
            : "Build any word first — then each word must start with the last letter of the previous one."}
        </Typography>
      )}

      {(mode === "keystone" || mode === "daily" || mode === "rare") &&
        keystoneLetter && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mb: 1 }}
          >
            Gold outline ={" "}
            {mode === "rare"
              ? "required rare letter"
              : mode === "daily"
                ? "required Keystone"
                : "Keystone (bonus when used)"}
            .
          </Typography>
        )}

      {modeIsTimedRound(mode) &&
        !scrambleRoundActive &&
        !scrambleShowResults && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Round finished. Start another{" "}
            {mode === "heat" ? "Heat Wave" : "Scramble"} when you&apos;re ready.
            <Button
              size="small"
              sx={{ ml: 1 }}
              onClick={() => startScrambleRound()}
            >
              New round
            </Button>
          </Alert>
        )}

      <ScorePop event={lastScorePop} onDismiss={dismissScorePop} />

      <Box
        sx={{
          minHeight: 64,
          mb: 2,
          px: 2,
          py: 1.5,
          borderRadius: 2,
          bgcolor: draftHasKeystone
            ? "rgba(212,160,23,0.08)"
            : "background.paper",
          border: "2px solid",
          borderColor: draftHasKeystone
            ? "#D4A017"
            : draft.length
              ? "primary.main"
              : "divider",
          boxShadow: draftHasKeystone
            ? "0 0 0 2px rgba(212,160,23,0.18)"
            : undefined,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 0.75,
          flexWrap: "wrap",
        }}
      >
        {draft.length === 0 ? (
          <Typography color="text.secondary">Tap tiles to build a word</Typography>
        ) : (
          draft.map((L, i) => (
            <Typography
              key={`${L}-${i}`}
              component="span"
              sx={{
                fontWeight: 900,
                fontSize: "1.75rem",
                letterSpacing: 2,
                color:
                  key && L.toUpperCase() === key ? "#D4A017" : "text.primary",
                textShadow:
                  key && L.toUpperCase() === key
                    ? "0 0 8px rgba(212,160,23,0.45)"
                    : undefined,
              }}
            >
              {L}
            </Typography>
          ))
        )}
      </Box>

      <Stack direction="row" spacing={1} sx={{ mb: 1.25 }}>
        <Button
          fullWidth
          variant="outlined"
          color="inherit"
          startIcon={<BackspaceRoundedIcon />}
          onClick={backspaceDraft}
          disabled={draft.length === 0}
        >
          Backspace
        </Button>
        <Button
          fullWidth
          variant="outlined"
          color="inherit"
          startIcon={<ClearAllRoundedIcon />}
          onClick={clearDraft}
          disabled={draft.length === 0 && !(comboTier && comboTier >= 3)}
        >
          Clear
        </Button>
      </Stack>
      <Stack direction="row" spacing={1} sx={{ mb: 2.5 }}>
        <Button
          fullWidth
          variant="outlined"
          color="secondary"
          startIcon={<LightbulbRoundedIcon />}
          onClick={onHint}
          disabled={
            coins < hintCost ||
            (modeIsTimedRound(mode) && !scrambleRoundActive)
          }
        >
          Hint · {hintCost}✦
        </Button>
        <Button
          fullWidth
          variant="contained"
          startIcon={<SendRoundedIcon />}
          onClick={onSubmit}
          disabled={
            draft.length < MIN_WORD_LENGTH ||
            (modeIsTimedRound(mode) && !scrambleRoundActive)
          }
        >
          Submit
        </Button>
      </Stack>

      <Stack
        direction="row"
        sx={{ mb: 1, justifyContent: "space-between", alignItems: "center" }}
      >
        <Typography variant="subtitle2" color="text.secondary">
          Your letters
        </Typography>
        <Tooltip title="Shuffle letter order">
          <IconButton
            aria-label="Shuffle letters"
            onClick={shuffleLetters}
            size="small"
            disabled={letters.length < 2}
          >
            <ShuffleRoundedIcon />
          </IconButton>
        </Tooltip>
      </Stack>
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 1.25,
          justifyContent: "center",
        }}
      >
        {letters.map((L, i) => {
          const level = letterLevels[L.toUpperCase()] ?? 0;
          const used = draftCountForIndex(i);
          const selected =
            mode === "scramble" ? draftIndices.includes(i) : used > 0;
          return (
            <Box key={`${L}-${i}`} sx={{ position: "relative" }}>
              <LetterTile
                letter={L}
                size="lg"
                selected={selected}
                keystone={
                  (mode === "keystone" ||
                    mode === "daily" ||
                    mode === "rare") &&
                  Boolean(key) &&
                  L.toUpperCase() === key
                }
                disabled={mode === "scramble" && !scrambleRoundActive}
                onClick={() => toggleDraftLetter(i)}
              />
              {level > 1 && (
                <Chip
                  label={`Lv${level}`}
                  size="small"
                  color="primary"
                  sx={{
                    position: "absolute",
                    top: -8,
                    right: -8,
                    height: 20,
                    fontSize: "0.65rem",
                    fontWeight: 800,
                  }}
                />
              )}
              {used > 1 && (
                <Typography
                  variant="caption"
                  sx={{
                    position: "absolute",
                    bottom: -4,
                    left: "50%",
                    transform: "translateX(-50%)",
                    fontWeight: 800,
                    bgcolor: "background.paper",
                    px: 0.5,
                    borderRadius: 1,
                  }}
                >
                  ×{used}
                </Typography>
              )}
            </Box>
          );
        })}
      </Box>

      <Snackbar
        open={!!error}
        autoHideDuration={2200}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert severity="warning" onClose={() => setError(null)} variant="filled">
          {error}
        </Alert>
      </Snackbar>

      <Snackbar
        open={!!lastOffline}
        autoHideDuration={5000}
        onClose={dismissOffline}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert severity="success" onClose={dismissOffline} variant="filled">
          Welcome back! +{lastOffline?.earned ?? 0} coins from idle.
        </Alert>
      </Snackbar>

      <Dialog
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle sx={{ fontWeight: 900 }}>Leave to modes?</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            {modeIsTimedRound(mode) && scrambleRoundActive
              ? `This ends the current ${mode === "heat" ? "Heat Wave" : "Scramble"} round, then opens the mode picker. Progress for each mode is saved separately.`
              : "Opens the mode picker. This mode's progress stays saved — other modes are never wiped."}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setLeaveOpen(false)}>Stay</Button>
          <Button variant="contained" color="primary" onClick={confirmLeave}>
            Modes
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={scrambleShowResults}
        onClose={dismissScrambleResults}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle sx={{ fontWeight: 900 }}>
          {mode === "heat" ? "Heat Wave results" : "Scramble results"}
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 1 }}>
            Words this round:{" "}
            <strong>{scrambleRoundWords?.length ?? 0}</strong>
          </Typography>
          {mode === "heat" && (
            <Typography sx={{ mb: 1 }}>
              Peak combo: <strong>×{heatPeakCombo ?? 0}</strong>
            </Typography>
          )}
          <Typography sx={{ mb: 1.5 }} color="text.secondary">
            Mode score: {totalScore} · Coins: {Math.floor(coins)}
          </Typography>
          {(scrambleRoundWords?.length ?? 0) > 0 ? (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
              {scrambleRoundWords!.map((w) => (
                <Chip key={w} label={w.toUpperCase()} size="small" />
              ))}
            </Box>
          ) : (
            <Typography color="text.secondary">No words found — try again!</Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={dismissScrambleResults}>Close</Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={() => {
              dismissScrambleResults();
              startScrambleRound();
            }}
          >
            Play again
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
