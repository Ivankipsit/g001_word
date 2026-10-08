"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Box,
  Button,
  Stack,
  Typography,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  TextField,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@mui/material";
import CasinoRoundedIcon from "@mui/icons-material/CasinoRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import ConstructionRoundedIcon from "@mui/icons-material/ConstructionRounded";
import VpnKeyRoundedIcon from "@mui/icons-material/VpnKeyRounded";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import TimerRoundedIcon from "@mui/icons-material/TimerRounded";
import TodayRoundedIcon from "@mui/icons-material/TodayRounded";
import PlayArrowRoundedIcon from "@mui/icons-material/PlayArrowRounded";
import MenuBookRoundedIcon from "@mui/icons-material/MenuBookRounded";
import StairsRoundedIcon from "@mui/icons-material/StairsRounded";
import TextFieldsRoundedIcon from "@mui/icons-material/TextFieldsRounded";
import WhatshotRoundedIcon from "@mui/icons-material/WhatshotRounded";
import LocalFireDepartmentRoundedIcon from "@mui/icons-material/LocalFireDepartmentRounded";
import GraphicEqRoundedIcon from "@mui/icons-material/GraphicEqRounded";
import { EnglishWorld } from "@/dictionary/english";
import { LetterTile } from "@/components/LetterTile";
import {
  AFFIX_OPTIONS,
  LADDER_MIN,
  pickAffixStartLetters,
  pickDefinePuzzle,
  pickRareStartLetters,
  randomRareLetter,
  type AffixOption,
} from "@/game/challenges";
import {
  FORGE_START_SIZE,
  MIN_FORMABLE_WORDS,
  countFormableWordsFromSet,
  dailyBoardForDate,
  formatCountdown,
  msUntilNextUtcDay,
  pickKeystoneStartLetters,
  pickPlayableStartLetters,
  pickScrambleLetters,
  playabilityTip,
  utcDateString,
} from "@/game/letters";
import { useGameStore } from "@/game/store";
import type { GameMode } from "@/game/types";
import { modeBlurb, modeDisplayName } from "@/game/types";
type Step =
  | "mode"
  | "forge"
  | "keystone"
  | "scramble"
  | "daily"
  | "affix"
  | "rare";

const SCRAMBLE_PRESETS = [
  { label: "1 min", sec: 60 },
  { label: "3 min", sec: 180 },
  { label: "5 min", sec: 300 },
] as const;

