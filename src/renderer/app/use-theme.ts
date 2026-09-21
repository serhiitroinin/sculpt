import { useEffect, useState } from "react";
import { session } from "../session.ts";

export type ThemeMode = "system" | "light" | "dark";
export type Theme = "light" | "dark";

const KEY = "sculpt:theme";

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function stored(): ThemeMode {
  const forced = new URLSearchParams(window.location.search).get("theme");
  if (forced === "light" || forced === "dark" || forced === "system") return forced;
  const saved = window.localStorage.getItem(KEY);
  return saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
}

/** System is the default and keeps following the system while it is chosen. */
export function useTheme(): { mode: ThemeMode; theme: Theme; setMode(mode: ThemeMode): void } {
  const [mode, setMode] = useState<ThemeMode>(stored);
  const [system, setSystem] = useState<Theme>(systemTheme);

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: light)");
    const listener = (): void => setSystem(systemTheme());
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, []);

  const theme = mode === "system" ? system : mode;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    session.viewport?.setTheme(theme);
  }, [theme]);

  return {
    mode,
    theme,
    setMode: (next) => {
      window.localStorage.setItem(KEY, next);
      setMode(next);
    },
  };
}
