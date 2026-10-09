"use client";

import {
  memo,
  useCallback,
  useDeferredValue,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import {
  Box,
  Chip,
  Collapse,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import ShareRoundedIcon from "@mui/icons-material/ShareRounded";
import { GroupedVirtuoso, type GroupedVirtuosoHandle, type ListItem } from "react-virtuoso";
import { EnglishWorld } from "@/dictionary/english";
import type { WordRarity } from "@/dictionary/LanguageWorld";
import { useGameStore } from "@/game/store";
import type { DiscoveredWord } from "@/game/types";
import { capPoints } from "@/lib/points";
import { lexiconPayload } from "@/lib/share";
import { Points } from "@/components/Points";
import { useShare } from "@/components/useShare";
import { RARITIES, RARITY_COLOR, RARITY_LABEL } from "@/game/rarity";

function rarityChipSx(r: WordRarity, on: boolean) {
  const c = RARITY_COLOR[r];
  return {
    fontWeight: 700,
    borderColor: c,
    color: on ? "#fff" : "text.primary",
    bgcolor: on ? c : "transparent",
    "&.MuiChip-clickable:hover": { bgcolor: on ? c : `${c}22` },
  };
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const OTHER_GROUP = "#";
/** Definitions are only searched from this many characters, to keep typing responsive at 100k+ words. */
const DEFINITION_SEARCH_MIN = 3;
/** Approximate height of the pinned letter header; rows under it decide the rail's active letter. */
const STICKY_HEADER_PX = 52;

interface Entry {
  word: string;
  bestScore: number;
}

function groupKey(word: string): string {
  const c = word.charAt(0).toUpperCase();
  return c >= "A" && c <= "Z" ? c : OTHER_GROUP;
}

function rarityOf(word: string): WordRarity {
  return EnglishWorld.getRarity(word) ?? "common";
}

export function LexiconScreen() {
  const started = useGameStore((s) => s.started);
  const discoveredWords = useGameStore((s) => s.discoveredWords);
  const totalScore = useGameStore((s) => s.totalScore);
  const modes = useGameStore((s) => s.modes);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [rarityFilter, setRarityFilter] = useState<Set<WordRarity>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [activeGroup, setActiveGroup] = useState(0);
  const virtuosoRef = useRef<GroupedVirtuosoHandle>(null);
  const scrollerRef = useRef<HTMLElement | null>(null);
  const renderedRef = useRef<ListItem<unknown>[]>([]);
  const { share, feedback } = useShare();

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

  const points = useMemo(() => {
    if (started) return capPoints(totalScore);
    let sum = 0;
    for (const save of Object.values(modes)) sum += save?.totalScore ?? 0;
    return capPoints(sum);
  }, [started, totalScore, modes]);

  const sorted = useMemo<Entry[]>(
    () =>
      Object.entries(lexicon)
        .map(([word, meta]) => ({ word, bestScore: meta.bestScore }))
        .sort((a, b) => a.word.localeCompare(b.word)),
    [lexicon],
  );

  const tierCounts = useMemo(() => {
    const counts = Object.fromEntries(RARITIES.map((r) => [r, 0])) as Record<WordRarity, number>;
    for (const e of sorted) counts[rarityOf(e.word)] += 1;
    return counts;
  }, [sorted]);

  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const searchDefs = q.length >= DEFINITION_SEARCH_MIN;
    if (!q && rarityFilter.size === 0) return sorted;
    return sorted.filter((e) => {
      if (rarityFilter.size > 0 && !rarityFilter.has(rarityOf(e.word))) return false;
      if (!q) return true;
      if (e.word.includes(q)) return true;
      return searchDefs && (EnglishWorld.getDefinition(e.word)?.toLowerCase().includes(q) ?? false);
    });
  }, [sorted, deferredQuery, rarityFilter]);

  const { groups, groupCounts } = useMemo(() => {
    const groups: string[] = [];
    const groupCounts: number[] = [];
    for (const e of filtered) {
      const key = groupKey(e.word);
      if (groups[groups.length - 1] !== key) {
        groups.push(key);
        groupCounts.push(0);
      }
      groupCounts[groupCounts.length - 1]! += 1;
    }
    return { groups, groupCounts };
  }, [filtered]);

  const toggleRarity = (r: WordRarity) => {
    setRarityFilter((prev) => {
      const next = new Set(prev);
      if (next.has(r)) next.delete(r);
      else next.add(r);
      return next;
    });
  };

  const toggleExpanded = useCallback((word: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(word)) next.delete(word);
      else next.add(word);
      return next;
    });
  }, []);

  const syncActiveGroup = useCallback(() => {
    const below = (scrollerRef.current?.scrollTop ?? 0) + STICKY_HEADER_PX;
    const items = renderedRef.current;
    const top =
      items.find((i) => i.type !== "group" && i.offset + i.size > below) ??
      items.find((i) => i.type !== "group");
    const g = top && "groupIndex" in top ? top.groupIndex : undefined;
    if (typeof g === "number") setActiveGroup(g);
  }, []);

  const onItemsRendered = useCallback(
    (items: ListItem<unknown>[]) => {
      renderedRef.current = items;
      syncActiveGroup();
    },
    [syncActiveGroup],
  );

  const attachScroller = useCallback(
    (el: HTMLElement | Window | null) => {
      scrollerRef.current?.removeEventListener("scroll", syncActiveGroup);
      scrollerRef.current = el instanceof HTMLElement ? el : null;
      scrollerRef.current?.addEventListener("scroll", syncActiveGroup, { passive: true });
    },
    [syncActiveGroup],
  );

  const jumpTo = useCallback(
    (letter: string) => {
      let groupIndex = groups.indexOf(letter);
      if (groupIndex < 0) {
        groupIndex = groups.findIndex((g) => g !== OTHER_GROUP && g > letter);
        if (groupIndex < 0) groupIndex = groups.length - 1;
      }
      if (groupIndex < 0) return;
      virtuosoRef.current?.scrollToIndex({ groupIndex, align: "start" });
    },
    [groups],
  );

  const onRailWheel = useCallback((deltaY: number) => {
    scrollerRef.current?.scrollBy({ top: deltaY });
  }, []);

  const count = Object.keys(lexicon).length;
  const present = useMemo(() => new Set(groups), [groups]);
  const activeLetter = groups[Math.min(activeGroup, groups.length - 1)] ?? null;

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: "column",
        px: { xs: 2, md: 3 },
        pt: 2,
        pb: "calc(8px + env(safe-area-inset-bottom))",
      }}
    >
      <Box sx={{ flexShrink: 0 }}>
        <Stack direction="row" spacing={1} sx={{ mb: 1.5, alignItems: "center" }}>
          <Typography variant="h5" sx={{ fontWeight: 800, flex: 1 }}>
            Lexicon
          </Typography>
          <Chip
            label={
              <>
                {count.toLocaleString()} words · <Points value={points} /> pts
              </>
            }
            color="primary"
            variant="outlined"
          />
          <Tooltip title="Share your lexicon">
            <span>
              <IconButton
                aria-label="Share your lexicon"
                disabled={count === 0}
                onClick={() => share(lexiconPayload(count, points))}
              >
                <ShareRoundedIcon />
              </IconButton>
            </span>
          </Tooltip>
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
          sx={{ mb: 1.25, bgcolor: "background.paper", borderRadius: 2 }}
        />

        <Stack direction="row" spacing={0.75} sx={{ mb: 2, flexWrap: "wrap", rowGap: 0.75 }}>
          {RARITIES.map((r) => (
            <Chip
              key={r}
              label={`${RARITY_LABEL[r]} ${tierCounts[r].toLocaleString()}`}
              size="small"
              variant="outlined"
              aria-pressed={rarityFilter.has(r)}
              onClick={() => toggleRarity(r)}
              sx={rarityChipSx(r, rarityFilter.has(r))}
            />
          ))}
          {(query || rarityFilter.size > 0) && count > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ alignSelf: "center", pl: 0.5 }}>
              {filtered.length.toLocaleString()} shown
            </Typography>
          )}
        </Stack>
      </Box>

      {filtered.length === 0 ? (
        <Typography color="text.secondary" sx={{ textAlign: "center", mt: 6 }}>
          {count === 0
            ? "Discover words in any mode — definitions appear on first find."
            : "No matches."}
        </Typography>
      ) : (
        <Box sx={{ flex: 1, minHeight: 0, display: "flex", gap: 0.75 }}>
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <GroupedVirtuoso
              ref={virtuosoRef}
              scrollerRef={attachScroller}
              style={{ height: "100%", scrollbarWidth: "none" }}
              groupCounts={groupCounts}
              increaseViewportBy={{ top: 0, bottom: 400 }}
              itemsRendered={onItemsRendered}
              groupContent={(i) => (
                <LetterHeader letter={groups[i]!} count={groupCounts[i]!} />
              )}
              itemContent={(index) => {
                const e = filtered[index]!;
                return (
                  <WordRow
                    word={e.word}
                    bestScore={e.bestScore}
                    open={expanded.has(e.word)}
                    onToggle={toggleExpanded}
                  />
                );
              }}
            />
          </Box>
          <JumpRail
            present={present}
            active={activeLetter}
            onJump={jumpTo}
            onWheel={onRailWheel}
          />
        </Box>
      )}
      {feedback}
    </Box>
  );
}

