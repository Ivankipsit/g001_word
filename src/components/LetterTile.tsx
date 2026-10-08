"use client";

import { Box, Typography } from "@mui/material";

interface LetterTileProps {
  letter: string;
  selected?: boolean;
  disabled?: boolean;
  /** Gold ring — Keystone letter */
  keystone?: boolean;
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
}

const sizes = {
  sm: { w: 44, h: 48, font: "1.15rem" },
  md: { w: 56, h: 62, font: "1.45rem" },
  lg: { w: 64, h: 72, font: "1.7rem" },
};

const KEYSTONE_GOLD = "#D4A017";

export function LetterTile({
  letter,
  selected = false,
  disabled = false,
  keystone = false,
  size = "md",
  onClick,
}: LetterTileProps) {
  const s = sizes[size];
  const borderColor = keystone
    ? KEYSTONE_GOLD
    : selected
      ? "secondary.main"
      : "primary.dark";
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={keystone ? `Keystone ${letter}` : letter}
      sx={{
        width: s.w,
        height: s.h,
        minWidth: s.w,
        border: keystone ? "3px solid" : "2px solid",
        borderColor,
        borderRadius: 2,
        bgcolor: selected
          ? keystone
            ? "rgba(212,160,23,0.22)"
            : "secondary.light"
          : "background.paper",
        color: "text.primary",
        boxShadow: keystone
          ? selected
            ? "0 0 0 2px rgba(212,160,23,0.35), 0 2px 0 rgba(154,100,40,0.4)"
            : "0 0 0 2px rgba(212,160,23,0.28), 0 3px 0 rgba(154,100,40,0.35)"
          : selected
            ? "0 2px 0 rgba(154,100,40,0.45)"
            : "0 3px 0 rgba(30,82,82,0.28)",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.45 : 1,
        transform: selected ? "translateY(1px)" : "none",
        transition: "transform 120ms ease, background-color 120ms ease, border-color 120ms ease",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        WebkitTapHighlightColor: "transparent",
        "&:active:not(:disabled)": {
          transform: "translateY(2px)",
          boxShadow: keystone
            ? "0 0 0 2px rgba(212,160,23,0.28), 0 1px 0 rgba(154,100,40,0.35)"
            : "0 1px 0 rgba(30,82,82,0.28)",
        },
      }}
    >
      <Typography
        component="span"
        sx={{ fontWeight: 800, fontSize: s.font, lineHeight: 1, userSelect: "none" }}
      >
        {letter.toUpperCase()}
      </Typography>
    </Box>
  );
}
