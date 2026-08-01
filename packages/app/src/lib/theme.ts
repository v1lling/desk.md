export type ThemePreference = "light" | "dark" | "system";

/** Apply a theme and keep system mode synchronized. Returns the listener cleanup. */
export function applyThemePreference(theme: ThemePreference): () => void {
  const root = document.documentElement;

  if (theme !== "system") {
    root.classList.toggle("dark", theme === "dark");
    return () => {};
  }

  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const sync = (matches: boolean) => root.classList.toggle("dark", matches);
  const handler = (event: MediaQueryListEvent) => sync(event.matches);
  sync(mediaQuery.matches);
  mediaQuery.addEventListener("change", handler);
  return () => mediaQuery.removeEventListener("change", handler);
}

/** Read only the theme field from Zustand's persisted preference envelope. */
export function readPersistedTheme(): ThemePreference {
  try {
    const raw = window.localStorage.getItem("desk-preferences");
    const theme = raw
      ? (JSON.parse(raw) as { state?: { theme?: unknown } }).state?.theme
      : undefined;
    return theme === "light" || theme === "dark" || theme === "system" ? theme : "system";
  } catch {
    return "system";
  }
}
