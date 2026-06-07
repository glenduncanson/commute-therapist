import { useState, useEffect } from "react";

type Theme = "light" | "dark";

let _theme: Theme =
  typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";

const listeners = new Set<() => void>();

function setGlobalTheme(t: Theme) {
  _theme = t;
  document.documentElement.classList.toggle("dark", t === "dark");
  listeners.forEach((fn) => fn());
}

// Apply on load
if (typeof document !== "undefined") {
  document.documentElement.classList.toggle("dark", _theme === "dark");
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(_theme);

  useEffect(() => {
    const fn = () => setTheme(_theme);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);

  function toggleTheme() {
    setGlobalTheme(theme === "dark" ? "light" : "dark");
  }

  return { theme, toggleTheme };
}
