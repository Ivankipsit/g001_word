"use client";

import { useEffect, useRef, useState } from "react";
import { Box } from "@mui/material";
import { formatPoints, formatPointsFull } from "@/lib/points";

/** Compact points ("12k"); tap to show the exact value, reverts on blur or a tap elsewhere. */
export function Points({ value }: { value: number }) {
  const [full, setFull] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const compact = formatPoints(value);
  const exact = formatPointsFull(value);

  useEffect(() => {
    if (!full) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setFull(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [full]);

  if (compact === exact) return <>{compact}</>;

  return (
    <Box
      ref={ref}
      component="span"
      role="button"
      tabIndex={0}
      aria-label={`${exact} points`}
      onClick={(e) => {
        e.stopPropagation();
        setFull((v) => !v);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          setFull((v) => !v);
        } else if (e.key === "Escape") {
          setFull(false);
        }
      }}
      onBlur={() => setFull(false)}
      sx={{
        cursor: "pointer",
        borderBottom: "1px dotted",
        borderColor: "text.disabled",
        outline: "none",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {full ? exact : compact}
    </Box>
  );
}
