"use client";

import * as React from "react";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v15-appRouter";
import { ThemeProvider, CssBaseline } from "@mui/material";
import {
  createAppTheme,
  themeColorDark,
  themeColorLight,
} from "@/theme/theme";
import { useGameStore } from "@/game/store";
import type { ThemePreference } from "@/game/types";

function useResolvedMode(preference: ThemePreference): "light" | "dark" {
  const [systemDark, setSystemDark] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => setSystemDark(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  if (preference === "light") return "light";
  if (preference === "dark") return "dark";
  return systemDark ? "dark" : "light";
}

function ThemedApp({ children }: { children: React.ReactNode }) {
  const preference = useGameStore((s) => s.settings.theme);
  const mode = useResolvedMode(preference);
  const theme = React.useMemo(() => createAppTheme(mode), [mode]);

  React.useEffect(() => {
    document.documentElement.style.colorScheme = mode;
    document.documentElement.dataset.theme = mode;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute(
        "content",
        mode === "dark" ? themeColorDark : themeColorLight,
      );
    }
  }, [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}

export function ThemeRegistry({ children }: { children: React.ReactNode }) {
  return (
    <AppRouterCacheProvider options={{ enableCssLayer: true }}>
      <ThemedApp>{children}</ThemedApp>
    </AppRouterCacheProvider>
  );
}

export { useResolvedMode };
