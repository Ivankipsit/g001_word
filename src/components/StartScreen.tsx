"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Box,
  Button,
  Stack,
  Typography,
  Chip,
  Grid,
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
import PushPinRoundedIcon from "@mui/icons-material/PushPinRounded";
import GridOnRoundedIcon from "@mui/icons-material/GridOnRounded";
import ShareRoundedIcon from "@mui/icons-material/ShareRounded";
import AutoStoriesRoundedIcon from "@mui/icons-material/AutoStoriesRounded";
import { EnglishWorld } from "@/dictionary/english";
import { invitePayload } from "@/lib/share";
import { useShare } from "@/components/useShare";
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
import {
  dailyPinSecret,
  dailyWord,
  formableSecret,
  pinBoardFor,
  randomWordOfLength,
  type WordleLength,
} from "@/game/puzzles";
import { useGameStore } from "@/game/store";
import { isFieldMode, openingFor, type FieldMode } from "@/game/fieldModes";
import { modeBlurb, modeDisplayName, modeIsDaily, type GameMode } from "@/game/types";
import { currentStreak, dailyComplete } from "@/game/progress";
import { wordOfDay } from "@/game/wordOfDay";
import { RARITY_COLOR, RARITY_LABEL } from "@/game/rarity";
import { dailyResultPayload } from "@/lib/share";
type Step =
  | "mode"
  | "forge"
  | "keystone"
  | "scramble"
  | "daily"
  | "affix"
  | "rare"
  | "pin"
  | "pinDaily"
  | "wordle"
  | "wordleDaily";

const SCRAMBLE_PRESETS = [
  { label: "1 min", sec: 60 },
  { label: "3 min", sec: 180 },
  { label: "5 min", sec: 300 },
] as const;

const CLUE_MODES: FieldMode[] = [
  "pos",
  "sense",
  "inflect",
  "synonym",
  "antonym",
  "blank",
  "origin",
  "homophone",
  "pronounce",
  "register",
  "kind",
];

const THREAD_MODES: FieldMode[] = ["kin", "relay", "double", "trap", "decoy", "hunt"];

