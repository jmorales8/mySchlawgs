"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "./post-social.module.css";

export default function CommentOptions({ label, children }: { label: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    function close(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) ref.current.open = false;
    }
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  return <details ref={ref} className={styles.options} onKeyDown={event => {
    if (event.key === "Escape") { event.preventDefault(); ref.current!.open = false; ref.current?.querySelector("summary")?.focus(); }
  }}>
    <summary aria-label={label} title={label}><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg></summary>
    <div className={styles.optionsPanel} onClick={event => {
      if ((event.target as HTMLElement).closest("button")) { ref.current!.open = false; ref.current?.querySelector("summary")?.focus(); }
    }}>{children}</div>
  </details>;
}
