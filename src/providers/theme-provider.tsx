import { useEffect, useState } from "react";

import {
  ThemeProviderContext,
  type Theme,
  type ThemeProviderState,
} from "./theme-context";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

const THEME_STORAGE_KEY = "better-auth-theme";

function getSystemTheme(): Theme {
  if (typeof window === "undefined") {
    return "light";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = THEME_STORAGE_KEY,
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === "undefined") {
      return defaultTheme;
    }
    const storedTheme = window.localStorage.getItem(storageKey) as Theme | null;
    return storedTheme ?? defaultTheme;
  });

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    const activeTheme = theme === "system" ? getSystemTheme() : theme;
    root.classList.add(activeTheme);
  }, [theme]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = () => {
      if (theme !== "system") {
        return;
      }
      if (typeof document === "undefined") {
        return;
      }
      const root = document.documentElement;
      root.classList.remove("light", "dark");
      root.classList.add(mediaQuery.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  const setTheme = (value: Theme) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(storageKey, value);
    }
    setThemeState(value);
  };

  const value: ThemeProviderState = {
    theme,
    setTheme,
  };

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}
