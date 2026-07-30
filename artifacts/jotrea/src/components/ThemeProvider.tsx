import { useState, useEffect, useMemo, useCallback, type ReactNode } from "react";
import { ThemeContext, type Theme } from "@/hooks/useTheme";

const STORAGE_KEY = "jotrea_theme";

function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  const resolved = theme === "system" ? getSystemTheme() : theme;
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return (stored === "light" || stored === "dark" || stored === "system") ? stored : "system";
  });

  // Resolved value ("light" | "dark") factoring in system preference
  const [systemDark, setSystemDark] = useState(() => getSystemTheme() === "dark");

  // Apply class whenever theme changes
  useEffect(() => {
    applyTheme(theme);
  }, [theme, systemDark]);

  // Track system preference changes (relevant when theme === "system")
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    localStorage.setItem(STORAGE_KEY, t);
    setThemeState(t);
  }, []);

  const resolved = useMemo<"light" | "dark">(() => {
    if (theme === "system") return systemDark ? "dark" : "light";
    return theme;
  }, [theme, systemDark]);

  const value = useMemo(() => ({ theme, setTheme, resolved }), [theme, setTheme, resolved]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
