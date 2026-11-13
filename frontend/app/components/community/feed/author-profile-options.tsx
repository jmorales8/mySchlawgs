"use client";

import { useEffect, useRef, useState } from "react";
import Avatar, { type AvatarUser } from "../../shared/avatar";
import styles from "./photo-card.module.css";

export default function AuthorProfileOptions({ author }: { author: AvatarUser }) {
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, [open]);

  return <div className={styles.authorProfileOptions} ref={root} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }} onKeyDown={event => {
    if (event.key !== "Escape" || !open) return;
    event.stopPropagation();
    setOpen(false);
    trigger.current?.focus();
  }}>
    <button ref={trigger} type="button" className={styles.authorProfileTrigger} aria-label={`Profile options for @${author.username}`} aria-expanded={open} onClick={() => setOpen(current => !current)}>
      <Avatar user={author} />
    </button>
    <div className={styles.authorProfileDrawer} data-open={open} inert={!open}>
      <div className={styles.authorProfileDrawerBody}>
        <button type="button" disabled>Report user profile</button>
      </div>
    </div>
  </div>;
}
