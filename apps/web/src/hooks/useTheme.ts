import { useEffect, useState } from "react";

const STORAGE_KEY = "bookprepper-theme";

type ThemeMode = "light" | "dark";

export function useTheme(): [ThemeMode, () => void] {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") {
      return "light";
    }
    const stored = window.localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    if (stored === "dark" || stored === "light") {
      return stored;
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    document.body.classList.toggle("theme-dark", theme === "dark");
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return [theme, toggleTheme];
}