function LetterHeader({ letter, count }: { letter: string; count: number }) {
  return (
    <Box sx={{ bgcolor: "background.paper", pt: 1.5 }}>
      <Stack
        direction="row"
        spacing={1}
        sx={{
          alignItems: "baseline",
          borderBottom: "2px solid",
          borderColor: "divider",
          pb: 0.5,
          px: 1,
        }}
      >
        <Typography sx={{ fontWeight: 900, fontSize: "1.25rem", color: "primary.main" }}>
          {letter}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
          {count.toLocaleString()} {count === 1 ? "word" : "words"}
        </Typography>
      </Stack>
    </Box>
  );
}

const WordRow = memo(function WordRow({
  word,
  bestScore,
  open,
  onToggle,
}: {
  word: string;
  bestScore: number;
  open: boolean;
  onToggle: (word: string) => void;
}) {
  const rarity = rarityOf(word);
  return (
    <Box
      sx={{
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Stack
        direction="row"
        spacing={1}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => onToggle(word)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle(word);
          }
        }}
        sx={{ alignItems: "center", minHeight: 44, px: 1, cursor: "pointer" }}
      >
        <Box
          aria-label={rarity}
          sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: RARITY_COLOR[rarity], flexShrink: 0 }}
        />
        <Typography sx={{ fontWeight: 800, flex: 1, minWidth: 0 }} noWrap>
          {word}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
          best <Points value={bestScore} />
        </Typography>
      </Stack>
      <Collapse in={open} unmountOnExit>
        <Stack spacing={0.75} sx={{ px: 1, pb: 1.25 }}>
          <Typography variant="body2" color="text.secondary">
            {EnglishWorld.getDefinition(word) ?? "—"}
          </Typography>
          <Box>
            <Chip label={RARITY_LABEL[rarity]} size="small" sx={rarityChipSx(rarity, true)} />
          </Box>
        </Stack>
      </Collapse>
    </Box>
  );
});

