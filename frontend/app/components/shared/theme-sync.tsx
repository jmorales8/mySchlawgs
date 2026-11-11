"use client";

import { useEffect } from "react";
import { isTheme, themeChangeEvent, themeCookie, themeKey } from "./theme-preference";

export default function ThemeSync() {
  useEffect(() => {
    const root = document.documentElement;
    function apply(theme: unknown) {
      root.dataset.theme = isTheme(theme)
        ? theme
        : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      window.dispatchEvent(new Event(themeChangeEvent));
    }
    function sync(event: StorageEvent) {
      if (event.key !== themeKey && event.key !== null) return;
      try {
        if (event.storageArea !== window.localStorage) return;
        // Read the latest value in case several storage events were queued.
        const theme = window.localStorage.getItem(themeKey);
        document.cookie = themeCookie(isTheme(theme) ? theme : null);
        apply(theme);
      } catch { /* Keep the current palette when storage is unavailable. */ }
    }

    // Reapply the preference if React had to rebuild the document.
    let savedTheme: string | null = null;
    try { savedTheme = window.localStorage.getItem(themeKey); } catch {}
    apply(isTheme(savedTheme) ? savedTheme : root.dataset.theme);
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  return null;
}
