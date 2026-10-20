"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";
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

  async function discover() {
    setBusy(true); setError("");
    try {
      const params = new URLSearchParams({ category });
      if (postId) params.set("excludePostId", postId);
      const result = await api<{ postId: string }>(`/api/posts/random?${params}`);
      router.push(`/posts/${encodeURIComponent(result.postId)}?discovery=${encodeURIComponent(category)}#feed`);
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }

  return <section className={styles.discovery} aria-label="Discover a random post">
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
  </section>;
}
