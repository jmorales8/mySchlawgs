"use client";

import { useSyncExternalStore } from "react";
import styles from "./theme-toggle.module.css";

const key = "myschlawgs-theme";
const eventName = "myschlawgs-theme-change";

function subscribe(onChange: () => void) {
  function sync(event: StorageEvent) {
    if (event.key !== key && event.key !== null) return;
    const value = event.newValue;
    document.documentElement.dataset.theme = value === "dark" || value === "light"
      ? value : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    onChange();
  }
  window.addEventListener(eventName, onChange);
  window.addEventListener("storage", sync);
  return () => {
    window.removeEventListener(eventName, onChange);
    window.removeEventListener("storage", sync);
  };
}

export default function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe,
    () => document.documentElement.dataset.theme === "dark", () => false);
  function toggle() {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(key, next); } catch { /* Keep switching usable when storage is blocked. */ }
    window.dispatchEvent(new Event(eventName));
  }
  return <button type="button" className={styles.toggle} onClick={toggle}
    aria-label="Dark mode" aria-pressed={dark} title={dark ? "Switch to light mode" : "Switch to dark mode"}>
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {dark ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></> : <path d="M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14Z" />}
    </svg><span>{dark ? "Light mode" : "Dark mode"}</span>
  </button>;
}
