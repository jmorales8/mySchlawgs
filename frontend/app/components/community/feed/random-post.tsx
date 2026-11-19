"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../api";
import styles from "./random-post.module.css";
import sharedStyles from "../community.module.css";
import PromptSuggestions from "../prompts/prompt-suggestions";

const choices = [
  { value: "popular", title: "Popular", description: "5+ reactions and comments combined" },
  { value: "niche", title: "Niche", description: "Fewer than 5 reactions and comments" },
  { value: "relevant", title: "Relevant", description: "Someone commented in the past 7 days" },
  { value: "iotw", title: "#Idea of the Week", description: "Find posts tagged with either weekly idea hashtag" },
] as const;

export type DiscoveryCategory = typeof choices[number]["value"];

export default function RandomPost({ postId, ready, initialCategory = "popular", collapsible }: { postId?: string; ready: boolean; initialCategory?: DiscoveryCategory; collapsible: boolean }) {
  const router = useRouter();
  const [category, setCategory] = useState<DiscoveryCategory>(initialCategory);
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

  return <section ref={discoveryRef} className={styles.discovery} aria-label="Feeling bored?">
    <button ref={triggerRef} type="button" className={styles.discoveryTrigger} aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(!open)}>
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="m15.5 8.5-2 5-5 2 2-5z" />
      </svg>
      Explore
    </button>
    <div id={panelId} className={styles.discoveryReveal} data-open={open} inert={collapsible && !open}>
      <div className={styles.discoveryClip}>
        <div className={styles.discoveryPanel}>
          <h2>Feeling bored?</h2>
          <fieldset disabled={busy || !ready}>
            <legend className={sharedStyles.srOnly}>What are you in the mood for?</legend>
            {choices.map(choice => <label key={choice.value} className={styles.discoveryChoice} title={choice.description}>
              <input type="radio" name={`discovery-${postId ?? "feed"}`} value={choice.value} checked={category === choice.value} onChange={() => { setCategory(choice.value); setError(""); }} />
              <span><strong className={choice.value === "iotw" ? styles.ideaFull : undefined}>{choice.title}</strong>{choice.value === "iotw" && <strong className={styles.ideaShort} aria-hidden="true">#IOTW</strong>}<small className={sharedStyles.srOnly}>{choice.description}</small></span>
            </label>)}
          </fieldset>
          <button type="button" disabled={busy || !ready} onClick={() => void discover()}>{busy ? "Finding a schlawg…" : category === "iotw" ? "Find a tagged post" : "Surprise me ↗"}</button>
          {error && <p className={styles.discoveryError} role="status">{error}</p>}
          <PromptSuggestions onLogIn={() => setOpen(false)} />
        </div>
      </div>
    </div>
  </section>;
}