export function StartScreen() {
  const startGame = useGameStore((s) => s.startGame);
  const resumeMode = useGameStore((s) => s.resumeMode);
  const clearModeSave = useGameStore((s) => s.clearModeSave);
  const modes = useGameStore((s) => s.modes);
  const [step, setStep] = useState<Step>("mode");
  const [picked, setPicked] = useState<string[]>([]);
  const [keystone, setKeystone] = useState<string | null>(null);
  const [scrambleSec, setScrambleSec] = useState(180);
  const [customMin, setCustomMin] = useState("2");
  const [dailyCountdown, setDailyCountdown] = useState(msUntilNextUtcDay());
  const [affix, setAffix] = useState<AffixOption | null>(null);
  const [rareLetter, setRareLetter] = useState<string | null>(null);
  const [resumeChoice, setResumeChoice] = useState<GameMode | null>(null);

  const today = utcDateString();
  const dailyBoard = useMemo(() => dailyBoardForDate(today), [today]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setDailyCountdown(msUntilNextUtcDay());
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const formable = useMemo(
    () => (step === "forge" ? countFormableWordsFromSet(picked) : 0),
    [picked, step],
  );
  const tip = playabilityTip(picked, formable);
  const canStartForge =
    picked.length >= 4 &&
    picked.length <= FORGE_START_SIZE &&
    formable >= MIN_FORMABLE_WORDS;

  const toggle = (letter: string) => {
    setPicked((prev) => {
      if (prev.includes(letter)) return prev.filter((L) => L !== letter);
      if (prev.length >= FORGE_START_SIZE) return prev;
      return [...prev, letter];
    });
  };

  const removeAt = (idx: number) => {
    setPicked((prev) => prev.filter((_, i) => i !== idx));
  };

  const randomize = () => setPicked(pickPlayableStartLetters(FORGE_START_SIZE));

  const hasSave = (m: GameMode) => {
    const s = modes[m];
    if (!s?.started) return false;
    if (m === "daily" && s.dailyDateUtc !== today) return false;
    return true;
  };

  const beginMode = (m: GameMode) => {
    if (m === "forge") {
      setPicked([]);
      setStep("forge");
    } else if (m === "keystone") {
      setKeystone(null);
      setStep("keystone");
    } else if (m === "scramble") {
      setScrambleSec(180);
      setStep("scramble");
    } else if (m === "daily") {
      setStep("daily");
    } else if (m === "define") {
      const puzzle = pickDefinePuzzle();
      startGame({
        mode: "define",
        letters: puzzle.letters,
        defineTargetWord: puzzle.target,
        defineHint: puzzle.definition,
      });
    } else if (m === "ladder") {
      startGame({
        mode: "ladder",
        letters: pickPlayableStartLetters(FORGE_START_SIZE),
        ladderNextLength: LADDER_MIN,
      });
    } else if (m === "affix") {
      setAffix(null);
      setStep("affix");
    } else if (m === "rare") {
      setRareLetter(null);
      setStep("rare");
    } else if (m === "heat") {
      startGame({
        mode: "heat",
        letters: pickPlayableStartLetters(FORGE_START_SIZE),
        scrambleDurationSec: 90,
      });
    } else if (m === "echo") {
      startGame({
        mode: "echo",
        letters: pickPlayableStartLetters(FORGE_START_SIZE),
      });
    }
  };

  const openMode = (m: GameMode) => {
    if (hasSave(m)) {
      setResumeChoice(m);
      return;
    }
    beginMode(m);
  };

  const onContinueSave = () => {
    if (!resumeChoice) return;
    resumeMode(resumeChoice);
    setResumeChoice(null);
  };

  const onNewGame = () => {
    if (!resumeChoice) return;
    const m = resumeChoice;
    clearModeSave(m);
    setResumeChoice(null);
    beginMode(m);
  };

  const startForge = () => {
    if (!canStartForge) return;
    startGame({ mode: "forge", letters: picked });
  };

  const startKeystone = () => {
    if (!keystone) return;
    const letters = pickKeystoneStartLetters(keystone, FORGE_START_SIZE);
    startGame({ mode: "keystone", letters, keystoneLetter: keystone });
  };

  const startScramble = () => {
    const letters = pickScrambleLetters();
    startGame({
      mode: "scramble",
      letters,
      scrambleDurationSec: scrambleSec,
    });
  };

  const startDaily = () => {
    startGame({
      mode: "daily",
      letters: dailyBoard.letters,
      keystoneLetter: dailyBoard.keyLetter,
    });
  };

  const startAffix = () => {
    if (!affix) return;
    startGame({
      mode: "affix",
      letters: pickAffixStartLetters(affix.match),
      affixId: affix.id,
      affixMatch: affix.match,
    });
  };

  const startRare = () => {
    const R = rareLetter ?? randomRareLetter();
    startGame({
      mode: "rare",
      letters: pickRareStartLetters(R),
      keystoneLetter: R,
    });
  };

  const applyCustomTime = () => {
    const mins = Number(customMin);
    if (!Number.isFinite(mins) || mins < 0.5 || mins > 30) return;
    setScrambleSec(Math.round(mins * 60));
  };

  return (
    <Box
      sx={{
        minHeight: "calc(100dvh - 72px)",
        display: "flex",
        flexDirection: "column",
        px: 2,
        py: 3,
      }}
    >
      {step === "mode" && (
        <Stack
          spacing={3}
          sx={{
            flex: 1,
            maxWidth: 520,
            width: "100%",
            mx: "auto",
            justifyContent: "center",
          }}
        >
          <Stack spacing={1} sx={{ textAlign: "center" }}>
            <Typography
              variant="h2"
              component="h1"
              sx={{
                fontWeight: 900,
                color: "primary.main",
                fontSize: { xs: "2.75rem", sm: "3.4rem" },
                lineHeight: 1.05,
                letterSpacing: "-0.03em",
              }}
            >
              Word Forge
            </Typography>
            <Typography color="text.secondary" sx={{ maxWidth: 380, mx: "auto" }}>
              Build words from your letters. Progress is saved separately per mode.
            </Typography>
            <Chip
              label={`${EnglishWorld.wordCount.toLocaleString()} words · ages 13+`}
              size="small"
              sx={{ alignSelf: "center", bgcolor: "background.paper" }}
            />
          </Stack>

          <Stack spacing={2.5}>
            <Stack spacing={0.75}>
              <SectionLabel>Classic</SectionLabel>
              <ModeCard
                title={modeDisplayName("forge")}
                description={modeBlurb("forge")}
                icon={<ConstructionRoundedIcon sx={{ fontSize: 36 }} />}
                onClick={() => openMode("forge")}
                accent="primary"
                featured
                continueLabel={hasSave("forge") ? "Continue" : undefined}
              />
            </Stack>

            <Stack spacing={0.75}>
              <SectionLabel>Daily</SectionLabel>
              <ModeCard
                title={modeDisplayName("daily")}
                description={`${modeBlurb("daily")} · key ${dailyBoard.keyLetter}`}
                icon={<TodayRoundedIcon sx={{ fontSize: 28 }} />}
                onClick={() => openMode("daily")}
                accent="secondary"
                continueLabel={hasSave("daily") ? "Continue" : undefined}
              />
            </Stack>

            <Stack spacing={0.75}>
              <SectionLabel>Timed</SectionLabel>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 1.25,
                }}
              >
                <ModeCard
                  title={modeDisplayName("scramble")}
                  description={modeBlurb("scramble")}
                  icon={<TimerRoundedIcon sx={{ fontSize: 26 }} />}
                  onClick={() => openMode("scramble")}
                  accent="secondary"
                  compact
                  continueLabel={hasSave("scramble") ? "Continue" : undefined}
                />
                <ModeCard
                  title={modeDisplayName("heat")}
                  description={modeBlurb("heat")}
                  icon={<LocalFireDepartmentRoundedIcon sx={{ fontSize: 26 }} />}
                  onClick={() => openMode("heat")}
                  accent="secondary"
                  compact
                  continueLabel={hasSave("heat") ? "Continue" : undefined}
                />
                <ModeCard
                  title={modeDisplayName("define")}
                  description={modeBlurb("define")}
                  icon={<MenuBookRoundedIcon sx={{ fontSize: 26 }} />}
                  onClick={() => openMode("define")}
                  accent="secondary"
                  compact
                  continueLabel={hasSave("define") ? "Continue" : undefined}
                />
                <ModeCard
                  title={modeDisplayName("echo")}
                  description={modeBlurb("echo")}
                  icon={<GraphicEqRoundedIcon sx={{ fontSize: 26 }} />}
                  onClick={() => openMode("echo")}
                  accent="secondary"
                  compact
                  continueLabel={hasSave("echo") ? "Continue" : undefined}
                />
              </Box>
            </Stack>

            <Stack spacing={0.75}>
              <SectionLabel>Challenge</SectionLabel>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 1.25,
                }}
              >
                <ModeCard
                  title={modeDisplayName("keystone")}
                  description={modeBlurb("keystone")}
                  icon={<VpnKeyRoundedIcon sx={{ fontSize: 26 }} />}
                  onClick={() => openMode("keystone")}
                  accent="secondary"
                  compact
                  continueLabel={hasSave("keystone") ? "Continue" : undefined}
                />
                <ModeCard
                  title={modeDisplayName("rare")}
                  description={modeBlurb("rare")}
                  icon={<WhatshotRoundedIcon sx={{ fontSize: 26 }} />}
                  onClick={() => openMode("rare")}
                  accent="secondary"
                  compact
                  continueLabel={hasSave("rare") ? "Continue" : undefined}
                />
                <ModeCard
                  title={modeDisplayName("ladder")}
                  description={modeBlurb("ladder")}
                  icon={<StairsRoundedIcon sx={{ fontSize: 26 }} />}
                  onClick={() => openMode("ladder")}
                  accent="secondary"
                  compact
                  continueLabel={hasSave("ladder") ? "Continue" : undefined}
                />
                <ModeCard
                  title={modeDisplayName("affix")}
                  description={modeBlurb("affix")}
                  icon={<TextFieldsRoundedIcon sx={{ fontSize: 26 }} />}
                  onClick={() => openMode("affix")}
                  accent="secondary"
                  compact
                  continueLabel={hasSave("affix") ? "Continue" : undefined}
                />
              </Box>
            </Stack>
          </Stack>

          <Dialog
            open={!!resumeChoice}
            onClose={() => setResumeChoice(null)}
            fullWidth
            maxWidth="xs"
          >
            <DialogTitle sx={{ fontWeight: 900 }}>
              {resumeChoice ? modeDisplayName(resumeChoice) : "Mode"}
            </DialogTitle>
            <DialogContent>
              <Typography color="text.secondary">
                You have a saved run. Continue where you left off, or start a new
                game for this mode only (other modes stay saved).
                {resumeChoice === "daily"
                  ? " New game resets today’s progress but keeps today’s Dawn Glyph board."
                  : ""}
              </Typography>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
              <Button onClick={() => setResumeChoice(null)}>Cancel</Button>
              <Button variant="outlined" color="secondary" onClick={onNewGame}>
                New game
              </Button>
              <Button variant="contained" onClick={onContinueSave}>
                Continue
              </Button>
            </DialogActions>
          </Dialog>
        </Stack>
      )}

      {step === "forge" && (
        <Box
          sx={{
            maxWidth: 520,
            width: "100%",
            mx: "auto",
            flex: 1,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Button
            startIcon={<ArrowBackRoundedIcon />}
            onClick={() => setStep("mode")}
            sx={{ alignSelf: "flex-start", mb: 1 }}
          >
            Modes
          </Button>
          <Typography variant="h4" sx={{ fontWeight: 900, mb: 0.5 }}>
            Forge setup
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Choose 4–5 unique letters. Need at least {MIN_FORMABLE_WORDS} possible
            words to start. Letters in your pool can be reused freely in words.
          </Typography>

          <Stack
            direction="row"
            spacing={1.25}
            sx={{ mb: 1.5, minHeight: 72, justifyContent: "center" }}
          >
            {Array.from({ length: FORGE_START_SIZE }).map((_, i) =>
              picked[i] ? (
                <LetterTile
                  key={`${picked[i]}-${i}`}
                  letter={picked[i]!}
                  size="lg"
                  selected
                  onClick={() => removeAt(i)}
                />
              ) : (
                <Box
                  key={`empty-${i}`}
                  sx={{
                    width: 64,
                    height: 72,
                    borderRadius: 2,
                    border: "2px dashed",
                    borderColor: "divider",
                    bgcolor: "action.hover",
                  }}
                />
              ),
            )}
          </Stack>

          <Typography
            variant="body2"
            sx={{
              textAlign: "center",
              mb: 1,
              fontWeight: 700,
              color: canStartForge ? "success.main" : "text.secondary",
            }}
          >
            {picked.length === 0
              ? "Tap letters below"
              : `${formable}+ words possible from these letters`}
          </Typography>
          {tip && (
            <Typography
              variant="body2"
              color="warning.main"
              sx={{ textAlign: "center", mb: 1.5, fontWeight: 600 }}
            >
              {tip}
            </Typography>
          )}

          <Button
            variant="outlined"
            color="secondary"
            startIcon={<CasinoRoundedIcon />}
            onClick={randomize}
            sx={{ mb: 2, alignSelf: "center" }}
          >
            Random (playable)
          </Button>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(48px, 1fr))",
              gap: 1,
              justifyItems: "center",
              flex: 1,
              overflow: "auto",
              pb: 1,
            }}
          >
            {EnglishWorld.alphabet.map((L) => (
              <LetterTile
                key={L}
                letter={L}
                size="sm"
                selected={picked.includes(L)}
                onClick={() => toggle(L)}
              />
            ))}
          </Box>

          <Button
            variant="contained"
            color="primary"
            size="large"
            disabled={!canStartForge}
            startIcon={<CheckRoundedIcon />}
            onClick={startForge}
            sx={{ mt: 2 }}
          >
            Start forging
          </Button>
        </Box>
      )}

      {step === "keystone" && (
        <Box
          sx={{
            maxWidth: 520,
            width: "100%",
            mx: "auto",
            flex: 1,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Button
            startIcon={<ArrowBackRoundedIcon />}
            onClick={() => setStep("mode")}
            sx={{ alignSelf: "flex-start", mb: 1 }}
          >
            Modes
          </Button>
          <Typography variant="h4" sx={{ fontWeight: 900, mb: 0.5 }}>
            Keystone setup
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Pick one Keystone letter. Words that contain it score a bonus. You
            start with a playable tile pack that includes it.
          </Typography>

          <Stack
            direction="row"
            sx={{ mb: 2, minHeight: 80, justifyContent: "center" }}
          >
            {keystone ? (
              <LetterTile
                letter={keystone}
                size="lg"
                keystone
                selected
                onClick={() => setKeystone(null)}
              />
            ) : (
              <Box
                sx={{
                  width: 64,
                  height: 72,
                  borderRadius: 2,
                  border: "2px dashed",
                  borderColor: "secondary.main",
                  bgcolor: "action.hover",
                }}
              />
            )}
          </Stack>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(48px, 1fr))",
              gap: 1,
              justifyItems: "center",
              flex: 1,
              overflow: "auto",
              pb: 1,
            }}
          >
            {EnglishWorld.alphabet.map((L) => (
              <LetterTile
                key={L}
                letter={L}
                size="sm"
                keystone={keystone === L}
                selected={keystone === L}
                onClick={() => setKeystone(L)}
              />
            ))}
          </Box>

          <Button
            variant="contained"
            color="secondary"
            size="large"
            disabled={!keystone}
            startIcon={<CheckRoundedIcon />}
            onClick={startKeystone}
            sx={{ mt: 2 }}
          >
            Start with Keystone {keystone ?? ""}
          </Button>
        </Box>
      )}

      {step === "scramble" && (
        <Box
          sx={{
            maxWidth: 520,
            width: "100%",
            mx: "auto",
            flex: 1,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Button
            startIcon={<ArrowBackRoundedIcon />}
            onClick={() => setStep("mode")}
            sx={{ alignSelf: "flex-start", mb: 1 }}
          >
            Modes
          </Button>
          <Typography variant="h4" sx={{ fontWeight: 900, mb: 0.5 }}>
            Scramble setup
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            You get 6 random letters (each letter at most twice). Find as many
            dictionary words as you can before time runs out. No Shop idle —
            pure timed discovery.
          </Typography>

          <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
            Round length
          </Typography>
          <ToggleButtonGroup
            exclusive
            fullWidth
            value={
              SCRAMBLE_PRESETS.some((p) => p.sec === scrambleSec)
                ? scrambleSec
                : "custom"
            }
            onChange={(_, v: number | "custom" | null) => {
              if (typeof v === "number") setScrambleSec(v);
            }}
            sx={{ mb: 1.5 }}
          >
            {SCRAMBLE_PRESETS.map((p) => (
              <ToggleButton key={p.sec} value={p.sec} sx={{ minHeight: 48 }}>
                {p.label}
              </ToggleButton>
            ))}
            <ToggleButton value="custom" sx={{ minHeight: 48 }}>
              Custom
            </ToggleButton>
          </ToggleButtonGroup>

          {!SCRAMBLE_PRESETS.some((p) => p.sec === scrambleSec) && (
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              <TextField
                label="Minutes"
                type="number"
                size="small"
                value={customMin}
                onChange={(e) => setCustomMin(e.target.value)}
                slotProps={{ htmlInput: { min: 0.5, max: 30, step: 0.5 } }}
                sx={{ flex: 1 }}
              />
              <Button variant="outlined" onClick={applyCustomTime}>
                Apply
              </Button>
            </Stack>
          )}

          <Chip
            icon={<TimerRoundedIcon />}
            label={`${Math.round(scrambleSec / 60)} min ${scrambleSec % 60 ? `${scrambleSec % 60}s` : ""}`.trim()}
            color="secondary"
            sx={{ alignSelf: "flex-start", mb: 3, fontWeight: 800 }}
          />

          <Box sx={{ flex: 1 }} />

          <Button
            variant="contained"
            color="secondary"
            size="large"
            startIcon={<PlayArrowRoundedIcon />}
            onClick={startScramble}
          >
            Start Scramble
          </Button>
        </Box>
      )}

      {step === "daily" && (
        <Box
          sx={{
            maxWidth: 520,
            width: "100%",
            mx: "auto",
            flex: 1,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Button
            startIcon={<ArrowBackRoundedIcon />}
            onClick={() => setStep("mode")}
            sx={{ alignSelf: "flex-start", mb: 1 }}
          >
            Modes
          </Button>
          <Typography variant="h4" sx={{ fontWeight: 900, mb: 0.5 }}>
            Daily Keystone
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            How today&apos;s letters are chosen: a formula from the UTC date{" "}
            <strong>{today}</strong> builds the same 7 unique letters for every
            player (at least two vowels, Keystone is a vowel). Every word must
            include the Keystone (gold outline). Board resets at the next UTC
            midnight.
          </Typography>

          <Chip
            icon={<VpnKeyRoundedIcon />}
            label={`Keystone ${dailyBoard.keyLetter}`}
            sx={{
              alignSelf: "center",
              mb: 2,
              fontWeight: 800,
              bgcolor: "rgba(212,160,23,0.2)",
              border: "1.5px solid #D4A017",
              "& .MuiChip-icon": { color: "#D4A017" },
            }}
          />

          <Stack
            direction="row"
            spacing={1}
            sx={{ mb: 2, flexWrap: "wrap", justifyContent: "center", gap: 1 }}
          >
            {dailyBoard.letters.map((L) => (
              <LetterTile
                key={L}
                letter={L}
                size="md"
                keystone={L === dailyBoard.keyLetter}
              />
            ))}
          </Stack>

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ textAlign: "center", mb: 3, fontWeight: 700 }}
          >
            Next board in {formatCountdown(dailyCountdown)}
          </Typography>

          <Box sx={{ flex: 1 }} />

          <Button
            variant="contained"
            color="secondary"
            size="large"
            startIcon={<PlayArrowRoundedIcon />}
            onClick={startDaily}
          >
            Play today&apos;s Daily
          </Button>
        </Box>
      )}

      {step === "affix" && (
        <Box
          sx={{
            maxWidth: 520,
            width: "100%",
            mx: "auto",
            flex: 1,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Button
            startIcon={<ArrowBackRoundedIcon />}
            onClick={() => setStep("mode")}
            sx={{ alignSelf: "flex-start", mb: 1 }}
          >
            Modes
          </Button>
          <Typography variant="h4" sx={{ fontWeight: 900, mb: 0.5 }}>
            Affix
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Pick a prefix or suffix. Every valid word must include it.
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))",
              gap: 1,
              mb: 2,
            }}
          >
            {AFFIX_OPTIONS.map((opt) => (
              <Button
                key={opt.id}
                variant={affix?.id === opt.id ? "contained" : "outlined"}
                color="secondary"
                onClick={() => setAffix(opt)}
                sx={{ fontWeight: 800 }}
              >
                {opt.label}
              </Button>
            ))}
          </Box>
          <Box sx={{ flex: 1 }} />
          <Button
            variant="contained"
            color="secondary"
            size="large"
            disabled={!affix}
            startIcon={<CheckRoundedIcon />}
            onClick={startAffix}
          >
            Start with {affix?.label ?? "affix"}
          </Button>
        </Box>
      )}

      {step === "rare" && (
        <Box
          sx={{
            maxWidth: 520,
            width: "100%",
            mx: "auto",
            flex: 1,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Button
            startIcon={<ArrowBackRoundedIcon />}
            onClick={() => setStep("mode")}
            sx={{ alignSelf: "flex-start", mb: 1 }}
          >
            Modes
          </Button>
          <Typography variant="h4" sx={{ fontWeight: 900, mb: 0.5 }}>
            Rare Rush
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Pick a rare letter — every word must include it. Or roll random.
          </Typography>
          <Stack
            direction="row"
            spacing={1}
            sx={{ mb: 2, flexWrap: "wrap", justifyContent: "center", gap: 1 }}
          >
            {(["J", "K", "Q", "V", "X", "Z"] as const).map((L) => (
              <LetterTile
                key={L}
                letter={L}
                size="md"
                keystone={rareLetter === L}
                selected={rareLetter === L}
                onClick={() => setRareLetter(L)}
              />
            ))}
          </Stack>
          <Button
            variant="outlined"
            startIcon={<CasinoRoundedIcon />}
            onClick={() => setRareLetter(randomRareLetter())}
            sx={{ mb: 2, alignSelf: "center" }}
          >
            Random rare
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button
            variant="contained"
            color="secondary"
            size="large"
            disabled={!rareLetter}
            startIcon={<CheckRoundedIcon />}
            onClick={startRare}
          >
            Start with {rareLetter ?? "?"}
          </Button>
        </Box>
      )}
    </Box>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Typography
      variant="overline"
      sx={{ fontWeight: 800, color: "text.secondary", letterSpacing: 1.2 }}
    >
      {children}
    </Typography>
  );
}

