"use client";

import { createTheme, type Theme } from "@mui/material/styles";

const typography = {
  fontFamily: [
    "var(--font-nunito)",
    "Nunito",
    "Segoe UI",
    "system-ui",
    "sans-serif",
  ].join(","),
  h1: { fontWeight: 800, letterSpacing: "-0.02em" },
  h2: { fontWeight: 800, letterSpacing: "-0.02em" },
  h3: { fontWeight: 700 },
  h4: { fontWeight: 700 },
  h5: { fontWeight: 700 },
  h6: { fontWeight: 700 },
  button: { fontWeight: 700, textTransform: "none" as const },
};

const shape = { borderRadius: 14 };

function sharedComponents(mode: "light" | "dark") {
  const selectedNav = mode === "light" ? "#2A6F6F" : "#5EB8B8";
  return {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          minHeight: 48,
          borderRadius: 12,
          px: 2.5,
        },
        sizeLarge: { minHeight: 52, fontSize: "1.05rem" },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: { minWidth: 48, minHeight: 48 },
      },
    },
    MuiBottomNavigationAction: {
      styleOverrides: {
        root: {
          minWidth: 64,
          paddingTop: 10,
          "&.Mui-selected": { color: selectedNav },
        },
        label: { fontSize: "0.75rem", fontWeight: 700 },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: "none" },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 700 },
      },
    },
    MuiTextField: {
      defaultProps: { size: "medium" as const },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          minHeight: 48,
          alignItems: "center",
        },
        input: {
          paddingTop: 12,
          paddingBottom: 12,
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        outlined: {
          lineHeight: "1.2",
          "&.MuiInputLabel-root:not(.MuiInputLabel-shrink)": {
            transform: "translate(14px, 14px) scale(1)",
          },
        },
      },
    },
  };
}

/**
 * Calm forge atmosphere — soft teal/slate, warm amber accents.
 * Readable for teens; large touch targets for mobile.
 */
export function createAppTheme(mode: "light" | "dark"): Theme {
  if (mode === "dark") {
    return createTheme({
      cssVariables: true,
      palette: {
        mode: "dark",
        primary: {
          main: "#5EB8B8",
          light: "#7FCFCF",
          dark: "#3D8F8F",
          contrastText: "#0E1614",
        },
        secondary: {
          main: "#D9A05C",
          light: "#E8BC84",
          dark: "#C4833A",
          contrastText: "#1A1A16",
        },
        background: {
          default: "#121A18",
          paper: "#1C2623",
        },
        text: {
          primary: "#E8EFEC",
          secondary: "#A8B8B3",
        },
        success: { main: "#5A9E74" },
        warning: { main: "#D9A05C" },
        error: { main: "#D07062" },
        info: { main: "#6A9BB8" },
        divider: "rgba(94, 184, 184, 0.22)",
      },
      typography,
      shape,
      components: sharedComponents("dark"),
    });
  }

  return createTheme({
    cssVariables: true,
    palette: {
      mode: "light",
      primary: {
        main: "#2A6F6F",
        light: "#3D8F8F",
        dark: "#1E5252",
        contrastText: "#F7F4EF",
      },
      secondary: {
        main: "#C4833A",
        light: "#D9A05C",
        dark: "#9A6428",
        contrastText: "#1A1A16",
      },
      background: {
        default: "#E8EFEA",
        paper: "#F7F4EF",
      },
      text: {
        primary: "#1C2422",
        secondary: "#4A5A56",
      },
      success: { main: "#3B7A57" },
      warning: { main: "#C4833A" },
      error: { main: "#B54A3C" },
      info: { main: "#3D6B8A" },
      divider: "rgba(42, 111, 111, 0.18)",
    },
    typography,
    shape,
    components: sharedComponents("light"),
  });
}

export const themeColorLight = "#2A6F6F";
export const themeColorDark = "#1C2623";

export function shellGradient(mode: "light" | "dark"): string {
  if (mode === "dark") {
    return [
      "radial-gradient(ellipse at 10% 0%, rgba(94,184,184,0.18), transparent 50%)",
      "radial-gradient(ellipse at 100% 0%, rgba(217,160,92,0.12), transparent 40%)",
      "linear-gradient(180deg, #0F1614 0%, #121A18 100%)",
    ].join(", ");
  }
  return [
    "radial-gradient(ellipse at 10% 0%, rgba(61,143,143,0.2), transparent 50%)",
    "radial-gradient(ellipse at 100% 0%, rgba(196,131,58,0.14), transparent 40%)",
    "linear-gradient(180deg, #DCE8E2 0%, #E8EFEA 100%)",
  ].join(", ");
}

export function heroGradient(mode: "light" | "dark"): string {
  if (mode === "dark") {
    return [
      "radial-gradient(ellipse at 20% 0%, rgba(94,184,184,0.28), transparent 55%)",
      "radial-gradient(ellipse at 90% 10%, rgba(217,160,92,0.18), transparent 45%)",
      "linear-gradient(165deg, #0E1614 0%, #121A18 40%, #1A2218 100%)",
    ].join(", ");
  }
  return [
    "radial-gradient(ellipse at 20% 0%, rgba(61,143,143,0.28), transparent 55%)",
    "radial-gradient(ellipse at 90% 10%, rgba(196,131,58,0.22), transparent 45%)",
    "linear-gradient(165deg, #D5E4DC 0%, #E8EFEA 40%, #F0E8DC 100%)",
  ].join(", ");
}