function hoursMinutes(ms: number): string {
  const totalMin = Math.ceil(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const setupColumnSx = {
  maxWidth: { xs: "100%", md: 640 },
  width: "100%",
  mx: "auto",
  flex: 1,
  display: "flex",
  flexDirection: "column",
} as const;

export function StartScreen() {
  const startGame = useGameStore((s) => s.startGame);
  const resumeMode = useGameStore((s) => s.resumeMode);
  const clearModeSave = useGameStore((s) => s.clearModeSave);
  const modes = useGameStore((s) => s.modes);
  const dailyDays = useGameStore((s) => s.progress.dailyDays);
  const displayName = useGameStore((s) => s.settings.displayName);
  const [wotdOpen, setWotdOpen] = useState(false);
  const { share, feedback } = useShare();
  const [step, setStep] = useState<Step>("mode");
  const [picked, setPicked] = useState<string[]>([]);
  const [keystone, setKeystone] = useState<string | null>(null);
  const [scrambleSec, setScrambleSec] = useState(180);
  const [customMin, setCustomMin] = useState("2");
  const [dailyCountdown, setDailyCountdown] = useState(msUntilNextUtcDay());
  const [affix, setAffix] = useState<AffixOption | null>(null);
  const [rareLetter, setRareLetter] = useState<string | null>(null);
  const [resumeChoice, setResumeChoice] = useState<GameMode | null>(null);
  const [pinLocks, setPinLocks] = useState<1 | 2>(1);
  const [wordleLength, setWordleLength] = useState<WordleLength>(5);
  const [pinError, setPinError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const today = utcDateString();
  const dailyBoard = useMemo(() => dailyBoardForDate(today), [today]);
  const wotd = useMemo(() => wordOfDay(today), [today]);
  const streak = currentStreak(dailyDays, today);
  const wotdFound = useMemo(
    () => Boolean(wotd && Object.values(modes).some((s) => s?.discoveredWords?.[wotd.word])),
    [wotd, modes],
  );

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
    if (
      (m === "daily" || m === "pinDaily" || m === "wordleDaily") &&
      s.dailyDateUtc !== today
    ) {
      return false;
    }
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
    } else if (m === "pin") {
      setPinLocks(1);
      setPicked([]);
      setPinError(null);
      setStep("pin");
    } else if (m === "pinDaily") {
      setPinLocks(1);
      setPinError(null);
      setStep("pinDaily");
    } else if (m === "wordle") {
      setWordleLength(5);
      setStep("wordle");
    } else if (m === "wordleDaily") {
      setWordleLength(5);
      setStep("wordleDaily");
    } else if (isFieldMode(m)) {
      const opening = openingFor(m);
      if (!opening) {
        setFieldError("Clue list is not ready yet.");
        return;
      }
      setFieldError(null);
      startGame({ mode: m, ...opening });
    }
  };

  const dailyDone = (m: GameMode) => modeIsDaily(m) && dailyComplete(m, modes[m], today);

  const cardChip = (m: GameMode) => {
    if (!hasSave(m)) return undefined;
    return dailyDone(m) ? "Completed" : "Continue";
  };

  const dailyFooter = (m: GameMode) => {
    const save = modes[m];
    if (!save || !dailyDone(m)) return null;
    return (
      <Stack
        direction="row"
        sx={{ alignItems: "center", justifyContent: "space-between", gap: 1, px: 0.5 }}
      >
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
          Next in {hoursMinutes(dailyCountdown)}
        </Typography>
        <Button
          size="small"
          startIcon={<ShareRoundedIcon fontSize="small" />}
          onClick={() => share(dailyResultPayload(m, save))}
          sx={{ minHeight: 28, py: 0 }}
        >
          Share
        </Button>
      </Stack>
    );
  };

  const openMode = (m: GameMode) => {
    if (hasSave(m)) {
      if (modeIsDaily(m)) {
        resumeMode(m);
        return;
      }
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

  const startWordle = (daily: boolean) => {
    const secret = daily
      ? dailyWord(today, wordleLength)
      : randomWordOfLength(wordleLength);
    if (!secret) return;
    startGame({
      mode: daily ? "wordleDaily" : "wordle",
      letters: [],
      wordleLength,
      wordleSecret: secret,
    });
  };

  const startPinDaily = () => {
    const secret = dailyPinSecret(today, pinLocks);
    if (!secret) return;
    const board = pinBoardFor(secret, pinLocks, `${today}:${pinLocks}`);
    startGame({
      mode: "pinDaily",
      letters: board.pool,
      pinLocks,
      pinSecret: secret,
      pinSlots: board.slots,
    });
  };

  const startPin = () => {
    const secret = formableSecret(picked, pinLocks, new Set());
    if (!secret) {
      setPinError(
        pinLocks === 2
          ? "No 5–8 letter word fits these letters. Add a vowel."
          : "No 4–7 letter word fits these letters.",
      );
      return;
    }
    const board = pinBoardFor(secret, pinLocks, secret);
    startGame({
      mode: "pin",
      letters: picked,
      pinLocks,
      pinSecret: secret,
      pinSlots: board.slots,
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
        px: { xs: 2, md: 3 },
        py: { xs: 2, md: 3 },
      }}
    >
      {step === "mode" && (
        <Stack spacing={3} sx={{ width: "100%", maxWidth: 1100, mx: "auto" }}>
          <Stack spacing={0.75} sx={{ textAlign: "center", alignItems: "center" }}>
            <Typography
              variant="h2"
              component="h1"
              sx={{
                fontWeight: 900,
                color: "primary.main",
                fontSize: { xs: "2.25rem", sm: "2.75rem" },
                lineHeight: 1.05,
                letterSpacing: "-0.03em",
              }}
            >
              Word Forge
            </Typography>
            <Typography color="text.secondary">
              Each mode keeps its own save.
            </Typography>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Chip
                label={`${EnglishWorld.wordCount.toLocaleString()} words · ages 13+`}
                size="small"
                sx={{ bgcolor: "background.paper" }}
              />
              <Button
                size="small"
                startIcon={<ShareRoundedIcon />}
                onClick={() => share(invitePayload(displayName))}
              >
                Invite friends
              </Button>
            </Stack>
            {feedback}
            {fieldError && (
              <Typography color="warning.main" sx={{ fontWeight: 700 }}>
                {fieldError}
              </Typography>
            )}
          </Stack>

          <Grid container spacing={{ xs: 1.25, md: 2 }}>
            {wotd && (
              <Grid size={12}>
                <Box
                  component="button"
                  type="button"
                  onClick={() => setWotdOpen(true)}
                  sx={{
                    width: "100%",
                    textAlign: "left",
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    px: 2,
                    py: 1.25,
                    borderRadius: 2.5,
                    border: "1.5px solid",
                    borderColor: RARITY_COLOR[wotd.rarity],
                    bgcolor: "background.paper",
                    color: "text.primary",
                    cursor: "pointer",
                    font: "inherit",
                  }}
                >
                  <AutoStoriesRoundedIcon sx={{ color: RARITY_COLOR[wotd.rarity] }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography
                      variant="overline"
                      color="text.secondary"
                      sx={{ fontWeight: 800, lineHeight: 1.4, display: "block" }}
                    >
                      Word of the day
                    </Typography>
                    <Typography sx={{ fontWeight: 900, fontSize: "1.15rem" }} noWrap>
                      {wotd.word}
                    </Typography>
                  </Box>
                  <Chip
                    label={RARITY_LABEL[wotd.rarity]}
                    size="small"
                    sx={{ fontWeight: 700, bgcolor: RARITY_COLOR[wotd.rarity], color: "#fff" }}
                  />
                </Box>
              </Grid>
            )}
            <Grid size={12}>
              <Stack
                direction="row"
                sx={{ alignItems: "center", justifyContent: "space-between", gap: 1 }}
              >
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <SectionLabel>Today</SectionLabel>
                  {streak >= 2 && (
                    <Chip
                      icon={<LocalFireDepartmentRoundedIcon />}
                      label={`${streak}-day streak`}
                      size="small"
                      color="warning"
                      sx={{ fontWeight: 800 }}
                    />
                  )}
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                  Resets in {formatCountdown(dailyCountdown)}
                </Typography>
              </Stack>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }} sx={{ display: "flex" }}>
              <ModeCell>
                <ModeCard
                  title={modeDisplayName("daily")}
                  description={`Shared letters · key ${dailyBoard.keyLetter}`}
                  icon={<TodayRoundedIcon sx={{ fontSize: 26 }} />}
                  onClick={() => openMode("daily")}
                  accent="secondary"
                  compact
                  continueLabel={cardChip("daily")}
                  finished={dailyDone("daily")}
                />
                {dailyFooter("daily")}
              </ModeCell>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }} sx={{ display: "flex" }}>
              <ModeCell>
                <ModeCard
                  title={modeDisplayName("pinDaily")}
                  description="One word, letters already pinned"
                  icon={<PushPinRoundedIcon sx={{ fontSize: 26 }} />}
                  onClick={() => openMode("pinDaily")}
                  accent="secondary"
                  compact
                  continueLabel={cardChip("pinDaily")}
                  finished={dailyDone("pinDaily")}
                />
                {dailyFooter("pinDaily")}
              </ModeCell>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }} sx={{ display: "flex" }}>
              <ModeCell>
                <ModeCard
                  title={modeDisplayName("wordleDaily")}
                  description="Six guesses, one shared word"
                  icon={<GridOnRoundedIcon sx={{ fontSize: 26 }} />}
                  onClick={() => openMode("wordleDaily")}
                  accent="secondary"
                  compact
                  continueLabel={cardChip("wordleDaily")}
                  finished={dailyDone("wordleDaily")}
                />
                {dailyFooter("wordleDaily")}
              </ModeCell>
            </Grid>

            <Grid size={12}>
              <SectionLabel>Play</SectionLabel>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }} sx={{ display: "flex" }}>
              <ModeCell>
                <ModeCard
                  title={modeDisplayName("forge")}
                  description="Choose your letters and build at your own pace."
                  icon={<ConstructionRoundedIcon sx={{ fontSize: 36 }} />}
                  onClick={() => openMode("forge")}
                  accent="primary"
                  featured
                  continueLabel={hasSave("forge") ? "Continue" : undefined}
                />
              </ModeCell>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }} sx={{ display: "flex" }}>
              <ModeCell>
                <ModeCard
                  title={modeDisplayName("wordle")}
                  description="4, 5, or 6 letters"
                  icon={<GridOnRoundedIcon sx={{ fontSize: 26 }} />}
                  onClick={() => openMode("wordle")}
                  accent="primary"
                  compact
                  continueLabel={hasSave("wordle") ? "Continue" : undefined}
                />
              </ModeCell>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }} sx={{ display: "flex" }}>
              <ModeCell>
                <ModeCard
                  title={modeDisplayName("pin")}
                  description="Fill around the pins"
                  icon={<PushPinRoundedIcon sx={{ fontSize: 26 }} />}
                  onClick={() => openMode("pin")}
                  accent="primary"
                  compact
                  continueLabel={hasSave("pin") ? "Continue" : undefined}
                />
              </ModeCell>
            </Grid>

            <Grid size={12}>
              <SectionLabel>More</SectionLabel>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }} sx={{ display: "flex" }}>
              <ModeCell>
                <ModeCard
                  title={modeDisplayName("scramble")}
                  description="Score before the clock"
                  icon={<TimerRoundedIcon sx={{ fontSize: 26 }} />}
                  onClick={() => openMode("scramble")}
                  accent="secondary"
                  compact
                  continueLabel={hasSave("scramble") ? "Continue" : undefined}
                />
              </ModeCell>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }} sx={{ display: "flex" }}>
              <ModeCell>
                <ModeCard
                  title={modeDisplayName("heat")}
                  description="Push the combo"
                  icon={<LocalFireDepartmentRoundedIcon sx={{ fontSize: 26 }} />}
                  onClick={() => openMode("heat")}
                  accent="secondary"
                  compact
                  continueLabel={hasSave("heat") ? "Continue" : undefined}
                />
              </ModeCell>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }} sx={{ display: "flex" }}>
              <ModeCell>
                <ModeCard
                  title={modeDisplayName("define")}
                  description="Spell the meaning"
                  icon={<MenuBookRoundedIcon sx={{ fontSize: 26 }} />}
                  onClick={() => openMode("define")}
                  accent="secondary"
                  compact
                  continueLabel={hasSave("define") ? "Continue" : undefined}
                />
              </ModeCell>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }} sx={{ display: "flex" }}>
              <ModeCell>
                <ModeCard
                  title={modeDisplayName("echo")}
                  description="Chain the last letter"
                  icon={<GraphicEqRoundedIcon sx={{ fontSize: 26 }} />}
                  onClick={() => openMode("echo")}
                  accent="secondary"
                  compact
                  continueLabel={hasSave("echo") ? "Continue" : undefined}
                />
              </ModeCell>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }} sx={{ display: "flex" }}>
              <ModeCell>
                <ModeCard
                  title={modeDisplayName("keystone")}
                  description="Bonus on one letter"
                  icon={<VpnKeyRoundedIcon sx={{ fontSize: 26 }} />}
                  onClick={() => openMode("keystone")}
                  accent="secondary"
                  compact
                  continueLabel={hasSave("keystone") ? "Continue" : undefined}
                />
              </ModeCell>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }} sx={{ display: "flex" }}>
              <ModeCell>
                <ModeCard
                  title={modeDisplayName("rare")}
                  description="A rare letter required"
                  icon={<WhatshotRoundedIcon sx={{ fontSize: 26 }} />}
                  onClick={() => openMode("rare")}
                  accent="secondary"
                  compact
                  continueLabel={hasSave("rare") ? "Continue" : undefined}
                />
              </ModeCell>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }} sx={{ display: "flex" }}>
              <ModeCell>
                <ModeCard
                  title={modeDisplayName("ladder")}
                  description="Longer each word"
                  icon={<StairsRoundedIcon sx={{ fontSize: 26 }} />}
                  onClick={() => openMode("ladder")}
                  accent="secondary"
                  compact
                  continueLabel={hasSave("ladder") ? "Continue" : undefined}
                />
              </ModeCell>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }} sx={{ display: "flex" }}>
              <ModeCell>
                <ModeCard
                  title={modeDisplayName("affix")}
                  description="Prefix or suffix"
                  icon={<TextFieldsRoundedIcon sx={{ fontSize: 26 }} />}
                  onClick={() => openMode("affix")}
                  accent="secondary"
                  compact
                  continueLabel={hasSave("affix") ? "Continue" : undefined}
                />
              </ModeCell>
            </Grid>

            <Grid size={12}>
              <SectionLabel>Clues</SectionLabel>
            </Grid>
            {CLUE_MODES.map((m) => (
              <Grid key={m} size={{ xs: 6, md: 3 }} sx={{ display: "flex" }}>
                <ModeCell>
                  <ModeCard
                    title={modeDisplayName(m)}
                    description={modeBlurb(m)}
                    icon={<MenuBookRoundedIcon sx={{ fontSize: 26 }} />}
                    onClick={() => openMode(m)}
                    accent="secondary"
                    compact
                    continueLabel={cardChip(m)}
                  />
                </ModeCell>
              </Grid>
            ))}
            <Grid size={12}>
              <SectionLabel>Threads</SectionLabel>
            </Grid>
            {THREAD_MODES.map((m) => (
              <Grid key={m} size={{ xs: 6, md: 3 }} sx={{ display: "flex" }}>
                <ModeCell>
                  <ModeCard
                    title={modeDisplayName(m)}
                    description={modeBlurb(m)}
                    icon={<GraphicEqRoundedIcon sx={{ fontSize: 26 }} />}
                    onClick={() => openMode(m)}
                    accent="secondary"
                    compact
                    continueLabel={cardChip(m)}
                  />
                </ModeCell>
              </Grid>
            ))}
          </Grid>

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
              </Typography>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2, gap: 1, flexWrap: "wrap" }}>
              <Button onClick={() => setResumeChoice(null)}>Cancel</Button>
              {resumeChoice && !modeIsDaily(resumeChoice) && (
                <Button variant="outlined" color="secondary" onClick={onNewGame}>
                  New game
                </Button>
              )}
              <Button variant="contained" onClick={onContinueSave}>
                Continue
              </Button>
            </DialogActions>
          </Dialog>

          <Dialog open={wotdOpen && !!wotd} onClose={() => setWotdOpen(false)} fullWidth maxWidth="xs">
            {wotd && (
              <>
                <DialogTitle sx={{ fontWeight: 900 }}>{wotd.word}</DialogTitle>
                <DialogContent>
                  <Chip
                    label={RARITY_LABEL[wotd.rarity]}
                    size="small"
                    sx={{
                      mb: 1.5,
                      fontWeight: 700,
                      bgcolor: RARITY_COLOR[wotd.rarity],
                      color: "#fff",
                    }}
                  />
                  <Typography>{wotd.definition}</Typography>
                  <Typography
                    variant="body2"
                    sx={{ mt: 1.5, fontWeight: 700 }}
                    color={wotdFound ? "success.main" : "text.secondary"}
                  >
                    {wotdFound
                      ? "In your Lexicon."
                      : "Not in your Lexicon yet. Find it in any mode."}
                  </Typography>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                  <Button onClick={() => setWotdOpen(false)}>Close</Button>
                </DialogActions>
              </>
            )}
          </Dialog>
        </Stack>
      )}

      {step === "forge" && (
        <Box
          sx={setupColumnSx}
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
          sx={setupColumnSx}
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
          sx={setupColumnSx}
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
          sx={setupColumnSx}
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
          sx={setupColumnSx}
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
          <Grid container spacing={1} sx={{ mb: 2 }}>
            {AFFIX_OPTIONS.map((opt) => (
              <Grid key={opt.id} size={{ xs: 6, sm: 4, md: 3 }}>
                <Button
                  fullWidth
                  variant={affix?.id === opt.id ? "contained" : "outlined"}
                  color="secondary"
                  onClick={() => setAffix(opt)}
                  sx={{ fontWeight: 800 }}
                >
                  {opt.label}
                </Button>
              </Grid>
            ))}
          </Grid>
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
          sx={setupColumnSx}
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

      {(step === "pin" || step === "pinDaily") && (
        <Box sx={setupColumnSx}>
          <Button
            startIcon={<ArrowBackRoundedIcon />}
            onClick={() => setStep("mode")}
            sx={{ alignSelf: "flex-start", mb: 1 }}
          >
            Modes
          </Button>
          <Typography variant="h4" sx={{ fontWeight: 900, mb: 0.5 }}>
            {step === "pinDaily" ? "Daily Lock" : "Lockstep"}
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            A secret word has one or two letters already sitting in their real
            slots. Fill the rest. Hard words are at least 5 letters.
          </Typography>
          <ToggleButtonGroup
            exclusive
            fullWidth
            value={pinLocks}
            onChange={(_, v: 1 | 2 | null) => {
              if (v) setPinLocks(v);
            }}
            sx={{ mb: 2 }}
          >
            <ToggleButton value={1}>Easy · 1 pin</ToggleButton>
            <ToggleButton value={2}>Hard · 2 pins</ToggleButton>
          </ToggleButtonGroup>
          {step === "pin" && (
            <>
              <Typography color="text.secondary" sx={{ mb: 1 }}>
                Pick 4–5 letters. The secret will be spellable from them.
              </Typography>
              <Stack direction="row" spacing={0.75} sx={{ mb: 1, flexWrap: "wrap" }}>
                {picked.map((L, i) => (
                  <LetterTile key={`${L}-${i}`} letter={L} size="sm" onClick={() => removeAt(i)} />
                ))}
              </Stack>
              <Button onClick={randomize} sx={{ mb: 1, alignSelf: "flex-start" }}>
                Random letters
              </Button>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(44px, 1fr))",
                  gap: 1,
                  mb: 2,
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
            </>
          )}
          {pinError && (
            <Typography color="warning.main" sx={{ mb: 1, fontWeight: 700 }}>
              {pinError}
            </Typography>
          )}
          <Button
            variant="contained"
            size="large"
            disabled={step === "pin" && picked.length < 4}
            startIcon={<CheckRoundedIcon />}
            onClick={step === "pinDaily" ? startPinDaily : startPin}
          >
            Start
          </Button>
        </Box>
      )}

      {(step === "wordle" || step === "wordleDaily") && (
        <Box sx={setupColumnSx}>
          <Button
            startIcon={<ArrowBackRoundedIcon />}
            onClick={() => setStep("mode")}
            sx={{ alignSelf: "flex-start", mb: 1 }}
          >
            Modes
          </Button>
          <Typography variant="h4" sx={{ fontWeight: 900, mb: 0.5 }}>
            {step === "wordleDaily" ? "Daily Wordle" : "Wordle"}
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Guess a dictionary word in six tries. Tiles show a right slot, a
            letter in the wrong slot, or a miss.
            {step === "wordleDaily"
              ? " Today’s word for each length is the same for everyone."
              : ""}
          </Typography>
          <ToggleButtonGroup
            exclusive
            fullWidth
            value={wordleLength}
            onChange={(_, v: WordleLength | null) => {
              if (v) setWordleLength(v);
            }}
            sx={{ mb: 2 }}
          >
            <ToggleButton value={4}>4 letters</ToggleButton>
            <ToggleButton value={5}>5 letters</ToggleButton>
            <ToggleButton value={6}>6 letters</ToggleButton>
          </ToggleButtonGroup>
          <Button
            variant="contained"
            size="large"
            startIcon={<CheckRoundedIcon />}
            onClick={() => startWordle(step === "wordleDaily")}
          >
            Start
          </Button>
        </Box>
      )}
    </Box>
  );
}

function ModeCell({
  label,
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  return (
    <Box
      sx={{
        flex: 1,
        width: "100%",
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: 0.75,
      }}
    >
      {label ? <SectionLabel>{label}</SectionLabel> : null}
      {children}
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
  finished,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  onClick: () => void;
  accent: "primary" | "secondary";
  featured?: boolean;
  compact?: boolean;
  continueLabel?: string;
  finished?: boolean;
}) {
  const iconEl = (
    <Box
      sx={{
        color: accent === "primary" ? "primary.main" : "secondary.main",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        width: compact ? 28 : 40,
        height: compact ? 28 : 40,
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
          minHeight: compact ? "2.7em" : undefined,
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
      variant={finished ? "filled" : "outlined"}
      color="success"
      icon={finished ? <CheckRoundedIcon /> : undefined}
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
        minHeight: featured ? 112 : compact ? 132 : 88,
        flex: 1,
        width: "100%",
        alignSelf: "stretch",
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
            sx={{
              width: "100%",
              minHeight: 28,
              alignItems: "center",
              justifyContent: "space-between",
            }}
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