/** A–Z strip that doubles as the list's scrollbar: shows the current letter, tap or drag to jump. */
function JumpRail({
  present,
  active,
  onJump,
  onWheel,
}: {
  present: Set<string>;
  active: string | null;
  onJump: (letter: string) => void;
  onWheel: (deltaY: number) => void;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const lastRef = useRef<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const letters = present.has(OTHER_GROUP) ? [...ALPHABET, OTHER_GROUP] : ALPHABET;

  const jumpFromPointer = (e: PointerEvent<HTMLDivElement>) => {
    const rect = railRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = (e.clientY - rect.top) / rect.height;
    const idx = Math.min(letters.length - 1, Math.max(0, Math.floor(ratio * letters.length)));
    const letter = letters[idx]!;
    setDragging(letter);
    if (letter === lastRef.current) return;
    lastRef.current = letter;
    onJump(letter);
  };

  const endDrag = () => {
    lastRef.current = null;
    setDragging(null);
  };

  return (
    <Box
      ref={railRef}
      role="scrollbar"
      aria-label="Jump to letter"
      aria-orientation="vertical"
      aria-valuetext={active ?? undefined}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        lastRef.current = null;
        jumpFromPointer(e);
      }}
      onPointerMove={(e) => {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) jumpFromPointer(e);
      }}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
      onWheel={(e) => onWheel(e.deltaY)}
      sx={{
        position: "relative",
        alignSelf: "stretch",
        maxHeight: 560,
        width: 20,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        alignItems: "center",
        touchAction: "none",
        userSelect: "none",
        cursor: "pointer",
        py: 0.25,
      }}
    >
      {letters.map((L) => {
        const isActive = L === active;
        return (
          <Box
            key={L}
            component="span"
            sx={{
              width: 18,
              lineHeight: "14px",
              textAlign: "center",
              borderRadius: 1,
              fontSize: "0.65rem",
              fontWeight: 800,
              transition: "background-color 120ms, color 120ms",
              bgcolor: isActive ? "primary.main" : "transparent",
              color: isActive
                ? "primary.contrastText"
                : present.has(L)
                  ? "text.secondary"
                  : "text.disabled",
              opacity: present.has(L) || isActive ? 1 : 0.45,
            }}
          >
            {L}
          </Box>
        );
      })}
      {dragging && (
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            zIndex: (t) => t.zIndex.tooltip,
            right: 32,
            top: `${((letters.indexOf(dragging) + 0.5) / letters.length) * 100}%`,
            transform: "translateY(-50%)",
            width: 44,
            height: 44,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            bgcolor: "primary.main",
            color: "primary.contrastText",
            fontWeight: 900,
            fontSize: "1.25rem",
            boxShadow: 4,
            pointerEvents: "none",
          }}
        >
          {dragging}
        </Box>
      )}
    </Box>
  );
}
