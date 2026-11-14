"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import styles from "./post-social.module.css";

export default function CommentOptions({ label, children }: { label: string; children: ReactNode }) {
  const panelId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function close(event: Event) {
      if (event.target instanceof Node && panel.current?.contains(event.target)) return;
      panel.current?.hidePopover();
    }
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, []);
  return <div className={styles.options}>
    <button type="button" ref={trigger} popoverTarget={panelId} aria-label={label} title={label}><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg></button>
    <div id={panelId} ref={panel} popover="auto" className={styles.optionsPanel} onToggle={event => {
      if (event.newState !== "open" || !trigger.current) return;
      const menu = event.currentTarget;
      const anchor = trigger.current.getBoundingClientRect();
      const { clientWidth, clientHeight } = document.documentElement;
      const gap = 4;
      const gutter = 8;
      const below = clientHeight - anchor.bottom - gap;
      const above = anchor.top - gap;
      menu.style.maxHeight = "";
      const openAbove = below < menu.offsetHeight + gutter && above > below;
      menu.style.maxHeight = `${Math.max(0, (openAbove ? above : below) - gutter)}px`;
      menu.style.left = `${Math.max(gutter, Math.min(anchor.right, clientWidth - gutter) - menu.offsetWidth)}px`;
      menu.style.top = `${openAbove ? anchor.top - gap - menu.offsetHeight : anchor.bottom + gap}px`;
    }} onClick={event => {
      if ((event.target as HTMLElement).closest("button")) {
        event.currentTarget.hidePopover();
        trigger.current?.focus({ preventScroll: true });
      }
    }}>{children}</div>
  </div>;
}
