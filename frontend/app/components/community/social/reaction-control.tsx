"use client";

import { useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { reactionChoices, type ReactionKind } from "./reactions";
import styles from "./reaction-control.module.css";

export default function ReactionControl({ value, disabled, signedIn, onLoginRequired, onChoose, label = "Choose a reaction", count }: {
  value: ReactionKind | null; disabled?: boolean; signedIn: boolean;
  onLoginRequired: () => void; onChoose: (kind: ReactionKind) => Promise<void>; label?: string; count?: number;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const popup = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const saving = useRef(false);
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pending, setPending] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number; below: boolean } | null>(null);
  const selected = reactionChoices.find(choice => choice.kind === value);

  function cancelClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }
  function cancelOpen() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
  }
  function close() { cancelOpen(); cancelClose(); setPosition(null); }
  function hover() {
    cancelClose(); cancelOpen();
    if (position || disabled || saving.current) return;
    hoverTimer.current = setTimeout(() => {
      if (root.current?.matches(":hover") && !trigger.current?.disabled) open();
    }, 500);
  }
  function open() {
    cancelOpen(); cancelClose();
    if (disabled || saving.current || !root.current) return;
    const rect = root.current.getBoundingClientRect();
    const width = Math.min(158, window.innerWidth - 24);
    const below = rect.top < 80;
    setPosition({ left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), top: below ? rect.bottom : rect.top, below });
  }
  function leave() {
    cancelOpen(); cancelClose();
    closeTimer.current = setTimeout(() => setPosition(null), 120);
  }
  function contains(target: EventTarget | null) {
    return target instanceof Node && (root.current?.contains(target) || popup.current?.contains(target));
  }
  function blur(event: FocusEvent) { if (!contains(event.relatedTarget)) close(); }
  function keyDown(event: KeyboardEvent) {
    if (["Escape", "ArrowDown", "ArrowUp"].includes(event.key)) event.stopPropagation();
    if (event.key === "Escape") { event.preventDefault(); close(); trigger.current?.focus(); }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!position) { open(); requestAnimationFrame(() => popup.current?.querySelector<HTMLButtonElement>("button")?.focus()); }
      else {
        const buttons = Array.from(popup.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const next = index < 0 ? (event.key === "ArrowDown" ? 0 : buttons.length - 1)
          : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next]?.focus();
      }
    }
  }
  async function choose(kind: ReactionKind) {
    close();
    if (disabled || saving.current) return;
    if (!signedIn) { onLoginRequired(); trigger.current?.focus(); return; }
    saving.current = true; setPending(true);
    try { await onChoose(kind); }
    finally {
      saving.current = false; setPending(false);
      requestAnimationFrame(() => { if (trigger.current?.isConnected) trigger.current.focus(); });
    }
  }

  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); if (holdTimer.current) clearTimeout(holdTimer.current); if (hoverTimer.current) clearTimeout(hoverTimer.current); }, []);
  useEffect(() => {
    if (!position) return;
    function dismiss(event: PointerEvent) {
      const node = event.target as Node;
      if (!root.current?.contains(node) && !popup.current?.contains(node)) setPosition(null);
    }
    function scroll() { setPosition(null); }
    document.addEventListener("pointerdown", dismiss);
    window.addEventListener("resize", scroll);
    window.addEventListener("scroll", scroll, true);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      window.removeEventListener("resize", scroll);
      window.removeEventListener("scroll", scroll, true);
    };
  }, [position]);

  return <div className={styles.control} ref={root} onPointerEnter={event => { if (event.pointerType === "mouse") hover(); }}
    onPointerLeave={event => { if (event.pointerType === "mouse") leave(); }} onBlur={blur} onKeyDown={keyDown}>
    <button ref={trigger} type="button" className={styles.primary} data-selected={!!value} aria-pressed={!!value}
      aria-label={count !== undefined ? `${selected?.label ?? "Like"} · ${count} reaction${count === 1 ? "" : "s"}` : undefined}
      aria-expanded={!!position} aria-controls={position ? id : undefined}
      aria-busy={pending} disabled={disabled || pending}
      onPointerDown={event => {
        if (event.pointerType !== "touch") return;
        held.current = false;
        holdTimer.current = setTimeout(() => { held.current = true; open(); }, 400);
      }}
      onPointerUp={() => { if (holdTimer.current) clearTimeout(holdTimer.current); }}
      onPointerCancel={() => { if (holdTimer.current) clearTimeout(holdTimer.current); held.current = false; }}
      onContextMenu={event => event.preventDefault()}
      onClick={() => { if (held.current) { held.current = false; return; } void choose(value ?? "like"); }}>
      {selected ? <span className={styles.selectedEmoji} aria-hidden="true"><span>{selected.emoji}</span></span> : <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M7 10H3v11h4V10Zm0 10h11a2 2 0 0 0 2-1.6l1.4-7A2 2 0 0 0 19.4 9H14l1-5c.3-2-2-3-3-1l-5 7v10Z" /></svg>}
      <span>{count ?? selected?.label ?? "Like"}</span>
    </button>
    {position && createPortal(<div ref={popup} className={styles.popup} data-below={position.below} style={{ left: position.left, top: position.top }}
      onPointerEnter={cancelClose} onPointerLeave={leave} onBlur={blur} onKeyDown={keyDown}>
      <div id={id} className={styles.choices} role="group" aria-label={label}>
        {reactionChoices.map(choice => <button type="button" key={choice.kind} data-reaction={choice.kind} aria-label={choice.label} aria-pressed={value === choice.kind}
          disabled={disabled || pending} onClick={() => void choose(choice.kind)}>
          <span aria-hidden="true">{choice.emoji}</span>
        </button>)}
      </div>
    </div>, document.body)}
  </div>;
}
