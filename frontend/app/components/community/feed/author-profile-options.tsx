"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Avatar, { type AvatarUser } from "../../shared/avatar";
import { api } from "../../api";
import { useAccount } from "../../../contexts/account-context";
import { useApiQuery } from "../../../hooks/use-api-query";
import styles from "./photo-card.module.css";

export default function AuthorProfileOptions({ author, posterId }: { author: AvatarUser; posterId: string }) {
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [flipVisible, setFlipVisible] = useState(false);
  const { user } = useAccount();
  const following = useApiQuery<string[]>("/api/account/following", { enabled: !!user, authenticated: true });
  const isFollowing = !!user && (following.data?.includes(posterId) ?? false);

  useEffect(() => {
    const button = trigger.current;
    if (!isFollowing || !button) return;
    let inView = false;
    function syncVisibility() {
      setFlipVisible(inView && document.visibilityState === "visible");
    }
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      syncVisibility();
    });
    observer.observe(button);
    document.addEventListener("visibilitychange", syncVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", syncVisibility);
    };
  }, [isFollowing]);

  async function toggleFollow() {
    setBusy(true);
    setError("");
    try {
      await api(`/api/account/following/${posterId}`, { method: isFollowing ? "DELETE" : "PUT" });
      await following.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

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
      <Avatar user={author} className={isFollowing && flipVisible ? styles.flip : undefined} />
    </button>
    <div className={styles.authorProfileDrawer} data-open={open} inert={!open}>
      <div className={styles.authorProfileDrawerBody}>
        <div className={styles.authorProfileActions}>
          {user ? <>
            <button type="button" disabled={busy || following.refreshing || !following.data} onClick={() => void toggleFollow()}>
              {isFollowing ? "Unfollow schlawg bill poster" : "Follow schlawg bill poster"}
            </button>
            {following.error && <button type="button" onClick={() => void following.refresh()}>Retry loading follows</button>}
            {(error || following.error) && <p role="alert">{error || following.error}</p>}
          </> : <Link href="/#account">Log in to follow schlawg bill posters</Link>}
          <button type="button" disabled>Report user profile</button>
        </div>
      </div>
    </div>
  </div>;
}
