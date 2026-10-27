"use client";

import { useEffect, useRef, useState } from "react";
import { reactionChoices, type ReactionKind, type ReactionCount } from "./reactions";
import styles from "./post-social.module.css";

export default function CommentReactions({ value, counts, busy, signedIn, onLoginRequired, onChoose }: {
  value: ReactionKind | null; counts: ReactionCount[]; busy: boolean; signedIn: boolean;
  onLoginRequired: () => void; onChoose: (kind: ReactionKind) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const saving = useRef(false);
  const control = useRef<HTMLDivElement>(null);
  const selected = reactionChoices.find(choice => choice.kind === value);
  useEffect(() => {
    if (!open) return;
    function dismiss(event: PointerEvent) {
      if (!control.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  return <div className={styles.commentReactionControl} ref={control} onKeyDown={event => {
    if (event.key === "Escape") { setOpen(false); control.current?.querySelector("button")?.focus(); }
  }}>
    <button type="button" className={styles.likeAction} data-reaction={value ?? undefined} aria-pressed={!!value} aria-expanded={open} aria-busy={pending} disabled={busy || pending}
      onClick={() => { if (!signedIn) { onLoginRequired(); return; } setOpen(!open); }}>
      {selected ? `${selected.emoji} ${selected.label}` : "♡ React"}
    </button>
    {counts.length > 0 && <span className={styles.commentReactionCounts} aria-label="Comment reactions">{reactionChoices.map(choice => {
      const count = counts.find(item => item.kind === choice.kind)?.count ?? 0;
      return count > 0 ? <span key={choice.kind} aria-label={`${count} ${choice.label} reaction${count === 1 ? "" : "s"}`}><span aria-hidden="true">{choice.emoji}</span> {count}</span> : null;
    })}</span>}
    {open && <div className={styles.picker} role="group" aria-label="Choose a comment reaction">
      {reactionChoices.map(choice => <button key={choice.kind} type="button" disabled={busy || pending} aria-pressed={value === choice.kind}
        onClick={async () => {
          if (busy || saving.current) return;
          saving.current = true; setPending(true); setOpen(false);
          try { await onChoose(choice.kind); }
          finally { saving.current = false; setPending(false); }
        }}><span>{choice.emoji}</span>{choice.label}</button>)}
      <small>Select your current reaction to remove it.</small>
    </div>}
  </div>;
}