function ModeCard({
  title,
  description,
  icon,
  onClick,
  accent,
  featured,
  compact,
  continueLabel,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  onClick: () => void;
  accent: "primary" | "secondary";
  featured?: boolean;
  compact?: boolean;
  continueLabel?: string;
}) {
  const iconEl = (
    <Box
      sx={{
        color: accent === "primary" ? "primary.main" : "secondary.main",
        display: "flex",
        flexShrink: 0,
        lineHeight: 0,
      }}
    >
      {icon}
    </Box>
  );

  const textEl = (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography
        variant={featured ? "h5" : "subtitle1"}
        sx={{ fontWeight: 900, mb: 0.25, lineHeight: 1.2 }}
      >
        {title}
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{
          fontSize: compact ? "0.78rem" : "0.875rem",
          lineHeight: 1.35,
        }}
      >
        {description}
      </Typography>
    </Box>
  );

  const continueChip = continueLabel ? (
    <Chip
      label={continueLabel}
      size="small"
      variant="outlined"
      color="success"
      sx={{ fontWeight: 700, height: 22, flexShrink: 0 }}
    />
  ) : null;

  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        textAlign: "left",
        border: featured ? "3px solid" : "1.5px solid",
        borderColor: accent === "primary" ? "primary.main" : "divider",
        borderRadius: 2.5,
        bgcolor: "background.paper",
        color: "text.primary",
        p: featured ? 2.5 : compact ? 1.5 : 2,
        cursor: "pointer",
        minHeight: featured ? 112 : compact ? 108 : 88,
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: compact ? "column" : "row",
        gap: compact ? 0.75 : 1.5,
        alignItems: compact ? "stretch" : "center",
        transition: "transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease",
        WebkitTapHighlightColor: "transparent",
        boxShadow: featured
          ? (t) =>
              t.palette.mode === "dark"
                ? "0 10px 28px rgba(0,0,0,0.4)"
                : "0 10px 28px rgba(28,36,34,0.12)"
          : "none",
        "&:hover": {
          transform: "translateY(-2px)",
          borderColor: accent === "primary" ? "primary.main" : "secondary.main",
          boxShadow: (t) =>
            t.palette.mode === "dark"
              ? "0 8px 24px rgba(0,0,0,0.35)"
              : "0 8px 24px rgba(28,36,34,0.1)",
        },
        "&:active": { transform: "translateY(0)" },
      }}
    >
      {compact ? (
        <>
          <Stack
            direction="row"
            spacing={1}
            sx={{ width: "100%", alignItems: "center", justifyContent: "space-between" }}
          >
            {iconEl}
            {continueChip}
          </Stack>
          {textEl}
        </>
      ) : (
        <>
          {iconEl}
          {textEl}
          {continueChip}
        </>
      )}
    </Box>
  );
}
