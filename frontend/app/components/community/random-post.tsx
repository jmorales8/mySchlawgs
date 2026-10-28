"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../api";
import styles from "./community.module.css";

const choices = [
  { value: "popular", title: "Popular", description: "5+ reactions and comments combined" },
  { value: "niche", title: "Niche", description: "Fewer than 5 reactions and comments" },
  { value: "relevant", title: "Relevant", description: "Someone commented in the past 7 days" },
] as const;

export default function RandomPost({ postId, ready, initialCategory = "popular" }: { postId?: string; ready: boolean; initialCategory?: "popular" | "niche" | "relevant" }) {
  const router = useRouter();
  const [category, setCategory] = useState<string>(initialCategory);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const discoveryRef = useRef<HTMLElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function dismiss(event: PointerEvent) {
      if (event.target instanceof Node && !discoveryRef.current?.contains(event.target)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  async function discover() {
    setBusy(true); setError("");
    try {
      const params = new URLSearchParams({ category });
      if (postId) params.set("excludePostId", postId);
      const result = await api<{ postId: string }>(`/api/posts/random?${params}`);
      router.push(`/posts/${encodeURIComponent(result.postId)}?discovery=${encodeURIComponent(category)}#feed`);
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }

  return <section ref={discoveryRef} className={styles.discovery} aria-label="Discover a random post">
    <button ref={triggerRef} type="button" className={styles.discoveryTrigger} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}>
      Feeling bored? <span aria-hidden="true">{open ? "▴" : "▾"}</span>
    </button>
    <div id={panelId} className={styles.discoveryPanel} data-open={open}>
    <h2>Feeling bored?</h2>
    <fieldset disabled={busy || !ready}>
      <legend className={styles.srOnly}>What are you in the mood for?</legend>
      {choices.map(choice => <label key={choice.value} className={styles.discoveryChoice} title={choice.description}>
        <input type="radio" name={`discovery-${postId ?? "feed"}`} value={choice.value} checked={category === choice.value} onChange={() => { setCategory(choice.value); setError(""); }} />
        <span><strong>{choice.title}</strong><small className={styles.srOnly}>{choice.description}</small></span>
      </label>)}
    </fieldset>
    <button type="button" disabled={busy || !ready} onClick={() => void discover()}>{busy ? "Finding a schlawg…" : "Surprise me ↗"}</button>
    {error && <p className={styles.discoveryError} role="status">{error}</p>}
    </div>
  </section>;
}
